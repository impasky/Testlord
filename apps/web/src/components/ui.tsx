/** Ortak arayüz parçaları. Ekranlar bunları kullanır, kendi stilini yazmaz. */
import type { ReactNode } from 'react';

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-kenar bg-panel/70 shadow-lg shadow-black/30 ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-kenar px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-parsomen/90 uppercase">
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

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded border border-kenar bg-gece/60 px-3 py-2 text-parsomen outline-none focus:border-altin/70"
    />
  );
}

/** Değeri ve tavanı olan çubuk. Doluluk oranı renk değiştirir. */
export function Meter({
  value,
  max,
  tone = 'altin',
}: {
  value: number;
  max: number;
  tone?: 'altin' | 'demir' | 'erzak' | 'kan';
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bg = { altin: 'bg-altin', demir: 'bg-demir', erzak: 'bg-erzak', kan: 'bg-kan' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gece/80">
      <div className={`h-full ${bg} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
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
