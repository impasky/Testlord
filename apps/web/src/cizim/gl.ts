/**
 * GPU çiziminin kapısı (docs/24): sıra, önbellek ve işçi.
 *
 * Çizim (`glCizici.ts`) mümkünse bir işçide (Web Worker + OffscreenCanvas)
 * koşuyor. GPU sürücüsü yazılımsa (donanım hızlandırması yok) bir sahne
 * yüzlerce milisaniye sürebiliyor; ana iş parçacığında bu kaydırmayı ve
 * dokunmayı dondururdu. Burada yalnız modelden ağ kuruluyor (birkaç ms) ve
 * tamponlar kopyasız aktarılıyor. İşçi açılamazsa ya da WebGL2 orada yoksa
 * aynı çizici burada koşuyor; o da yoksa null — çağıran SVG'ye düşüyor.
 */
import { bayrakKareleri, kareleriKur } from './bayrakAni';
import { dumanKaynaklari, type DumanKaynagi } from './duman';
import { agYap, type Ag } from './glAg';
import {
  aktarilanlar,
  cizBlob,
  glDurumu,
  yazilimMi,
  type CizimIstegi,
  type BayrakAtlasi,
  type CizimSonucu,
  type IsciCevabi,
  type IsciIstegi,
} from './glCizici';
import { kaliciOku, kaliciYaz, type KaliciGrup } from './kalici';
import { tarifModeli } from './tarif';
import type { Kamera, Model, V3 } from './uc';

export { EN_BUYUK, aoYaricapi, atlasDuzeni, ornekSayisi } from './glCizici';

export interface GlIstek {
  /**
   * Çizilecek model; ya da önceden (işçide) kurulmuş ağı (`ag`); ya da
   * modelin tarifi (`tarif.ts` anahtarı): model de işçide kuruluyor, ana iş
   * parçacığına yalnız anahtar düşüyor.
   */
  model?: Model;
  ag?: Ag;
  tarif?: string;
  kamera?: Kamera;
  /** Görüş kutusu: SVG'nin viewBox'ı (x, y, en, boy). */
  kutu: [number, number, number, number];
  /** Çıktı boyu (piksel). */
  en: number;
  boy: number;
  /** Işık yönü; verilmezse bütün çizimlerin ışığı (`ISIK`). */
  isik?: V3;
  /** Ortam gölgesi yarıçapı (dünya birimi); 0 kapalı, verilmezse sahnenin boyundan. */
  ao?: number;
  /** Hare gücü; 0 kapalı. */
  hare?: number;
  /**
   * Tilt-shift: keskin kalan odak bandının yarı yüksekliği (çıktı boyuna
   * oran; bant ortada). Verilmezse yok. Yalnız geniş sahneler (bölge afişi,
   * ekran zemini, diyar kapağı) istiyor; figür ve bina simgesi değil.
   */
  tilt?: number;
  /** Renk düzenlemesinin gücü (0 kapalı, 1 tam); verilmezse tam. */
  ton?: number;
  /** Sıcak gün ışığı (0 kapalı, 1 tam): canlı renk, altın ışık, serin gölge (yerleşke). */
  sicak?: number;
  /**
   * Hareketli sahne: duman ağa girmiyor (sayfada canlı yükseliyor), su
   * maskesi, ışık katmanı, çimen maskesi ve dalgalanan bayrak atlası da çiziliyor
   * (`glKatmanlari`); bayrak kumaşı ana resimde yok.
   */
  hareket?: boolean;
  /**
   * Yakınlık yaması (yerleşke yakınlaşınca, bkz. `Sahne.yama`): canlı
   * sahnenin bir parçası, ana resmi gibi kuruluyor — salınan parça, canlı
   * figür ve duman ana resimde YOK. Su, ışık, çimen katmanı ve duman
   * üretilmiyor (sahneninkiler yamanın üstünde). `hareket` ile birlikte
   * yalnız parçaların kare atlası: yamaya giren köylü ve bayraklar
   * yamanın çözünürlüğünde oynuyor.
   */
  yama?: boolean;
  /** Su dalgasının ölçüsü (bkz. `CizimIstegi.dalgaBirimi`): yamada ana resminki. */
  dalgaBirimi?: number;
  /** Bir CSS pikselinin çıktıdaki karşılığı: kenar çizgisinin kalınlığı. */
  olcek: number;
}

