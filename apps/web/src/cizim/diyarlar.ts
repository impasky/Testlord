/**
 * AKIN DİYARLARI — beş diyarın kapağı (16:9) ve haritası (kare) (docs/24).
 *
 * Harita: kampların yeri veride sabit (`AKIN_YOL`, ekran yüzdesi). Yol o
 * noktaları yumuşak bir eğriyle birleştiriyor ve arazi yol boyunca
 * düzleşiyor; kamp işaretleri (düşman figürleri) arayüzde bu noktalara
 * konuyor, dolayısıyla tam yolun üstüne oturuyorlar — eski resimde
 * "işaretçiler patikanın tam üstüne oturmuyor" diye ayrıca kesikli çizgi
 * gerekmişti.
 *
 * Kapak: aynı diyarın manzarası ve ortasında düşmanın kampı.
 */
import { AKIN_YOL } from '@lordlar/shared';
import {
  arazi,
  cizgiyeUzaklik,
  duzle,
  ekrandanYere,
  gurultu,
  nehirOy,
  tepe,
  yerYolu,
  yumusakAdim,
  yumusat,
  type Nokta,
  type Yukseklik,
} from './arazi';
import { citKisa } from './kir';
import { cadir, cubuk, duman, kaya, kemer, uzuv } from './parca';
import { P, isikla, karistir } from './renk';
import { rastgele } from './rastgele';
import {
  birlestir,
  koni,
  kure,
  kutu,
  mazgal,
  prizma,
  silindir,
  tasi,
  yansitici,
  type Model,
} from './uc';

export const DIYAR_ADLARI = [
  'kirik_sahil',
  'solgun_bataklik',
  'kuzey_buzulu',
  'kuller_vadisi',
  'unutulmus_nekropol',
] as const;
export type Diyar = (typeof DIYAR_ADLARI)[number];
export type Kadraj = 'kapak' | 'harita';

/**
 * Kapak yakın çekim: akın kartı kapağı 16:6 şeride kırpıyor, geniş bir
 * kadrajda kamp bir avuç nokta kalıyordu.
 */
export const KAPAK_KUTUSU: [number, number, number, number] = [-24, -13.5, 48, 27];
export const HARITA_KUTUSU: [number, number, number, number] = [-32, -32, 64, 64];

const ekran = yansitici();
type Gurultu = ReturnType<typeof gurultu>;

interface Baglam {
  kadraj: Kadraj;
  kutu: [number, number, number, number];
  /** Çerçeve yüzdesi → yer. */
  yer: (px: number, py: number) => Nokta;
  /** Dünya noktasının çerçevedeki yeri (0-1). */
  uv: (x: number, y: number) => [number, number];
  g: Gurultu;
  r: () => number;
  h: Yukseklik;
  yol: Nokta[];
  /** Kapakta kampın merkezi. */
  kamp: Nokta;
  /** Süs koymaya uygun mu (yoldan, kamptan uzak). */
  bos: (x: number, y: number, pay?: number) => boolean;
}

/* ── Ortak parçalar ───────────────────────────────────────────────── */

function kampAtesi(x: number, y: number, z: number, r: () => number): Model {
  const m: Model = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    m.push(
      ...kutu(
        x + Math.cos(a) * 0.9 - 0.22,
        y + Math.sin(a) * 0.9 - 0.22,
        z,
        0.44,
        0.44,
        0.3,
        P.kaya,
      ),
    );
  }
  const alev = koni(x, y, z + 0.1, 0.55, 1.4, P.ates, 5);
  const ic = koni(x, y, z + 0.1, 0.3, 0.9, P.kor, 5);
  for (const f of [...alev, ...ic]) f.isima = 1;
  m.push(...alev, ...ic, ...duman(x + 0.3, y - 0.2, z + 2.6, r, 2));
  return m;
}

/** Çadır: zemin yüksekliğinde. */
function cadirZ(x: number, y: number, z: number, s: number, renk: string, yon: 'x' | 'y'): Model {
  return tasi(cadir(x, y, 3.2 * s, 2.6 * s, 2.3 * s, renk, yon), [0, 0, z]);
}

