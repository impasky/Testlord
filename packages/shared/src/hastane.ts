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
 * ÜÇ SINIR birden uygulanıyor ve sırası önemli:
 *  1. Hesap: taban + adet başına sabit + birimin eğitim süresinin bir payı.
 *     Mancınık, milisten uzun iyileşiyor.
 *  2. Sıfırdan eğitim süresi: tedavi bundan UZUN OLAMAZ. Olsaydı, yaralıyı
 *     beklemek yerine yenisini eğitmek her zaman daha mantıklı olur ve
 *     hastane ölü bir ekran olarak kalırdı. Bu bir ayar değil garanti —
 *     ilk hesapta 5 milis için tedavi 7,3 dakika, eğitim 3,8 dakika
 *     çıkmıştı ve kural sessizce çiğneniyordu.
 *  3. Tavan: büyük bir yenilgide yüzlerce yaralı döner; ceza zamanla
 *     artmalı ama oyuncuyu oyundan kopartmamalı. HASTANE BİNASI bu
 *     tavanı indiriyor (docs/12 §4): hastanesiz lord 6 saatlik tavanı
 *     görüyor, 5. seviye hastanesi olan 1 saatlik. Küçük kafileler zaten
 *     tavana çarpmıyor — bina yalnız kötü günü kısaltıyor.
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
  const sifirdanEgitim = u.egitim_sn * adet;
  const tavan = binalar ? azamiTedaviSn(binalar) : H.azami_saniye;
  return Math.round(Math.min(hesap, sifirdanEgitim, tavan));
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