/* ── İşçi ──────────────────────────────────────────────────────────── */

let isci: Worker | null = null;
let isciDurumu: 'denenmedi' | 'hazir' | 'yok' = 'denenmedi';
const bekleyenler = new Map<number, (c: IsciCevabi) => void>();
let sayac = 0;

function isciyiBirak() {
  isciDurumu = 'yok';
  isci?.terminate();
  isci = null;
  for (const [id, coz] of bekleyenler) coz({ id, yok: true });
  bekleyenler.clear();
}

function isciAl(): Worker | null {
  if (isciDurumu === 'yok') return null;
  if (isci) return isci;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    isciDurumu = 'yok';
    return null;
  }
  try {
    isci = new Worker(new URL('./glIsci.ts', import.meta.url), { type: 'module' });
  } catch {
    isciDurumu = 'yok';
    return null;
  }
  isci.onmessage = (e: MessageEvent<IsciCevabi>) => {
    const coz = bekleyenler.get(e.data.id);
    bekleyenler.delete(e.data.id);
    coz?.(e.data);
  };
  // Yüklenemedi (eski tarayıcı, güvenlik politikası) ya da düştü.
  isci.onerror = isciyiBirak;
  return isci;
}

function iscide(i: Worker, istek: IsciIstegi): Promise<IsciCevabi> {
  const id = ++sayac;
  return new Promise((coz) => {
    bekleyenler.set(id, coz);
    i.postMessage({ id, istek }, aktarilanlar(istek as Partial<CizimIstegi>));
  });
}

async function ciz(istek: GlIstek): Promise<CizimSonucu | null> {
  // Model işçiye gitmiyor (yalnız ağı ya da tarifi): kopyalanması büyük
  // sahnede pahalı.
  const { model, ag, tarif, ...geri } = istek;
  const h = istek.hareket;
  const parcasiz = h || istek.yama;
  let dumanlar: DumanKaynagi[] | undefined;
  const kur = (m: Model) => {
    if (h && !istek.yama) dumanlar = dumanKaynaklari(m, istek.kamera);
    return {
      ag: agYap(m, istek.kamera, { dumansiz: parcasiz, bayraksiz: parcasiz }),
      bayrak: h ? bayrakKareleri(m, istek.kamera) : undefined,
    };
  };
  const modelden = () => kur(model ?? (tarif ? tarifModeli(tarif) : null) ?? []);
  // İşçiye giden kareler önceden kuruluyor: tembel işlev gönderilemiyor.
  const aktarilabilir = (k: ReturnType<typeof kur>) => ({
    ...k,
    bayrak: k.bayrak && kareleriKur(k.bayrak),
  });
  const yazilim = yazilimaIzin();
  const i = isciAl();
  if (i) {
    const gidecek: IsciIstegi = ag
      ? { ...geri, ag, yazilimaIzin: yazilim }
      : tarif && !model
        ? { ...geri, tarif, yazilimaIzin: yazilim }
        : { ...geri, ...aktarilabilir(modelden()), yazilimaIzin: yazilim };
    const cevap = await iscide(i, gidecek);
    if (!cevap.yok) {
      isciDurumu = 'hazir';
      return cevap.sonuc ? { ...cevap.sonuc, dumanlar: cevap.sonuc.dumanlar ?? dumanlar } : null;
    }
    // İşçide WebGL2 yok: bundan sonra burada. Ağ geri geldiyse o, gelmediyse
    // (işçi düştü) modelden yeniden; önceden kurulmuş ağ da gittiyse null.
    isciyiBirak();
    if (cevap.ag) {
      dumanlar = cevap.dumanlar ?? dumanlar;
      return sonuna(
        await cizBlob({ ...geri, ag: cevap.ag, bayrak: cevap.bayrak, yazilimaIzin: yazilim }),
      );
    }
    if (!model && !tarif) return null;
  }
  return sonuna(await cizBlob({ ...geri, ...(ag ? { ag } : modelden()), yazilimaIzin: yazilim }));

  function sonuna(s: CizimSonucu | null): CizimSonucu | null {
    return s && { ...s, dumanlar };
  }
}

