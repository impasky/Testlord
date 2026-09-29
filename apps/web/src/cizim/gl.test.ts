import { describe, expect, it } from 'vitest';
import { arazi } from './arazi';
import { DUNYA_KAMERASI, DUNYA_KUTUSU, dunyaModeli, dunyaUcgenleri } from './dunya';
import { insan } from './figur';
import { DOKU_NO, KOSE, agYap, dokuBul } from './glAg';
import { atlasDuzeni, goruntuMatrisi, sayfalaraYerlestir } from './glCizici';
import { rastgele } from './rastgele';
import { P } from './renk';
import {
  IZOMETRIK,
  dondur,
  kameraTabani,
  koni,
  kutu,
  levha,
  normal,
  olcekle,
  parlat,
  tasi,
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
  ek: [f[i * KOSE + 9]!, f[i * KOSE + 10]!, f[i * KOSE + 11]!, f[i * KOSE + 12]!],
  su: [f[i * KOSE + 13]!, f[i * KOSE + 14]!, f[i * KOSE + 15]!, f[i * KOSE + 16]!],
  kum: [f[i * KOSE + 17]!, f[i * KOSE + 18]!, f[i * KOSE + 19]!],
  /** Yüzey koordinatı u, v ve malzeme numarası. */
  doku: [f[i * KOSE + 20]!, f[i * KOSE + 21]!, f[i * KOSE + 22]!] as V3,
});
const koseler = (f: Float32Array) => Array.from({ length: f.length / KOSE }, (_, i) => kose(f, i));

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

  it('hareketli sahne: duman yüzleri ağa girmiyor; su ve ışıma varlığı işaretleniyor', () => {
    const m: Model = [
      ustUcgen({ saydam: 0.5, duman: [0, 0, 3] }),
      ustUcgen({ isima: 1 }),
      ustUcgen({ su: { d: [1, 1, 1], renk: ['#0000ff', '#0000ff', '#0000ff'], kum: '#ffff00' } }),
    ];
    const tam = agYap(m);
    expect(ucgenSayisi(tam.saydam)).toBe(1);
    expect(tam.suVar && tam.isimaVar).toBe(true);
    const dumansiz = agYap(m, undefined, { dumansiz: true });
    expect(ucgenSayisi(dumansiz.saydam)).toBe(0);
    expect(ucgenSayisi(dumansiz.nesne)).toBe(2);
    const sade = agYap([ustUcgen()]);
    expect(sade.suVar || sade.isimaVar).toBe(false);
  });

  it('bayraksız ağ: kumaş çizilmiyor ama gölgesini düşürüyor', () => {
    const d: V3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ];
    const m: Model = [ustUcgen({ bez: { dinlenik: d, u: [0, 1, 1] } }), ustUcgen()];
    const tam = agYap(m);
    const bayraksiz = agYap(m, undefined, { bayraksiz: true });
    expect(ucgenSayisi(tam.nesne)).toBe(2);
    expect(ucgenSayisi(bayraksiz.nesne)).toBe(1);
    // Kumaş kaybolmuyor: ayrı tamponda (atlas kurulamazsa ana resme çiziliyor).
    expect(ucgenSayisi(bayraksiz.bez)).toBe(1);
    expect(bayraksiz.golge.length).toBe(tam.golge.length);
  });

  it('köşe kaynağı: nesne tamponunun her köşesi modeldeki yüzüne ve köşesine dönüyor', () => {
    const m: Model = [ustUcgen({ renk: '#ff0000' }), ...kutu(3, 3, 0, 1, 1, 1, '#00ff00')];
    const ag = agYap(m, undefined, { kaynak: true });
    const k = ag.nesneKaynak!;
    expect(k.length).toBe((ag.nesne.length / KOSE) * 2);
    for (let v = 0; v < k.length / 2; v++) {
      const q = m[k[v * 2]!]!.p[k[v * 2 + 1]!]!;
      expect(kose(ag.nesne, v).konum).toEqual(q);
    }
  });

  it('atlas rafları ve çizim sayfaları: bloklar çakışmıyor, boşluk korunuyor', () => {
    const kutular: [number, number, number, number][] = Array.from({ length: 30 }, (_, i) => [
      i * 7,
      i * 3,
      40 + (i % 5) * 10,
      50 + (i % 3) * 10,
    ]);
    const kare = 12;
    const a = atlasDuzeni(kutular, kare);
    const b = sayfalaraYerlestir(kutular, 300, 200, 6);
    const cakisir = (
      p: [number, number, number, number],
      q: [number, number, number, number],
      bosluk: number,
    ) =>
      p[0] < q[0] + q[2] + bosluk &&
      q[0] < p[0] + p[2] + bosluk &&
      p[1] < q[1] + q[3] + bosluk &&
      q[1] < p[1] + p[3] + bosluk;
    for (let i = 0; i < kutular.length; i++) {
      const [, , w, h] = kutular[i]!;
      const ai: [number, number, number, number] = [...a.yer[i]!, w * kare, h];
      expect(ai[0] + ai[2]).toBeLessThanOrEqual(a.en);
      expect(ai[1] + ai[3]).toBeLessThanOrEqual(a.boy);
      expect(b[i]!.x + w).toBeLessThanOrEqual(300);
      expect(b[i]!.y + h).toBeLessThanOrEqual(200);
      for (let j = 0; j < i; j++) {
        const [, , wj, hj] = kutular[j]!;
        expect(cakisir(ai, [...a.yer[j]!, wj * kare, hj], 0)).toBe(false);
        if (b[i]!.sayfa === b[j]!.sayfa)
          expect(cakisir([b[i]!.x, b[i]!.y, w, h], [b[j]!.x, b[j]!.y, wj, hj], 6)).toBe(false);
      }
    }
  });

  it('atlas: parçanın kendi kare sayısı; rafa sığmayan uzun tur satır satır sarılıyor', () => {
    const kutular: [number, number, number, number][] = [
      [0, 0, 40, 50],
      [0, 0, 300, 90],
      [0, 0, 60, 30],
    ];
    const kareler = [12, 48, 24];
    const a = atlasDuzeni(kutular, kareler);
    const bloklar = kutular.map(([, , w, h], i): [number, number, number, number] => {
      const s = a.sutun[i]!;
      // Sütun sayısı kare sayısını tam bölüyor: son satır da dolu.
      expect(kareler[i]! % s).toBe(0);
      expect(w * s).toBeLessThanOrEqual(Math.max(4096, w));
      return [...a.yer[i]!, w * s, h * (kareler[i]! / s)];
    });
    // 300 piksellik 48 kare rafa (4096) sığmıyor: birden çok satır.
    expect(kareler[1]! / a.sutun[1]!).toBeGreaterThan(1);
    for (let i = 0; i < bloklar.length; i++) {
      const [x, y, w, h] = bloklar[i]!;
      expect(x + w).toBeLessThanOrEqual(a.en);
      expect(y + h).toBeLessThanOrEqual(a.boy);
      for (let j = 0; j < i; j++) {
        const [xj, yj, wj, hj] = bloklar[j]!;
        expect(x < xj + wj && xj < x + w && y < yj + hj && yj < y + h).toBe(false);
      }
    }
  });

  it('parlaklık köşeye yazılıyor; işaretsiz yüz mat (0), dönüşümden sağ çıkıyor', () => {
    const [metal] = dondur(tasi(parlat([ustUcgen()], 0.8), [1, 2, 3]), 'z', 0.3);
    const ag = agYap([metal!, ustUcgen()]);
    expect(kose(ag.nesne, 0).ek[3]).toBeCloseTo(0.8);
    expect(kose(ag.nesne, 3).ek[3]).toBe(0);
  });

  it('figürde metal parlıyor, ten ve bez mat', () => {
    const f = insan({
      ten: '#c08060',
      govde: '#6a4a30',
      bacak: '#40302a',
      cizme: '#2a221c',
      zirh: { tip: 'plaka', renk: '#8a8f94' },
      baslik: { tip: 'migfer', renk: '#8a8f94' },
      sag: { tip: 'kilic' },
    });
    const parlak = (renk: string) => f.filter((y) => y.renk === renk && (y.parlak ?? 0) > 0);
    expect(parlak('#8a8f94').length).toBeGreaterThan(0);
    expect(parlak('#c08060')).toHaveLength(0);
    expect(parlak('#40302a')).toHaveLength(0);
    // Deri zırh mat kalıyor.
    const deri = insan({
      ten: '#c08060',
      govde: '#6a4a30',
      bacak: '#40302a',
      cizme: '#2a221c',
      zirh: { tip: 'deri', renk: '#7a5a38' },
      omuz: '#b0b4b8',
    });
    expect(deri.some((y) => (y.parlak ?? 0) > 0)).toBe(false);
    // Metal zırhlının omuzluğu da metal.
    const sovalye = insan({
      ten: '#c08060',
      govde: '#6a4a30',
      bacak: '#40302a',
      cizme: '#2a221c',
      zirh: { tip: 'plaka', renk: '#8a8f94' },
      omuz: '#b0b4b8',
    });
    expect(sovalye.some((y) => y.renk === '#b0b4b8' && (y.parlak ?? 0) > 0)).toBe(true);
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

describe('malzeme dokusu', () => {
  const yuz = (renk: string, ek: Partial<Yuz> = {}): Yuz => ({ p: [], renk, ...ek });

  it('renginden ve eğiminden: taş dikte örgü, yatayda döşeme; çatı rengi eğikte', () => {
    expect(dokuBul(yuz(P.tas), 0)).toBe('tas');
    expect(dokuBul(yuz(P.acikTas), 0.2)).toBe('tas');
    expect(dokuBul(yuz(P.acikTas), 1)).toBe('doseme');
    expect(dokuBul(yuz(P.tas), 0.7)).toBeNull();
    expect(dokuBul(yuz(P.kiremit), 0.7)).toBe('kiremit');
    expect(dokuBul(yuz(P.arduvaz), 0.4)).toBe('arduvaz');
    expect(dokuBul(yuz(P.saman), 0.6)).toBe('saman');
    // Çatı rengi dik ya da düz yüzde çatı değil.
    expect(dokuBul(yuz(P.kiremit), 0)).toBeNull();
    expect(dokuBul(yuz(P.kiremit), 1)).toBeNull();
  });

  it('yakın renkte ama başka şey olan yüz düz kalıyor; açık seçim her şeyi eziyor', () => {
    expect(dokuBul(yuz(P.kaya), 0)).toBeNull();
    expect(dokuBul(yuz(P.kemik), 0)).toBeNull();
    expect(dokuBul(yuz(P.kirmiziBez), 0.7)).toBeNull();
    expect(dokuBul(yuz(P.tahta), 0)).toBeNull();
    expect(dokuBul(yuz(P.tas, { isima: 1 }), 0)).toBeNull();
    expect(dokuBul(yuz(P.tas, { doku: null }), 0)).toBeNull();
    expect(dokuBul(yuz('#123456', { doku: 'tahta' }), 0)).toBe('tahta');
  });

  it('taş kutu: yan yüzde örgü, v = yükseklik; üstte döşeme, u = x, v = y', () => {
    const ks = koseler(agYap(kutu(0, 0, 0, 2, 3, 4, P.tas)).nesne);
    const yan = ks.filter((k) => Math.abs(k.normal[2]) < 1e-6);
    const ust = ks.filter((k) => k.normal[2] > 0.99);
    expect(yan.length).toBeGreaterThan(0);
    expect(ust.length).toBeGreaterThan(0);
    for (const k of yan) {
      expect(k.doku[2]).toBe(DOKU_NO.tas);
      expect(k.doku[1]).toBeCloseTo(k.konum[2]);
    }
    for (const k of ust) {
      expect(k.doku[2]).toBe(DOKU_NO.doseme);
      expect(k.doku[0]).toBeCloseTo(k.konum[0]);
      expect(k.doku[1]).toBeCloseTo(k.konum[1]);
    }
  });

  it('konik çatı: her dilimde aynı yükseklik aynı sıra (v = z / sin eğim)', () => {
    const ks = koseler(agYap(koni(3, -2, 1, 2, 2, P.arduvaz, 8)).nesne);
    expect(ks.length).toBeGreaterThan(0);
    const oran = new Set<string>();
    for (const k of ks) {
      expect(k.doku[2]).toBe(DOKU_NO.arduvaz);
      // Dilimlerin eğimi aynı: v / z hepsinde aynı, sıralar hizalı.
      if (k.konum[2] > 1.5) oran.add((k.doku[1] / k.konum[2]).toFixed(4));
    }
    expect(oran.size).toBe(1);
  });

  it('desensiz yüzde malzeme numarası 0', () => {
    const [k] = koseler(agYap([ustUcgen({ renk: P.kaya })]).nesne);
    expect(k!.doku[2]).toBe(0);
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
