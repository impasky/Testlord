/**
 * KIR VE KALE PARÇALARI — bölge sahnelerinin ölçeğinde (docs/24).
 *
 * Şehir binaları (binalar.ts) tek başına, yakından çiziliyor; bölge
 * sahnesinde ise bir karede on beş ev var. Buradaki parçalar aynı dilin
 * sade hâli: aynı çatı, aynı pencere, aynı palet — daha az yüz.
 *
 * Her parça zemin yüksekliği `z`'yi alıyor: bölge arazisi düz değil.
 */
import { cubuk, kemer, kubbe, teker, yuvarlakKule, yuzeyKutusu, type Yon } from './parca';
import { P, isikla } from './renk';
import {
  besikCati,
  birlestir,
  katmanla,
  kirmaCati,
  koni,
  kure,
  kutu,
  levha,
  mazgal,
  silindir,
  type Model,
  type V3,
} from './uc';

const KARANLIK = '#2a2019';
const ISIK = '#e8a84a';

/* ── Kır ───────────────────────────────────────────────────────────── */

export interface EvAyari {
  duvar?: string;
  cati?: string;
  yon?: Yon;
  baca?: boolean;
  kiris?: boolean;
  isik?: boolean;
}

/** Kır evi: duvar, beşik çatı, kapı, bir iki pencere. */
export function ev(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  h: number,
  o: EvAyari = {},
): Model {
  const duvar = o.duvar ?? P.siva;
  const cati = o.cati ?? P.saman;
  const yon = o.yon ?? (sx >= sy ? 'x' : 'y');
  const m = kutu(x, y, z, sx, sy, h, duvar);
  if (o.kiris) {
    const k = 0.25;
    const koyu = P.koyuTahta;
    m.push(...yuzeyKutusu('x', x + sx, y, z + h - k, sy, k, 0.06, koyu));
    m.push(...yuzeyKutusu('y', y + sy, x, z + h - k, sx, k, 0.06, koyu));
    m.push(...yuzeyKutusu('x', x + sx, y + sy - k, z, k, h, 0.06, koyu));
    m.push(...yuzeyKutusu('x', x + sx, y, z, k, h, 0.06, koyu));
    m.push(...yuzeyKutusu('y', y + sy, x + sx - k, z, k, h, 0.06, koyu));
    if (h > 3.5) {
      m.push(...yuzeyKutusu('x', x + sx, y, z + h / 2, sy, k, 0.06, koyu));
      m.push(...yuzeyKutusu('y', y + sy, x, z + h / 2, sx, k, 0.06, koyu));
    }
  }
  const ch = (yon === 'x' ? sy : sx) * 0.55;
  m.push(...besikCati(x, y, z + h, sx, sy, ch, yon, cati, duvar, 0.35));
  m.push(
    ...yuzeyKutusu('y', y + sy, x + sx * 0.28, z, 1, Math.min(1.9, h * 0.6), 0.1, P.koyuTahta),
  );
  const pen = (yuz: Yon, duz: number, u: number, pz: number) => {
    const p = yuzeyKutusu(yuz, duz, u, pz, 0.8, 0.8, 0.1, o.isik ? ISIK : KARANLIK);
    if (o.isik) for (const f of p) f.isima = 0.5;
    m.push(...p);
  };
  const pz = z + Math.min(h * 0.45, 1.4);
  pen('x', x + sx, y + sy / 2 - 0.4, pz);
  if (sx > 3.6) pen('y', y + sy, x + sx * 0.66, pz);
  if (h > 3.5) {
    pen('x', x + sx, y + sy / 2 - 0.4, z + h * 0.72);
    pen('y', y + sy, x + sx * 0.3, z + h * 0.72);
  }
  if (o.baca) m.push(...kutu(x + sx * 0.2, y + sy * 0.3, z + h, 0.7, 0.7, ch + 0.5, P.tas));
  return m;
}

/** Ambar: kırmızımsı tahta, büyük kapı alında, samanlık penceresi. */
export function ambar(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  h: number,
  duvar = '#8a4a30',
  cati: string = P.arduvaz,
): Model {
  const m = kutu(x, y, z, sx, sy, h, duvar);
  for (let u = x + 0.8; u < x + sx - 0.3; u += 1.3)
    m.push(...yuzeyKutusu('y', y + sy, u, z, 0.16, h, 0.05, isikla(duvar, 0.78)));
  m.push(...besikCati(x, y, z + h, sx, sy, sy * 0.5, 'x', cati, duvar, 0.45));
  m.push(...yuzeyKutusu('x', x + sx, y + sy / 2 - 1.2, z, 2.4, h * 0.78, 0.1, P.koyuTahta));
  m.push(...yuzeyKutusu('x', x + sx, y + sy / 2 - 0.08, z, 0.16, h * 0.78, 0.16, P.acikTahta));
  m.push(...yuzeyKutusu('x', x + sx, y + sy / 2 - 0.5, z + h + 0.3, 1, 1, 0.1, KARANLIK));
  return m;
}

