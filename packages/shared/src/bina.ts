/**
 * Şehir binaları — inşa, seviye ve yerleşim kademesi.
 *
 * ── Neden bina seviyesi araştırmayla çakışmıyor ──────────────────────
 *
 * İki sistem farklı CİNSTEN şey veriyor ve ilkesi tek cümle:
 *
 *   **Araştırma ORAN verir, bina KAPASİTE ve KİLİT verir.**
 *
 * Araştırma "%15 daha hızlı eğit" der — yüzde çarpanı, küresel, kalıcı,
 * sırası oyuncunun seçimi. Bina "aynı anda 2 eğitim kuyruğu" der — sayı
 * ve erişim. İkisi hiçbir zaman aynı sayıya dokunmuyor: bir bina
 * hızlandırmıyor, bir araştırma slot açmıyor.
 *
 * Bu ayrım olmasa iki sistem aynı çarpanı üst üste bindirir ve denge
 * tartışmasında hangisinin düzeltileceği belli olmazdı (docs/12 §4).
 *
 * ── Yan kazanç ───────────────────────────────────────────────────────
 *
 * Bu sayıların çoğu eskiden `lord.level`'dan geliyordu: ekipman
 * kademesi, depo tabanı, pazar tavanı, general slotu. Lord seviyesi her
 * şeyi birden açan sihirli bir sayıydı; binaya taşımak onu yalnız XP ve
 * bölge sınırının ölçüsü hâline getiriyor. Yani bina seviyesi bir
 * katman eklemiyor, mevcut bir kusuru düzeltiyor.
 *
 * ── Yerleşim kademesi bir TAVAN ──────────────────────────────────────
 *
 * Kademe ayrı bir sayaç değil; başkent bölgenin türü ve seviyesinden
 * türetiliyor. İkinci bir doğruluk kaynağı yok. Kademe bina seviyesine
 * tavan koyuyor ve fetihin karşılığı bu: T5 ekipman dövmek için gerçek
 * bir şehir gerekiyor.
 */
import { B, BINALAR } from './balance.js';
import type { RegionType, Resources } from './types.js';

/** Yerleşim kademeleri, küçükten büyüğe. */
/**
 * BAŞKENT olabilen bölge türleri — yani YERLEŞİMLER.
 *
 * Tarla ve maden bir gelir kaynağı, bir yerleşim değil: oyuncu bir
 * buğday tarlasında oturmuyor. Sıra da anlamlı — dizideki yer "daha
 * iyi" demek ve başkent düşerken en iyi kalan buradan seçiliyor
 * (`services/region.ts`).
 *
 * Burada duruyor çünkü üç yer birden soruyor: ilk başkent ataması
 * (march), başkent taşıma ve düşme (sehir, region). Üçünde ayrı bir
 * dizi vardı; biri güncellenip ötekiler unutulduğunda oyuncu bir yere
 * taşınabilir ama oradan düşemez hâle gelirdi.
 */
export const BASKENT_TURLERI: readonly string[] = ['koy', 'sehir', 'kale', 'taht'];

export const KADEMELER = ['kamp', 'koy', 'kasaba', 'sehir', 'kale', 'metropol'] as const;
export type Kademe = (typeof KADEMELER)[number];

export const KADEME_ADI: Record<Kademe, string> = {
  kamp: 'Kamp',
  koy: 'Köy',
  kasaba: 'Kasaba',
  sehir: 'Şehir',
  kale: 'Kale-şehir',
  metropol: 'Metropol',
};

export const KADEME_OZETI: Record<Kademe, string> = {
  kamp: 'Bir ateş, birkaç çadır. Henüz toprağın yok.',
  koy: 'Çamurlu bir yol, ahşap evler, bir palisad.',
  kasaba: 'Taş bir meydan, ilk sur, bir çarşı.',
  sehir: 'Forum, su kemeri, tapınak. Artık bir şehirsin.',
  kale: 'Surlar hâkim. Askerî bir yerleşim.',
  metropol: 'Diyarın merkezi.',
};

/**
 * Başkent bölgeden yerleşim kademesini türetir.
 *
 * `null` başkent = kamp. Bu geçerli bir durum, hata değil: oyuna
 * toprakSIZ başlanıyor ve başkentini kaybeden lord da buraya düşüyor
 * (docs/12 §2.3).
 */
