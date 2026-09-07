/**
 * data/*.json dosyalarını tipli olarak yükler ve doğrular.
 *
 * KURAL: Oyun kodunda hiçbir yerde sabit sayı bulunmaz. Her sayı buradan gelir.
 * Denge değişikliği = sadece data/balance.json'da değişiklik.
 */
import balanceJson from '../../../data/balance.json';
import basarimlarJson from '../../../data/basarimlar.json';
import generalsJson from '../../../data/generals.json';
import seferlerJson from '../../../data/seferler.json';
import taktiklerJson from '../../../data/taktikler.json';
import arastirmaJson from '../../../data/arastirma.json';
import binalarJson from '../../../data/binalar.json';
import akinlarJson from '../../../data/akinlar.json';
import armaJson from '../../../data/arma.json';
import unvanlarJson from '../../../data/unvanlar.json';
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
export const GENERAL_INJURY = generalsJson.yaralanma;

/**
 * Haftalık sefer tanımları. Hangisinin açık olduğu sefer.ts'te hafta
 * numarasından türetiliyor — burada yalnız içerik var.
 */
export const SEFERLER = seferlerJson.seferler as unknown as {
  key: string;
  ad: string;
  aciklama: string;
  olcut: string;
  hedef: number;
  birim: string;
}[];
export const SEFER_ODUL = seferlerJson.odul;

/**
 * Savaş taktikleri. Sayısal etkileri burada, mantığı `duzen.ts`de.
 *
 * `kosul` alanı hangi denetimin çalışacağını söylüyor — yeni bir taktik
 * eklemek çoğu zaman koda dokunmadan JSON'a bir kayıt.
 */
/**
 * Araştırma dalları. Sayıları balance.json'da (maliyet ve süre yalnız
 * kademeden türetiliyor), içeriği burada.
 */
export const ARASTIRMA_DALLARI = arastirmaJson.dallar as unknown as {
  key: string;
  ad: string;
  ozet: string;
  dugumler: {
    key: string;
    ad: string;
    aciklama: string;
    kademe: number;
    lord_seviyesi: number;
    etki: Record<string, number>;
  }[];
}[];

export const TAKTIKLER = taktiklerJson.taktikler as unknown as {
  key: string;
  ad: string;
  ozet: string;
  aciklama: string;
  kosul: Record<string, unknown> | null;
  ek_kosul?: Record<string, unknown>;
  etki: Record<string, number | Record<string, number>>;
}[];

/** Heraldik parçaları ve unvan kademeleri — ikisi de saf görünüş. */
export const ARMA = armaJson as unknown as {
  kalkanlar: { key: string; ad: string }[];
  desenler: { key: string; ad: string }[];
  renkler: { key: string; ad: string; kod: string }[];
  semboller: { key: string; ad: string }[];
};
export const UNVANLAR = unvanlarJson as unknown as {
  taht_unvani: string;
  kademeler: { esik: number; ad: string; aciklama: string }[];
};
/**
 * Şehir binaları. Seviyenin NE VERDİĞİ `etki` alanında; sayıları
 * `balance.json → binalar` içinde (bina.ts).
 */
/**
 * Akın haritaları: beş NPC diyarı, her birinde on grup (docs/12 §6).
 *
 * Buradaki her şey ANLATI ve BİLEŞİM. Garnizonun kaç kişi olduğu,
 * akının kaç dakika sürdüğü, ne kadar ödül düştüğü `balance.json → akin`
 * içinde — denge değişikliği anlatı dosyasına dokunmasın diye.
 */
export const AKIN_HARITALARI = akinlarJson.haritalar as unknown as {
  key: string;
  ad: string;
  dusman: string;
  ozet: string;
  acilis_seviyesi: number;
  guc_carpani: number;
  odul_carpani: number;
  azami_tier: number;
  karisim: Record<string, number>;
  odul_agirligi: Record<string, number>;
  gruplar: string[];
}[];

export const BINALAR = binalarJson.binalar as unknown as {
  key: string;
  ad: string;
  ozet: string;
  aciklama: string;
  x: number;
  y: number;
  olcek: number;
  seviyeli: boolean;
  acilis_kademesi: string;
  etki?: string;
  etki_metni?: string;
  maliyet_carpani?: number;
  kapi?: string;
  sekme?: string;
  bolum?: string;
}[];

