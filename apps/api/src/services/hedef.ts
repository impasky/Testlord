/**
 * "Şimdi neye saldırmalıyım?"
 *
 * Oyunun ilk gerçek testinde oyuncu ordusunu kurdu, rastgele bir bölgeye
 * yolladı ve "eee ne oldu şimdi" deyip çıktı. Sorunun yarısı hedefin
 * seçilebilir olmasıydı ama seçilmesi gerektiğinin hiçbir yerde
 * söylenmemesiydi. Burası, oyunun oyuncuya somut bir hedef gösterebilmesi
 * için gereken hesabı yapar.
 *
 * Hesap tamamen motorun kendi fonksiyonlarıyla yapılır — "şu kadar askerin
 * varsa şuraya saldır" gibi ikinci bir sezgisel kural yazılmaz; gerçek savaş
 * simülasyonu çalıştırılır. Böylece öneri, oyunun kendi kurallarıyla
 * tutarlı olmak zorunda kalır.
 */
import {
  B,
  UNIT_TYPES,
  aggregateGeneralBonus,
  altinKarsiligi,
  armyCount,
  bosGeneralBonus,
  fetihKazanci,
  hexDistance,
  lordContribution,
  marchDurationSec,
  maxRegions,
  regionIncome,
  simulateBattle,
  siraTahmini,
  totalEquipmentPower,
  type Army,
  type EquipSlot,
  type Rarity,
  type Side,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { equippedGenerals, gearBonusFrom } from './lord.js';
import { regionFortressBonus } from './region.js';

/** Lordun savaş tarafını kurar (ekipman, donanım, generaller dahil). */
export async function lordSide(
  lordId: string,
  army: Army,
  generalKeys: string[],
  client: Tx = prisma,
): Promise<Side> {
  const lord = await client.lord.findUniqueOrThrow({
    where: { id: lordId },
    include: { items: true, gearLines: true, generals: true },
  });
  const sahada = equippedGenerals(lord.generals, new Date()).filter(
    (g) => generalKeys.length === 0 || generalKeys.includes(g.key),
  );
  const items = lord.items
    .filter((i) => i.equipped)
    .map((i) => ({
      slot: i.slot as EquipSlot,
      tier: i.tier,
      rarity: i.rarity as Rarity,
      upgradeLevel: i.upgradeLevel,
    }));
  return {
    units: army,
    gearBonus: gearBonusFrom(lord.gearLines),
    generalBonus: sahada.length ? aggregateGeneralBonus(sahada) : bosGeneralBonus(),
    lordContribution: lordContribution(lord.guc, items),
    leadership: lord.liderlik,
    fortressBonus: 0,
    isDefender: false,
  };
}

/** Bir bölgenin NPC garnizonuna karşı savunma tarafı. */
function npcDefender(garrison: Army, type: string, level: number): Side {
  return {
    units: garrison,
    gearBonus: { saldiri: 0, savunma: 0, can: 0 },
    generalBonus: bosGeneralBonus(),
    lordContribution: 0,
    leadership: 0,
    fortressBonus: regionFortressBonus(type, level),
    isDefender: true,
  };
}

export interface HedefOnerisi {
  regionId: number;
  name: string;
  type: string;
  level: number;
  distance: number;
  marchSec: number;
  /** İlk saldırı kısayolu bu hedefte geçerli mi. */
  ilkSaldiri: boolean;
  /** Oyuncunun evde hiç ordusu var mı — "yetmiyor" ile "yok" farklı şeyler. */
  orduVar: boolean;
  /** Mevcut ev ordusuyla kazanılır mı. */
  kazanir: boolean;
  /** Kazanırsa geriye kaç birim kalır — "kıl payı" ile "rahat" farkı. */
  kalanBirim: number;
  garrison: Army;
  saatlikGelir: { altin: number; demir: number; erzak: number; sohret: number };
  sohretFarki: number;
  /** Bölge limiti dolu mu — kazansa bile alamaz. */
  limitDolu: boolean;
}

/**
 * Lorda saldırması gereken bölgeyi önerir.
 *
 * Yalnızca SAHİPSİZ bölgeler önerilir. Bir oyuncunun bölgesini önermek,
 * koruma kurallarına (yeni oyuncu kalkanı, seviye farkı, tekrar saldırı)
 * takılabilecek bir eylemi tavsiye etmek olurdu; öneri her zaman
 * yapılabilir olmalı.
 *
 * Taht Kalesi de dışarıda: 890 birimlik garnizonu oyunun bitiş hedefi,
 * yol gösterici bir ilk adım değil.
 */
export async function onerilenHedef(lordId: string): Promise<HedefOnerisi | null> {
  const lord = await prisma.lord.findUniqueOrThrow({
    where: { id: lordId },
    include: { regions: true, items: true },
  });

  const evRows = await prisma.armyUnit.findMany({
    where: { lordId, locationType: 'home', locationId: null },
  });
  const evOrdusu: Army = {};
  for (const r of evRows) evOrdusu[r.unitType as UnitType] = r.count;

  // Ordusu olmayan oyuncuya da hedef gösterilir. Öneriyi burada kesmek,
  // "ne için asker eğitiyorum" sorusunu tam da sorulduğu anda cevapsız
  // bırakıyordu: yeni oyuncunun ordusu hep boştur.
  const orduVar = armyCount(evOrdusu) > 0;

  const [saldiran, yuruyusSayisi, bolgeSayisi, adaylar] = await Promise.all([
    lordSide(lordId, evOrdusu, []),
    prisma.march.count({ where: { lordId } }),
    prisma.region.count({ where: { ownerLordId: lordId, type: { not: 'taht' } } }),
    prisma.region.findMany({
      where: {
        worldId: lord.worldId,
        ownerLordId: null,
        type: { not: 'taht' },
        OR: [{ shieldUntil: null }, { shieldUntil: { lte: new Date() } }],
      },
    }),
  ]);

  const limitDolu = bolgeSayisi >= maxRegions(lord.level);
  const ilkYuruyus = yuruyusSayisi === 0;

  let enIyi: HedefOnerisi | null = null;
  let enIyiPuan = -Infinity;

  for (const r of adaylar) {
    const garrison: Army = {};
    const ham = (r.npcGarrison ?? {}) as Record<string, number>;
    for (const t of UNIT_TYPES) if ((ham[t] ?? 0) > 0) garrison[t] = ham[t]!;

    // Ordu boşsa savaş simülasyonu anlamsız — sonuç baştan bellidir.
    let kazanir = false;
    let kalan = 0;
    if (orduVar) {
      const sonuc = simulateBattle(
        saldiran,
        npcDefender(garrison, r.type, r.level),
        `oneri-${lordId}-${r.id}`,
        { defenderStore: { altin: 0, demir: 0, erzak: 0 }, attackerCunning: 0, canCapture: true },
      );
      kazanir = sonuc.winner === 'attacker';
      kalan = armyCount(sonuc.attackerSurvivors);
    }

    const distance = hexDistance({ q: lord.homeQ, r: lord.homeR }, { q: r.q, r: r.r });
    const ilkSaldiri = ilkYuruyus && distance <= B.yuruyus.ilk_saldiri_max_hex;
    // Ordu boşken hız referansı kullanılır (marchDurationSec'in kendi
    // davranışı); gösterilen süre "bu mesafe kabaca ne kadar" demektir.
    const marchSec = marchDurationSec(distance, evOrdusu, saldiran.generalBonus, { ilkSaldiri });

    const gelir = regionIncome(r.type, r.level, r.incomeMult);

    // İki ayrı sıralama, çünkü iki ayrı soru soruluyor:
    //
    //  - Kazanılabilen hedefler arasında soru "hangisi en kârlı": saat
    //    başına düşen değer kazanır, yakın ve verimli hedef uzak ve zengin
    //    hedefi yener.
    //  - Kazanılamıyorsa soru "hangisi ulaşabileceğim ilk basamak":
    //    önce YAKINLIK, sonra zayıf garnizon. Değere göre sıralamak
    //    ordusu olmayan oyuncuya 160 birimlik şehri gösteriyordu; zayıf
    //    garnizonu öne almak ise 6 hex uzaktaki bir bölgeyi — yani tam
    //    da düzeltmeye çalıştığımız "ordumu yolladım, bir saat sonra
    //    dönerim" deneyimini. Yeni oyuncunun ilk hedefi yürüme mesafesinde
    //    olmalı.
    const saat = Math.max(marchSec, 60) / 3600;
    const puan = kazanir
      ? 1e9 + altinKarsiligi(gelir) / saat + kalan
      : -distance * 1000 - armyCount(garrison);


    if (puan > enIyiPuan) {
      enIyiPuan = puan;
      enIyi = {
        regionId: r.id,
        name: r.name,
        type: r.type,
        level: r.level,
        distance,
        marchSec,
        ilkSaldiri,
        orduVar,
        kazanir,
        kalanBirim: kalan,
        garrison,
        saatlikGelir: {
          altin: Math.round(gelir.altin),
          demir: Math.round(gelir.demir),
          erzak: Math.round(gelir.erzak),
          sohret: Math.round(gelir.sohret),
        },
        sohretFarki: fetihKazanci({
          lordLevel: lord.level,
          regions: lord.regions.map((x) => ({ type: x.type, level: x.level })),
          hedef: { type: r.type, level: r.level, incomeMult: r.incomeMult },
          totalEquipmentPower: 0,
          army: {},
          pvpWins: lord.pvpWins,
          fortressFameAccrued: lord.fortressFameAccrued,
          ownsThrone: lord.regions.some((x) => x.type === 'taht'),
        }).sohretFarki,
        limitDolu,
      };
    }
  }

  return enIyi;
}


export interface FetihOdulu {
  /** Bölgenin saatlik üretimi. */
  saatlikGelir: { altin: number; demir: number; erzak: number; sohret: number };
  /** Bu bölgeyle lordun toplam saatlik geliri ne olur. */
  toplamGelirOncesi: { altin: number; demir: number; erzak: number };
  toplamGelirSonrasi: { altin: number; demir: number; erzak: number };
  sohretOncesi: number;
  sohretSonrasi: number;
  siraOncesi: number;
  siraSonrasi: number;
  xp: number;
  bolgeOncesi: number;
  bolgeSonrasi: number;
  bolgeLimiti: number;
  /** Limit dolu: kazansa bile bölgeyi alamaz, sadece yağmalar. */
  limitDolu: boolean;
}

/**
 * "Bu bölgeyi alırsan ne olur?"
 *
 * Şöhret ve sıra tahmin edilmez, hesaplanır: şöhret formülü hedef bölge
 * listeye eklenmiş hâliyle ikinci kez çalıştırılır, sıra da dünyadaki
 * gerçek şöhret listesine bakılarak bulunur.
 */
export async function fetihOdulu(
  lordId: string,
  region: { type: string; level: number; incomeMult: number },
): Promise<FetihOdulu> {
  const lord = await prisma.lord.findUniqueOrThrow({
    where: { id: lordId },
    include: { regions: true, items: true, units: true },
  });

  const ordu: Army = {};
  for (const u of lord.units) {
    const t = u.unitType as UnitType;
    if (UNIT_TYPES.includes(t)) ordu[t] = (ordu[t] ?? 0) + u.count;
  }
  const ekipman = totalEquipmentPower(
    lord.items
      .filter((i) => i.equipped)
      .map((i) => ({
        slot: i.slot as EquipSlot,
        tier: i.tier,
        rarity: i.rarity as Rarity,
        upgradeLevel: i.upgradeLevel,
      })),
  );

  const kazanc = fetihKazanci({
    lordLevel: lord.level,
    regions: lord.regions.map((r) => ({ type: r.type, level: r.level })),
    hedef: region,
    totalEquipmentPower: ekipman,
    army: ordu,
    pvpWins: lord.pvpWins,
    fortressFameAccrued: lord.fortressFameAccrued,
    ownsThrone: lord.regions.some((r) => r.type === 'taht'),
  });

  // Sıra tahmini: kendi satırım listeden çıkarılır, yoksa yeni şöhretim
  // eski şöhretimle kıyaslanıp bir sıra fazla sayılır.
  const rakipler = await prisma.lord.findMany({
    where: { worldId: lord.worldId, id: { not: lordId } },
    select: { fame: true },
    orderBy: { fame: 'desc' },
  });
  const puanlar = rakipler.map((r) => r.fame);

  const gelirOncesi = topla(lord.regions.map((r) => regionIncome(r.type, r.level, r.incomeMult)));
  const hedefGelir = regionIncome(region.type, region.level, region.incomeMult);
  const bolgeSayisi = lord.regions.filter((r) => r.type !== 'taht').length;
  const limit = maxRegions(lord.level);
  const limitDolu = bolgeSayisi >= limit && region.type !== 'taht';

  return {
    saatlikGelir: yuvarla4(hedefGelir),
    toplamGelirOncesi: yuvarla3(gelirOncesi),
    toplamGelirSonrasi: yuvarla3({
      altin: gelirOncesi.altin + hedefGelir.altin,
      demir: gelirOncesi.demir + hedefGelir.demir,
      erzak: gelirOncesi.erzak + hedefGelir.erzak,
    }),
    sohretOncesi: kazanc.sohretOncesi,
    sohretSonrasi: kazanc.sohretSonrasi,
    siraOncesi: siraTahmini(puanlar, kazanc.sohretOncesi),
    siraSonrasi: siraTahmini(puanlar, kazanc.sohretSonrasi),
    xp: kazanc.xp,
    bolgeOncesi: bolgeSayisi,
    bolgeSonrasi: limitDolu ? bolgeSayisi : bolgeSayisi + (region.type === 'taht' ? 0 : 1),
    bolgeLimiti: limit,
    limitDolu,
  };
}

function topla(list: { altin: number; demir: number; erzak: number }[]) {
  return list.reduce(
    (a, r) => ({ altin: a.altin + r.altin, demir: a.demir + r.demir, erzak: a.erzak + r.erzak }),
    { altin: 0, demir: 0, erzak: 0 },
  );
}

function yuvarla3(r: { altin: number; demir: number; erzak: number }) {
  return { altin: Math.round(r.altin), demir: Math.round(r.demir), erzak: Math.round(r.erzak) };
}

function yuvarla4(r: { altin: number; demir: number; erzak: number; sohret: number }) {
  return { ...yuvarla3(r), sohret: Math.round(r.sohret) };
}
