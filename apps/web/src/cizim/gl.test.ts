import { describe, expect, it } from 'vitest';
import { arazi } from './arazi';
import { DUNYA_KAMERASI, DUNYA_KUTUSU, dunyaModeli, dunyaUcgenleri } from './dunya';
import { KOSE, agYap } from './glAg';
import { goruntuMatrisi } from './glCizici';
import { rastgele } from './rastgele';
import {
  IZOMETRIK,
  kameraTabani,
  kutu,
  levha,
  normal,
  olcekle,
  yansitici,
  type Model,
  type V3,
  type Yuz,
} from './uc';

const ucgenSayisi = (f: Float32Array) => f.length / KOSE / 3;
const nokta = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Tampondaki `i`. köşenin bir alanı. */
const kose = (f: Float32Array, i: number) => ({
  konum: [f[i * KOSE]!, f[i * KOSE + 1]!, f[i * KOSE + 2]!] as V3,
  normal: [f[i * KOSE + 3]!, f[i * KOSE + 4]!, f[i * KOSE + 5]!] as V3,
  renk: [f[i * KOSE + 6]!, f[i * KOSE + 7]!, f[i * KOSE + 8]!],
  ek: [f[i * KOSE + 9]!, f[i * KOSE + 10]!, f[i * KOSE + 11]!],
  su: [f[i * KOSE + 13]!, f[i * KOSE + 14]!, f[i * KOSE + 15]!, f[i * KOSE + 16]!],
  kum: [f[i * KOSE + 17]!, f[i * KOSE + 18]!, f[i * KOSE + 19]!],
});

const { c } = kameraTabani();
/** Kameraya dönük tek üçgen (üstten bakan yatay yüz). */
const ustUcgen = (ek: Partial<Yuz> = {}): Yuz => ({
  p: [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ],
  renk: '#000000',
  ...ek,
});

