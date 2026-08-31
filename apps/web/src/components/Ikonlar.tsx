/**
 * İkon seti — elle çizilmiş, tek renk, tutarlı.
 *
 * Neden hazır bir set değil: game-icons.net gibi kaynaklar CC-BY lisanslı ve
 * atıf yükü getiriyor; ayrıca farklı çizerlerden geldikleri için çizgi kalınlığı
 * ve doluluk oranı tutarsız oluyor. Burada hepsi aynı kurallarla çizildi:
 * 24×24 kutu, currentColor, 1.6 kalınlık, yuvarlak uçlar. Böylece metin rengini
 * miras alıyorlar ve her boyutta aynı ağırlıkta duruyorlar.
 */
import type { SVGProps } from 'react';

type IkonProps = SVGProps<SVGSVGElement> & { boyut?: number };

function Ikon({ boyut = 20, children, ...rest }: IkonProps) {
  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------- Birimler ---------- */

/** Köylü Milis — yaba. Savaşçı değil, eline geçeni almış köylü. */
export const IkonMilis = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M12 21V9" />
    <path d="M7 9V4M12 9V3M17 9V4" />
    <path d="M6 9h12" />
  </Ikon>
);

/**
 * Mızrakçı — mızrak. İlk denemede mızrak+kalkan birlikte çizilmişti; 20px'te
 * iki nesne birbirine giriyor ve hiçbiri okunmuyordu. Tek nesne daha net.
 */
export const IkonMizrakci = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M12 21V8.5" />
    <path d="M12 3c1.9 1.3 2.9 3.1 2.9 5.5H9.1C9.1 6.1 10.1 4.3 12 3z" />
    <path d="M9.5 11.5h5" />
  </Ikon>
);

/** Okçu — yay ve ok. Ucuz hasar. */
export const IkonOkcu = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M6 3a13 13 0 0 1 0 18" />
    <path d="M6 3 5 12l1 9" />
    <path d="M5 12h14" />
    <path d="m15 8 4 4-4 4" />
  </Ikon>
);

/**
 * Süvari — nal. At başı denendi ama 20px'te tanınmıyordu: çizgi sanatında
 * hayvan silueti bu ölçekte okunmuyor. Nal tek bakışta süvariyi anlatıyor.
 */
export const IkonSuvari = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M8 20v-2.5C8 15 6.5 13.4 6.5 10.5A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 5.5 5.5c0 2.9-1.5 4.5-1.5 7V20" />
    <path d="M8 20h2.2M13.8 20H16" />
    <circle cx="8.6" cy="10" r=".7" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="10" r=".7" fill="currentColor" stroke="none" />
    <circle cx="9.4" cy="13.6" r=".7" fill="currentColor" stroke="none" />
    <circle cx="14.6" cy="13.6" r=".7" fill="currentColor" stroke="none" />
  </Ikon>
);

/** Mancınık — kuşatma makinesi. Kaleye karşı güçlü, birime karşı zayıf. */
export const IkonKusatma = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M3 19h16" />
    <path d="M6 19 9 8" />
    <path d="M15 19 11 9" />
    <path d="m9 8 10-2" />
    <circle cx="19.4" cy="5.6" r="1.8" />
    <path d="M6.5 14h6" />
  </Ikon>
);

/* ---------- Savaş nitelikleri ---------- */

export const IkonSaldiri = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M18.5 3.5 8 14" />
    <path d="m20.5 3-3 .5.5 3 3-.5z" />
    <path d="m5 17 2 2" />
    <path d="M4.5 15.5 8.5 19.5" />
    <path d="m3 21 3-1-2-2z" />
  </Ikon>
);

export const IkonSavunma = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M12 3 4.5 5.5V11c0 4.4 3 7.9 7.5 9.5 4.5-1.6 7.5-5.1 7.5-9.5V5.5z" />
  </Ikon>
);

export const IkonCan = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M12 20s-7-4.3-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.7 12 20 12 20z" />
  </Ikon>
);

export const IkonHiz = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M3 8h9M3 12h6M3 16h9" />
    <path d="m14 6 6 6-6 6" />
  </Ikon>
);

/** Komuta yeri — sancak. Ordunun büyüklüğü Liderlik'le sınırlı. */
export const IkonYer = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M6 21V3" />
    <path d="M6 4h11l-2.5 3.5L17 11H6z" />
  </Ikon>
);

/* ---------- Kaynaklar ---------- */

export const IkonAltin = (p: IkonProps) => (
  <Ikon {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
  </Ikon>
);

export const IkonDemir = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M4 16.5 7 10h10l3 6.5z" />
    <path d="M7.6 10 9.5 6h5l1.9 4" />
  </Ikon>
);

export const IkonErzak = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M12 21V9" />
    <path d="M12 12c-2.4 0-4-1.6-4-4 2.4 0 4 1.6 4 4z" />
    <path d="M12 12c2.4 0 4-1.6 4-4-2.4 0-4 1.6-4 4z" />
    <path d="M12 8c-2 0-3.4-1.4-3.4-3.4C10.6 4.6 12 6 12 8z" />
    <path d="M12 8c2 0 3.4-1.4 3.4-3.4C13.4 4.6 12 6 12 8z" />
  </Ikon>
);

export const IkonSure = (p: IkonProps) => (
  <Ikon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Ikon>
);

export const IkonUyari = (p: IkonProps) => (
  <Ikon {...p}>
    <path d="M12 4 2.5 20h19z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.3" r=".9" fill="currentColor" stroke="none" />
  </Ikon>
);

/* ---------- Eşleme ---------- */

const BIRIM_IKONU = {
  milis: IkonMilis,
  mizrakci: IkonMizrakci,
  okcu: IkonOkcu,
  suvari: IkonSuvari,
  kusatma: IkonKusatma,
} as const;

export type BirimAnahtari = keyof typeof BIRIM_IKONU;

export function BirimIkonu({ tip, ...rest }: { tip: string } & IkonProps) {
  const C = BIRIM_IKONU[tip as BirimAnahtari] ?? IkonMilis;
  return <C {...rest} />;
}
