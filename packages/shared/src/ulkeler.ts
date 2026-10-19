/**
 * ÜLKELER (docs/27) — telefonun ana paketine giren harita özeti.
 *
 * Haritanın tamamı (`data/world-map.json`, bir MB'a yakın) yalnız
 * sunucuda; arayüz bölgeleri API'den alıyor. Ülke adları ve sayılar ise
 * her ekranda lazım (öğretici, ülke seçimi, profil kartı) ve küçük bir
 * özetten geliyor: `data/dunya-ozet.json`, üretici aynı koşuda yazıyor.
 * Özetin haritayla aynı olduğunu `haritayiDogrula` (kanonik.ts) sınıyor.
 */
import ozetJson from '../../../data/dunya-ozet.json';

/**
 * Bir ülke. `key` Natural Earth kodu (TUR, DEU...): bölgelerin `province`
 * alanı bu. `baskent` başkentin bölge kimliği — ülkenin TAHTI.
 */
export interface UlkeDef {
  key: string;
  name: string;
  name_en: string;
  baskent: number;
  /** Komşu ülkeler farklı renk alsın diye 1-7 (Natural Earth MAPCOLOR7). */
  renk: number;
}

export const DUNYA_OZETI = ozetJson as unknown as { region_count: number; provinces: UlkeDef[] };

/** Haritadaki şehir (bölge) sayısı. */
export const SEHIR_SAYISI: number = DUNYA_OZETI.region_count;

/** Ülke kodu → ülke. */
export const ULKELER: ReadonlyMap<string, UlkeDef> = new Map(
  DUNYA_OZETI.provinces.map((p) => [p.key, p]),
);

/**
 * Ülke kodu → görünen ad.
 *
 * Arayüz elle bir kopya tutmuyor: elle tutulan kopya haritaya bir ülke
 * eklendiği gün sessizce eksik kalır ve ekranda ham kod ("TUR") görünür.
 */
export const ULKE_ADI: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(DUNYA_OZETI.provinces.map((p) => [p.key, p.name])),
);