describe('GPU ağı (agYap)', () => {
  it('küp: üç yüz görünüyor (6 üçgen), gölgeye altı yüz birden (12 üçgen)', () => {
    const ag = agYap(kutu(0, 0, 0, 1, 1, 1, '#808080'));
    expect(ucgenSayisi(ag.nesne)).toBe(6);
    expect(ag.golge.length / 9).toBe(12);
    expect(ag.yer.length).toBe(0);
    expect(ag.saydam.length).toBe(0);
    expect(ag.enAz).toEqual([0, 0, 0]);
    expect(ag.enCok).toEqual([1, 1, 1]);
  });

  it('normaller birim ve bakana dönük', () => {
    const ag = agYap(kutu(0, 0, 0, 1, 1, 1, '#808080'));
    for (let i = 0; i < ucgenSayisi(ag.nesne) * 3; i++) {
      const { normal: n } = kose(ag.nesne, i);
      expect(Math.hypot(...n)).toBeCloseTo(1, 5);
      expect(nokta(n, c)).toBeGreaterThan(0);
    }
  });

  it('arkası dönük ince levha çevriliyor: köşe sırası ters, normal eksi', () => {
    const p: V3[] = [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ];
    expect(nokta(normal(p), c)).toBeLessThan(0);
    const ag = agYap(levha(p, '#808080'));
    expect(ucgenSayisi(ag.nesne)).toBe(2);
    for (let t = 0; t < 2; t++) {
      const u = [0, 1, 2].map((j) => kose(ag.nesne, t * 3 + j).konum);
      expect(nokta(normal(u), c)).toBeGreaterThan(0);
      expect(nokta(kose(ag.nesne, t * 3).normal, c)).toBeGreaterThan(0);
    }
    // İki yüzlü olmayan aynı yüz atılıyor.
    expect(agYap([{ p, renk: '#808080' }]).nesne.length).toBe(0);
  });

  it('yer katmanı ressam sırasıyla, nesne ve saydam ayrı tamponda', () => {
    const yukari = (z: number): V3[] => [
      [0, 0, z],
      [1, 0, z],
      [0, 1, z],
    ];
    const m: Model = [
      { p: yukari(0.2), renk: '#00ff00', katman: -1 },
      { p: yukari(0), renk: '#ff0000', katman: -2 },
      { p: yukari(1), renk: '#0000ff' },
      { p: yukari(2), renk: '#ffffff', saydam: 0.5 },
    ];
    const ag = agYap(m);
    expect(ucgenSayisi(ag.yer)).toBe(2);
    expect(ucgenSayisi(ag.nesne)).toBe(1);
    expect(ucgenSayisi(ag.saydam)).toBe(1);
    // Önce -2 (kırmızı), sonra -1 (yeşil) — eklenme sırası tersine olsa da.
    expect(kose(ag.yer, 0).renk).toEqual([1, 0, 0]);
    expect(kose(ag.yer, 3).renk).toEqual([0, 1, 0]);
    expect(kose(ag.saydam, 0).ek[1]).toBe(0.5);
    // Gölgeyi yalnız dolu nesne düşürüyor.
    expect(ag.golge.length / 9).toBe(1);
  });

  it('köşe normali, rengi ve suyu köşe başına taşınıyor; suyu olmayanda derinlik -9', () => {
    const n1: V3 = [0, 0, 1];
    const n2: V3 = [0.6, 0, 0.8];
    const n3: V3 = [0, 0.6, 0.8];
    const ag = agYap([
      ustUcgen({
        vn: [n1, n2, n3],
        vr: ['#ff0000', '#00ff00', '#0000ff'],
        su: { d: [1, -1, 0.5], renk: ['#ffffff', '#000000', '#ff0000'], kum: '#00ff00' },
      }),
      ustUcgen({ renk: '#808080' }),
    ]);
    const [a, b, d] = [0, 1, 2].map((i) => kose(ag.nesne, i));
    expect(a!.normal).toEqual(n1);
    expect(b!.normal.map((x) => +x.toFixed(5))).toEqual(n2);
    expect(a!.renk).toEqual([1, 0, 0]);
    expect(d!.renk).toEqual([0, 0, 1]);
    expect(a!.su).toEqual([1, 1, 1, 1]);
    expect(b!.su[3]).toBe(-1);
    expect(a!.kum).toEqual([0, 1, 0]);
    expect(kose(ag.nesne, 3).su[3]).toBe(-9);
  });

  it('aynalamada köşe normali, rengi ve suyu köşeyle birlikte dönüyor', () => {
    const y = ustUcgen({
      vn: [
        [0, 0, 1],
        [0.6, 0, 0.8],
        [0, 0.6, 0.8],
      ],
      vr: ['#ff0000', '#00ff00', '#0000ff'],
      su: { d: [1, 2, 3], renk: ['#ff0000', '#00ff00', '#0000ff'], kum: '#808080' },
    });
    const [a] = olcekle([y], [-1, 1, 1]);
    expect(a!.p[0]).toEqual([0, 1, 0]);
    expect(a!.vr).toEqual(['#0000ff', '#00ff00', '#ff0000']);
    expect(a!.su!.d).toEqual([3, 2, 1]);
    expect(a!.su!.kum).toBe('#808080');
    // Normal x'te aynalanıyor ve köşesiyle yer değiştiriyor.
    expect(a!.vn![1]!.map((x) => +x.toFixed(5))).toEqual([-0.6, 0, 0.8]);
    expect(a!.vn![0]!.map((x) => +x.toFixed(5))).toEqual([0, 0.6, 0.8]);
  });
});

describe('GPU ve SVG aynı izdüşümü kullanıyor', () => {
  it.each([
    ['izometrik', IZOMETRIK],
    ['dünya (tepeden)', DUNYA_KAMERASI],
  ] as const)('%s: dünya noktası iki yolda aynı ekran noktasına düşüyor', (_, kamera) => {
    const kutu4: [number, number, number, number] = [-20, -30, 60, 50];
    const m = goruntuMatrisi(kamera, kutu4, [-100, 100]);
    const ekran = yansitici(kamera);
    for (const q of [
      [0, 0, 0],
      [3, -7, 2],
      [12, 5, -4],
    ] as V3[]) {
      // Sütun sıralı matris: kırpma = M · q.
      const x = m[0]! * q[0] + m[4]! * q[1] + m[8]! * q[2] + m[12]!;
      const y = m[1]! * q[0] + m[5]! * q[1] + m[9]! * q[2] + m[13]!;
      const [sx, sy] = ekran(q);
      expect(kutu4[0] + ((x + 1) / 2) * kutu4[2]).toBeCloseTo(sx, 6);
      expect(kutu4[1] + ((1 - y) / 2) * kutu4[3]).toBeCloseTo(sy, 6);
    }
  });
});