/** Yuvarlak çadır (otağ): silindir + külah. */
function otag(x: number, y: number, z: number, s: number, renk: string, serit: string): Model {
  return birlestir(
    silindir(x, y, z, 1.6 * s, 1.5 * s, renk, 9),
    silindir(x, y, z + 1.2 * s, 1.63 * s, 0.25 * s, serit, 9),
    koni(x, y, z + 1.5 * s, 1.75 * s, 1.5 * s, isikla(renk, 1.05), 9),
    kutu(x - 0.35 * s, y + 1.45 * s, z, 0.7 * s, 0.2, 1.1 * s, '#2a1e14'),
  );
}

function sancakDirek(x: number, y: number, z: number, renk: string): Model {
  return birlestir(silindir(x, y, z, 0.1, 4, P.koyuTahta, 5), [
    {
      p: [
        [x, y + 0.05, z + 3.9],
        [x, y + 1.6, z + 3.7],
        [x, y + 1.6, z + 2.6],
        [x, y + 0.9, z + 2.9],
        [x, y + 0.05, z + 2.5],
      ],
      renk,
      ciftYuz: true,
    },
  ]);
}

/** Kurumuş ağaç: gövde ve iki üç çıplak dal. */
function oluAgac(x: number, y: number, z: number, r: () => number, renk = '#4a4038', s = 1): Model {
  const h = (3 + r() * 1.6) * s;
  const m = uzuv([x, y, z - 0.2], [x + (r() - 0.5) * 0.6, y, z + h], 0.3 * s, 0.14 * s, renk, 5);
  for (let i = 0; i < 3; i++) {
    const t = 0.45 + i * 0.18;
    const a = r() * Math.PI * 2;
    const k: [number, number, number] = [x, y, z + h * t];
    m.push(
      ...uzuv(
        k,
        [x + Math.cos(a) * 1.3 * s, y + Math.sin(a) * 1.3 * s, z + h * t + 1 * s],
        0.12 * s,
        0.05 * s,
        renk,
        4,
      ),
    );
  }
  return m;
}

function saz(x: number, y: number, z: number, r: () => number): Model {
  const m: Model = [];
  for (let i = 0; i < 5; i++) {
    const dx = (r() - 0.5) * 0.9;
    const dy = (r() - 0.5) * 0.9;
    m.push(...koni(x + dx, y + dy, z, 0.12, 1.2 + r() * 0.9, i % 2 ? '#8a8a4a' : '#9a9a5a', 3));
  }
  return m;
}

function obelisk(x: number, y: number, z: number, h: number, renk = '#6a5a4a'): Model {
  return birlestir(
    kutu(x - 0.8, y - 0.8, z, 1.6, 1.6, 0.4, isikla(renk, 0.9)),
    koni(x, y, z + 0.4, 0.75, h, renk, 4, 0.42),
    koni(x, y, z + 0.4 + h, 0.42, 0.9, isikla(renk, 1.1), 4),
  );
}

/** Mor alevli mangal (nekropol). */
function mangal(x: number, y: number, z: number): Model {
  const alev = koni(x, y, z + 1.1, 0.45, 1.3, '#a070ff', 5);
  const ic = koni(x, y, z + 1.1, 0.25, 0.8, '#e0c8ff', 5);
  for (const f of [...alev, ...ic]) f.isima = 1;
  return birlestir(
    silindir(x, y, z, 0.25, 0.8, '#3a3440', 5),
    silindir(x, y, z + 0.8, 0.6, 0.3, '#3a3440', 6),
    alev,
    ic,
  );
}

/** Gemi enkazı: omurga ve kaburgalar. */
function enkaz(x: number, y: number, z: number, uzun: number, aci: number): Model {
  const c = Math.cos(aci);
  const s = Math.sin(aci);
  const nokta = (u: number, v: number, w: number): [number, number, number] => [
    x + u * c - v * s,
    y + u * s + v * c,
    z + w,
  ];
  const m = cubuk(nokta(0, 0, 0.2), nokta(uzun, 0, 0.5), 0.4, '#3a2e24');
  for (let i = 1; i < 6; i++) {
    const u = (uzun * i) / 6;
    const g = 1.2 + Math.sin((i / 6) * Math.PI) * 0.8;
    for (const yan of [-1, 1]) {
      m.push(...cubuk(nokta(u, 0, 0.3), nokta(u, yan * g, 1.2), 0.22, '#4a3a2c'));
      m.push(
        ...cubuk(
          nokta(u, yan * g, 1.2),
          nokta(u, yan * g * 0.9, 2.4 + (i % 2) * 0.5),
          0.2,
          '#4a3a2c',
        ),
      );
    }
  }
  return m;
}

