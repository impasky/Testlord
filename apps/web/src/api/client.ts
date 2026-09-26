import { ts } from '../lib/dil';
/** Tipli API istemcisi. Sunucu tek otoritedir; istemci hiçbir sayı yazmaz. */
import type {
  AkinHaritaDurumu,
  ArastirmaCagi,
  ArastirmaDurumu,
  Army,
  BasarimOlcutleri,
  BinaDurumu,
  Dizilim,
  Kademe,
  GunlukGorev,
  ProfilResmi,
  GearLineKey,
  Resources,
  SavasDuzeni,
  StatKey,
  TaktikDurumu,
} from '@lordlar/shared';

export type { AkinGrupDurumu, AkinHaritaDurumu, BinaDurumu, Kademe } from '@lordlar/shared';

/**
 * API adresi.
 *
 * Üretimde (tek servisli dağıtım) API arayüzle AYNI origin'den sunulur, bu
 * yüzden göreli yol kullanılır — port yazmak yanlış olur.
 *
 * Geliştirmede arayüz Vite'ta (5173), API ayrı süreçte (3000) çalışır; adres
 * sayfanın açıldığı host'tan türetilir. Sabit 'localhost' yazsaydık telefondan
 * açıldığında 'localhost' telefonun KENDİSİ olurdu ve hiçbir istek gitmezdi.
 *
 * VITE_API_URL verilirse her ikisini de geçersiz kılar.
 */
const BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:3000` : '');

const TOKEN_KEY = 'lordlar_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* gizli sekmede localStorage kapalı olabilir; oturum yine de çalışır */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  /**
   * Content-Type YALNIZCA gövde varken gönderiliyor.
   *
   * Fastify, `application/json` başlığı görüp gövde bulamazsa isteği
   * 400 ile reddediyor: "Body cannot be empty when content-type is set
   * to 'application/json'". Başlık koşulsuz eklendiği için gövdesiz her
   * DELETE sessizce çalışmıyordu — yürüyüşü geri çağırmak ve araştırmayı
   * iptal etmek dahil. Oyuncunun gördüğü şey "geri çağır'a bastım, ordu
   * hâlâ saldırıyor" idi.
   *
   * Bu tuzak POST tarafında bir kez yakalanıp `post` yardımcısında boş
   * nesne göndererek çözülmüştü (aşağıdaki nota bak) ama DELETE aynı
   * yoldan geçmiyordu. Düzeltme artık taşıyıcıda: hangi yöntem olursa
   * olsun gövde yoksa başlık da yok.
   */
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  const body = text ? cevrilmis(JSON.parse(text)) : null;

  if (!res.ok) {
    throw new ApiError(body?.error ?? 'Bilinmeyen bir hata oluştu.', res.status, body?.code);
  }
  return body as T;
}

/**
 * Sunucudan gelen METİNLERİ çevirir — API'ye hiç dokunmadan.
 *
 * ── Neden burada, neden sunucuda değil ──────────────────────────────
 *
 * Sunucu Türkçe üretiyor ve öyle kalıyor: dil bilgisini her isteğe
 * eklemek, her uçta çeviri yapmak ve sunucuda ikinci bir sözlük
 * taşımak gerekmiyor. Bunu mümkün kılan şey anahtarın Türkçe metnin
 * ÖZETİ olması — istemci, gelen Türkçeyi kendi sözlüğünde
 * bulabiliyor.
 *
 * ── Neden yanıtın tamamı taranıyor ──────────────────────────────────
 *
 * Sunucu metni tek bir alanda durmuyor: hata mesajı, olay akışı,
 * yerleşim adı, savaş raporu satırları, ittifak günlüğü… Alan alan
 * seçmek, her yeni uçta unutulacak bir liste demekti. Tarama
 * güvenli, çünkü `ts()` YALNIZ sözlükte karşılığı olan metni
 * değiştiriyor; lord adı, bölge adı, kimlik ve sayı olduğu gibi
 * geçiyor.
 *
 * Türkçe oynarken sözlük boş ve `ts()` her metni olduğu gibi
 * döndürüyor — bu yol o durumda yalnız bir nesne kopyası.
 */
function cevrilmis<T>(veri: T): T {
  if (typeof veri === 'string') return ts(veri) as T;
  if (Array.isArray(veri)) return veri.map(cevrilmis) as T;
  if (veri && typeof veri === 'object') {
    const sonuc: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(veri)) sonuc[k] = cevrilmis(v);
    return sonuc as T;
  }
  return veri;
}

// Content-Type application/json gönderip gövdeyi boş bırakmak sunucuda 400
// üretir. Gövde istemeyen uçlar (kuşan, sat, yükselt, kirala) için boş nesne
// göndeririz — aksi halde bu işlemlerin hiçbiri arayüzden çalışmaz.
const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export interface LordState {
  /** Heraldik kimlik ve unvan — ikisi de saf görünüş (docs/10). */
  arma: ArmaDto;
  /** Profil resmi: arma, hazır portre ya da onaylanmış yüklenen resim. */
  resim: ProfilResmi;
  unvan: { ad: string; aciklama: string; sonrakiEsik: number | null; sonrakiAd: string | null };
  id: string;
  name: string;
  level: number;
  xp: number;
  xpForNext: number;
  stats: Record<StatKey, number>;
  statPoints: number;
  resources: Resources;
  storageCapacity: number;
  /** Bina seviyeleri: kapasiteler sunucuyla aynı fonksiyondan hesaplanıyor. */
  binalar: Record<string, number>;
  /** Hastanede tedavi bekleyenler. Orduya ve komuta kapasitesine dahil değil. */
  hastane: Army;
  /** Oyunda kazanılan para birimi; yalnız ZAMAN kısaltıyor (docs/12 §6). */
  elmas: number;
  /** Lordun medeniyeti (docs/16) — sistemden önceki lordlarda null. */
  medeniyet: { id: string; ad: string; renk: string; ozet: string } | null;
  /** Kolektif eylemin kişisel karşılığı (docs/16 §9). Güç satın almaz. */
  faydaPuani: number;
  /** Fayda puanından türeyen rütbe (docs/16 §9). */
  faydaRutbesi: FaydaRutbeDto;
  hourlyIncome: Resources;
  upkeepPerHour: number;
  netErzakPerHour: number;
  starving: boolean;
  fame: number;
  elo: number;
  pvpWins: number;
  pvpLosses: number;
  homeArmy: Army;
  commandCapacity: number;
  usedSlots: number;
  maxRegions: number;
  regionCount: number;
  ownsThrone: boolean;
  generalSlots: number;
  equipmentPower: number;
  lordContribution: number;
  /** Kuşanılan eşyalar — sunucu /me içinde döndürüyor. */
  equippedItems: { slot: string; tier: number; rarity: string; upgradeLevel: number }[];
  gearLines: Record<GearLineKey, number>;
  gearBonus: { saldiri: number; savunma: number; can: number };
  woundedUntil: string | null;
  protectionUntil: string | null;
  dailyAttacks: number;
  /** Öğreticiyi görüp görmediği — tam ekran tanıtım buna bakarak açılır. */
  ogreticiGorundu: boolean;
  /** İlk akınını kazandı mı — rehberin akın aşaması buna bakıyor. */
  akinYapti: boolean;
  /** Şu an sahada bir akın var mı. */
  akindaOrduVar: boolean;
  /** Evde olmayan asker: akında, yolda, bölge garnizonlarında. */
  disaridakiOrdu: { akin: number; yolda: number; garnizon: number };
  /** Rehberi (kâhya kartı + rehber ışığı) kapattı mı. */
  rehberGorundu: boolean;
  /** Başarım ölçütleri; başarımlar bunlardan `basarimlar()` ile türetilir. */
  basarimOlcutleri: BasarimOlcutleri;
}

export interface QueueItem {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  startedAt: string;
  finishAt: string;
}

export interface GameEvent {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MeResponse {
  lord: LordState;
  queues: QueueItem[];
  events: GameEvent[];
  /** Oyuncu bir süredir yoksa dönüş özeti; kısa aradan sonra null. */
  yokluk: YoklukOzeti | null;
  serverTime: string;
}

export interface YoklukOzeti {
  baslangic: string;
  sureSaniye: number;
  olaylar: number;
  savaslar: number;
}

export interface ItemDto {
  id: string;
  slot: string;
  tier: number;
  rarity: string;
  upgradeLevel: number;
  equipped: boolean;
  power: number;
  upgradeCost: Resources | null;
  upgradeChance: number | null;
  sellValue: number;
}

/* ---------------- Eşya pazarı (docs/19) ---------------- */

/** Alınıp satılan şey: yuva + kademe + nadirlik + yükseltme. */
export interface UrunDto {
  slot: string;
  tier: number;
  rarity: string;
  upgradeLevel: number;
}

export interface PazarBandiDto {
  alt: number;
  ust: number;
  altFiyat: number;
  ustFiyat: number;
}

export interface PazarEmriDto {
  id: string;
  urun: UrunDto;
  ad: string;
  basamak: number;
  fiyat: number;
  /** Bant dışına düşmüş emir eşleşmiyor; fiyatını güncellemek gerekiyor. */
  bantta: boolean;
  bant: PazarBandiDto;
  /** Yalnız ilanda: kayıt kuyruğunun bitişi. */
  kuyrukBitis?: string | null;
}

export interface EsyaPazariDto {
  kasa: number;
  altin: number;
  depoTavani: number;
  depoBos: number;
  vergi: number;
  tavan: { ilan: number; siparis: number; gunluk: number; bugun: number };
  ilanlarim: PazarEmriDto[];
  siparislerim: PazarEmriDto[];
  emanette: number;
  esyalarim: {
    id: string;
    urun: UrunDto;
    ad: string;
    guc: number;
    npcDegeri: number;
    yukseltiliyor: boolean;
  }[];
  vitrin: {
    urun: UrunDto;
    ad: string;
    adet: number;
    kuyrukta: number;
    enUcuz: number | null;
    guc: number;
  }[];
  aranan: { urun: UrunDto; ad: string; adet: number; enYuksek: number; guc: number }[];
}

export interface DefterSatiriDto {
  basamak: number;
  fiyat: number;
  satici: number;
  alici: number;
  taban: boolean;
}

export interface UrunDefteriDto {
  urun: UrunDto;
  ad: string;
  guc: number;
  formul: number;
  npcDegeri: number;
  taban: { basamak: number; fiyat: number };
  bant: PazarBandiDto;
  defter: DefterSatiriDto[];
  kuyrukta: { adet: number; enErken: string | null };
  kayitKuyrugu: boolean;
  kuyrukSuresiDk: number;
  enUcuzIlan: { basamak: number; fiyat: number } | null;
  enYuksekSiparis: { basamak: number; fiyat: number } | null;
  sonIslemler: { fiyat: number; createdAt: string; slot: string; kura: boolean }[];
  benimIlan: {
    id: string;
    basamak: number;
    fiyat: number;
    kuyrukBitis: string | null;
    bantta: boolean;
  } | null;
  benimSiparis: { id: string; basamak: number; fiyat: number; bantta: boolean } | null;
  kilit: { gerekenSeviye: number } | null;
  vergi: number;
}

export interface IlanSonucuDto {
  durum: 'satildi' | 'listede' | 'kuyrukta';
  fiyat: number;
  vergi?: number;
  net?: number;
  kuyrukBitis?: string | null;
}

export interface SiparisSonucuDto {
  durum: 'alindi' | 'bekliyor';
  fiyat: number;
  itemId?: string;
}

export interface TierDto {
  tier: number;
  unlockLevel: number;
  unlocked: boolean;
  /** Kilidin SEBEBİ ayrı ayrı: "Sv50" mi "Demirhane 4" mü eksik? */
  seviyeYetiyor: boolean;
  demirhaneYetiyor: boolean;
  gerekenDemirhane: number;
  cost: Resources;
  durationSec: number;
  rarityTable: Record<string, number>;
}

export interface UnitDto {
  type: string;
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

export interface ArmyDto {
  home: Army;
  byLocation: {
    unitType: string;
    count: number;
    locationType: string;
    locationId: string | null;
  }[];
  commandCapacity: number;
  usedSlots: number;
  upkeepPerHour: number;
  netErzakPerHour: number;
  units: UnitDto[];
}

export interface GearDto {
  line: GearLineKey;
  ad: string;
  etki: string;
  level: number;
  maxLevel: number;
  bonus: number;
  nextCost: { altin: number; demir: number; sec: number } | null;
}

export interface RegionDto {
  id: number;
  name: string;
  type: string;
  province: string;
  /** Harita resmi üzerindeki yüzdelik yer. YALNIZ çizim için. */
  x: number;
  y: number;
  /** Bitişik bölgelerin kimlikleri. Mesafe ve komşuluk buradan gelir. */
  komsular: number[];
  level: number;
  incomeMult: number;
  owner: { id: string; name: string; level: number } | null;
  isMine: boolean;
  /**
   * Bu bölgenin gelirinden bana düşen pay (docs/16 §6) — garnizonum
   * yoksa null.
   *
   * Sunucudan geliyor, ekranda HESAPLANMIYOR. Bu projenin tekrar eden
   * hatası aynı sayının iki yerde ayrı hesaplanması: bölge kartı bir
   * zamanlar vilayet birliğini saymadığı için oyuncuya aldığından
   * %8-30 az gelir yazıyordu.
   */
  pay: { oran: number; yer: number; toplamYer: number } | null;
  /** Bölgeyi TUTAN medeniyet (docs/16 §2) — çekişmeli bölgelerde null. */
  medeniyet: { id: string; ad: string; renk: string } | null;
  /** Ele geçirilemeyen çekirdek mi (docs/16 §5). */
  cekirdek: boolean;
  shielded: boolean;
  distance: number;
  /** Sahibinin ittifakıyla saldırmazlık paktım var mı (docs/09 B1d). */
  paktli?: boolean;
  /** Sahibi ittifak arkadaşım mı — saldırılamaz, takviye gönderilebilir. */
  muttefik?: boolean;
  fortressBonus: number;
}

/** Bir çekirdek bölgenin yatırım durumu (docs/16 §7). */
export interface CekirdekDto {
  mapId: number;
  ad: string;
  /** Taşıdığı bonus — başkent çekirdeğinde null. */
  bonus: 'ambar' | 'talimgah' | 'sur' | 'ocak' | null;
  bonusAdi: string | null;
  seviye: number;
  azamiSeviye: number;
  /** Bir sonraki seviyenin bedeli — tavandaysa null. */
  maliyet: { altin: number; demir: number; erzak: number } | null;
  biriken: { altin: number; demir: number; erzak: number };
}

/** Lordun medeniyeti ve o medeniyetin durumu (docs/16). */
export interface MedeniyetDto {
  id: string;
  ad: string;
  renk: string;
  uyeSayisi: number;
  bolgeSayisi: number;
  faydaPuanim: number;
  /** Puandan türeyen rütbe — puan harcanmıyor, birikiyor (docs/16 §9). */
  rutbe: FaydaRutbeDto;
  /** Taraf değiştirme kuralları ve şu an geçilebilecek medeniyetler. */
  degisim: {
    kalanGun: number;
    /** Yoldaki ordu varken değişim reddediliyor — önceden söylensin. */
    orduYolda: boolean;
    faydaSifirlanir: boolean;
    beklemeGun: number;
    secenekler: { id: string; ad: string; renk: string; ozet: string }[];
  };
  cekirdekler: CekirdekDto[];
  siralama: { id: string; ad: string; renk: string; bolge: number }[];
}

/** Fayda puanından türeyen rütbe (docs/16 §9). */
export interface FaydaRutbeDto {
  ad: string;
  aciklama: string;
  sonrakiEsik: number | null;
  sonrakiAd: string | null;
}

/** Bir paktın oyuncuya görünen hâli. */
export interface PaktSatiriDto {
  id: string;
  ittifakId: string;
  ad: string;
  etiket: string;
  durum: 'teklif' | 'yururlukte' | 'feshediliyor' | 'bitti';
  /** Fesih sürerken paktın hâlâ koruduğu süre. */
  kalanSn: number | null;
  benMiFeshettim: boolean;
}

export interface PaktlarDto {
  ittifakim: string | null;
  yururlukte: PaktSatiriDto[];
  gelen: PaktSatiriDto[];
  giden: PaktSatiriDto[];
  azami: number;
  ihbarSaat: number;
  liderMiyim: boolean;
}

export interface MapDto {
  /** Kampın çıpası: hangi bölgenin yanında durduğu. */
  homeBolgeId: number;
  maxRegions: number;
  oneri: HedefOnerisiDto | null;
  /** İttifakın ortak hedefi — varsa haritada işaretli. */
  ittifakHedefi: { regionId: number; not: string | null; etiket: string } | null;
  regions: RegionDto[];
}

export interface RegionDetailDto extends RegionDto {
  /** Bölge benim başkentim mi. */
  baskentim: boolean;
  garrison: Army;
  /** Bu bölgede duran KENDİ askerin — takviye gönderdiysen dolu. */
  kendiGarnizonum: Army;
  /** Bölge sahibi ittifak arkadaşım mı. */
  muttefik: boolean;
  /**
   * Sahibinin ittifakıyla paktım var mı.
   *
   * Müttefiklikten ayrı: paktlıya saldıramıyorum ama takviye de
   * gönderemiyorum, garnizonunu da göremiyorum.
   */
  paktli?: boolean;
  garrisonVisible: boolean;
  /** Garnizon bilgisi güncel mi. Eski keşif raporu görünür ama güvenilmez. */
  garrisonTaze: boolean;
  /** Keşif raporu — casus gönderilmişse. */
  kesif: {
    eski: boolean;
    yasSn: number;
    store: Resources | null;
    tahkimatBonusu: number | null;
    bolgeSeviyesi: number | null;
  } | null;
  kesifMaliyeti: number;
  kesifSuresiSn: number;
  upgradeCost: { altin: number; demir: number; sec: number } | null;
  store: Resources | null;
  npcGarrison: Army;
}

/** "Bu bölgeyi alırsan ne olur" — motorun hesapladığı gerçek sayılar. */
export interface FetihOduluDto {
  saatlikGelir: Resources & { sohret: number };
  toplamGelirOncesi: Resources;
  toplamGelirSonrasi: Resources;
  sohretOncesi: number;
  sohretSonrasi: number;
  siraOncesi: number;
  siraSonrasi: number;
  xp: number;
  bolgeOncesi: number;
  bolgeSonrasi: number;
  bolgeLimiti: number;
  limitDolu: boolean;
}

export interface PreviewDto {
  tahmin: {
    kazanan: 'attacker' | 'defender';
    eleGecirir: boolean;
    saldiranKayip: Army;
    savunanKayip: Army;
    yagma: Resources;
    /** Dokuz savaşın kaçı zaferle / fetihle bitti (0–1). */
    kazanmaOrani: number;
    fetihOrani: number;
  };
  odul: FetihOduluDto;
  bedel: {
    yenidenEgitim: Resources;
    yenidenEgitimSn: number;
    kayipBirim: number;
  };
  istihbaratKesin: boolean;
  marchSec: number;
  /** İlk saldırı kısayolu uygulandı mı — süre neden bu kadar kısa. */
  ilkSaldiri: boolean;
  donusSec: number;
  not: string;
}

/** Dünya özeti: kaç lord var, taht kimde, ben kaçıncıyım. */
/** Kayıt ekranındaki diyar listesi — kimlik gerektirmeyen tek uç. */
export interface DiyarSecimiDto {
  /** Seçim yapılmazsa kaydın gideceği diyar. Hiç diyar yoksa null. */
  onerilen: string | null;
  aktifGun: number;
  diyarlar: {
    id: string;
    ad: string;
    lordSayisi: number;
    kapasite: number;
    aktifLord: number;
  }[];
}

export interface DunyaDto {
  ad: string;
  /** İlan edilmiş diyar birleşmesi. Yoksa null. */
  birlesme: {
    karsiDiyar: string;
    /** Bu diyar taşınan taraf mı, yoksa kalan taraf mı. */
    konukMuyum: boolean;
    birlesmeAt: string;
  } | null;
  kapasite: number;
  lordSayisi: number;
  aktifLord: number;
  aktifGun: number;
  bolgeSayisi: number;
  benimSiram: number;
  benimSohretim: number;
  taht: {
    regionId: number;
    name: string;
    sahip: { id: string; name: string } | null;
    sohretBonusu: number;
    /** Tahtı TUTAN medeniyet (docs/16 §13 soru 5) — sahipsizse null. */
    medeniyet: { id: string; ad: string; renk: string } | null;
    /** O medeniyetin her üyesine işleyen şöhret çarpanı. */
    medeniyetSohretBonusu: number;
    /** Taht benim medeniyetimde mi. */
    benimMedeniyetimde: boolean;
  } | null;
  /** Lider avı — kartopu freni. Dünya çok küçükse null. */
  liderAvi: {
    lordId: string;
    ad: string;
    sohret: number;
    yagmaBonusu: number;
    /** Lider bensem işaret farklı okunmalı: av benim üstümde. */
    benMiyim: boolean;
  } | null;
  /**
   * Fraksiyon lider avı (docs/16 §10) — önde giden medeniyet yoksa null.
   *
   * Bireysel lider avından AYRI bir alan: biri bir lordu, öbürü bir
   * tarafı işaret ediyor ve ikisi üst üste binebiliyor.
   */
  medeniyetAvi: {
    /** Denge anahtarı ("demirocagi") — bölge kartındaki `medeniyet.id` ile aynı. */
    medeniyetId: string;
    ad: string | null;
    renk: string | null;
    /** Tutulan topraktaki payı (0-1). */
    pay: number;
    yagmaBonusu: number;
    /** Önde giden benim medeniyetimse cümle tersine dönüyor. */
    benimMi: boolean;
  } | null;
  olaylar: {
    id: string;
    zaman: string;
    bolgeId: number;
    bolge: string;
    saldiran: string;
    savunan: string | null;
    saldiranKazandi: boolean;
    eleGecti: boolean;
  }[];
}

/** Bir eşyayı kuşanmanın gerçek karşılığı — savaşa yansıması dahil. */
export interface EkipmanEtkisiDto {
  katkiOncesi: number;
  katkiSonrasi: number;
  sohretOncesi: number;
  sohretSonrasi: number;
  hedef: { regionId: number; name: string } | null;
  neden: 'ordu_yok' | 'ordu_yolda' | 'hedef_yok' | null;
  kayipOncesi: number;
  kayipSonrasi: number;
  kazanirOncesi: boolean;
  kazanirSonrasi: boolean;
}

/** Haritanın önerdiği hedef: "şimdi neye saldırmalıyım" sorusunun cevabı. */
export interface HedefOnerisiDto {
  regionId: number;
  name: string;
  type: string;
  level: number;
  distance: number;
  marchSec: number;
  ilkSaldiri: boolean;
  orduVar: boolean;
  kazanir: boolean;
  darZafer: boolean;
  /** Bölgeyi almak için gereken ek birim; ordu yeterliyse null. */
  eksik: {
    birim: string;
    adet: number;
    maliyet: Resources;
    karsilanabilir: boolean;
  } | null;
  kalanBirim: number;
  garrison: Army;
  saatlikGelir: Resources & { sohret: number };
  sohretFarki: number;
  limitDolu: boolean;
}

export interface GeneralDto {
  key: string;
  ad: string;
  nadirlik: string;
  maliyet_altin: number;
  pasif: { ad: string; etki: string; deger: number };
  yetenek: { ad: string; aciklama: string };
  sahipMi: boolean;
  level: number;
  xp: number;
  xpForNext: number;
  slotIndex: number | null;
  dinleniyor: string | null;
  etkinDeger: number;
}

export interface RankingRow {
  arma: ArmaDto;
  unvan: string;
  sira: number;
  lordId: string;
  name: string;
  level: number;
  deger: number;
  bolgeSayisi: number;
  tahtSahibi: boolean;
}

export interface RankingDto {
  board: 'fame' | 'conquest' | 'elo';
  toplam: number;
  sayfa: number;
  satirlar: RankingRow[];
  benim: RankingRow | null;
}

export interface MarchDto {
  id: string;
  toRegionId: number;
  kind: string;
  army: Army;
  departAt: string;
  arriveAt: string;
}

export interface BattleDto {
  id: string;
  regionId: number;
  result: string;
  captured: boolean;
  createdAt: string;
  seed: string;
  attackerLordId: string;
  defenderLordId: string | null;
  attacker: { name: string };
  defender: { name: string } | null;
  log: {
    rounds: { tur: number; saldiranGuc: number; savunanGuc: number }[];
    attackerLosses: Army;
    defenderLosses: Army;
    attackerSurvivors: Army;
    defenderSurvivors: Army;
    loot: Resources;
    regionName: string;
    /** Savaş anındaki tahkimat bonusu. Eski savaşlarda yok. */
    tahkimatBonusu?: number;
    /** Sahadaki generaller. Eski savaşlarda yok — arayüz bunu tolere eder. */
    attackerGenerals?: GeneralKatkisiDto[];
    defenderGenerals?: GeneralKatkisiDto[];
    /** Bu savaşta seviye atlayanlar. Eski savaşlarda yok. */
    attackerGeneralYukselisleri?: GeneralYukselisiDto[];
    defenderGeneralYukselisleri?: GeneralYukselisiDto[];
    /** Ölü sayılıp yaralı dönenler. Eski savaşlarda yok. */
    yaraliDonen?: { saldiran: Army; savunan: Army };
    /**
     * Dizilim ve taktiğin ne yaptığı — motorun ürettiği hazır cümleler.
     * Düzen sisteminden önceki savaşlarda yok; arayüz bunu tolere ediyor.
     */
    duzenRaporu?: { saldiran: string[]; savunan: string[] };
    /** Savaşın iki tarafta ne değiştirdiği. Eski savaşlarda yok. */
    sonuc?: {
      saldiran: LordOzetiDto;
      savunan: LordOzetiDto | null;
    };
  };
}

export interface LordAnlikDto {
  sohret: number;
  sira: number;
  seviye: number;
  gelir: Resources;
  bolgeSayisi: number;
}

export interface LordOzetiDto {
  oncesi: LordAnlikDto;
  sonrasi: LordAnlikDto;
}

/** Bu savaşta seviye atlayan bir general. */
export interface GeneralYukselisiDto {
  key: string;
  ad: string;
  onceki: number;
  sonraki: number;
  kazanilanXp: number;
}

export interface GunlukDto {
  gorevler: GunlukGorev[];
  seri: number;
  bugunIlk: boolean;
  odul: {
    kaynak: Resources;
    seriCarpani: number;
    hakEdildi: boolean;
    alindi: boolean;
  };
}

export interface GunlukOdulDto {
  /** Hak edilen ödül. */
  odul: Resources;
  /** Depo tavanından sonra gerçekten verilen. */
  verilen: Resources;
  kirpildi: boolean;
  seri: number;
  kaynaklar: Resources;
}

export interface SeferDto {
  sefer: {
    key: string;
    ad: string;
    aciklama: string;
    olcut: string;
    hedef: number;
    birim: string;
    simdi: number;
    tamam: boolean;
    gecenGun: number;
    kalanGun: number;
  };
  odul: { kaynak: Resources; hakEdildi: boolean; alindi: boolean };
}

export interface SeferOdulDto {
  odul: Resources;
  verilen: Resources;
  kirpildi: boolean;
  kaynaklar: Resources;
}

export interface IttifakUyesiDto {
  id: string;
  ad: string;
  seviye: number;
  sohret: number;
  elo: number;
  arma: ArmaDto;
  unvan: string;
  lider: boolean;
  rutbe: 'lider' | 'yasli' | 'uye';
  /** Bu hafta ittifaka ne kattı — "kim taşıyor, kim taşınıyor". */
  haftalikKatki: number;
}

export interface IttifakSeviyeDto {
  seviye: number;
  xp: number;
  seviyedeXp: number;
  sonrakiEsik: number | null;
}

export interface IttifakAyricalikDto {
  ticaretTavani: number;
  takviyeHizi: number;
  kesifIndirimi: number;
  paktSlotu: number;
}

export interface BagisDto {
  maliyet: Resources;
  kazandiracakXp: number;
  odul: { xp: number };
  gunlukHak: number;
  kalanHak: number;
  kaynaklarim: Resources;
  seviye: IttifakSeviyeDto;
  ayricaliklar: IttifakAyricalikDto;
  /** Sonraki seviyede ne değişecek — bağışın SEBEBİ bu. */
  sonrakiAyricaliklar: IttifakAyricalikDto | null;
}

export interface BagisSonucuDto {
  bagislandi: boolean;
  xp: number;
  odul: { xp: number };
  seviye: IttifakSeviyeDto;
  seviyeAtladi: boolean;
  kalanHak: number;
}

/** Sıralama listesindeki bir ittifak satırı. */
export interface IttifakListesiDto {
  id: string;
  ad: string;
  etiket: string;
  uyeSayisi: number;
  toplamSohret: number;
  /** İttifak seviyesi — birlikte ne kadar yol aldıkları. */
  seviye: number;
  benimki: boolean;
  /** Kapı: "acik" doğrudan girilir, "basvuru" lider onaylar. */
  katilim: 'acik' | 'basvuru';
  /** İstenen en düşük lord seviyesi. 1 = eşik yok. */
  asgariSeviye: number;
  /** Bu ittifağa bekleyen başvurum varsa kimliği — geri çekmek için. */
  basvurumId: string | null;
  /** İttifak arması. Lord armasıyla aynı beş anahtar, aynı çizici. */
  arma: ArmaDto;
}

export interface IttifakDto {
  ittifakim: {
    id: string;
    ad: string;
    etiket: string;
    liderId: string;
    kurulus: string;
    uyeler: IttifakUyesiDto[];
    toplamSohret: number;
    azamiUye: number;
    seviye: IttifakSeviyeDto;
    ayricaliklar: IttifakAyricalikDto;
    duyuru: string | null;
    katilim: 'acik' | 'basvuru';
    asgariSeviye: number;
    /** Bekleyen başvuru sayısı — liderin ekranındaki tek "yapılacak iş" sayacı. */
    bekleyenBasvuru: number;
    arma: ArmaDto;
    hedef: {
      regionId: number;
      ad: string;
      tip: string;
      seviye: number;
      sahipsiz: boolean;
      not: string | null;
      an: string | null;
    } | null;
  } | null;
  liste: IttifakListesiDto[];
  altin: number;
  kurmaMaliyeti: number;
  azamiUye: number;
  /** İttifaktan yeni ayrıldıysa kalan bekleme. */
  bekleme: { kalanSn: number } | null;
  basvuru: {
    /** Şu an açık olan başvurularım. */
    acik: number;
    azami: number;
    mesajEnFazla: number;
    azamiAsgariSeviye: number;
  };
}

export interface IttifakSiralamaSatiri {
  sira: number;
  id: string;
  ad: string;
  etiket: string;
  arma: ArmaDto;
  seviye: number;
  uyeSayisi: number;
  toplamSohret: number;
  bolgeSayisi: number;
  benimki: boolean;
}

export interface IttifakSiralamaDto {
  toplam: number;
  sayfa: number;
  sayfaBoyu: number;
  satirlar: IttifakSiralamaSatiri[];
  benim: IttifakSiralamaSatiri | null;
}

/** Başka bir ittifağın DIŞARIYA açık hâli. Kayıt defteri, bağışlar,
 *  ortak hedef ve paktlar burada YOK: onlar ittifağın iç bilgisi. */
export interface IttifakInceleDto {
  id: string;
  ad: string;
  etiket: string;
  arma: ArmaDto;
  kurulus: string;
  liderId: string;
  seviye: IttifakSeviyeDto;
  ayricaliklar: IttifakAyricalikDto;
  katilim: 'acik' | 'basvuru';
  asgariSeviye: number;
  azamiUye: number;
  duyuru: string | null;
  toplamSohret: number;
  uyeler: {
    id: string;
    ad: string;
    seviye: number;
    sohret: number;
    arma: ArmaDto;
    rutbe: string;
    unvan: string;
  }[];
  benimki: boolean;
  basvurumId: string | null;
  /** "Katılabilir miyim" sorusunun cevabı — kural sunucuda, tek kopya. */
  katilabilirMiyim: { olur: boolean; sebep?: string };
}

export interface IttifakKayitDto {
  kayitlar: { an: string; kind: string; mesaj: string }[];
}

export interface BasvurularDto {
  yonetebilir: boolean;
  lider?: boolean;
  katilim?: 'acik' | 'basvuru';
  asgariSeviye?: number;
  /** Kalan üye kontenjanı — doluysa kabul düğmesi anlamsız. */
  bosYer?: number;
  azamiAsgariSeviye?: number;
  basvurular: {
    id: string;
    mesaj: string | null;
    createdAt: string;
    lord: { id: string; ad: string; seviye: number; sohret: number; arma: ArmaDto };
  }[];
}

/** Bir mesajın yazarı — adı, resmi ve arması (resim yoksa arma çizilir). */
export interface YazarDto {
  lordId: string;
  ad: string;
  resim: ProfilResmi;
  arma: ArmaDto;
}

export interface SohbetMesajiDto extends YazarDto {
  id: string;
  metin: string;
  /** Yönetici kaldırdı ya da şikâyet eşiği aştı: metin yerine bir not var. */
  kaldirildi: boolean;
  an: string;
}

export interface SohbetDto {
  mesajlar: SohbetMesajiDto[];
  enFazlaHarf: number;
}

export interface GenelSohbetDto {
  mesajlar: (SohbetMesajiDto & { ittifak: string | null; benim: boolean })[];
  enFazlaHarf: number;
  ikiMesajArasiSn: number;
}

/**
 * Profil kartı: ada ya da resme dokununca. Yalnız oyunun zaten herkese
 * gösterdiği şeyler — kaynak, ordu, e-posta, son görülme YOK.
 */
export interface ProfilKartiDto extends YazarDto {
  seviye: number;
  sohret: number;
  unvan: string;
  medeniyet: { ad: string; renk: string } | null;
  faydaRutbesi: string | null;
  ittifak: { ad: string; etiket: string; rutbe: 'lider' | 'yasli' | 'uye' | null } | null;
  bolgeSayisi: number;
  diyar: string;
  katildi: string;
  rakip: boolean;
  benim: boolean;
  engelledin: boolean;
}

export interface ProfilResmimDto {
  secili: ProfilResmi;
  yuklemeler: { id: string; durum: 'onayli' | 'inceleme'; an: string; adres: string }[];
  kalanYukleme: number;
}

export interface ResimYuklemeDto {
  id: string | null;
  durum: 'onay' | 'inceleme' | 'red';
  metin: string;
}

export interface OnayBekleyenResimDto {
  id: string;
  lordId: string;
  ad: string;
  an: string;
  adres: string | null;
  tahmin: Record<string, number> | null;
  sikayet: number;
}

/**
 * Yüklenmiş bir profil resminin adresi. Herkese açık uç: `<img>` jeton
 * gönderemiyor ve onaylı resim zaten herkese görünen bir içerik.
 */
export function profilResmiAdresi(id: string): string {
  return `${BASE}/api/profil-resmi/${id}`;
}

export interface ModerasyonDurumuDto {
  yonetici: boolean;
  /** Bekleyen şikâyet sayısı. Yalnız yöneticide dolu. */
  bekleyen: number;
  susturulmus: boolean;
  susturmaMetni: string | null;
  epostaDogrulandi: boolean;
  dogrulamaMetni: string | null;
  dogrulamaKalanGun: number | null;
}

export interface KuyrukSatiriDto {
  id: string;
  tur: 'lord' | 'mesaj' | 'genel' | 'resim';
  an: string;
  sebep: string;
  durum: string;
  karar: string | null;
  sikayetEden: string;
  hedefId: string;
  hedef: string;
  hedefSusturulmus: boolean;
  mesaj: { id: string; metin: string; an: string; silinmis: boolean; gizli: boolean } | null;
  /** Resim şikâyetinde resmin kendisi — kaldırılmışsa adres boş. */
  resim: { id: string; adres: string | null; durum: string } | null;
  gecmis: { ozet: string; an: string }[];
}

/* ---------------- Yönetici paneli ---------------- */

export interface YoneticiAyarlariDto {
  susturmaSureleri: { saat: number; metin: string }[];
  yasakSureleri: { saat: number; metin: string }[];
  kaliciYasak: boolean;
}

export interface AramaSonucuDto {
  lordId: string;
  ad: string;
  seviye: number;
  diyar: string;
  sonGorulme: string;
  susturulmus: boolean;
  yasakli: boolean;
}

export interface YoneticiOyuncuDto {
  lordId: string;
  ad: string;
  seviye: number;
  sohret: number;
  diyar: string;
  katildi: string;
  sonGorulme: string;
  hesap: {
    id: string;
    eposta: string;
    katildi: string;
    yonetici: boolean;
    epostaDogrulandi: boolean;
    lordlar: { id: string; ad: string; seviye: number; diyar: string }[];
  };
  susturma: { aktif: boolean; bitis: string | null; sebep: string | null };
  yasak: { aktif: boolean; kalici: boolean; bitis: string | null; sebep: string | null };
  gecmis: { ozet: string; an: string }[];
  mesajlar: {
    id: string;
    metin: string;
    an: string;
    silinmis: boolean;
    gizli: boolean;
    kanal: 'ittifak' | 'genel';
  }[];
}

export interface KuyrukDto {
  toplam: number;
  sayfa: number;
  sayfaBoyu: number;
  sureler: { saat: number; metin: string }[];
  satirlar: KuyrukSatiriDto[];
}

export interface ArmaDto {
  kalkan: string;
  desen: string;
  renk1: string;
  renk2: string;
  sembol: string;
}

export interface SevkiyatDto {
  giden: { id: string; yuk: Resources; arriveAt: string; kime: string }[];
  gelen: { id: string; yuk: Resources; arriveAt: string; kimden: string }[];
  gunlukTavan: number;
  bugunGonderilen: number;
  kalanTavan: number;
}

export interface GeneralKatkisiDto {
  key: string;
  ad: string;
  nadirlik: string;
  level: number;
  pasifAd: string;
  pasifEtki: string;
  pasifDeger: number;
  yetenekAd: string | null;
  yetenekAciklama: string | null;
}

/** Süren bir araştırma; `startedAt` yuva çubuğunun ilerlemesi için. */
export interface SurenArastirma {
  id: string;
  key: string | null;
  ad: string;
  startedAt: string;
  finishAt: string;
}

/** Dışlayan bir seçim (öğreti, ekonomi, yönetim) ve bırakmanın bedeli. */
export interface ArastirmaGrubuDto {
  key: string;
  ad: string;
  aciklama: string;
  secenekler: { key: string; ad: string; yol: string }[];
  /** Tamamlanmış seçeneğin yolu; süren seçenek sayılmaz. */
  secili: string | null;
  seciliAd: string | null;
  birakma: {
    acik: boolean;
    engel: string | null;
    sonrakiDegisim: string | null;
    silinecek: { key: string; ad: string }[];
    iade: { altin: number; demir: number; erzak: number };
  } | null;
}

export const api = {
  register: (email: string, password: string, lordName: string, worldId?: string) =>
    post<{ token: string }>('/auth/register', { email, password, lordName, worldId }),
  /** Kayıt ekranı için; jeton istemiyor. */
  diyarlar: () => request<DiyarSecimiDto>('/diyarlar'),
  /** Destek adresi (Kullanım Koşulları, Aydınlatma Metni); jeton istemiyor. */
  destek: () => request<{ eposta: string | null }>('/destek'),
  login: (email: string, password: string) =>
    post<{ token: string }>('/auth/login', { email, password }),
  /**
   * `ekran` yalnızca ölçüm için: oyuncular oyunu hangi ekranda bırakıyor?
   * Ayrı bir istek açmak yerine zaten düzenli çağrılan uca takılıyor.
   */
  me: (ekran?: string) =>
    request<MeResponse>(ekran ? `/me?ekran=${encodeURIComponent(ekran)}` : '/me'),

  sifirlamaIste: (email: string) =>
    post<{ gonderildi: boolean; jeton?: string }>('/auth/sifirlama-iste', { email }),
  sifirlamaYap: (token: string, password: string) =>
    post<{ degistirildi: boolean }>('/auth/sifirlama-yap', { token, password }),
  // Sunucu öteki cihazların oturumunu düşürüyor; bu cihaz yeni jetonla kalıyor.
  parolaDegistir: async (mevcut: string, yeni: string) => {
    const y = await post<{ degistirildi: boolean; token: string }>('/me/parola', { mevcut, yeni });
    setToken(y.token);
    return y;
  },
  hesabiSil: (parola: string) =>
    request<{ silindi: boolean }>('/me', {
      method: 'DELETE',
      body: JSON.stringify({ parola, onay: 'HESABIMI SIL' }),
    }),
  spendStats: (points: Partial<Record<StatKey, number>>) => post<LordState>('/me/stats', points),

  /** Öğretici okundu/geçildi — bir daha kendiliğinden açılmaz. */
  ogreticiBitti: () => post<{ bitti: boolean; ilkKez: boolean }>('/me/ogretici-bitti'),
  rehberBitti: () => post<{ bitti: boolean; ilkKez: boolean }>('/me/rehber-bitti'),
  /** Öğreticiyi tekrar okumak için (Hesap ekranı). */
  ogreticiSifirla: () => post<{ sifirlandi: boolean }>('/me/ogretici-sifirla'),

  /** Push bildirimi (docs/07 M14). `acik: false` ise düğme hiç çıkmıyor. */
  pushAnahtar: () =>
    request<{ acik: boolean; anahtar: string | null; cihazSayisi: number }>('/push/anahtar'),
  pushAbone: (abonelik: unknown, cihaz?: string) =>
    post<{ abone: boolean; cihazSayisi: number }>('/push/abone', {
      ...(abonelik as object),
      cihaz,
    }),
  pushCik: (endpoint: string) =>
    post<{ cikildi: boolean; cihazSayisi: number }>('/push/cik', { endpoint }),
  pushDeneme: () => post<{ gonderildi: number }>('/push/deneme'),

  items: () => request<{ items: ItemDto[]; tiers: TierDto[] }>('/items'),
  craft: (tier: number, slot: string) => post('/items/craft', { tier, slot }),
  equip: (id: string) => post<{ equipped: boolean; etki: EkipmanEtkisiDto }>(`/items/${id}/equip`),
  upgradeItem: (id: string) => post(`/items/${id}/upgrade`),
  sellItem: (id: string) => post(`/items/${id}/sell`),

  army: () => request<ArmyDto>('/army'),
  train: (unitType: string, count: number) => post('/army/train', { unitType, count }),
  disband: (unitType: string, count: number) => post('/army/disband', { unitType, count }),
  gear: () => request<GearDto[]>('/gear'),
  upgradeGear: (line: string) => post(`/gear/${line}/upgrade`),

  map: () => request<MapDto>('/map'),
  region: (id: number) => request<RegionDetailDto>(`/map/${id}`),
  medeniyet: () => request<{ medeniyet: MedeniyetDto | null }>('/medeniyet'),
  /** Taraf değiştir (docs/16 §13 soru 3). Fayda puanı sıfırlanır. */
  medeniyetDegistir: (key: string) =>
    post<{
      medeniyet: { id: string; ad: string; renk: string };
      faydaPuani: number;
      tasinanBolge: number;
    }>('/medeniyet/degis', { key }),
  cekirdegeBagisla: (mapId: number, kaynak: { altin: number; demir: number; erzak: number }) =>
    post<{ seviye: number; atladi: boolean; faydaPuani: number }>(
      `/medeniyet/cekirdek/${mapId}/bagis`,
      kaynak,
    ),
  upgradeRegion: (id: number) => post(`/map/${id}/upgrade`),
  setGarrison: (id: number, army: Army) => post(`/map/${id}/garrison`, { army }),
  preview: (
    toRegionId: number,
    army: Army,
    generalIds: string[] = [],
    duzen?: SavasDuzeni | null,
  ) => post<PreviewDto>('/battle/preview', { toRegionId, army, generalIds, duzen }),
  march: (toRegionId: number, army: Army, generalIds: string[] = [], duzen?: SavasDuzeni | null) =>
    post<{
      marchId: string;
      arriveAt: string;
      distance: number;
      durationSec: number;
      ilkSaldiri: boolean;
      uyari: string | null;
    }>('/march', { toRegionId, army, generalIds, duzen }),
  /** Pazar: kaynak takası durumu ve kurlar. */
  pazar: () =>
    request<{
      kaynaklar: Resources;
      komisyon: number;
      enAzMiktar: number;
      kurlar: Record<string, number>;
      gunluk: { kullanilan: number; tavan: number; kalan: number };
      /** Depo tavanı: takasın alınan kaynağı sığacak mı. */
      depoTavani: number;
    }>('/pazar'),
  pazarTakas: (veren: string, alan: string, miktar: number) =>
    post<{ verilen: number; alinan: number; kaynaklar: Resources }>('/pazar/takas', {
      veren,
      alan,
      miktar,
    }),

  /** Eşya pazarı (docs/19): kasa, emirlerim, satılabilir eşyalar, vitrin. */
  esyaPazari: () => request<EsyaPazariDto>('/esya-pazari'),
  esyaPazariUrun: (u: UrunDto) =>
    request<UrunDefteriDto>(
      `/esya-pazari/urun?slot=${u.slot}&tier=${u.tier}&rarity=${u.rarity}&upgradeLevel=${u.upgradeLevel}`,
    ),
  esyaIlanVer: (itemId: string, basamak: number) =>
    post<IlanSonucuDto>('/esya-pazari/ilan', { itemId, basamak }),
  esyaIlanFiyat: (id: string, basamak: number) =>
    post<IlanSonucuDto>(`/esya-pazari/ilan/${id}/fiyat`, { basamak }),
  esyaIlanGeriCek: (id: string) =>
    post<{ geriCekildi: boolean }>(`/esya-pazari/ilan/${id}/geri-cek`),
  esyaSiparisVer: (u: UrunDto, basamak: number) =>
    post<SiparisSonucuDto>('/esya-pazari/siparis', { ...u, basamak }),
  esyaSiparisFiyat: (id: string, basamak: number) =>
    post<SiparisSonucuDto>(`/esya-pazari/siparis/${id}/fiyat`, { basamak }),
  esyaSiparisIptal: (id: string) =>
    post<{ iptal: boolean; iade: number }>(`/esya-pazari/siparis/${id}/iptal`),
  esyaKasaAl: () => post<{ alinan: number; kalan: number }>('/esya-pazari/kasa/al'),

  /** Araştırma ağacı: sekmeler, çağlar, büyük seçimler, düğüm durumları, yuvalar. */
  arastirma: () =>
    request<{
      dallar: ArastirmaDurumu[];
      /** Sekme = dal. `sutunlar` sütun başlıkları; düğümün `sutun`u buraya indis. */
      sekmeler: { key: string; ad: string; ozet: string; sutunlar: string[] }[];
      caglar: ArastirmaCagi[];
      gruplar: ArastirmaGrubuDto[];
      tamamlanan: string[];
      ilerleme: { biten: number; toplam: number };
      lordSeviyesi: number;
      esZamanli: number;
      /** Yuvaların kaynağı: kütüphane seviyesi ve araştırmadan gelen. */
      yuva: { kutuphane: number; arastirma: number };
      /** Süren araştırmaların hepsi, en erken biteni önce. */
      surenler: SurenArastirma[];
      suren: SurenArastirma | null;
    }>('/arastirma'),
  arastirmaBaslat: (key: string) =>
    post<{ id: string; finishAt: string; ad: string; erken: boolean }>('/arastirma', { key }),
  arastirmaIptal: (id: string) =>
    request<{ iptal: boolean; iade: number }>(`/arastirma/${id}`, { method: 'DELETE' }),
  /** Dışlayan bir seçimi bırakır: yolun düğümleri silinir, yarısı geri gelir. */
  arastirmaYolBirak: (grup: string) =>
    post<{
      grup: string;
      yol: string;
      silinen: string[];
      iade: { altin: number; demir: number; erzak: number };
      sonrakiDegisim: string;
    }>('/arastirma/yol-birak', { grup }),

  /** Akın: beş NPC haritası, on grup, sahadaki ordular ve son sonuçlar. */
  akin: () =>
    request<{
      haritalar: AkinHaritaDurumu[];
      esZamanli: number;
      sahadaki: {
        id: string;
        haritaKey: string;
        haritaAdi: string;
        grupNo: number;
        grupAdi: string;
        army: Army;
        departAt: string;
        arriveAt: string;
      }[];
      sonuclar: {
        id: string;
        haritaKey: string;
        haritaAdi: string;
        grupNo: number;
        grupAdi: string;
        kazanildi: boolean;
        odul: Resources | null;
        yarali: Army | null;
        dusenItemId: string | null;
        /** Düşen parçanın kendisi: ganimet sahnesi görselini buradan çiziyor. */
        dusenParca: { slot: string; tier: number; rarity: string } | null;
        arriveAt: string;
      }[];
    }>('/akin'),
  akinOnizleme: (g: {
    haritaKey: string;
    grupNo: number;
    army: Army;
    generalIds?: string[];
    duzen?: SavasDuzeni | null;
  }) =>
    post<{
      kazanmaOrani: number;
      garnizon: Army;
      sureSn: number;
      tahminiKayip: Army;
      /** Akında ölüm yok: kaybın tamamı hastaneye yatacak yaralı. */
      tahminiYarali: Army;
      tahminiKalan: Army;
    }>('/akin/onizleme', g),
  /** Hastanedeki bütün yaralıları elmasla şimdi taburcu et; bedel sunucuda. */
  hastaneKisalt: () =>
    post<{ harcanan: number; kalanElmas: number; kafile: number; kisaltilanSaniye: number }>(
      '/army/hastane/kisalt',
      {},
    ),
  akinaCik: (g: {
    haritaKey: string;
    grupNo: number;
    army: Army;
    generalIds?: string[];
    duzen?: SavasDuzeni | null;
  }) =>
    post<{ id: string; arriveAt: string; sureSn: number; haritaAdi: string; grupAdi: string }>(
      '/akin',
      g,
    ),

  /** Şehir: yerleşim kademesi, binalar ve süren inşaat. */
  sehir: () =>
    request<{
      yerlesim: {
        kademe: Kademe;
        ad: string;
        ozet: string;
        baskent: { id: number; ad: string; tur: string; seviye: number } | null;
        binaTavani: number;
      };
      binalar: BinaDurumu[];
      /** Başkenti taşıyabileceğin, şu ankinden DAHA İYİ yerleşimlerin. */
      tasinabilir: {
        bolgeId: number;
        ad: string;
        tur: string;
        seviye: number;
        kademe: Kademe;
        kademeAdi: string;
        binaTavani: number;
      }[];
      esZamanli: number;
      insaat: { id: string; key: string; ad: string; finishAt: string }[];
    }>('/sehir'),
  binaYap: (key: string) =>
    post<{ queued: boolean; key: string; hedefSeviye: number; finishAt: string }>('/sehir/bina', {
      key,
    }),
  binaIptal: (id: string) =>
    request<{ iptal: boolean; iade: number }>(`/sehir/bina/${id}`, { method: 'DELETE' }),
  /** Başkenti başka bir yerleşimine taşı: binalar seninle gelir. */
  baskentTasi: (bolgeId: number) =>
    post<{
      tasindi: boolean;
      baskent: { ad: string; tur: string; seviye: number };
      kademe: Kademe;
      kademeAdi: string;
      binaTavani: number;
    }>('/sehir/baskent', { bolgeId }),

  /** Savunma düzeni: saldırıya uğradığında kullanılacak dizilim + taktik. */
  savunmaDuzeni: () =>
    request<{
      dizilim: Dizilim;
      taktik: string | null;
      kayitli: boolean;
      garnizon: Army;
      taktikler: TaktikDurumu[];
    }>('/me/savunma-duzeni'),
  savunmaDuzeniKaydet: (dizilim: Dizilim, taktik: string | null) =>
    request<{ kaydedildi: boolean }>('/me/savunma-duzeni', {
      method: 'PUT',
      body: JSON.stringify({ dizilim, taktik }),
    }),
  marches: () => request<MarchDto[]>('/marches'),
  recallMarch: (id: string) => request(`/march/${id}`, { method: 'DELETE' }),
  battles: () => request<BattleDto[]>('/battles'),
  battle: (id: string) => request<BattleDto>(`/battles/${id}`),

  generals: () => request<{ slots: number; altin: number; kadro: GeneralDto[] }>('/generals'),
  hireGeneral: (key: string) => post(`/generals/${key}/hire`),
  assignGeneral: (key: string, slotIndex: number | null) =>
    post(`/generals/${key}/assign`, { slotIndex }),

  gunluk: () => request<GunlukDto>('/gunluk'),
  gunlukOdul: () => post<GunlukOdulDto>('/gunluk/odul', {}),
  sefer: () => request<SeferDto>('/sefer'),
  armaKaydet: (arma: ArmaDto) => post<{ arma: ArmaDto }>('/me/arma', arma),
  ticaret: () => request<SevkiyatDto>('/ticaret'),
  kaynakGonder: (lordId: string, yuk: Resources) =>
    post<{ id: string; arriveAt: string; durationSec: number; alici: string; kalanTavan: number }>(
      '/ticaret/gonder',
      { lordId, yuk },
    ),
  ittifak: () => request<IttifakDto>('/ittifak'),
  ittifakKur: (ad: string, etiket: string) =>
    post<{ id: string; ad: string; etiket: string }>('/ittifak/kur', { ad, etiket }),
  ittifakKatil: (id: string) => post<{ katildi: string; ad: string }>(`/ittifak/${id}/katil`, {}),
  ittifakAyril: () => post<{ ayrildi: boolean; dagildi: boolean }>('/ittifak/ayril', {}),
  ittifakSohbet: () => request<SohbetDto>('/ittifak/sohbet'),
  takviyeGonder: (regionId: number, army: Army) =>
    post<{ marchId: string; arriveAt: string; durationSec: number; hedef: string }>(
      `/map/${regionId}/takviye`,
      { army },
    ),
  takviyeGeri: (regionId: number) =>
    post<{ marchId: string; arriveAt: string; birim: number }>(`/map/${regionId}/takviye-geri`, {}),
  ittifakHedef: (regionId: number | null, not?: string) =>
    post<{ hedef: { regionId: number; ad: string } | null }>('/ittifak/hedef', { regionId, not }),

  /* İttifak seviyesi ve bağış (docs/09 B1e) */
  bagisDurumu: () => request<BagisDto>('/ittifak/bagis'),
  bagisYap: () => post<BagisSonucuDto>('/ittifak/bagis'),
  ittifakDuyuru: (metin: string) => post<{ duyuru: string | null }>('/ittifak/duyuru', { metin }),
  ittifakRutbe: (lordId: string, rutbe: 'yasli' | 'uye') =>
    post<{ lordId: string; ad: string; rutbe: string }>('/ittifak/rutbe', { lordId, rutbe }),

  /* Başvuru: katılım liderin kararı (docs/09 §2.1) */
  ittifakBasvur: (id: string, mesaj: string) =>
    post<{ basvuruId: string; ad: string }>(`/ittifak/${id}/basvur`, { mesaj }),
  ittifakBasvuruGeriCek: (id: string) =>
    post<{ geriCekildi: string }>(`/ittifak/basvuru/${id}/geri-cek`, {}),
  ittifakBasvurular: () => request<BasvurularDto>('/ittifak/basvurular'),
  ittifakBasvuruKarar: (id: string, kabul: boolean) =>
    post<{ karar: 'kabul' | 'ret'; lordId: string; ad?: string }>(`/ittifak/basvuru/${id}/karar`, {
      kabul,
    }),
  ittifakArma: (a: ArmaDto) => post<{ arma: ArmaDto }>('/ittifak/arma', a),
  ittifakKayit: () => request<IttifakKayitDto>('/ittifak/kayit'),
  ittifakIncele: (id: string) => request<IttifakInceleDto>(`/ittifak/${id}/incele`),
  ittifakSiralamasi: (page = 0) => request<IttifakSiralamaDto>(`/rankings-ittifak?page=${page}`),
  ittifakAyarlar: (v: { katilim?: 'acik' | 'basvuru'; asgariSeviye?: number }) =>
    post<{ katilim: string; asgariSeviye: number }>('/ittifak/ayarlar', v),

  /* Saldırmazlık paktı (docs/09 B1d) */
  paktlar: () => request<PaktlarDto>('/ittifak/paktlar'),
  paktTeklif: (ittifakId: string) =>
    post<{ id: string; durum: string; hedef?: string; oteki?: string }>('/ittifak/pakt', {
      ittifakId,
    }),
  paktKabul: (id: string) =>
    post<{ id: string; durum: string; oteki: string }>(`/ittifak/pakt/${id}/kabul`),
  paktReddet: (id: string) => post<{ reddedildi: boolean }>(`/ittifak/pakt/${id}/reddet`),
  paktFesih: (id: string) =>
    post<{ feshediliyor: boolean; biterAt: string; ihbarSaat: number }>(
      `/ittifak/pakt/${id}/fesih`,
    ),
  ittifakYaz: (metin: string) => post<{ id: string; an: string }>('/ittifak/sohbet', { metin }),
  ittifakUyeCikar: (lordId: string) =>
    post<{ cikarildi: string }>('/ittifak/uye-cikar', { lordId }),
  seferOdul: () => post<SeferOdulDto>('/sefer/odul', {}),
  kesifGonder: (regionId: number) =>
    post<{ queued: boolean; finishAt: string; mesafe: number }>(`/map/${regionId}/kesif`, {}),
  dunya: () => request<DunyaDto>('/dunya'),

  rankings: (board: string, page = 0) => request<RankingDto>(`/rankings/${board}?page=${page}`),
  raporEt: (lordId: string, sebep: string, aciklama: string) =>
    post<{ alindi: boolean }>(`/rapor/${lordId}`, { sebep, aciklama }),
  /** Engellenen lordlar: sohbette mesajları bu oyuncuya hiç gelmiyor. */
  engeller: () => request<{ engelliler: { lordId: string; ad: string; an: string }[] }>('/engel'),
  engelle: (lordId: string) => post<{ engellendi: boolean; ad: string }>(`/engel/${lordId}`),
  engelKaldir: (lordId: string) =>
    request<{ kaldirildi: boolean }>(`/engel/${lordId}`, { method: 'DELETE' }),
  mesajRaporEt: (mesajId: string, sebep: string, aciklama: string) =>
    post<{ alindi: boolean; gizlendi: boolean }>(`/rapor/mesaj/${mesajId}`, { sebep, aciklama }),
  genelSohbet: () => request<GenelSohbetDto>('/sohbet/genel'),
  genelSohbetSon: () => request<{ son: string | null }>('/sohbet/genel/son'),
  genelYaz: (metin: string) => post<{ id: string; an: string }>('/sohbet/genel', { metin }),
  genelRaporEt: (mesajId: string, sebep: string, aciklama: string) =>
    post<{ alindi: boolean; gizlendi: boolean }>(`/rapor/genel/${mesajId}`, { sebep, aciklama }),
  resimRaporEt: (lordId: string, sebep: string, aciklama: string) =>
    post<{ alindi: boolean; gizlendi: boolean }>(`/rapor/resim/${lordId}`, { sebep, aciklama }),
  profilKarti: (lordId: string) => request<ProfilKartiDto>(`/lord/${lordId}/profil`),
  profilResmim: () => request<ProfilResmimDto>('/profil/resim'),
  profilResmiSec: (secim: ProfilResmi) =>
    request<{ secili: ProfilResmi }>('/profil/resim', {
      method: 'PUT',
      body: JSON.stringify(secim),
    }),
  profilResmiYukle: (veri: string) => post<ResimYuklemeDto>('/profil/resim/yukle', { veri }),
  onayBekleyenResimler: () =>
    request<{ toplam: number; resimler: OnayBekleyenResimDto[] }>('/moderasyon/resimler'),
  resimKarari: (id: string, karar: 'onayla' | 'kaldir') =>
    post<{ tamam: boolean }>(`/moderasyon/resim/${id}`, { karar }),
  sikayetSebepleri: () =>
    request<{ sebepler: { anahtar: string; metin: string }[] }>('/moderasyon/sebepler'),
  moderasyonDurumu: () => request<ModerasyonDurumuDto>('/moderasyon/durum'),
  moderasyonKuyrugu: (durum: 'acik' | 'kapali', sayfa: number) =>
    request<KuyrukDto>(`/moderasyon/kuyruk?durum=${durum}&sayfa=${sayfa}`),
  moderasyonKarar: (raporId: string, karar: string, saat: number | null) =>
    post<{ tamam: boolean; karar: string }>('/moderasyon/karar', { raporId, karar, saat }),
  susturmaKaldir: (lordId: string) =>
    post<{ tamam: boolean }>('/moderasyon/susturma-kaldir', { lordId }),
  epostaDogrula: (jeton: string) => post<{ dogrulandi: boolean }>('/auth/dogrula', { jeton }),
  dogrulamaGonder: () =>
    post<{ gonderildi: boolean; zatenDogrulandi: boolean }>('/auth/dogrulama-gonder', {}),
  yoneticiAyarlari: () => request<YoneticiAyarlariDto>('/yonetici/ayarlar'),
  yoneticiAra: (q: string) =>
    request<{ sonuclar: AramaSonucuDto[] }>(`/yonetici/ara?q=${encodeURIComponent(q)}`),
  yoneticiOyuncu: (lordId: string) => request<YoneticiOyuncuDto>(`/yonetici/oyuncu/${lordId}`),
  yoneticiSustur: (lordId: string, saat: number, sebep: string) =>
    post<{ tamam: boolean; ozet: string }>(`/yonetici/oyuncu/${lordId}/sustur`, { saat, sebep }),
  yoneticiSusturmaKaldir: (lordId: string) =>
    post<{ tamam: boolean; ozet: string }>(`/yonetici/oyuncu/${lordId}/susturma-kaldir`, {}),
  yoneticiYasakla: (lordId: string, saat: number | null, sebep: string) =>
    post<{ tamam: boolean; ozet: string }>(`/yonetici/oyuncu/${lordId}/yasakla`, { saat, sebep }),
  yoneticiYasakKaldir: (lordId: string) =>
    post<{ tamam: boolean; ozet: string }>(`/yonetici/oyuncu/${lordId}/yasak-kaldir`, {}),
  yoneticiMesajKaldir: (mesajId: string) =>
    post<{ tamam: boolean; ozet: string }>(`/yonetici/mesaj/${mesajId}/kaldir`, {}),
  bolgeyiBirak: (id: number) =>
    post<{ birakildi: boolean; donenBirlik: number }>(`/map/${id}/birak`),
};
