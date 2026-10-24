/**
 * Canlı parçaların atlası ve kayan şeritleri — yalnız GÖSTERİM (docs/24
 * "GPU çizimi", Bayrak). Çizim sürümüne girmiyor (`vite-cizim-surumu.mjs`
 * `RESIMSIZ`): burada değişen hiçbir şey cihazdaki kayıtları eskitmiyor.
 * Çizimin çıktısını (kaydedilen resmi) değiştiren kod buraya girmemeli.
 *
 * Bayrak atlasları kimliğe göre (`Katmanlar.bayrak.url`): sayfadaki kayan
 * şeritler tuvale buradan çiziliyor (Sahne `Serit`).
 *
 * Taze çizimde atlas işçiden çözülmüş geliyor (`ImageBitmap`, PNG'ye
 * çevrilmeden; bkz. `KismiSonuc`); şeritleri burada kesiliyor. Cihaz
 * kaydından gelende (PNG) çözme de kesme de şerit işçisinde
 * (`seritIsci.ts`): ana iş parçacığında kesmek (`createImageBitmap(atlas, x,
 * y, w, h)` orada eşzamanlı bir kopya) kayıttan açılan ekranı telefonda
 * 50–200 ms donduruyordu. İşçi yoksa ya da kesemezse burada. Önceden atlas
 * bir `<img>`di: tuvale ilk çizimde 10 megapiksellik resim ana iş
 * parçacığında yeniden çözülüyordu (ölçüm: canlıya geçerken 130–210 ms
 * donma, telefonda birkaç katı). `glOnYukle` resim gösterilmeden önce
 * hazırlıyor: şerit ilk karesinde çizili, bir kare bile figürsüz değil.
 *
 * Çözülmüş atlas bellek tutuyor (yerleşkeninki ~10 MP, ~40 MB): toplamı
 * `ATLAS_BUTCE`yi aşınca en eskisi kapatılıyor (PNG'si varsa; yeniden
 * kurulan sahne onu yeniden çözüyor). Bırakılan yamanınki hemen gidiyor.
 */
import { atlasDuzeni, type BayrakAtlasi } from './glCizici';
import type { SeritCevabi, SeritIstegi, SeritKutusu } from './seritIsci';

/** Sayfadaki atlas: kutular, kare sayıları, süreler ve kimliği (`url`). */
export type AtlasKatmani = Omit<BayrakAtlasi, 'resim'> & { url: string };

const ATLASLAR = new Map<string, ImageBitmap>();
/** Atlasın PNG'si (cihaz kaydı ya da taze çizimin sonradan gelen PNG'si). */
const ATLAS_KAYNAK = new Map<string, Blob>();
/** Çözülmekte olanlar: aynı atlas iki kez çözülmesin. */
const ATLAS_COZULEN = new Map<string, Promise<ImageBitmap | null>>();
/** Çözülmüş atlasların toplam piksel sınırı (yerleşke ve birkaç afiş). */
const ATLAS_BUTCE = 16_000_000;
let atlasSayaci = 0;

/** Atlası kaydeder (bitmap'iyle ya da PNG'siyle), kimliğini verir. */
export function atlasKoy(bitmap?: ImageBitmap, png?: Blob): string {
  const kimlik = `atlas:${++atlasSayaci}`;
  if (png) ATLAS_KAYNAK.set(kimlik, png);
  if (bitmap) atlasSakla(kimlik, bitmap);
  return kimlik;
}

/** Taze çizimin PNG'si sonradan geldi: bitmap'i bütçe aşılınca kapatılabilir. */
export function atlasPngKoy(kimlik: string, png: Blob): void {
  ATLAS_KAYNAK.set(kimlik, png);
}

