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
 * ve bölge afişleri (giriş ekranının manzarası da) aynı yolla. Ardından
 * "ekran zeminlerini de kalıcı yap": ekranların tepesindeki manzara
 * şeritleri de. Sonra "portreleri ve binaları da kalıcı yap": küçük ama
 * çok sayıda (üst çubuktaki portre, Şehir'in yapı simgeleri) — her biri
 * sırada büyük çizimlerin arkasında bekliyordu. Ardından "birlikleri,
 * düşmanları ve ekipmanı da kalıcı yap": figürler ve eşyalar da.
 *
 * Her kayıt bir YUVADA: ana resimde yuva çizimin kendi anahtarı; yamada
 * sahnenin tek yuvası (son yama, hangi bölge olduğu ekinde). Kayıtlar çizim
 * sürümüyle (`vite-cizim-surumu.mjs`: çizim kodunun ve verinin içerik
 * özeti) yazılıyor; sürümü tutmayan kayıt okunmuyor, siliniyor.
 *
 * Kayıtlar GRUPLARDA, her grubun kendi sınırı var (`SINIR`): en uzun
 * süredir kullanılmayan, yalnız kendi grubundan atılıyor. Bölgeden bölgeye
 * gezen oyuncunun afişleri telefonda en uzun çizilen yerleşkeyi atmasın.
 *  - `sahne`: yakınlaşan büyük sahneler. Yerleşkenin canlı resmi, bir
 *    sonraki vaktin önceden çizilmiş resmi (`gl.glOnceden`) ve yaması üç
 *    kayıt, dünya haritasının zemini ve yaması iki, her diyar haritasının
 *    zemini ve yaması iki: yerleşke, dünya haritası ve üç diyar sığıyor.
 *  - `afis`: diyar kapakları (beşi) ve bölge afişleri (altı tür, üçer
 *    aşama; panelin iki boyu): kapaklar ve on bir afiş sığıyor.
 *  - `zemin`: ekran zeminleri (on bir ekranın manzara şeridi): hepsi
 *    sığıyor, ekrandan ekrana geçen oyuncu hiçbirini yeniden çizmiyor.
 *  - `portre`: portreler (yirmi iki; üst çubukta, sohbette, profilde
 *    ayrı boylarda). Kayıt küçük, sınır geniş.
 *  - `bina`: yapı çizimleri (otuz dört aşama; simge ve karo boyunda).
 *  - `nesne`: birlik, düşman, ekipman (aynı bileşendeki general ve lord
 *    figürleri de): altmış iki çizim, liste ve ayrıntı boyunda.
 *  - `karo`: kapak ve afişin küçük hareketsiz hâli (kilitli diyarın gri
 *    penceresi, sayfa kasasındaki bölge karosu). Büyük afişlerin grubunda
 *    olsalar sınırı sayıyla doldurup onları atarlardı.
 *  - `galeri`: geliştirme galerisi (`Galeri.tsx`, yalnız geliştirmede): her
 *    çizim bir arada, yüz yetmişi aşkın; hepsi sığıyor. Oyunun gruplarına
 *    yazsa onları bir açılışta doldurup oyunun kayıtlarını atardı.
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
export type KaliciGrup =
  'sahne' | 'afis' | 'zemin' | 'savas' | 'portre' | 'bina' | 'nesne' | 'karo' | 'galeri';
export const SINIR: Record<KaliciGrup, number> = {
  sahne: 12,
  afis: 16,
  zemin: 12,
  // Savaş raporu sahneleri (savas.ts): son açılan raporlar; eskisi düşüyor.
  savas: 16,
  portre: 40,
  bina: 48,
  nesne: 128,
  karo: 32,
  galeri: 200,
};

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

/**
 * Bu açılışın sayaçları (telefonda ölçüm, `kaliciDurumu`): her hata sessizce
 * boş dönüyor, rapor neyin olmadığını söylesin ("Kayıttan: 0" iki raporda
 * da; kayıt hiç yazılmadı mı, sürüm mü değişti, depo mu açılmadı).
 */
const SAYAC = { okunan: 0, yok: 0, eski: 0, yazilan: 0, yazmaHatasi: 0 };
let acilmadi = false;
let sonHata: string | undefined;

function hata(h: unknown) {
  sonHata =
    h instanceof DOMException || h instanceof Error ? h.name : typeof h === 'string' ? h : 'hata';
}

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
      r.onerror = () => {
        acilmadi = true;
        hata(r.error ?? 'acilmadi');
        coz(null);
      };
      r.onblocked = () => {
        acilmadi = true;
        hata('engellendi');
        coz(null);
      };
    } catch (h) {
      acilmadi = true;
      hata(h);
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

/** Yazılacak kayıtlar sırayla: aynı yuvaya üst üste yazım karışmasın. */
let yazim: Promise<unknown> = Promise.resolve();

/**
 * Yuvadaki kaydı okur; sürümü tutmuyorsa boş döner (kayıt sonradan
 * siliniyor). Okunan kaydın zamanı yenileniyor (her açılışta okunan resim
 * en eski sayılıp atılmasın), ama ancak `YENILE_MS`den eskiyse ve sonradan
 * (`sonradanDuzelt`).
 *
 * Önceden okuma kaydı aynı işlemde yeniden yazıyordu (resimleriyle). Telefon
 * raporu (uygulama, ikinci açılış: 54 kayıt okundu): kayıttan açılan ekran
 * okumanın devamında 94–351 ms donuyordu (`IDBRequest.onsuccess`); yazan
 * işlemler de sırayla yürüdüğünden açılıştaki okumalar birbirini bekliyordu.
 * Artık okuma yalnız okuyor (`readonly`, okumalar bir arada yürüyor).
 */
export async function kaliciOku(yuva: string): Promise<KaliciKayit | null> {
  const db = await ac();
  if (!db) return null;
  try {
    const depo = db.transaction(DEPO, 'readonly').objectStore(DEPO);
    const k = (await iste(depo.get(yuva))) as KaliciKayit | undefined | null;
    if (!k) {
      SAYAC.yok++;
      return null;
    }
    if (k.surum !== SURUM) {
      SAYAC.eski++;
      sonradanDuzelt(yuva, k.zaman);
      return null;
    }
    SAYAC.okunan++;
    if (Date.now() - k.zaman > YENILE_MS) sonradanDuzelt(yuva, k.zaman);
    return k;
  } catch (h) {
    hata(h);
    return null;
  }
}

/**
 * Okunan kaydın zamanı ancak bu kadar eskiyse yenileniyor: bir saat içinde
 * yeniden okunanınki yenilenmiyor. Sıra yine yaklaşık en son kullanılan;
 * atılan yine en uzun süredir kullanılmayan.
 */
const YENILE_MS = 60 * 60_000;
/** Sonradan düzeltilecek yuvalar, okunduklarındaki zamanlarıyla. */
const DUZELT = new Map<string, number>();
let duzeltmeKurulu = false;

/**
 * Okunan kayıtları boşta, tek yazma işleminde düzeltir: sürümü eskiyse
 * siler, değilse zamanını yeniler. Arada yuvaya yenisi yazıldıysa (zamanı
 * başka) dokunulmuyor; yazımların sırasına giriyor (`yazim`).
 */
function sonradanDuzelt(yuva: string, zaman: number) {
  DUZELT.set(yuva, zaman);
  if (duzeltmeKurulu) return;
  duzeltmeKurulu = true;
  const calis = () => {
    duzeltmeKurulu = false;
    const liste = [...DUZELT];
    DUZELT.clear();
    yazim = yazim.then(async () => {
      const db = await ac();
      if (!db) return;
      try {
        const depo = db.transaction(DEPO, 'readwrite').objectStore(DEPO);
        for (const [y, z] of liste) {
          const k = (await iste(depo.get(y))) as KaliciKayit | undefined | null;
          if (!k || k.zaman !== z) continue;
          if (k.surum !== SURUM) depo.delete(y);
          else depo.put({ ...k, zaman: Date.now() });
        }
      } catch (h) {
        hata(h);
      }
    });
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(calis, { timeout: 5000 });
  else setTimeout(calis, 1000);
}

/**
 * Tarayıcıdan kalıcı depolama istenir (bir kez): yer daralınca "en iyi
 * çaba" verisi sorulmadan siliniyor. Chrome soru sormuyor; siteyle
 * etkileşime göre veriyor ya da vermiyor.
 */
let kaliciIstendi = false;
function kaliciIste() {
  if (kaliciIstendi) return;
  kaliciIstendi = true;
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* yok */
  }
}

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
      const bitti = new Promise<void>((coz) => {
        tx.oncomplete = () => {
          SAYAC.yazilan++;
          coz();
        };
        // Dolu depo (QuotaExceededError) işlemi böyle bitiriyor.
        tx.onabort = () => {
          SAYAC.yazmaHatasi++;
          hata(tx.error ?? 'iptal');
          coz();
        };
      });
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
      await bitti;
      kaliciIste();
    } catch (h) {
      // Dolu depo ya da kapalı sekme: bir dahaki açılış yeniden çizer.
      SAYAC.yazmaHatasi++;
      hata(h);
    }
  });
}

