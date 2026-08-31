/**
 * 61 altıgenlik dünya haritası (SVG).
 *
 * Renk körü güvenliği (docs/01 §9): sahiplik hem RENK hem DESEN ile gösterilir.
 * Benim bölgelerim çapraz taramalı, düşman bölgeleri noktalı, NPC bölgeleri düz.
 */
import type { RegionDto } from '../api/client';

const BOYUT = 34;
const PAD = 40;

const TIP_RENGI: Record<string, string> = {
  tarla: '#3d4a2a',
  maden: '#3a3f47',
  sehir: '#4a3f2a',
  kale: '#4a2f2a',
  taht: '#5a4418',
};

function merkez(q: number, r: number): { x: number; y: number } {
  return {
    x: BOYUT * Math.sqrt(3) * (q + r / 2),
    y: BOYUT * 1.5 * r,
  };
}

function hexYol(cx: number, cy: number, s = BOYUT * 0.94): string {
  const noktalar: string[] = [];
  for (let i = 0; i < 6; i++) {
    const aci = (Math.PI / 180) * (60 * i - 90);
    noktalar.push(`${(cx + s * Math.cos(aci)).toFixed(1)},${(cy + s * Math.sin(aci)).toFixed(1)}`);
  }
  return `M${noktalar.join('L')}Z`;
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
  const merkezler = regions.map((r) => ({ r, ...merkez(r.q, r.r) }));
  const xs = merkezler.map((m) => m.x);
  const ys = merkezler.map((m) => m.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const genislik = Math.max(...xs) - minX + PAD;
  const yukseklik = Math.max(...ys) - minY + PAD;
  const ev = merkez(home.q, home.r);

  return (
    <svg
      viewBox={`${minX} ${minY} ${genislik} ${yukseklik}`}
      className="h-auto w-full"
      role="img"
      aria-label="Dünya haritası, 61 bölge"
    >
      <defs>
        <pattern id="benim" patternUnits="userSpaceOnUse" width="6" height="6">
          <path d="M0,6 L6,0" stroke="#d4a24c" strokeWidth="1.4" opacity="0.55" />
        </pattern>
        <pattern id="dusman" patternUnits="userSpaceOnUse" width="6" height="6">
          <circle cx="3" cy="3" r="1.1" fill="#a63d40" opacity="0.6" />
        </pattern>
      </defs>

      {merkezler.map(({ r, x, y }) => {
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
              {r.owner ? `sahibi ${r.owner.name}` : 'sahipsiz'}, {r.distance} hex uzakta
            </title>
            <path
              d={hexYol(x, y)}
              fill={TIP_RENGI[r.type] ?? '#333'}
              stroke={secili ? '#d4a24c' : taht ? '#d4a24c' : '#3a2f24'}
              strokeWidth={secili ? 3 : taht ? 2 : 1}
            />
            {r.isMine && <path d={hexYol(x, y)} fill="url(#benim)" stroke="none" />}
            {r.owner && !r.isMine && <path d={hexYol(x, y)} fill="url(#dusman)" stroke="none" />}

            <text
              x={x}
              y={y - 4}
              textAnchor="middle"
              className="pointer-events-none select-none"
              fontSize="9"
              fill="#e8dcc4"
            >
              {r.name.length > 11 ? `${r.name.slice(0, 10)}…` : r.name}
            </text>
            <text
              x={x}
              y={y + 8}
              textAnchor="middle"
              className="pointer-events-none select-none"
              fontSize="9"
              fill="#9c8a6e"
            >
              Lv{r.level}
              {r.shielded ? ' ⛨' : ''}
            </text>
          </g>
        );
      })}

      {/* Malikâne çıpası */}
      <g className="pointer-events-none">
        <circle cx={ev.x} cy={ev.y} r={7} fill="#d4a24c" stroke="#14100c" strokeWidth="2" />
        <text x={ev.x} y={ev.y + 22} textAnchor="middle" fontSize="8" fill="#d4a24c">
          malikâne
        </text>
      </g>
    </svg>
  );
}
