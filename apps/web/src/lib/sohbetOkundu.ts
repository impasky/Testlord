/**
 * Genel sohbetin en son okunduğu an — üst çubuktaki "yeni mesaj" noktası.
 *
 * Ayrı modül: üst çubuk (her ekranda, ilk paket) bunu okuyor, sohbet
 * ekranı (tembel yükleniyor) yazıyor. Sohbet ekranından içe aktarsaydık
 * ekran ilk pakete girerdi.
 *
 * Cihazda duruyor, hesapta değil: hangi mesajı okuduğun, başka bir
 * telefonda da okunmuş sayılmayı gerektirecek kadar önemli bir bilgi değil.
 */
export const OKUNDU_ANAHTARI = 'lordlar_genel_okundu';

export function okunduOku(): string | null {
  try {
    return localStorage.getItem(OKUNDU_ANAHTARI);
  } catch {
    return null;
  }
}

export function okunduYaz(an: string): void {
  try {
    localStorage.setItem(OKUNDU_ANAHTARI, an);
  } catch {
    /* gizli sekme: nokta yanık kalır, sohbet yine çalışır */
  }
}