function buzSivrisi(x: number, y: number, z: number, h: number): Model {
  return birlestir(
    koni(x, y, z, 0.6 * h * 0.35, h, '#b8dcec', 5),
    koni(x + 0.5, y + 0.3, z, 0.3 * h * 0.3, h * 0.6, '#d8eef6', 4),
  );
}

function karliCam(x: number, y: number, z: number, s: number): Model {
  const m = silindir(x, y, z, 0.25 * s, 1.2 * s, P.koyuTahta, 5);
  for (let i = 0; i < 3; i++) {
    const rr = (2 - i * 0.5) * s;
    m.push(
      ...koni(
        x,
        y,
        z + (1 + i * 1.4) * s,
        rr,
        2.2 * s,
        i === 2 ? '#e6ecef' : karistir('#2f4f2c', '#e6ecef', 0.25 + i * 0.2),
        7,
      ),
    );
  }
  return m;
}

/** Yıkık duvar parçası: kırık üst kenarlı taş sur. */
function yikikDuvar(
  x: number,
  y: number,
  z: number,
  uzun: number,
  yon: 'x' | 'y',
  r: () => number,
  renk: string = P.tas,
): Model {
  const m: Model = [];
  const n = Math.max(1, Math.round(uzun / 1.6));
  for (let i = 0; i < n; i++) {
    const h = 1.2 + r() * 2.6;
    if (yon === 'x') m.push(...kutu(x + i * 1.6, y, z, 1.6, 1.2, h, renk));
    else m.push(...kutu(x, y + i * 1.6, z, 1.2, 1.6, h, renk));
  }
  return m;
}

/* ── Temalar ───────────────────────────────────────────────────────── */

interface Tema {
  yukseklik: (b: Omit<Baglam, 'h' | 'bos'>) => Yukseklik;
  renk: (g: Gurultu) => (x: number, y: number, z: number, dik: number) => string;
  su?: number;
  suRengi?: string;
  derinSu?: string;
  kiyi?: string;
  yolRengi: string;
  /** Yolun ve kampın oturduğu yükseklik. */
  duzZ: number;
  susle: (m: Model, b: Baglam) => void;
  kampKur: (m: Model, b: Baglam, z: number) => void;
}

/** Çerçevedeki rastgele noktalardan, koşulu tutanlara nesne serper. */
function serp(
  b: Baglam,
  adet: number,
  kosul: (x: number, y: number) => boolean,
  uret: (x: number, y: number, z: number) => Model,
): Model {
  const m: Model = [];
  let kalan = adet;
  let d = 0;
  while (kalan > 0 && d++ < adet * 40) {
    const [x, y] = b.yer(b.r() * 104 - 2, b.r() * 104 - 2);
    if (!kosul(x, y)) continue;
    m.push(...uret(x, y, b.h(x, y)));
    kalan--;
  }
  return m;
}

