/**
 * Oyunun kullandığı çizim bileşenleri — ekranlar yalnız buradan alıyor
 * (docs/24). Her biri bir model üreticisini ortak çerçevesiyle
 * `Sahne`ye bağlıyor.
 */
import type { CSSProperties } from 'react';
import { BINA_ADLARI, BINA_KUTUSU, binaModeli } from './binalar';
import { BOLGE_KUTUSU, BOLGE_TIPLERI, bolgeModeli } from './bolgeler';
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

/** Çizimi olan bölge türleri (`koy`, `tarla`, `maden`, `sehir`, `kale`, `taht`). */
export const CIZILEN_BOLGELER = new Set<string>(BOLGE_TIPLERI);

/**
 * Bölge afişi: türün aşama sahnesi (`tarla`, `tarla_3`, `tarla_5`).
 * Kutuyu dolduruyor; kısa şeritte ortası görünüyor.
 */
export function BolgeCizimi({
  ad,
  alt,
  className,
}: {
  ad: string;
  alt: string;
  className?: string;
}) {
  return (
    <Sahne
      anahtar={'bolge:' + ad}
      uret={() => bolgeModeli(ad)}
      kutu={BOLGE_KUTUSU}
      alt={alt}
      className={className}
      kirp
    />
  );
}
