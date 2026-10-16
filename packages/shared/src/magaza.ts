/**
 * MAĞAZA — öde, zamanı atla; öde, güç alma (docs/25).
 *
 * Satılan tek şey ELMAS (Google Play, Android uygulaması). Elmasın
 * harcandığı tek yer ZAMAN: oyuncunun KENDİ gelişim kuyruklarının kalan
 * süresi. Kaynak, asker, kalkan, saldırı yürüyüşü, casus satılmıyor ve
 * elmasla hızlanmıyor — bunlar oyuncular arası rekabete dokunuyor.
 * Hızlandırılan bir binanın sonucu beklenerek dikilenle birebir aynı.
 *
 * Ödüllü reklam da aynı çizgide ve ELMAS VERMİYOR: seçilen kuyruktan
 * süre siliyor; artan süre küçük bir bankada bekliyor.
 *
 * Bu dosya SAF: fiyat, sınır ve karar burada; sunucu ve arayüz aynı
 * fonksiyonu çağırıyor. Sayılar `balance.json` → `magaza` ve
 * `elmas.kuyruk_hizlandirma`.
 */
import { B } from './balance.js';

interface Paket {
  urun: string;
  ad: string;
  elmas: number;
  ek: number;
}

const M = B.magaza as unknown as {
  hizlandirilabilir: string[];
  paketler: Paket[];
  reklam: {
    odul_dakika: number;
    gunluk_tavan: number;
    bekleme_sn: number;
    banka_tavan_dakika: number;
    oturum_omru_dk: number;
    kisisellestirilmis: boolean;
    saklama_gun: number;
  };
};
const H = (
  B.elmas as unknown as { kuyruk_hizlandirma: { katsayi: number; us: number; asgari: number } }
).kuyruk_hizlandirma;

/* ------------------------------------------------------------------ */
/* Hızlandırma                                                         */
/* ------------------------------------------------------------------ */

/** Elmasla ya da reklam süresiyle kısaltılabilen kuyruk türleri. */
export const HIZLANDIRILABILIR: readonly string[] = M.hizlandirilabilir;

export function hizlandirilabilirMi(kind: string): boolean {
  return HIZLANDIRILABILIR.includes(kind);
}

/**
 * Kalan süreyi HEMEN bitirmenin elmas bedeli.
 *
 * Azalan dakika fiyatı (üs < 1): bina ve araştırma saatler, günler
 * sürüyor; doğrusal fiyatla bir günlük bekleyiş binlerce elmas ederdi.
 * Süre dolmuşsa bedel yok.
 */
export function hizlandirmaBedeli(kalanSaniye: number): number {
  if (kalanSaniye <= 0) return 0;
  const dakika = kalanSaniye / 60;
  return Math.max(H.asgari, Math.ceil(H.katsayi * dakika ** H.us));
}

/* ------------------------------------------------------------------ */
/* Elmas paketleri                                                     */
/* ------------------------------------------------------------------ */

export interface ElmasPaketi {
  /** Play Console'daki ürün kimliği. */
  urun: string;
  ad: string;
  elmas: number;
  ek: number;
  /** Verilen toplam: elmas + ek. */
  toplam: number;
}

/**
 * Paketler. FİYAT burada yok: Play Console'da, yerel para birimiyle ve
 * vergi dahil; uygulama onu Play'den okuyor. Sunucu yalnız ürün → elmas
 * eşlemesini biliyor ve istemcinin söylediği miktara asla güvenmiyor.
 */
export const ELMAS_PAKETLERI: readonly ElmasPaketi[] = M.paketler.map((p) => ({
  ...p,
  toplam: p.elmas + p.ek,
}));

export function elmasPaketi(urun: string): ElmasPaketi | undefined {
  return ELMAS_PAKETLERI.find((p) => p.urun === urun);
}

/* ------------------------------------------------------------------ */
/* Ödüllü reklam                                                       */
/* ------------------------------------------------------------------ */

export const REKLAM = {
  odulDakika: M.reklam.odul_dakika,
  gunlukTavan: M.reklam.gunluk_tavan,
  beklemeSn: M.reklam.bekleme_sn,
  bankaTavanDakika: M.reklam.banka_tavan_dakika,
  oturumOmruDk: M.reklam.oturum_omru_dk,
  kisisellestirilmis: M.reklam.kisisellestirilmis,
  saklamaGun: M.reklam.saklama_gun,
} as const;

export type ReklamEngeli = 'tavan' | 'bekleme' | null;

export interface ReklamHakki {
  izinli: boolean;
  /** Bugün kalan reklam sayısı. */
  kalan: number;
  /** Bir sonrakine kadar beklenecek saniye (bekleme engeli varsa). */
  beklemeSn: number;
  engel: ReklamEngeli;
}

/**
 * Şimdi bir reklam istenebilir mi.
 *
 * `bugun`: bu UTC gününde açılmış oturum sayısı (izlenmiş ya da
 * yarım kalmış — yarım bırakıp yeniden istemek tavanı aşmanın yolu
 * olmasın). `son`: son oturumun açıldığı an.
 */
export function reklamHakki(bugun: number, son: Date | null, simdi: Date): ReklamHakki {
  const kalan = Math.max(0, REKLAM.gunlukTavan - bugun);
  if (kalan === 0) return { izinli: false, kalan, beklemeSn: 0, engel: 'tavan' };
  const gecen = son ? (simdi.getTime() - son.getTime()) / 1000 : Infinity;
  if (gecen < REKLAM.beklemeSn) {
    return {
      izinli: false,
      kalan,
      beklemeSn: Math.ceil(REKLAM.beklemeSn - gecen),
      engel: 'bekleme',
    };
  }
  return { izinli: true, kalan, beklemeSn: 0, engel: null };
}

/**
 * Ödülün dağılımı: kuyruktan ne kadar silinir, ne kadarı bankaya.
 *
 * Kuyruk ödülden kısaysa artan bankaya; banka tavanı aşan kısmı
 * siliyor (tavan, reklamla süre biriktirip bir günlük binayı bir anda
 * bitirmenin önünde). `kalanSaniye` 0 ise (kuyruk bitmiş ya da yok)
 * ödülün tamamı bankaya.
 */
export function reklamOdulunuDagit(
  kalanSaniye: number,
  bankaDakika: number,
  odulDakika: number = REKLAM.odulDakika,
): { kuyrukSaniye: number; bankayaDakika: number } {
  const odulSn = odulDakika * 60;
  const kuyrukSaniye = Math.max(0, Math.min(kalanSaniye, odulSn));
  const artanDakika = Math.floor((odulSn - kuyrukSaniye) / 60);
  const yer = Math.max(0, REKLAM.bankaTavanDakika - bankaDakika);
  return { kuyrukSaniye, bankayaDakika: Math.min(artanDakika, yer) };
}

/**
 * Bankadan bir kuyruğa ne kadar harcanır: kuyruğun kalanını aşmadan,
 * tam dakikalarla (banka dakika tutuyor; yarım dakika boşa gitmesin diye
 * yukarı yuvarlanıyor ama bankadakini aşmıyor).
 */
export function bankadanHarca(
  kalanSaniye: number,
  bankaDakika: number,
): { harcananDakika: number; kuyrukSaniye: number } {
  if (kalanSaniye <= 0 || bankaDakika <= 0) return { harcananDakika: 0, kuyrukSaniye: 0 };
  const harcananDakika = Math.min(bankaDakika, Math.ceil(kalanSaniye / 60));
  return { harcananDakika, kuyrukSaniye: Math.min(kalanSaniye, harcananDakika * 60) };
}