const TEMA: Record<Diyar, Tema> = {
  kirik_sahil: {
    yukseklik:
      ({ g, uv, kadraj }) =>
      (x, y) => {
        const [u, v] = uv(x, y);
        const deniz =
          kadraj === 'kapak'
            ? yumusakAdim((u - 0.6) / 0.16)
            : yumusakAdim((u - 0.6) / 0.14) * yumusakAdim((v - 0.52) / 0.14);
        const kayalik =
          kadraj === 'kapak' ? 0 : yumusakAdim((0.35 - u) / 0.2) * yumusakAdim((0.4 - v) / 0.2) * 7;
        return 1.2 + g(x, y, 12, 3) * 3.4 - deniz * 7 + kayalik * g(x + 9, y, 6, 2);
      },
    renk: (g) => (x, y, z, dik) => {
      const t = g(x + 40, y, 8, 2);
      let c = karistir('#8a7d62', '#6e6556', Math.min(1, z / 3));
      if (z > 2.5 || dik > 0.3) c = karistir('#4f4a44', '#6a6258', t);
      return c;
    },
    su: -0.4,
    suRengi: '#2f5566',
    derinSu: '#1d3a48',
    kiyi: '#6a6250',
    yolRengi: '#9a8a6a',
    duzZ: 0.8,
    susle: (m, b) => {
      m.push(
        ...serp(
          b,
          22,
          (x, y) => b.bos(x, y, 2.5),
          (x, y, z) => kaya(x, y, Math.max(z, -0.3) - 0.3, 0.8 + b.r() * 1.6, b.r, '#4a4640'),
        ),
      );
      m.push(
        ...serp(
          b,
          b.kadraj === 'kapak' ? 2 : 3,
          (x, y) => b.bos(x, y, 5) && b.h(x, y) < 0.5 && b.h(x, y) > -1.5,
          (x, y, z) => enkaz(x, y, Math.max(z, -0.4), 7, b.r() * Math.PI),
        ),
      );
    },
    kampKur: (m, b, z) => {
      const [x, y] = b.kamp;
      m.push(...kampAtesi(x, y, z, b.r));
      m.push(
        ...cadirZ(x - 7, y - 4, z, 1, P.kirmiziBez, 'x'),
        ...cadirZ(x - 3, y - 7.5, z, 1.1, '#d9ccab', 'y'),
      );
      m.push(...cadirZ(x + 2, y - 6, z, 0.9, P.kirmiziBez, 'x'));
      m.push(...sancakDirek(x - 1.5, y + 2.5, z, P.kirmiziBez));
      m.push(...enkaz(x + 6, y + 1, z, 8, 0.5));
      const [kx, ky] = b.yer(12, 22);
      m.push(
        ...yikikDuvar(kx, ky, b.h(kx, ky), 8, 'x', b.r),
        ...yikikDuvar(kx, ky, b.h(kx, ky), 6, 'y', b.r),
      );
    },
  },

  solgun_bataklik: {
    yukseklik:
      ({ g }) =>
      (x, y) => {
        const n = g(x * 1.2 + 30, y * 1.2, 9, 2);
        return 0.9 + g(x, y, 16, 2) * 1.6 - Math.max(0, n - 0.52) * 12;
      },
    renk: (g) => (x, y, _z, dik) => {
      const t = g(x - 20, y + 5, 7, 2);
      let c = karistir('#7d7f52', '#a09d68', t);
      if (dik > 0.3) c = karistir(c, '#5a5840', 0.5);
      return c;
    },
    su: 0,
    suRengi: '#3f5a52',
    derinSu: '#2e4440',
    kiyi: '#6a6a48',
    yolRengi: '#7a6a4a',
    duzZ: 0.9,
    susle: (m, b) => {
      m.push(
        ...serp(
          b,
          14,
          (x, y) => b.bos(x, y, 3) && b.h(x, y) > 0.2,
          (x, y, z) => oluAgac(x, y, z, b.r, '#5a5040'),
        ),
      );
      m.push(
        ...serp(
          b,
          40,
          (x, y) => b.bos(x, y, 1.8) && Math.abs(b.h(x, y)) < 0.5,
          (x, y, z) => saz(x, y, Math.max(z, 0), b.r),
        ),
      );
    },
    kampKur: (m, b, z) => {
      const [x, y] = b.kamp;
      m.push(...kampAtesi(x, y, z, b.r));
      m.push(
        ...otag(x - 5, y - 5, z, 1.1, '#e2d8c0', P.kirmiziBez),
        ...otag(x + 1.5, y - 7, z, 1, '#e2d8c0', P.kirmiziBez),
      );
      m.push(...otag(x - 8.5, y + 0.5, z, 0.9, '#d9ccab', P.kirmiziBez));
      m.push(...sancakDirek(x + 3, y + 1, z, P.kirmiziBez));
      for (let i = 0; i < 5; i++)
        m.push(...silindir(x + 4 + i * 0.9, y - 1.5 + i * 0.3, z, 0.15, 1.6, P.koyuTahta, 4));
    },
  },

  kuzey_buzulu: {
    yukseklik: ({ g, yer, kadraj }) => {
      const yarik =
        kadraj === 'harita'
          ? yumusat([yer(-5, 20), yer(30, 38), yer(48, 55), yer(70, 72), yer(110, 88)])
          : yumusat([yer(-5, 30), yer(40, 20), yer(105, 12)]);
      const taban: Yukseklik = (x, y) => 1.5 + g(x, y, 14, 3) * 4;
      return nehirOy(taban, yarik, 2.6, -4);
    },
    renk: (g) => (x, y, z, dik) => {
      if (z < -0.8) return karistir('#2e4a66', '#4a6a88', Math.max(0, (z + 4) / 3.2));
      const t = g(x + 11, y - 7, 8, 2);
      let c = karistir('#dfe7ec', '#c3d2dc', t);
      if (dik > 0.35) c = karistir(c, '#8fb0c4', Math.min(1, (dik - 0.35) * 2.5));
      return c;
    },
    yolRengi: '#9aa4a8',
    duzZ: 1.6,
    susle: (m, b) => {
      m.push(
        ...serp(
          b,
          14,
          (x, y) => b.bos(x, y, 2.5) && b.h(x, y) > 0.5,
          (x, y, z) => buzSivrisi(x, y, z - 0.2, 1.5 + b.r() * 2.5),
        ),
      );
      m.push(
        ...serp(
          b,
          12,
          (x, y) => b.bos(x, y, 3) && b.h(x, y) > 0.5,
          (x, y, z) => karliCam(x, y, z - 0.2, 0.8 + b.r() * 0.3),
        ),
      );
      m.push(
        ...serp(
          b,
          10,
          (x, y) => b.bos(x, y, 2) && b.h(x, y) > 0.5,
          (x, y, z) => kaya(x, y, z - 0.3, 0.8 + b.r(), b.r, '#7a8a94'),
        ),
      );
    },
    kampKur: (m, b, z) => {
      const [x, y] = b.kamp;
      m.push(...kampAtesi(x, y, z, b.r));
      m.push(
        ...cadirZ(x - 6, y - 4, z, 1, '#6b5a45', 'x'),
        ...cadirZ(x - 2, y - 7.5, z, 1, '#5a4a3a', 'y'),
      );
      m.push(...cadirZ(x - 9, y + 1, z, 0.9, '#6b5a45', 'y'));
      // Ağıl: dört kol çit
      const [px, py] = [x + 3, y - 3];
      m.push(...citKisa(px, py, z, 7, 'x'), ...citKisa(px, py, z, 6, 'y'));
      m.push(...citKisa(px, py + 6, z, 7, 'x'), ...citKisa(px + 7, py, z, 6, 'y'));
      m.push(...sancakDirek(x - 2, y + 3, z, '#6a1f1a'));
    },
  },

  kuller_vadisi: {
    yukseklik: ({ g, yer, kadraj }) => {
      const [vx, vy] = kadraj === 'kapak' ? yer(80, 14) : yer(22, 30);
      const R = kadraj === 'kapak' ? 16 : 18;
      const H = kadraj === 'kapak' ? 11 : 13;
      return (x, y) => {
        const dag = tepe(x, y, vx, vy, R, H) - tepe(x, y, vx, vy, R * 0.18, H * 0.25);
        return 0.8 + g(x, y, 12, 3) * 2.6 + dag * (0.85 + 0.3 * g(x * 2, y * 2, 5, 1));
      };
    },
    renk: (g) => (x, y, z, dik) => {
      const t = g(x + 3, y + 3, 7, 2);
      let c = karistir('#4a443e', '#5e554b', t);
      if (dik > 0.3 || z > 5) c = karistir('#3a3632', '#4f4640', t);
      return c;
    },
    yolRengi: '#6a5a4a',
    duzZ: 1.0,
    susle: (m, b) => {
      m.push(
        ...serp(
          b,
          16,
          (x, y) => b.bos(x, y, 2.5) && b.h(x, y) < 5,
          (x, y, z) => oluAgac(x, y, z, b.r, '#2a2420', 0.9),
        ),
      );
      m.push(
        ...serp(
          b,
          14,
          (x, y) => b.bos(x, y, 2) && b.h(x, y) < 4,
          (x, y, z) => kaya(x, y, z - 0.3, 0.7 + b.r() * 1.2, b.r, '#34302c'),
        ),
      );
      // Lav yarıkları: yere yatık, kendinden ışıklı
      m.push(
        ...serp(
          b,
          b.kadraj === 'kapak' ? 8 : 12,
          (x, y) => b.bos(x, y, 2) && b.h(x, y) < 3.5,
          (x, y, z) => {
            const a = b.r() * Math.PI;
            const l = 1.5 + b.r() * 2.5;
            const c = Math.cos(a);
            const s = Math.sin(a);
            return [
              {
                p: [
                  [x - c * l, y - s * l, z + 0.1],
                  [x - s * 0.3, y + c * 0.3, z + 0.1],
                  [x + c * l, y + s * l, z + 0.1],
                  [x + s * 0.3, y - c * 0.3, z + 0.1],
                ],
                renk: '#e8622a',
                isima: 1,
                katman: -1,
                kenarsiz: true,
                ciftYuz: true,
              },
            ];
          },
        ),
      );
      // Yanardağ ağzı: kor ve duman
      const [vx, vy] = b.kadraj === 'kapak' ? b.yer(80, 14) : b.yer(22, 30);
      const vz = b.h(vx, vy);
      const kor = prizma(
        Array.from({ length: 8 }, (_, i): Nokta => [
          vx + Math.cos((i / 8) * Math.PI * 2) * 2.4,
          vy + Math.sin((i / 8) * Math.PI * 2) * 2.4,
        ]),
        vz + 0.3,
        0.1,
        '#f28c28',
      );
      for (const f of kor) f.isima = 1;
      m.push(...kor);
      for (let i = 0; i < 3; i++) {
        const d = duman(vx + i * 0.8, vy - i * 0.6, vz + 3 + i * 2, b.r, 3).map((f) => ({
          ...f,
          renk: '#6a625a',
        }));
        m.push(...d);
      }
    },
    kampKur: (m, b, z) => {
      const [x, y] = b.kamp;
      m.push(...kampAtesi(x, y, z, b.r));
      // Yanmış köy: çatısız, kararmış evler
      for (const [dx, dy, sx, sy] of [
        [-8, -5, 4, 3.4],
        [-3, -8, 3.6, 3.2],
        [3, -6, 4.2, 3.6],
      ] as [number, number, number, number][]) {
        const hx = x + dx;
        const hy = y + dy;
        m.push(...kutu(hx, hy, z, sx, sy, 2.2, '#3a3430'));
        m.push(...kutu(hx + 0.4, hy + 0.4, z + 2.2, sx - 0.8, 0.4, 0.8, '#2a2420'));
        const pen = kutu(hx + sx - 0.02, hy + sy / 2 - 0.4, z + 0.8, 0.1, 0.8, 0.8, P.ates);
        for (const f of pen) f.isima = 0.8;
        m.push(...pen, ...duman(hx + sx / 2, hy + sy / 2, z + 3.4, b.r, 2));
      }
      m.push(...sancakDirek(x + 2, y + 2, z, '#2f5a3a'));
    },
  },

  unutulmus_nekropol: {
    yukseklik:
      ({ g }) =>
      (x, y) =>
        1.2 + g(x * 0.8, y * 0.35, 12, 2) * 4 + g(x, y, 6, 1) * 0.6,
    renk: (g) => (x, y, _z, dik) => {
      const t = g(x - 7, y + 2, 8, 2);
      let c = karistir('#c9a36a', '#b08a52', t);
      if (dik > 0.3) c = karistir(c, '#9a7a4a', 0.6);
      return c;
    },
    yolRengi: '#8a6a44',
    duzZ: 1.4,
    susle: (m, b) => {
      m.push(
        ...serp(
          b,
          b.kadraj === 'kapak' ? 6 : 10,
          (x, y) => b.bos(x, y, 3),
          (x, y, z) => obelisk(x, y, z - 0.2, 4 + b.r() * 3.5),
        ),
      );
      m.push(
        ...serp(
          b,
          b.kadraj === 'kapak' ? 2 : 5,
          (x, y) => b.bos(x, y, 4.5),
          (x, y, z) => {
            const t = birlestir(
              kutu(x - 2, y - 1.6, z - 0.2, 4, 3.2, 2.6, '#a88a5a'),
              kutu(x - 2.3, y - 1.9, z + 2.4, 4.6, 3.8, 0.4, '#b89a6a'),
            );
            t.push(...kemer('y', y + 1.6, x - 0.6, z - 0.2, 1.2, 2, '#1d1612'));
            return t;
          },
        ),
      );
      m.push(
        ...serp(
          b,
          6,
          (x, y) => b.bos(x, y, 2),
          (x, y, z) => mangal(x, y, z - 0.1),
        ),
      );
      m.push(
        ...serp(
          b,
          4,
          (x, y) => b.bos(x, y, 4),
          (x, y, z) =>
            yikikDuvar(x, y, z - 0.3, 6 + b.r() * 4, b.r() < 0.5 ? 'x' : 'y', b.r, '#9a845a'),
        ),
      );
    },
    kampKur: (m, b, z) => {
      const [x, y] = b.kamp;
      // Basamaklı mezar tapınağı
      const [tx, ty] = [x - 6, y - 8];
      for (let k = 0; k < 3; k++) {
        const s = 9 - k * 2.4;
        m.push(
          ...kutu(tx - s / 2, ty - s / 2, z + k * 1.8, s, s, 1.8, k % 2 ? '#b89a6a' : '#a88a5a'),
        );
      }
      m.push(...kutu(tx - 1.6, ty - 1.6, z + 5.4, 3.2, 3.2, 2.2, '#9a7a4a'));
      m.push(...mazgal(tx - 1.6, ty + 1.2, z + 7.6, 3.2, 0.4, 'x', '#9a7a4a', 0.6));
      m.push(...kemer('y', ty + 1.6, tx - 0.6, z + 5.4, 1.2, 1.8, '#1d1612'));
      m.push(...mangal(x - 1, y, z), ...mangal(x + 3, y - 3, z));
      m.push(...obelisk(x + 4, y + 2, z, 6), ...obelisk(x - 10, y + 2, z, 5));
      m.push(...kure(x + 1, y + 3, z + 0.3, 0.5, P.kemik, 5, 3));
    },
  },
};

