/**
 * Mobil arayüz parçaları.
 *
 * Görsel dil modern mobil RPG çıtasına göre: yuvarlak kartlar, kalın büyük
 * harf başlıklar, parlak altın eylem butonları, nadirlik renk sistemi.
 * Masaüstü düzeni YOK — her şey tek sütun, dokunmatik hedefleri ≥44px.
 */
import type { ReactNode } from 'react';

/* ---------------- Nadirlik ---------------- */

export type Nadirlik = 'siradan' | 'usta' | 'nadir' | 'efsanevi' | 'kadim';

export const NADIRLIK: Record<Nadirlik, { ad: string; renk: string; sinif: string; kenar: string }> =
  {
    siradan: { ad: 'Sıradan', renk: '#9aa0a6', sinif: 'text-nadir-siradan', kenar: 'border-nadir-siradan/50' },
    usta: { ad: 'Usta işi', renk: '#3ddc84', sinif: 'text-nadir-usta', kenar: 'border-nadir-usta/50' },
    nadir: { ad: 'Nadir', renk: '#4a9eff', sinif: 'text-nadir-nadir', kenar: 'border-nadir-nadir/50' },
    efsanevi: { ad: 'Efsanevi', renk: '#a76bff', sinif: 'text-nadir-efsanevi', kenar: 'border-nadir-efsanevi/50' },
    kadim: { ad: 'Kadim', renk: '#f5b731', sinif: 'text-nadir-kadim', kenar: 'border-nadir-kadim/50' },
  };

export function nadirlikRengi(n: string): string {
  return NADIRLIK[n as Nadirlik]?.renk ?? NADIRLIK.siradan.renk;
}

/* ---------------- Kart ---------------- */

export function Kart({
  children,
  className = '',
  onClick,
  vurgu,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  /** Üst kenarda nadirlik/durum rengi şeridi. */
  vurgu?: string;
}) {
  const Etiket = onClick ? 'button' : 'div';
  return (
    <Etiket
      onClick={onClick}
      className={`kart relative overflow-hidden text-left ${onClick ? 'bas w-full' : ''} ${className}`}
    >
      {vurgu && (
        <span
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: vurgu }}
          aria-hidden="true"
        />
      )}
      {children}
    </Etiket>
  );
}

/** Başlıklı bölüm. Mobilde panel yerine bölüm başlığı + kart kullanılır. */
export function Bolum({
  baslik,
  yan,
  children,
  className = '',
}: {
  baslik?: string;
  yan?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {baslik && (
        <header className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 className="baslik text-[13px] text-solgun">{baslik}</h2>
          {yan}
        </header>
      )}
      {children}
    </section>
  );
}

/* ---------------- Buton ---------------- */

type ButonTuru = 'altin' | 'yesil' | 'kirmizi' | 'sessiz' | 'anahat';

const BUTON_SINIFI: Record<ButonTuru, string> = {
  altin:
    'bg-gradient-to-b from-altin to-altin-koyu text-gece border-altin-koyu shadow-[0_2px_0_rgba(0,0,0,0.35)]',
  yesil: 'bg-yesil-koyu text-white border-yesil/40',
  kirmizi: 'bg-transparent text-kirmizi border-kirmizi/60',
  sessiz: 'bg-yuzey text-parsomen border-kenar',
  anahat: 'bg-transparent text-solgun border-kenar',
};