/** Yel değirmeni: kesik koni gövde, başlık, dört kanat (+x yüzünde, kameraya dönük). */
export function degirmen(x: number, y: number, z: number, olcek = 1, aci = 0.35): Model {
  const s = olcek;
  const m = koni(x, y, z, 2.1 * s, 6.5 * s, P.siva, 8, 1.4 * s);
  m.push(...koni(x, y, z + 6.5 * s, 1.8 * s, 2.2 * s, P.koyuTahta, 8));
  m.push(...kutu(x - 0.5 * s, y + 1.75 * s, z, 1 * s, 0.45 * s, 1.7 * s, KARANLIK));
  const hx = x + 2.05 * s;
  const hz = z + 6.6 * s;
  for (let k = 0; k < 4; k++) {
    const t = aci + (k * Math.PI) / 2;
    const d = [Math.cos(t), Math.sin(t)] as const;
    const p = [-Math.sin(t), Math.cos(t)] as const;
    const q = (a: number, b: number, kay = 0): V3 => [
      hx + kay,
      y + d[0] * a + p[0] * b,
      hz + d[1] * a + p[1] * b,
    ];
    m.push(
      ...levha([q(0.9 * s, 0), q(5.2 * s, 0), q(5.2 * s, 1.15 * s), q(0.9 * s, 1.15 * s)], P.bez),
    );
    m.push({
      p: [
        q(0, -0.12 * s, 0.06),
        q(5.4 * s, -0.12 * s, 0.06),
        q(5.4 * s, 0.12 * s, 0.06),
        q(0, 0.12 * s, 0.06),
      ],
      renk: P.koyuTahta,
      ciftYuz: true,
    });
  }
  m.push(...kutu(hx - 0.3, y - 0.3, hz - 0.3, 0.5, 0.6, 0.6, P.koyuTahta));
  return m;
}

/** Saman balyası (yığın). */
export function balya(x: number, y: number, z: number, s = 1): Model {
  return birlestir(
    silindir(x, y, z, 1.1 * s, 0.9 * s, P.saman, 7),
    koni(x, y, z + 0.9 * s, 1.15 * s, 1.3 * s, isikla(P.saman, 1.06), 7),
  );
}

/** Araba: kasa, yük, iki teker (görünen yanda). */
export function araba(
  x: number,
  y: number,
  z: number,
  yon: Yon,
  yuk: string | null = P.saman,
): Model {
  const [sx, sy] = yon === 'x' ? [2.6, 1.4] : [1.4, 2.6];
  const m = kutu(x, y, z + 0.55, sx, sy, 0.55, P.tahta);
  if (yuk) m.push(...kutu(x + 0.2, y + 0.2, z + 1.1, sx - 0.4, sy - 0.4, 0.55, yuk));
  if (yon === 'x')
    for (const u of [x + 0.6, x + sx - 0.6])
      m.push(...teker(u, y + sy + 0.05, z + 0.55, 0.55, 'y'));
  else
    for (const u of [y + 0.6, y + sy - 0.6])
      m.push(...teker(x + sx + 0.05, u, z + 0.55, 0.55, 'x'));
  return m;
}

/** Kuyu: taş bilezik, iki direk, küçük çatı. */
export function kuyuKucuk(x: number, y: number, z: number): Model {
  return birlestir(
    silindir(x, y, z, 0.9, 0.8, P.tas, 8),
    silindir(x, y, z + 0.78, 0.65, 0.05, P.su, 8),
    kutu(x - 0.8, y - 0.1, z + 0.8, 0.18, 0.18, 1.6, P.koyuTahta),
    kutu(x + 0.62, y - 0.1, z + 0.8, 0.18, 0.18, 1.6, P.koyuTahta),
    besikCati(x - 1, y - 0.6, z + 2.4, 2, 1.2, 0.6, 'x', P.kiremit, P.koyuTahta, 0.1),
  );
}

/** Kısa çit (tarla, bahçe). */
export function citKisa(x: number, y: number, z: number, uzun: number, yon: Yon): Model {
  const m: Model = [];
  const n = Math.max(2, Math.round(uzun / 2) + 1);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * uzun;
    const [px, py] = yon === 'x' ? [x + t, y] : [x, y + t];
    m.push(...kutu(px - 0.12, py - 0.12, z, 0.24, 0.24, 1.1, P.koyuTahta));
  }
  m.push(
    ...(yon === 'x'
      ? kutu(x, y - 0.06, z + 0.7, uzun, 0.12, 0.18, P.tahta)
      : kutu(x - 0.06, y, z + 0.7, 0.12, uzun, 0.18, P.tahta)),
  );
  return m;
}

