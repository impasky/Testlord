/**
 * Oyunun kullandığı çizim bileşenleri — ekranlar yalnız buradan alıyor
 * (docs/24). Her biri bir model üreticisini ortak çerçevesiyle
 * `Sahne`ye bağlıyor.
 */
import type { CSSProperties } from 'react';
import { BINA_ADLARI, BINA_KUTUSU, binaModeli } from './binalar';
import { Sahne } from './Sahne';
import { YERLESIM_KUTUSU, yerlesimModeli, type Kademe } from './yerlesim';

/** Çizimi olan bina adları (`kisla_3`, `arsa`, `gorev_panosu`...). */
export const CIZILEN_BINALAR = new Set(BINA_ADLARI);

export function BinaCizimi({
  ad,
  boyut,
  alt = '',
  className,
  style,
}: {
  ad: string;
  boyut?: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Sahne
      anahtar={'bina:' + ad}
      uret={() => binaModeli(ad)}
      kutu={BINA_KUTUSU}
      boyut={boyut}
      alt={alt}
      className={className}
      style={style}
    />
  );
}

export function YerlesimCizimi({ kademe, className }: { kademe: string; className?: string }) {
  const k = kademe as Kademe;
  return (
    <Sahne
      anahtar={'yerlesim:' + k}
      uret={() => yerlesimModeli(k)}
      kutu={YERLESIM_KUTUSU}
      alt=""
      className={className}
    />
  );
}
