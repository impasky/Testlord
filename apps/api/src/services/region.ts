/**
 * Bölge geliri ve yağmalanabilir depo.
 *
 * Önemli tasarım kararı: yağmalanabilir kaynak BÖLGEDE birikir, lordun
 * kasasında değil. Böylece yağma bölgeyi vurur, oyuncunun toplam servetini
 * sıfırlamaz. (docs/03 §3)
 */
import {
  B,
  UNIT_TYPES,
  WORLD_MAP,
  fortressBonus,
  regionIncome,
  type Army,
  type Resources,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';

/** Bölge deposunun üst sınırı — sonsuz birikip dev yağma hedefi olmasın. */
export function regionStoreCap(level: number): number {
  return 5000 + 3000 * level;
}

/** Bölge yükseltme maliyeti ve süresi. */
export function regionUpgradeCost(level: number): Resources & { sec: number } {
  const c = B.bolgeler;
  return {
    altin: Math.round(c.yukseltme_taban.altin * Math.pow(c.yukseltme_us, level - 1)),
    demir: Math.round(c.yukseltme_taban.demir * Math.pow(c.yukseltme_us, level - 1)),
    erzak: 0,
    sec: Math.round(3600 * 2 * Math.pow(2, level - 1)),
  };
}

export function regionFortressBonus(type: string, level: number): number {
  return fortressBonus(type, level);
}

/** world-map.json'daki taban NPC garnizonu — sabit, mutasyona uğramaz. */
const NPC_TABAN = new Map<number, Army>(
  WORLD_MAP.regions.map((r) => [r.id, r.npc_garrison as unknown as Army]),
);

/**
 * Sahipsiz bölgenin NPC garnizonunu tabana doğru yeniler.
 *
 * Yenilenme olmasaydı oyuncu bir bölgeyi ucuz akınlarla yıpratıp boşaltır,
 * sonra küçük bir kuvvetle alırdı. Bu özellikle 890 birimlik Taht Kalesi'ni
 * anlamsız kılardı. SADECE NPC bölgeleri için geçerli; oyuncunun kaybettiği
 * garnizon yenilenmez.
 */
export function regenerateNpcGarrison(
  regionId: number,
  mevcut: Army,
  hours: number,
): Army | null {
  const taban = NPC_TABAN.get(regionId);
  if (!taban || hours <= 0) return null;

  const oran = B.npc_garnizonu.yenilenme_saatlik_oran * hours;
  const yeni: Army = {};
  let degisti = false;

  for (const t of UNIT_TYPES as readonly UnitType[]) {
    const hedef = taban[t] ?? 0;
    const simdi = mevcut[t] ?? 0;
    if (hedef <= 0) {
      if (simdi > 0) yeni[t] = simdi;
      continue;
    }
    const sonraki = Math.min(hedef, Math.floor(simdi + hedef * oran));
    if (sonraki !== simdi) degisti = true;
    if (sonraki > 0) yeni[t] = sonraki;
  }
  return degisti ? yeni : null;
}

/**
 * Sahipli bölgelerin yağmalanabilir depolarını biriktirir.
 * Sahipsiz (NPC) bölgelerde de birikir — yağma akınına değer olsun diye.
 */
export async function accrueRegionStores(now: Date): Promise<void> {
  const regions = await prisma.region.findMany({
    where: { lastTickAt: { lt: new Date(now.getTime() - 60_000) } },
    take: 200,
    orderBy: { lastTickAt: 'asc' },
  });

  for (const r of regions) {
    const hours = (now.getTime() - r.lastTickAt.getTime()) / 3_600_000;
    if (hours <= 0) continue;
    const inc = regionIncome(r.type, r.level, r.incomeMult);
    const cap = regionStoreCap(r.level);

    // Sahipsiz bölgelerde NPC garnizonu tabana doğru toparlanır
    const yenilenen = r.ownerLordId
      ? null
      : regenerateNpcGarrison(r.id, r.npcGarrison as Army, hours);

    await prisma.region.update({
      where: { id: r.id },
      data: {
        storeAltin: Math.min(cap, Math.floor(r.storeAltin + inc.altin * hours)),
        storeDemir: Math.min(cap, Math.floor(r.storeDemir + inc.demir * hours)),
        storeErzak: Math.min(cap, Math.floor(r.storeErzak + inc.erzak * hours)),
        ...(yenilenen ? { npcGarrison: yenilenen as object } : {}),
        lastTickAt: now,
      },
    });
  }
}

/** Bölgeyi devreder: sahibi değişir, NPC garnizonu temizlenir, kalkan konur. */
export async function transferRegion(
  regionId: number,
  newOwnerId: string | null,
  tx: Tx,
): Promise<void> {
  await tx.region.update({
    where: { id: regionId },
    data: {
      ownerLordId: newOwnerId,
      npcGarrison: {},
      shieldUntil: new Date(
        Date.now() + B.korumalar.bolge_ele_gecirme_sonrasi_saat * 3_600_000,
      ),
    },
  });
}
