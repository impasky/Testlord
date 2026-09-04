/**
 * İttifak içi kaynak gönderimi.
 *
 * docs/09 B6 "Ticaret" diye duruyordu ve notu şuydu: *"İttifak olmadan
 * sömürüye açık."* İttifak artık var (docs/01 §7d), o yüzden açılabiliyor.
 *
 * **Takas değil, gönderim.** Karşılıklı takas (senden 100 demir, benden
 * 200 erzak) iki tarafın onayını, bir teklif kuyruğunu ve teklif süresi
 * dolunca ne olacağını gerektiriyor; beklemeli çalışan bir oyunda bu üç
 * yeni ekran demek. Tek yönlü gönderim aynı işi görüyor: ihtiyacı olana
 * kaynak gidiyor.
 *
 * İki fren var ve ikisi de ayrı bir şeyi engelliyor:
 *  - **Süre**: kaynak da yol alıyor. Anında gönderim, kuşatma altındaki
 *    oyuncuyu sınırsız beslerdi ve saldırının ekonomik anlamı kalmazdı.
 *  - **Günlük tavan**: çoklu hesap freni. Beş sahte hesap açıp hepsinin
 *    gelirini tek oyuncuya akıtmak, ekonominin tamamını anlamsız kılardı.
 */
import { B } from './balance.js';
import { altinKarsiligi } from './odul.js';
import type { Resources } from './types.js';

export function sevkiyatSuresiSn(mesafeHex: number): number {
  const k = B.ticaret;
  return Math.round((k.taban_dakika + k.hex_basina_dakika * Math.max(0, mesafeHex)) * 60);
}

export function gunlukTavan(): number {
  return B.ticaret.gunluk_gonderim_tavani;
}

export function enAzGonderim(): number {
  return B.ticaret.en_az_gonderim;
}

/**
 * Bir yükün "ağırlığı": üç kaynağı tek sayıda karşılaştıran kaba kur.
 *
 * Tavanı tek kaynak üzerinden koymak işe yaramazdı: altın tavanı dolan
 * oyuncu aynı değeri demirle gönderirdi. `altinKarsiligi` zaten oyunda
 * bu iş için var (balance.json), yenisini icat etmiyoruz.
 */
export function yukAgirligi(kaynak: Resources): number {
  return Math.round(altinKarsiligi(kaynak));
}

export interface SevkiyatDenetimi {
  uygun: boolean;
  sebep?: string;
  agirlik: number;
  kalanTavan: number;
}

/**
 * Bir gönderim yapılabilir mi?
 *
 * Saf: bugünkü toplamı ve göndereni çağıran veriyor, karar burada.
 */
export function sevkiyatDenetle(
  yuk: Resources,
  bugunGonderilen: number,
): SevkiyatDenetimi {
  const agirlik = yukAgirligi(yuk);
  const kalan = Math.max(0, gunlukTavan() - bugunGonderilen);

  if (yuk.altin < 0 || yuk.demir < 0 || yuk.erzak < 0) {
    return { uygun: false, sebep: 'Eksi miktar gönderilemez.', agirlik, kalanTavan: kalan };
  }
  if (agirlik < enAzGonderim()) {
    return {
      uygun: false,
      sebep: `En az ${enAzGonderim()} değerinde yük gönderilebilir.`,
      agirlik,
      kalanTavan: kalan,
    };
  }
  if (agirlik > kalan) {
    return {
      uygun: false,
      sebep: `Günlük gönderim tavanını aşıyor. Bugün ${kalan} değerinde daha gönderebilirsin.`,
      agirlik,
      kalanTavan: kalan,
    };
  }
  return { uygun: true, agirlik, kalanTavan: kalan };
}