export function yerlesimKademesi(baskentTuru: RegionType | null, baskentSeviyesi: number): Kademe {
  if (!baskentTuru) return 'kamp';
  switch (baskentTuru) {
    case 'koy':
      return 'koy';
    case 'kale':
      return 'kale';
    case 'taht':
      return 'metropol';
    case 'sehir':
      return baskentSeviyesi >= 3 ? 'sehir' : 'kasaba';
    default:
      // Tarla ve maden yerleşim değil; başkent olamazlar. Buraya
      // düşülürse veri bozuk demektir, oyunu kırmak yerine kampa düşüyoruz.
      return 'kamp';
  }
}

/** Bu kademede bir binanın çıkabileceği en yüksek seviye. */
export function kademeTavani(kademe: Kademe, binaKey?: string): number {
  const taban = B.binalar.kademe_tavani[kademe] ?? 1;
  // Kale-şehrin tek ayrıcalığı: surlar bir seviye fazlasına çıkıyor.
  if (kademe === 'kale' && binaKey === 'surlar') {
    return Math.min(B.binalar.azami_seviye, taban + B.binalar.kale_sur_ayricaligi);
  }
  return taban;
}

/** Arsası bu kademede görünen binalar (küçükten büyüğe kademe sırası). */
export function kademedeGorunur(kademe: Kademe, acilisKademesi: string): boolean {
  const su = KADEMELER.indexOf(kademe);
  const gereken = KADEMELER.indexOf(acilisKademesi as Kademe);
  if (gereken < 0) return true;
  // Kale ve metropol, şehirden büyük sayılıyor: sıralamada zaten sonra
  // geliyorlar, o yüzden ayrı bir kural gerekmiyor.
  return su >= gereken;
}

/** Bir binayı N. seviyeye çıkarmanın bedeli. */
export function binaMaliyeti(binaKey: string, hedefSeviye: number): Resources {
  const bina = BINALAR.find((b) => b.key === binaKey);
  const carpan = bina?.maliyet_carpani ?? 1;
  const us = Math.pow(B.binalar.maliyet_us, Math.max(0, hedefSeviye - 1));
  const t = B.binalar.maliyet_taban;
  return {
    altin: Math.round(t.altin * carpan * us),
    demir: Math.round(t.demir * carpan * us),
    erzak: Math.round(t.erzak * carpan * us),
  };
}

/** Bir binayı N. seviyeye çıkarmanın süresi (saniye). */
export function binaSuresiSn(hedefSeviye: number): number {
  const dk =
    B.binalar.sure_taban_dakika * Math.pow(B.binalar.sure_us, Math.max(0, hedefSeviye - 1));
  return Math.round(dk * 60);
}

/** Kayıtlı bina seviyeleri; bilinmeyen bina 0 (dikilmemiş). */
export function binaSeviyesi(binalar: Record<string, number>, key: string): number {
  const n = binalar[key];
  return typeof n === 'number' && n > 0 ? n : 0;
}

export interface BinaDurumu {
  key: string;
  ad: string;
  ozet: string;
  aciklama: string;
  x: number;
  /** Binanın AYAK BASTIĞI y — merkezi değil (sprite tabanından çakılıyor). */
  y: number;
  /** Taban boyun çarpanı: malikâne 1.25, görev panosu 0.60. */
  olcek: number;
  seviye: number;
  seviyeli: boolean;
  /** Bu kademede çıkabileceği en yüksek seviye. */
  tavan: number;
  /** Sıradaki seviyeye çıkarılabilir mi. */
  yukseltilebilir: boolean;
  /** Çıkarılamıyorsa tek cümlelik sebep. */
  engel: string | null;
  /** Sıradaki seviyenin bedeli; tavandaysa null. */
  maliyet: Resources | null;
  sureSn: number | null;
  /** Seviyenin ne verdiği: "Eş zamanlı eğitim" gibi. */
  etkiMetni: string | null;
  /**
   * Etkinin ŞU ANKİ ve BİR SONRAKİ değeri.
   *
   * Kart eskiden "Depo tabanı: 1 → 2" yazıyordu; o iki sayı binanın
   * SEVİYESİYDİ, etkisi değil. Oyuncu 1200 altın harcadıktan sonra ne
   * kazanacağını hiçbir yerde göremiyordu (docs/09 İ1). Tavandaysa
   * `etkiSonra` null.
   */
  etkiSimdi: number | null;
  etkiSonra: number | null;
  /** Sayının nasıl yazılacağı: düz sayı, saniye ya da oran. */
  etkiBirimi: 'sayi' | 'saniye' | 'oran' | null;
  /** Açtığı kapı/sekme/bölüm — arayüz yönlendirmeyi buradan kuruyor. */
  kapi: string | null;
  sekme: string | null;
  bolum: string | null;
  /** İnşaat sürüyor mu (arayüz kuyruktan dolduruyor). */
  insaatta: boolean;
}