/* ── Giriş ─────────────────────────────────────────────────────────── */

export function diyarModeli(ad: string, kadraj: Kadraj): Model | null {
  const tema = TEMA[ad as Diyar];
  if (!tema) return null;
  const kutu = kadraj === 'kapak' ? KAPAK_KUTUSU : HARITA_KUTUSU;
  const yer = ekrandanYere(kutu);
  const [vx, vy, ve, vb] = kutu;
  const uv = (x: number, y: number): [number, number] => {
    const [sx, sy] = ekran([x, y, 0]);
    return [(sx - vx) / ve, (sy - vy) / vb];
  };
  const g = gurultu('diyar:' + ad);
  const r = rastgele('diyar:' + ad + ':' + kadraj);
  const kamp = kadraj === 'kapak' ? yer(52, 56) : yer(46, 64);
  const yol =
    kadraj === 'harita'
      ? yumusat(
          AKIN_YOL.map((p) => yer(p.x, p.y)),
          6,
        )
      : yumusat([yer(-6, 92), yer(18, 76), yer(34, 64), kamp], 6);
  const taslak = { kadraj, kutu, yer, uv, g, r, yol, kamp };
  let h = tema.yukseklik(taslak);
  // Yol boyunca düzle: kamp işaretleri yolun üstüne otursun.
  const yolaYasla =
    (hh: Yukseklik): Yukseklik =>
    (x, y) => {
      const z = hh(x, y);
      const d = cizgiyeUzaklik(x, y, yol);
      if (d >= 4.5) return z;
      const t = d <= 2 ? 1 : yumusakAdim((4.5 - d) / 2.5);
      return z + (tema.duzZ - z) * t;
    };
  h = yolaYasla(h);
  if (kadraj === 'kapak')
    h = duzle(h, [{ x: kamp[0] - 3, y: kamp[1] - 3, r: 9, z: tema.duzZ, yumusak: 5 }]);
  const su = tema.su;
  const Z: Yukseklik = (x, y) => Math.max(h(x, y), su ?? -99);
  const m = arazi({
    cerceve: kutu,
    adim: kadraj === 'kapak' ? 3.2 : 3.6,
    h,
    renk: tema.renk(g),
    su,
    suRengi: tema.suRengi,
    derinSu: tema.derinSu,
    kiyi: tema.kiyi,
    r: rastgele('diyar-arazi:' + ad + ':' + kadraj),
  });
  m.push(...yerYolu(yol, kadraj === 'harita' ? 2.8 : 2.2, tema.yolRengi, Z));
  const kampNoktalari = kadraj === 'harita' ? AKIN_YOL.map((p) => yer(p.x, p.y)) : [];
  const bos = (x: number, y: number, pay = 2) =>
    cizgiyeUzaklik(x, y, yol) > pay + 1.4 &&
    kampNoktalari.every(([a, c]) => Math.hypot(a - x, c - y) > pay + 3) &&
    (kadraj === 'harita' || Math.hypot(x - kamp[0] + 3, y - kamp[1] + 3) > 12);
  const b: Baglam = { ...taslak, h: Z, bos };
  tema.susle(m, b);
  if (kadraj === 'kapak') tema.kampKur(m, b, tema.duzZ);
  return m;
}
