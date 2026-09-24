/**
 * Hastane: savaştan yaralı dönen askerlerin tedavisi.
 *
 * NEDEN VAR. Yaralı dönüş sistemi (docs/09 K6b) ölü sayılan askerin bir
 * kısmını geri veriyordu, ama asker anında savaşa hazır oluyordu. Kaybın
 * bir ağırlığı kalmıyordu: yenilen oyuncu bir dakika sonra neredeyse aynı
 * orduyla tekrar saldırabiliyordu.
 *
 * Hastane kaybı ZAMANA çeviriyor — asker ölmüyor ama hemen de
 * kullanılamıyor. Yenilginin bedeli artık "kaç asker gitti" değil,
 * "ne kadar süre ordusuz kalacağım".
 *
 * SAF: süre hesabı burada, askerin nereye yazıldığı sunucuda.
 */
import { B, unit } from './balance.js';
import { azamiTedaviSn } from './bina.js';
import type { Army, UnitType } from './types.js';
import { UNIT_TYPES } from './types.js';

/**
 * Bir yaralı yığınının tedavi süresi (saniye).
 *
 *  1. Hesap: taban + adet başına sabit + birimin eğitim süresinin bir payı.
 *     Mancınık, milisten uzun iyileşiyor. Taban tek yaralıyı bile on
 *     dakika yatırıyor: akın bir dakika ve normal gruplar sınırsız, yani
 *     aynı ordunun art arda kaç akın yapabileceğini hastane belirliyor.
 *  2. Tavan: büyük bir yenilgide yüzlerce yaralı döner; ceza zamanla
 *     artmalı ama oyuncuyu oyundan kopartmamalı. HASTANE BİNASI bu
 *     tavanı indiriyor (docs/12 §4): hastanesiz lord 6 saatlik tavanı
 *     görüyor, 5. seviye hastanesi olan 1 saatlik.
 *
 * Eskiden bir üçüncü sınır vardı: tedavi, birimi SIFIRDAN EĞİTMEKTEN uzun
 * olamazdı ve küçük kafileler bu yüzden bir iki dakikada çıkıyordu.
 * Oyuncunun kararıyla kalktı ("iyileşme süresini uzatalım, isteyen
 * elmasla kısaltsın"): eğitim kaynak istiyor, tedavi bedava — yaralıyı
 * beklemek, yenisini eğitmekten uzun sürse de bedava olduğu için anlamlı.
 * Beklemek istemeyen elmasla bitiriyor (`tedaviKisaltmaBedeli`).
 */
export function tedaviSuresiSn(
  tur: UnitType,
  adet: number,
  binalar?: Record<string, number>,
): number {
  if (adet <= 0) return 0;
  const u = unit(tur);
  const H = B.hastane;
  const hesap =
    H.saniye_taban + H.saniye_birim_basina * adet + u.egitim_sn * adet * H.egitim_suresi_carpani;
  const tavan = binalar ? azamiTedaviSn(binalar) : H.azami_saniye;
  return Math.round(Math.min(hesap, tavan));
}

/**
 * Bütün yaralıların tedavisi: TEK bir süre.
 *
 * En uzun süren birim belirliyor — hastane tek bir koğuş, karışık bir
 * yaralı kafilesi parça parça taburcu olmuyor. Birim başına ayrı kuyruk
 * açmak, ekranı beş sayaçla doldurup oyuncuya hiçbir şey kazandırmazdı.
 */
export function kafileTedaviSuresiSn(yarali: Army, binalar?: Record<string, number>): number {
  let enUzun = 0;
  for (const t of UNIT_TYPES) {
    const adet = yarali[t] ?? 0;
    if (adet > 0) enUzun = Math.max(enUzun, tedaviSuresiSn(t, adet, binalar));
  }
  return enUzun;
}

/** Tedavideki asker erzak yer mi, komuta yeri kaplar mı? */
export function tedavidekiSayilirMi(): boolean {
  return B.hastane.bakim_alir;
}

export function yaraliVarMi(yarali: Army | null | undefined): boolean {
  if (!yarali) return false;
  return UNIT_TYPES.some((t) => (yarali[t] ?? 0) > 0);
}
