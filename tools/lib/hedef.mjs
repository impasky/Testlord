/**
 * "Bu bölge fethedilebilir mi" — sınamaların ortak süzgeci.
 *
 * Aynı koşul sekiz dosyada ayrı ayrı yazılıydı: `!r.owner && r.type !==
 * 'taht'`. Her yeni kural eklendiğinde sekizini birden güncellemek
 * gerekiyordu ve iki kez unutuldu:
 *
 *   - Yağma kalkanı geldiğinde (docs/09 K6): kalkanlı bölgeyi seçen araç
 *     "saldırı reddedildi — koruma altında" diye düşüyordu.
 *   - Çekirdek dokunulmazlığı geldiğinde (docs/16 §5): çekirdekler de
 *     sahipsiz görünüyor ve seçen araç yine düşüyordu.
 *
 * İkisinde de düşme sebebi, sınamanın ölçtüğü şeyle hiç ilgili değildi.
 * Koşul artık tek yerde: dokuzuncu kural geldiğinde burası değişecek.
 */
export function fethedilebilirMi(r) {
  return Boolean(r) && !r.owner && !r.cekirdek && !r.shielded && r.type !== 'taht';
}
