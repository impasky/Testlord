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
import { bayrakKareleri } from './bayrakAni';
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
import { tarifModeli } from './tarif';
import type { Kamera, Model, V3 } from './uc';

export { EN_BUYUK, atlasDuzeni } from './glCizici';

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
  /**
   * Hareketli sahne: duman ağa girmiyor (sayfada canlı yükseliyor), su
   * maskesi, ışık katmanı ve dalgalanan bayrak atlası da çiziliyor
   * (`glKatmanlari`); bayrak kumaşı ana resimde yok.
   */
  hareket?: boolean;
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
  let dumanlar: DumanKaynagi[] | undefined;
  const kur = (m: Model) => {
    if (h) dumanlar = dumanKaynaklari(m, istek.kamera);
    return {
      ag: agYap(m, istek.kamera, { dumansiz: h, bayraksiz: h }),
      bayrak: h ? bayrakKareleri(m, istek.kamera) : undefined,
    };
  };
  const modelden = () => kur(model ?? (tarif ? tarifModeli(tarif) : null) ?? []);
  const yazilim = yazilimaIzin();
  const i = isciAl();
  if (i) {
    const gidecek: IsciIstegi = ag
      ? { ...geri, ag, yazilimaIzin: yazilim }
      : tarif && !model
        ? { ...geri, tarif, yazilimaIzin: yazilim }
        : { ...geri, ...modelden(), yazilimaIzin: yazilim };
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
 * Çizimi sıraya koyar; aynı istek (anahtar + kutu + boy) bir kez çiziliyor.
 * İşler tek tek, aralarında ana iş parçacığına nefes payı bırakarak
 * çalışıyor: bir ekranda otuz çizim açıldığında sayfa donmasın.
 */
export function glCiz(anahtar: string, istek: () => GlIstek): Promise<string | null> {
  const var_ = ONBELLEK.get(anahtar);
  if (var_) return var_;
  const is = zincir
    .then(() => new Promise((r) => setTimeout(r, 0)))
    .then(async () => {
      try {
        const s = await ciz(istek());
        if (!s) return null;
        const url = URL.createObjectURL(s.resim);
        if (s.su || s.isik || s.bayrak || s.dumanlar?.length) {
          const { resim, ...bayrak } = s.bayrak ?? {};
          KATMANLAR.set(url, {
            su: s.su && URL.createObjectURL(s.su),
            isik: s.isik && URL.createObjectURL(s.isik),
            bayrak: resim && {
              ...(bayrak as Omit<BayrakAtlasi, 'resim'>),
              url: URL.createObjectURL(resim),
            },
            dumanlar: s.dumanlar,
          });
        }
        return url;
      } catch {
        return null;
      }
    });
  zincir = is.catch(() => undefined);
  ONBELLEK.set(anahtar, is);
  return is;
}
