import { readFileSync } from 'node:fs';

/**
 * Harita yardımcıları — testler için.
 *
 * Altıgen ızgara kalkınca `ring` alanı da kalktı (docs/12 §1). Testler onu
 * "haritanın kenarı" anlamında kullanıyordu; karşılığı artık Taht
 * Kalesi'nden kaç ADIM uzakta olduğu ve o sayı komşuluk grafiğinden
 * türetiliyor. Aynı ölçü, koordinat aritmetiği olmadan.
 */

/**
 * Kanonik harita dosyası. Araçlar `@lordlar/shared`i import edemiyor
 * (kök paket onu bağımlılık olarak taşımıyor); dosyayı okumak hem
 * bağımsız hem de TEK KAYNAK kuralına uygun.
 */
export const HARITA = JSON.parse(
  readFileSync(new URL('../../data/world-map.json', import.meta.url), 'utf8'),
);

/** Haritadaki bölge sayısı — testler bunu elle yazmasın. */
export const BOLGE_SAYISI = HARITA.region_count;

/** Bölge kimliği → Taht Kalesi'nden adım sayısı. */
export function merkezUzakliklari(regions) {
  const taht = regions.find((r) => r.type === 'taht');
  if (!taht) return new Map();
  const komsu = new Map(regions.map((r) => [r.id, r.komsular ?? []]));
  const uzaklik = new Map([[taht.id, 0]]);
  const kuyruk = [taht.id];
  for (let i = 0; i < kuyruk.length; i++) {
    const su = kuyruk[i];
    for (const k of komsu.get(su) ?? []) {
      if (uzaklik.has(k)) continue;
      uzaklik.set(k, uzaklik.get(su) + 1);
      kuyruk.push(k);
    }
  }
  return uzaklik;
}

/**
 * Haritanın kenarındaki sahipsiz bölgeler — yeni oyuncunun av sahası.
 *
 * `haric` ile tür dışlanır (kale ve taht çoğu testte konu dışı).
 */
export function kenardakiSahipsizler(regions, { haric = [], enAzUzaklik = 4 } = {}) {
  const uzaklik = merkezUzakliklari(regions);
  return regions.filter(
    (r) => (uzaklik.get(r.id) ?? 0) >= enAzUzaklik && !r.owner && !haric.includes(r.type),
  );
}
