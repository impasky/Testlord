/**
 * KÜÇÜK 3B MOTOR — bütün nesne çizimlerinin ortak dili (docs/24).
 *
 * Bina, asker, at, kılıç, kalkan: hepsi birkaç ilkel parçadan (kutu,
 * prizma, silindir, koni, çatı) kuruluyor ve TEK bir kamerayla, TEK bir
 * ışıkla çiziliyor. Böylece yan yana duran iki çizim aynı dünyanın
 * parçası gibi görünüyor — elle çizilmiş resimlerde bunu tutturmak
 * zordu, burada kendiliğinden geliyor.
 *
 * Yöntem, "low-poly" oyunlarınki: her yüz düz tek renk, rengi yüzün
 * ışığa dönüklüğünden. Yansıtma ortografik (izometrik bakış), sıralama
 * ressam algoritması (uzaktan yakına), arka yüzler atılıyor.
 *
 * Eksenler: x ve y yer düzlemi, z yukarı. Kamera +x +y tarafından,
 * yukarıdan bakıyor: +x yüzleri ekranın solunda, +y yüzleri sağında.
 */
import { isikla } from './renk';

export type V3 = [number, number, number];

export interface Yuz {
  /** Köşeler — DIŞARIDAN bakınca saat yönünün TERSİ (normal dışarı). */
  p: V3[];
  renk: string;
  /** Kendi ışığı (0..1): ateş, pencere, büyü. Gölgeden etkilenmez. */
  isima?: number;
  /** Arka yüzü de çiz (yaprak, bayrak gibi ince şeyler). */
  ciftYuz?: boolean;
  /** Saydamlık (0..1): duman, ışıltı, su. Verilmezse tam dolu. */
  saydam?: number;
  /** Kenar çizgisi çizilmesin (duman, parıltı: yumuşak görünsün). */
  kenarsiz?: boolean;
  /**
   * Eğri bir yüzeyin dilimi (silindir yanı, koni, küre, uzuv). Kenarı
   * belli belirsiz çiziliyor: koyu kenar her dilimde yinelenince kule ve
   * kafa tel kafes gibi okunuyordu. Dış hat yine gölge farkından belli.
   */
  yumusak?: boolean;
  /**
   * Gölgeleme normali. Verilirse ışık bununla hesaplanıyor, görünürlük
   * yine yüzün kendi normalinden. Arazi komşu noktaların ortalamasını
   * veriyor: geometri düşük çokgenli kalıyor ama ışık yüzden yüze
   * sıçramadan akıyor (buruşuk kâğıt görüntüsü buradan geliyordu).
   */
  gn?: V3;
  /**
   * Çizim katmanı: küçük önce. Ressam algoritması yüzün ORTASINA bakıyor;
   * dev bir zemin yüzünün ortası sahnenin ortasında kaldığı için arkadaki
   * duvarlar onun altında kalıyordu. Zemin -2, yere yatık yol/döşeme -1,
   * nesneler 0.
   */
  katman?: number;
}

export type Model = Yuz[];

/* ── Vektör ─────────────────────────────────────────────────────────── */

const ekle = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const nokta = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const capraz = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const birim = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Yüzün dışa bakan normali (Newell yöntemi: dışbükey olmayan yüzde de sağlam). */
export function normal(p: V3[]): V3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return birim([nx, ny, nz]);
}

function merkez(p: V3[]): V3 {
  const m: V3 = [0, 0, 0];
  for (const q of p) {
    m[0] += q[0];
    m[1] += q[1];
    m[2] += q[2];
  }
  return [m[0] / p.length, m[1] / p.length, m[2] / p.length];
}

/* ── Dönüşümler ────────────────────────────────────────────────────── */

export function tasi(m: Model, d: V3): Model {
  return m.map((y) => ({ ...y, p: y.p.map((q) => ekle(q, d)) }));
}

export function olcekle(m: Model, s: number | V3, o: V3 = [0, 0, 0]): Model {
  const k: V3 = typeof s === 'number' ? [s, s, s] : s;
  const ters = k[0] * k[1] * k[2] < 0;
  return m.map((y) => {
    const p = y.p.map((q): V3 => [
      o[0] + (q[0] - o[0]) * k[0],
      o[1] + (q[1] - o[1]) * k[1],
      o[2] + (q[2] - o[2]) * k[2],
    ]);
    // Aynalamada köşe sırası tersine döner; normal dışarı baksın diye çevir.
    return { ...y, p: ters ? p.reverse() : p };
  });
}

