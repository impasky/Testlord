/**
 * FİGÜRLER — asker, düşman, at, mancınık (docs/24).
 *
 * İnsan tek bir kurucudan çıkıyor (`insan`): gövde, kol, bacak, baş hep
 * aynı oranda; birliği ayıran şey giysisi, başlığı ve elindeki. Böylece
 * milis ile mızrakçı yan yana durunca aynı ordunun iki askeri gibi
 * görünüyor, düşman şefi de "aynı dünyadan biri, ama iri".
 *
 * Yerel eksenler: yüz +y'ye bakıyor, z yukarı, figürün sağ eli +x
 * yanında. Çizimden önce z etrafında döndürülüyor (`bakis`): kameraya
 * dörtte üç dönük, bir tık ekranın sağına.
 */
import { cubuk, kubbe, suz, teker, uzuv } from './parca';
import { P, isikla } from './renk';
import { rastgele } from './rastgele';
import {
  birlestir,
  dondur,
  koni,
  kure,
  kutu,
  levha,
  olcekle,
  oneAl,
  parlat,
  prizma,
  silindir,
  tasi,
  type Model,
  type V3,
} from './uc';

export type BaslikTipi =
  'kukuleta' | 'migfer' | 'kapali' | 'boynuz' | 'sorguc' | 'sapka' | 'maske' | 'bone' | 'bant';

export type EsyaTipi =
  | 'mizrak'
  | 'kargi'
  | 'yaba'
  | 'kilic'
  | 'balta'
  | 'ciftBalta'
  | 'cekic'
  | 'yay'
  | 'asa'
  | 'fener'
  | 'kalkan'
  | 'yuvarlakKalkan'
  | 'scutum'
  | 'sancak'
  | 'hancer'
  | 'kitap'
  | 'tomar'
  | 'hac';

export interface Esya {
  tip: EsyaTipi;
  renk?: string;
  /** İkinci renk: kalkan arması, sancak bezi, asa taşı. */
  ikinci?: string;
  /** Kendi ışığı olan parça (alevli kılıç, fener, büyü taşı). */
  isik?: string;
}

export interface Insan {
  ten: string;
  sac?: string;
  sakal?: string;
  govde: string;
  etek?: string;
  bacak: string;
  cizme: string;
  kol?: string;
  /** Gövdenin üstüne: zincir, plaka, deri yelek ya da şerit (lejyon). */
  zirh?: { tip: 'zincir' | 'plaka' | 'deri' | 'serit'; renk: string };
  /** Zırhın üstüne cüppe/tabard: önde bez şerit. */
  tabard?: string;
  omuz?: string;
  kurk?: string;
  pelerin?: string;
  kemer?: string;
  baslik?: { tip: BaslikTipi; renk: string; ikinci?: string };
  sag?: Esya;
  sol?: Esya;
  /** Sırtta ok kılıfı. */
  sadak?: boolean;
  /** Şefler için: omuzları geniş, bir tık iri. */
  iri?: number;
  /** Uzun saç (başlık yoksa ense boyunca), dar omuz. */
  kadin?: boolean;
  /** Yere kadar etek: cüppe, elbise. Bacaklar görünmüyor. */
  elbise?: boolean;
  /** Atlı: bacaklar öne ve yanlara açık, eteksiz. */
  oturan?: boolean;
  poz?: 'duz' | 'nisan' | 'kaldir';
}

const KARA = '#1d1612';
/** Zırh türüne göre parlaklık (bkz. `Yuz.parlak`): düz plaka en çok, deri hiç. */
const ZIRH_PARLAK: Record<NonNullable<Insan['zirh']>['tip'], number> = {
  plaka: 0.75,
  serit: 0.6,
  zincir: 0.4,
  deri: 0,
};

const merkezle = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const birimV = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** El: çıplak (ten) ya da eldivenli (plaka zırhlının demir eldiveni). */
interface ElAyari {
  renk: string;
  parlak?: number;
  /** Yen ağzı: giyinik kolun bileğindeki koyu kenar; çıplak kolda yok. */
  yen?: string;
}

/** Eli verilen noktaya uzatan kol: üst kol + ön kol + el. */
function kol(omuz: V3, el: V3, renk: string, elAyari: ElAyari, disa: number): Model {
  const dirsek = merkezle(omuz, el, 0.5);
  dirsek[0] += disa * 0.25;
  dirsek[1] -= 0.15;
  dirsek[2] -= 0.25;
  return birlestir(
    uzuv(omuz, dirsek, 0.34, 0.29, renk, 6),
    uzuv(dirsek, el, 0.29, 0.24, renk, 6),
    yumruk(dirsek, el, elAyari),
  );
}

/**
 * El: top değil yumruk. Ön kolun doğrultusunda kare bir avuç, öne (+y)
 * doğru çıkan başparmak, bilekte yen ağzı. Top el her boyda yumak gibi
 * okunuyordu; kare avuç ve başparmak küçük figürde de "el" diyor.
 */
function yumruk(dirsek: V3, el: V3, o: ElAyari): Model {
  const d = birimV([el[0] - dirsek[0], el[1] - dirsek[1], el[2] - dirsek[2]]);
  // Başparmak yönü: ileri (+y), ön kolun doğrultusuna dik bileşeni.
  let t: V3 = [-d[0] * d[1], 1 - d[1] * d[1], -d[2] * d[1]];
  if (Math.hypot(t[0], t[1], t[2]) < 0.2) t = [1, 0, 0];
  t = birimV(t);
  const at = (k: number, j = 0): V3 => [
    el[0] + d[0] * k + t[0] * j,
    el[1] + d[1] * k + t[1] * j,
    el[2] + d[2] * k + t[2] * j,
  ];
  const m: Model = o.yen ? uzuv(at(-0.16), at(-0.03), 0.3, 0.3, o.yen, 6) : [];
  const avuc = birlestir(
    cubuk(at(-0.06), at(0.28), 0.34, o.renk),
    uzuv(at(0.0, 0.15), at(0.17, 0.22), 0.085, 0.07, o.renk, 5),
  );
  m.push(...(o.parlak ? parlat(avuc, o.parlak) : avuc));
  return m;
}

