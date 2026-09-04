/**
 * İttifak kuralları.
 *
 * docs/09 §2.1: türün en büyük kaldıracı ittifak ve bizde **hiç yoktu**.
 * Oyuncu 60 bölgelik bir diyarda tek başına oynuyordu; kaybettiğinde
 * kimseye anlatamıyor, kazandığında kimse görmüyordu.
 *
 * Çekirdek kasten küçük: kur, katıl, ayrıl, birbirine saldıramamak.
 * Takviye, ortak hedef ve sohbet bunun üstüne gelir. Tek kural bile tek
 * başına değerli — "yalnız değilim" hissinin en somut hâli, sırtını
 * dönebileceğin bir sınırın olması.
 *
 * Buradaki her şey saf: doğrulama ve karar. Veritabanı api tarafında.
 */
import { B } from './balance.js';

export function azamiUye(): number {
  return B.ittifak.azami_uye;
}

export function kurmaMaliyeti(): number {
  return B.ittifak.kurma_maliyeti_altin;
}

export interface AdDenetimi {
  uygun: boolean;
  sebep?: string;
}

/**
 * İttifak adı ve etiketi denetimi.
 *
 * Lord adı denetimiyle (adiDenetle) aynı işi yapmıyor: orada uygunsuz
 * kelime filtresi var, burada yalnız biçim. Uygunsuz içerik denetimi
 * çağıran tarafta, lord adıyla aynı süzgeçten geçirilerek yapılıyor —
 * iki ayrı kelime listesi tutmak ikisinin birbirinden sapması demekti.
 */
export function ittifakAdiDenetle(ad: string): AdDenetimi {
  const t = ad.trim();
  const k = B.ittifak;
  if (t.length < k.ad_en_az) {
    return { uygun: false, sebep: `İttifak adı en az ${k.ad_en_az} harf olmalı.` };
  }
  if (t.length > k.ad_en_fazla) {
    return { uygun: false, sebep: `İttifak adı en fazla ${k.ad_en_fazla} harf olabilir.` };
  }
  return { uygun: true };
}

export function ittifakEtiketiDenetle(etiket: string): AdDenetimi {
  const t = etiket.trim();
  const k = B.ittifak;
  if (t.length < k.etiket_en_az || t.length > k.etiket_en_fazla) {
    return {
      uygun: false,
      sebep: `Etiket ${k.etiket_en_az}-${k.etiket_en_fazla} karakter olmalı.`,
    };
  }
  // Etiket adın yanında köşeli parantez içinde görünüyor; boşluk ve
  // parantez o gösterimi bozar.
  if (!/^[\p{L}\p{N}]+$/u.test(t)) {
    return { uygun: false, sebep: 'Etiket yalnız harf ve rakam içerebilir.' };
  }
  return { uygun: true };
}

/**
 * Ayrıldıktan sonra yeni ittifağa girmek için beklenecek süre.
 *
 * Bekleme olmasaydı saldırı kilidi kalkan gibi kullanılabilirdi:
 * saldırıya uğrayan oyuncu saldırganın ittifağına girip korunur, tehlike
 * geçince çıkardı. Bekleme o oyunu bozuyor.
 */
export function ittifakBeklemeSn(): number {
  return B.ittifak.ayrildiktan_sonra_bekleme_saat * 3600;
}

export function ittifakaGirebilirMi(
  ayrilmaAni: Date | null,
  simdi: Date,
): { girebilir: boolean; kalanSn: number } {
  if (ayrilmaAni === null) return { girebilir: true, kalanSn: 0 };
  const gecen = (simdi.getTime() - ayrilmaAni.getTime()) / 1000;
  const kalan = Math.ceil(ittifakBeklemeSn() - gecen);
  return kalan <= 0 ? { girebilir: true, kalanSn: 0 } : { girebilir: false, kalanSn: kalan };
}

/**
 * İki lord birbirine saldırabilir mi?
 *
 * İttifak içi saldırı yok. Bu, ittifağın tek zorunlu kuralı ve tek
 * başına değerli olan şey: sırtını dönebileceğin bir sınırın olması.
 */
export function ayniIttifaktaMi(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a === b;
}
