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
export const EKRANLAR = [
  'malikane',
  'kisla',
  'harita',
  'demirhane',
  'lord',
  'generaller',
  'siralama',
  'ittifak',
  'hesap',
] as const;

export type Ekran = (typeof EKRANLAR)[number];

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