/** Pazar tezgâhı: masa, mal, çizgili tente. */
export function tezgah(x: number, y: number, z: number, renk: string): Model {
  const m = kutu(x, y, z, 2.4, 1.4, 0.9, P.tahta);
  m.push(...kutu(x + 0.2, y + 0.2, z + 0.9, 0.7, 0.6, 0.4, P.saman));
  m.push(...kutu(x + 1.2, y + 0.3, z + 0.9, 0.6, 0.6, 0.35, P.kiremit));
  for (const [px, py] of [
    [x, y],
    [x + 2.25, y],
    [x, y + 1.25],
    [x + 2.25, y + 1.25],
  ] as [number, number][])
    m.push(...kutu(px, py, z, 0.15, 0.15, 2.2, P.koyuTahta));
  const w = 2.6 / 4;
  for (let i = 0; i < 4; i++) {
    const a = x - 0.1 + i * w;
    m.push({
      p: [
        [a, y - 0.1, z + 2.5],
        [a + w, y - 0.1, z + 2.5],
        [a + w, y + 1.7, z + 2],
        [a, y + 1.7, z + 2],
      ],
      renk: i % 2 ? P.bez : renk,
      ciftYuz: true,
    });
  }
  return m;
}

/** Kilise: nef, önde çan kulesi ve sivri külah. `buyuk`: taş kilise. */
export function kilise(
  x: number,
  y: number,
  z: number,
  o: { tas?: string; cati?: string; buyuk?: boolean } = {},
): Model {
  const tas = o.tas ?? P.acikTas;
  const cati = o.cati ?? P.arduvaz;
  const L = o.buyuk ? 11 : 7.5;
  const W = o.buyuk ? 5.6 : 4.2;
  const H = o.buyuk ? 5.2 : 3.8;
  const T = o.buyuk ? 3.2 : 2.4;
  const m = kutu(x, y, z, L, W, H, tas);
  m.push(...besikCati(x, y, z + H, L, W, W * 0.62, 'x', cati, tas, 0.3));
  for (let u = x + 1; u < x + L - T - 0.8; u += 2.2)
    m.push(...kemer('y', y + W, u, z + H * 0.3, 0.8, 2));
  const tx = x + L - 0.1;
  const ty = y + W / 2 - T / 2;
  const th = H * 2.2;
  m.push(...kutu(tx, ty, z, T, T, th, tas));
  m.push(...kemer('x', tx + T, ty + T / 2 - 0.5, z + th - 2.2, 1, 1.7));
  m.push(...kemer('y', ty + T, tx + T / 2 - 0.5, z + th - 2.2, 1, 1.7));
  m.push(...kemer('x', tx + T, ty + T / 2 - 0.7, z, 1.4, 2.4, P.koyuTahta));
  m.push(...koni(tx + T / 2, ty + T / 2, z + th, T * 0.74, th * 0.7, cati, 4));
  m.push(...kutu(tx + T / 2 - 0.08, ty + T / 2 - 0.08, z + th * 1.7, 0.16, 0.16, 1.1, P.koyuAltin));
  return m;
}

/** Katedral: haç planlı, kesişimde kubbe, önde iki kule. */
export function katedral(x: number, y: number, z: number): Model {
  const tas = P.acikTas;
  const cati = P.arduvaz;
  const m = kutu(x, y, z, 16, 6, 7, tas);
  m.push(...besikCati(x, y, z + 7, 16, 6, 3.6, 'x', cati, tas, 0.3));
  m.push(...kutu(x + 5, y - 4, z, 6, 14, 6, tas));
  m.push(...besikCati(x + 5, y - 4, z + 6, 6, 14, 3.4, 'y', cati, tas, 0.3));
  for (let u = x + 1; u < x + 4.6; u += 1.8) m.push(...kemer('y', y + 6, u, z + 2.4, 0.9, 3));
  for (let u = x + 12; u < x + 15; u += 1.8) m.push(...kemer('y', y + 6, u, z + 2.4, 0.9, 3));
  m.push(...kemer('y', y + 10, x + 7, z + 1.6, 2, 3.6));
  m.push(...silindir(x + 8, y + 3, z + 7, 2.6, 2.2, tas, 12));
  m.push(...kubbe(x + 8, y + 3, z + 9.2, 2.6, P.bakir, 12, 3));
  m.push(...koni(x + 8, y + 3, z + 11.8, 0.5, 1.6, P.altin, 6));
  for (const ty of [y - 1.2, y + 4.2]) {
    m.push(...kutu(x + 15.6, ty, z, 3, 3, 12, tas));
    m.push(...kemer('x', x + 18.6, ty + 1, z + 9, 1, 1.8));
    m.push(...koni(x + 17.1, ty + 1.5, z + 12, 2.2, 5, cati, 4));
  }
  m.push(...kemer('x', x + 16, y + 1.8, z, 2.4, 4, P.koyuTahta));
  return m;
}

