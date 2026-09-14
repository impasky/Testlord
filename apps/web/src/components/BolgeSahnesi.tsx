/**
 * BÖLGE SAHNESİ — boyalı afişin yerine, bileşenden kurulu bir yer.
 *
 * ── Neden ────────────────────────────────────────────────────────────
 *
 * Bölge kartı 3:2 boyalı bir manzara gösteriyordu: tür × seviye başına
 * bir dosya, 16 dosya. İki kusuru vardı.
 *
 *  1. YENİ TÜR = YENİ SANAT. Bir bölge türü eklemek üç görsel üretimi
 *     (seviye 1/3/5) demekti, yani oyunun içeriği bir API anahtarına ve
 *     kotaya bağlıydı.
 *  2. RESİM BİLGİ TAŞIMIYOR. Aynı türün üç seviyesi üç ayrı resimdi ama
 *     resim, o bölgenin O ANKİ hâlini söyleyemez — surları, garnizonu,
 *     ne kadar geliştiğini.
 *
 * Sahne, şehir ekranının yöntemini ödünç alıyor (docs/12 §3): zemin BOŞ,
 * yapılar onun üstüne konuyor ve yerleri `data/bolge-sahne.json` içinde
 * veri olarak duruyor. Tür artık sanat değil bir yerleşim listesi.
 *
 * ── Kompozisyonun üç şartı ───────────────────────────────────────────
 *
 * Bu proje bunu bir kez pahalıya öğrendi (docs/12 §9.1): tek tek üretilen
 * varlıklar bir araya gelmiyor. Çalışması için üç şart var ve üçü de
 * üretim tarafında karşılanıyor:
 *
 *   TEK KAMERA, TEK GÜNEŞ — yapılar tek sayfada, tek çağrıda üretiliyor.
 *   BOŞ ZEMİN — zemin isteminde "ABSOLUTELY NO BUILDINGS" yazıyor;
 *     zeminin kendi boyalı binaları sprite'larla yarışırsa sprite
 *     yapıştırılmış duruyor.
 *   TABANA HİZA — `tools/sprite-hizala.py` her sprite'ı kendi tabanına
 *     oturtuyor, yani y "ayak bastığı yer" demek.
 *
 * ── Varlık yoksa ne olur ─────────────────────────────────────────────
 *
 * Hiçbir şey. `varMi` false dönüyor ve çağıran eski boyalı afişi
 * çiziyor. Yarım bir geçiş, bölge kartını boş bırakmaktan iyidir.
 */
import sahneVerisi from '../../../../data/bolge-sahne.json';
import { ZemineGolgesi } from './ZemineGolgesi';

interface Yerlesim {
  yapi: string;
  x: number;
  y: number;
  olcek: number;
}

const TURLER = sahneVerisi.turler as Record<
  string,
  { zemin: string; etkin?: boolean; seviyeler: Record<string, Yerlesim[]> }
>;

/** Seviyeyi sahnenin tanıdığı basamağa indirir: 1-2 → 1, 3-4 → 3, 5+ → 5. */
function asama(seviye: number): '1' | '3' | '5' {
  return seviye >= 5 ? '5' : seviye >= 3 ? '3' : '1';
}

/**
 * Bu tür sahneyle çizilebilir mi — çağıran eski afişe düşebilsin diye.
 *
 * Ölçüt "tanımlı mı" DEĞİL, "görseli üretildi mi". Yerleşim verisi
 * görselden önce yazılabiliyor (yazıldı da); `etkin` o ayrımı tutuyor ve
 * görsel gelince tek satır veri değişikliğiyle açılıyor.
 */
export function sahneVarMi(tip: string): boolean {
  return TURLER[tip]?.etkin === true;
}

export function BolgeSahnesi({
  tip,
  seviye,
  ad,
}: {
  tip: string;
  seviye: number;
  /** Ekran okuyucu için: sahne süs değil, o bölgenin hâli. */
  ad: string;
}) {
  const tur = TURLER[tip];
  if (!tur) return null;
  const yerlesim = tur.seviyeler[asama(seviye)] ?? [];

  return (
    <div
      className="oyuk relative aspect-[3/2] w-full overflow-hidden"
      role="img"
      aria-label={`${ad} — seviye ${seviye}, ${yerlesim.length} yapı`}
    >
      <img
        src={`/gorseller/bolge_zemin/${tur.zemin}.webp`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />
      {yerlesim.map((y, i) => (
        <span
          // Aynı yapı birden çok kez konabiliyor (iki saman yığını), o
          // yüzden anahtar ada değil YERE bağlı.
          key={`${y.yapi}-${y.x}-${y.y}-${i}`}
          className="absolute aspect-square"
          style={{
            left: `${y.x}%`,
            top: `${y.y}%`,
            width: `${y.olcek}%`,
            // Kutunun ALT kenarı y'ye oturuyor, merkezi değil: sprite'lar
            // tabanlarına hizalı olduğu için bu "ayak bastığı yer" demek.
            transform: 'translate(-50%, -100%)',
            // Derinlik y'den: aşağıdaki yapı öndedir ve yukarıdakini örter.
            zIndex: Math.round(y.y),
          }}
        >
          <ZemineGolgesi />
          <img
            src={`/gorseller/bolge_yapi/${y.yapi}.webp`}
            alt=""
            aria-hidden="true"
            className="relative h-full w-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
          />
        </span>
      ))}
    </div>
  );
}