/** Yüzleri `merkez`den dışa baktırır (elle kurulan küçük parçalar için). */
function disaDonuk(m: Model, merkez: V3): Model {
  for (const y of m) {
    const [a, b, c] = y.p as [V3, V3, V3];
    const n: V3 = [
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ];
    const g: V3 = [
      (a[0] + b[0] + c[0]) / 3 - merkez[0],
      (a[1] + b[1] + c[1]) / 3 - merkez[1],
      (a[2] + b[2] + c[2]) / 3 - merkez[2],
    ];
    if (n[0] * g[0] + n[1] * g[1] + n[2] * g[2] < 0) y.p.reverse();
  }
  return m;
}

/**
 * Yüz: göz akı ve bebeği, kaş, burun, ağız, kulak. Başın ön yüzü düz
 * (12 dilim, bir dilim tam öne bakıyor); her öğe önde, +y'ye bakarak
 * kuruluyor, sonra başın ekseni etrafında çevrilip yüzeye oturuyor. Eski
 * yüz iki siyah kare ve kutu burundu; portrede "maske" gibi duruyordu.
 */
function yuz(f: Insan, bz: number): Model {
  const m: Model = [];
  const tip = f.baslik?.tip;
  // Kapalı miğfer ve maske yüzü örtüyor.
  if (tip === 'kapali' || tip === 'maske') return m;
  // Başın yarıçapı (bkz. insan: çeneden şakağa iki kesik koni).
  const r = (z: number) =>
    z < bz - 0.25
      ? 0.5 + ((z - (bz - 0.85)) / 0.6) * 0.24
      : 0.74 + ((z - (bz - 0.25)) / 0.7) * 0.06;
  const DILIM_ACI = Math.PI / 6;
  /** Öğeyi başın `aci` yönündeki yüzeye, `z` yüksekliğine oturt. */
  const oturt = (parca: Model, aci: number, z: number): Model => {
    // Dilimin düz yüzüne uzaklık: dilimin ortasından sapma kadar uzar.
    const sapma = aci - Math.round(aci / DILIM_ACI) * DILIM_ACI;
    const R = (r(z) * Math.cos(DILIM_ACI / 2)) / Math.cos(sapma);
    // SVG'nin ressam sırasında başın önüne düşsün (bkz. `Yuz.onde`).
    return oneAl(dondur(tasi(parca, [0, 0.06 + R, z]), 'z', aci, [0, 0.06, 0]), 0.45);
  };
  const kas = f.sac ?? f.sakal ?? isikla(f.ten, 0.55);
  const gz = bz + 0.03;
  for (const s of [-1, 1]) {
    // s = 1 sağ göz (dünya +x): başın ekseni etrafında eksi yöne çevrilir.
    const aci = -s * 0.28;
    m.push(
      ...oturt(
        birlestir(
          kutu(-0.085, -0.02, -0.065, 0.17, 0.04, 0.13, P.gozAki),
          kutu(-0.045, 0, -0.055, 0.09, 0.035, 0.11, P.gozBebegi),
        ),
        aci,
        gz,
      ),
    );
    // Kaş: erkekte iç ucu aşağı (kararlı), kadında dış ucu (yumuşak).
    const egim = (f.kadin ? 0.12 : -0.22) * s;
    m.push(
      ...oturt(
        dondur(kutu(-0.12, -0.02, -0.025, 0.24, 0.05, 0.05, kas), 'y', egim),
        aci,
        gz + 0.15,
      ),
    );
    // Kulak: saç ya da başlık örtmüyorsa görünüyor (uzun saç örtüyor).
    if (tip !== 'kukuleta')
      m.push(
        ...oturt(
          kutu(-0.1, -0.03, -0.16, 0.2, 0.1, 0.32, isikla(f.ten, 0.93)),
          (s * Math.PI) / 2,
          bz - 0.08,
        ),
      );
  }
  // Burun: kaş hizasından inen üçgen sırt; tabanı yüze gömük.
  const ust: V3 = [0, -0.03, 0.02];
  const uc: V3 = [0, 0.17, -0.3];
  const sol: V3 = [-0.1, -0.06, -0.34];
  const sag: V3 = [0.1, -0.06, -0.34];
  const renk = isikla(f.ten, 0.97);
  const burun = disaDonuk(
    [
      { p: [ust, sol, uc], renk },
      { p: [ust, uc, sag], renk },
      { p: [sol, sag, uc], renk },
    ],
    [0, -0.1, -0.2],
  );
  m.push(...oturt(burun, 0, bz - 0.02));
  // Ağız: sakal örtüyor.
  if (!f.sakal)
    m.push(
      ...oturt(
        kutu(-0.12, -0.03, -0.022, 0.24, 0.06, 0.045, f.kadin ? '#b4544a' : P.dudak),
        0,
        bz - 0.53,
      ),
    );
  return m;
}

/* ── Eldeki eşya ───────────────────────────────────────────────────── */

/** Kalkan biçimleri: yerel xz düzleminde çokgen (y kalınlık). */
function kalkanCokgeni(tip: EsyaTipi, s: number): [number, number][] {
  if (tip === 'yuvarlakKalkan')
    return Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return [Math.cos(a) * s, Math.sin(a) * s];
    });
  if (tip === 'scutum')
    return [
      [-s * 0.72, -s * 1.15],
      [s * 0.72, -s * 1.15],
      [s * 0.72, s * 1.15],
      [-s * 0.72, s * 1.15],
    ];
  // Isıtıcı (heater) kalkanı: üstü düz, altı sivri
  return [
    [0, -s * 1.25],
    [s * 0.62, -s * 0.55],
    [s * 0.85, s * 0.25],
    [s * 0.85, s * 0.95],
    [-s * 0.85, s * 0.95],
    [-s * 0.85, s * 0.25],
    [-s * 0.62, -s * 0.55],
  ];
}