/** Çözülmüşü en sona koyar; bütçe aşılınca en eskileri (PNG'si olanları) kapatır. */
function atlasSakla(kimlik: string, b: ImageBitmap) {
  ATLASLAR.delete(kimlik);
  ATLASLAR.set(kimlik, b);
  let toplam = 0;
  for (const a of ATLASLAR.values()) toplam += a.width * a.height;
  for (const [k, a] of ATLASLAR) {
    if (toplam <= ATLAS_BUTCE) break;
    // PNG'si gelmemiş (taze, çizimi süren) atlas kapatılamaz: yeniden çözülemez.
    if (k === kimlik || !ATLAS_KAYNAK.has(k)) continue;
    toplam -= a.width * a.height;
    a.close();
    ATLASLAR.delete(k);
  }
}

export function atlasBirak(kimlik: string): void {
  ATLASLAR.get(kimlik)?.close();
  ATLASLAR.delete(kimlik);
  ATLAS_KAYNAK.delete(kimlik);
  for (const b of SERIT_HAZIR.get(kimlik) ?? []) b?.close();
  SERIT_HAZIR.delete(kimlik);
  // İşçi yoksa kurulmuyor: bırakacak bir şeyi de yok.
  if (isci) isci.postMessage({ birak: kimlik } satisfies SeritIstegi);
}

/* ── Şerit işçisi ─────────────────────────────────────────────────────── */

/** `undefined`: henüz denenmedi; `null`: yok (eski tarayıcı) ya da düştü. */
let isci: Worker | null | undefined;
const BEKLEYEN = new Map<number, (k: (ImageBitmap | null)[] | null) => void>();
let istekSayaci = 0;

function seritIscisi(): Worker | null {
  if (isci !== undefined) return isci;
  try {
    if (typeof Worker === 'undefined') return (isci = null);
    const i = new Worker(new URL('./seritIsci.ts', import.meta.url), { type: 'module' });
    i.onmessage = (e: MessageEvent<SeritCevabi>) => {
      const coz = BEKLEYEN.get(e.data.id);
      BEKLEYEN.delete(e.data.id);
      coz?.(e.data.kesik);
    };
    // Yüklenemedi ya da düştü: bekleyenler ve sonrakiler burada kesiliyor.
    i.onerror = () => {
      isci = null;
      const hepsi = [...BEKLEYEN.values()];
      BEKLEYEN.clear();
      for (const coz of hepsi) coz(null);
    };
    isci = i;
  } catch {
    isci = null;
  }
  return isci;
}

function isciyleKes(
  kimlik: string,
  png: Blob,
  kutular: (SeritKutusu | null)[],
): Promise<(ImageBitmap | null)[] | null> {
  const i = seritIscisi();
  if (!i) return Promise.resolve(null);
  return new Promise((coz) => {
    const id = ++istekSayaci;
    BEKLEYEN.set(id, coz);
    i.postMessage({ id, kimlik, png, kutular } satisfies SeritIstegi);
  });
}

/**
 * Şeritleri keser (kutularla aynı sırada; boş kutunun yeri boş): PNG'si
 * olan ve burada çözülmemiş atlasınkini işçide, gerisini burada.
 */
async function kes(
  kimlik: string,
  kutular: (SeritKutusu | null)[],
): Promise<(ImageBitmap | null)[] | null> {
  const png = ATLAS_KAYNAK.get(kimlik);
  if (png && !ATLASLAR.has(kimlik)) {
    const k = await isciyleKes(kimlik, png, kutular);
    if (k) return k;
  }
  const atlas = await glAtlasYukle(kimlik);
  if (!atlas) return null;
  return Promise.all(
    kutular.map((k) => (k ? createImageBitmap(atlas, ...k).catch(() => null) : null)),
  );
}

/* ── Şeritler ─────────────────────────────────────────────────────────── */

/**
 * Önceden kesilmiş şeritler (atlas kimliği → parça sırasıyla): resim
 * gösterilmeden kesiliyor (`glOnYukle`), ilk kurulan tuval kendisininkini
 * alıyor (`glSerit`). Şerit tuvali bitmap'i kopyasız gösteriyor
 * (`bitmaprenderer`); 2d tuvale çizmek 41 tuvalde ana iş parçacığını
 * donduruyordu (her tuval kendi GPU kaynağını o karede üretiyordu).
 * Alınmayanlar (sahneden önce çıkıldı) bir süre sonra kapatılıyor.
 */
