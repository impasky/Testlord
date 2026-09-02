/**
 * İllüstrasyon varsa onu, yoksa ikonu gösterir.
 *
 * Amaç: gerçek çizim eklemeyi dosyayı klasöre atmak kadar basitleştirmek.
 * Kod değişikliği gerekmez — `apps/web/public/gorseller/birimler/suvari.webp`
 * dosyası konduğu anda Süvari'nin madalyonunda o görsel çıkar, dosya yoksa
 * game-icons silueti görünmeye devam eder.
 *
 * Böylece sanat işi koddan bağımsız ilerleyebilir: birim birim, general
 * general eklenebilir, yarısı çizilmişken de oyun tutarlı görünür.
 */
import { useState } from 'react';

export type GorselTuru =
  | 'birimler'
  | 'generaller'
  | 'bolgeler'
  | 'ekipman'
  | 'harita'
  | 'lord';

/**
 * Bölgenin aşamasına uygun görselin adı.
 *
 * Bölge geliştikçe görselin de değişmesi, geliştirmenin karşılığını GÖRÜNÜR
 * kılan tek şey: "Kasabam Pazar Şehri oldu" cümlesinin resmi olmalı. Aşama
 * görseli yoksa taban görsele düşülür — dosya konduğu anda devreye girer,
 * kod değişikliği gerekmez.
 *
 *   seviye 1-2 -> tarla        seviye 3-4 -> tarla_3       seviye 5 -> tarla_5
 */
export function bolgeGorselAdi(tip: string, seviye: number): string {
  if (seviye >= 5) return `${tip}_5`;
  if (seviye >= 3) return `${tip}_3`;
  return tip;
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
  /** Dosya adı (uzantısız): suvari, mizrakci, kusatmaci_tarik, kale... */
  ad: string;
  alt: string;
  boyut: number;
  /** İllüstrasyon yoksa gösterilecek ikon. */
  yedek: React.ReactNode;
  className?: string;
}) {
  const [yok, setYok] = useState(false);
  const [gosterilen, setGosterilen] = useState(`${tur}/${ad}`);

  // Aynı bileşen örneği başka bir görsele geçebilir (sekme değiştiren bir
  // liste, kuşanılan eşyanın değişmesi). Bir kez yedeğe düşmüş örnek,
  // görseli OLAN yeni adda da yedekte kalırdı. Render sırasında sıfırlıyoruz:
  // efektle yapsak bir kare boyunca yanlış görsel görünürdü.
  if (gosterilen !== `${tur}/${ad}`) {
    setGosterilen(`${tur}/${ad}`);
    setYok(false);
  }

  if (yok) return <>{yedek}</>;

  return (
    <img
      src={`/gorseller/${tur}/${ad}.webp`}
      alt={alt}
      width={boyut}
      height={boyut}
      loading="lazy"
      decoding="async"
      onError={() => setYok(true)}
      className={`object-contain ${className}`}
    />
  );
}