/**
 * Kalkan: kenarlık (arkada, bir tık büyük) + yüz + arma. Yerel olarak
 * xz düzleminde, ön yüzü +y. `merkez`e taşınıyor.
 */
export function kalkan(
  tip: EsyaTipi,
  s: number,
  renk: string,
  kenar: string,
  arma?: string,
  isik?: string,
): Model {
  const cok = kalkanCokgeni(tip, s);
  const kalin = 0.22;
  // xz düzlemindeki çokgeni y ekseninde kalınlaştır: prizma xy'de kuruluyor,
  // sonra x ekseni etrafında çevriliyor (y → z).
  const plaka = (c: [number, number][], y0: number, h: number, r: string) =>
    dondur(prizma(c, y0, h, r), 'x', Math.PI / 2);
  const buyut = (c: [number, number][], k: number) =>
    c.map(([x, z]): [number, number] => [x * k, z * k]);
  const m = birlestir(
    parlat(plaka(buyut(cok, 1.1), -kalin - 0.12, kalin, kenar), 0.55),
    plaka(cok, -kalin, kalin, renk),
  );
  // Döndürme: prizma xy→ x,-z,y; ön yüz -y'ye düşüyor: aynala
  const on = olcekle(m, [1, -1, 1]);
  if (arma) {
    if (tip === 'yuvarlakKalkan') {
      on.push(...kure(0, 0.28, 0, s * 0.28, arma, 6, 3, 0, undefined, 0.6));
    } else if (tip === 'scutum') {
      // Lejyon kalkanı: ortada altın baklava ve iki kuşak
      on.push(
        ...levha(
          [
            [0, 0.27, s * 0.7],
            [s * 0.45, 0.27, 0],
            [0, 0.27, -s * 0.7],
            [-s * 0.45, 0.27, 0],
          ],
          arma,
        ),
        ...kutu(-s * 0.72, 0.22, s * 0.85, s * 1.44, 0.06, s * 0.14, arma),
        ...kutu(-s * 0.72, 0.22, -s * 0.99, s * 1.44, 0.06, s * 0.14, arma),
      );
    } else {
      // Haç: iki şerit
      const y = 0.25;
      on.push(
        ...kutu(-s * 0.13, y - 0.02, -s * 0.9, s * 0.26, 0.06, s * 1.7, arma),
        ...kutu(-s * 0.6, y - 0.02, s * 0.2, s * 1.2, 0.06, s * 0.26, arma),
      );
    }
  }
  if (isik) {
    const yildiz: V3[] = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      const r = (i % 2 ? 0.25 : 0.62) * s;
      return [Math.cos(a) * r, 0.3, Math.sin(a) * r + s * 0.1];
    });
    on.push({ p: yildiz, renk: isik, isima: 1, ciftYuz: true });
  }
  return on;
}

/** Kılıç: yassı ağız (iki eğimli yüz), balçak, kabza, topuz. Yerel z yukarı. */
export function kilicModeli(uzun: number, renk: string, balcak: string, isik?: string): Model {
  const w = uzun * 0.07;
  const t = w * 0.35;
  // Ağız: baklava kesitli prizma, ucu sivri
  const kesit = (z: number, k: number): V3[] => [
    [-w * k, 0, z],
    [0, t * k, z],
    [w * k, 0, z],
    [0, -t * k, z],
  ];
  const alt = kesit(0, 1);
  const ust = kesit(uzun * 0.86, 0.9);
  const uc: V3 = [0, 0, uzun];
  const m: Model = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    m.push({ p: [alt[i]!, alt[j]!, ust[j]!, ust[i]!], renk });
    m.push({ p: [ust[i]!, ust[j]!, uc], renk });
  }
  // Yüzlerin yönü: dışa baksın
  for (const y of m) {
    const c = y.p.reduce<V3>((s, q) => [s[0] + q[0], s[1] + q[1], s[2] + q[2]], [0, 0, 0]);
    const d: V3 = [c[0], c[1], 0];
    const a = y.p[0]!;
    const b = y.p[1]!;
    const e = y.p[2]!;
    const n: V3 = [
      (b[1] - a[1]) * (e[2] - a[2]) - (b[2] - a[2]) * (e[1] - a[1]),
      (b[2] - a[2]) * (e[0] - a[0]) - (b[0] - a[0]) * (e[2] - a[2]),
      (b[0] - a[0]) * (e[1] - a[1]) - (b[1] - a[1]) * (e[0] - a[0]),
    ];
    if (n[0] * d[0] + n[1] * d[1] < 0) y.p.reverse();
  }
  parlat(m, 0.9);
  if (isik) {
    // Ağız boyunca yanan oluk
    m.push({
      p: [
        [-w * 0.25, t * 0.55, uzun * 0.05],
        [w * 0.25, t * 0.55, uzun * 0.05],
        [w * 0.2, t * 0.5, uzun * 0.8],
        [-w * 0.2, t * 0.5, uzun * 0.8],
      ],
      renk: isik,
      isima: 1,
      ciftYuz: true,
    });
  }
  m.push(...parlat(kutu(-w * 2.6, -t * 1.6, -0.25, w * 5.2, t * 3.2, 0.28, balcak), 0.6));
  m.push(...uzuv([0, 0, -0.25], [0, 0, -uzun * 0.22], w * 0.55, w * 0.5, P.deri, 6));
  m.push(...parlat(kure(0, 0, -uzun * 0.22 - w * 0.5, w * 0.85, balcak, 6, 3), 0.6));
  return m;
}

