/** Oyunun tüm ortak tipleri. Sunucu ve arayüz aynı tipleri kullanır. */

export type ResourceType = 'altin' | 'demir' | 'erzak';
export type UnitType = 'milis' | 'mizrakci' | 'okcu' | 'suvari' | 'kusatma';
export type EquipSlot = 'silah' | 'kalkan' | 'zirh' | 'migfer' | 'at' | 'sancak';
export type Rarity = 'siradan' | 'usta' | 'nadir' | 'efsanevi' | 'kadim';
/**
 * `koy` en küçük yerleşim: haritanın kenarında, garnizonu çok zayıf.
 * Oyuna toprakSIZ başlandığı için (docs/12 §8) herkesin ilk fethi bir
 * köydür ve o köy başkenti olur.
 */
export type RegionType = 'koy' | 'tarla' | 'maden' | 'sehir' | 'kale' | 'taht';
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
  /**
   * Savaş öncesi düzen: 4x4 dizilim + taktik. Tipi `duzen.ts`de.
   *
   * Burada `unknown` değil gerçek tip olmamasının sebebi döngüsel
   * bağımlılık: duzen.ts balance.ts'i, balance.ts types.ts'i okuyor.
   * combat.ts içeri girerken daraltıyor.
   */
  duzen?: { dizilim: (UnitType | null)[]; taktik: string | null } | null;
  /**
   * Tamamlanmış araştırmaların savaşa etkisi. Tipi `arastirma.ts`de.
   *
   * gearBonus'a katlanmadı: o alan "ekipmandan gelen" demek ve
   * araştırmayı oraya sıkıştırmak alan adını yalancı yapardı. Bir
   * bonusun nereden geldiği raporda da lazım olacak.
   */
  arastirma?: {
    orduSaldiri: number;
    orduSavunma: number;
    kaleSavunmasi: number;
    yagma: number;
  } | null;
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
  /**
   * Dizilim ve taktiğin ne yaptığını anlatan cümleler.
   *
   * Sayı değil CÜMLE tutuluyor: oyuncunun raporda okuyacağı şey bu.
   * Ceza görünmezse ceza değildir — mancınığını ön hatta koyan oyuncu
   * bir daha koymasın diye burada yazılı duruyor.
   */
  duzenRaporu: { saldiran: string[]; savunan: string[] };
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
  'sehir',
  'akin',
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
  'arastirma',
  'hesap',
] as const;

export type Ekran = (typeof EKRANLAR)[number];

/* ---------------- Arayüz mimarisi: beş sekme, gerisi kapı ---------------- */

/**
 * Alt çubuktaki BEŞ sekme. İlki ANA SAYFA.
 *
 * Oyuncu referans bir oyunu göstererek anlattı: "nav bar ile
 * gidebileceğimiz yerler sadece 5 tane, gerisi o 5 sayfanın içinde
 * pop-up". Sonra da rolleri netleştirdi:
 *
 *   "ana sayfada her şeye erişimimiz olmalı, tüm yönlendirmeleri oradan
 *    yapabilmeliyiz. Malikâne'yi sahip olduğumuz arazi yönetimleri,
 *    ipuçları gibi içerikleri barındıran bir alana çevirip Lord sayfasını
 *    oyunun ana sayfası hâline getirirsek daha iyi olabilir."
 *
 * Öyle yapıldı. LORD ana sayfa: oyuncu oraya iniyor, "şimdi ne
 * yapmalısın" orada, bütün kapılar orada. MALİKÂNE ise diyarın kendisi:
 * sahip olunan topraklar, gelirleri, koruma durumu ve ipuçları.
 *
 * Sıra da bunu söylüyor: ana sayfa başta, sonra ordunun kurulduğu yer,
 * sonra onu KULLANDIĞIN iki yer (Akın ve Dünya), en sonda lordun
 * kendisi.
 *
 * GÖREVLER ÇUBUKTAN ÇIKTI (docs/12 §7). Günlük görevler bir sayfa
 * dolduracak kadar iş değil ve yeri belli: şehirdeki GÖREV PANOSU.
 * Yerine akın geldi — ordusu olan oyuncunun her gün gireceği yer orası.
 * Görevler kaybolmadı, kapı oldu (`KAPILAR`).
 */
export const ALT_SEKMELER = ['sehir', 'kisla', 'akin', 'harita', 'lord'] as const;
export type AltSekme = (typeof ALT_SEKMELER)[number];

/**
 * Açılışta gelinen ve bütün kapıların durduğu sekme: ŞEHİR.
 *
 * Oyuncunun ikinci düzeltmesi: "ana sayfamız şu an lord ya, onu
 * değiştirelim şehir sayfası yap; şehir haritasından oyuncu demirci,
 * lord, malikâne gibi ordan gezebilsin."
 *
 * Lord ekranı ana sayfayken kapılar bir IZGARAYDI — yan yana düğmeler.
 * Oyuncu "demirhaneye gitmiyor", bir düğmeye basıyordu. Kapıların hepsi
 * duruyor; sadece girişleri bir listeden bir BİNAYA döndü. Lord ekranı
 * da hak ettiği şeye dönüştü: bir karakter sayfası.
 */
export const ANA_SEKME: AltSekme = 'sehir';

/**
 * KAPILAR: kendi sayfası değil, ana sayfadan açılan pop-up'lar.
 *
 * Haritada bir altıgene basınca açılan bölge paneliyle aynı fikir —
 * oyuncu bulunduğu yerden kopmuyor, işini görüp kapatıyor.
 *
 * Hepsinin girişi ANA SAYFADA: oyuncunun isteği "ana sayfada her şeye
 * erişimimiz olmalı" idi. Bir kapı başka bir ekrandan da açılabilir
 * (Malikâne'deki olay kartı gibi) — kapı sekmeye bağlı değil, nereden
 * açılırsa açılsın oyuncu kapatınca kaldığı yerde kalıyor.
 */
export const KAPILAR = [
  'malikane',
  'gorevler',
  'generaller',
  'demirhane',
  'arastirma',
  'ittifak',
  'olaylar',
  'siralama',
  'hesap',
] as const;
export type Kapi = (typeof KAPILAR)[number];

/** Kapının başlığı — hem panelde hem onu açan düğmede aynı ad. */
export const KAPI_ADI: Record<Kapi, string> = {
  malikane: 'Malikâne',
  gorevler: 'Görev Panosu',
  generaller: 'Generaller',
  arastirma: 'Araştırma',
  demirhane: 'Demirhane',
  ittifak: 'İttifak',
  olaylar: 'Olaylar',
  siralama: 'Sıralama',
  hesap: 'Hesap',
};
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
  /** Harita resmi üzerindeki yüzdelik yer. YALNIZ çizim için (harita.ts). */
  x: number;
  y: number;
  /** Bitişik bölgelerin kimlikleri. Mesafe ve komşuluk buradan gelir. */
  komsular: number[];
  level: number;
  income_mult: number;
  npc_garrison: Record<UnitType, number>;
  unique: boolean;
}
