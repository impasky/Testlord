/** Ortak arayüz parçaları. Ekranlar bunları kullanır, kendi stilini yazmaz. */
import type { ReactNode } from 'react';

export function Panel({
  title,
  action,
  children,
  className = '',
  suslu = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Köşe süsleri. Küçük veya iç içe panellerde kapatılabilir. */
  suslu?: boolean;
}) {
  return (
    <section
      className={`panel-doku rounded-lg border border-kenar ${suslu ? 'kose-suslu' : ''} ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-kenar/80 px-4 py-2.5">
          <h2 className="baslik text-sm font-semibold tracking-widest text-altin/85 uppercase">
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles = {
    primary: 'bg-altin/85 text-gece hover:bg-altin border-altin/60 font-semibold',
    ghost: 'bg-transparent text-parsomen/80 hover:bg-kenar/60 border-kenar',
    danger: 'bg-kan/80 text-parsomen hover:bg-kan border-kan/60',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs tracking-wide text-solgun uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-solgun">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  // Taban sınıflarda genişlik YOK. Önceden 'w-full' gömülüydü ve çağıranın
  // verdiği 'w-20' hiçbir zaman kazanamıyordu (aynı özgüllük, stylesheet
  // sırası belirliyordu). Genişlik verilmediyse tam genişlik varsayılır.
  const genislikVar = /(^|\s)(w-|max-w-)/.test(className);
  return (
    <input
      {...props}
      className={`rounded border border-kenar bg-oyuk/70 px-3 py-2 text-parsomen shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)] outline-none transition-colors focus:border-altin/70 ${
        genislikVar ? '' : 'w-full'
      } ${className}`}
    />
  );
}

/** Değeri ve tavanı olan çubuk. Doluluk oranı renk değiştirir. */
export function Meter({
  value,
  max,
  tone = 'altin',
  kalin = false,
}: {
  value: number;
  max: number;
  tone?: 'altin' | 'demir' | 'erzak' | 'kan';
  kalin?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bg = { altin: 'bg-altin', demir: 'bg-demir', erzak: 'bg-erzak', kan: 'bg-kan' }[tone];
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-oyuk shadow-[inset_0_1px_2px_rgba(0,0,0,0.7)] ${
        kalin ? 'h-2.5' : 'h-1.5'
      }`}
      role="presentation"
    >
      <div
        className={`h-full ${bg} transition-[width] duration-500`}
        style={{
          width: `${pct}%`,
          // Üstte açık bir kenar: çubuk düz renk yerine hacimli görünür
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
        }}
      />
    </div>
  );
}

/** İkon + sayı ikilisi. Kışla'daki istatistik satırlarının yapı taşı. */
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
      <span className="opacity-75">{ikon}</span>
      <span className="tabular">{deger}</span>
      <span className="sr-only">{baslik}</span>
    </span>
  );
}

export function Sayi({ children }: { children: ReactNode }) {
  return <span className="tabular">{children}</span>;
}

export function formatSayi(n: number): string {
  return Math.floor(n).toLocaleString('tr-TR');
}

/** Kalan süreyi "2sa 14dk" gibi gösterir. Bitiş saati değil geri sayım. */
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
