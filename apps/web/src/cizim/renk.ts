/**
 * Renk yardımcıları ve ortak palet (docs/24).
 *
 * Bütün çizimler AYNI paletten boyanıyor: bina, asker, arazi ve portre
 * yan yana durduğunda tek bir dünyanın parçası gibi görünmeli. Renkler
 * oyunun arayüzüyle (koyu zemin, altın vurgu) aynı sıcaklıkta seçildi.
 */

export type Rgb = [number, number, number];

export function rgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const t = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  return [parseInt(t.slice(0, 2), 16), parseInt(t.slice(2, 4), 16), parseInt(t.slice(4, 6), 16)];
}

export function hex([r, g, b]: Rgb): string {
  const s = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return '#' + s(r) + s(g) + s(b);
}

/** Rengi `k` ile çarpar: 1 aynı, <1 koyu, >1 açık (beyaza doğru doyar). */
export function isikla(renk: string, k: number): string {
  const [r, g, b] = rgb(renk);
  if (k <= 1) return hex([r * k, g * k, b * k]);
  const t = Math.min(1, k - 1);
  return hex([r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t]);
}

/** İki rengin arası: t=0 a, t=1 b. */
export function karistir(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/**
 * MALZEMELER. Adlar kod anahtarı (Türkçe harfsiz): çeviri çıkarıcısı
 * Türkçe harfli ya da boşluklu dizgeleri metin sayıyor.
 */
export const P = {
  // Ahşap
  tahta: '#8a5a32',
  koyuTahta: '#5c3a20',
  acikTahta: '#b07a45',
  // Taş
  tas: '#8c8578',
  koyuTas: '#5f5a52',
  acikTas: '#b3ab9c',
  kumTasi: '#c9a86e',
  // Çatı
  kiremit: '#a8492e',
  saman: '#c9a24e',
  arduvaz: '#4d5866',
  bakir: '#3f8a73',
  // Sıva / bez
  siva: '#d8c8a4',
  bez: '#d9ccab',
  cadir: '#a9b27a',
  kirmiziBez: '#9c2f2a',
  maviBez: '#2f4f86',
  // Metal
  demir: '#5d6166',
  celik: '#9aa3ab',
  altin: '#e0b040',
  koyuAltin: '#a57a1d',
  bronz: '#b0753a',
  // Doğa
  cimen: '#6f8f3c',
  koyuCimen: '#4f6b2a',
  toprak: '#7a5a38',
  kum: '#cdb480',
  su: '#3d6f8f',
  derinSu: '#26475e',
  kar: '#e6ecef',
  buz: '#a9cfe0',
  yaprak: '#4d7a32',
  koyuYaprak: '#35592a',
  kaya: '#6e6a63',
  // İnsan
  ten1: '#e2b48c',
  ten2: '#c68d62',
  ten3: '#9a6440',
  ten4: '#6e4429',
  sac1: '#2b1d14',
  sac2: '#5a3a1e',
  sac3: '#8a5a2b',
  sac4: '#c9b08a',
  deri: '#6b4526',
  // Işık ve sihir
  ates: '#f28c28',
  kor: '#ffcf5a',
  buyu: '#7fd6ff',
  mor: '#6a4a8a',
  kemik: '#d9d2bd',
} as const;