const SERIT_HAZIR = new Map<string, (ImageBitmap | undefined)[]>();
const SERIT_BEKLE = 10_000;

/** Parçanın atlastaki şeridi (x, y, en, boy; çıktı pikseli). */
export function seritKutusu(
  b: AtlasKatmani,
  duzen: ReturnType<typeof atlasDuzeni>,
  i: number,
): SeritKutusu {
  const [, , w, h] = b.kutular[i]!;
  const sutun = duzen.sutun[i]!;
  return [duzen.yer[i]![0], duzen.yer[i]![1], sutun * w, (b.kareSayilari[i]! / sutun) * h];
}

export async function seritleriHazirla(b: AtlasKatmani): Promise<void> {
  const kimlik = b.url;
  if (SERIT_HAZIR.has(kimlik)) return;
  const duzen = atlasDuzeni(b.kutular, b.kareSayilari);
  const kesik = await kes(
    kimlik,
    b.kutular.map(([, , w, h], i) => (w > 0 && h > 0 ? seritKutusu(b, duzen, i) : null)),
  );
  if (!kesik) return;
  if (SERIT_HAZIR.has(kimlik) || (!ATLASLAR.has(kimlik) && !ATLAS_KAYNAK.has(kimlik))) {
    // O arada bırakıldı (ya da başkası kesti).
    for (const k of kesik) k?.close();
    return;
  }
  const hazir = kesik.map((k) => k ?? undefined);
  SERIT_HAZIR.set(kimlik, hazir);
  setTimeout(() => {
    const l = SERIT_HAZIR.get(kimlik);
    if (l !== hazir) return;
    for (const k of l) k?.close();
    SERIT_HAZIR.delete(kimlik);
  }, SERIT_BEKLE);
}

/** Önceden kesilmiş şerit (bir kez verilir: tuval onu sahipleniyor). */
export function glSerit(kimlik: string, i: number): ImageBitmap | undefined {
  const l = SERIT_HAZIR.get(kimlik);
  const b = l?.[i];
  if (l) l[i] = undefined;
  return b;
}

/** Şeridi atlastan keser (önceden kesilmişi yoksa: sahne yeniden kurulunca). */
export async function glSeritKes(kimlik: string, kutu: SeritKutusu): Promise<ImageBitmap | null> {
  return (await kes(kimlik, [kutu]))?.[0] ?? null;
}

/** Çözülmüş atlas, varsa (eşzamanlı: çizim aynı karede). Kapatılmışın eni 0. */
function glAtlas(kimlik: string): ImageBitmap | undefined {
  const a = ATLASLAR.get(kimlik);
  return a && a.width > 0 ? a : undefined;
}

/** Atlası burada çözer (gerekirse; çözme ana iş parçacığının dışında). */
function glAtlasYukle(kimlik: string): Promise<ImageBitmap | null> {
  const var_ = glAtlas(kimlik);
  if (var_) {
    atlasSakla(kimlik, var_);
    return Promise.resolve(var_);
  }
  let p = ATLAS_COZULEN.get(kimlik);
  if (!p) {
    const png = ATLAS_KAYNAK.get(kimlik);
    p = png
      ? createImageBitmap(png).then(
          (b) => {
            // O arada bırakıldıysa (yama değişti) tutulmuyor.
            if (!ATLAS_KAYNAK.has(kimlik)) {
              b.close();
              return null;
            }
            atlasSakla(kimlik, b);
            return b;
          },
          () => null,
        )
      : Promise.resolve(null);
    ATLAS_COZULEN.set(kimlik, p);
    void p.finally(() => ATLAS_COZULEN.delete(kimlik));
  }
  return p;
}
