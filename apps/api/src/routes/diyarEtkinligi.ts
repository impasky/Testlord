/**
 * Hafta sonu diyar seferi (docs/09 §2.6) — ortak hedef, ortak ödül.
 *
 * Kural shared `diyarEtkinligi.ts`te (pencere, tema, hedef, ödül kararı);
 * burada yalnız sayım. Sayım mevcut kayıtlardan TÜRETİLİYOR — akın,
 * savaş ve eğitim kuyruğu satırları — ayrı bir etkinlik tablosu yok.
 *
 * Diyarın toplamı lord başına değil diyar başına aynı sayı ve hafta sonu
 * herkes kartı açıyor: toplam bir dakikalığına bellekte tutuluyor
 * (`diyarSayimi`). Lordun kendi katkısı her seferinde taze.
 */
import {
  UNIT_TYPES,
  aktifPenceresi,
  diyarEtkinligi,
  etkinlikHakki,
  etkinlikHedefi,
  etkinlikOdulu,
  storageCapacity,
  type EtkinlikOlcutu,
  type EtkinlikPenceresi,
  type UnitType,
} from '@lordlar/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { GameError } from '../errors.js';
import { arastirmaBonusuOku, binalariOku, findLordByUser, tickLord } from '../services/lord.js';

/**
 * Şimdiki an. Geliştirmede `x-test-an` başlığı onu kaydırıyor: hafta sonu
 * penceresini hafta içinde sınamak başka türlü mümkün değil. Üretimde
 * başlık yok sayılıyor — oyuncu saatini değiştirip etkinliği açamaz.
 */
function simdi(req: FastifyRequest): Date {
  if (env.NODE_ENV !== 'production') {
    const h = req.headers['x-test-an'];
    if (typeof h === 'string') {
      const t = new Date(h);
      if (!Number.isNaN(t.getTime())) return t;
    }
  }
  return new Date();
}

/** Bir lordun ya da bütün diyarın (gerçek oyuncuların) pencere içindeki sayısı. */
async function say(
  olcut: EtkinlikOlcutu,
  p: EtkinlikPenceresi,
  kim: { lordId: string } | { worldId: string },
): Promise<number> {
  const aralik = { gte: p.bas, lt: p.son };
  // NPC lordlar diyarın ortak çubuğunu doldurmuyor: hedef oyuncuların.
  const lordSuzgeci = 'lordId' in kim ? { id: kim.lordId } : { worldId: kim.worldId, isNpc: false };
  switch (olcut) {
    case 'akin_zaferi':
      return prisma.akin.count({
        where: { resolved: true, kazanildi: true, arriveAt: aralik, lord: lordSuzgeci },
      });
    case 'savas_zaferi':
      return prisma.battle.count({
        where: { result: 'attacker_win', createdAt: aralik, attacker: lordSuzgeci },
      });
    case 'egitilen_asker': {
      const satirlar = await prisma.queue.findMany({
        where: { kind: 'train', startedAt: aralik, lord: lordSuzgeci },
        select: { payload: true },
      });
      return satirlar.reduce((t, q) => {
        const yuk = q.payload as { unitType?: string; count?: number };
        return UNIT_TYPES.includes(yuk.unitType as UnitType) ? t + Math.max(0, yuk.count ?? 0) : t;
      }, 0);
    }
  }
}

/** Diyarın toplamı ve hedefi; bir dakika bellekte. */
const ONBELLEK_MS = 60_000;
const onbellek = new Map<string, { an: number; toplam: number; hedef: number }>();

async function diyarSayimi(worldId: string, p: EtkinlikPenceresi, simdiMs: number) {
  const anahtar = `${worldId}|${p.bas.getTime()}|${p.tanim.key}`;
  const k = onbellek.get(anahtar);
  if (k && simdiMs - k.an < ONBELLEK_MS) return k;
  const { ilkGun, sonGun } = aktifPenceresi(p.bas);
  const [toplam, aktifSatirlari] = await Promise.all([
    p.durum === 'yaklasiyor' ? Promise.resolve(0) : say(p.tanim.olcut, p, { worldId }),
    prisma.gunlukAktiflik.findMany({
      where: { gun: { gte: ilkGun, lte: sonGun }, lord: { worldId, isNpc: false } },
      select: { lordId: true },
      distinct: ['lordId'],
    }),
  ]);
  const yeni = { an: simdiMs, toplam, hedef: etkinlikHedefi(p.tanim, aktifSatirlari.length) };
  onbellek.set(anahtar, yeni);
  // Eski etkinliklerin kayıtları birikmesin.
  if (onbellek.size > 500) onbellek.delete(onbellek.keys().next().value!);
  return yeni;
}

