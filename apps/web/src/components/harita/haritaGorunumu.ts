/**
 * Dünya haritasının son görünümü: yakınlık ve görünen alanın ortası
 * (dünyanın yüzdesi). Oyuncu: "haritanın yakınlığını ve konumunu da
 * hatırlasın." Harita her açılışta oyuncunun toprağında ×1,8'de açılıyordu;
 * artık bıraktığı yerde ve yakınlıkta (ilk açılışta yine toprağında).
 * Cihazda saklanıyor (haritanın merceği gibi); depo kapalıysa (gizli
 * sekme) sekme açık kaldıkça.
 */

export interface HaritaGorunumu {
  k: number;
  /** Görünen alanın ortası, dünyanın yüzdesi (0–100). */
  merkez: [number, number];
}

export const HARITA_GORUNUM_ANAHTARI = 'lordlar_harita_gorunum';

/** Saklı görünümü okur; bozuk, eksik ya da sınır dışı değer yok sayılıyor. */
export function haritaGorunumuOku(ham: string | null, enCok: number): HaritaGorunumu | null {
  if (!ham) return null;
  try {
    const g = JSON.parse(ham) as Partial<HaritaGorunumu>;
    const [x, y] = Array.isArray(g.merkez) ? g.merkez : [];
    const sayi = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    if (!sayi(g.k) || !sayi(x) || !sayi(y)) return null;
    if (g.k <= 0 || g.k > enCok || x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { k: g.k, merkez: [x, y] };
  } catch {
    return null;
  }
}

let SON: HaritaGorunumu | null | undefined;

/** Saklı görünüm (yoksa null). İlk çağrıda cihazdan okunuyor. */
export function sonHaritaGorunumu(enCok: number): HaritaGorunumu | null {
  if (SON === undefined) {
    try {
      SON = haritaGorunumuOku(localStorage.getItem(HARITA_GORUNUM_ANAHTARI), enCok);
    } catch {
      SON = null;
    }
  }
  return SON;
}

export function haritaGorunumuYaz(g: HaritaGorunumu): void {
  SON = g;
  try {
    localStorage.setItem(
      HARITA_GORUNUM_ANAHTARI,
      JSON.stringify({ k: +g.k.toFixed(3), merkez: g.merkez.map((v) => +v.toFixed(3)) }),
    );
  } catch {
    /* gizli sekme ya da dolu depo: sekme açık kaldıkça yine hatırlanıyor */
  }
}
