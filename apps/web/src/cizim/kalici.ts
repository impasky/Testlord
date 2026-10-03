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
 * Sonra: "kapakları ve afişleri de kalıcı yap." Akın'ın diyar kapakları
 * ve bölge afişleri (giriş ekranının manzarası da) aynı yolla.
 *
 * Her kayıt bir YUVADA: ana resimde yuva çizimin kendi anahtarı; yamada
 * sahnenin tek yuvası (son yama, hangi bölge olduğu ekinde). Kayıtlar çizim
 * sürümüyle (`vite-cizim-surumu.mjs`: çizim kodunun ve verinin içerik
 * özeti) yazılıyor; sürümü tutmayan kayıt okunmuyor, siliniyor.
 *
 * Kayıtlar iki GRUPTA, her grubun kendi sınırı var (`SINIR`): en uzun
 * süredir kullanılmayan, yalnız kendi grubundan atılıyor. Bölgeden bölgeye
 * gezen oyuncunun afişleri telefonda en uzun çizilen yerleşkeyi atmasın.
 *  - `sahne`: yakınlaşan büyük sahneler. Yerleşkenin durağan ve canlı
 *    resmiyle yaması üç kayıt, dünya haritasının zemini ve yaması iki, her
 *    diyar haritasının zemini ve yaması iki: yerleşke, dünya haritası ve
 *    üç diyar sığıyor.
 *  - `afis`: diyar kapakları (beşi) ve bölge afişleri (altı tür, üçer
 *    aşama; panelin iki boyu): kapaklar ve on bir afiş sığıyor.
 *
 * Depo açılamazsa (gizli sekme, eski tarayıcı, test ortamı) her şey sessizce
 * boş: çizim eskisi gibi her açılışta.
 */
import type { CizimSonucu } from './glCizici';

declare const __CIZIM_SURUMU__: string;
/** Çizim sürümü: derlemede içerik özeti; özetin konmadığı yerde (testler) sabit. */
const SURUM: string = typeof __CIZIM_SURUMU__ === 'string' ? __CIZIM_SURUMU__ : 'gelistirme';

const VERITABANI = 'lordlar-cizim';
/** 2: kayıtlar gruplandı (eski, grupsuz kayıtlar atılıyor; yeniden çiziliyor). */
const SURUM_DB = 2;
const DEPO = 'resimler';
/**
 * Grup ve son kullanım zamanının dizini: bir grubun en eskisini değerleri
 * okumadan bulmak için.
 */
const GRUP_ZAMAN = 'grup_zaman';

/** Kaydın grubu (bkz. üstteki açıklama). */
export type KaliciGrup = 'sahne' | 'afis';
export const SINIR: Record<KaliciGrup, number> = { sahne: 12, afis: 16 };

export interface KaliciKayit {
  yuva: string;
  /** Çizimin `glCiz` anahtarı. */
  anahtar: string;
  grup: KaliciGrup;
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
      const r = indexedDB.open(VERITABANI, SURUM_DB);
      // Depo bir önbellek: biçim değişince eskisi atılıp yeniden kuruluyor.
      r.onupgradeneeded = () => {
        const db = r.result;
        if (db.objectStoreNames.contains(DEPO)) db.deleteObjectStore(DEPO);
        const depo = db.createObjectStore(DEPO, { keyPath: 'yuva' });
        depo.createIndex(GRUP_ZAMAN, ['grup', 'zaman']);
      };
      r.onsuccess = () => {
        // Yeni sürümü açan sekmeyi bekletme (eski sekme bağlantıyı bırakıyor).
        r.result.onversionchange = () => r.result.close();
        coz(r.result);
      };
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

/**
 * Yuvaya yazar (eskisinin yerine), sonra grubunda sınırın üstündeki en
 * eskileri atar.
 */
export function kaliciYaz(
  yuva: string,
  anahtar: string,
  sonuc: CizimSonucu,
  grup: KaliciGrup,
  ek?: unknown,
): void {
  yazim = yazim.then(async () => {
    const db = await ac();
    if (!db) return;
    try {
      const tx = db.transaction(DEPO, 'readwrite');
      const depo = tx.objectStore(DEPO);
      const kayit: KaliciKayit = {
        yuva,
        anahtar,
        grup,
        surum: SURUM,
        zaman: Date.now(),
        sonuc,
        ek,
      };
      await iste(depo.put(kayit));
      const dizin = depo.index(GRUP_ZAMAN);
      const aralik = IDBKeyRange.bound([grup, 0], [grup, Infinity]);
      const fazla = ((await iste(dizin.count(aralik))) ?? 0) - SINIR[grup];
      if (fazla > 0) {
        const eskiler = (await iste(dizin.getAllKeys(aralik, fazla))) ?? [];
        for (const y of eskiler) depo.delete(y);
      }
    } catch {
      /* dolu depo ya da kapalı sekme: bir dahaki açılış yeniden çizer */
    }
  });
}
