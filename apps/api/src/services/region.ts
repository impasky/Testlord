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
  BASKENT_TURLERI,
  regionIncome,
  tahkimatEki,
  type Army,
  type Resources,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { binalariOku, pushEvent } from './lord.js';

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

/**
 * Bölgenin tahkimatı + varsa SURLAR.
 *
 * Surlar yalnız BAŞKENTİ güçlendiriyor: oyuncunun oturduğu yeri savunan
 * bir duvar, imparatorluğunun tamamını değil (docs/12 §4). Bu yüzden
 * karşılaştırma bölgenin `mapId`si ile lordun `baskentBolgeId`si
 * arasında — sahibi olmayan bölge zaten ek almıyor.
 *
 * Tek yerde: savaş, önizleme ve harita aynı sayıyı göstermeli. İkisinden
 * biri surları unutsaydı oyuncu "kazanırım" yazan bir önizlemeye bakıp
 * kaybederdi ve neden olduğunu hiçbir yerde göremezdi.
 */
export function bolgeTahkimati(
  region: { type: string; level: number; mapId: number },
  sahip: { binalar?: unknown; baskentBolgeId?: number | null } | null | undefined,
): number {
  const taban = fortressBonus(region.type, region.level);
  if (!sahip || sahip.baskentBolgeId !== region.mapId) return taban;
  return taban + tahkimatEki(binalariOku(sahip));
}

/**
 * Kanonik haritanın taban NPC garnizonu — YEDEK yol.
 *
 * Taban artık bölgenin kendi satırında (`npcTaban`) duruyor: bir dünya
 * kendi haritasının garnizonuna doğru toparlanmalı, kanonik dosyanın o
 * günkü hâline doğru değil (docs/12 §14). Burası yalnız sürümlemeden
 * ÖNCE yazılmış, tabanı henüz doldurulmamış satırlar için var — onların
 * hepsi zaten kanonik haritada, çünkü eski seed hepsini ona eşitliyordu.
 */
const KANONIK_NPC_TABAN = new Map<number, Army>(
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
  bolge: { mapId: number; npcTaban: unknown },
  mevcut: Army,
  hours: number,
): Army | null {
  const taban = (bolge.npcTaban as Army | null) ?? KANONIK_NPC_TABAN.get(bolge.mapId);
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
      : regenerateNpcGarrison(r, r.npcGarrison as Army, hours);

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

/**
 * Bölgeyi devreder: sahibi değişir, NPC garnizonu temizlenir, kalkan konur.
 *
 * Taht Kalesi'nin kalkanı bilerek kısa (docs/01 §5): taht endgame'in odağı,
 * sürekli el değiştirmesi gereken tek hedef. Normal bölge kalkanı oraya da
 * uygulansaydı taht alan oyuncu yarım gün dokunulmaz olurdu ve rekabetin
 * varış noktası donardı.
 */
export async function transferRegion(
  regionId: number,
  newOwnerId: string | null,
  tx: Tx,
): Promise<void> {
  const { type } = await tx.region.findUniqueOrThrow({
    where: { id: regionId },
    select: { type: true },
  });
  const saat =
    type === 'taht'
      ? B.taht_kalesi.kaybetme_korumasi_saat
      : B.korumalar.bolge_ele_gecirme_sonrasi_saat;

  const onceki = await tx.region.findUniqueOrThrow({
    where: { id: regionId },
    select: { ownerLordId: true, mapId: true, name: true },
  });

  await tx.region.update({
    where: { id: regionId },
    data: {
      ownerLordId: newOwnerId,
      npcGarrison: {},
      shieldUntil: new Date(Date.now() + saat * 3_600_000),
    },
  });

  // Kaybeden BAŞKENTİNİ kaybettiyse bir yere taşınmalı (docs/12 §2.3).
  if (onceki.ownerLordId && onceki.ownerLordId !== newOwnerId) {
    await baskentiDusur(onceki.ownerLordId, onceki.mapId, onceki.name, tx);
  }
}

/**
 * Başkentini kaybeden lordu yeni bir yerleşime taşır; yoksa kampa düşürür.
 *
 * Kural (docs/12 §2.3): oyuncu hiçbir durumda SİLİNMEZ, en fazla geriye
 * düşer. Elindeki en iyi yerleşime kendiliğinden taşınıyor — "başkentini
 * seç" diye bir soru sormak, kaybın üstüne bir de form doldurtmak
 * olurdu. Hiç yerleşimi kalmadıysa `baskentBolgeId` null oluyor ve şehir
 * sayfası kampı gösteriyor: binalar duruyor ama kademe tavanı kampa
 * düştüğü için çoğu kilitli. Yeniden bir köy alınca binalar olduğu
 * yerden devam ediyor — hiçbir seviye silinmiyor.
 *
 * Kendiliğinden değil de okuma anında türetseydik (şehir sayfası zaten
 * "başkent başkasının olduysa kamp" diyor) lordun kaydında ölü bir
 * bölge kimliği kalırdı ve o bölgeyi geri alan biri, eski sahibinin
 * başkentini de geri vermiş olurdu.
 */
async function baskentiDusur(
  lordId: string,
  kaybedilenMapId: number,
  kaybedilenAd: string,
  tx: Tx,
): Promise<void> {
  const lord = await tx.lord.findUnique({
    where: { id: lordId },
    select: { baskentBolgeId: true, worldId: true },
  });
  if (!lord || lord.baskentBolgeId !== kaybedilenMapId) return;

  // Elde kalan en iyi yerleşim: önce türü, sonra seviyesi.
  const kalanlar = await tx.region.findMany({
    where: { ownerLordId: lordId, type: { in: [...BASKENT_TURLERI] } },
    select: { mapId: true, name: true, type: true, level: true },
  });
  const sira = (t: string): number => BASKENT_TURLERI.indexOf(t);
  kalanlar.sort((a, b) => sira(b.type) - sira(a.type) || b.level - a.level);
  const yeni = kalanlar[0] ?? null;

  await tx.lord.update({
    where: { id: lordId },
    data: { baskentBolgeId: yeni?.mapId ?? null },
  });
  await pushEvent(
    lordId,
    'baskent_dustu',
    {
      mesaj: yeni
        ? `${kaybedilenAd} elinden çıktı. Başkentin ${yeni.name} oldu; binaların seninle taşındı.`
        : `${kaybedilenAd} elinden çıktı. Bir kampa çekildin — binaların duruyor, yeni bir yerleşim alınca kaldığın yerden devam edecek.`,
    },
    tx,
  );
}
