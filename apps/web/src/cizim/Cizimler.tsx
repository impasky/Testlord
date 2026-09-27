/**
 * Oyunun kullandığı çizim bileşenleri — ekranlar yalnız buradan alıyor
 * (docs/24). Her biri bir model üreticisini ortak çerçevesiyle
 * `Sahne`ye bağlıyor.
 */
import type { CSSProperties } from 'react';
import { BINA_ADLARI, BINA_KUTUSU, binaModeli } from './binalar';
import {
  BIRLIK_ADLARI,
  DUSMAN_ADLARI,
  EKIPMAN_ADLARI,
  birlikModeli,
  dusmanModeli,
  ekipmanModeli,
} from './birlikler';
import { BOLGE_KUTUSU, BOLGE_TIPLERI, bolgeModeli } from './bolgeler';
import { Sahne } from './Sahne';
import type { Model } from './uc';
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

/**
 * `Gorsel` türleri için çizim üreticileri: tür → (ad kümesi, üretici).
 * Kümede olmayan ad için `null` — çağıran kendi yedeğini (ikon) gösteriyor.
 */
const NESNE: Record<string, [Set<string>, (ad: string) => Model | null]> = {
  birimler: [new Set(BIRLIK_ADLARI), birlikModeli],
  dusmanlar: [new Set(DUSMAN_ADLARI), dusmanModeli],
  ekipman: [new Set(EKIPMAN_ADLARI), ekipmanModeli],
};

export function nesneCizimiVar(tur: string, ad: string): boolean {
  return NESNE[tur]?.[0].has(ad) ?? false;
}

/** Birlik, düşman, eşya: kare yuvada ortalı, kendi çerçevesinde. */
export function NesneCizimi({
  tur,
  ad,
  alt = '',
  boyut,
  className,
  style,
}: {
  tur: string;
  ad: string;
  alt?: string;
  boyut?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const uret = NESNE[tur]?.[1];
  if (!uret || !nesneCizimiVar(tur, ad)) return null;
  return (
    <Sahne
      anahtar={tur + ':' + ad}
      uret={() => uret(ad) ?? []}
      alt={alt}
      boyut={boyut}
      className={className}
      style={style}
      kare
    />
  );
}