describe('arazinin köşe verileri', () => {
  it('su varsa her üçgen su derinliğini, rengini ve kara rengini köşe başına taşıyor', () => {
    const m = arazi({
      cerceve: [-40, -40, 80, 80],
      adim: 4,
      h: (x) => x * 0.1,
      renk: () => '#5f7f3a',
      su: 0,
      r: rastgele('gl-test'),
    });
    let alt = 0;
    let ust = 0;
    for (const y of m) {
      expect(y.vr).toHaveLength(y.p.length);
      expect(y.su!.d).toHaveLength(y.p.length);
      expect(y.su!.renk).toHaveLength(y.p.length);
      y.su!.d.forEach((d, i) => {
        // Suyun altındaki köşe su yüzüne çekilmiş.
        if (d > 0) {
          expect(y.p[i]![2]).toBe(0);
          alt++;
        } else ust++;
      });
    }
    expect(alt).toBeGreaterThan(0);
    expect(ust).toBeGreaterThan(0);
  });

  it('su yoksa su verisi de yok', () => {
    const m = arazi({
      cerceve: [-20, -20, 40, 40],
      adim: 4,
      h: () => 1,
      renk: () => '#5f7f3a',
      r: rastgele('gl-test'),
    });
    expect(m.every((y) => !y.su && y.vr?.length === y.p.length)).toBe(true);
  });
});

describe('dünya zemini GPU modeli', () => {
  const kaba = dunyaModeli(4);

  it('bütün yüzler tepeden bakan kameraya dönük: hiçbiri atılmıyor', () => {
    const ag = agYap(kaba, DUNYA_KAMERASI);
    const toplam = kaba.reduce((t, y) => t + y.p.length - 2, 0);
    expect(ucgenSayisi(ag.yer)).toBe(toplam);
    expect(ag.nesne.length).toBe(0);
  });

  it('görüş kutusu haritanın kendisi; köşeler içinde', () => {
    const ekran = yansitici(DUNYA_KAMERASI);
    const [x0, y0, w, h] = DUNYA_KUTUSU;
    for (const y of kaba)
      for (const q of y.p) {
        const [sx, sy] = ekran(q);
        expect(sx).toBeGreaterThan(x0 - 2);
        expect(sx).toBeLessThan(x0 + w + 2);
        expect(sy).toBeGreaterThan(y0 - 2);
        expect(sy).toBeLessThan(y0 + h + 2);
      }
  });

  it('kıyı uzaklığı: hem kara hem deniz var, değerler sonlu ve sınırlı', () => {
    const d = kaba.flatMap((y) => y.su?.d ?? []);
    expect(d.some((x) => x > 0)).toBe(true);
    expect(d.some((x) => x < 0)).toBe(true);
    expect(d.every((x) => Number.isFinite(x) && Math.abs(x) <= 6)).toBe(true);
  });

  it('ağaçlar 2D çizimle aynı yerde (ince ızgaraya rağmen)', () => {
    const merkez = (xs: number[], ys: number[]) =>
      [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length]
        .map((v) => v.toFixed(6))
        .join(',');
    const iki = dunyaUcgenleri()
      .filter((u) => u.n.length === 12)
      .map((u) =>
        merkez(
          u.n.filter((_, i) => i % 2 === 0),
          u.n.filter((_, i) => i % 2 === 1),
        ),
      );
    const gpu = dunyaModeli()
      .filter((y) => (y.katman ?? 0) > -2)
      .map((y) =>
        merkez(
          y.p.map((q) => q[0]),
          y.p.map((q) => -q[1]),
        ),
      );
    expect(iki.length).toBeGreaterThan(100);
    expect(gpu).toEqual(iki);
  });

  it('belirlenimci: iki üretim aynı', () => {
    expect(dunyaModeli(4)).toEqual(kaba);
  });
});
