/**
 * Çizim varsa onu, yoksa ikonu gösterir.
 *
 * Oyunun görselleri koddan çiziliyor (docs/24, `cizim/`): birlik, düşman,
 * eşya, general, lord. Bu bileşen ekranların eski arayüzünü koruyor —
 * `tur` + `ad` veriliyor, çizim o adla varsa çiziliyor, yoksa (yeni bir
 * birlik eklendi ama tarifi henüz yazılmadı) `yedek` ikon görünüyor.
 * Dosya yüklenmediği için ne bekleme ne de "görsel geldi, kutu zıpladı"
 * var.
 */
import { NesneCizimi, nesneCizimiVar } from '../cizim/Cizimler';
import { VARYANT_EKI } from '../cizim/bolgeler';

export type GorselTuru = 'birimler' | 'generaller' | 'ekipman' | 'lord';

/**
 * Bölgenin aşamasına uygun görselin adı.
 *
 * Bölge geliştikçe görselin de değişmesi, geliştirmenin karşılığını GÖRÜNÜR
 * kılan tek şey: "Kasabam Pazar Şehri oldu" cümlesinin resmi olmalı. Her
 * türün üç aşamasının da çizimi var (cizim/bolgeler.ts).
 *
 *   seviye 1-2 -> tarla        seviye 3-4 -> tarla_3       seviye 5 -> tarla_5
 */
export function bolgeGorselAdi(tip: string, seviye: number, varyant = 0): string {
  const asama = seviye >= 5 ? 5 : seviye >= 3 ? 3 : 1;
  // Varyant (cizim/bolgeler.ts): aynı türün üç görünüşü, bölgenin kimliğinden.
  const ek = VARYANT_EKI[varyant] ?? '';
  if (ek) return `${tip}_${asama}_${ek}`;
  return asama === 1 ? tip : `${tip}_${asama}`;
}

export function Gorsel({
  tur,
  ad,
  alt,
  boyut,
  yedek,
  className = '',
}: {
  tur: GorselTuru;
  /** Çizim adı: suvari, mizrakci, kusatmaci_tarik, silah_t3... */
  ad: string;
  alt: string;
  boyut: number;
  /** Çizimi olmayan ad için gösterilecek ikon. */
  yedek: React.ReactNode;
  className?: string;
}) {
  if (nesneCizimiVar(tur, ad))
    return <NesneCizimi tur={tur} ad={ad} alt={alt} boyut={boyut} className={className} />;
  return <>{yedek}</>;
}
