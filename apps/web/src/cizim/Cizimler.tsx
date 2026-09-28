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
import {
  GENERAL_ADLARI,
  LORD_ADLARI,
  PORTRE_ADLARI,
  PORTRE_KUTUSU,
  generalModeli,
  lordModeli,
  portreModeli,
} from './kisiler';
import { HARITA_KUTUSU, KAPAK_KUTUSU, diyarModeli, type Kadraj } from './diyarlar';
import { dunyaUcgenleri, type Ucgen } from './dunya';
import { ZEMIN_ADLARI, ZEMIN_KUTUSU, zeminModeli } from './zeminler';
import { Sahne } from './Sahne';
import type { Model } from './uc';
import { YERLESIM_KUTUSU, yerlesimModeli, type Kademe } from './yerlesim';

/** Çizimi olan bina adları (`kisla_3`, `arsa`, `gorev_panosu`...). */
export const CIZILEN_BINALAR = new Set(BINA_ADLARI);

/**
 * Tilt-shift odak bandı (yarı yükseklik, boya oran): afiş ve kapakta
 * ortanın üçte biri keskin; uzun ekran zemininde bant geniş (kule tepesi,
 * bayrak bulanıklaşmasın).
 */
const TILT_AFIS = 0.18;
const TILT_ZEMIN = 0.24;
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
  hareket = true,
}: {
  ad: string;
  alt: string;
  className?: string;
  /** Canlı afiş (su, ışık, duman); küçük karoda kapalı. */
  hareket?: boolean;
}) {
  return (
    <Sahne
      anahtar={'bolge:' + ad}
      uret={() => bolgeModeli(ad)}
      kutu={BOLGE_KUTUSU}
      alt={alt}
      className={className}
      kirp
      tilt={TILT_AFIS}
      hareket={hareket}
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
  generaller: [new Set(GENERAL_ADLARI), generalModeli],
  lord: [new Set(LORD_ADLARI), lordModeli],
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

const PORTRELER = new Set(PORTRE_ADLARI);

export function portreCizimiVar(ad: string): boolean {
  return PORTRELER.has(ad);
}

/**
 * Portre: generalin, lordun ya da düşman şefinin baş-omuz kadrajı.
 * Kutuyu dolduruyor (yuvarlak profil resmi, rehberin küçük karesi).
 */
export function PortreCizimi({
  ad,
  alt = '',
  className,
}: {
  ad: string;
  alt?: string;
  className?: string;
}) {
  if (!PORTRELER.has(ad)) return null;
  return (
    <Sahne
      anahtar={'portre:' + ad}
      uret={() => portreModeli(ad) ?? []}
      kutu={PORTRE_KUTUSU}
      alt={alt}
      className={className}
      kirp
    />
  );
}

/**
 * `klasor/ad` biçimindeki bir yolu (`binalar/kisla_3`, `portre/lord_3`,
 * `harita/dunya`) çizime çevirir. Karo gibi tek bir dizgeyle tanımlanmış
 * yerler için.
 */
export function YolCizimi({ yol, className }: { yol: string; className?: string }) {
  const [klasor = '', ad = ''] = yol.split('/');
  if (klasor === 'binalar') return <BinaCizimi ad={ad} className={className} />;
  if (klasor === 'bolgeler')
    return <BolgeCizimi ad={ad} alt="" className={className} hareket={false} />;
  if (klasor === 'portre') return <PortreCizimi ad={ad} className={className} />;
  if (klasor === 'harita') return <DunyaKucuk className={className} />;
  return <NesneCizimi tur={klasor} ad={ad} className={className} />;
}

/** Akın diyarının kapağı (16:9, kutuyu doldurur) ya da haritası (kare). */
export function DiyarCizimi({
  ad,
  kadraj,
  className,
  hareket = kadraj === 'kapak',
}: {
  ad: string;
  kadraj: Kadraj;
  className?: string;
  /** Canlı kapak (su, ışık, duman); küçük kilitli pencerede kapalı. */
  hareket?: boolean;
}) {
  return (
    <Sahne
      anahtar={'diyar:' + ad + ':' + kadraj}
      uret={() => diyarModeli(ad, kadraj) ?? []}
      kutu={kadraj === 'kapak' ? KAPAK_KUTUSU : HARITA_KUTUSU}
      alt=""
      className={className}
      kirp
      tilt={kadraj === 'kapak' ? TILT_AFIS : undefined}
      hareket={hareket}
    />
  );
}

let kucukDunya: Ucgen[] | null = null;

/** Dünyanın kaba önizlemesi (kasa karosu): ağaçsız, seyrek ızgara. */
export function DunyaKucuk({ className }: { className?: string }) {
  kucukDunya ??= dunyaUcgenleri(4, false);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {kucukDunya.map((u, i) => (
        <polygon key={i} points={u.n.join(' ')} fill={u.renk} stroke={u.renk} strokeWidth={0.3} />
      ))}
    </svg>
  );
}

/** Çizimi olan ekran zeminleri (`kisla`, `demirhane`...). */
export const CIZILEN_ZEMINLER = new Set<string>(ZEMIN_ADLARI);

/** Ekranın tepesindeki manzara şeridi: kutuyu doldurur, taşanı kırpar. */
export function ZeminCizimi({ ad, className }: { ad: string; className?: string }) {
  return (
    <Sahne
      anahtar={'zemin:' + ad}
      uret={() => zeminModeli(ad) ?? []}
      kutu={ZEMIN_KUTUSU}
      alt=""
      className={className}
      kirp
      tilt={TILT_ZEMIN}
      hareket
      ertele
    />
  );
}
