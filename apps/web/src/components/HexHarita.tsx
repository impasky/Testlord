/**
 * Dünya haritası — 61 altıgenlik bir DİYAR.
 *
 * Oyuncunun sözleri: "harita çok kötü, neyin ne olduğu anlaşılmıyor; bir
 * zemin üstüne oturtulmuş olsa daha iyi olur; şu an bir dikdörtgende sağa
 * sola gidiyormuşum gibi ham hissettiriyor."
 *
 * Haklıydı. Önceki hâl düz renkli altıgenlerden oluşan bir ızgaraydı:
 * boşlukta duran bir tablo, bir yer değil. Üç şey değişti:
 *
 *  1. **Zemin var.** Altıgenler denizin üstünde yüzen bir kara parçası
 *     oluşturuyor; kıyı şeridi ve deniz gerçekten çiziliyor. Harita artık
 *     bir dikdörtgen değil, kenarları olan bir ada.
 *  2. **Araziyi görsel anlatıyor.** Her altıgen kendi bölge illüstrasyonuyla
 *     dolduruluyor — buğday tarlası tarla gibi, maden ocağı maden gibi
 *     görünüyor. Önceden ikisi de aynı boy gri ikondu.
 *  3. **Bölgelerin adı var.** İsimsiz altıgenler "neyin ne olduğu
 *     anlaşılmıyor" duygusunun doğrudan sebebiydi.
 *
 * Mobilde tek dokunuşla bölge seçilir. Sahiplik hem RENK hem DESEN ile
 * gösterilir (renk körü güvenliği).
 */
import { useEffect, useState } from 'react';
import type { MarchDto, RegionDto } from '../api/client';
import { IKONLAR } from './ikon-verisi';

const BOYUT = 34;
/** Kara parçası altıgenlerden bu kadar taşar; kıyı şeridi burada oluşur. */
const KIYI = 10;
const PAD = 46;

/** Zemin rengi: illüstrasyon yüklenene kadar ve onun üstünde ton olarak. */
const TIP_ZEMIN: Record<string, string> = {
  tarla: '#4a5a2c',
  maden: '#3a4652',
  sehir: '#5c4a2a',
  kale: '#53302a',
  taht: '#6b5015',
};

/**
 * Altıgen dolgusu iki katmandan gelir:
 *
 *   harita/<tip>.webp   — tam tepeden bakan arazi KAROSU (asıl istenen)
 *   bolgeler/<tip>.webp — üç çeyrek açıdan bakan SAHNE (karo yoksa yedek)
 *
 * İkisi ayrı şeyler. Sahneyi karo olarak kullanmak haritayı bulanık bir
 * kolaja çeviriyor; o yüzden sahne yedeği 2,6 kat yakınlaştırılıp
 * ortasından kırpılıyor ki hiç değilse doku olarak okunsun.
 *
 * Taht'ın sahnesi bir İÇ MEKÂN (taht odası) ve arazi olarak hiç okunmuyor;
 * yedeğinde kaleyi ödünç alıyor. Kendi karosu geldiğinde o kullanılır.
 */
const TIP_SAHNE: Record<string, string> = {
  tarla: 'tarla',
  maden: 'maden',
  sehir: 'sehir',
  kale: 'kale',
  taht: 'kale',
};

const TIP_IKON: Record<string, keyof typeof IKONLAR> = {
  tarla: 'tarla',
  maden: 'maden',
  sehir: 'sehir',
  kale: 'kale',
  taht: 'taht',
};

/** Bölge tipi ikonunu altıgenin ortasına ölçekleyerek yerleştirir. */
function TipIkonu({ tip, x, y }: { tip: string; x: number; y: number }) {
  const anahtar = TIP_IKON[tip];
  if (!anahtar) return null;
  const v = IKONLAR[anahtar];
  const hedef = BOYUT * 0.72;
  const olcek = hedef / v.w;
  return (
    <g
      transform={`translate(${x - hedef / 2} ${y - hedef / 2}) scale(${olcek})`}
      className="pointer-events-none"
      dangerouslySetInnerHTML={{ __html: v.body }}
    />
  );
}

function merkez(q: number, r: number) {
  return { x: BOYUT * Math.sqrt(3) * (q + r / 2), y: BOYUT * 1.5 * r };
}

function hexYol(cx: number, cy: number, s: number): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    p.push(`${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`);
  }
  return `M${p.join('L')}Z`;
}

/** Bölge adı: dar altıgende sığması için kısaltılır. */
function kisaAd(ad: string): string {
  return ad.length > 9 ? `${ad.slice(0, 8)}…` : ad;
}

