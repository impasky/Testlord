/** Oyunun tüm ortak tipleri. Sunucu ve arayüz aynı tipleri kullanır. */

export type ResourceType = 'altin' | 'demir' | 'erzak';
export type UnitType = 'milis' | 'mizrakci' | 'okcu' | 'suvari' | 'kusatma';
export type EquipSlot = 'silah' | 'kalkan' | 'zirh' | 'migfer' | 'at' | 'sancak';
export type Rarity = 'siradan' | 'usta' | 'nadir' | 'efsanevi' | 'kadim';
export type RegionType = 'tarla' | 'maden' | 'sehir' | 'kale' | 'taht';
export type GearLineKey = 'silahlik' | 'zirhhane' | 'nalbant';
export type StatKey = 'guc' | 'dayaniklilik' | 'liderlik' | 'kurnazlik';
export type GeneralRarity = 'bronz' | 'gumus' | 'altin';

export const UNIT_TYPES: readonly UnitType[] = ['milis', 'mizrakci', 'okcu', 'suvari', 'kusatma'];
export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'silah',
  'kalkan',
  'zirh',
  'migfer',
  'at',
  'sancak',
];
export const RARITIES: readonly Rarity[] = ['siradan', 'usta', 'nadir', 'efsanevi', 'kadim'];
export const GEAR_LINES: readonly GearLineKey[] = ['silahlik', 'zirhhane', 'nalbant'];
export const STAT_KEYS: readonly StatKey[] = ['guc', 'dayaniklilik', 'liderlik', 'kurnazlik'];

/** Kaynak üçlüsü. Her yerde bu şekil kullanılır. */
export type Resources = Record<ResourceType, number>;

/** Ordu: birim tipi -> adet. Eksik anahtar 0 sayılır. */
export type Army = Partial<Record<UnitType, number>>;

export interface UnitStats {
  ad: string;
  saldiri: number;
  savunma: number;
  can: number;
  hiz: number;
  yer: number;
  egitim_sn: number;
  maliyet: Resources;
  bakim_erzak_saat: number;
}

export interface LordStats {
  guc: number;
  dayaniklilik: number;
  liderlik: number;
  kurnazlik: number;
}

export interface EquippedItem {
  slot: EquipSlot;
  tier: number;
  rarity: Rarity;
  upgradeLevel: number;
}

/** Generallerin savaşa ve ekonomiye getirdiği toplu bonuslar. */
export interface GeneralBonus {
  orduSaldiri: number;
  orduSavunma: number;
  orduCan: number;
  savunmadaOrduSavunma: number;
  birimSaldiri: Partial<Record<UnitType, number>>;
  birimSavunma: Partial<Record<UnitType, number>>;
  lordSavasKatkisi: number;
  yagma: number;
  bolgeGeliri: number;
  bakimMaliyeti: number;
  yuruyusSuresi: number;
  komutaKapasitesi: number;
  kayipGeriDonus: number;
  kaleDelme: number;
}

export function bosGeneralBonus(): GeneralBonus {
  return {
    orduSaldiri: 0,
    orduSavunma: 0,
    orduCan: 0,
    savunmadaOrduSavunma: 0,
    birimSaldiri: {},
    birimSavunma: {},
    lordSavasKatkisi: 0,
    yagma: 0,
    bolgeGeliri: 0,
    bakimMaliyeti: 0,
    yuruyusSuresi: 0,
    komutaKapasitesi: 0,
    kayipGeriDonus: 0,
    kaleDelme: 0,
  };
}

/** Savaşa giren bir taraf. combat.ts bunun dışında hiçbir şey bilmez. */
export interface Side {
  units: Army;
  gearBonus: { saldiri: number; savunma: number; can: number };
  generalBonus: GeneralBonus;
  lordContribution: number;
  leadership: number;
  fortressBonus: number;
  isDefender: boolean;
  /** General yeteneklerinin sayısal karşılıkları (generals.json -> ek_etki). */
  abilities?: Record<string, number>;
}

export interface RoundLog {
  tur: number;
  saldiranGuc: number;
  savunanGuc: number;
  saldiranKayip: Army;
  savunanKayip: Army;
}

export interface BattleResult {
  winner: 'attacker' | 'defender';
  rounds: RoundLog[];
  attackerLosses: Army;
  defenderLosses: Army;
  attackerSurvivors: Army;
  defenderSurvivors: Army;
  captured: boolean;
  loot: Resources;
  seed: string;
  /**
   * Ölü sayılıp da yaralı olarak geri dönenler.
   *
   * Kayıp sayısı zaten düşülmüş hâlde dönüyor; bu alan FARKI taşıyor.
   * Olmasa sistem görünmez kalırdı: oyuncu daha az kayıp verdiğini
   * görür ama nedenini bilmezdi, bilmediği bir şey de onu rahatlatmaz.
   */
  yaraliDonen: { saldiran: Army; savunan: Army };
}

/**
 * Arayüzdeki sekmeler — TEK KAYNAK.
 *
 * Hem istemcinin sekme tipi hem sunucunun ölçüm doğrulaması buradan
 * geliyor. Ayrı tutulduğunda ne olduğunu gördük: İttifak ekranı eklendi,
 * sunucudaki liste güncellenmedi ve `/me?ekran=ittifak` 400 dönmeye
 * başladı — yani o ekranda oyuncunun kaynakları, kuyrukları ve olayları
 * hiç yüklenmedi. Hata sessizdi: ekranın kendi verisi geliyordu, eksik
 * olan çerçeveydi.
 */