/** Taş köprü: kemerli gövde + korkuluk. `yon` köprünün uzandığı eksen. */
export function kopru(
  x: number,
  y: number,
  z: number,
  uzun: number,
  yon: Yon,
  taban: number,
  renk: string = P.tas,
): Model {
  const en = 2.6;
  const h = z - taban;
  const m: Model = [];
  if (yon === 'x') {
    m.push(...kutu(x, y, taban, uzun, en, h, renk));
    m.push(
      ...kutu(x, y, z, uzun, 0.3, 0.6, renk),
      ...kutu(x, y + en - 0.3, z, uzun, 0.3, 0.6, renk),
    );
    const n = Math.max(1, Math.round(uzun / 4.5));
    for (let i = 0; i < n; i++)
      m.push(
        ...kemer(
          'y',
          y + en,
          x + (uzun / n) * i + 0.6,
          taban,
          uzun / n - 1.2,
          Math.max(1, h - 0.4),
        ),
      );
  } else {
    m.push(...kutu(x, y, taban, en, uzun, h, renk));
    m.push(
      ...kutu(x, y, z, 0.3, uzun, 0.6, renk),
      ...kutu(x + en - 0.3, y, z, 0.3, uzun, 0.6, renk),
    );
    const n = Math.max(1, Math.round(uzun / 4.5));
    for (let i = 0; i < n; i++)
      m.push(
        ...kemer(
          'x',
          x + en,
          y + (uzun / n) * i + 0.6,
          taban,
          uzun / n - 1.2,
          Math.max(1, h - 0.4),
        ),
      );
  }
  return m;
}

/** Ahşap yaya köprüsü. */
export function tahtaKopru(x: number, y: number, z: number, uzun: number, yon: Yon): Model {
  const [sx, sy] = yon === 'x' ? [uzun, 1.8] : [1.8, uzun];
  const m = kutu(x, y, z, sx, sy, 0.3, P.acikTahta);
  if (yon === 'x')
    m.push(
      ...kutu(x, y + sy - 0.15, z + 0.3, sx, 0.15, 0.7, P.koyuTahta),
      ...kutu(x, y, z + 0.3, sx, 0.15, 0.7, P.koyuTahta),
    );
  else
    m.push(
      ...kutu(x + sx - 0.15, y, z + 0.3, 0.15, sy, 0.7, P.koyuTahta),
      ...kutu(x, y, z + 0.3, 0.15, sy, 0.7, P.koyuTahta),
    );
  return m;
}

/** Su değirmeni: taş taban + tahta üst, derede dikey çark. */
export function suDegirmeni(x: number, y: number, z: number, carkYuz: Yon): Model {
  const m = kutu(x, y, z, 5, 4, 1.6, P.tas);
  m.push(...kutu(x, y, z + 1.6, 5, 4, 2, P.tahta));
  m.push(...besikCati(x, y, z + 3.6, 5, 4, 2.2, 'x', P.saman, P.tahta, 0.35));
  m.push(...yuzeyKutusu('y', y + 4, x + 1, z, 1, 1.8, 0.1, P.koyuTahta));
  if (carkYuz === 'x') {
    m.push(...teker(x + 5.5, y + 2, z + 1, 2, 'x', P.koyuTahta, 10));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI;
      m.push(
        ...cubuk(
          [x + 5.58, y + 2 - Math.cos(a) * 2, z + 1 - Math.sin(a) * 2],
          [x + 5.58, y + 2 + Math.cos(a) * 2, z + 1 + Math.sin(a) * 2],
          0.18,
          P.tahta,
        ),
      );
    }
  } else {
    m.push(...teker(x + 2.5, y + 4.5, z + 1, 2, 'y', P.koyuTahta, 10));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI;
      m.push(
        ...cubuk(
          [x + 2.5 - Math.cos(a) * 2, y + 4.58, z + 1 - Math.sin(a) * 2],
          [x + 2.5 + Math.cos(a) * 2, y + 4.58, z + 1 + Math.sin(a) * 2],
          0.18,
          P.tahta,
        ),
      );
    }
  }
  return m;
}

/* ── Maden ─────────────────────────────────────────────────────────── */

/** Kaya yüzüne açılmış maden ağzı: koyu açıklık, ahşap çerçeve, saçak. */
export function madenAgzi(x: number, y: number, z: number, yuz: Yon, r: () => number): Model {
  const m: Model = [];
  const kaya = (px: number, py: number, pz: number, s: number) =>
    m.push(...kure(px, py, pz, s, isikla(P.kaya, 0.9 + r() * 0.2), 6, 3, 0.25, r, 0.8));
  if (yuz === 'y') {
    kaya(x - 2.6, y - 1.2, z + 1.2, 2.2);
    kaya(x + 2.6, y - 1.2, z + 1.2, 2.2);
    kaya(x, y - 1.6, z + 3.4, 2.8);
    m.push(
      ...levha(
        [
          [x - 1.2, y + 0.05, z],
          [x + 1.2, y + 0.05, z],
          [x + 1.2, y + 0.05, z + 2.8],
          [x - 1.2, y + 0.05, z + 2.8],
        ],
        '#1a1410',
      ),
    );
    m.push(...kutu(x - 1.6, y, z, 0.4, 0.5, 3.2, P.koyuTahta));
    m.push(...kutu(x + 1.2, y, z, 0.4, 0.5, 3.2, P.koyuTahta));
    m.push(...kutu(x - 1.9, y - 0.1, z + 3.1, 3.8, 0.7, 0.45, P.koyuTahta));
    m.push(
      ...besikCati(x - 1.9, y - 0.3, z + 3.55, 3.8, 1.8, 0.8, 'x', P.tahta, P.koyuTahta, 0.15),
    );
  } else {
    kaya(x - 1.2, y - 2.6, z + 1.2, 2.2);
    kaya(x - 1.2, y + 2.6, z + 1.2, 2.2);
    kaya(x - 1.6, y, z + 3.4, 2.8);
    m.push(
      ...levha(
        [
          [x + 0.05, y - 1.2, z],
          [x + 0.05, y + 1.2, z],
          [x + 0.05, y + 1.2, z + 2.8],
          [x + 0.05, y - 1.2, z + 2.8],
        ],
        '#1a1410',
      ),
    );
    m.push(...kutu(x, y - 1.6, z, 0.5, 0.4, 3.2, P.koyuTahta));
    m.push(...kutu(x, y + 1.2, z, 0.5, 0.4, 3.2, P.koyuTahta));
    m.push(...kutu(x - 0.1, y - 1.9, z + 3.1, 0.7, 3.8, 0.45, P.koyuTahta));
    m.push(
      ...besikCati(x - 0.3, y - 1.9, z + 3.55, 1.8, 3.8, 0.8, 'y', P.tahta, P.koyuTahta, 0.15),
    );
  }
  return m;
}

