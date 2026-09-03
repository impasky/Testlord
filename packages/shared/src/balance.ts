/**
 * data/*.json dosyalarını tipli olarak yükler ve doğrular.
 *
 * KURAL: Oyun kodunda hiçbir yerde sabit sayı bulunmaz. Her sayı buradan gelir.
 * Denge değişikliği = sadece data/balance.json'da değişiklik.
 */
import balanceJson from '../../../data/balance.json';
import basarimlarJson from '../../../data/basarimlar.json';
import generalsJson from '../../../data/generals.json';
import worldMapJson from '../../../data/world-map.json';
import type { GeneralDef, RegionDef, Rarity, UnitStats, UnitType } from './types.js';
import { RARITIES, UNIT_TYPES } from './types.js';

export const B = balanceJson;
export const GENERALS = generalsJson.generaller as unknown as GeneralDef[];
export const GENERAL_SLOT_RULE = generalsJson.slot_kurali;

/**
 * Başarım tanımları. İçerik veri dosyasında, mantık `basarim.ts`de.
 *
 * `olcut` alanı hangi değerin okunacağını söylüyor — yeni bir başarım
 * eklemek çoğu zaman koda dokunmadan JSON'a bir satır.
 */
export const BASARIM_KUMELERI = basarimlarJson.kumeler as unknown as {
  ad: string;
  basarimlar: { key: string; ad: string; aciklama: string; olcut: string; hedef: number }[];
}[];
export const GENERAL_LEVEL = generalsJson.seviye;
export const WORLD_MAP = worldMapJson as unknown as {
  radius: number;
  region_count: number;
  provinces: { key: string; name: string }[];
  regions: RegionDef[];
};

/** Birim tanımını getirir. */
export function unit(type: UnitType): UnitStats {
  return B.birimler[type] as unknown as UnitStats;
}

/**
 * Birimin oyuncuya gösterilecek adı.
 * Arayüzde HİÇBİR yerde ham anahtar ('mizrakci') gösterilmemeli.
 */
export function unitName(type: UnitType): string {
  return unit(type).ad;
}

/** Bir orduyu "40 Mızrakçı, 25 Okçu" gibi okunur metne çevirir. */
export function formatArmy(army: Partial<Record<UnitType, number>>): string {
  const parcalar = UNIT_TYPES.filter((t) => (army[t] ?? 0) > 0).map(
    (t) => `${army[t]} ${unitName(t)}`,
  );
  return parcalar.length ? parcalar.join(', ') : 'yok';
}

/** Karşı çarpanı: saldıran birim -> hedef birim. Tanımsız eşleşme 1.0. */
export function counterMultiplier(attacker: UnitType, target: UnitType): number {
  const table = B.birim_kars_carpanlari as unknown as Record<string, Record<string, number>>;
  return table[attacker]?.[target] ?? 1.0;
}

/** Mancınığın kale savunmasına karşı çarpanı. */
export function siegeVsFortress(): number {
  return B.birim_kars_carpanlari.kusatma.kale_savunmasi;
}

/** Mancınığın canlı birime karşı cezası. */
export function siegeVsUnit(): number {
  return B.birim_kars_carpanlari.kusatma.birim;
}

export function generalDef(key: string): GeneralDef | undefined {
  return GENERALS.find((g) => g.key === key);
}

export function tierBasePower(tier: number): number {
  const t = B.ekipman.tier_taban_guc as unknown as Record<string, number>;
  const v = t[String(tier)];
  if (v === undefined) throw new Error(`Bilinmeyen tier: ${tier}`);
  return v;
}

export function rarityMultiplier(rarity: Rarity): number {
  return (B.ekipman.nadirlik_carpani as unknown as Record<string, number>)[rarity] ?? 1;
}

export function tierUnlockLevel(tier: number): number {
  return (B.ekipman.tier_acilis_lord_seviyesi as unknown as Record<string, number>)[String(tier)] ?? 1;
}

export function craftCost(tier: number): { altin: number; demir: number; sure_dk: number } {
  const c = (B.ekipman.uretim_maliyeti as unknown as Record<string, { altin: number; demir: number; sure_dk: number }>)[String(tier)];
  if (!c) throw new Error(`Bilinmeyen tier: ${tier}`);
  return c;
}

export function craftRarityTable(tier: number): Record<Rarity, number> {
  const t = (B.ekipman.uretim_nadirlik_tablosu as unknown as Record<string, Record<string, number>>)[String(tier)];
  if (!t) throw new Error(`Bilinmeyen tier: ${tier}`);
  return t as Record<Rarity, number>;
}