/** Eli `el`de olan eşya. `yan`: sağ el +1, sol el -1. */
function esyaModeli(e: Esya, el: V3, yan: number): Model {
  const [x, y, z] = el;
  const r = e.renk;
  switch (e.tip) {
    case 'mizrak':
    case 'kargi': {
      const boy = e.tip === 'kargi' ? 12.5 : 11;
      return birlestir(
        uzuv([x, y, z - 4], [x, y, z - 4 + boy], 0.13, 0.11, P.tahta, 5),
        parlat(koni(x, y, z - 4 + boy, 0.3, 1.1, r ?? P.celik, 4), 0.8),
      );
    }
    case 'yaba': {
      const ust = z + 5;
      const m = uzuv([x, y, z - 3.6], [x, y, ust], 0.13, 0.12, P.acikTahta, 5);
      m.push(...parlat(kutu(x - 0.6, y - 0.07, ust - 0.1, 1.2, 0.14, 0.18, P.demir), 0.4));
      for (const dx of [-0.55, 0, 0.55])
        m.push(...parlat(kutu(x + dx - 0.06, y - 0.06, ust, 0.12, 0.12, 1.3, P.demir), 0.4));
      return m;
    }
    case 'kilic':
    case 'hancer': {
      const boy = e.tip === 'hancer' ? 2 : 3.8;
      // Önde, ucu yukarı-ileri
      const k = kilicModeli(boy, r ?? P.celik, e.ikinci ?? P.koyuAltin, e.isik);
      return tasi(dondur(k, 'x', -0.35), [x, y + 0.1, z + 0.2]);
    }
    case 'balta':
    case 'ciftBalta': {
      const boy = e.tip === 'ciftBalta' ? 6 : 4.6;
      const m = uzuv([x, y, z - 1.4], [x, y, z - 1.4 + boy], 0.14, 0.12, P.koyuTahta, 5);
      const bz = z - 1.4 + boy - 0.9;
      const agiz = (s: number): [number, number][] => [
        [0, -0.2],
        [s * 1.6, -0.75],
        [s * 1.75, 0.35],
        [s * 1.6, 1.0],
        [0, 0.3],
      ];
      const plaka = (c: [number, number][]) =>
        parlat(dondur(prizma(c, -0.09, 0.18, r ?? P.celik), 'x', Math.PI / 2), 0.8);
      // yana: -x yönünde (figürün dışı değil, önü: y)
      m.push(...tasi(dondur(plaka(agiz(1)), 'z', yan > 0 ? Math.PI / 2 : Math.PI / 2), [x, y, bz]));
      if (e.tip === 'ciftBalta')
        m.push(...tasi(dondur(plaka(agiz(1)), 'z', -Math.PI / 2), [x, y, bz]));
      return m;
    }
    case 'cekic': {
      const m = uzuv([x, y, z - 1.2], [x, y, z + 3.4], 0.13, 0.12, P.koyuTahta, 5);
      m.push(...parlat(kutu(x - 0.45, y - 0.8, z + 3.1, 0.9, 1.6, 0.9, r ?? P.demir), 0.5));
      return m;
    }
    case 'asa': {
      const m = uzuv([x, y, z - 4.2], [x, y, z + 4.2], 0.14, 0.12, r ?? P.koyuTahta, 5);
      m.push(...parlat(koni(x, y, z + 4.2, 0.45, 0.6, e.ikinci ?? P.koyuAltin, 5, 0.3)));
      const tas = kure(x, y, z + 5.2, 0.5, e.isik ?? P.buyu, 6, 3);
      for (const f of tas) f.isima = 1;
      m.push(...tas);
      return m;
    }
    case 'fener': {
      const m = uzuv([x, y, z], [x, y + 0.2, z - 0.9], 0.05, 0.05, P.demir, 4);
      const fz = z - 2.2;
      m.push(...kutu(x - 0.45, y - 0.25, fz, 0.9, 0.9, 0.18, P.demir));
      m.push(...kutu(x - 0.45, y - 0.25, fz + 1.1, 0.9, 0.9, 0.18, P.demir));
      m.push(...koni(x, y + 0.2, fz + 1.28, 0.55, 0.4, P.demir, 4));
      const ic = kutu(x - 0.35, y - 0.15, fz + 0.18, 0.7, 0.7, 0.92, e.isik ?? P.buyu);
      for (const f of ic) f.isima = 1;
      m.push(...ic);
      return m;
    }
    case 'kalkan':
    case 'yuvarlakKalkan':
    case 'scutum': {
      const s = e.tip === 'yuvarlakKalkan' ? 1.35 : e.tip === 'scutum' ? 1.55 : 1.6;
      const k = kalkan(e.tip, s, r ?? P.bez, P.demir, e.ikinci, e.isik);
      // Ön kolda, gövdenin önünde, bir tık dışa dönük
      return tasi(dondur(k, 'z', yan * -0.25), [x + yan * 0.15, y + 0.7, z + 0.4]);
    }
    case 'sancak': {
      // Bez direkten DIŞA açılıyor: ortalı bez taşıyanın yüzünü kapatıyordu.
      const ust = z + 6.5;
      const d = yan > 0 ? 0 : -2.8;
      const bx = x + d + 1.4;
      const m = uzuv([x, y, z - 4], [x, y, ust], 0.12, 0.1, P.koyuTahta, 5);
      m.push(...kutu(x + d, y - 0.06, ust - 0.5, 2.8, 0.12, 0.14, P.koyuTahta));
      m.push(...parlat(koni(x, y, ust, 0.25, 0.7, P.altin, 5)));
      m.push(
        ...levha(
          [
            [bx - 1.3, y + 0.05, ust - 0.5],
            [bx + 1.3, y + 0.05, ust - 0.5],
            [bx + 1.3, y + 0.05, ust - 3.6],
            [bx, y + 0.05, ust - 3],
            [bx - 1.3, y + 0.05, ust - 3.6],
          ],
          r ?? P.kirmiziBez,
        ),
      );
      if (e.ikinci)
        m.push(
          ...levha(
            [
              [bx, y + 0.1, ust - 1.0],
              [bx + 0.6, y + 0.1, ust - 1.7],
              [bx, y + 0.1, ust - 2.4],
              [bx - 0.6, y + 0.1, ust - 1.7],
            ],
            e.ikinci,
          ),
        );
      return m;
    }
    case 'kitap': {
      const m = kutu(x - 0.55, y + 0.05, z - 0.1, 1.1, 0.4, 1.4, r ?? '#6a2a22');
      m.push(...kutu(x - 0.5, y + 0.12, z - 0.05, 1.0, 0.3, 1.3, P.bez));
      m.push(...kutu(x - 0.58, y + 0.02, z - 0.12, 0.12, 0.46, 1.44, r ?? '#6a2a22'));
      return m;
    }
    case 'tomar': {
      const m = uzuv([x - 0.9, y + 0.3, z + 0.3], [x + 0.9, y + 0.3, z + 0.3], 0.2, 0.2, P.bez, 6);
      m.push(
        ...levha(
          [
            [x - 0.8, y + 0.42, z + 0.25],
            [x + 0.8, y + 0.42, z + 0.25],
            [x + 0.75, y + 0.5, z - 1.3],
            [x - 0.75, y + 0.5, z - 1.3],
          ],
          '#e2d8c0',
        ),
      );
      return m;
    }
    case 'hac': {
      const m = uzuv([x, y, z - 4.2], [x, y, z + 3.4], 0.13, 0.11, r ?? P.koyuTahta, 5);
      const altin = e.ikinci ?? P.koyuAltin;
      m.push(...parlat(kutu(x - 0.9, y - 0.12, z + 2.4, 1.8, 0.24, 0.28, altin)));
      m.push(...parlat(kutu(x - 0.14, y - 0.12, z + 3.4, 0.28, 0.24, 0.7, altin)));
      return m;
    }
    case 'yay': {
      // Dikey yay: el ortasında, uçlar geriye kıvrık
      const m: Model = [];
      const n = 6;
      const nokta3 = (i: number): V3 => {
        const t = i / n - 0.5;
        return [x, y - Math.abs(t) * 1.6 + 0.3, z + t * 5.2];
      };
      for (let i = 0; i < n; i++)
        m.push(...cubuk(nokta3(i), nokta3(i + 1), 0.18, r ?? P.koyuTahta));
      const a = nokta3(0);
      const b = nokta3(n);
      m.push({
        p: [
          [a[0], a[1] - 0.02, a[2]],
          [b[0], b[1] - 0.02, b[2]],
          [b[0], b[1] + 0.02, b[2]],
          [a[0], a[1] + 0.02, a[2]],
        ],
        renk: P.bez,
        ciftYuz: true,
      });
      return m;
    }
  }
}

