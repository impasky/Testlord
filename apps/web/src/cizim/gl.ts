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
import { agYap, type Ag } from './glAg';
import { aktarilanlar, cizBlob, glDurumu, type CizimIstegi, type IsciCevabi } from './glCizici';
import type { Kamera, Model, V3 } from './uc';

export { EN_BUYUK } from './glCizici';

export interface GlIstek {
  /** Çizilecek model; ya da önceden (işçide) kurulmuş ağı (`ag`). */
  model?: Model;
  ag?: Ag;
  kamera?: Kamera;
  /** Görüş kutusu: SVG'nin viewBox'ı (x, y, en, boy). */
  kutu: [number, number, number, number];
  /** Çıktı boyu (piksel). */
  en: number;
  boy: number;
  /** Işık yönü; verilmezse bütün çizimlerin ışığı (`ISIK`). */
  isik?: V3;
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

function iscide(i: Worker, istek: CizimIstegi): Promise<IsciCevabi> {
  const id = ++sayac;
  return new Promise((coz) => {
    bekleyenler.set(id, coz);
    i.postMessage({ id, istek }, aktarilanlar(istek.ag));
  });
}

async function ciz(istek: GlIstek): Promise<Blob | null> {
  let c: CizimIstegi = {
    ...istek,
    ag: istek.ag ?? agYap(istek.model ?? [], istek.kamera),
  };
  const i = isciAl();
  if (i) {
    const cevap = await iscide(i, c);
    if (!cevap.yok) {
      isciDurumu = 'hazir';
      return cevap.blob ?? null;
    }
    // İşçide WebGL2 yok: bundan sonra burada. Ağ geri geldiyse o, gelmediyse
    // (işçi düştü) modelden yeniden; önceden kurulmuş ağ da gittiyse null.
    isciyiBirak();
    if (cevap.ag) c = { ...c, ag: cevap.ag };
    else if (istek.model) c = { ...c, ag: agYap(istek.model, istek.kamera) };
    else return null;
  }
  return cizBlob(c);
}

/* ── Sıra ve önbellek ──────────────────────────────────────────────── */

const ONBELLEK = new Map<string, Promise<string | null>>();
let zincir: Promise<unknown> = Promise.resolve();

/**
 * WebGL2 kullanılabilir görünüyor mu. Bağlamı KURMUYOR (gölgelendirici
 * derlemek ilk boyamayı geciktirirdi); kurulum ilk işte, sırada yapılıyor.
 * İşçide de burada da kurulamazsa iş null dönüyor ve bu işlev bundan sonra
 * false diyor.
 */
export function glVarMi(): boolean {
  if (typeof WebGL2RenderingContext === 'undefined') return false;
  return !(isciDurumu === 'yok' && glDurumu() === 'yok');
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
        const b = await ciz(istek());
        return b ? URL.createObjectURL(b) : null;
      } catch {
        return null;
      }
    });
  zincir = is.catch(() => undefined);
  ONBELLEK.set(anahtar, is);
  return is;
}
