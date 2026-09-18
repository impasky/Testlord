/**
 * ELMAS ve YENİ OYUNCU BONUSU — saf katman.
 *
 * Elmas oyun İÇİNDE kazanılan bir para birimi; satın alınmıyor (mağaza
 * bu projenin kapsamı dışında). Tek işi ZAMAN kısaltmak.
 *
 * TEK KATI KURAL: ELMAS GÜÇ SATIN ALMAZ.
 *
 * Sebebi `docs/16` §9'daki fayda puanı kuralıyla aynı ve aynı kadar
 * önemli: güç satan bir para birimi, çok oynayanı KALICI olarak güçlü
 * yapar; o daha çok kazanır, daha çok satın alır ve kartopu bireysel
 * ölçekte geri döner. Elmasla kısaltılan bir yürüyüşün sonucu,
 * beklenerek yapılanınkiyle birebir aynı — yalnız daha erken geliyor.
 *
 * Yeni oyuncu bonusu da aynı çizgide: hızlandırıyor, güçlendirmiyor.
 * Ve KÜÇÜK tutuluyor — büyük bir bonus bittiğinde oyun yavaşlamış gibi
 * görünür ve bırakma sebebi olur.
 *
 * Sayılar `balance.json` → `elmas` ve `yeni_oyuncu` altında.
 */
import { B } from './balance.js';

const E = B.elmas as unknown as {
  akin_kisaltma: { dakika_basina: number; asgari: number };
  kazanim: { gunluk_gorev_tamamlama: number; akin_sef_grubu: number; basarim: number };
};
const Y = B.yeni_oyuncu as unknown as {
  sure_saat: number;
  egitim_hizlandirma: number;
  yuruyus_hizlandirma: number;
  baslangic_elmasi: number;
};

/* ------------------------------------------------------------------ */
/* Elmasla kısaltma                                                    */
/* ------------------------------------------------------------------ */

/**
 * Kalan süreyi tamamen bitirmenin elmas bedeli.
 *
 * DOĞRUSAL: kalan dakika başına sabit fiyat. Sabit toplam fiyat olsaydı
 * uzun bir yürüyüşü kısaltmak bedavaya gelirdi; katlanan fiyat ise
 * birkaç dakikalık beklemeyi absürt pahalı yapardı.
 *
 * Süre dolmuşsa bedel yok — ödenecek bir bekleme kalmamış demektir.
 */
export function kisaltmaBedeli(kalanSaniye: number): number {
  if (kalanSaniye <= 0) return 0;
  const dakika = kalanSaniye / 60;
  return Math.max(E.akin_kisaltma.asgari, Math.ceil(dakika * E.akin_kisaltma.dakika_basina));
}

/** Bu kadar elmasla kısaltılabilir mi. */
export function kisaltilabilirMi(kalanSaniye: number, elmas: number): boolean {
  if (kalanSaniye <= 0) return false;
  return elmas >= kisaltmaBedeli(kalanSaniye);
}

export const ELMAS_KAZANIMI = {
  gunlukGorev: E.kazanim.gunluk_gorev_tamamlama,
  akinSefGrubu: E.kazanim.akin_sef_grubu,
  basarim: E.kazanim.basarim,
} as const;

/* ------------------------------------------------------------------ */
/* Yeni oyuncu bonusu                                                  */
/* ------------------------------------------------------------------ */

export interface YeniOyuncuDurumu {
  etkin: boolean;
  /** Bittiyse 0; etkinse kalan saniye. */
  kalanSaniye: number;
  /** Eğitim süresi bu oranda kısalıyor (0.25 = %25 daha hızlı). */
  egitimHizlandirma: number;
  yuruyusHizlandirma: number;
}

export const YENI_OYUNCU_SURE_SAAT = Y.sure_saat;
export const BASLANGIC_ELMASI = Y.baslangic_elmasi;

/**
 * Lord hâlâ ilk 24 saatinde mi.
 *
 * Bonus KAYIT anına bağlı, ilk girişe değil: girişe bağlasaydık
 * oyuncu ikinci gün girdiğinde bonus yeniden başlar ve "ilk oturum
 * desteği" adını hak etmezdi.
 */
export function yeniOyuncuDurumu(
  lordCreatedAt: Date | string,
  simdi: Date = new Date(),
): YeniOyuncuDurumu {
  const acilis = new Date(lordCreatedAt).getTime();
  const bitis = acilis + Y.sure_saat * 3_600_000;
  const kalan = Math.max(0, Math.floor((bitis - simdi.getTime()) / 1000));
  const etkin = kalan > 0;
  return {
    etkin,
    kalanSaniye: kalan,
    egitimHizlandirma: etkin ? Y.egitim_hizlandirma : 0,
    yuruyusHizlandirma: etkin ? Y.yuruyus_hizlandirma : 0,
  };
}

/**
 * Bir süreye bonusu uygular.
 *
 * Hızlandırma bir BÖLME, çıkarma değil: %25 hızlandırma süreyi %25
 * kısaltmıyor, 1,25 kat hıza çıkarıyor. Çıkarma kullanılsaydı iki
 * bonusun toplamı %100'ü geçtiğinde süre sıfıra ya da eksiye düşerdi.
 */
export function bonusluSure(saniye: number, hizlandirma: number): number {
  if (hizlandirma <= 0) return saniye;
  return Math.max(1, Math.round(saniye / (1 + hizlandirma)));
}
