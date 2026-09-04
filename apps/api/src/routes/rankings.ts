/**
 * Üç sıralama (docs/01 §8).
 *
 * Üç ayrı liste, çünkü tek sıralama tek oyun tarzını ödüllendirir. Özellikle
 * Kılıç sıralaması önemli: bölge tutamayan oyuncunun da tırmanacağı bir
 * merdiven olur, böylece kaybeden oyuncu oyundan çıkmaz.
 */
import {
  addanArma,
  armaDuzelt,
  conquestScore,
  ittifakSeviyesi,
  unvan,
  type Arma,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { findLordByUser, lordArmasi } from '../services/lord.js';

const SAYFA = 25;

type Board = 'fame' | 'conquest' | 'elo';

interface Satir {
  sira: number;
  lordId: string;
  name: string;
  level: number;
  deger: number;
  bolgeSayisi: number;
  tahtSahibi: boolean;
  /** Heraldik kimlik ve unvan — sıralama bir isim listesi olmaktan çıkıyor. */
  arma: Arma;
  unvan: string;
}

/**
 * Arma alanları iki sorguda da lazım; tek yerde tutuluyor ki biri
 * güncellenip diğeri unutulmasın.
 */
const ARMA_SECIMI = {
  armaKalkan: true,
  armaDesen: true,
  armaRenk1: true,
  armaRenk2: true,
  armaSembol: true,
} as const;

/** Fetih puanı bölgelerden hesaplandığı için SQL'de sıralanamaz; bellekte yapılır. */
async function fetihSiralamasi(worldId: string): Promise<Satir[]> {
  const lords = await prisma.lord.findMany({
    where: { worldId },
    select: {
      id: true,
      name: true,
      level: true,
      fame: true,
      ...ARMA_SECIMI,
      regions: { select: { type: true, level: true } },
    },
  });
  return lords
    .map((l) => ({
      sira: 0,
      lordId: l.id,
      name: l.name,
      level: l.level,
      deger: conquestScore(l.regions),
      bolgeSayisi: l.regions.filter((r) => r.type !== 'taht').length,
      tahtSahibi: l.regions.some((r) => r.type === 'taht'),
      arma: lordArmasi(l),
      unvan: unvan(l.fame, l.regions.some((r) => r.type === 'taht')).ad,
    }))
    .sort((a, b) => b.deger - a.deger)
    .map((r, i) => ({ ...r, sira: i + 1 }));
}

async function basitSiralama(worldId: string, alan: 'fame' | 'elo'): Promise<Satir[]> {
  const lords = await prisma.lord.findMany({
    where: { worldId },
    orderBy: { [alan]: 'desc' },
    select: {
      id: true,
      name: true,
      level: true,
      fame: true,
      elo: true,
      ...ARMA_SECIMI,
      regions: { select: { type: true } },
    },
  });
  return lords.map((l, i) => ({
    sira: i + 1,
    lordId: l.id,
    name: l.name,
    level: l.level,
    deger: alan === 'fame' ? l.fame : l.elo,
    bolgeSayisi: l.regions.filter((r) => r.type !== 'taht').length,
    tahtSahibi: l.regions.some((r) => r.type === 'taht'),
    arma: lordArmasi(l),
    unvan: unvan(l.fame, l.regions.some((r) => r.type === 'taht')).ad,
  }));
}

/** Bir ittifakın sıralamadaki satırı. */
interface IttifakSatiri {
  sira: number;
  id: string;
  ad: string;
  etiket: string;
  arma: Arma;
  seviye: number;
  uyeSayisi: number;
  toplamSohret: number;
  bolgeSayisi: number;
  benimki: boolean;
}

/**
 * İttifak sıralaması.
 *
 * Ölçü TOPLAM ŞÖHRET, lord sıralamasıyla aynı. İkinci bir "ittifak gücü"
 * formülü uydursaydık oyuncunun kafasında iki ayrı güç fikri olurdu ve
 * ikisi birbirini tutmadığında hangisinin doğru olduğu sorulurdu.
 *
 * Üye sayısına BÖLMÜYORUZ: sekiz kişilik bir ittifak üç kişilikten daha
 * güçlüdür ve sıralama bunu saklamamalı. Ortalama şöhret ayrı bir soru
 * ("kim daha verimli") ve onun cevabı üye listesinde zaten duruyor.
 */
async function ittifakSiralamasi(worldId: string, allianceId: string | null) {
  const hepsi = await prisma.alliance.findMany({
    where: { worldId },
    select: {
      id: true,
      name: true,
      tag: true,
      xp: true,
      armaKalkan: true,
      armaDesen: true,
      armaRenk1: true,
      armaRenk2: true,
      armaSembol: true,
      members: { select: { id: true, fame: true, _count: { select: { regions: true } } } },
    },
  });

  return hepsi
    .map((a) => ({
      id: a.id,
      ad: a.name,
      etiket: a.tag,
      arma: a.armaKalkan
        ? armaDuzelt({
            kalkan: a.armaKalkan,
            desen: a.armaDesen ?? undefined,
            renk1: a.armaRenk1 ?? undefined,
            renk2: a.armaRenk2 ?? undefined,
            sembol: a.armaSembol ?? undefined,
          })
        : addanArma(a.name),
      seviye: ittifakSeviyesi(a.xp).seviye,
      uyeSayisi: a.members.length,
      toplamSohret: a.members.reduce((t, u) => t + u.fame, 0),
      bolgeSayisi: a.members.reduce((t, u) => t + u._count.regions, 0),
      benimki: a.id === allianceId,
    }))
    .sort((x, y) => y.toplamSohret - x.toplamSohret)
    .map((a, i): IttifakSatiri => ({ sira: i + 1, ...a }));
}

export async function rankingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/rankings/:board', { preHandler: requireAuth }, async (req) => {
    const { board } = z
      .object({ board: z.enum(['fame', 'conquest', 'elo']) })
      .parse(req.params);
    const { page } = z.object({ page: z.coerce.number().int().min(0).default(0) }).parse(req.query);

    const lordId = await findLordByUser(req.user.userId);
    const me = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true },
    });

    const tum: Satir[] =
      board === 'conquest'
        ? await fetihSiralamasi(me.worldId)
        : await basitSiralama(me.worldId, board as 'fame' | 'elo');

    const benim = tum.find((r) => r.lordId === lordId) ?? null;

    return {
      board: board as Board,
      toplam: tum.length,
      sayfa: page,
      sayfaBoyu: SAYFA,
      satirlar: tum.slice(page * SAYFA, page * SAYFA + SAYFA),
      benim,
    };
  });

  /**
   * Bir lordu şikâyet eder.
   *
   * Şikâyet edilen lorda hiçbir şey OLMUYOR: kayıt tutuluyor, kararı insan
   * veriyor. Otomatik ceza, kalabalığın birini oyundan atmasına yarayan bir
   * silaha dönerdi.
   */
  /**
   * İttifak sıralaması: kendi ekranı değil, kendi SEKMESİ.
   *
   * Sıralama ekranının işi "diyarda kim önde"; ittifak bunun bir başka
   * ölçekte sorulmuş hâli, ayrı bir soru değil. İttifak ekranındaki liste
   * ise sıralama değil, KATILACAK ittifak arama listesi — iki iş, iki yer.
   */
  app.get('/rankings-ittifak', { preHandler: requireAuth }, async (req) => {
    const { page } = z.object({ page: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    const lordId = await findLordByUser(req.user.userId);
    const me = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, allianceId: true },
    });

    const tum = await ittifakSiralamasi(me.worldId, me.allianceId);
    return {
      toplam: tum.length,
      sayfa: page,
      sayfaBoyu: SAYFA,
      satirlar: tum.slice(page * SAYFA, page * SAYFA + SAYFA),
      benim: tum.find((a) => a.benimki) ?? null,
    };
  });

  app.post('/rapor/:lordId', { preHandler: requireAuth }, async (req) => {
    const { lordId: hedefId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const { sebep } = z
      .object({ sebep: z.string().min(3, 'Sebebi kısaca yaz.').max(300) })
      .parse(req.body);

    const benim = await findLordByUser(req.user.userId);
    if (benim === hedefId) {
      throw new GameError('Kendini şikâyet edemezsin.', 400, 'GECERSIZ_ISTEK');
    }
    if (!(await prisma.lord.findUnique({ where: { id: hedefId }, select: { id: true } }))) {
      throw hata.bulunamadi('Lord');
    }

    // Aynı kişiyi tekrar tekrar şikâyet etmek sayıyı şişirmesin: tek kayıt,
    // sebebi güncellenir.
    await prisma.report.upsert({
      where: { reporterId_targetId: { reporterId: benim, targetId: hedefId } },
      create: { reporterId: benim, targetId: hedefId, reason: sebep },
      update: { reason: sebep, createdAt: new Date() },
    });

    return { alindi: true };
  });
}