/* ── Sıra ve önbellek ──────────────────────────────────────────────── */

const ONBELLEK = new Map<string, Promise<string | null>>();
let zincir: Promise<unknown> = Promise.resolve();

/** Hareketli sahnenin katmanları (nesne url'leri), ana resmin url'sine göre. */
export interface Katmanlar {
  su?: string;
  isik?: string;
  /** Çimen maskesi: üstünden rüzgâr dalgaları kayıyor. */
  cimen?: string;
  /** Bayrak atlası ve bayrakların resimdeki kutuları (bkz. `BayrakAtlasi`). */
  bayrak?: Omit<BayrakAtlasi, 'resim'> & { url: string };
  /** Canlı dumanın kaynakları (görüş kutusu biriminde). */
  dumanlar?: DumanKaynagi[];
}
const KATMANLAR = new Map<string, Katmanlar>();

export function glKatmanlari(url: string | null): Katmanlar | undefined {
  return url ? KATMANLAR.get(url) : undefined;
}

/**
 * Geliştirme ve denetim için: yazılım sürücüsünde de GPU yolunu zorla
 * (`localStorage['gl-yazilim'] = '1'`). Başsız tarayıcıda WebGL hep
 * yazılım; görsel denetim ve ekran görüntüleri GPU çıktısını bununla
 * görüyor. Oyuncuya bir ayar değil.
 */
function yazilimaIzin(): boolean {
  try {
    return localStorage.getItem('gl-yazilim') === '1';
  } catch {
    return false;
  }
}

let donanim: boolean | null = null;

/**
 * Donanım hızlandırmalı WebGL2 var mı: küçük bir bağlam açıp sürücünün
 * adına bakıyor ve hemen bırakıyor (gölgelendirici derlemiyor; asıl
 * kurulum ilk işte, sırada). Yazılım sürücüsü (`glCizici.yazilimMi`)
 * "yok" sayılıyor: orada SVG hem daha hızlı hem sayfayı dondurmuyor.
 */
function donanimVarMi(): boolean {
  if (yazilimaIzin()) return true;
  try {
    const t =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(1, 1)
        : document.createElement('canvas');
    const gl = t.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return false;
    const yazilim = yazilimMi(gl);
    gl.getExtension('webgl_lose_context')?.loseContext();
    return !yazilim;
  } catch {
    return false;
  }
}

/**
 * GPU yolu kullanılabilir mi. İlk çağrıda sürücüye bir kez bakıyor; iş
 * sırasında işçide de burada da kurulamazsa bundan sonra false.
 */
export function glVarMi(): boolean {
  if (typeof WebGL2RenderingContext === 'undefined') return false;
  if (isciDurumu === 'yok' && glDurumu() === 'yok') return false;
  donanim ??= donanimVarMi();
  return donanim;
}

/**
 * Çizimin sonucu (bloblar), url'sine göre: kalıcı depoya sonradan yazılabilsin
 * (`glKaydet`). Bloblar zaten url'leriyle bellekte; burada yalnız başvuru.
 */
const SONUCLAR = new Map<string, CizimSonucu>();

/** Sonucun resmine ve katmanlarına nesne url'si verir. */
function urlle(s: CizimSonucu): string {
  const url = URL.createObjectURL(s.resim);
  SONUCLAR.set(url, s);
  if (s.su || s.isik || s.cimen || s.bayrak || s.dumanlar?.length) {
    const { resim, ...bayrak } = s.bayrak ?? {};
    KATMANLAR.set(url, {
      su: s.su && URL.createObjectURL(s.su),
      isik: s.isik && URL.createObjectURL(s.isik),
      cimen: s.cimen && URL.createObjectURL(s.cimen),
      bayrak: resim && {
        ...(bayrak as Omit<BayrakAtlasi, 'resim'>),
        url: URL.createObjectURL(resim),
      },
      dumanlar: s.dumanlar,
    });
  }
  return url;
}

/** Bir işi çizip resmin (ve katmanlarının) nesne url'sini veriyor. */
async function calistir(
  istek: () => GlIstek,
  sonra?: (s: CizimSonucu) => void,
): Promise<string | null> {
  try {
    const s = await ciz(istek());
    if (!s) return null;
    sonra?.(s);
    return urlle(s);
  } catch {
    return null;
  }
}

