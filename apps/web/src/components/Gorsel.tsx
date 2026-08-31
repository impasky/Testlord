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

export type GorselTuru = 'birimler' | 'generaller' | 'bolgeler';

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
