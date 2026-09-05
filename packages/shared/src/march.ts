/** Harita mesafesi ve yürüyüş süresi. */
import { B, unit } from './balance.js';
import type { Army, GeneralBonus } from './types.js';
import { UNIT_TYPES } from './types.js';

export interface HexCoord {
  q: number;
  r: number;
}

/** İki altıgen arasındaki mesafe (aksiyel koordinat). */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/**
 * Ordunun bir hedefe olan GERÇEK mesafesi: en yakın toprağından ölçülür.
 *
 * Eskiden mesafe yalnız malikâneden ölçülüyordu ve altıgen ızgara bu yüzden
 * boş bir süstü: bölgenin senin bölgene bitişik olmasıyla haritanın öbür
 * ucunda olması arasında hiçbir fark yoktu. Izgaranın maliyetini ödüyor,
 * faydasını almıyorduk — oyuncunun "hex sistemi çok kısıtlayıcı
 * hissettiriyor" dediği şey buydu (docs/11 §1).
 *
 * Şimdi aldığın her bölge bir çıkış noktası. Toprak sahibi olmak haritayı
 * AÇIYOR; yayılma yayılma gibi hissediliyor.
 *
 * Kartopu riski yok: bölge sayısı seviyeye bağlı (`1 + floor(seviye/15)`),
 * yani sınırsız yayılan bir oyuncu yok. Malikâne her zaman listede — bölgesi
 * olmayan oyuncu eskisi gibi oynamaya devam ediyor.
 */
export function yakinlikMesafesi(
  ev: HexCoord,
  topraklarim: readonly HexCoord[],
  hedef: HexCoord,
): number {
  let enAz = hexDistance(ev, hedef);
  for (const t of topraklarim) {
    const d = hexDistance(t, hedef);
    if (d < enAz) enAz = d;
  }
  return enAz;
}

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
export function ilkSaldiriMi(
  yuruyusSayisi: number,
  sahipsizMi: boolean,
  mesafe: number,
): boolean {
  return yuruyusSayisi === 0 && sahipsizMi && mesafe <= B.yuruyus.ilk_saldiri_max_hex;
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
export function egitimSuresiSn(birimEgitimSn: number, adet: number, ilkMi = false): number {
  if (ilkMi) return B.ilk_egitim.saniye;
  return birimEgitimSn * adet;
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
): number {
  if (opts?.ilkSaldiri) return Math.round(B.yuruyus.ilk_saldiri_dakika * 60);
  const speed = slowestSpeed(army);
  const raw = distance * B.yuruyus.dakika_hex_basina * (B.yuruyus.hiz_referansi / speed);
  const withBonus = raw * (1 + (generalBonus?.yuruyusSuresi ?? 0));
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
