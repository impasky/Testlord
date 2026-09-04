/** Harita, bölgeler, yürüyüş ve savaş. */
import {
  B,
  UNIT_TYPES,
  armyCount,
  bosGeneralBonus,
  canRecallMarch,
  ayniIttifaktaMi,
  hexDistance,
  ilkSaldiriMi,
  kesifDurumu,
  kesifMaliyetiAltin,
  kesifSuresiSn,
  type KesifFotografi,
  orduBedeli,
  marchDurationSec,
  maxRegions,
  type Army,
  type Side,
  type UnitType,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma, type Tx } from '../db.js';
import { GameError, hata } from '../errors.js';
import { findLordByUser, pushEvent } from '../services/lord.js';
import {
  fetihOdulu,
  lordSide,
  onerilenHedef,
  onizlemeTohumu,
  savasOrneklemesi,
} from '../services/hedef.js';
import { addUnitsHome, assertQueueSlot, enqueue, spendResources } from '../services/queue.js';
import { regionFortressBonus, regionUpgradeCost } from '../services/region.js';

const armySchema = z.record(
  z.enum(UNIT_TYPES as unknown as [UnitType, ...UnitType[]]),
  z.number().int().min(0),
);

const marchSchema = z.object({
  toRegionId: z.number().int(),
  army: armySchema,
  generalIds: z.array(z.string()).max(3).default([]),
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
async function assertHomeUnits(lordId: string, army: Army, tx: Tx): Promise<void> {
  const rows = await tx.armyUnit.findMany({
    where: { lordId, locationType: 'home', locationId: null },
  });
  const home = new Map(rows.map((r) => [r.unitType, r.count]));
  for (const t of UNIT_TYPES) {
    const istenen = army[t] ?? 0;
    if (istenen > (home.get(t) ?? 0)) {
      throw new GameError(`Evde yeterli ${t} yok.`, 400, 'BIRIM_YOK');
    }
  }
}

/** Evdeki ordudan düşer. */
async function takeFromHome(lordId: string, army: Army, tx: Tx): Promise<void> {
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
}

/** Saldırıyı engelleyen tüm koruma kurallarını uygular (docs/01 §7). */
async function assertCanAttack(
  attackerId: string,
  region: { id: number; type: string; ownerLordId: string | null; shieldUntil: Date | null },
  tx: Tx,
): Promise<void> {
  const now = new Date();
  const tahtMi = region.type === 'taht';

  const attacker = await tx.lord.findUniqueOrThrow({
    where: { id: attackerId },
    select: { level: true, woundedUntil: true, dailyAttacks: true },
  });

  if (attacker.woundedUntil && attacker.woundedUntil > now) throw hata.yarali(attacker.woundedUntil);

  const limitMuaf = tahtMi && B.korumalar.taht_kalesi_limitten_muaf;
  if (!limitMuaf && attacker.dailyAttacks >= B.korumalar.gunluk_saldiri_limiti) {
    throw hata.limitAsildi(`Günlük ${B.korumalar.gunluk_saldiri_limiti} saldırı`);
  }

  if (region.ownerLordId === attackerId) {
    throw new GameError('Kendi bölgene saldıramazsın.', 400, 'KENDI_BOLGEN');
  }

  // İttifak içi saldırı yok. İttifağın tek zorunlu kuralı bu ve tek
  // başına değerli: sırtını dönebileceğin bir sınırın olması (docs/09 B1).
  if (region.ownerLordId) {
    const [ben, o] = await Promise.all([
      tx.lord.findUniqueOrThrow({ where: { id: attackerId }, select: { allianceId: true } }),
      tx.lord.findUnique({
        where: { id: region.ownerLordId },
        select: { allianceId: true, alliance: { select: { name: true } } },
      }),
    ]);
    if (ayniIttifaktaMi(ben.allianceId, o?.allianceId ?? null)) {
      throw new GameError(
        `${o?.alliance?.name ?? 'İttifakın'} üyesine saldıramazsın.`,
        400,
        'ITTIFAK_UYESI',
      );
    }
  }

  if (region.shieldUntil && region.shieldUntil > now) {
    throw new GameError(
      `Bu bölge koruma altında (${region.shieldUntil.toLocaleString('tr-TR')}).`,
      400,
      'BOLGE_KORUMALI',
    );
  }

  if (region.ownerLordId) {
    const defender = await tx.lord.findUniqueOrThrow({
      where: { id: region.ownerLordId },
      select: { level: true, protectionUntil: true },
    });

    if (defender.protectionUntil && defender.protectionUntil > now) throw hata.korumali();

    if (!tahtMi && attacker.level - defender.level >= B.korumalar.seviye_farki_kilidi) {
      throw new GameError(
        `${B.korumalar.seviye_farki_kilidi} veya daha fazla seviye altındaki lorda saldıramazsın.`,
        400,
        'SEVIYE_FARKI',
      );
    }

    // Aynı saldırgan aynı bölgeye 12 saat içinde tekrar saldıramaz
    const sonSaldiri = await tx.battle.findFirst({
      where: {
        attackerLordId: attackerId,
        regionId: region.id,
        createdAt: {
          gte: new Date(now.getTime() - B.korumalar.ayni_saldirgan_tekrar_saldiri_saat * 3_600_000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (sonSaldiri) {
      throw new GameError(
        `Bu bölgeye ${B.korumalar.ayni_saldirgan_tekrar_saldiri_saat} saat içinde tekrar saldıramazsın.`,
        400,
        'TEKRAR_SALDIRI',
      );
    }
  }
}

export async function mapRoutes(app: FastifyInstance): Promise<void> {
  app.get('/map', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const me = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, homeQ: true, homeR: true, level: true, allianceId: true },
    });

    const [regions, oneri, ittifak] = await Promise.all([
      prisma.region.findMany({
        where: { worldId: me.worldId },
        include: { owner: { select: { id: true, name: true, level: true } } },
        orderBy: { id: 'asc' },
      }),
      onerilenHedef(lordId),
      // Ortak hedef HARİTADA görünmeli: ittifak ekranında duran bir hedef,
      // oyuncunun saldırıya karar verdiği yerde yok demektir.
      me.allianceId
        ? prisma.alliance.findUnique({
            where: { id: me.allianceId },
            select: { targetRegionId: true, targetNote: true, tag: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      home: { q: me.homeQ, r: me.homeR },
      maxRegions: maxRegions(me.level),
      ittifakHedefi: ittifak?.targetRegionId
        ? { regionId: ittifak.targetRegionId, not: ittifak.targetNote, etiket: ittifak.tag }
        : null,
      // Oyuncu haritaya baktığında "neye saldırayım" sorusunun cevabı
      // hazır olsun; hedef seçmek bir bulmaca olmamalı.
      oneri,
      regions: regions.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        province: r.province,
        q: r.q,
        r: r.r,
        ring: r.ring,
        level: r.level,
        incomeMult: r.incomeMult,
        owner: r.owner ? { id: r.owner.id, name: r.owner.name, level: r.owner.level } : null,
        isMine: r.ownerLordId === lordId,
        shielded: r.shieldUntil ? r.shieldUntil > new Date() : false,
        distance: hexDistance({ q: me.homeQ, r: me.homeR }, { q: r.q, r: r.r }),
        fortressBonus: regionFortressBonus(r.type, r.level),
      })),
    };
  });

  app.get('/map/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);
    const [region, me] = await Promise.all([
      prisma.region.findUnique({
        where: { id },
        include: { owner: { select: { id: true, name: true, level: true } } },
      }),
      prisma.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { homeQ: true, homeR: true },
      }),
    ]);
    if (!region) throw hata.bulunamadi('Bölge');

    const benim = region.ownerLordId === lordId;
    let garrison: Army = {};
    if (benim) {
      const rows = await prisma.armyUnit.findMany({
        where: { lordId, locationType: 'region', locationId: String(id) },
      });
      for (const r of rows) garrison[r.unitType as UnitType] = r.count;
    } else if (!region.ownerLordId) {
      garrison = region.npcGarrison as Army; // NPC garnizonu herkese açık
    } else {
      // Casus Leyla sahadaysa düşman garnizonu görünür
      const generals = await prisma.lordGeneral.findMany({
        where: { lordId, slotIndex: { not: null } },
      });
      if (generals.some((g) => g.generalKey === 'casus_leyla')) {
        const rows = await prisma.armyUnit.findMany({
          where: {
            lordId: region.ownerLordId,
            locationType: 'region',
            locationId: String(id),
          },
        });
        for (const r of rows) garrison[r.unitType as UnitType] = r.count;
      }
    }

    /**
     * Keşif raporu: casusun getirdiği fotoğraf.
     *
     * Casus Leyla CANLI görüş veriyor (sahada durduğu sürece), keşif ise
     * bir ANI dondurup saklıyor. İkisi çakışırsa canlı olan kazanıyor:
     * yukarıdaki garrison doluysa ona dokunulmuyor.
     *
     * Süresi geçmiş rapor da gösteriliyor, "eski" damgasıyla. Silmek
     * oyuncuyu bilmediği bir noktaya geri atardı; eski istihbarat da
     * bilgidir ve ona güvenip güvenmemek oyuncunun kararıdır.
     */
    const rapor = await prisma.scout.findUnique({
      where: { lordId_regionId: { lordId, regionId: id } },
    });
    const kesif = kesifDurumu(rapor?.createdAt ?? null, new Date());
    const foto = rapor ? (rapor.snapshot as unknown as KesifFotografi) : null;
    if (foto && Object.keys(garrison).length === 0) {
      garrison = foto.garrison as Army;
    }

    return {
      ...region,
      isMine: benim,
      // Liste ucuyla aynı türetilmiş alanlar; arayüz iki uçtan da aynı şekli bekler.
      distance: hexDistance({ q: me.homeQ, r: me.homeR }, { q: region.q, r: region.r }),
      shielded: region.shieldUntil ? region.shieldUntil > new Date() : false,
      garrison,
      garrisonVisible: benim || !region.ownerLordId || Object.keys(garrison).length > 0,
      // Görünür olmak başka, GÜVENİLİR olmak başka. Karşı-birim ipuçları
      // (docs/09 K1) yalnız güvenilir veriyle çalışmalı: eski bir fotoğrafa
      // bakıp "süvari al" demek, yanlış tavsiye vermektir ve yanlış tavsiye
      // tavsiye yokluğundan kötüdür. Eski rapor yine de gösteriliyor —
      // oyuncu okusun, ama oyun ona dayanıp akıl vermesin.
      garrisonTaze: benim || !region.ownerLordId || !kesif.eski,
      kesif: kesif.var
        ? {
            eski: kesif.eski,
            yasSn: kesif.yasSn,
            store: foto?.store ?? null,
            tahkimatBonusu: foto?.tahkimatBonusu ?? null,
            bolgeSeviyesi: foto?.bolgeSeviyesi ?? null,
          }
        : null,
      kesifMaliyeti: kesifMaliyetiAltin(),
      kesifSuresiSn: kesifSuresiSn(
        hexDistance({ q: me.homeQ, r: me.homeR }, { q: region.q, r: region.r }),
      ),
      fortressBonus: regionFortressBonus(region.type, region.level),
      upgradeCost:
        region.level < B.bolgeler.max_bolge_seviyesi ? regionUpgradeCost(region.level) : null,
      store: benim
        ? { altin: region.storeAltin, demir: region.storeDemir, erzak: region.storeErzak }
        : null,
    };
  });

  app.post('/map/:id/upgrade', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const region = await tx.region.findUnique({ where: { id } });
      if (!region || region.ownerLordId !== lordId) throw hata.yetkisiz();
      if (region.level >= B.bolgeler.max_bolge_seviyesi) {
        throw new GameError('Bölge zaten en üst seviyede.', 400, 'MAKS_SEVIYE');
      }
      await assertQueueSlot(lordId, 'upgrade_region', tx);
      const c = regionUpgradeCost(region.level);
      await spendResources(lordId, { altin: c.altin, demir: c.demir, erzak: 0 }, tx);
      const q = await enqueue(lordId, 'upgrade_region', { regionId: id }, c.sec, tx);
      return { queued: true, finishAt: q.finishAt };
    });
  });

  /**
   * Bölgeye casus gönderir (docs/01 §1: Kurnazlık'ın ikinci işi).
   *
   * Ordu istemiyor — casusluğun kimliği bu: ordusu ezilmiş ya da hiç
   * kurulmamış oyuncu da bilgi alabiliyor, yani haritada yapacak bir şeyi
   * kalıyor. Maliyet peşin, sonuç kuyrukta.
   */
  app.post('/map/:id/kesif', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const region = await tx.region.findUnique({ where: { id } });
      if (!region) throw hata.bulunamadi('Bölge');
      if (region.ownerLordId === lordId) {
        throw new GameError('Kendi bölgeni keşfetmene gerek yok.', 400, 'KENDI_BOLGEN');
      }
      // Sahipsiz bölgede casusun anlatacağı yeni bir şey yok: NPC garnizonu
      // zaten herkese açık. Kural sunucuda da duruyor, yalnız arayüzde
      // değil — yoksa uç, altın alıp karşılığında bilinen bir şey satardı.
      if (!region.ownerLordId) {
        throw new GameError(
          'Sahipsiz bölgenin garnizonu zaten görünüyor; casusa gerek yok.',
          400,
          'SAHIPSIZ_BOLGE',
        );
      }

      const me = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { homeQ: true, homeR: true, worldId: true },
      });
      if (region.worldId !== me.worldId) throw hata.bulunamadi('Bölge');

      await assertQueueSlot(lordId, 'kesif', tx);
      await spendResources(lordId, { altin: kesifMaliyetiAltin(), demir: 0, erzak: 0 }, tx);

      const mesafe = hexDistance({ q: me.homeQ, r: me.homeR }, { q: region.q, r: region.r });
      const q = await enqueue(lordId, 'kesif', { regionId: id }, kesifSuresiSn(mesafe), tx);
      return { queued: true, finishAt: q.finishAt, mesafe };
    });
  });

  app.post('/map/:id/garrison', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const body = z.object({ army: armySchema }).parse(req.body);
    const hedef = normalizeArmy(body.army);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const region = await tx.region.findUnique({ where: { id } });
      if (!region || region.ownerLordId !== lordId) throw hata.yetkisiz();

      const mevcutRows = await tx.armyUnit.findMany({
        where: { lordId, locationType: 'region', locationId: String(id) },
      });
      const mevcut = new Map(mevcutRows.map((r) => [r.unitType as UnitType, r]));

      for (const t of UNIT_TYPES) {
        const istenen = hedef[t] ?? 0;
        const simdiki = mevcut.get(t)?.count ?? 0;
        const fark = istenen - simdiki;
        if (fark === 0) continue;

        if (fark > 0) {
          // Evden garnizona
          const home = await tx.armyUnit.findFirst({
            where: { lordId, unitType: t, locationType: 'home', locationId: null },
          });
          if (!home || home.count < fark) {
            throw new GameError(`Evde yeterli ${t} yok.`, 400, 'BIRIM_YOK');
          }
          const kalan = home.count - fark;
          if (kalan <= 0) await tx.armyUnit.delete({ where: { id: home.id } });
          else await tx.armyUnit.update({ where: { id: home.id }, data: { count: kalan } });
        } else {
          // Garnizondan eve
          const geri = -fark;
          const homeRow = await tx.armyUnit.findFirst({
            where: { lordId, unitType: t, locationType: 'home', locationId: null },
          });
          if (homeRow) {
            await tx.armyUnit.update({
              where: { id: homeRow.id },
              data: { count: homeRow.count + geri },
            });
          } else {
            await tx.armyUnit.create({
              data: { lordId, unitType: t, count: geri, locationType: 'home', locationId: null },
            });
          }
        }

        const row = mevcut.get(t);
        if (istenen <= 0 && row) await tx.armyUnit.delete({ where: { id: row.id } });
        else if (row) await tx.armyUnit.update({ where: { id: row.id }, data: { count: istenen } });
        else if (istenen > 0) {
          await tx.armyUnit.create({
            data: {
              lordId,
              unitType: t,
              count: istenen,
              locationType: 'region',
              locationId: String(id),
            },
          });
        }
      }
      return { garrison: hedef };
    });
  });

  app.post('/battle/preview', { preHandler: requireAuth }, async (req) => {
    const body = marchSchema.parse(req.body);
    const army = normalizeArmy(body.army);
    if (armyCount(army) === 0) throw new GameError('Ordu boş.', 400, 'ORDU_BOS');

    const lordId = await findLordByUser(req.user.userId);
    const region = await prisma.region.findUnique({ where: { id: body.toRegionId } });
    if (!region) throw hata.bulunamadi('Bölge');

    const attacker = await lordSide(lordId, army, body.generalIds);
    const fortress = regionFortressBonus(region.type, region.level);

    const [me, yuruyusSayisi] = await Promise.all([
      prisma.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { homeQ: true, homeR: true, level: true, pvpWins: true, fortressFameAccrued: true },
      }),
      prisma.march.count({ where: { lordId } }),
    ]);
    const dist = hexDistance({ q: me.homeQ, r: me.homeR }, { q: region.q, r: region.r });
    const ilkSaldiri = ilkSaldiriMi(yuruyusSayisi, region.ownerLordId === null, dist);
    const marchSec = marchDurationSec(dist, army, attacker.generalBonus, { ilkSaldiri });

    // Savunan ordusu: NPC ise tam bilinir, oyuncu ise tahmini (istihbarat yoksa)
    let defenderArmy: Army;
    let kesin = false;
    if (!region.ownerLordId) {
      defenderArmy = region.npcGarrison as Army;
      kesin = true;
    } else {
      const casus = await prisma.lordGeneral.findFirst({
        where: { lordId, generalKey: 'casus_leyla', slotIndex: { not: null } },
      });
      const rows = await prisma.armyUnit.findMany({
        where: {
          lordId: region.ownerLordId,
          locationType: 'region',
          locationId: String(region.id),
        },
      });
      defenderArmy = {};
      for (const r of rows) defenderArmy[r.unitType as UnitType] = r.count;
      kesin = Boolean(casus);
    }

    const defender: Side = {
      units: defenderArmy,
      gearBonus: { saldiri: 0, savunma: 0, can: 0 },
      generalBonus: bosGeneralBonus(),
      lordContribution: 0,
      leadership: 0,
      fortressBonus: fortress,
      isDefender: true,
    };

    // Tek simülasyon bir tahmin değil bir kura sonucu: her turda ±%7 tohumlu
    // varyans var ve fetih eşiğinin yakınında aynı ordu bir seferde bölgeyi
    // alır, bir seferde almaz. Önizleme dokuz savaş çalıştırıp DAĞILIMI
    // gösteriyor — "kesin alırsın" deyip almamak, oyuncuya tutulmayan bir
    // söz vermek olurdu. (docs/08 İ1)
    const ornek = savasOrneklemesi(
      attacker,
      defender,
      onizlemeTohumu(lordId, region.id),
      {
        defenderStore: {
          altin: region.storeAltin,
          demir: region.storeDemir,
          erzak: region.storeErzak,
        },
        attackerCunning: 0,
        canCapture: true,
        // Yaralı dönüş savunanın kaybını değiştiriyor; önizleme aynı
        // bayrağı geçirmezse oyuncuya gösterilen "savunanın kaybı"
        // gerçekleşenden farklı çıkardı.
        savunanOyuncu: region.ownerLordId !== null,
      },
    );
    const result = ornek.ortanca;

    const [odul, bedel] = await Promise.all([
      fetihOdulu(lordId, region),
      Promise.resolve(orduBedeli(result.attackerLosses)),
    ]);

    return {
      tahmin: {
        // Ortancanın kurası değil, ÖRNEKLEMİN tamamı karar veriyor: "BÖLGE
        // ELE GEÇER" yazısı ancak dokuz savaşın hepsi fetihle bittiğinde
        // çıkıyor. Öneri şeridiyle aynı eşik, aynı tohum — iki ekran aynı
        // savaş için farklı şey söyleyemez.
        kazanan: ornek.kazanmaOrani >= 0.5 ? 'attacker' : 'defender',
        eleGecirir: ornek.fetihOrani >= B.oneri.guvenli_fetih_orani,
        saldiranKayip: result.attackerLosses,
        savunanKayip: result.defenderLosses,
        yagma: result.loot,
        /** Dokuz savaşın kaçı zaferle / fetihle bitti. */
        kazanmaOrani: ornek.kazanmaOrani,
        fetihOrani: ornek.fetihOrani,
      },
      // "Kazanırsan ne olur, kaybedersen ne olur" — oyuncunun butona
      // basmadan ÖNCE görmesi gereken iki cevap. Tahmin değil, motorun
      // kendi formülleriyle hesaplanmış gerçek sayılar. (docs/08 İ1)
      odul,
      bedel: {
        yenidenEgitim: bedel.kaynak,
        yenidenEgitimSn: bedel.saniye,
        kayipBirim: bedel.yer > 0 ? armyCount(result.attackerLosses) : 0,
      },
      istihbaratKesin: kesin,
      marchSec,
      ilkSaldiri,
      // Dönüş kısayoldan yararlanmaz ve en az bir hex sayılır — savaş
      // çözümündeki hesapla birebir aynı olmalı, yoksa önizleme yalan söyler.
      donusSec: marchDurationSec(Math.max(1, dist), army, attacker.generalBonus),
      not: kesin
        ? 'Savunan ordusu tam biliniyor.'
        : 'Savunanın garnizonu bilinmiyor; tahmin eksik istihbarata dayanıyor. Casus Leyla tam bilgi verir.',
    };
  });

  app.post('/march', { preHandler: requireAuth }, async (req) => {
    const body = marchSchema.parse(req.body);
    const army = normalizeArmy(body.army);
    if (armyCount(army) === 0) throw new GameError('Ordu boş.', 400, 'ORDU_BOS');

    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({ where: { id: lordId } });
      const region = await tx.region.findUnique({ where: { id: body.toRegionId } });
      if (!region || region.worldId !== lord.worldId) throw hata.bulunamadi('Bölge');

      // Eş zamanlı yürüyüş sınırı. Kuyruk sistemlerinin hepsinde sınır
      // varken yürüyüşte yoktu: ordusu yeten oyuncu tek seferde on hedefe
      // saldırabiliyordu. Dönüş yürüyüşleri de sayılıyor — onlar da hâlâ
      // yoldaki birlikler.
      const [aktifYuruyus, aktifVeBitmisYuruyus] = await Promise.all([
        tx.march.count({ where: { lordId, resolved: false } }),
        tx.march.count({ where: { lordId } }),
      ]);
      if (aktifYuruyus >= B.yuruyus.es_zamanli_limit) {
        throw hata.limitAsildi(
          `Aynı anda en fazla ${B.yuruyus.es_zamanli_limit} yürüyüş. ` +
            'Ordularından biri dönene kadar bekle',
        );
      }

      await assertCanAttack(lordId, region, tx);
      await assertHomeUnits(lordId, army, tx);

      // Bölge limiti: dolu ise saldırabilirsin ama ele geçiremezsin — uyar
      const sahip = await tx.region.count({
        where: { ownerLordId: lordId, type: { not: 'taht' } },
      });
      const limitDolu = sahip >= maxRegions(lord.level) && region.type !== 'taht';

      const generalBonus = bosGeneralBonus();
      const dist = hexDistance({ q: lord.homeQ, r: lord.homeR }, { q: region.q, r: region.r });
      // Oyuncunun ömürdeki ilk saldırısı, eve yakın ve sahipsiz bir hedefe
      // ise dakikalar içinde varır. Yoksa yeni oyuncu ordusunu yola çıkarıp
      // ilk oturumunda hiçbir sonuç görmeden oyunu kapatıyor.
      const ilkSaldiri = ilkSaldiriMi(aktifVeBitmisYuruyus, region.ownerLordId === null, dist);
      const sec = marchDurationSec(dist, army, generalBonus, { ilkSaldiri });
      const now = new Date();

      await takeFromHome(lordId, army, tx);

      const march = await tx.march.create({
        data: {
          worldId: lord.worldId,
          lordId,
          fromRegionId: null,
          toRegionId: region.id,
          kind: 'attack',
          army: army as object,
          generalIds: body.generalIds as object,
          distance: dist,
          departAt: now,
          arriveAt: new Date(now.getTime() + sec * 1000),
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
              locationType: 'march',
              locationId: march.id,
            },
          });
        }
      }

      // Taht Kalesi günlük limitten muaf (docs/01 §5). Muafiyet sadece
      // kontrolde olsaydı yetmezdi: sayaç yine artar ve tahta yapılan
      // saldırı normal saldırı hakkını yerdi. Muaf olmak, bütçeye hiç
      // dokunmamak demek.
      const limitiYer = !(region.type === 'taht' && B.korumalar.taht_kalesi_limitten_muaf);

      // İlk saldırı yeni oyuncu kalkanını düşürür
      await tx.lord.update({
        where: { id: lordId },
        data: {
          ...(limitiYer ? { dailyAttacks: { increment: 1 } } : {}),
          ...(lord.protectionUntil ? { protectionUntil: null } : {}),
        },
      });

      return {
        marchId: march.id,
        arriveAt: march.arriveAt,
        distance: dist,
        durationSec: sec,
        ilkSaldiri,
        uyari: limitDolu
          ? `Bölge limitin dolu (${sahip}/${maxRegions(lord.level)}). Kazansan bile bölgeyi alamazsın, sadece yağmalarsın.`
          : null,
      };
    });
  });

  app.delete('/march/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const march = await tx.march.findUnique({ where: { id } });
      if (!march || march.lordId !== lordId) throw hata.bulunamadi('Yürüyüş');
      if (march.resolved) throw new GameError('Bu yürüyüş zaten tamamlandı.', 400, 'COZULDU');
      if (march.kind !== 'attack') {
        throw new GameError('Dönüş yürüyüşü geri çağrılamaz.', 400, 'DONUS');
      }
      if (!canRecallMarch(march.departAt, march.arriveAt, new Date())) {
        throw new GameError(
          'Geri çağırma süresi doldu. Yürüyüşün ilk %25\'inde geri çağırabilirsin.',
          400,
          'GERI_CAGIRMA_SURESI',
        );
      }

      const army = march.army as Army;
      await tx.march.update({ where: { id }, data: { resolved: true } });
      await tx.armyUnit.deleteMany({ where: { locationType: 'march', locationId: id } });
      for (const t of UNIT_TYPES) {
        const c = army[t] ?? 0;
        if (c <= 0) continue;
        const home = await tx.armyUnit.findFirst({
          where: { lordId, unitType: t, locationType: 'home', locationId: null },
        });
        if (home) {
          await tx.armyUnit.update({ where: { id: home.id }, data: { count: home.count + c } });
        } else {
          await tx.armyUnit.create({
            data: { lordId, unitType: t, count: c, locationType: 'home', locationId: null },
          });
        }
      }
      // Sayaç artmadıysa azaltılmamalı; yoksa tahta saldırıp geri çağırmak
      // günlük hakkı çoğaltan bir açık olurdu.
      const hedef = await tx.region.findUnique({
        where: { id: march.toRegionId },
        select: { type: true },
      });
      const sayacaGirdi = !(
        hedef?.type === 'taht' && B.korumalar.taht_kalesi_limitten_muaf
      );
      if (sayacaGirdi) {
        await tx.lord.update({ where: { id: lordId }, data: { dailyAttacks: { decrement: 1 } } });
      }
      return { recalled: true };
    });
  });

  /**
   * Bölgeden vazgeçer: bölge sahipsiz kalır, garnizon eve döner.
   *
   * Neden gerekli: bakımı ağır gelen ya da savunulamayan bir bölgeden
   * kurtulmanın tek yolu onu kaybetmekti. Oyuncunun kendi toprağı üzerinde
   * karar verememesi, stratejiyi değil çaresizliği zorluyordu.
   *
   * Taht Kalesi bırakılamaz: diyarın tek endgame hedefi, sahibinin canı
   * istediğinde ortadan kaldırabileceği bir şey olmamalı — kaybetmek için
   * savaşmak gerekir.
   */
  app.post('/map/:id/birak', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return prisma.$transaction(async (tx) => {
      const region = await tx.region.findUnique({ where: { id } });
      if (!region) throw hata.bulunamadi('Bölge');
      if (region.ownerLordId !== lordId) {
        throw new GameError('Bu bölge senin değil.', 403, 'YETKI_YOK');
      }
      if (region.type === 'taht') {
        throw new GameError(
          'Taht Kalesi bırakılamaz. Elinden ancak savaşla alınır.',
          400,
          'TAHT_BIRAKILAMAZ',
        );
      }

      // Garnizon eve döner: bırakılan bölgede unutulan birlikler sessizce
      // yok olsaydı oyuncu ordusunu kaybederdi.
      const garnizon = await tx.armyUnit.findMany({
        where: { lordId, locationType: 'region', locationId: String(id) },
      });
      for (const g of garnizon) {
        await addUnitsHome(lordId, g.unitType as UnitType, g.count, tx);
      }
      await tx.armyUnit.deleteMany({
        where: { lordId, locationType: 'region', locationId: String(id) },
      });

      await tx.region.update({
        where: { id },
        data: { ownerLordId: null, npcGarrison: {}, shieldUntil: null },
      });

      await pushEvent(lordId, 'bolge_birakildi', { mesaj: `${region.name} bırakıldı.` }, tx);

      return { birakildi: true, donenBirlik: garnizon.reduce((t, g) => t + g.count, 0) };
    });
  });

  app.get('/marches', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    return prisma.march.findMany({
      where: { lordId, resolved: false },
      orderBy: { arriveAt: 'asc' },
    });
  });

  app.get('/battles', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const { page } = z.object({ page: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    return prisma.battle.findMany({
      where: { OR: [{ attackerLordId: lordId }, { defenderLordId: lordId }] },
      include: {
        attacker: { select: { name: true } },
        defender: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: page * 20,
      take: 20,
    });
  });

  app.get('/battles/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);
    const battle = await prisma.battle.findUnique({
      where: { id },
      include: {
        attacker: { select: { name: true } },
        defender: { select: { name: true } },
      },
    });
    if (!battle) throw hata.bulunamadi('Savaş');
    if (battle.attackerLordId !== lordId && battle.defenderLordId !== lordId) throw hata.yetkisiz();
    return battle;
  });
}
