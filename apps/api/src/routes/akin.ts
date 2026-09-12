/**
 * Akın uçları: beş NPC haritası, on grup, gerçek savaş (docs/12 §6).
 *
 * Kurallar `packages/shared/akin.ts` içinde — garnizon, süre, ödül,
 * yenilenme. Burada yalnız yetki, ordu doğrulaması ve kayıt var. İkinci
 * kez yazmak, ikisinin er ya da geç ayrışması demekti.
 *
 * SAKLANMAYAN ŞEYLER, bilerek:
 *  - Grubun garnizonu: formülden türüyor. Kayıtta dursaydı denge
 *    değişikliği yoldaki akınları eski sayılarla bırakırdı.
 *  - Grubun "dolu mu" hâli: en son kazanılmış akının saatinden türüyor.
 *    Ayrı bir sütun, onu güncelleyecek bir zamanlayıcı isterdi.
 */
import {
  B,
  UNIT_TYPES,
  akinDurumlari,
  akinGarnizonu,
  akinGrubuGecerliMi,
  akinHaritasi,
  akinOrdusuEngeli,
  akinSuresiSn,
  dizilimGecerliMi,
  varsayilanDizilim,
  type Army,
  type UnitType,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { akinVuruslari, sahadakiAkinlar } from '../services/akin.js';
import { savasOrneklemesi, lordSide } from '../services/hedef.js';
import { npcSide } from '../services/march.js';
import { findLordByUser, tickLord } from '../services/lord.js';
import { gecikmisleriKapat } from '../services/gecikmis.js';

const armySchema = z.record(z.string(), z.number().int().min(0));
/*
 * Dizilim şeması PvP ile AYNI (routes/map.ts).
 *
 * Akında savaş aynı motorla çözülüyor; dizilimi burada gevşek
 * tanımlasaydık oyuncu akında geçen bir dizilimi PvP'de reddedilmiş
 * bulurdu ve ikisinin neden farklı olduğunu hiçbir yerde göremezdi.
 */
const duzenSchema = z
  .object({
    dizilim: z.array(z.enum(UNIT_TYPES as unknown as [UnitType, ...UnitType[]]).nullable()),
    taktik: z.string().nullable().default(null),
  })
  .refine((d) => dizilimGecerliMi(d.dizilim), { message: 'Dizilim 16 kare olmalı.' })
  .optional();

const akinSchema = z.object({
  haritaKey: z.string().min(1),
  grupNo: z.number().int(),
  army: armySchema,
  generalIds: z.array(z.string()).max(5).default([]),
  duzen: duzenSchema,
});

const onizlemeSchema = z.object({
  haritaKey: z.string().min(1),
  grupNo: z.number().int(),
  army: armySchema,
  generalIds: z.array(z.string()).max(5).default([]),
  duzen: duzenSchema,
});

function normalizeArmy(input: Record<string, number | undefined>): Army {
  const army: Army = {};
  for (const t of UNIT_TYPES) {
    const n = input[t] ?? 0;
    if (n > 0) army[t] = n;
  }
  return army;
}

/** Evdeki orduda bu kadar birim var mı? */
async function evdekiOrduyuDogrula(lordId: string, army: Army, tx: typeof prisma): Promise<void> {
  const rows = await tx.armyUnit.findMany({
    where: { lordId, locationType: 'home', locationId: null },
  });
  const evde = new Map(rows.map((r) => [r.unitType, r.count]));
  for (const t of UNIT_TYPES) {
    if ((army[t] ?? 0) > (evde.get(t) ?? 0)) {
      throw new GameError(`Evde yeterli ${t} yok.`, 400, 'BIRIM_YOK');
    }
  }
}

export async function akinRoutes(app: FastifyInstance): Promise<void> {
  /** Bütün haritalar, gruplar ve sahadaki akınlar. */
  app.get('/akin', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    // Varış saati gelmiş akın kuyrukta bekliyor olabilir: worker uykudaysa
    // oyuncu ekranı açtığında ordusunu hâlâ sahada görürdü.
    await gecikmisleriKapat(lordId);
    const durum = await tickLord(lordId);

    const [vuruslar, sahadaki] = await Promise.all([
      akinVuruslari(lordId),
      sahadakiAkinlar(lordId),
    ]);

    return {
      haritalar: akinDurumlari(durum.level, vuruslar),
      esZamanli: B.akin.es_zamanli,
      /*
       * Sahadaki akınlar: ordunun nerede olduğu ekranda görünmeli.
       * Görünmeseydi oyuncu "askerlerim nerede" diye Kışla'ya bakar,
       * orada da bulamazdı.
       */
      sahadaki: sahadaki.map((a) => ({
        id: a.id,
        haritaKey: a.haritaKey,
        haritaAdi: akinHaritasi(a.haritaKey)?.ad ?? a.haritaKey,
        grupNo: a.grupNo,
        grupAdi: akinHaritasi(a.haritaKey)?.gruplar[a.grupNo - 1] ?? `${a.grupNo}. grup`,
        army: a.army,
        arriveAt: a.arriveAt,
      })),
      /** Son çözülmüş akınlar — "ne oldu" sorusunun cevabı. */
      sonuclar: await (async () => {
        const kayitlar = await prisma.akin.findMany({
          where: { lordId, resolved: true },
          orderBy: { arriveAt: 'desc' },
          take: 5,
          select: {
            id: true,
            haritaKey: true,
            grupNo: true,
            kazanildi: true,
            odul: true,
            yarali: true,
            dusenItemId: true,
            arriveAt: true,
          },
        });
        /*
         * Düşen parçanın KİMLİĞİ yetmiyordu.
         *
         * İstemci yalnız bir id görüyordu ve "bir ekipman düştü" diye
         * yazabiliyordu — yani akının en heyecanlı anı, envantere gidip
         * aramayı gerektiren bir dipnottu. Yuva ve tier geldiğinde parça
         * ganimet sahnesinde kendi görseliyle duruyor.
         *
         * Tek sorgu: beş akının düşen parçaları bir kerede çekiliyor.
         */
        const idler = kayitlar.map((a) => a.dusenItemId).filter((x): x is string => x !== null);
        const parcalar = idler.length
          ? await prisma.item.findMany({
              where: { id: { in: idler } },
              select: { id: true, slot: true, tier: true, rarity: true },
            })
          : [];
        const parcaHaritasi = new Map(parcalar.map((p) => [p.id, p]));
        return kayitlar.map((a) => ({
          ...a,
          haritaAdi: akinHaritasi(a.haritaKey)?.ad ?? a.haritaKey,
          grupAdi: akinHaritasi(a.haritaKey)?.gruplar[a.grupNo - 1] ?? `${a.grupNo}. grup`,
          dusenParca: a.dusenItemId
            ? (() => {
                const p = parcaHaritasi.get(a.dusenItemId);
                return p ? { slot: p.slot, tier: p.tier, rarity: p.rarity } : null;
              })()
            : null,
        }));
      })(),
    };
  });

  /**
   * Akın önizlemesi: gitmeden önce kazanma ihtimali.
   *
   * PvP saldırısında da böyle (docs/09 İ1): bedeli olan bir kararı
   * karşılığını bilmeden vermek olmaz. Aynı örnekleme motoru kullanılıyor
   * ki önizleme ile gerçek savaş aynı dağılımı okusun.
   */
  app.post('/akin/onizleme', { preHandler: requireAuth }, async (req) => {
    const body = onizlemeSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const harita = akinHaritasi(body.haritaKey);
    if (!harita) throw hata.bulunamadi('Akın haritası');
    if (!akinGrubuGecerliMi(body.grupNo)) throw hata.bulunamadi('Akın grubu');

    const army = normalizeArmy(body.army);
    const engel = akinOrdusuEngeli(army);
    if (engel) throw new GameError(engel, 400, 'ORDU_BOS');

    const saldiran = await lordSide(lordId, army, body.generalIds, prisma, body.duzen ?? undefined);
    const garnizon = akinGarnizonu(body.haritaKey, body.grupNo);
    const ornek = savasOrneklemesi(saldiran, npcSide(garnizon, 0), `akin-onizleme-${lordId}`, {
      defenderStore: { altin: 0, demir: 0, erzak: 0 },
      attackerCunning: 0,
      canCapture: false,
    });

    return {
      kazanmaOrani: ornek.kazanmaOrani,
      garnizon,
      sureSn: akinSuresiSn(body.haritaKey, body.grupNo),
      // Ortanca senaryonun kaybı: "kaç asker gider" sorusunun cevabı.
      tahminiKayip: ornek.ortanca.attackerLosses,
      tahminiKalan: ornek.ortanca.attackerSurvivors,
    };
  });

  /** Akına çık. */
  app.post('/akin', { preHandler: requireAuth }, async (req) => {
    const body = akinSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const harita = akinHaritasi(body.haritaKey);
    if (!harita) throw hata.bulunamadi('Akın haritası');
    if (!akinGrubuGecerliMi(body.grupNo)) throw hata.bulunamadi('Akın grubu');

    const army = normalizeArmy(body.army);
    const orduEngeli = akinOrdusuEngeli(army);
    if (orduEngeli) throw new GameError(orduEngeli, 400, 'ORDU_BOS');

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { worldId: true, level: true, woundedUntil: true },
      });

      const simdi = new Date();
      if (lord.woundedUntil && lord.woundedUntil > simdi) throw hata.yarali(lord.woundedUntil);

      /*
       * Seviye kapısı: harita sırayla açılıyor.
       *
       * Nekropol'e 1. seviyede giden oyuncu ordusunu tek seferde kaybeder
       * ve oyunun kendisini suçlar. Kapı bir kısıtlama değil, "buraya
       * henüz hazır değilsin" cümlesinin uygulanmış hâli.
       */
      if (lord.level < harita.acilis_seviyesi) {
        throw new GameError(
          `${harita.ad} ${harita.acilis_seviyesi}. seviyede açılıyor.`,
          400,
          'SEVIYE_YETERSIZ',
        );
      }

      /*
       * Eş zamanlı akın sınırı — PvP saldırı hakkından AYRI.
       *
       * Akını günlük saldırı bütçesine bağlasaydık oyuncu PvE yapmamayı
       * seçerdi: aynı hakkı bir oyuncuya harcamak her zaman daha kârlı.
       */
      const sahadaki = await tx.akin.count({ where: { lordId, resolved: false } });
      if (sahadaki >= B.akin.es_zamanli) {
        throw hata.limitAsildi(`Aynı anda en fazla ${B.akin.es_zamanli} akın`);
      }

      // Grup dolu mu: en son kazanılmış akının üstünden yenilenme geçti mi.
      const vuruslar = await akinVuruslari(lordId, tx);
      const durum = akinDurumlari(lord.level, vuruslar, simdi)
        .find((h) => h.key === body.haritaKey)
        ?.gruplar.find((g) => g.grupNo === body.grupNo);
      if (!durum?.acik) {
        throw new GameError(
          'Bu grup henüz toparlanmadı. Yenilenmesini bekle.',
          400,
          'GRUP_YENILENIYOR',
        );
      }

      await evdekiOrduyuDogrula(lordId, army, tx as unknown as typeof prisma);

      // Evdeki ordudan düş.
      for (const t of UNIT_TYPES) {
        const n = army[t] ?? 0;
        if (n <= 0) continue;
        const row = await tx.armyUnit.findFirst({
          where: { lordId, unitType: t, locationType: 'home', locationId: null },
        });
        if (!row) continue;
        const kalan = row.count - n;
        if (kalan <= 0) await tx.armyUnit.delete({ where: { id: row.id } });
        else await tx.armyUnit.update({ where: { id: row.id }, data: { count: kalan } });
      }

      const sureSn = akinSuresiSn(body.haritaKey, body.grupNo);
      const akin = await tx.akin.create({
        data: {
          worldId: lord.worldId,
          lordId,
          haritaKey: body.haritaKey,
          grupNo: body.grupNo,
          army: army as object,
          generalIds: body.generalIds as object,
          // Karar YOLA ÇIKARKEN donuyor: ordu yoldayken dizilimi
          // değiştirip savaşı etkilemek mümkün olmasın (March.duzen ile
          // aynı gerekçe).
          duzen: (body.duzen ?? { dizilim: varsayilanDizilim(army), taktik: null }) as object,
          seed: `akin-${lordId}-${body.haritaKey}-${body.grupNo}-${simdi.getTime()}`,
          departAt: simdi,
          arriveAt: new Date(simdi.getTime() + sureSn * 1000),
        },
      });

      for (const t of UNIT_TYPES) {
        const c = army[t] ?? 0;
        if (c > 0) {
          await tx.armyUnit.create({
            data: {
              lordId,
              unitType: t,
              count: c,
              locationType: 'akin',
              locationId: akin.id,
            },
          });
        }
      }

      return {
        id: akin.id,
        arriveAt: akin.arriveAt,
        sureSn,
        haritaAdi: harita.ad,
        grupAdi: harita.gruplar[body.grupNo - 1] ?? `${body.grupNo}. grup`,
      };
    });
  });

  /** Bir akının savaş raporu. */
  app.get('/akin/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);
    const akin = await prisma.akin.findUnique({ where: { id } });
    // Başkasının raporu kendi raporun değil: sahiplik kontrolü olmasaydı
    // kimlik tahmini yeterdi.
    if (!akin || akin.lordId !== lordId) throw hata.bulunamadi('Akın');
    if (!akin.resolved) throw new GameError('Akın henüz sonuçlanmadı.', 400, 'AKIN_SURUYOR');

    const harita = akinHaritasi(akin.haritaKey);
    return {
      id: akin.id,
      haritaKey: akin.haritaKey,
      haritaAdi: harita?.ad ?? akin.haritaKey,
      grupNo: akin.grupNo,
      grupAdi: harita?.gruplar[akin.grupNo - 1] ?? `${akin.grupNo}. grup`,
      kazanildi: akin.kazanildi,
      army: akin.army,
      yarali: akin.yarali,
      odul: akin.odul,
      dusenItemId: akin.dusenItemId,
      log: akin.log,
      departAt: akin.departAt,
      arriveAt: akin.arriveAt,
    };
  });
}