/** Maden kuyusu kulesi: dört eğik ayak, kuşaklar, çapraz payanda, tepede makara. */
export function kuyuKulesi(x: number, y: number, z: number, h: number, s = 4): Model {
  const m: Model = [];
  const k = 0.32;
  const ic = s * 0.28;
  const alt: [number, number][] = [
    [0, 0],
    [s, 0],
    [s, s],
    [0, s],
  ];
  const ust: [number, number][] = [
    [ic, ic],
    [s - ic, ic],
    [s - ic, s - ic],
    [ic, s - ic],
  ];
  const nokta3 = (i: number, t: number): V3 => [
    x + alt[i]![0] + (ust[i]![0] - alt[i]![0]) * t,
    y + alt[i]![1] + (ust[i]![1] - alt[i]![1]) * t,
    z + h * t,
  ];
  for (let i = 0; i < 4; i++) m.push(...cubuk(nokta3(i, 0), nokta3(i, 1), k, P.koyuTahta));
  for (const t of [0.33, 0.66])
    for (let i = 0; i < 4; i++)
      m.push(...cubuk(nokta3(i, t), nokta3((i + 1) % 4, t), k * 0.8, P.tahta));
  // Görünen iki yüzde çapraz: +x (1-2) ve +y (2-3)
  for (const [a, b] of [
    [1, 2],
    [2, 3],
  ] as [number, number][])
    for (const [t0, t1] of [
      [0, 0.33],
      [0.33, 0.66],
      [0.66, 1],
    ] as [number, number][])
      m.push(...cubuk(nokta3(a, t0), nokta3(b, t1), k * 0.7, P.tahta));
  const us = s - ic * 2;
  m.push(...kutu(x + ic - 0.3, y + ic - 0.3, z + h, us + 0.6, us + 0.6, 0.3, P.tahta));
  m.push(...teker(x + s / 2, y + s / 2, z + h + 1.2, 1.1, 'x', P.demir, 10));
  m.push(...kutu(x + ic, y + ic, z + h + 0.3, 0.2, 0.2, 2.2, P.koyuTahta));
  m.push(...kutu(x + s - ic - 0.2, y + s - ic - 0.2, z + h + 0.3, 0.2, 0.2, 2.2, P.koyuTahta));
  m.push(
    ...besikCati(
      x + ic - 0.2,
      y + ic - 0.2,
      z + h + 2.5,
      us + 0.4,
      us + 0.4,
      0.9,
      'y',
      P.arduvaz,
      P.koyuTahta,
      0.2,
    ),
  );
  // Arkaya uzanan payanda (makaranın çekişini karşılıyor)
  m.push(
    ...cubuk([x - h * 0.4, y + s / 2, z], [x + ic, y + s / 2, z + h * 0.92], k * 1.2, P.koyuTahta),
  );
  return m;
}

/** Cevher yığını: düzensiz, basık bir tepe + birkaç parıltı. */
export function cevher(
  x: number,
  y: number,
  z: number,
  s: number,
  r: () => number,
  parilti: string = P.bakir,
): Model {
  const m = kure(x, y, z, s, '#5a544d', 7, 3, 0.22, r, 0.55);
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    m.push(
      ...kure(
        x + Math.cos(a) * s * 0.4,
        y + Math.sin(a) * s * 0.4,
        z + s * 0.4,
        s * 0.18,
        parilti,
        5,
        2,
      ),
    );
  }
  return m;
}

/** Maden arabası (vagon): demir kasa, kömür/cevher, küçük tekerler. */
export function vagon(x: number, y: number, z: number, yon: Yon): Model {
  const [sx, sy] = yon === 'x' ? [1.8, 1.2] : [1.2, 1.8];
  const m = kutu(x, y, z + 0.35, sx, sy, 0.8, { ust: P.koyuTahta, yan: P.demir });
  m.push(...kutu(x + 0.15, y + 0.15, z + 1.15, sx - 0.3, sy - 0.3, 0.3, '#3c3834'));
  if (yon === 'x')
    for (const u of [x + 0.4, x + sx - 0.4])
      m.push(...teker(u, y + sy + 0.04, z + 0.35, 0.33, 'y', P.demir, 6));
  else
    for (const u of [y + 0.4, y + sy - 0.4])
      m.push(...teker(x + sx + 0.04, u, z + 0.35, 0.33, 'x', P.demir, 6));
  return m;
}

