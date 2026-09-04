/**
 * Arma: oyuncunun heraldik kimliği.
 *
 * docs/10 §1.1 — ortaçağ oyunlarında en çok sevilen şey kimlik ve armanın
 * kendisi ortaçağın kimlik teknolojisiydi: savaş alanında kim olduğunu
 * söyleyen şeydi.
 *
 * Her parça SVG olarak burada çiziliyor. On sekiz bin kombinasyon var ve
 * içerik maliyeti sıfır — tek bir görsel dosyası bile yok. Bu, oyunun
 * geri kalanındaki "görseli üret, dosyaya koy" yaklaşımının tersi ve
 * bilerek: arma OYUNCUNUN seçimi, bizim ürettiğimiz bir varlık değil.
 */
import { ARMA, armaRengi, type Arma as ArmaTipi } from '@lordlar/shared';

/** Kalkan biçimleri — 0..100 kutusunda yol. */
const KALKAN: Record<string, string> = {
  sivri: 'M50 4 L94 18 V52 C94 76 74 92 50 98 C26 92 6 76 6 52 V18 Z',
  yuvarlak: 'M50 4 C78 4 94 14 94 14 V50 C94 78 74 94 50 98 C26 94 6 78 6 50 V14 C6 14 22 4 50 4 Z',
  kare: 'M8 6 H92 V78 C92 88 84 94 50 98 C16 94 8 88 8 78 Z',
  kesik: 'M50 4 L94 18 V60 L50 98 L6 60 V18 Z',
};

/** Zemin desenleri: ikinci rengin nereye bindiği. */
function Desen({ desen, r2 }: { desen: string; r2: string }) {
  switch (desen) {
    case 'yatay':
      return <rect x="0" y="50" width="100" height="50" fill={r2} />;
    case 'dikey':
      return <rect x="50" y="0" width="50" height="100" fill={r2} />;
    case 'capraz':
      return <path d="M0 0 L100 0 L0 100 Z" fill={r2} />;
    case 'cheuron':
      return <path d="M0 100 L50 44 L100 100 Z" fill={r2} />;
    case 'dortlu':
      return (
        <>
          <rect x="50" y="0" width="50" height="50" fill={r2} />
          <rect x="0" y="50" width="50" height="50" fill={r2} />
        </>
      );
    default:
      return null;
  }
}

/**
 * Semboller. Sade siluetler: 24 pikselde de okunabilmeli, çünkü arma
 * çoğunlukla adın yanında küçücük görünüyor.
 */
