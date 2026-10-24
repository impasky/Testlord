/**
 * Şerit işçisi (docs/24 "GPU çizimi", Bayrak): cihaz kaydından gelen atlasın
 * PNG'sini çözüp canlı parçaların şeritlerini keser; kesikler aktarılarak
 * (kopyasız) dönüyor. Ana iş parçacığında kesmek (`createImageBitmap(atlas,
 * x, y, w, h)` orada eşzamanlı bir kopya) kayıttan açılan ekranı telefonda
 * 50–200 ms donduruyordu (uygulama raporu: `Promise.resolve`, `gl.ts`
 * atlas çözümünün devamı). Yalnız gösterim: çizim sürümüne girmiyor.
 *
 * Çözülmüş atlaslar burada tutuluyor (sahne yeniden kurulunca şerit
 * yeniden kesiliyor): toplamı `BUTCE`yi aşınca en eskisi kapatılıyor,
 * bırakılan (`birak`) hemen. Atlas çözülemezse cevap boş: sayfa o isteği
 * kendisi kesiyor (`atlas.ts`). Kesilemeyen tek şeridin yeri boş, sayfadaki
 * kesimde de öyle.
 */

/** Atlasta bir şeridin dikdörtgeni (x, y, en, boy; çıktı pikseli). */
export type SeritKutusu = [number, number, number, number];

export type SeritIstegi =
  { id: number; kimlik: string; png: Blob; kutular: (SeritKutusu | null)[] } | { birak: string };

export interface SeritCevabi {
  id: number;
  /** Kutularla aynı sırada; boş kutunun yeri boş. Kesilemediyse `null`. */
  kesik: (ImageBitmap | null)[] | null;
}

const kapsam = self as unknown as {
  onmessage: ((e: MessageEvent<SeritIstegi>) => void) | null;
  postMessage(c: SeritCevabi, aktar?: Transferable[]): void;
};

/** Çözülmüş atlaslar, en son kullanılan sonda. */
const COZULMUS = new Map<string, ImageBitmap>();
/** Çözülmekte olanlar: aynı atlas iki kez çözülmesin. */
const COZULEN = new Map<string, Promise<ImageBitmap | null>>();
/** Çözülürken bırakılanlar: bitince tutulmuyor. */
const BIRAKILAN = new Set<string>();
/** Çözülmüş atlasların toplam piksel sınırı (`atlas.ts` `ATLAS_BUTCE` gibi). */
const BUTCE = 16_000_000;

function atlasAl(kimlik: string, png: Blob): Promise<ImageBitmap | null> {
  const var_ = COZULMUS.get(kimlik);
  if (var_) {
    COZULMUS.delete(kimlik);
    COZULMUS.set(kimlik, var_);
    return Promise.resolve(var_);
  }
  let p = COZULEN.get(kimlik);
  if (!p) {
    BIRAKILAN.delete(kimlik);
    p = createImageBitmap(png).then(
      (b) => {
        COZULEN.delete(kimlik);
        if (BIRAKILAN.delete(kimlik)) {
          b.close();
          return null;
        }
        COZULMUS.set(kimlik, b);
        let toplam = 0;
        for (const a of COZULMUS.values()) toplam += a.width * a.height;
        for (const [k, a] of COZULMUS) {
          if (toplam <= BUTCE) break;
          if (k === kimlik) continue;
          toplam -= a.width * a.height;
          a.close();
          COZULMUS.delete(k);
        }
        return b;
      },
      () => {
        COZULEN.delete(kimlik);
        return null;
      },
    );
    COZULEN.set(kimlik, p);
  }
  return p;
}

kapsam.onmessage = async (e) => {
  const m = e.data;
  if ('birak' in m) {
    const a = COZULMUS.get(m.birak);
    if (a) {
      a.close();
      COZULMUS.delete(m.birak);
    } else if (COZULEN.has(m.birak)) BIRAKILAN.add(m.birak);
    return;
  }
  let atlas = await atlasAl(m.kimlik, m.png);
  // Bütçe için o arada kapatıldıysa (kapalının eni 0) yeniden çözülüyor.
  if (atlas && !atlas.width) atlas = await atlasAl(m.kimlik, m.png);
  if (!atlas?.width) {
    kapsam.postMessage({ id: m.id, kesik: null });
    return;
  }
  const a = atlas;
  const kesik = await Promise.all(
    m.kutular.map((k) => (k ? createImageBitmap(a, ...k).catch(() => null) : null)),
  );
  kapsam.postMessage(
    { id: m.id, kesik },
    kesik.filter((b): b is ImageBitmap => !!b),
  );
};