export const WORLD_MAP = worldMapJson as unknown as {
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
  return (
    (B.ekipman.tier_acilis_lord_seviyesi as unknown as Record<string, number>)[String(tier)] ?? 1
  );
}

export function craftCost(tier: number): { altin: number; demir: number; sure_dk: number } {
  const c = (
    B.ekipman.uretim_maliyeti as unknown as Record<
      string,
      { altin: number; demir: number; sure_dk: number }
    >
  )[String(tier)];
  if (!c) throw new Error(`Bilinmeyen tier: ${tier}`);
  return c;
}

export function craftRarityTable(tier: number): Record<Rarity, number> {
  const t = (
    B.ekipman.uretim_nadirlik_tablosu as unknown as Record<string, Record<string, number>>
  )[String(tier)];
  if (!t) throw new Error(`Bilinmeyen tier: ${tier}`);
  return t as Record<Rarity, number>;
}

export function upgradeSuccessChance(currentLevel: number): number {
  const t = B.ekipman.yukseltme_basari_sansi as unknown as Record<string, number>;
  return t[String(currentLevel)] ?? 0;
}

export function regionBaseIncome(type: string): Record<string, number> {
  return (
    (B.bolgeler.taban_gelir_saatlik as unknown as Record<string, Record<string, number>>)[type] ??
    {}
  );
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

  /*
   * KOMŞULUK GRAFİĞİ (docs/12 §1).
   *
   * Altıgen ızgara kalkınca mesafe artık aritmetikten değil elle yazılmış
   * bir listeden geliyor. Elle yazılan liste bozulabilir ve bozulduğunda
   * sessizce bozulur: tek yönlü bir kenar, oraya giden yürüyüşü uzun,
   * dönüşü kısa yapar ve kimse fark etmez. Grafiğin sağlığı bu yüzden
   * denge doğrulamasının parçası.
   */
  const idler = new Set(WORLD_MAP.regions.map((r) => r.id));
  if (idler.size !== WORLD_MAP.regions.length) {
    hatalar.push('world-map.json: tekrar eden bölge kimliği var');
  }
  for (const r of WORLD_MAP.regions) {
    if (r.komsular.includes(r.id)) hatalar.push(`${r.name}: kendi kendine komşu`);
    for (const k of r.komsular) {
      if (!idler.has(k)) {
        hatalar.push(`${r.name}: olmayan bölgeye komşu (${k})`);
        continue;
      }
      // Komşuluk KARŞILIKLI olmalı. Tek yönlü kenar, gidiş ve dönüş
      // sürelerinin farklı çıkmasına yol açardı.
      const karsi = WORLD_MAP.regions.find((x) => x.id === k);
      if (karsi && !karsi.komsular.includes(r.id)) {
        hatalar.push(`${r.name} → ${karsi.name} komşuluğu tek yönlü`);
      }
    }
    if (r.komsular.length === 0) hatalar.push(`${r.name}: hiçbir bölgeye komşu değil`);
    if (r.x < 0 || r.x > 100 || r.y < 0 || r.y > 100) {
      hatalar.push(`${r.name}: harita üzerindeki yeri (${r.x}, ${r.y}) 0-100 dışında`);
    }
  }
  // Harita TEK PARÇA olmalı: kopuk bir küme, oraya hiç saldıramamak demek.
  {
    const komsuluk = new Map(WORLD_MAP.regions.map((r) => [r.id, r.komsular]));
    const gorulen = new Set<number>();
    const kuyruk = [WORLD_MAP.regions[0]?.id].filter((x): x is number => x !== undefined);
    gorulen.add(kuyruk[0]!);
    for (let i = 0; i < kuyruk.length; i++) {
      for (const k of komsuluk.get(kuyruk[i]!) ?? []) {
        if (gorulen.has(k)) continue;
        gorulen.add(k);
        kuyruk.push(k);
      }
    }
    if (gorulen.size !== WORLD_MAP.regions.length) {
      hatalar.push(
        `world-map.json: harita kopuk — ${WORLD_MAP.regions.length} bölgenin ${gorulen.size} tanesine ulaşılıyor`,
      );
    }
  }

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