export async function diyarEtkinligiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/diyar-etkinligi', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const an = simdi(req);
    const p = diyarEtkinligi(an);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { level: true, worldId: true, diyarEtkinligiOdulu: true },
    });
    const [diyar, katkim] = await Promise.all([
      diyarSayimi(lord.worldId, p, an.getTime()),
      p.durum === 'yaklasiyor' ? Promise.resolve(0) : say(p.tanim.olcut, p, { lordId }),
    ]);
    return {
      etkinlik: {
        ...p.tanim,
        bas: p.bas,
        son: p.son,
        odulSonu: p.odulSonu,
        durum: p.durum,
      },
      hedef: diyar.hedef,
      toplam: diyar.toplam,
      katkim,
      odul: {
        kaynak: etkinlikOdulu(lord.level),
        ...etkinlikHakki(p, diyar.toplam, diyar.hedef, katkim, lord.diyarEtkinligiOdulu),
      },
    };
  });

  app.post('/diyar-etkinligi/odul', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const an = simdi(req);
    const p = diyarEtkinligi(an);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: {
        level: true,
        worldId: true,
        arastirmalar: true,
        binalar: true,
        diyarEtkinligiOdulu: true,
      },
    });
    // Ödül anında diyar toplamı TAZE: önbellekteki bir dakikalık sayı,
    // hedefi az önce geçen diyara "henüz değil" diyebilirdi.
    onbellek.delete(`${lord.worldId}|${p.bas.getTime()}|${p.tanim.key}`);
    const [diyar, katkim] = await Promise.all([
      diyarSayimi(lord.worldId, p, an.getTime()),
      p.durum === 'yaklasiyor' ? Promise.resolve(0) : say(p.tanim.olcut, p, { lordId }),
    ]);
    const hak = etkinlikHakki(p, diyar.toplam, diyar.hedef, katkim, lord.diyarEtkinligiOdulu);
    if (!hak.hakEdildi) {
      const metin = {
        alindi: ['Bu hafta sonunun ödülünü zaten aldın.', 'ODUL_ALINDI'],
        kapali: ['Diyar seferi cumartesi başlıyor.', 'ETKINLIK_KAPALI'],
        hedef: [
          `Diyar henüz hedefe varmadı (${diyar.toplam}/${diyar.hedef} ${p.tanim.birim}).`,
          'HEDEF_TUTMADI',
        ],
        katki: ['Ödül sefere katılanların: bu hafta sonu katkın yok.', 'KATKI_YOK'],
      } as const;
      const [m, kod] = metin[hak.engel ?? 'hedef'];
      throw new GameError(m, 400, kod);
    }

    const odul = etkinlikOdulu(lord.level);
    // Üretim GERÇEK saatle işliyor: `an` yalnız pencere kararı için. Test
    // saatiyle işlese lord haftalarca ileri üretip son tik'i geleceğe yazardı.
    const once = await tickLord(lordId);
    // Tavan seferdekiyle aynı hesap (bkz. routes/sefer.ts): ödül sessizce kırpılmasın.
    const tavan = storageCapacity(lord.level, arastirmaBonusuOku(lord), binalariOku(lord));
    const sigan = (istenen: number, mevcut: number) =>
      Math.max(0, Math.min(istenen, tavan - mevcut));
    const verilen = {
      altin: sigan(odul.altin, once.resources.altin),
      demir: sigan(odul.demir, once.resources.demir),
      erzak: sigan(odul.erzak, once.resources.erzak),
    };
    // Koşullu yazım: aynı anda gelen iki istek ödülü iki kez vermesin.
    const yazildi = await prisma.lord.updateMany({
      where: {
        id: lordId,
        OR: [{ diyarEtkinligiOdulu: null }, { diyarEtkinligiOdulu: { not: p.bas } }],
      },
      data: {
        diyarEtkinligiOdulu: p.bas,
        altin: { increment: verilen.altin },
        demir: { increment: verilen.demir },
        erzak: { increment: verilen.erzak },
      },
    });
    if (yazildi.count === 0) {
      throw new GameError('Bu hafta sonunun ödülünü zaten aldın.', 400, 'ODUL_ALINDI');
    }
    return {
      verilen,
      kirpildi:
        verilen.altin < odul.altin || verilen.demir < odul.demir || verilen.erzak < odul.erzak,
    };
  });
}