/** Ray: iki demir çizgi + traversler (araziye yatık süs). */
export function ray(noktalar: [number, number][], h: (x: number, y: number) => number): Model {
  const m: Model = [];
  for (let i = 0; i < noktalar.length - 1; i++) {
    const [ax, ay] = noktalar[i]!;
    const [bx, by] = noktalar[i + 1]!;
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / l;
    const uy = (by - ay) / l;
    const nx = -uy;
    const ny = ux;
    for (let t = 0; t < l; t += 0.9) {
      const cx = ax + ux * t;
      const cy = ay + uy * t;
      const z = h(cx, cy) + 0.1;
      m.push({
        p: [
          [cx + nx * 0.75 - ux * 0.15, cy + ny * 0.75 - uy * 0.15, z],
          [cx - nx * 0.75 - ux * 0.15, cy - ny * 0.75 - uy * 0.15, z],
          [cx - nx * 0.75 + ux * 0.15, cy - ny * 0.75 + uy * 0.15, z],
          [cx + nx * 0.75 + ux * 0.15, cy + ny * 0.75 + uy * 0.15, z],
        ],
        renk: P.koyuTahta,
        katman: -0.95,
        kenarsiz: true,
        ciftYuz: true,
      });
    }
    for (const s of [-0.45, 0.45]) {
      const za = h(ax, ay) + 0.14;
      const zb = h(bx, by) + 0.14;
      m.push({
        p: [
          [ax + nx * (s - 0.07), ay + ny * (s - 0.07), za],
          [bx + nx * (s - 0.07), by + ny * (s - 0.07), zb],
          [bx + nx * (s + 0.07), by + ny * (s + 0.07), zb],
          [ax + nx * (s + 0.07), ay + ny * (s + 0.07), za],
        ],
        renk: P.demir,
        katman: -0.9,
        kenarsiz: true,
        ciftYuz: true,
      });
    }
  }
  return m;
}

/** Ergitme ocağı: taş gövde, közlü ağız, iki baca. */
export function izabe(x: number, y: number, z: number): Model {
  const m = kutu(x, y, z, 7, 5, 4, P.koyuTas);
  m.push(...kutu(x - 0.2, y - 0.2, z + 4, 7.4, 5.4, 0.4, P.tas));
  const kor = yuzeyKutusu('y', y + 5, x + 1.2, z, 1.8, 1.6, 0.12, P.ates);
  const kor2 = yuzeyKutusu('x', x + 7, y + 1.5, z, 1.8, 1.6, 0.12, P.ates);
  for (const f of [...kor, ...kor2]) f.isima = 1;
  m.push(...kor, ...kor2);
  m.push(...silindir(x + 1.6, y + 1.4, z + 4.4, 0.9, 5, P.tas, 8));
  m.push(...silindir(x + 4.8, y + 1.4, z + 4.4, 0.8, 4, P.tas, 8));
  m.push(...kirmaCati(x + 3, y + 2.6, z + 4.4, 3.4, 2, 1.1, P.arduvaz, 0.2));
  return m;
}

/* ── Kale ──────────────────────────────────────────────────────────── */

/**
 * Eksene hizalı sur: 3 birimlik parçalara bölünüyor. Ressam algoritması
 * yüzün ortasına bakıyor; tek parça uzun bir duvarın ortası köşedeki
 * kuleden "yakın" sayılıp kulenin üstüne çiziliyordu.
 */
export function sur(
  x0: number,
  y0: number,
  uzun: number,
  yon: Yon,
  z: number,
  h: number,
  renk: string,
  kal = 1.3,
): Model {
  const m: Model = [];
  const n = Math.max(1, Math.round(uzun / 3));
  const p = uzun / n;
  for (let i = 0; i < n; i++) {
    if (yon === 'x') m.push(...kutu(x0 + i * p, y0, z, p, kal, h, renk));
    else m.push(...kutu(x0, y0 + i * p, z, kal, p, h, renk));
  }
  if (yon === 'x') {
    m.push(...mazgal(x0, y0, z + h, uzun, 0.45, 'x', renk, 0.75));
    m.push(...mazgal(x0, y0 + kal - 0.45, z + h, uzun, 0.45, 'x', renk, 0.75));
  } else {
    m.push(...mazgal(x0, y0, z + h, uzun, 0.45, 'y', renk, 0.75));
    m.push(...mazgal(x0 + kal - 0.45, y0, z + h, uzun, 0.45, 'y', renk, 0.75));
  }
  return m;
}