/* ── İnsan ─────────────────────────────────────────────────────────── */

export function insan(f: Insan): Model {
  const m: Model = [];
  const iri = f.iri ?? (f.kadin ? 0.92 : 1);
  const etek = f.etek ?? f.govde;
  const kolRenk = f.kol ?? f.govde;
  const kemer = f.kemer ?? P.deri;

  // Bacaklar ve çizmeler
  if (f.oturan) {
    for (const s of [-1, 1]) {
      const diz: V3 = [s * 1.35, 1.3, 2.9];
      const ayak: V3 = [s * 1.45, 1.1, 1.0];
      m.push(...uzuv([s * 0.5, 0, 3.2], diz, 0.42, 0.36, f.bacak, 6));
      m.push(...uzuv(diz, ayak, 0.34, 0.3, f.cizme, 6));
      m.push(...kutu(ayak[0] - 0.35, ayak[1] - 0.3, ayak[2] - 0.5, 0.7, 1.0, 0.55, f.cizme));
    }
  } else if (f.elbise) {
    for (const x of [-0.45, 0.45]) m.push(...kutu(x - 0.38, -0.2, 0, 0.76, 1.1, 0.5, f.cizme));
  } else
    for (const x of [-0.52, 0.52]) {
      m.push(...kutu(x - 0.42, -0.45, 0, 0.84, 1.05, 0.8, f.cizme));
      m.push(...uzuv([x, 0, 0.7], [x, 0, 3.3], 0.36, 0.42, f.bacak, 6));
    }
  // Etek ve gövde (yassı kesik koniler)
  const yassi = (mm: Model) => olcekle(mm, [iri, 0.62, 1]);
  if (f.elbise) m.push(...yassi(koni(0, 0, 0.3, 1.5, 3.55, etek, 8, 1.03)));
  else if (!f.oturan) m.push(...yassi(koni(0, 0, 2.5, 1.28, 1.35, etek, 8, 1.02)));
  else m.push(...yassi(koni(0, 0, 3.0, 1.1, 0.85, etek, 8, 1.02)));
  const govdeRenk = f.zirh ? f.zirh.renk : f.govde;
  const govde = yassi(koni(0, 0, 3.8, 1.02, 2.45, govdeRenk, 8, 1.3));
  // Metal zırh ışığı yakalar; deri ve bez mat kalır.
  const zirhParlak = f.zirh ? ZIRH_PARLAK[f.zirh.tip] : 0;
  m.push(...(zirhParlak ? parlat(govde, zirhParlak) : govde));
  if (f.zirh?.tip === 'serit')
    for (let k = 0; k < 4; k++)
      m.push(
        ...parlat(
          yassi(
            koni(
              0,
              0,
              4.0 + k * 0.52,
              1.07 + k * 0.06,
              0.12,
              isikla(f.zirh.renk, 0.72),
              8,
              1.1 + k * 0.06,
            ),
          ),
          zirhParlak,
        ),
      );
  if (f.zirh?.tip === 'zincir')
    for (let k = 0; k < 3; k++)
      m.push(
        ...parlat(
          yassi(
            koni(
              0,
              0,
              4.2 + k * 0.62,
              1.07 + k * 0.08,
              0.06,
              isikla(f.zirh.renk, 0.8),
              8,
              1.1 + k * 0.08,
            ),
          ),
          zirhParlak,
        ),
      );
  if (f.tabard) {
    m.push(...kutu(-0.62 * iri, 0.55, 2.6, 1.24 * iri, 0.12, 3.5, f.tabard));
    m.push(...kutu(-0.62 * iri, -0.67, 2.6, 1.24 * iri, 0.12, 3.5, f.tabard));
  }
  m.push(...yassi(silindir(0, 0, 3.62, 1.1, 0.38, kemer, 8)));
  m.push(...kutu(-0.24, 0.62, 3.62, 0.48, 0.1, 0.38, P.koyuAltin));
  if (f.pelerin) {
    m.push({
      p: [
        [-1.3 * iri, -0.78, 6.1],
        [1.3 * iri, -0.78, 6.1],
        [1.65 * iri, -1.05, 1.2],
        [-1.65 * iri, -1.05, 1.2],
      ],
      renk: f.pelerin,
      ciftYuz: true,
    });
  }
  if (f.sadak) {
    // Sırtta, sağ omuzdan sola eğik kılıf; ağzından üç ok çubuğu.
    const alt: V3 = [-0.5, -0.95, 3.6];
    const ust: V3 = [0.7, -0.95, 6.3];
    m.push(...uzuv(alt, ust, 0.38, 0.42, P.deri, 6));
    for (const d of [-0.18, 0, 0.18])
      m.push(
        ...uzuv(
          [ust[0] + d, ust[1], ust[2]],
          [ust[0] + d + 0.35, ust[1], ust[2] + 1.0],
          0.07,
          0.07,
          P.acikTahta,
          4,
        ),
      );
  }

  // Omuzlar, boyun, baş
  const omuzX = 1.28 * iri;
  const omuzRenk = f.omuz ?? kolRenk;
  for (const s of [-1, 1]) {
    const omuz = kure(s * omuzX, 0, 5.95, f.omuz ? 0.62 : 0.5, omuzRenk, 6, 3);
    // Zırhlının omuzluğu da metal.
    m.push(...(f.omuz && zirhParlak ? parlat(omuz, zirhParlak) : omuz));
  }
  if (f.kurk) {
    m.push(
      ...olcekle(
        kure(0, 0, 6.05, 1.35, f.kurk, 8, 3, 0.15, rastgele('kurk:' + f.kurk), 0.45),
        [iri, 0.7, 1],
        [0, 0, 6.05],
      ),
    );
  }
  m.push(...silindir(0, 0.02, 6.1, 0.34, 0.5, f.ten, 6));
  const bz = 7.1;
  // Baş: önü DÜZ sekizgen gövde (çene → şakak → tepe). Küre kafa önden
  // bir kenara oturuyor, yüz gaga gibi sivri duruyordu; düz ön yüzde göz
  // ve burun okunuyor.
  m.push(...uzuv([0, 0.06, bz - 0.85], [0, 0.06, bz - 0.25], 0.5, 0.74, f.ten, 8));
  m.push(...uzuv([0, 0.06, bz - 0.25], [0, 0.06, bz + 0.45], 0.74, 0.8, f.ten, 8));
  m.push(...koni(0, 0.06, bz + 0.45, 0.8, 0.42, f.ten, 8, 0.4));
  m.push(...yuz(f, bz));
  if (f.sakal) {
    m.push(
      ...olcekle(
        kure(0, 0.42, bz - 0.55, 0.62, f.sakal, 6, 3),
        [1, 0.7, 1.2],
        [0, 0.42, bz - 0.55],
      ),
    );
  }
  if (f.sac && !(f.baslik && f.baslik.tip !== 'bant')) {
    // Saç başın DIŞINDA bir kabuk: eski küre başla aynı boydaydı, başın
    // içinde kalıyor, figür kel görünüyor, tepede bir leke kalıyordu. Alın
    // açık (saç çizgisi kaşın üstünde); erkekte şakaktan aşağısı kesik,
    // kulak görünüyor; kadında saç iki yandan iniyor.
    const kadin = !!f.kadin;
    m.push(
      ...oneAl(
        suz(
          kure(0, -0.02, bz + 0.1, 0.94, f.sac, 8, 5),
          ([, y, z]) =>
            z > bz + 0.42 ||
            (y < 0.25 && z > bz + 0.14) ||
            (y < -0.3 && z > bz - 0.6) ||
            (kadin && y < 0.3),
        ),
        0.35,
      ),
    );
    // Uzun saç: enseden omuz aşağısına, arkada tek örgü gibi
    if (f.kadin) m.push(...uzuv([0, -0.45, bz + 0.1], [0, -0.85, 4.9], 0.72, 0.42, f.sac, 7));
  }
  if (f.baslik) m.push(...baslik(f.baslik.tip, f.baslik.renk, f.baslik.ikinci, bz));

  // Kollar ve eşyalar
  const omuzSag: V3 = [omuzX, 0, 5.8];
  const omuzSol: V3 = [-omuzX, 0, 5.8];
  let elSag: V3 = [omuzX + 0.2, 0.35, 3.9];
  let elSol: V3 = [-omuzX - 0.2, 0.35, 3.9];
  if (
    f.sag &&
    ['mizrak', 'kargi', 'yaba', 'asa', 'sancak', 'cekic', 'balta', 'ciftBalta', 'hac'].includes(
      f.sag.tip,
    )
  )
    elSag = [omuzX + 0.35, 0.75, 4.4];
  if (f.sag && (f.sag.tip === 'kilic' || f.sag.tip === 'hancer')) elSag = [omuzX + 0.1, 1.0, 4.3];
  if (f.sol && ['kalkan', 'yuvarlakKalkan', 'scutum'].includes(f.sol.tip))
    elSol = [-omuzX - 0.1, 0.8, 4.6];
  if (f.sol?.tip === 'fener') elSol = [-omuzX - 0.35, 0.9, 4.6];
  if (f.sol?.tip === 'kitap' || f.sol?.tip === 'tomar') elSol = [-0.7, 1.3, 4.7];
  if (f.sag?.tip === 'tomar') elSag = [0.7, 1.3, 4.7];
  if (f.poz === 'nisan') {
    elSol = [-omuzX - 0.6, 2.4, 5.8];
    elSag = [-0.1, 1.0, 5.85];
  }
  if (f.poz === 'kaldir') elSag = [omuzX + 0.4, 0.5, 7.4];
  // Plaka zırhlının eli demir eldiven; öbürleri çıplak.
  const eldiven = f.zirh?.tip === 'plaka' ? f.zirh.renk : undefined;
  const elAyari: ElAyari = {
    renk: eldiven ? isikla(eldiven, 0.8) : f.ten,
    parlak: eldiven ? 0.45 : undefined,
    yen: kolRenk === f.ten ? undefined : isikla(kolRenk, 0.82),
  };
  m.push(...kol(omuzSag, elSag, kolRenk, elAyari, 1));
  m.push(...kol(omuzSol, elSol, kolRenk, elAyari, -1));
  if (f.sag) m.push(...esyaModeli(f.sag, elSag, 1));
  if (f.sol) m.push(...esyaModeli(f.sol, elSol, -1));
  return m;
}

