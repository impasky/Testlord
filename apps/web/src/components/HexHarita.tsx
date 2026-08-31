/**
 * 61 altıgenlik dünya haritası (SVG).
 *
 * Mobilde tek dokunuşla bölge seçilir. Sahiplik hem RENK hem DESEN ile
 * gösterilir (renk körü güvenliği), bölge tipi ise ikonla — küçük ekranda
 * isim okunmuyor, ikon okunuyor.
 */
import type { RegionDto } from '../api/client';
import { IKONLAR } from './ikon-verisi';

const BOYUT = 34;
const PAD = 26;

const TIP_ZEMIN: Record<string, string> = {
  tarla: '#3d4a2a',
  maden: '#36414d',
  sehir: '#4d4028',
  kale: '#4d2f2a',
  taht: '#5c4418',
};

const TIP_IKON: Record<string, keyof typeof IKONLAR> = {
  tarla: 'tarla',
  maden: 'maden',
  sehir: 'sehir',
  kale: 'kale',
  taht: 'taht',
};

function merkez(q: number, r: number) {
  return { x: BOYUT * Math.sqrt(3) * (q + r / 2), y: BOYUT * 1.5 * r };
}

function hexYol(cx: number, cy: number, s = BOYUT * 0.93): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    p.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return `M${p.join('L')}Z`;
}

/** Bölge tipi ikonunu hex'in ortasına ölçekleyerek yerleştirir. */
function TipIkonu({ tip, x, y, opaklik }: { tip: string; x: number; y: number; opaklik: number }) {
  const anahtar = TIP_IKON[tip];
  if (!anahtar) return null;
  const v = IKONLAR[anahtar];
  const hedef = BOYUT * 0.92;
  const olcek = hedef / v.w;
  return (
    <g
      transform={`translate(${x - hedef / 2} ${y - hedef / 2 - 3}) scale(${olcek})`}
      opacity={opaklik}
      className="pointer-events-none"
      dangerouslySetInnerHTML={{ __html: v.body }}
    />
  );
}

export function HexHarita({
  regions,
  home,
  seciliId,
  onSec,
}: {
  regions: RegionDto[];
  home: { q: number; r: number };
  seciliId: number | null;
  onSec: (id: number) => void;
}) {
  const m = regions.map((r) => ({ r, ...merkez(r.q, r.r) }));
  const xs = m.map((a) => a.x);
  const ys = m.map((a) => a.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - minX + PAD;
  const h = Math.max(...ys) - minY + PAD;
  const ev = merkez(home.q, home.r);

  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      className="h-auto w-full"
      role="img"
      aria-label="Dünya haritası, 61 bölge"
    >
      <defs>
        <pattern id="benim" patternUnits="userSpaceOnUse" width="7" height="7">
          <path d="M0,7 L7,0" stroke="#f5b731" strokeWidth="1.6" opacity="0.5" />
        </pattern>
        <pattern id="dusman" patternUnits="userSpaceOnUse" width="7" height="7">
          <circle cx="3.5" cy="3.5" r="1.3" fill="#e8524d" opacity="0.55" />
        </pattern>
      </defs>

      {m.map(({ r, x, y }) => {
        const secili = seciliId === r.id;
        const taht = r.type === 'taht';
        return (
          <g
            key={r.id}
            onClick={() => onSec(r.id)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSec(r.id);
            }}
          >
            <title>
              {r.name} — {r.type}, seviye {r.level},{' '}
              {r.owner ? `sahibi ${r.owner.name}` : 'sahipsiz'}, {r.distance} hex
            </title>
            <path
              d={hexYol(x, y)}
              fill={TIP_ZEMIN[r.type] ?? '#333'}
              stroke={secili ? '#f5b731' : taht ? '#f5b731' : '#4a3527'}
              strokeWidth={secili ? 3.5 : taht ? 2 : 1}
            />
            {r.isMine && <path d={hexYol(x, y)} fill="url(#benim)" stroke="none" />}
            {r.owner && !r.isMine && <path d={hexYol(x, y)} fill="url(#dusman)" stroke="none" />}

            <g fill={taht ? '#f5b731' : '#f2e7d5'}>
              <TipIkonu tip={r.type} x={x} y={y} opaklik={taht ? 0.9 : 0.42} />
            </g>

            <text
              x={x}
              y={y + BOYUT * 0.62}
              textAnchor="middle"
              className="pointer-events-none select-none"
              fontSize="10"
              fontWeight="700"
              fill={secili ? '#f5b731' : '#f2e7d5'}
            >
              {r.level}
              {r.shielded ? '⛨' : ''}
            </text>
          </g>
        );
      })}

      <g className="pointer-events-none">
        <circle cx={ev.x} cy={ev.y} r={8} fill="#f5b731" stroke="#17100c" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