/** Zincire ekler: işler tek tek, aralarında ana iş parçacığına nefes payı. */
function sirayaKoy(is: () => Promise<string | null>): Promise<string | null> {
  const p = zincir.then(() => new Promise((r) => setTimeout(r, 0))).then(is);
  zincir = p.catch(() => undefined);
  return p;
}

/** Sırada ya da çizilmekte olan öncelikli iş sayısı. */
let oncelikli = 0;
/** Sonraya bırakılan işler (bkz. `glCiz` `sonra`). */
const sonrakiler: {
  anahtar: string;
  istek: () => GlIstek;
  ilgi: (() => boolean)[];
  coz: (url: string | null) => void;
  /** Kalıcı işin sonucu cihaza (bkz. `glCiz` `kalici`). */
  yaz?: (s: CizimSonucu) => void;
}[] = [];
let sonrakiCalisiyor = false;
/**
 * Sıra boşaldıktan sonra sonraki işin beklediği süre (ms): açılıştan hemen
 * sonra başka ekrana geçen oyuncu onu başlamadan iptal ediyor; yoksa yeni
 * ekranın çizimleri başlamış ağır işin arkasında bekliyordu.
 */
const SONRA_BEKLE = 1500;
let sonraZamani: ReturnType<typeof setTimeout> | undefined;

function sonrakiniBaslat() {
  if (oncelikli > 0 || sonrakiCalisiyor || !sonrakiler.length) return;
  clearTimeout(sonraZamani);
  sonraZamani = setTimeout(sonrakiniCalistir, SONRA_BEKLE);
}

function sonrakiniCalistir() {
  if (oncelikli > 0 || sonrakiCalisiyor) return;
  while (sonrakiler.length) {
    const s = sonrakiler.shift()!;
    // Artık isteyen yok (sayfadan çıkıldı): hiç çizilmiyor, sonra yeniden istenebilir.
    if (s.ilgi.every((istenmiyor) => istenmiyor())) {
      ONBELLEK.delete(s.anahtar);
      s.coz(null);
      continue;
    }
    sonrakiCalisiyor = true;
    void sirayaKoy(() => calistir(s.istek, s.yaz)).then((url) => {
      sonrakiCalisiyor = false;
      s.coz(url);
      sonrakiniBaslat();
    });
    return;
  }
}

const ILGI = new Map<string, (() => boolean)[]>();

/**
 * Çizimi sıraya koyar; aynı istek (anahtar + kutu + boy) bir kez çiziliyor.
 * İşler tek tek, aralarında ana iş parçacığına nefes payı bırakarak
 * çalışıyor: bir ekranda otuz çizim açıldığında sayfa donmasın.
 *
 * `sonra`: ağır ve beklemesi dert olmayan iş (yerleşkenin canlı kareleri):
 * öncelikli iş kalmayınca başlıyor, başlamadan önce isteyen kalmadıysa
 * (`istenmiyor`, sayfadan çıkıldı) hiç çizilmiyor. Böylece Şehir'den
 * hemen ayrılan oyuncunun yeni ekranı onu beklemiyor.
 */