/**
 * Şehir sayfasının göstereceği bina listesi.
 *
 * Dikilmemiş bina LİSTEDEN ÇIKMIYOR, "boş arsa" olarak duruyor: oyuncu
 * oyunun tamamını ilk dakikada görmeli ama hepsi birden üstüne
 * gelmemeli. Arsaya dokununca ne işe yaradığını ve bedelini söylüyor.
 */
export function binaDurumlari(
  binalar: Record<string, number>,
  kademe: Kademe,
  kaynak: Resources,
  insaattakiler: readonly string[] = [],
): BinaDurumu[] {
  return BINALAR.filter((b) => kademedeGorunur(kademe, b.acilis_kademesi)).map((b) => {
    /*
     * SEVİYESİZ yapılar hep ORADA.
     *
     * Görev panosu, haberci kulesi, onur meydanı bilgi gösteriyor,
     * kapasite vermiyor. İnşa ettirmek saçma olurdu: oyuncu günlük
     * görevlerini görebilmek için ilan tahtası mı dikecek? Kademesi
     * geldiğinde kendiliğinden duruyorlar.
     */
    if (!b.seviyeli) {
      return {
        key: b.key,
        ad: b.ad,
        ozet: b.ozet,
        aciklama: b.aciklama,
        x: b.x,
        y: b.y,
        olcek: b.olcek,
        seviye: 1,
        seviyeli: false,
        tavan: 1,
        yukseltilebilir: false,
        engel: null,
        maliyet: null,
        sureSn: null,
        etkiMetni: null,
        etkiSimdi: null,
        etkiSonra: null,
        etkiBirimi: null,
        kapi: b.kapi ?? null,
        sekme: b.sekme ?? null,
        bolum: b.bolum ?? null,
        insaatta: false,
      };
    }

    const seviye = binaSeviyesi(binalar, b.key);
    const tavan = kademeTavani(kademe, b.key);
    const hedef = seviye + 1;
    const insaatta = insaattakiler.includes(b.key);
    const maliyet = hedef <= tavan ? binaMaliyeti(b.key, hedef) : null;

    let engel: string | null = null;
    if (insaatta) engel = 'Şu an inşa ediliyor.';
    else if (hedef > tavan) {
      engel =
        seviye >= B.binalar.azami_seviye
          ? 'En yüksek seviyede.'
          : `${KADEME_ADI[kademe]} için tavan. Daha büyük bir yerleşim gerekiyor.`;
    } else if (maliyet) {
      const eksik: string[] = [];
      if (kaynak.altin < maliyet.altin) eksik.push('altın');
      if (kaynak.demir < maliyet.demir) eksik.push('demir');
      if (kaynak.erzak < maliyet.erzak) eksik.push('erzak');
      if (eksik.length > 0) engel = `${eksik.join(' ve ')} yetmiyor.`;
    }

    return {
      key: b.key,
      ad: b.ad,
      ozet: b.ozet,
      aciklama: b.aciklama,
      x: b.x,
      y: b.y,
      olcek: b.olcek,
      seviye,
      seviyeli: b.seviyeli,
      tavan,
      yukseltilebilir: engel === null,
      engel,
      maliyet,
      sureSn: maliyet ? binaSuresiSn(hedef) : null,
      etkiMetni: b.etki_metni ?? null,
      etkiSimdi: etkiDegeri(b.key, seviye),
      etkiSonra: hedef <= tavan ? etkiDegeri(b.key, hedef) : null,
      etkiBirimi: etkiBirimi(b.key),
      kapi: b.kapi ?? null,
      sekme: b.sekme ?? null,
      bolum: b.bolum ?? null,
      insaatta,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Bina seviyesinin ETKİSİ (Y4)
 *
 * İlke değişmedi: **araştırma ORAN verir, bina KAPASİTE ve KİLİT verir**
 * (docs/12 §4). Buradaki her sayı bir adet, bir tavan ya da bir kilit;
 * hiçbiri yüzde değil.
 *
 * Tablolar `balance.json → binalar.etkiler` içinde ve dizinin indeksi
 * bina seviyesi. **Seviye 0 değeri, Y4 öncesi oyunun davranışıdır**:
 * bina sistemi kimsenin elinden bir şey almıyor, her seviye bir kazanç
 * ekliyor. Tersini kursaydık var olan lordların deposu ve kuyruğu bir
 * gecede küçülür, sonraki denge tartışması da "binalar mı bozdu, sayılar
 * mı yanlıştı" diye cevapsız kalırdı.
 * ------------------------------------------------------------------ */

/** Bir etki tablosunun hangi binanın seviyesini okuduğu. */
const ETKI_BINASI: Record<string, string> = {
  malikane_depo_ek: 'malikane',
  kisla_egitim_kuyrugu: 'kisla',
  demirhane_azami_tier: 'demirhane',
  karargah_general_slotu_ek: 'karargah',
  kutuphane_arastirma_kuyrugu: 'kutuphane',
  hastane_azami_tedavi_saniye: 'hastane',
  pazar_takas_tavani_ek: 'pazar',
  liman_sevkiyat_tavani_ek: 'liman',
  elcilik_takviye_slotu: 'elcilik',
  surlar_tahkimat_ek: 'surlar',
};

/** Binadan etki tablosuna: `ETKI_BINASI`'nin tersi, tek yerden türüyor. */
const BINANIN_ETKISI: Record<string, string> = Object.fromEntries(
  Object.entries(ETKI_BINASI).map(([etki, bina]) => [bina, etki]),
);

/**
 * Binanın verilen SEVİYEDEKİ etki değeri; etkisi olmayan binada null.
 *
 * Şehir kartı bunu gösteriyor: "Depo tabanı 15.000 → 35.000". Eskiden
 * kartta binanın seviyesi yazıyordu ve oyuncu 1200 altın harcamadan
 * önce ne kazanacağını hiçbir yerde göremiyordu.
 */
export function etkiDegeri(binaKey: string, seviye: number): number | null {
  const etki = BINANIN_ETKISI[binaKey];
  if (!etki) return null;
  const tablo = (B.binalar.etkiler as unknown as Record<string, number[]>)[etki];
  if (!Array.isArray(tablo) || tablo.length === 0) return null;
  return tablo[Math.min(Math.max(0, seviye), tablo.length - 1)] ?? null;
}

/**
 * Etkinin birimi: arayüz sayıyı nasıl yazacağını buradan biliyor.
 *
 * Sayının kendisinden çıkarmaya çalışmak (0,04 gördüysem oran demektir
 * gibi) ilk küçük değerde yanlış biçim verirdi.
 */
export function etkiBirimi(binaKey: string): 'sayi' | 'saniye' | 'oran' | null {
  const etki = BINANIN_ETKISI[binaKey];
  if (!etki) return null;
  if (etki.endsWith('_saniye')) return 'saniye';
  if (etki === 'surlar_tahkimat_ek') return 'oran';
  return 'sayi';
}

/**
 * Bir etki tablosunu binanın seviyesiyle okur.
 *
 * Seviye tablonun boyunu aşarsa son değer veriliyor: kademe tavanı zaten
 * `azami_seviye`yi geçirmiyor ama tabloyu kısaltmak bir gün sessizce
 * `undefined` döndürmesin diye burada da bir tutamak var.
 */
export function binaEtkisi(binalar: Record<string, number>, etki: string): number {
  const tablo = (B.binalar.etkiler as unknown as Record<string, number[]>)[etki];
  if (!Array.isArray(tablo) || tablo.length === 0) return 0;
  const seviye = binaSeviyesi(binalar, ETKI_BINASI[etki] ?? '');
  return tablo[Math.min(seviye, tablo.length - 1)] ?? 0;
}

/** Malikânenin depo kapasitesine kattığı ham miktar. */
export const depoEki = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'malikane_depo_ek');

/** Aynı anda açılabilecek asker eğitim kuyruğu. */
export const egitimKuyrugu = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'kisla_egitim_kuyrugu');

/**
 * Demirhanenin izin verdiği en yüksek ekipman kademesi.
 *
 * Lord seviyesi kapısı DURUYOR; bu ikinci bir kapı. T5 hem 50. seviye
 * hem 4. seviye demirhane istiyor, 4. seviye demirhane de bir şehir —
 * "fethin karşılığı" cümlesi burada bir sayıya dönüşüyor.
 */
export const azamiTier = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'demirhane_azami_tier');

/**
 * Bir ekipman kademesi için gereken en düşük demirhane seviyesi.
 *
 * `demirhane_azami_tier` tablosunun tersi. Elle ikinci bir tablo yazmak,
 * birini değiştirip ötekini unutunca oyuncuya yanlış hedef göstermek
 * demekti; burada aynı diziden türetiliyor.
 */
export function gerekenDemirhaneSeviyesi(tier: number): number {
  const tablo = (B.binalar.etkiler as unknown as Record<string, number[]>).demirhane_azami_tier;
  if (!Array.isArray(tablo)) return 0;
  const i = tablo.findIndex((azami) => azami >= tier);
  return i < 0 ? tablo.length - 1 : i;
}

/** Karargâhın liderliğin üstüne kattığı general slotu. */
export const generalSlotuEki = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'karargah_general_slotu_ek');