export function Buton({
  children,
  onClick,
  disabled,
  tur = 'altin',
  boy = 'orta',
  tam,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tur?: ButonTuru;
  boy?: 'kucuk' | 'orta' | 'buyuk';
  /** Tam genişlik — ana eylemler için. */
  tam?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const boySinifi = {
    kucuk: 'px-3 py-2 text-[12px] rounded-lg',
    orta: 'px-4 py-2.5 text-[13px] rounded-xl',
    buyuk: 'px-5 py-3.5 text-[15px] rounded-2xl',
  }[boy];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`bas baslik border disabled:pointer-events-none disabled:opacity-40 ${BUTON_SINIFI[tur]} ${boySinifi} ${
        tam ? 'w-full' : ''
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------- Giriş ---------------- */

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const genislikVar = /(^|\s)(w-|max-w-)/.test(className);
  return (
    <input
      {...props}
      className={`oyuk rounded-xl border border-kenar px-3 py-2.5 text-parsomen outline-none focus:border-altin/70 ${
        genislikVar ? '' : 'w-full'
      } ${className}`}
    />
  );
}

export function Alan({ etiket, ipucu, children }: { etiket: string; ipucu?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="baslik mb-1.5 block text-[11px] text-solgun">{etiket}</span>
      {children}
      {ipucu && <span className="mt-1 block text-[11px] text-sonuk">{ipucu}</span>}
    </label>
  );
}

/* ---------------- İlerleme ---------------- */

export function Ilerleme({
  deger,
  max,
  renk = 'var(--color-altin)',
  boy = 'orta',
}: {
  deger: number;
  max: number;
  renk?: string;
  boy?: 'ince' | 'orta' | 'kalin';
}) {
  const yuzde = max > 0 ? Math.min(100, Math.max(0, (deger / max) * 100)) : 0;
  const y = { ince: 'h-1.5', orta: 'h-2.5', kalin: 'h-3.5' }[boy];
  return (
    <div className={`oyuk w-full overflow-hidden rounded-full ${y}`} role="presentation">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${yuzde}%`, background: renk, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}
      />
    </div>
  );
}

/* ---------------- Rozet ---------------- */

export function Rozet({
  children,
  renk,
  className = '',
}: {
  children: ReactNode;
  renk?: string;
  className?: string;
}) {
  return (
    <span
      className={`baslik inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] ${className}`}
      style={
        renk
          ? { color: renk, background: `color-mix(in srgb, ${renk} 16%, transparent)` }
          : undefined
      }
    >
      {children}
    </span>
  );
}

/** Renkli kare ikon + etiket + değer. Referanstaki istatistik kartı. */
export function DegerKarti({
  ikon,
  etiket,
  deger,
  renk = 'var(--color-altin)',
  alt,
}: {
  ikon: ReactNode;
  etiket: string;
  deger: ReactNode;
  renk?: string;
  alt?: ReactNode;
}) {
  return (
    <Kart className="p-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in srgb, ${renk} 22%, transparent)`, color: renk }}
        >
          {ikon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="baslik text-[10px] text-solgun">{etiket}</div>
          <div className="tabular text-lg leading-tight font-bold">{deger}</div>
        </div>
      </div>
      {alt && <div className="mt-2">{alt}</div>}
    </Kart>
  );
}

/* ---------------- Yardımcılar ---------------- */

export function formatSayi(n: number): string {
  return Math.floor(n).toLocaleString('tr-TR');
}

/** Büyük sayıları kısaltır: 65.081 -> 65,1B. Üst barda yer dar. */
export function kisaSayi(n: number): string {
  const a = Math.floor(Math.abs(n));
  const isaret = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${isaret}${(a / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (a >= 10_000) return `${isaret}${(a / 1000).toFixed(1).replace('.', ',')}B`;
  return `${isaret}${a.toLocaleString('tr-TR')}`;
}

export function formatKalan(ms: number): string {
  if (ms <= 0) return 'bitti';
  const sn = Math.floor(ms / 1000);
  const gun = Math.floor(sn / 86400);
  const sa = Math.floor((sn % 86400) / 3600);
  const dk = Math.floor((sn % 3600) / 60);
  const s = sn % 60;
  if (gun > 0) return `${gun}g ${sa}sa`;
  if (sa > 0) return `${sa}sa ${dk}dk`;
  if (dk > 0) return `${dk}dk ${s}sn`;
  return `${s}sn`;
}

export function IkonluDeger({
  ikon,
  deger,
  baslik,
  renk = 'text-solgun',
}: {
  ikon: ReactNode;
  deger: ReactNode;
  baslik: string;
  renk?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${renk}`} title={baslik}>
      <span className="opacity-70">{ikon}</span>
      <span className="tabular font-medium">{deger}</span>
      <span className="sr-only">{baslik}</span>
    </span>
  );
}