/** `eksen` etrafında `aci` radyan döndürür, `o` noktası sabit. */
export function dondur(m: Model, eksen: 'x' | 'y' | 'z', aci: number, o: V3 = [0, 0, 0]): Model {
  const c = Math.cos(aci);
  const s = Math.sin(aci);
  const f = (q: V3): V3 => {
    const x = q[0] - o[0];
    const y = q[1] - o[1];
    const z = q[2] - o[2];
    if (eksen === 'z') return [o[0] + x * c - y * s, o[1] + x * s + y * c, o[2] + z];
    if (eksen === 'x') return [o[0] + x, o[1] + y * c - z * s, o[2] + y * s + z * c];
    return [o[0] + x * c + z * s, o[1] + y, o[2] - x * s + z * c];
  };
  return m.map((y) => ({ ...y, p: y.p.map(f) }));
}

/** Modelin bütün yüzlerini bir katmana koyar (bkz. `Yuz.katman`). */
export function katmanla(m: Model, katman: number): Model {
  return m.map((y) => ({ ...y, katman }));
}

export function boya(m: Model, renk: string): Model {
  return m.map((y) => ({ ...y, renk }));
}

/* ── İlkel şekiller ────────────────────────────────────────────────── */

/** Dikdörtgen kutu. `renk` tek renk ya da {ust, yan} (çatı üstü farklı olsun diye). */
export function kutu(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  renk: string | { ust: string; yan: string },
): Model {
  const ust = typeof renk === 'string' ? renk : renk.ust;
  const yan = typeof renk === 'string' ? renk : renk.yan;
  const a: V3 = [x, y, z];
  const X = x + sx;
  const Y = y + sy;
  const Z = z + sz;
  return [
    {
      p: [
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      renk: ust,
    }, // üst
    {
      p: [
        [x, y, z],
        [x, Y, z],
        [X, Y, z],
        [X, y, z],
      ],
      renk: yan,
    }, // alt
    {
      p: [
        [X, y, z],
        [X, Y, z],
        [X, Y, Z],
        [X, y, Z],
      ],
      renk: yan,
    }, // +x
    {
      p: [
        [x, y, z],
        [x, y, Z],
        [x, Y, Z],
        [x, Y, z],
      ],
      renk: yan,
    }, // -x
    {
      p: [
        [x, Y, z],
        [x, Y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      renk: yan,
    }, // +y
    { p: [a, [X, y, z], [X, y, Z], [x, y, Z]], renk: yan }, // -y
  ];
}

/** Bir taban çokgenini (xy, saat yönünün tersi) `h` kadar yükseltir. */
export function prizma(
  taban: [number, number][],
  z: number,
  h: number,
  renk: string | { ust: string; yan: string },
): Model {
  const ust = typeof renk === 'string' ? renk : renk.ust;
  const yan = typeof renk === 'string' ? renk : renk.yan;
  const n = taban.length;
  const m: Model = [
    { p: taban.map(([x, y]): V3 => [x, y, z + h]), renk: ust },
    { p: [...taban].reverse().map(([x, y]): V3 => [x, y, z]), renk: yan },
  ];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = taban[i]!;
    const [bx, by] = taban[(i + 1) % n]!;
    m.push({
      p: [
        [ax, ay, z],
        [bx, by, z],
        [bx, by, z + h],
        [ax, ay, z + h],
      ],
      renk: yan,
    });
  }
  return m;
}

export function cember(cx: number, cy: number, r: number, n: number, faz = 0): [number, number][] {
  return Array.from({ length: n }, (_, i): [number, number] => {
    const a = faz + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

/**
 * Eğri yüzeylerin dilim çarpanı. Tarifler dilim sayısını düşük yazıyor
 * (5–8); ekranda kule ve kafa köşeli, apolet topaklı duruyordu. 4 ve altı
 * bilerek köşeli (kare çatı, dört köşeli sivri kule): dokunulmuyor.
 */
const DILIM = 1.5;
export const dilim = (n: number): number => (n >= 5 ? Math.round(n * DILIM) : n);

export function silindir(
  cx: number,
  cy: number,
  z: number,
  r: number,
  h: number,
  renk: string | { ust: string; yan: string },
  n = 8,
): Model {
  const k = dilim(n);
  return prizma(cember(cx, cy, r, k, Math.PI / k), z, h, renk).map((y, i) =>
    i < 2 ? y : { ...y, yumusak: true },
  );
}

/** Koni ya da kesik koni (r2 > 0). */
export function koni(
  cx: number,
  cy: number,
  z: number,
  r1: number,
  h: number,
  renk: string,
  dilimSayisi = 8,
  r2 = 0,
): Model {
  const n = dilim(dilimSayisi);
  const alt = cember(cx, cy, r1, n, Math.PI / n);
  const m: Model = [{ p: [...alt].reverse().map(([x, y]): V3 => [x, y, z]), renk }];
  if (r2 > 0) {
    const ust = cember(cx, cy, r2, n, Math.PI / n);
    m.push({ p: ust.map(([x, y]): V3 => [x, y, z + h]), renk });
    for (let i = 0; i < n; i++) {
      const a = alt[i]!;
      const b = alt[(i + 1) % n]!;
      const c = ust[(i + 1) % n]!;
      const d = ust[i]!;
      m.push({
        p: [
          [a[0], a[1], z],
          [b[0], b[1], z],
          [c[0], c[1], z + h],
          [d[0], d[1], z + h],
        ],
        renk,
        yumusak: true,
      });
    }
  } else {
    for (let i = 0; i < n; i++) {
      const a = alt[i]!;
      const b = alt[(i + 1) % n]!;
      m.push({
        p: [
          [a[0], a[1], z],
          [b[0], b[1], z],
          [cx, cy, z + h],
        ],
        renk,
        yumusak: true,
      });
    }
  }
  return m;
}

/**
 * Düşük çokgenli küre. `boz` > 0 ise köşeler tohumlu olarak oynatılıyor:
 * ağaç tacı ve kaya "yapılmış" değil "büyümüş" görünsün.
 */
export function kure(
  cx: number,
  cy: number,
  cz: number,
  r: number,
  renk: string,
  dilimSayisi = 7,
  halkaSayisi = 4,
  boz = 0,
  // Varsayılan: bozulma yok. Math.random olsaydı çizim her açılışta değişirdi.
  rnd: () => number = () => 0.5,
  basik = 1,
): Model {
  // Bozulmuş küre (ağaç tacı, kaya) bilerek topaklı; dilimi artırmak
  // tohumlu dizinin uzunluğunu da değiştirirdi ve sahnedeki ağaçlar kayardı.
  const n = boz === 0 ? dilim(dilimSayisi) : dilimSayisi;
  const halka = boz === 0 && halkaSayisi >= 4 ? halkaSayisi + 1 : halkaSayisi;
  const nokta3 = (i: number, j: number): V3 => {
    const t = (i / halka) * Math.PI; // 0 tepe, π dip
    const f = (j / n) * Math.PI * 2 + (i % 2 ? Math.PI / n : 0);
    const k = 1 + (i > 0 && i < halka ? (rnd() - 0.5) * 2 * boz : 0);
    return [
      cx + Math.sin(t) * Math.cos(f) * r * k,
      cy + Math.sin(t) * Math.sin(f) * r * k,
      cz + Math.cos(t) * r * basik * (i > 0 && i < halka ? k : 1),
    ];
  };
  const izgara: V3[][] = [];
  for (let i = 0; i <= halka; i++) {
    const satir: V3[] = [];
    for (let j = 0; j < n; j++) satir.push(i === 0 || i === halka ? nokta3(i, 0) : nokta3(i, j));
    izgara.push(satir);
  }
  const m: Model = [];
  for (let i = 0; i < halka; i++) {
    for (let j = 0; j < n; j++) {
      const a = izgara[i]![j]!;
      const b = izgara[i]![(j + 1) % n]!;
      const c = izgara[i + 1]![(j + 1) % n]!;
      const d = izgara[i + 1]![j]!;
      if (i === 0) m.push({ p: [a, d, c], renk, yumusak: true });
      else if (i === halka - 1) m.push({ p: [a, d, b], renk, yumusak: true });
      else {
        m.push({ p: [a, d, c], renk, yumusak: true });
        m.push({ p: [a, c, b], renk, yumusak: true });
      }
    }
  }
  return m;
}

/** Dört eğimli çatı (piramit, üstü `tepe` kadar sırt). */
export function kirmaCati(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  h: number,
  renk: string,
  sacak = 0.4,
): Model {
  const x0 = x - sacak;
  const y0 = y - sacak;
  const x1 = x + sx + sacak;
  const y1 = y + sy + sacak;
  // Sırt uzun kenar boyunca: kare tabanda tek nokta.
  const uzunX = sx >= sy;
  const pay = Math.abs(sx - sy) / 2;
  const s1: V3 = uzunX ? [x + sy / 2, y + sy / 2, z + h] : [x + sx / 2, y + sx / 2, z + h];
  const s2: V3 = uzunX
    ? [x + sy / 2 + pay * 2, y + sy / 2, z + h]
    : [x + sx / 2, y + sx / 2 + pay * 2, z + h];
  const A: V3 = [x0, y0, z];
  const B: V3 = [x1, y0, z];
  const C: V3 = [x1, y1, z];
  const D: V3 = [x0, y1, z];
  if (uzunX) {
    return [
      { p: [A, B, s2, s1], renk }, // -y
      { p: [B, C, s2], renk }, // +x
      { p: [C, D, s1, s2], renk }, // +y
      { p: [D, A, s1], renk }, // -x
    ];
  }
  return [
    { p: [A, B, s1], renk }, // -y
    { p: [B, C, s2, s1], renk }, // +x
    { p: [C, D, s2], renk }, // +y
    { p: [D, A, s1, s2], renk }, // -x
  ];
}

/**
 * Beşik çatı: iki eğim + iki üçgen alın. Sırt `yon` ekseni boyunca.
 * Alınlar duvar rengiyle (`alin`) boyanıyor — gerçek evlerdeki gibi.
 */
export function besikCati(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  h: number,
  yon: 'x' | 'y',
  renk: string,
  alin: string,
  sacak = 0.5,
): Model {
  if (yon === 'x') {
    // Sırt ucunda taşma küçük: alın duvarla hizalı dursun, çentik kalmasın.
    const uc = Math.min(0.25, sacak);
    const x0 = x - uc;
    const x1 = x + sx + uc;
    const y0 = y - sacak;
    const y1 = y + sy + sacak;
    const ym = y + sy / 2;
    return [
      {
        p: [
          [x0, y0, z],
          [x1, y0, z],
          [x1, ym, z + h],
          [x0, ym, z + h],
        ],
        renk,
      },
      {
        p: [
          [x1, y1, z],
          [x0, y1, z],
          [x0, ym, z + h],
          [x1, ym, z + h],
        ],
        renk,
      },
      {
        p: [
          [x + sx, y, z],
          [x + sx, y + sy, z],
          [x + sx, ym, z + h],
        ],
        renk: alin,
      },
      {
        p: [
          [x, y + sy, z],
          [x, y, z],
          [x, ym, z + h],
        ],
        renk: alin,
      },
    ];
  }
  // yon === 'y': eksenleri takas edip geri çevir.
  return dondur(besikCati(y, -x - sx, z, sy, sx, h, 'x', renk, alin, sacak), 'z', Math.PI / 2);
}

/**
 * Mazgallı duvar başı: kalın bir kenar boyunca dişler. Surun ve kulenin
 * ortaçağ imzası; iki piksel yüksekliğinde bile "kale" diye okunuyor.
 */
export function mazgal(
  x: number,
  y: number,
  z: number,
  uzunluk: number,
  kalinlik: number,
  yon: 'x' | 'y',
  renk: string,
  dis = 1,
): Model {
  const m: Model = [];
  const adim = dis * 2;
  const n = Math.max(1, Math.floor(uzunluk / adim));
  const bosluk = (uzunluk - n * adim + dis) / 2;
  for (let i = 0; i < n; i++) {
    const t = bosluk + i * adim;
    if (yon === 'x') m.push(...kutu(x + t, y, z, dis, kalinlik, dis * 0.9, renk));
    else m.push(...kutu(x, y + t, z, kalinlik, dis, dis * 0.9, renk));
  }
  return m;
}

/** Düz, ince bir levha (bayrak, tabela, pencere) — iki yüzlü. */
export function levha(p: V3[], renk: string, isima?: number): Model {
  return [{ p, renk, ciftYuz: true, isima }];
}

/* ── Kamera ve çizim ───────────────────────────────────────────────── */

export interface Kamera {
  /** Yatay açı (radyan). π/4: klasik izometrik. */
  yon: number;
  /** Yükseklik açısı (radyan). */
  egim: number;
}

export const IZOMETRIK: Kamera = { yon: Math.PI / 4, egim: Math.PI / 6 };

/** Işık: sol üstten, hafif önden. Tüm çizimlerde aynı. */
const ISIK = birim([0.55, 0.2, 1]);
const ORTAM = 0.46;
const YAYGIN = 0.58;
/** Kenar: yüzün bir tık koyusu. Eğri yüzeyin dilim kenarı neredeyse görünmez. */
const KENAR = 0.78;
const KENAR_YUMUSAK = 0.94;

export interface Cokgen {
  n: string;
  renk: string;
  /** Kenar rengi: yüzün bir tık koyusu. Yoksa kenar çizilmiyor. */
  kenar?: string;
  saydam?: number;
}

export interface Cizilmis {
  cokgenler: Cokgen[];
  /** viewBox: x y en boy */
  kutu: [number, number, number, number];
}

/**
 * Modeli ekran çokgenlerine çevirir. Sonuç yalnız sayı ve renk taşıyor;
 * SVG'ye dökmek React bileşeninin işi.
 */
function kameraYonu(kamera: Kamera): V3 {
  return [
    Math.cos(kamera.egim) * Math.cos(kamera.yon),
    Math.cos(kamera.egim) * Math.sin(kamera.yon),
    Math.sin(kamera.egim),
  ];
}

/** Dünya noktasını ekran noktasına çeviren işlev (SVG: y aşağı). */
export function yansitici(kamera: Kamera = IZOMETRIK): (q: V3) => [number, number] {
  const c = kameraYonu(kamera);
  const sag = birim(capraz([0, 0, 1], c));
  const yukari = capraz(c, sag);
  return (q: V3) => [nokta(q, sag), -nokta(q, yukari)];
}

export function ciz(model: Model, kamera: Kamera = IZOMETRIK, pay = 1): Cizilmis {
  const c = kameraYonu(kamera);
  const ekran = yansitici(kamera);

  const liste: (Cokgen & { d: number; k: number })[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const y of model) {
    if (y.p.length < 3) continue;
    const nrm = normal(y.p);
    let n = nrm;
    if (nokta(nrm, c) <= 1e-6) {
      // Arka yüz: atılıyor; ince levhaysa öbür yüzü gösteriliyor.
      if (!y.ciftYuz) continue;
      n = [-nrm[0], -nrm[1], -nrm[2]];
    }
    // Gölgeleme normali ancak yüz öne bakıyorsa: arka yüzü çevrilmiş ince
    // levhada kendi (çevrilmiş) normali geçerli.
    const g = y.gn && n === nrm ? birim(y.gn) : n;
    const k = y.isima ? 0.75 + y.isima * 0.5 : ORTAM + YAYGIN * Math.max(0, nokta(g, ISIK));
    const noktalar = y.p.map(ekran);
    for (const [px, py] of noktalar) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    const renk = isikla(y.renk, k);
    liste.push({
      k: y.katman ?? 0,
      d: nokta(merkez(y.p), c),
      n: noktalar.map(([px, py]) => px.toFixed(2) + ',' + py.toFixed(2)).join(' '),
      renk,
      kenar: y.kenarsiz ? undefined : isikla(renk, y.yumusak ? KENAR_YUMUSAK : KENAR),
      saydam: y.saydam,
    });
  }
  liste.sort((a, b) => a.k - b.k || a.d - b.d);
  if (!isFinite(minX)) return { cokgenler: [], kutu: [0, 0, 1, 1] };
  return {
    cokgenler: liste.map(({ n, renk, kenar, saydam }) => ({ n, renk, kenar, saydam })),
    kutu: [minX - pay, minY - pay, maxX - minX + pay * 2, maxY - minY + pay * 2],
  };
}

/** İki modeli birleştirir (dizi yayma kısayolu, okunaklılık için). */
export function birlestir(...parcalar: Model[]): Model {
  return parcalar.flat();
}

/**
 * Bir hacmin (eksen hizalı kutu) ekrandaki çerçevesi. Aynı aileden
 * çizimler (bütün binalar) AYNI çerçevede çizilsin diye: yoksa her
 * çizim kendine oturur ve çadır da kale kadar büyük görünür.
 */
export function sabitKutu(
  min: V3,
  max: V3,
  kamera: Kamera = IZOMETRIK,
  pay = 0.5,
): [number, number, number, number] {
  const ekran = yansitici(kamera);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) {
        const [px, py] = ekran([x, y, z]);
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px);
        y1 = Math.max(y1, py);
      }
  return [x0 - pay, y0 - pay, x1 - x0 + pay * 2, y1 - y0 + pay * 2];
}

/**
 * Ekran noktasını YER DÜZLEMİNE (z = 0) geri yansıtır. Şehir sahnesinde
 * binaların yeri ekran yüzdesiyle tanımlı (data/binalar.json); yolları
 * onlara bağlamak için o noktaların dünyadaki karşılığı gerekiyor.
 */
export function zemineGeri(
  kamera: Kamera = IZOMETRIK,
): (sx: number, sy: number) => [number, number] {
  const e = yansitici(kamera);
  const [a, c] = e([1, 0, 0]);
  const [b, d] = e([0, 1, 0]);
  const det = a * d - b * c;
  return (sx, sy) => [(d * sx - b * sy) / det, (-c * sx + a * sy) / det];
}