function Sembol({ sembol, renk }: { sembol: string; renk: string }) {
  const o = { fill: renk, stroke: renk, strokeWidth: 3, strokeLinejoin: 'round' as const };
  switch (sembol) {
    case 'kilic':
      return (
        <g {...o}>
          <path d="M50 20 L54 30 V62 H46 V30 Z" />
          <rect x="38" y="62" width="24" height="6" />
          <rect x="47" y="68" width="6" height="12" />
        </g>
      );
    case 'kule':
      return (
        <g {...o}>
          <path d="M34 34 h8 v-8 h6 v8 h4 v-8 h6 v8 h8 v46 H34 Z" />
          <rect x="46" y="56" width="8" height="24" fill="#0006" stroke="none" />
        </g>
      );
    case 'kartal':
      return (
        <g {...o}>
          <path d="M50 28 L58 40 L82 34 L66 52 L78 70 L50 60 L22 70 L34 52 L18 34 L42 40 Z" />
        </g>
      );
    case 'aslan':
      return (
        <g {...o}>
          <circle cx="50" cy="44" r="16" />
          <path d="M50 22 l6 8 8-6 -2 10 10 2 -8 6 6 8 -10 -1 -1 10 -9 -6 -9 6 -1 -10 -10 1 6 -8 -8 -6 10 -2 -2 -10 8 6 Z" />
          <path d="M40 62 h20 l6 20 H34 Z" />
        </g>
      );
    case 'kurt':
      return (
        <g {...o}>
          <path d="M30 34 L38 46 H62 L70 34 L74 58 C74 74 62 82 50 82 C38 82 26 74 26 58 Z" />
          <circle cx="42" cy="56" r="3" fill="#0008" stroke="none" />
          <circle cx="58" cy="56" r="3" fill="#0008" stroke="none" />
        </g>
      );
    case 'hilal':
      return (
        <g {...o}>
          <path d="M62 26 A28 28 0 1 0 62 78 A22 22 0 1 1 62 26 Z" />
        </g>
      );
    case 'yildiz':
      return (
        <g {...o}>
          <path d="M50 22 L58 44 H82 L63 58 L70 80 L50 66 L30 80 L37 58 L18 44 H42 Z" />
        </g>
      );
    case 'mizrak':
      return (
        <g {...o}>
          <path d="M50 18 L58 36 L50 44 L42 36 Z" />
          <rect x="47" y="44" width="6" height="40" />
        </g>
      );
    case 'bugday':
      return (
        <g {...o}>
          <rect x="47" y="46" width="6" height="36" />
          <path d="M50 22 c10 6 12 16 0 24 -12 -8 -10 -18 0 -24 Z" />
          <path d="M50 40 c12 4 14 14 2 20 -12 -6 -12 -14 -2 -20 Z" />
        </g>
      );
    case 'cekic':
      return (
        <g {...o}>
          <rect x="30" y="26" width="40" height="18" rx="3" />
          <rect x="46" y="44" width="8" height="38" />
        </g>
      );
    case 'gul':
      return (
        <g {...o}>
          <circle cx="50" cy="52" r="10" />
          <path d="M50 28 c14 4 18 18 8 26 -10 -8 -10 -18 -8 -26 Z" />
          <path d="M72 44 c4 14 -8 22 -18 16 6 -10 14 -14 18 -16 Z" />
          <path d="M28 44 c-4 14 8 22 18 16 -6 -10 -14 -14 -18 -16 Z" />
          <path d="M62 74 c-10 8 -22 2 -22 -10 12 0 18 6 22 10 Z" />
          <path d="M38 74 c10 8 22 2 22 -10 -12 0 -18 6 -22 10 Z" />
        </g>
      );
    default:
      return null;
  }
}

/** Bir rengin algılanan parlaklığı (0..255). */
function parlaklik(kod: string): number {
  const n = parseInt(kod.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Sembol rengi: zeminle KONTRAST kuran açık ya da koyu ton.
 *
 * Önce sembolü ikinci renkle çiziyordum ve desen de ikinci renkti —
 * yani "yatay bölünmüş" bir armada sembolün alt yarısı kayboluyordu.
 * Heraldikte kural "renk üstüne metal, metal üstüne renk"tir; burada
 * aynı işi parlaklık farkıyla yapıyoruz, çünkü arma çoğunlukla 22
 * pikselde görünüyor ve orada okunmayan sembol yok sayılır.
 */
function sembolRengi(r1: string, r2: string): string {
  const ort = (parlaklik(r1) + parlaklik(r2)) / 2;
  return ort > 120 ? '#241a13' : '#f0e6d2';
}

export function Arma({
  arma,
  boyut = 28,
  className = '',
}: {
  arma: ArmaTipi;
  boyut?: number;
  className?: string;
}) {
  const r1 = armaRengi(arma.renk1);
  const r2 = armaRengi(arma.renk2);
  const kalkanYolu = KALKAN[arma.kalkan] ?? KALKAN.sivri!;
  // Kırpma kimliği benzersiz olmalı: aynı sayfada birden çok arma var
  // (sıralama, üye listesi) ve ortak bir id hepsini ilk armanın biçimine
  // kırpardı.
  const kimlik = `arma-${arma.kalkan}-${arma.desen}-${arma.renk1}-${arma.renk2}-${arma.sembol}`;

  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 100 104"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={kimlik}>
          <path d={kalkanYolu} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${kimlik})`}>
        <rect x="0" y="0" width="100" height="104" fill={r1} />
        <Desen desen={arma.desen} r2={r2} />
        <Sembol sembol={arma.sembol} renk={sembolRengi(r1, r2)} />
      </g>
      <path d={kalkanYolu} fill="none" stroke="#0000007a" strokeWidth="6" />
    </svg>
  );
}

/** Seçim ekranı için: bir parçanın adı. */
export function armaParcaAdi(tur: keyof typeof ARMA, key: string): string {
  const liste = ARMA[tur] as { key: string; ad: string }[];
  return liste.find((x) => x.key === key)?.ad ?? key;
}