export function HexHarita({
  regions,
  home,
  seciliId,
  yuruyusler,
  onSec,
}: {
  regions: RegionDto[];
  home: { q: number; r: number };
  seciliId: number | null;
  /** Yoldaki ordular: evden hedefe çizgi ve ilerleyen bir işaret. */
  yuruyusler: MarchDto[];
  onSec: (id: number) => void;
}) {
  // Yürüyüş işaretinin yeri her karede Date.now()'dan hesaplanıyor; bileşen
  // yeniden çizilmezse işaret donuyor. Yürüyüş yokken zamanlayıcı hiç
  // kurulmuyor: haritanın boşuna yeniden çizilmesi uzun oturumlarda pil yakar.
  const [, tik] = useState(0);
  useEffect(() => {
    if (yuruyusler.length === 0) return;
    const id = setInterval(() => tik((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [yuruyusler.length]);

  const m = regions.map((r) => ({ r, ...merkez(r.q, r.r) }));
  const xs = m.map((a) => a.x);
  const ys = m.map((a) => a.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - minX + PAD;
  const h = Math.max(...ys) - minY + PAD;
  const ev = merkez(home.q, home.r);
  const tipler = [...new Set(regions.map((r) => r.type))];

  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Dünya haritası, ${regions.length} bölge`}
    >
      <defs>
        {/* Her bölge tipi için doku. objectBoundingBox: illüstrasyon her
            altıgenin kendi kutusuna sığdırılır, 61 karo için 5 görsel yüklenir. */}
        {tipler.map((d) => (
          <pattern key={d} id={`doku-${d}`} patternUnits="objectBoundingBox" width="1" height="1">
            {/* Altta sahne yedeği (yakınlaştırılmış), üstte gerçek karo.
                Karo dosyası varsa sahneyi tamamen örter. */}
            <image
              href={`/gorseller/bolgeler/${TIP_SAHNE[d] ?? d}.webp`}
              x="-0.8"
              y="-0.8"
              width="2.6"
              height="2.6"
              preserveAspectRatio="xMidYMid slice"
            />
            <image
              href={`/gorseller/harita/${d}.webp`}
              width="1"
              height="1"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        ))}

        <radialGradient id="deniz" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#1d3a4a" />
          <stop offset="100%" stopColor="#12222c" />
        </radialGradient>

        <pattern id="benim" patternUnits="userSpaceOnUse" width="7" height="7">
          <path d="M0,7 L7,0" stroke="#f5b731" strokeWidth="1.8" opacity="0.75" />
        </pattern>
        <pattern id="dusman" patternUnits="userSpaceOnUse" width="7" height="7">
          <circle cx="3.5" cy="3.5" r="1.4" fill="#e8524d" opacity="0.7" />
        </pattern>

        {/* Kara parçasının dışına düşen yumuşak gölge: adayı denizden ayırır. */}
        <filter id="kara-golge" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0a1419" floodOpacity="0.8" />
        </filter>
      </defs>

      {/* --- Deniz --- */}
      <rect x={minX} y={minY} width={w} height={h} fill="url(#deniz)" />

      {/* --- Kıyı şeridi ---
          Genişletilmiş altıgenler üst üste binerek tek bir kara parçası
          oluşturuyor. Önce kıyı rengi, sonra üstüne kara: aradaki fark
          adanın etrafında bir sahil şeridi bırakıyor. */}
      <g filter="url(#kara-golge)">
        {m.map(({ r, x, y }) => (
          <path key={`k${r.id}`} d={hexYol(x, y, BOYUT + KIYI)} fill="#b99a63" />
        ))}
      </g>
      {m.map(({ r, x, y }) => (
        <path key={`z${r.id}`} d={hexYol(x, y, BOYUT + KIYI * 0.45)} fill="#6a5334" />
      ))}

      {/* --- Bölgeler --- */}
      {m.map(({ r, x, y }) => {
        const secili = seciliId === r.id;
        const taht = r.type === 'taht';
        const doku = r.type;
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

            {/* İllüstrasyon, üstüne arazi tonu: 61 karo tam parlaklıkta
                çizilirse harita gürültüye dönüyor ve üstündeki yazı okunmuyor. */}
            <path d={hexYol(x, y, BOYUT * 0.94)} fill={`url(#doku-${doku})`} />
            <path
              d={hexYol(x, y, BOYUT * 0.94)}
              fill={TIP_ZEMIN[r.type] ?? '#3a3025'}
              opacity={taht ? 0.22 : 0.34}
            />

            {r.isMine && <path d={hexYol(x, y, BOYUT * 0.94)} fill="url(#benim)" />}
            {r.owner && !r.isMine && <path d={hexYol(x, y, BOYUT * 0.94)} fill="url(#dusman)" />}

            <path
              d={hexYol(x, y, BOYUT * 0.94)}
              fill="none"
              stroke={secili ? '#f5b731' : taht ? '#f5b731' : '#2a2118'}
              strokeWidth={secili ? 3.5 : taht ? 2.2 : 1}
              opacity={secili || taht ? 1 : 0.55}
            />

            {/* Taht sahipliyse ikinci altın halka: haritanın tek "kimde?"
                sorusu bu altıgende sorulur, cevabı uzaktan okunabilmeli. */}
            {taht && r.owner && (
              <path
                d={hexYol(x, y, BOYUT * 0.68)}
                fill="none"
                stroke="#f5b731"
                strokeWidth="1.5"
                opacity="0.7"
              />
            )}

            {/* Tip ikonu: 41 pikselde "burası maden mi tarla mı" sorusuna
                cevap veren şey doku değil siluet. Doku atmosferi, ikon
                bilgiyi taşıyor. */}
            <g fill={taht ? '#ffe08a' : '#f2e7d5'} opacity={taht ? 0.95 : 0.72}>
              <TipIkonu tip={r.type} x={x} y={y - BOYUT * 0.16} />
            </g>

            {/* Bölge adı. İsimsiz altıgenler "neyin ne olduğu anlaşılmıyor"
                duygusunun doğrudan sebebiydi. */}
            <text
              x={x}
              y={y + BOYUT * 0.42}
              textAnchor="middle"
              className="pointer-events-none select-none"
              fontSize="8.5"
              fontWeight="700"
              fill="#f7ecd8"
              stroke="#140d08"
              strokeWidth="2.2"
              paintOrder="stroke"
            >
              {kisaAd(r.name)}
            </text>

            {/* Seviye yalnızca yükseltilmişse yazılır. Her altıgende "Sv1"
                görmek haritayı yine bir sayı duvarına çeviriyordu; oyuncunun
                "sadece rakamlara bakıyorum" dediği şey buydu. */}
            {(r.level > 1 || r.shielded) && (
              <text
                x={x}
                y={y + BOYUT * 0.66}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fontSize="9"
                fontWeight="800"
                fill={taht ? '#ffd76a' : '#e8d9bd'}
                stroke="#140d08"
                strokeWidth="2.4"
                paintOrder="stroke"
              >
                {r.level > 1 ? `Sv${r.level}` : ''}
                {r.shielded ? ' ⛨' : ''}
              </text>
            )}

            {r.owner && <SahipEtiketi ad={r.owner.name} x={x} y={y} benim={r.isMine} />}
          </g>
        );
      })}

      {/* Yürüyüşler. Ordunun yolda olduğunu yalnızca listeden anlamak
          beklemeyi boş bir bekleyişe çeviriyordu; harita üzerinde ilerleyen
          bir işaret aynı süreyi gerilime çeviriyor. İşaretin yeri gerçek:
          yola çıkış ve varış zamanından oranlanıyor. */}
      <g className="pointer-events-none">
        {yuruyusler.map((y) => {
          const hedef = m.find((a) => a.r.id === y.toRegionId);
          if (!hedef) return null;

          const bas = new Date(y.departAt).getTime();
          const bit = new Date(y.arriveAt).getTime();
          const oran = bit > bas ? Math.max(0, Math.min(1, (Date.now() - bas) / (bit - bas))) : 1;

          const donus = y.kind === 'return';
          const bx = donus ? hedef.x : ev.x;
          const by = donus ? hedef.y : ev.y;
          const hx = donus ? ev.x : hedef.x;
          const hy = donus ? ev.y : hedef.y;
          const x = bx + (hx - bx) * oran;
          const yy = by + (hy - by) * oran;
          const renk = donus ? '#3ddc84' : '#e8524d';

          return (
            <g key={y.id}>
              <line
                x1={bx}
                y1={by}
                x2={hx}
                y2={hy}
                stroke={renk}
                strokeWidth="1.4"
                strokeDasharray="4 4"
                opacity="0.6"
              />
              <circle cx={x} cy={yy} r={5} fill={renk} stroke="#17100c" strokeWidth="2" />
            </g>
          );
        })}
      </g>

      {/* Malikâne çıpası */}
      <g className="pointer-events-none">
        <circle cx={ev.x} cy={ev.y} r={9} fill="#f5b731" stroke="#17100c" strokeWidth="3" />
        <circle cx={ev.x} cy={ev.y} r={3.5} fill="#17100c" />
      </g>
    </svg>
  );
}

/**
 * Bölge sahibinin adı, altıgenin üst kenarına oturan küçük bir etiket.
 *
 * Ad kısaltılıyor ve arkasına koyu bir zemin konuyor: yan yana iki sahipli
 * bölge olduğunda etiketler birbirine giriyor ve ikisi de okunmaz hâle
 * geliyordu. Zemin ayrıca etiketi kendi altıgenine bağlıyor.
 */
function SahipEtiketi({
  ad,
  x,
  y,
  benim,
}: {
  ad: string;
  x: number;
  y: number;
  benim: boolean;
}) {
  const kisa = ad.length > 8 ? `${ad.slice(0, 7)}…` : ad;
  const g = kisa.length * 4.2 + 7;
  const ty = y - BOYUT * 0.52;
  return (
    <g className="pointer-events-none select-none">
      <rect
        x={x - g / 2}
        y={ty - 6.8}
        width={g}
        height={9.5}
        rx={3}
        fill="#17100c"
        opacity="0.9"
        stroke={benim ? '#f5b731' : '#e89a5a'}
        strokeWidth="0.6"
      />
      <text
        x={x}
        y={ty}
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill={benim ? '#f5b731' : '#e89a5a'}
      >
        {kisa}
      </text>
    </g>
  );
}