/** Dikdörtgen kale suru: dört kol, köşelerde kule, +y yüzünde kapı. */
export function kaleSuru(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  h: number,
  o: { renk?: string; kule?: 'kare' | 'yuvarlak' | 'kulah'; kuleR?: number; kapi?: boolean } = {},
): Model {
  const renk = o.renk ?? P.tas;
  const kr = o.kuleR ?? 1.8;
  const kal = 1.3;
  const m: Model = [];
  m.push(...sur(x + kr, y, sx - kr * 2, 'x', z, h, renk, kal));
  m.push(...sur(x, y + kr, sy - kr * 2, 'y', z, h, renk, kal));
  m.push(...sur(x + sx - kal, y + kr, sy - kr * 2, 'y', z, h, renk, kal));
  const kapiX = x + sx / 2;
  if (o.kapi !== false) {
    m.push(...sur(x + kr, y + sy - kal, kapiX - 2.2 - x - kr, 'x', z, h, renk, kal));
    m.push(...sur(kapiX + 2.2, y + sy - kal, x + sx - kr - kapiX - 2.2, 'x', z, h, renk, kal));
    // Kapı kulesi: iki yanda kare burç, ortada kemer
    m.push(...kutu(kapiX - 3, y + sy - kal - 0.4, z, 2.2, kal + 0.8, h + 2, renk));
    m.push(...kutu(kapiX + 0.8, y + sy - kal - 0.4, z, 2.2, kal + 0.8, h + 2, renk));
    m.push(
      ...kutu(kapiX - 0.8, y + sy - kal - 0.2, z + h * 0.62, 1.6, kal + 0.4, h * 0.38 + 0.8, renk),
    );
    m.push(...kemer('y', y + sy - 0.2, kapiX - 0.8, z, 1.6, h * 0.62 + 0.2, '#1c1612'));
    m.push(...mazgal(kapiX - 3, y + sy + 0.2, z + h + 2, 6, 0.45, 'x', renk, 0.75));
  } else m.push(...sur(x + kr, y + sy - kal, sx - kr * 2, 'x', z, h, renk, kal));
  const koseler: [number, number][] = [
    [x + kal / 2, y + kal / 2],
    [x + sx - kal / 2, y + kal / 2],
    [x + kal / 2, y + sy - kal / 2],
    [x + sx - kal / 2, y + sy - kal / 2],
  ];
  for (const [cx, cy] of koseler) m.push(...kule(cx, cy, z, kr, h + 2.2, renk, o.kule ?? 'kare'));
  return m;
}

/** Kule: kare (mazgallı), yuvarlak (mazgallı) ya da külahlı yuvarlak. */
export function kule(
  cx: number,
  cy: number,
  z: number,
  r: number,
  h: number,
  renk: string,
  tip: 'kare' | 'yuvarlak' | 'kulah',
): Model {
  if (tip === 'kare') {
    const m = kutu(cx - r, cy - r, z, r * 2, r * 2, h, renk);
    m.push(
      ...kutu(cx - r - 0.2, cy - r - 0.2, z + h, r * 2 + 0.4, r * 2 + 0.4, 0.4, isikla(renk, 0.95)),
    );
    m.push(...mazgal(cx - r - 0.2, cy + r - 0.25, z + h + 0.4, r * 2 + 0.4, 0.45, 'x', renk, 0.7));
    m.push(...mazgal(cx + r - 0.25, cy - r - 0.2, z + h + 0.4, r * 2 + 0.4, 0.45, 'y', renk, 0.7));
    m.push(...mazgal(cx - r - 0.2, cy - r - 0.2, z + h + 0.4, r * 2 + 0.4, 0.45, 'x', renk, 0.7));
    m.push(...mazgal(cx - r - 0.2, cy - r - 0.2, z + h + 0.4, r * 2 + 0.4, 0.45, 'y', renk, 0.7));
    m.push(...yuzeyKutusu('x', cx + r, cy - 0.25, z + h * 0.6, 0.5, 1, 0.08, KARANLIK));
    return m;
  }
  if (tip === 'yuvarlak') return yuvarlakKule(cx, cy, z, r, h, renk, true);
  const m = silindir(cx, cy, z, r, h, renk, 10);
  m.push(...silindir(cx, cy, z + h, r + 0.3, 0.4, isikla(renk, 0.95), 10));
  m.push(...koni(cx, cy, z + h + 0.4, r + 0.5, r * 2.2, P.arduvaz, 10));
  m.push(...yuzeyKutusu('x', cx + r - 0.05, cy - 0.25, z + h * 0.6, 0.5, 1, 0.1, KARANLIK));
  return m;
}

