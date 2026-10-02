/**
 * Kalıcı çizim deposu (docs/24 "Yakınlaştırma"): GPU resimleri cihazda,
 * IndexedDB'de.
 *
 * Oyuncu: "keskin görüntü de kalıcı olsun." Yerleşkenin canlı resmi ve
 * yakındaki keskin yaması uygulama her açıldığında yeniden çiziliyordu
 * (telefonda saniyeler). Artık çizildiği gibi saklanıyor: resim, su, ışık
 * ve çimen katmanı, canlı parçaların atlası, duman kaynakları. Açılışta
 * yeniden çizilmeden geliyor.
 *
 * Her kayıt bir YUVADA: ana resimde yuva çizimin kendi anahtarı; yamada
 * sahnenin tek yuvası (son yama, hangi bölge olduğu ekinde). Kayıtlar çizim
 * sürümüyle (`vite-cizim-surumu.mjs`: çizim kodunun ve verinin içerik
 * özeti) yazılıyor; sürümü tutmayan kayıt okunmuyor, siliniyor. En çok
 * `SINIR` kayıt: en uzun süredir kullanılmayan atılıyor (bir sahnenin
 * durağan ve canlı resmiyle yaması üç kayıt; iki sahne sığıyor).
 *
 * Depo açılamazsa (gizli sekme, eski tarayıcı, test ortamı) her şey sessizce
 * boş: çizim eskisi gibi her açılışta.
 */
import type { CizimSonucu } from './glCizici';

declare const __CIZIM_SURUMU__: string;
/** Çizim sürümü: derlemede içerik özeti; özetin konmadığı yerde (testler) sabit. */
const SURUM: string = typeof __CIZIM_SURUMU__ === 'string' ? __CIZIM_SURUMU__ : 'gelistirme';

const VERITABANI = 'lordlar-cizim';
const DEPO = 'resimler';
/** Son kullanım zamanının dizini: en eskiyi değerleri okumadan bulmak için. */
const ZAMAN = 'zaman';
export const SINIR = 6;

export interface KaliciKayit {
  yuva: string;
  /** Çizimin `glCiz` anahtarı. */
  anahtar: string;
  surum: string;
  zaman: number;
  sonuc: CizimSonucu;
  /** Çağıranın eki (yama: bölgesi, yoğunluğu). */
  ek?: unknown;
}

let acilis: Promise<IDBDatabase | null> | undefined;

function ac(): Promise<IDBDatabase | null> {
  acilis ??= new Promise((coz) => {
    try {
      if (typeof indexedDB === 'undefined') return coz(null);
      const r = indexedDB.open(VERITABANI, 1);
      r.onupgradeneeded = () => {
        const depo = r.result.createObjectStore(DEPO, { keyPath: 'yuva' });
        depo.createIndex(ZAMAN, 'zaman');
      };
      r.onsuccess = () => coz(r.result);
      r.onerror = () => coz(null);
      r.onblocked = () => coz(null);
    } catch {
      coz(null);
    }
  });
  return acilis;
}

/** Bir isteği sözüne çevirir; hata da boş. */
function iste<T>(r: IDBRequest<T>): Promise<T | null> {
  return new Promise((coz) => {
    r.onsuccess = () => coz(r.result);
    r.onerror = () => coz(null);
  });
}

/**
 * Yuvadaki kaydı okur; sürümü tutmuyorsa siler ve boş döner. Okunan kaydın
 * zamanı yenileniyor: her açılışta okunan resim en eski sayılıp atılmasın.
 */
export async function kaliciOku(yuva: string): Promise<KaliciKayit | null> {
  const db = await ac();
  if (!db) return null;
  try {
    const depo = db.transaction(DEPO, 'readwrite').objectStore(DEPO);
    const k = (await iste(depo.get(yuva))) as KaliciKayit | undefined | null;
    if (!k) return null;
    if (k.surum !== SURUM) {
      depo.delete(yuva);
      return null;
    }
    depo.put({ ...k, zaman: Date.now() });
    return k;
  } catch {
    return null;
  }
}

/** Yazılacak kayıtlar sırayla: aynı yuvaya üst üste yazım karışmasın. */
let yazim: Promise<unknown> = Promise.resolve();

/** Yuvaya yazar (eskisinin yerine), sonra sınırın üstündeki en eskileri atar. */
export function kaliciYaz(yuva: string, anahtar: string, sonuc: CizimSonucu, ek?: unknown): void {
  yazim = yazim.then(async () => {
    const db = await ac();
    if (!db) return;
    try {
      const tx = db.transaction(DEPO, 'readwrite');
      const depo = tx.objectStore(DEPO);
      const kayit: KaliciKayit = { yuva, anahtar, surum: SURUM, zaman: Date.now(), sonuc, ek };
      await iste(depo.put(kayit));
      const fazla = ((await iste(depo.count())) ?? 0) - SINIR;
      if (fazla > 0) {
        const eskiler = (await iste(depo.index(ZAMAN).getAllKeys(null, fazla))) ?? [];
        for (const y of eskiler) depo.delete(y);
      }
    } catch {
      /* dolu depo ya da kapalı sekme: bir dahaki açılış yeniden çizer */
    }
  });
}
