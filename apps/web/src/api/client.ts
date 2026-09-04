/** Tipli API istemcisi. Sunucu tek otoritedir; istemci hiçbir sayı yazmaz. */
import type {
  Army,
  BasarimOlcutleri,
  GunlukGorev,
  GearLineKey,
  Resources,
  StatKey,
} from '@lordlar/shared';

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
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : '');

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
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(body?.error ?? 'Bilinmeyen bir hata oluştu.', res.status, body?.code);
  }
  return body as T;
}

// Content-Type application/json gönderip gövdeyi boş bırakmak sunucuda 400
// üretir. Gövde istemeyen uçlar (kuşan, sat, yükselt, kirala) için boş nesne
// göndeririz — aksi halde bu işlemlerin hiçbiri arayüzden çalışmaz.
const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export interface LordState {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpForNext: number;
  stats: Record<StatKey, number>;
  statPoints: number;
  resources: Resources;
  storageCapacity: number;
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

export interface TierDto {
  tier: number;
  unlockLevel: number;
  unlocked: boolean;
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
  byLocation: { unitType: string; count: number; locationType: string; locationId: string | null }[];
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
  q: number;
  r: number;
  ring: number;
  level: number;
  incomeMult: number;
  owner: { id: string; name: string; level: number } | null;
  isMine: boolean;
  shielded: boolean;
  distance: number;
  fortressBonus: number;
}

export interface MapDto {
  home: { q: number; r: number };
  maxRegions: number;
  oneri: HedefOnerisiDto | null;
  regions: RegionDto[];
}

export interface RegionDetailDto extends RegionDto {
  garrison: Army;
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
export interface DunyaDto {
  ad: string;
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

export const api = {
  register: (email: string, password: string, lordName: string) =>
    post<{ token: string }>('/auth/register', { email, password, lordName }),
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
  parolaDegistir: (mevcut: string, yeni: string) =>
    post<{ degistirildi: boolean }>('/me/parola', { mevcut, yeni }),
  hesabiSil: (parola: string) =>
    request<{ silindi: boolean }>('/me', {
      method: 'DELETE',
      body: JSON.stringify({ parola, onay: 'HESABIMI SIL' }),
    }),
  spendStats: (points: Partial<Record<StatKey, number>>) => post<LordState>('/me/stats', points),

  items: () => request<{ items: ItemDto[]; tiers: TierDto[] }>('/items'),
  craft: (tier: number, slot: string) => post('/items/craft', { tier, slot }),
  equip: (id: string) =>
    post<{ equipped: boolean; etki: EkipmanEtkisiDto }>(`/items/${id}/equip`),
  upgradeItem: (id: string) => post(`/items/${id}/upgrade`),
  sellItem: (id: string) => post(`/items/${id}/sell`),

  army: () => request<ArmyDto>('/army'),
  train: (unitType: string, count: number) => post('/army/train', { unitType, count }),
  disband: (unitType: string, count: number) => post('/army/disband', { unitType, count }),
  gear: () => request<GearDto[]>('/gear'),
  upgradeGear: (line: string) => post(`/gear/${line}/upgrade`),

  map: () => request<MapDto>('/map'),
  region: (id: number) => request<RegionDetailDto>(`/map/${id}`),
  upgradeRegion: (id: number) => post(`/map/${id}/upgrade`),
  setGarrison: (id: number, army: Army) => post(`/map/${id}/garrison`, { army }),
  preview: (toRegionId: number, army: Army, generalIds: string[] = []) =>
    post<PreviewDto>('/battle/preview', { toRegionId, army, generalIds }),
  march: (toRegionId: number, army: Army, generalIds: string[] = []) =>
    post<{
      marchId: string;
      arriveAt: string;
      distance: number;
      durationSec: number;
      ilkSaldiri: boolean;
      uyari: string | null;
    }>(
      '/march',
      { toRegionId, army, generalIds },
    ),
  marches: () => request<MarchDto[]>('/marches'),
  recallMarch: (id: string) => request(`/march/${id}`, { method: 'DELETE' }),
  battles: () => request<BattleDto[]>('/battles'),
  battle: (id: string) => request<BattleDto>(`/battles/${id}`),

  generals: () =>
    request<{ slots: number; altin: number; kadro: GeneralDto[] }>('/generals'),
  hireGeneral: (key: string) => post(`/generals/${key}/hire`),
  assignGeneral: (key: string, slotIndex: number | null) =>
    post(`/generals/${key}/assign`, { slotIndex }),

  gunluk: () => request<GunlukDto>('/gunluk'),
  gunlukOdul: () => post<GunlukOdulDto>('/gunluk/odul', {}),
  sefer: () => request<SeferDto>('/sefer'),
  seferOdul: () => post<SeferOdulDto>('/sefer/odul', {}),
  kesifGonder: (regionId: number) =>
    post<{ queued: boolean; finishAt: string; mesafe: number }>(`/map/${regionId}/kesif`, {}),
  dunya: () => request<DunyaDto>('/dunya'),

  rankings: (board: string, page = 0) => request<RankingDto>(`/rankings/${board}?page=${page}`),
  raporEt: (lordId: string, sebep: string) => post<{ alindi: boolean }>(`/rapor/${lordId}`, { sebep }),
  bolgeyiBirak: (id: number) =>
    post<{ birakildi: boolean; donenBirlik: number }>(`/map/${id}/birak`),
};
