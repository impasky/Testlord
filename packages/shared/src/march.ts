/** Yürüyüş süresi ve ilk saldırı kısayolu. Mesafe: harita.ts. */
import { B, unit } from './balance.js';
import type { ArastirmaBonusu } from './arastirma.js';
import type { Army, GeneralBonus } from './types.js';
import { UNIT_TYPES } from './types.js';

/** Ordunun en yavaş biriminin hızı — yürüyüşü o belirler. */
export function slowestSpeed(army: Army): number {
  let slowest = Infinity;
  for (const t of UNIT_TYPES) {
    if ((army[t] ?? 0) > 0) slowest = Math.min(slowest, unit(t).hiz);
  }
  return Number.isFinite(slowest) ? slowest : B.yuruyus.hiz_referansi;
}

export interface MarchOptions {
  /**
   * Oyuncunun ilk saldırısı mı? Öyleyse süre `ilk_saldiri_dakika`ya sabitlenir.
   *
   * Neden var: normal en kısa yürüyüş 10 dakika, dönüşüyle 20. Yeni oyuncu
   * ilk oturumunda ordusunu yola çıkarıp hiçbir sonuç görmeden oyunu
   * kapatıyordu — "saldırıya gönderdim, eee ne oldu şimdi" sorusunun cevabı
   * gerçekten yoktu. Bu kısayol yalnızca ilk saldırıya ve yalnızca sahipsiz
   * bir bölgeye uygulanır (kararı çağıran verir); PvP'de savunanın tepki
   * süresi kısalmaz.
   */
  ilkSaldiri?: boolean;
}

/**
 * İlk saldırı kısayolu geçerli mi?
 *
 * Üç koşul birden gerekir; ikisi denge, biri deneyim içindir:
 *  - lordun hiç yürüyüşü olmamalı (kısayol ömürde bir kez),
 *  - hedef sahipsiz olmalı (PvP'de savunanın tepki süresi kısalmamalı),
 *  - hedef eve yakın olmalı (yoksa haritanın "kenardan başla" kurgusu
 *    bir kez ücretsiz atlanır).
 */
export function ilkSaldiriMi(yuruyusSayisi: number, sahipsizMi: boolean, mesafe: number): boolean {
  return yuruyusSayisi === 0 && sahipsizMi && mesafe <= B.yuruyus.ilk_saldiri_max_adim;
}

/**
 * İlk eğitim kısayolu geçerli mi?
 *
 * `ilkSaldiriMi` ile aynı aile ve aynı gerekçe: yeni oyuncu bir düğmeye
 * basıp hiçbir şey olmadığını görüyor ve oyunu kapatıyor. Mızrakçı 90
 * sn/birim; 10 mızrakçı 15 dakika eder ve ilk oturumun tamamı o beklemeye
 * gider. Bir oyuncu testi bunu aynen söyledi: "ilk kez yaptığı için hemen
 * eğitilir, sonra hemen haritada NPC olur, oraya götürür."
 *
 * İKİ koşul birden gerekiyor ve ikincisi şart:
 *  - lordun hiç tamamlanmış eğitimi olmamalı,
 *  - lordun hiç askeri olmamalı.
 *
 * Tek başına "hiç eğitim yapmamış" koşulu, ordusunu savaşta kaybetmiş bir
 * Sv40 lorda da uyardı — ona bedava ordu vermek olurdu. Askeri olmama
 * şartı kısayolu gerçekten ilk ana bağlıyor.
 */
export function ilkEgitimMi(tamamlananEgitim: number, mevcutAsker: number): boolean {
  return tamamlananEgitim === 0 && mevcutAsker === 0;
}

/**
 * Bir eğitim kuyruğunun süresi (saniye).
 *
 * Süreyi çağıranın hesaplaması (`u.egitim_sn * count`) ilk hâlindeydi ve
 * kısayol eklenince o çarpımın iki yerde yaşaması gerekirdi. Tek yer.
 */
export function egitimSuresiSn(
  birimEgitimSn: number,
  adet: number,
  ilkMi = false,
  arastirma?: ArastirmaBonusu,
): number {
  if (ilkMi) return B.ilk_egitim.saniye;
  // Hız bonusu SÜREYİ bölüyor: +%20 hız, süreyi %20 kısaltmak değil
  // 1/1.2 = %17 kısaltmak demek. Çarpanla yazsaydık +%100 hız süreyi
  // sıfırlardı.
  return Math.round((birimEgitimSn * adet) / (1 + (arastirma?.egitimHizi ?? 0)));
}

/**
 * Yürüyüş süresi (saniye).
 * Sadece süvari = hızlı baskın; mancınık katarsan ordu ağırlaşır.
 */
export function marchDurationSec(
  distance: number,
  army: Army,
  generalBonus?: GeneralBonus,
  opts?: MarchOptions,
  arastirma?: ArastirmaBonusu,
): number {
  if (opts?.ilkSaldiri) return Math.round(B.yuruyus.ilk_saldiri_dakika * 60);
  const speed = slowestSpeed(army);
  const raw = distance * B.yuruyus.dakika_adim_basina * (B.yuruyus.hiz_referansi / speed);
  const withBonus =
    (raw * (1 + (generalBonus?.yuruyusSuresi ?? 0))) / (1 + (arastirma?.yuruyusHizi ?? 0));
  const clamped = Math.min(B.yuruyus.max_dakika, Math.max(B.yuruyus.min_dakika, withBonus));
  return Math.round(clamped * 60);
}

/** Yürüyüş geri çağrılabilir mi? İlk %25 içindeyse evet. */
export function canRecallMarch(departAt: Date, arriveAt: Date, now: Date): boolean {
  const total = arriveAt.getTime() - departAt.getTime();
  if (total <= 0) return false;
  const elapsed = now.getTime() - departAt.getTime();
  return elapsed >= 0 && elapsed / total <= 0.25;
}