function baslik(tip: BaslikTipi, renk: string, ikinci: string | undefined, bz: number): Model {
  const m: Model = [];
  switch (tip) {
    case 'kukuleta':
      m.push(
        ...suz(
          kure(0, -0.12, bz + 0.05, 1.02, renk, 8, 4),
          ([, y, z]) => y < 0.35 || z > bz + 0.65,
        ),
      );
      m.push(...olcekle(koni(0, -0.4, 5.6, 1.35, 1.2, renk, 8, 0.8), [1, 0.75, 1], [0, -0.4, 5.6]));
      break;
    case 'bant':
      m.push(...silindir(0, 0.04, bz + 0.3, 0.84, 0.28, renk, 8));
      break;
    case 'bone':
      m.push(...silindir(0, 0.02, bz + 0.35, 0.9, 0.7, renk, 8));
      m.push(...kubbe(0, 0.02, bz + 1.05, 0.9, isikla(renk, 1.1), 8, 2));
      break;
    case 'migfer':
    case 'boynuz':
    case 'sorguc':
      m.push(
        ...parlat(
          birlestir(
            kubbe(0, 0.04, bz + 0.2, 0.92, renk, 8, 3),
            silindir(0, 0.04, bz + 0.12, 0.98, 0.16, isikla(renk, 0.85), 8),
            kutu(-0.09, 0.86, bz - 0.55, 0.18, 0.14, 0.8, isikla(renk, 0.85)),
          ),
          0.75,
        ),
      );
      if (tip === 'boynuz')
        for (const s of [-1, 1]) {
          const a: V3 = [s * 0.8, 0, bz + 0.6];
          const b: V3 = [s * 1.5, 0.05, bz + 1.1];
          const c: V3 = [s * 1.6, 0.1, bz + 1.9];
          m.push(
            ...uzuv(a, b, 0.24, 0.18, ikinci ?? P.kemik, 5),
            ...uzuv(b, c, 0.18, 0.04, ikinci ?? P.kemik, 5),
          );
        }
      if (tip === 'sorguc') {
        m.push(...kutu(-0.14, -0.9, bz + 0.95, 0.28, 1.8, 0.7, ikinci ?? P.kirmiziBez));
      }
      break;
    case 'kapali':
      m.push(
        ...parlat(
          birlestir(
            silindir(0, 0.04, bz - 0.75, 0.9, 1.4, renk, 8),
            kubbe(0, 0.04, bz + 0.65, 0.9, renk, 8, 2),
          ),
          0.75,
        ),
      );
      m.push(...kutu(-0.6, 0.8, bz + 0.05, 1.2, 0.14, 0.14, KARA));
      m.push(...kutu(-0.07, 0.8, bz - 0.6, 0.14, 0.14, 0.62, KARA));
      if (ikinci) m.push(...koni(0, 0, bz + 1.4, 0.3, 1.6, ikinci, 5));
      break;
    case 'sapka':
      m.push(...silindir(0, 0.04, bz + 0.45, 1.45, 0.12, renk, 10));
      m.push(...koni(0, 0.04, bz + 0.55, 0.85, 0.8, renk, 8, 0.65));
      m.push(
        ...levha(
          [
            [0.6, -0.4, bz + 0.9],
            [1.3, -1.1, bz + 2.4],
            [0.9, -0.9, bz + 2.5],
          ],
          ikinci ?? P.kirmiziBez,
        ),
      );
      break;
    case 'maske': {
      // Altın boynuzlu maske + başlık
      m.push(
        ...suz(kure(0, -0.1, bz + 0.05, 1.02, renk, 8, 4), ([, y, z]) => y < 0.35 || z > bz + 0.65),
      );
      m.push(
        ...parlat(
          olcekle(kure(0, 0.2, bz, 0.78, ikinci ?? P.altin, 6, 3), [1, 0.8, 1.1], [0, 0.2, bz]),
        ),
      );
      for (const s of [-1, 1]) {
        const goz = kutu(s * 0.3 - 0.09, 0.82, bz + 0.05, 0.18, 0.06, 0.12, P.buyu);
        for (const y of goz) y.isima = 1;
        m.push(...goz);
        m.push(
          ...uzuv(
            [s * 0.5, 0.2, bz + 0.6],
            [s * 0.9, 0.1, bz + 2.2],
            0.2,
            0.03,
            ikinci ?? P.altin,
            5,
          ),
        );
      }
      break;
    }
  }
  return m;
}

