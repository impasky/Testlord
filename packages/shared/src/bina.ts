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
  y: number;
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
        seviye: 1,
        seviyeli: false,
        tavan: 1,
        yukseltilebilir: false,
        engel: null,
        maliyet: null,
        sureSn: null,
        etkiMetni: null,
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
      seviye,
      seviyeli: b.seviyeli,
      tavan,
      yukseltilebilir: engel === null,
      engel,
      maliyet,
      sureSn: maliyet ? binaSuresiSn(hedef) : null,
      etkiMetni: b.etki_metni ?? null,
      kapi: b.kapi ?? null,
      sekme: b.sekme ?? null,
      bolum: b.bolum ?? null,
      insaatta,
    };
  });
}