/**
 * Oyundaki ekranlar.
 *
 * Liste büyüdü çünkü oyuncunun şikâyeti "her şey iç içe, karman çorman"dı:
 * Malikâne tek başına altı ayrı işi (sıradaki adım, kuyruklar, günlük
 * görevler, haftalık sefer, başarımlar, olay akışı) üst üste yığıyordu.
 * Uzun LİSTELER sorun değil — sıralama uzun olmalı; sorun tek sayfada
 * birbiriyle alâkasız işlerin toplanmasıydı.
 *
 * Kural: **bir sayfa bir iş.** Görevler ve olaylar kendi sayfalarına
 * çıktı; büyük ekranlar (Demirhane, Generaller, İttifak, Lord) kendi
 * içinde alt sekmelere bölündü.
 */
export const EKRANLAR = [
  'malikane',
  'kisla',
  'harita',
  'demirhane',
  'gorevler',
  'olaylar',
  'lord',
  'generaller',
  'siralama',
  'ittifak',
  'hesap',
] as const;

export type Ekran = (typeof EKRANLAR)[number];

/* ---------------- Arayüz mimarisi: beş sekme, gerisi kapı ---------------- */

/**
 * Alt çubuktaki BEŞ sekme.
 *
 * Oyuncu referans bir oyunu göstererek anlattı:
 *
 *   "ana sayfada nav bar ile gidebileceğimiz yerler sadece 5 tane, bunlar
 *    gün içinde en çok giriş yapılanlar. Onun dışında her şeyi 5 ana
 *    sayfanın içinde pop-up pencereleri şeklinde ayarlamış. Mesela bizde
 *    generaller ayrı bir sayfada; onun yerine Lord sekmesini ana sayfaya
 *    çevirip oraya bir general bölümü eklenebilir, tıklandığında general
 *    sayfası pop-up gibi açılır."
 *
 * Önceki yapı DÖRT sekme + "Menü" idi ve menü tam da şikâyet edilen şeydi:
 * konusuyla ilgisi olmayan yedi sayfanın düz listesi. Oyuncunun ilk
 * geri dönüşü de zaten "kafamda kategorize edemiyorum" idi.
 *
 * Ölçüt yine SIKLIK: her oturumda açılan beş yer çubukta. Lord menüden
 * çubuğa çıktı çünkü oyuncunun kendini yönettiği yer orası ve artık
 * kendine ait şeylerin (general, ekipman, sıralama, hesap) evi.
 */
export const ALT_SEKMELER = ['malikane', 'gorevler', 'kisla', 'harita', 'lord'] as const;
export type AltSekme = (typeof ALT_SEKMELER)[number];

/**
 * KAPILAR: kendi sayfası değil, konusunun içinde açılan pop-up'lar.
 *
 * Haritada bir altıgene basınca açılan bölge paneliyle aynı fikir —
 * oyuncu bulunduğu yerden kopmuyor, işini görüp kapatıyor.
 */
export const KAPILAR = [
  'olaylar',
  'ittifak',
  'generaller',
  'demirhane',
  'siralama',
  'hesap',
] as const;
export type Kapi = (typeof KAPILAR)[number];

/**
 * Her kapı KONUSUNUN evinde duruyor.
 *
 * Kural: bir şeyle ilgili her şey tek bir yerde. Lord kendine ait olanı
 * (kimi komuta ediyor, ne kuşanıyor, nerede duruyor, hesabı) taşıyor;
 * Malikâne diyara ait olanı (ne oldu, kimlerlesin).
 */
export const KAPI_EVI: Record<Kapi, AltSekme> = {
  olaylar: 'malikane',
  ittifak: 'malikane',
  generaller: 'lord',
  demirhane: 'lord',
  siralama: 'lord',
  hesap: 'lord',
};

/** Kapının başlığı — hem panelde hem onu açan düğmede aynı ad. */
export const KAPI_ADI: Record<Kapi, string> = {
  olaylar: 'Olaylar',
  ittifak: 'İttifak',
  generaller: 'Generaller',
  demirhane: 'Demirhane',
  siralama: 'Sıralama',
  hesap: 'Hesap',
};

/** Bir sekmenin içinde açılabilen kapılar, tanımdaki sırayla. */
export function sekmeninKapilari(sekme: AltSekme): Kapi[] {
  return KAPILAR.filter((k) => KAPI_EVI[k] === sekme);
}

export interface GeneralDef {
  key: string;
  ad: string;
  nadirlik: GeneralRarity;
  maliyet_altin: number;
  pasif: { ad: string; etki: string; deger: number };
  yetenek: { ad: string; aciklama: string };
  ek_etki?: { komuta_kapasitesi?: number };
}

export interface RegionDef {
  id: number;
  name: string;
  type: RegionType;
  province: string;
  q: number;
  r: number;
  ring: number;
  level: number;
  income_mult: number;
  npc_garrison: Record<UnitType, number>;
  unique: boolean;
}