/* ── At ────────────────────────────────────────────────────────────── */

export interface AtAyari {
  renk: string;
  yele: string;
  eyer?: string;
  ortu?: string;
  zirh?: string;
  alev?: boolean;
}

/** At: uzun ekseni +x, başı +x yanında. Sırt ~5.2 yüksekte. */
export function at(a: AtAyari): Model {
  const m: Model = [];
  const govde = olcekle(kure(0, 0, 4.25, 1, a.renk, 8, 4), [2.55, 1.02, 1.05], [0, 0, 4.25]);
  m.push(...govde);
  // Bacaklar: diz bükük değil, dimdik; ince alt bacak, koyu toynak
  for (const [x, y] of [
    [1.7, 0.55],
    [1.7, -0.55],
    [-1.75, 0.55],
    [-1.75, -0.55],
  ] as [number, number][]) {
    m.push(...uzuv([x, y, 3.9], [x + 0.05, y, 1.9], 0.42, 0.26, a.renk, 6));
    m.push(...uzuv([x + 0.05, y, 1.9], [x, y, 0.35], 0.24, 0.2, isikla(a.renk, 0.92), 5));
    m.push(...kutu(x - 0.28, y - 0.26, 0, 0.56, 0.52, 0.38, '#2a221c'));
  }
  // Boyun ve baş
  m.push(...uzuv([1.8, 0, 4.7], [2.9, 0, 6.7], 0.95, 0.62, a.renk, 7));
  m.push(...uzuv([2.75, 0, 7.05], [4.15, 0, 6.0], 0.55, 0.36, a.renk, 6));
  m.push(...kutu(3.95, -0.34, 5.7, 0.5, 0.68, 0.5, isikla(a.renk, 0.8)));
  for (const s of [-1, 1]) m.push(...koni(2.8, s * 0.3, 7.35, 0.18, 0.7, a.renk, 4));
  for (const s of [-1, 1]) m.push(...kutu(3.35, s * 0.47 - 0.05, 6.75, 0.2, 0.1, 0.18, KARA));
  // Yele ve kuyruk
  m.push(
    ...uzuv([1.7, 0, 5.5], [2.65, 0, 7.4], 0.32, 0.25, a.yele, 5).map((y) => ({
      ...y,
      p: y.p.map((q): V3 => [q[0] - 0.3, q[1], q[2] + 0.25]),
    })),
  );
  m.push(...uzuv([-2.45, 0, 4.9], [-3.25, 0, 2.6], 0.38, 0.14, a.yele, 5));
  if (a.alev) {
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const f = koni(1.5 + t * 1.1, 0, 5.7 + t * 1.9, 0.32, 1.2, i % 2 ? P.ates : P.kor, 5);
      for (const y of f) y.isima = 1;
      m.push(...f);
    }
    const kuyruk = koni(-3.1, 0, 2.2, 0.35, 1.3, P.ates, 5);
    for (const y of kuyruk) y.isima = 1;
    m.push(...kuyruk);
  }
  if (a.ortu) {
    m.push(...kutu(-2.3, -1.12, 3.15, 4.3, 2.24, 1.5, a.ortu));
    m.push(...kutu(-2.35, -1.16, 3.1, 4.4, 2.32, 0.2, isikla(a.ortu, 1.2)));
  }
  if (a.eyer) {
    m.push(...kutu(-1.05, -1.08, 4.7, 1.7, 2.16, 0.55, a.ortu ? isikla(a.ortu, 0.8) : P.maviBez));
    m.push(...kutu(-0.85, -0.7, 5.2, 1.4, 1.4, 0.35, a.eyer));
    m.push(...kutu(0.35, -0.3, 5.5, 0.25, 0.6, 0.45, a.eyer));
  }
  if (a.zirh) {
    const zirh: Model = kutu(3.2, -0.42, 6.35, 1.05, 0.84, 0.3, a.zirh);
    zirh.push(
      ...uzuv([2.0, 0, 5.3], [2.75, 0, 6.8], 0.7, 0.55, a.zirh, 6).map((y) => ({
        ...y,
        p: y.p.map((q): V3 => [q[0] - 0.2, q[1], q[2] + 0.12]),
      })),
    );
    zirh.push(...kutu(1.9, -1.0, 3.4, 0.7, 2.0, 1.6, a.zirh));
    m.push(...parlat(zirh, 0.7));
  }
  return m;
}