/** Aynı anda yürütülebilecek araştırma. */
export const arastirmaKuyrugu = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'kutuphane_arastirma_kuyrugu');

/**
 * Bir tedavinin sürebileceği EN UZUN zaman (saniye).
 *
 * Hastanenin eş zamanlı kuyruğu yok ve olmamalı — tedavi bir tercih
 * değil, savaşın sonucu (services/queue.ts). Onun yerine hastane BÜYÜK
 * YENİLGİYİ kısaltıyor: küçük kafileler zaten tavana çarpmıyor, değişen
 * tek şey yüzlerce yaralının döndüğü gün.
 */
export const azamiTedaviSn = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'hastane_azami_tedavi_saniye');

/** Pazarın günlük takas tavanına kattığı miktar (altın karşılığı). */
export const takasTavaniEki = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'pazar_takas_tavani_ek');

/** Limanın günlük sevkiyat tavanına kattığı miktar. */
export const sevkiyatTavaniEki = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'liman_sevkiyat_tavani_ek');

/** Aynı anda sahada tutulabilecek takviye sayısı. */
export const takviyeSlotu = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'elcilik_takviye_slotu');

/**
 * Surların BAŞKENTE kattığı tahkimat oranı.
 *
 * Yalnız başkente: öteki bölgelerin tahkimatı türlerinden geliyor ve
 * öyle kalmalı. Surlar oyuncunun oturduğu yeri savunuyor, bütün
 * imparatorluğunu değil.
 */
export const tahkimatEki = (binalar: Record<string, number>): number =>
  binaEtkisi(binalar, 'surlar_tahkimat_ek');

/**
 * Bir kuyruk türünün eş zamanlı sınırı.
 *
 * Kışla eğitim kuyruğunu, kütüphane araştırma kuyruğunu belirliyor;
 * ötekiler `balance.json → kuyruklar.es_zamanli` sabitleri. Sunucu da
 * arayüz de bu tek fonksiyonu çağırıyor: sayıyı iki yerde tutmak,
 * dolu kuyrukta düğmenin açık kalması demekti.
 */
export function esZamanliLimit(kind: string, binalar: Record<string, number>): number {
  if (kind === 'train') return egitimKuyrugu(binalar);
  if (kind === 'research') return arastirmaKuyrugu(binalar);
  return (B.kuyruklar.es_zamanli as unknown as Record<string, number>)[kind] ?? 1;
}
