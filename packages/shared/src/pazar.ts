/**
 * Malikâne pazarı: bir kaynağı diğerine çevirir.
 *
 * NEDEN VAR — ölçülmüş bir sorun. Bölgeler tek kaynak üretiyor (şehir
 * sadece altın, maden sadece demir, tarla sadece erzak) ve bölge limiti
 * `1 + floor(seviye/15)`, yani Lv15'e kadar oyuncunun TEK bölgesi var.
 * Lv5'te tek bölgeyle 10 mızrakçı eğitmek:
 *
 *   şehir alan  → altın 3,6 saat · demir 5,5 saat · erzak 2,5 saat
 *   maden alan  → altın 9,2 saat · demir 1,9 saat · erzak 2,5 saat
 *
 * En yavaş kaynak diğerlerini bekletiyor ve bu arada hızlı olan depoyu
 * taşırıyor. Oyuncunun sözü: "kazançlar orantısız, altın deposu dolu ama
 * demir ve erzak yok."
 *
 * İttifak içi gönderim (ticaret.ts) bu sorunu çözüyor ama ittifakı
 * olmayan oyuncuya bir yol lazım. Pazar o yol — ve KOMİSYONLU, çünkü
 * kayıpsız bir pazar üç kaynağı tek kaynağa indirger ve "hangi bölgeyi
 * alayım" sorusunu anlamsız kılardı.
 *
 * SAF: takas matematiği burada, kaynağın düşülmesi sunucuda.
 */
import { B } from './balance.js';
import { takasTavaniEki } from './bina.js';
import type { Resources } from './types.js';

export const KAYNAK_TURLERI = ['altin', 'demir', 'erzak'] as const;
export type KaynakTuru = (typeof KAYNAK_TURLERI)[number];

/**
 * Kaynağın oyuncuya gösterilen adı.
 *
 * Anahtarlar ASCII (altin), ekranda görünen ad Türkçe (altın). Engel
 * metni ham anahtarı basıyordu: "Bugün en fazla 2000 altin daha takas
 * edebilirsin." Oyuncu kodun değişken adını okumak zorunda değil.
 */
export const KAYNAK_ADI: Record<KaynakTuru, string> = {
  altin: 'altın',
  demir: 'demir',
  erzak: 'erzak',
};

export interface TakasSonucu {
  /** Verilecek miktar (girdi olduğu gibi). */
  verilen: number;
  /** Alınacak miktar, komisyon düşülmüş. */
  alinan: number;
  /** Bu takasın günlük tavandan yiyeceği pay (altın karşılığı). */
  hacim: number;
  /** Komisyon olarak kaybedilen, altın karşılığı cinsinden. */
  kayip: number;
}

/**
 * Tek bir kaynak biriminin altın cinsinden değeri.
 *
 * `odul.ts`teki `altinKarsiligi` bir KAYNAK PAKETİNİ değerliyor; bu ise
 * tek birimin kuru. İkisi de aynı tabloyu (kaynaklar.altin_karsiligi)
 * okuyor — ayrı bir kur tutmak, ödül değerlemesiyle pazarın sessizce
 * ayrışması demekti.
 */
export function birimKuru(tur: KaynakTuru): number {
  return (B.kaynaklar.altin_karsiligi as unknown as Record<string, number>)[tur] ?? 1;
}

/**
 * Günlük takas hacmi tavanı (altın karşılığı): lord seviyesi + PAZAR.
 *
 * Pazarı olmayan lord Y4 öncesiyle aynı tavanı görüyor; bina onun
 * üstüne ekliyor (docs/12 §4). Yüzde değil sayı — çarpan araştırmanın işi.
 */
export function pazarGunlukTavan(
  lordSeviyesi: number,
  binalar?: Record<string, number>,
): number {
  return (
    B.pazar.gunluk_tavan_altin_karsiligi +
    B.pazar.gunluk_tavan_seviye_basina * lordSeviyesi +
    takasTavaniEki(binalar ?? {})
  );
}

/**
 * Takasın sonucu.
 *
 * Yuvarlama AŞAĞI: oyuncuya yoktan kaynak vermemek için. Yukarı
 * yuvarlasaydı, en az miktarla yapılan çok sayıda takas komisyonu
 * yenerdi.
 */
export function takasHesapla(veren: KaynakTuru, alan: KaynakTuru, miktar: number): TakasSonucu {
  const hacim = miktar * birimKuru(veren);
  const netHacim = hacim * (1 - B.pazar.komisyon);
  return {
    verilen: miktar,
    alinan: Math.floor(netHacim / birimKuru(alan)),
    hacim,
    kayip: hacim - netHacim,
  };
}

export interface TakasEngeli {
  kod: string;
  mesaj: string;
}

/**
 * Takas yapılabilir mi? Yapılamıyorsa SEBEBİ.
 *
 * Sebep metni motorda üretiliyor: arayüz düğmeyi kapatırken ve sunucu
 * isteği reddederken aynı cümleyi kullanıyor, ikisi ayrışamıyor.
 */
export function takasEngeli(g: {
  veren: string;
  alan: string;
  miktar: number;
  eldeki: Resources;
  bugunkuHacim: number;
  /**
   * Günlük hacim tavanı (altın karşılığı).
   *
   * Lord SEVİYESİ değil, tavanın kendisi isteniyor: arayüz tavanı
   * sunucudan hazır alıyor ve ikinci kez hesaplamıyor. Seviyeyi geçirmek,
   * arayüzün eksik bir seviyeyle yanlış tavan bulup sunucunun izin
   * verdiği takası kapatmasına yol açıyordu.
   */
  gunlukTavan: number;
}): TakasEngeli | null {
  const gecerli = (x: string): x is KaynakTuru => (KAYNAK_TURLERI as readonly string[]).includes(x);
  if (!gecerli(g.veren) || !gecerli(g.alan)) {
    return { kod: 'KAYNAK_YOK', mesaj: 'Böyle bir kaynak yok.' };
  }
  if (g.veren === g.alan) {
    return { kod: 'AYNI_KAYNAK', mesaj: 'Aynı kaynağı kendisiyle takas edemezsin.' };
  }
  if (!Number.isFinite(g.miktar) || g.miktar < B.pazar.en_az_miktar) {
    return {
      kod: 'AZ_MIKTAR',
      mesaj: `En az ${B.pazar.en_az_miktar} birim takas edebilirsin.`,
    };
  }
  if ((g.eldeki[g.veren] ?? 0) < g.miktar) {
    return { kod: 'KAYNAK_YETERSIZ', mesaj: 'Elinde bu kadar yok.' };
  }
  const { hacim } = takasHesapla(g.veren, g.alan, g.miktar);
  const tavan = g.gunlukTavan;
  if (g.bugunkuHacim + hacim > tavan) {
    const kalan = Math.max(0, tavan - g.bugunkuHacim);
    return {
      kod: 'GUNLUK_TAVAN',
      mesaj:
        kalan === 0
          ? 'Bugünkü pazar hakkın doldu. Yarın yenilenir.'
          : `Bugün en fazla ${Math.floor(kalan / birimKuru(g.veren))} ${KAYNAK_ADI[g.veren]} daha takas edebilirsin.`,
    };
  }
  return null;
}