export function upgradeSuccessChance(currentLevel: number): number {
  const t = B.ekipman.yukseltme_basari_sansi as unknown as Record<string, number>;
  return t[String(currentLevel)] ?? 0;
}

export function regionBaseIncome(type: string): Record<string, number> {
  return (B.bolgeler.taban_gelir_saatlik as unknown as Record<string, Record<string, number>>)[type] ?? {};
}

export function fortressBonus(type: string, level: number): number {
  const base = (B.bolgeler.kale_savunma_bonusu as unknown as Record<string, number>)[type] ?? 0;
  return base + B.bolgeler.kale_bonusu_seviye_basina * (level - 1);
}

export function fameTypeMultiplier(type: string): number {
  return (B.sohret.bolge_tip_carpani as unknown as Record<string, number>)[type] ?? 1;
}

export function carryCapacityPerUnit(type: UnitType): number {
  return (B.savas.tasima_kapasitesi_birim_basina as unknown as Record<string, number>)[type] ?? 0;
}

/**
 * Veri dosyalarının kendi içinde tutarlı olduğunu doğrular.
 * Sunucu açılışında çağrılır; bozuk veriyle ayağa kalkmaktansa hemen ölmek iyidir.
 */
export function validateBalance(): void {
  const hatalar: string[] = [];

  for (const u of UNIT_TYPES) {
    const d = B.birimler[u] as unknown as UnitStats | undefined;
    if (!d) hatalar.push(`birimler.${u} eksik`);
    else if (d.yer < 1) hatalar.push(`birimler.${u}.yer >= 1 olmalı`);
  }

  for (const tier of [1, 2, 3, 4, 5]) {
    const table = craftRarityTable(tier);
    const toplam = RARITIES.reduce((s, r) => s + (table[r] ?? 0), 0);
    if (Math.abs(toplam - 1) > 1e-9) {
      hatalar.push(`uretim_nadirlik_tablosu.${tier} toplamı 1 değil: ${toplam}`);
    }
  }

  if (GENERALS.length === 0) hatalar.push('generals.json boş');
  const keys = new Set(GENERALS.map((g) => g.key));
  if (keys.size !== GENERALS.length) hatalar.push('generals.json içinde tekrar eden key var');

  if (WORLD_MAP.regions.length !== WORLD_MAP.region_count) {
    hatalar.push('world-map.json: region_count ile gerçek bölge sayısı uyuşmuyor');
  }
  const tahtlar = WORLD_MAP.regions.filter((r) => r.type === 'taht');
  if (tahtlar.length !== 1) hatalar.push(`Taht Kalesi tam 1 olmalı, ${tahtlar.length} bulundu`);

  if (hatalar.length > 0) {
    throw new Error(`Denge verisi geçersiz:\n  - ${hatalar.join('\n  - ')}`);
  }
}

/**
 * Bölgenin o seviyedeki adı: "Kasaba", "Pazar Şehri", "Ticaret Şehri"…
 *
 * Yeni bir mekanik değil, var olan yükseltmenin adlandırılması. Oyuncu
 * "şehri geliştiremiyorum" diyordu; oysa geliştirebiliyordu ama arayüz ona
 * "Sv 2" diyordu. Bir yeri geliştirmek, o yerin AD DEĞİŞTİRMESİYLE
 * hissedilir. (docs/08 İ10)
 */
export function bolgeAsamaAdi(type: string, level: number): string {
  const tablo = B.bolgeler.gelisim_adlari as unknown as Record<string, string[]>;
  const adlar = tablo[type];
  if (!adlar || adlar.length === 0) return `Seviye ${level}`;
  return adlar[Math.min(Math.max(1, level), adlar.length) - 1]!;
}

/**
 * Lider avı — kartopu freni.
 *
 * Lider öne geçtikten sonra fark kapanmıyorsa oyun bitmeden ölüyor
 * (docs/09 §3.4). Çözüm lideri zayıflatmak DEĞİL; ona saldırmayı kârlı
 * kılmak. Nerf oyuncuyu cezalandırır ve zirveye çıkmayı anlamsızlaştırır;
 * ödül ise herkese bir hedef verir ve zirvedeki oyuncu da bunu bilerek
 * savunma kurar. Travian'ın "lidere karşı ittifak" dinamiği de böyle
 * çalışıyor.
 */
export function liderAviYagmaBonusu(): number {
  return B.lider_avi.yagma_bonusu;
}

/**
 * Bu dünyada lider avı geçerli mi?
 *
 * İki kişilik bir dünyada "lider" anlamsız ve işaret sadece kafa
 * karıştırır. Eşik `balance.json`da.
 */
export function liderAviGecerliMi(lordSayisi: number): boolean {
  return lordSayisi >= B.lider_avi.en_az_lord;
}