export function glCiz(
  anahtar: string,
  istek: () => GlIstek,
  secenek: {
    sonra?: boolean;
    istenmiyor?: () => boolean;
    /**
     * Kalıcı: önce cihazdaki depoya bakılıyor (`kalici.ts`, yuva anahtarın
     * kendisi), yoksa çizilip bu grupta yazılıyor. Yerleşkenin, dünya ve
     * diyar haritalarının ana resmi (`sahne`); kapaklar ve afişler (`afis`);
     * ekran zeminleri (`zemin`).
     */
    kalici?: KaliciGrup;
  } = {},
): Promise<string | null> {
  // Aynı işi bekleyen her çağıran bir ilgi bırakıyor; iş ancak hepsi
  // vazgeçtiyse atlanıyor (yeniden isteyen eskisinin vazgeçişine takılmasın).
  const ilgisi = secenek.istenmiyor ?? (() => false);
  const var_ = ONBELLEK.get(anahtar);
  if (var_) {
    ILGI.get(anahtar)?.push(ilgisi);
    return var_;
  }
  const ilgi = [ilgisi];
  ILGI.set(anahtar, ilgi);
  // Kalıcıysa çizilen sonuç cihaza da yazılıyor.
  const grup = secenek.kalici;
  const yaz = grup ? (s: CizimSonucu) => kaliciYaz(anahtar, anahtar, s, grup) : undefined;
  const sirala = (): Promise<string | null> => {
    if (secenek.sonra) {
      const p = new Promise<string | null>((coz) =>
        sonrakiler.push({ anahtar, istek, ilgi, coz, yaz }),
      );
      sonrakiniBaslat();
      return p;
    }
    oncelikli++;
    // Sırası gelince isteyen kalmadıysa (yakınlık yaması: oyuncu çoktan
    // başka yere kaydı) çizilmiyor.
    const p = sirayaKoy(() => {
      if (!ilgi.every((istenmiyor) => istenmiyor())) return calistir(istek, yaz);
      ONBELLEK.delete(anahtar);
      return Promise.resolve(null);
    });
    void p.then(() => {
      oncelikli--;
      sonrakiniBaslat();
    });
    return p;
  };
  // Kalıcı: cihazda varsa sıraya hiç girmiyor (canlı resim de beklemiyor).
  const is = secenek.kalici
    ? kaliciOku(anahtar).then((k) => (k && k.anahtar === anahtar ? urlle(k.sonuc) : sirala()))
    : sirala();
  void is.then(() => {
    if (ILGI.get(anahtar) === ilgi) ILGI.delete(anahtar);
  });
  ONBELLEK.set(anahtar, is);
  return is;
}

/**
 * Çizimi önbellekten çıkarıp belleğini bırakıyor. Yalnız tek kullanımlık
 * resim için (yakınlık yaması): yerine yenisi konunca eskisinin artık
 * gösterildiği yer yok.
 */
export function glBirak(anahtar: string): void {
  const is = ONBELLEK.get(anahtar);
  if (!is) return;
  ONBELLEK.delete(anahtar);
  void is.then((url) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    SONUCLAR.delete(url);
    const k = KATMANLAR.get(url);
    if (!k) return;
    KATMANLAR.delete(url);
    for (const u of [k.su, k.isik, k.cimen, k.bayrak?.url]) if (u) URL.revokeObjectURL(u);
  });
}

/**
 * Çizilmiş bir resmi (ve katmanlarını) cihazdaki yuvaya yazar (yakınlık
 * yaması: sahne kapanınca ya da uygulama arka plana geçince; büyük
 * sahnelerin grubunda). `ek` geri yüklerken dönüyor.
 */
export function glKaydet(yuva: string, anahtar: string, url: string, ek?: unknown): void {
  const s = SONUCLAR.get(url);
  if (s) kaliciYaz(yuva, anahtar, s, 'sahne', ek);
}

/**
 * Yuvadaki resmi geri yükler: url'si verilip önbelleğe kendi anahtarıyla
 * giriyor (aynı çizim yeniden istenirse ondan; `glBirak` bırakabiliyor).
 */
export async function glKalici(
  yuva: string,
): Promise<{ anahtar: string; url: string; ek: unknown } | null> {
  const k = await kaliciOku(yuva);
  if (!k) return null;
  const var_ = ONBELLEK.get(k.anahtar);
  const url = var_ ? await var_ : null;
  if (url) return { anahtar: k.anahtar, url, ek: k.ek };
  const yeni = urlle(k.sonuc);
  ONBELLEK.set(k.anahtar, Promise.resolve(yeni));
  return { anahtar: k.anahtar, url: yeni, ek: k.ek };
}

/**
 * Resmi ve katmanlarını çözer (yükler, bitmap'e açar): durağan resmin
 * yerine canlısı konurken bir kare bile figürsüz görünmesin (canlı
 * resimde hareketli parçalar yok, atlasta).
 */
export async function glOnYukle(url: string): Promise<void> {
  const k = KATMANLAR.get(url);
  const adresler = [url, k?.su, k?.isik, k?.cimen, k?.bayrak?.url].filter((u): u is string => !!u);
  await Promise.all(
    adresler.map((u) => {
      const r = new Image();
      r.src = u;
      return r.decode().catch(() => undefined);
    }),
  );
}