/* ── Mancınık ──────────────────────────────────────────────────────── */

export function mancinik(): Model {
  const m: Model = [];
  const t = P.tahta;
  const k = P.koyuTahta;
  for (const y of [-1.4, 0.9]) m.push(...kutu(-3.2, y, 0.7, 6.4, 0.5, 0.55, t));
  for (const x of [-2.8, -0.3, 2.3]) m.push(...kutu(x, -1.5, 1.25, 0.5, 3, 0.4, k));
  for (const x of [-2.3, 2.3])
    for (const y of [-1.65, 1.65]) m.push(...teker(x, y, 0.75, 0.75, 'y', k, 8));
  // A çatkılar
  for (const y of [-1.15, 1.15]) {
    m.push(...cubuk([-1.1, y, 1.2], [0.1, y, 4.0], 0.35, t));
    m.push(...cubuk([1.3, y, 1.2], [0.1, y, 4.0], 0.35, t));
  }
  m.push(...cubuk([0.1, -1.4, 4.0], [0.1, 1.4, 4.0], 0.4, k));
  // Burulma demeti ve kol
  m.push(
    ...dondur(silindir(0, 0, 0, 0.45, 2.4, '#5a4a3a', 8), 'x', Math.PI / 2).map((y) => ({
      ...y,
      p: y.p.map((q): V3 => [q[0] - 1.2, q[1] + 1.2, q[2] + 1.55]),
    })),
  );
  m.push(...cubuk([-1.3, 0, 1.55], [0.6, 0, 4.3], 0.38, t));
  m.push(...cubuk([0.6, 0, 4.3], [1.7, 0, 5.1], 0.34, t));
  // Kepçe ve taş
  m.push(...kutu(1.4, -0.55, 5.0, 1.1, 1.1, 0.45, k));
  m.push(...kure(1.95, 0, 5.8, 0.55, P.kaya, 6, 3));
  return m;
}