/** Cihaz kaydının durumu (telefonda ölçüm raporu, `CizimOlcumPaneli`). */
export interface KaliciDurum {
  /** Depo açıldı mı (açılmadıysa her şey her açılışta yeniden çiziliyor). */
  acik: boolean;
  surum: string;
  /** Depodaki kayıtlar ve bu sürümün kayıtları. */
  kayit: number;
  guncel: number;
  okunan: number;
  /** Okunmak istenip bulunamayan, sürümü eski çıkan. */
  yok: number;
  eski: number;
  yazilan: number;
  yazmaHatasi: number;
  sonHata?: string;
  /** Tarayıcı veriyi kalıcı tutuyor mu (`navigator.storage.persisted`). */
  kalici?: boolean;
  /** Kullanılan ve izin verilen (bayt). */
  kullanim?: number;
  kota?: number;
}

export async function kaliciDurumu(): Promise<KaliciDurum> {
  const d: KaliciDurum = { acik: false, surum: SURUM, kayit: 0, guncel: 0, ...SAYAC, sonHata };
  try {
    d.kalici = await navigator.storage?.persisted?.();
    const t = await navigator.storage?.estimate?.();
    d.kullanim = t?.usage;
    d.kota = t?.quota;
  } catch {
    /* yok */
  }
  const db = acilmadi ? null : await ac();
  if (!db) return d;
  d.acik = true;
  try {
    const imlec = db.transaction(DEPO, 'readonly').objectStore(DEPO).openCursor();
    await new Promise<void>((coz) => {
      imlec.onsuccess = () => {
        const c = imlec.result;
        if (!c) return coz();
        d.kayit++;
        if ((c.value as KaliciKayit).surum === SURUM) d.guncel++;
        c.continue();
      };
      imlec.onerror = () => coz();
    });
  } catch (h) {
    hata(h);
    d.sonHata = sonHata;
  }
  return d;
}