/** Ana burç (donjon): kare gövde, köşe kuleleri, isteğe bağlı sivri çatı. */
export function burc(
  x: number,
  y: number,
  z: number,
  s: number,
  h: number,
  renk: string,
  cati: 'duz' | 'kirma' = 'duz',
): Model {
  const m = kutu(x, y, z, s, s, h, renk);
  for (let k = 1; k < 3; k++) {
    m.push(...yuzeyKutusu('x', x + s, y + s / 2 - 0.35, z + (h * k) / 3, 0.7, 1.2, 0.08, KARANLIK));
    m.push(...yuzeyKutusu('y', y + s, x + s / 2 - 0.35, z + (h * k) / 3, 0.7, 1.2, 0.08, KARANLIK));
  }
  if (cati === 'kirma') {
    m.push(...kirmaCati(x, y, z + h, s, s, s * 0.7, P.arduvaz, 0.3));
    for (const [cx, cy] of [
      [x, y + s],
      [x + s, y],
      [x + s, y + s],
    ] as [number, number][]) {
      m.push(...silindir(cx, cy, z + h - 2, 0.9, 2.6, renk, 8));
      m.push(...koni(cx, cy, z + h + 0.6, 1.1, 2.2, P.arduvaz, 8));
    }
  } else {
    m.push(...mazgal(x, y + s - 0.45, z + h, s, 0.45, 'x', renk, 0.75));
    m.push(...mazgal(x + s - 0.45, y, z + h, s, 0.45, 'y', renk, 0.75));
    m.push(...mazgal(x, y, z + h, s, 0.45, 'x', renk, 0.75));
    m.push(...mazgal(x, y, z + h, s, 0.45, 'y', renk, 0.75));
  }
  return m;
}

/* ── Saray ─────────────────────────────────────────────────────────── */

/** Taş teras: gövde + bir tık taşkın korniş. */
export function teras(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  h: number,
  renk: string = P.kumTasi,
): Model {
  return birlestir(
    kutu(x, y, z, sx, sy, h, renk),
    katmanla(
      kutu(x - 0.25, y - 0.25, z + h - 0.35, sx + 0.5, sy + 0.5, 0.35, isikla(renk, 1.08)),
      0,
    ),
  );
}

/**
 * Merdiven: +y yönünde inen basamaklar. Her basamak ayrı bir sütun —
 * iç içe kutular ressam algoritmasında birbirinin üstüne taşıyordu.
 */
export function merdiven(
  x: number,
  y: number,
  z0: number,
  z1: number,
  en: number,
  derin: number,
  renk: string = P.acikTas,
): Model {
  const n = Math.max(2, Math.round((z1 - z0) / 0.45));
  const d = derin / n;
  const m: Model = [];
  for (let i = 0; i < n; i++) {
    const ust = z1 - ((z1 - z0) * i) / n;
    m.push(...kutu(x, y + i * d, z0, en, d, ust - z0, i % 2 ? renk : isikla(renk, 0.95)));
  }
  return m;
}

/** Sütun dizisi: x boyunca, `y`de; kaide, gövde, başlık. */
export function sutunlar(
  x0: number,
  x1: number,
  y: number,
  z: number,
  h: number,
  adet: number,
  renk: string = P.acikTas,
): Model {
  const m: Model = [];
  for (let i = 0; i < adet; i++) {
    const x = x0 + ((x1 - x0) * i) / Math.max(1, adet - 1);
    m.push(...kutu(x - 0.5, y - 0.5, z, 1, 1, 0.4, renk));
    m.push(...silindir(x, y, z + 0.4, 0.34, h - 0.8, isikla(renk, 1.05), 6));
    m.push(...kutu(x - 0.5, y - 0.5, z + h - 0.4, 1, 1, 0.4, renk));
  }
  return m;
}

/** Selvi: ince uzun, koyu yeşil. */
export function selvi(x: number, y: number, z: number, h = 4.5): Model {
  return birlestir(
    silindir(x, y, z, 0.15, 0.8, P.koyuTahta, 4),
    koni(x, y, z + 0.5, 0.75, h, P.koyuYaprak, 6, 0.1),
  );
}

/** Havuz ya da fıskiye: taş kenar + su. */
export function havuz(x: number, y: number, z: number, sx: number, sy: number): Model {
  return birlestir(
    kutu(x, y, z, sx, sy, 0.45, P.acikTas),
    kutu(x + 0.35, y + 0.35, z + 0.42, sx - 0.7, sy - 0.7, 0.05, P.su),
  );
}

/** Saray çatısı ya da kule tepesi için yıldızlı sivri: altın küre + direk. */
export function alem(cx: number, cy: number, z: number, s = 1): Model {
  return birlestir(
    kure(cx, cy, z + 0.3 * s, 0.3 * s, P.altin, 6, 3),
    kutu(cx - 0.06 * s, cy - 0.06 * s, z + 0.5 * s, 0.12 * s, 0.12 * s, 0.8 * s, P.koyuAltin),
  );
}

/** Kuleli yuvarlak köşk: silindir + altın külah. */
export function kosk(
  cx: number,
  cy: number,
  z: number,
  r: number,
  h: number,
  renk: string,
  cati: string,
): Model {
  const m = silindir(cx, cy, z, r, h, renk, 10);
  m.push(...silindir(cx, cy, z + h, r + 0.25, 0.35, isikla(renk, 1.08), 10));
  m.push(...koni(cx, cy, z + h + 0.35, r + 0.3, r * 2.4, cati, 10));
  m.push(...alem(cx, cy, z + h + 0.35 + r * 2.4, 0.9));
  for (let k = 0; k < 2; k++)
    m.push(...kemer('x', cx + r - 0.1, cy - 0.3, z + h * (0.35 + k * 0.3), 0.6, 1.2));
  return m;
}
