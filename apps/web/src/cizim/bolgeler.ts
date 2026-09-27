/**
 * BÖLGE SAHNELERİ — köy, tarla, maden, şehir, kale, taht × 3 aşama (docs/24).
 *
 * Dünya haritasında bir bölgeye dokununca açılan sayfanın afişi. Aşama
 * dili: 1-2 taban, 3-4 `_3`, 5 `_5` (`bolgeGorselAdi`). Aynı türün üç
 * aşaması AYNI araziyi paylaşıyor (gürültü türün adıyla tohumlanıyor):
 * bölge gelişince manzara değişmiyor, üstündeki köy büyüyor. "Köyüm
 * kasaba oldu" cümlesinin resmi bu.
 *
 * Çerçeve 3:2 (afişin kutusu da 3:2). Afişin alt üçte biri panele eriyor
 * ve üstüne bölgenin adı biniyor; asıl konu çerçevenin orta ve üst
 * kısmında duruyor.
 */
import {
  arazi,
  cizgiyeUzaklik,
  duzle,
  ekrandanYere,
  gurultu,
  nehirOy,
  parsel,
  tepe,
  yerYolu,
  yumusakAdim,
  yumusat,
  type Duzluk,
  type Nokta,
  type Yukseklik,
} from './arazi';
import {
  ambar,
  araba,
  balya,
  burc,
  cevher,
  citKisa,
  degirmen,
  ev,
  havuz,
  izabe,
  kaleSuru,
  katedral,
  kilise,
  kopru,
  kosk,
  kuyuKucuk,
  kuyuKulesi,
  madenAgzi,
  merdiven,
  ray,
  selvi,
  suDegirmeni,
  sutunlar,
  tahtaKopru,
  teras,
  tezgah,
  vagon,
  type EvAyari,
} from './kir';
import { agac, bayrak, cam, duman, kaya, kemer, kubbe, mesale } from './parca';
import { P, isikla, karistir } from './renk';
import { rastgele } from './rastgele';
import { besikCati, kirmaCati, koni, kutu, silindir, tasi, yansitici, type Model } from './uc';
import { tekne } from './parca';

export type BolgeTipi = 'koy' | 'tarla' | 'maden' | 'sehir' | 'kale' | 'taht';
export type Asama = 1 | 3 | 5;

export const BOLGE_TIPLERI: BolgeTipi[] = ['koy', 'tarla', 'maden', 'sehir', 'kale', 'taht'];
/** Bütün sahne adları: `koy`, `koy_3`, `koy_5`, `tarla`... */
export const BOLGE_SAHNELERI: string[] = BOLGE_TIPLERI.flatMap((t) => [t, t + '_3', t + '_5']);

const EN = 72;
const BOY = 48;
export const BOLGE_KUTUSU: [number, number, number, number] = [-EN / 2, -BOY / 2, EN, BOY];
const yer = ekrandanYere(BOLGE_KUTUSU);
const ekran = yansitici();

type Gurultu = ReturnType<typeof gurultu>;

/** Nokta çerçevenin (payıyla) içinde mi? Görünmeyen yere ev dikmeyelim. */
function gorunur(x: number, y: number, z = 0, pay = 2): boolean {
  const [sx, sy] = ekran([x, y, z]);
  return sx > -EN / 2 - pay && sx < EN / 2 + pay && sy > -BOY / 2 - pay && sy < BOY / 2 + pay;
}

/* ── Ortak zemin ───────────────────────────────────────────────────── */

/** Arkadaki tepeler: çerçevenin üst kenarına doğru yükselen, gürültülü sırt. */
function arkaTepeler(g: Gurultu, x: number, y: number, bas: number, yukseklik: number): number {
  const d = -(x + y) - bas;
  if (d <= 0) return 0;
  return yumusakAdim(d / 30) * yukseklik * (0.45 + g(x + 71, y - 33, 13, 3));
}

/** Çayır: gürültüyle iki yeşil arası; eğim arttıkça toprak, sonra kaya. */
function cayir(g: Gurultu, kuru = 0) {
  return (x: number, y: number, _z: number, dik: number) => {
    const t = Math.min(1, Math.max(0, g(x + 311, y - 177, 16, 2) * 1.2 - 0.1 + kuru));
    let c = karistir('#56753a', '#8f9e4e', t);
    if (dik > 0.25) c = karistir(c, '#7b6a4a', Math.min(1, (dik - 0.25) * 3));
    if (dik > 0.5) c = karistir(c, P.kaya, Math.min(1, (dik - 0.5) * 3));
    return c;
  };
}

/** Düz taş/toprak döşeme (meydan, avlu): araziye yatık tek dörtgen. */
function doseli(
  x: number,
  y: number,
  sx: number,
  sy: number,
  renk: string,
  h: Yukseklik,
  katman = -1.6,
): Model {
  const z = (px: number, py: number) => h(px, py) + 0.12;
  return [
    {
      p: [
        [x, y, z(x, y)],
        [x + sx, y, z(x + sx, y)],
        [x + sx, y + sy, z(x + sx, y + sy)],
        [x, y + sy, z(x, y + sy)],
      ],
      renk,
      katman,
      kenarsiz: true,
      ciftYuz: true,
    },
  ];
}

type Daire = [number, number, number];

/** Boş yerlere ağaç serper (ekran yüzdesiyle örnekleyerek: hepsi kadrajda). */
function agaclar(
  r: () => number,
  h: Yukseklik,
  adet: number,
  bos: (x: number, y: number) => boolean,
  { igne = 0.3, olcek = 0.85, ust = 0, alt = 100 } = {},
): Model {
  const m: Model = [];
  let kalan = adet;
  let deneme = 0;
  while (kalan > 0 && deneme++ < adet * 40) {
    const [x, y] = yer(r() * 108 - 4, ust + r() * (alt - ust));
    if (!bos(x, y)) continue;
    const z = h(x, y) - 0.25;
    const s = olcek * (0.8 + r() * 0.4);
    m.push(...(r() < igne ? cam(x, y, z, r, s) : agac(x, y, z, r, s)));
    kalan--;
  }
  return m;
}

const uzak = (dolu: Daire[], x: number, y: number, pay = 0) =>
  dolu.every(([a, b, rr]) => Math.hypot(a - x, b - y) > rr + pay);

/**
 * Yol ağı: noktaları en kısa bağlantı ağacıyla (Prim) bağlar — köy
 * patikası komşudan komşuya gider, her evden meydana ayrı yol çıkmaz.
 */
function patikalar(
  noktalar: Nokta[],
  gen: number,
  renk: string,
  h: Yukseklik,
  r: () => number,
  bukum = 2.5,
): Model {
  const agacta = new Set([0]);
  const m: Model = [];
  while (agacta.size < noktalar.length) {
    let en: [number, number, number] | null = null;
    for (const i of agacta)
      for (let j = 0; j < noktalar.length; j++) {
        if (agacta.has(j)) continue;
        const d = Math.hypot(noktalar[i]![0] - noktalar[j]![0], noktalar[i]![1] - noktalar[j]![1]);
        if (!en || d < en[2]) en = [i, j, d];
      }
    const [i, j] = en!;
    agacta.add(j);
    const a = noktalar[i]!;
    const b = noktalar[j]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const k = (r() - 0.5) * bukum;
    const orta: Nokta = [(a[0] + b[0]) / 2 + (-dy / l) * k, (a[1] + b[1]) / 2 + (dx / l) * k];
    m.push(...yerYolu(yumusat([a, orta, b], 4), gen, renk, h));
  }
  return m;
}

const renkSec = <T>(r: () => number, dizi: readonly T[]): T => dizi[Math.floor(r() * dizi.length)]!;

/* ── Tarla ─────────────────────────────────────────────────────────── */

const EKIN = ['#c9a24e', '#d6b35a', '#b99448', '#8a9d48', '#6f8e3e', '#9a7650'] as const;

function tarlaSahnesi(a: Asama, r: () => number, g: Gurultu, ra: () => number): Model {
  const F = yer(47, 47);
  const S = 11;
  const nehir = a >= 3 ? yumusat([yer(114, 16), yer(93, 40), yer(98, 68), yer(84, 120)]) : null;
  let h0: Yukseklik = (x, y) => g(x, y, 28, 3) * 3.2 + arkaTepeler(g, x, y, 34, 12);
  if (nehir) h0 = nehirOy(h0, nehir, 5.5, -1.8);
  const zF = h0(F[0], F[1]);
  const degirmenler: Nokta[] =
    a === 1
      ? [yer(24, 25)]
      : a === 3
        ? [yer(24, 25), yer(71, 28)]
        : [yer(18, 27), yer(35, 17), yer(73, 26)];
  const duzluk: Duzluk[] = [
    { x: F[0], y: F[1], r: 10, z: zF, kare: true, yumusak: 6 },
    ...degirmenler.map(([x, y]) => ({ x, y, r: 3, z: h0(x, y), yumusak: 3 })),
  ];
  const h = duzle(h0, duzluk);
  const su = nehir ? -0.6 : undefined;
  const Z = (x: number, y: number) => Math.max(h(x, y), su ?? -99);

  const m = arazi({ cerceve: BOLGE_KUTUSU, adim: 4, h, renk: cayir(g, 0.1), su, r: ra });
  const dolu: Daire[] = degirmenler.map(([x, y]) => [x, y, 5]);

  // Tarlalar: yollarla ayrılmış 9×9 parseller; aşama büyüdükçe dışa doğru.
  const kapsam = a === 1 ? 2.6 : a === 3 ? 3.6 : 9;
  for (let i = -6; i <= 5; i++)
    for (let j = -6; j <= 5; j++) {
      if ((i === -1 || i === 0) && (j === -1 || j === 0)) continue;
      if (Math.max(Math.abs(i + 0.5), Math.abs(j + 0.5)) > kapsam) continue;
      const x = F[0] + i * S + 1;
      const y = F[1] + j * S + 1;
      const cx = x + 4.5;
      const cy = y + 4.5;
      if (!gorunur(cx, cy, 0, 6)) continue;
      if (!uzak(dolu, cx, cy, 5)) continue;
      if (nehir && cizgiyeUzaklik(cx, cy, nehir) < 9) continue;
      if (a === 1 && r() < 0.22) continue;
      if (a === 5 && r() < 0.16) {
        // Meyve bahçesi: sıra sıra küçük ağaç
        m.push(...doseli(x, y, 9, 9, '#5d7d38', h, -1.5));
        for (let u = 1.5; u < 9; u += 3)
          for (let v = 1.5; v < 9; v += 3)
            m.push(...agac(x + u, y + v, Z(x + u, y + v) - 0.2, r, 0.5));
        continue;
      }
      const renk = a === 1 ? renkSec(r, EKIN.slice(0, 3)) : renkSec(r, EKIN);
      m.push(...parsel(x, y, 9, 9, renk, h, { yon: r() < 0.5 ? 'x' : 'y', aralik: 1.5 }));
    }

  // Yollar: kavşakta çiftlik.
  const yol = isikla(P.toprak, 1.12);
  m.push(
    ...yerYolu(
      [
        [F[0], F[1] - 80],
        [F[0], F[1] + 80],
      ],
      2,
      yol,
      h,
    ),
  );
  if (a >= 3)
    m.push(
      ...yerYolu(
        [
          [F[0] - 80, F[1]],
          [F[0] + 80, F[1]],
        ],
        2,
        yol,
        h,
      ),
    );
  if (a === 5)
    for (const k of [-2, 2]) {
      m.push(
        ...yerYolu(
          [
            [F[0] + k * S, F[1] - 80],
            [F[0] + k * S, F[1] + 80],
          ],
          1.4,
          yol,
          h,
        ),
      );
    }

  // Çiftlik avlusu
  const z = zF;
  m.push(...ambar(F[0] - 9.5, F[1] - 8.5, z, 7.5, 5.2, 3.6));
  if (a >= 3)
    m.push(
      ...ev(F[0] + 2.2, F[1] - 8.6, z, 5, 4.2, 3.6, { kiris: true, cati: P.kiremit, baca: true }),
    );
  if (a === 5) {
    m.push(...ambar(F[0] + 2.4, F[1] + 2.2, z, 7, 4.6, 3.2, '#7a4a32', P.kiremit));
    for (const [sx, sy] of [
      [F[0] - 4, F[1] + 3.2],
      [F[0] - 4, F[1] + 7],
    ] as Nokta[]) {
      m.push(...silindir(sx, sy, z, 1.5, 5, P.acikTas, 10));
      m.push(...koni(sx, sy, z + 5, 1.8, 1.8, P.kiremit, 10));
    }
  }
  for (const [bx, by] of [
    [F[0] - 7.5, F[1] + 3],
    [F[0] - 4.8, F[1] + 5.5],
    [F[0] - 8.6, F[1] + 7.2],
  ] as Nokta[])
    if (a < 5 || bx < F[0] - 6) m.push(...balya(bx, by, z));
  if (a >= 3) {
    m.push(...citKisa(F[0] + 1.4, F[1] - 10, z, 9, 'x'));
    m.push(...citKisa(F[0] - 10, F[1] + 1.4, z, 9, 'y'));
  }
  m.push(...araba(F[0] - 0.7, F[1] + 16, Z(F[0], F[1] + 16), 'y'));
  if (a >= 3) m.push(...araba(F[0] + 14, F[1] - 0.7, Z(F[0] + 14, F[1]), 'x', '#b0753a'));
  if (a === 5) {
    m.push(...araba(F[0] - 0.7, F[1] - 24, Z(F[0], F[1] - 24), 'y'));
    m.push(...araba(F[0] - 20, F[1] - 0.7, Z(F[0] - 20, F[1]), 'x', null));
  }
  for (const [x, y] of degirmenler) m.push(...degirmen(x, y, Z(x, y), 1, 0.3 + r() * 0.8));
  if (a === 5)
    for (const [x, y] of [yer(58, 20), yer(84, 36)])
      if (!nehir || cizgiyeUzaklik(x, y, nehir) > 8)
        m.push(...ev(x, y, Z(x, y), 4.6, 3.8, 2.8, { cati: P.saman, baca: true }));

  // Avlu ağaçları + kenar ağaçları
  m.push(...agac(F[0] - 2.5, F[1] - 3, z, r, 0.8));
  const bos = (x: number, y: number) =>
    uzak(dolu, x, y, 2) &&
    (!nehir || cizgiyeUzaklik(x, y, nehir) > 6.5) &&
    Math.abs(x - F[0]) > 2 &&
    Math.abs(y - F[1]) > 2 &&
    // tarla içine ağaç dikme: yalnız yol kenarı ve tarla dışı
    (Math.max(Math.abs(x - F[0]), Math.abs(y - F[1])) > kapsam * S + 2 ||
      (x - F[0] + 1000) % S < 1.6 ||
      (y - F[1] + 1000) % S < 1.6);
  m.push(...agaclar(r, Z, a === 1 ? 26 : a === 3 ? 18 : 10, bos, { igne: 0.25, olcek: 0.8 }));
  if (nehir) {
    const kiyi = (x: number, y: number) => {
      const d = cizgiyeUzaklik(x, y, nehir);
      return d > 6 && d < 9;
    };
    m.push(...agaclar(r, Z, 10, kiyi, { igne: 0.1, olcek: 0.75 }));
  }
  return m;
}

/* ── Köy ───────────────────────────────────────────────────────────── */

interface EvYeri {
  x: number;
  y: number;
  sx: number;
  sy: number;
  h: number;
  o: EvAyari;
}

/** Bir merkez çevresine, dolu yerlerden uzak, çakışmayan ev yerleri seçer. */
function evYerleri(
  r: () => number,
  merkez: Nokta,
  adet: number,
  ic: number,
  dis: number,
  dolu: Daire[],
  engel: (x: number, y: number) => boolean,
  ayar: (r: () => number, i: number) => Omit<EvYeri, 'x' | 'y'>,
): EvYeri[] {
  const evler: EvYeri[] = [];
  let deneme = 0;
  while (evler.length < adet && deneme++ < 900) {
    const aci = r() * Math.PI * 2;
    const rr = ic + Math.sqrt(r()) * (dis - ic);
    const x = merkez[0] + Math.cos(aci) * rr;
    const y = merkez[1] + Math.sin(aci) * rr;
    if (engel(x, y) || !uzak(dolu, x, y, 3.4) || !gorunur(x, y, 0, -4)) continue;
    const [sx, sy] = ekran([x, y, 0]);
    if (sy > BOY / 2 - 10 || Math.abs(sx) > EN / 2 - 5) continue;
    const e = ayar(r, evler.length);
    evler.push({ x: x - e.sx / 2, y: y - e.sy / 2, ...e });
    dolu.push([x, y, Math.max(e.sx, e.sy) / 2 + 0.6]);
  }
  return evler;
}

function koySahnesi(a: Asama, r: () => number, g: Gurultu, ra: () => number): Model {
  const C = yer(47, 46);
  const nehir = yumusat([yer(110, 4), yer(87, 34), yer(80, 58), yer(89, 82), yer(76, 120)]);
  let h0: Yukseklik = (x, y) => g(x, y, 24, 3) * 4.5 + arkaTepeler(g, x, y, 30, 13);
  h0 = nehirOy(h0, nehir, 5, -1.8);
  const su = -0.5;
  const zC = h0(C[0], C[1]);
  const dolu: Daire[] = [[C[0], C[1], 5.5]];
  const engel = (x: number, y: number) => cizgiyeUzaklik(x, y, nehir) < 7.5;

  // Özel yapılar önce yer ayırıyor
  const kiliseYeri: Nokta = [C[0] - 13, C[1] - 6];
  const degirmenYeri = yer(22, 30);
  if (a >= 3) dolu.push([kiliseYeri[0] + 4, kiliseYeri[1] + 2.5, 7]);
  if (a === 5) dolu.push([degirmenYeri[0], degirmenYeri[1], 5]);
  // Su değirmeni: nehrin köye en yakın noktası
  let yakin: Nokta = nehir[0]!;
  for (const p of nehir)
    if (Math.hypot(p[0] - C[0], p[1] - C[1]) < Math.hypot(yakin[0] - C[0], yakin[1] - C[1]))
      yakin = p;
  const suDegYeri: Nokta = [yakin[0] - 10, yakin[1] - 9];
  if (a >= 3) dolu.push([suDegYeri[0] + 2.5, suDegYeri[1] + 2, 5]);

  const adet = a === 1 ? 6 : a === 3 ? 11 : 18;
  const dis = a === 1 ? 15 : a === 3 ? 20 : 25;
  const evler = evYerleri(r, C, adet, 7, dis, dolu, engel, (rr, i) => {
    const iki = a === 5 && rr() < 0.35;
    const cati = a === 1 ? P.saman : rr() < (a === 3 ? 0.35 : 0.55) ? P.kiremit : P.saman;
    return {
      sx: 3.6 + rr() * 1.6,
      sy: 3.2 + rr() * 1.2,
      h: iki ? 4.6 : 2.5 + rr() * 0.7,
      o: {
        duvar: rr() < 0.3 ? P.tahta : P.siva,
        cati,
        kiris: iki,
        baca: i % 3 === 0,
        yon: rr() < 0.5 ? 'x' : 'y',
      },
    };
  });

  const duzluk: Duzluk[] = [
    { x: C[0], y: C[1], r: 5, z: zC, yumusak: 5 },
    ...evler.map((e) => ({
      x: e.x + e.sx / 2,
      y: e.y + e.sy / 2,
      r: Math.max(e.sx, e.sy) / 2 + 0.8,
      z: h0(e.x + e.sx / 2, e.y + e.sy / 2),
      kare: true,
      yumusak: 3,
    })),
  ];
  if (a >= 3)
    duzluk.push({
      x: kiliseYeri[0] + 5,
      y: kiliseYeri[1] + 2,
      r: 6,
      z: h0(...kiliseYeri),
      kare: true,
      yumusak: 4,
    });
  if (a >= 3)
    duzluk.push({
      x: suDegYeri[0] + 2.5,
      y: suDegYeri[1] + 2,
      r: 3.5,
      z: Math.max(0.6, h0(...suDegYeri)),
      kare: true,
      yumusak: 3,
    });
  if (a === 5)
    duzluk.push({
      x: degirmenYeri[0],
      y: degirmenYeri[1],
      r: 3,
      z: h0(...degirmenYeri),
      yumusak: 3,
    });
  const h = duzle(h0, duzluk);
  const Z = (x: number, y: number) => Math.max(h(x, y), su);
  const m = arazi({ cerceve: BOLGE_KUTUSU, adim: 4, h, renk: cayir(g), su, r: ra });

  // Patikalar: meydandan evlerin kapısına
  const kapilar: Nokta[] = [
    C,
    ...evler.map((e): Nokta => [e.x + e.sx * 0.28 + 0.5, e.y + e.sy + 1.2]),
  ];
  if (a >= 3) kapilar.push([kiliseYeri[0] + 9, kiliseYeri[1] + 6]);
  m.push(...patikalar(kapilar, a === 5 ? 1.8 : 1.5, isikla(P.toprak, 1.1), h, r));
  m.push(
    ...doseli(C[0] - 3.5, C[1] - 3.5, 7, 7, a === 5 ? P.acikTas : isikla(P.toprak, 1.1), h, -1.2),
  );

  // Köprü: meydandan nehre giden yol
  const kopruY: Nokta = yakin;
  m.push(
    ...yerYolu(
      yumusat([C, [(C[0] + kopruY[0]) / 2 + 2, (C[1] + kopruY[1]) / 2 - 2], kopruY]),
      1.8,
      isikla(P.toprak, 1.1),
      h,
    ),
  );
  const dx = nehir[nehir.indexOf(yakin) + 1]![0] - yakin[0];
  const dy = nehir[nehir.indexOf(yakin) + 1]![1] - yakin[1];
  const kYon = Math.abs(dx) > Math.abs(dy) ? 'y' : 'x';
  if (a === 5) {
    m.push(
      ...(kYon === 'y'
        ? kopru(kopruY[0] - 1.3, kopruY[1] - 6, 0.8, 12, 'y', su)
        : kopru(kopruY[0] - 6, kopruY[1] - 1.3, 0.8, 12, 'x', su)),
    );
  } else {
    m.push(
      ...(kYon === 'y'
        ? tahtaKopru(kopruY[0] - 0.9, kopruY[1] - 5.5, 0.3, 11, 'y')
        : tahtaKopru(kopruY[0] - 5.5, kopruY[1] - 0.9, 0.3, 11, 'x')),
    );
  }

  // Bahçeler ve çitler
  for (const e of evler) {
    if (r() > (a === 1 ? 0.7 : 0.4)) continue;
    const gx = e.x - 4.2;
    const gy = e.y;
    if (!uzak(dolu, gx + 1.7, gy + 1.7, 0) || engel(gx, gy)) continue;
    m.push(...parsel(gx, gy, 3.4, 3.4, '#6a8a3a', h, { yon: 'y', aralik: 0.9, sira: '#4f6b2a' }));
    m.push(...citKisa(gx, gy + 3.6, Z(gx, gy + 3.6), 3.4, 'x'));
  }
  // Evler
  for (const e of evler) {
    const z = Z(e.x + e.sx / 2, e.y + e.sy / 2);
    m.push(...ev(e.x, e.y, z, e.sx, e.sy, e.h, e.o));
    if (e.o.baca && a >= 3)
      m.push(...duman(e.x + e.sx * 0.2 + 0.4, e.y + e.sy * 0.3, z + e.h + 3.4, r, 2));
  }
  m.push(...kuyuKucuk(C[0], C[1], Z(...C)));
  if (a >= 3) {
    const [kx, ky] = kiliseYeri;
    m.push(
      ...kilise(
        kx,
        ky,
        Z(kx + 4, ky + 2),
        a === 5 ? { buyuk: true } : { tas: P.siva, cati: P.kiremit },
      ),
    );
    m.push(
      ...suDegirmeni(
        suDegYeri[0],
        suDegYeri[1],
        Z(suDegYeri[0] + 2.5, suDegYeri[1] + 2),
        kYon === 'y' ? 'x' : 'y',
      ),
    );
  }
  if (a === 5) {
    m.push(...degirmen(degirmenYeri[0], degirmenYeri[1], Z(...degirmenYeri), 0.9, 0.6));
    const tezgahRenk = [P.kirmiziBez, P.maviBez, '#b0753a'];
    [
      [C[0] + 2.2, C[1] - 3.2],
      [C[0] - 5.2, C[1] + 1.2],
      [C[0] + 2.4, C[1] + 2.4],
    ].forEach(([x, y], i) => m.push(...tezgah(x!, y!, Z(x!, y!), tezgahRenk[i]!)));
  }

  // Tarlalar: köyün arkasında
  const T = yer(20, 34);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      if (a === 1 && (i + j) % 2) continue;
      const x = T[0] + i * 8;
      const y = T[1] + j * 8;
      if (!uzak(dolu, x + 3.5, y + 3.5, 1) || engel(x + 3.5, y + 3.5)) continue;
      m.push(
        ...parsel(x, y, 7, 7, renkSec(r, EKIN), h, { yon: r() < 0.5 ? 'x' : 'y', aralik: 1.3 }),
      );
      dolu.push([x + 3.5, y + 3.5, 5]);
    }

  const bos = (x: number, y: number) =>
    uzak(dolu, x, y, 1.5) &&
    cizgiyeUzaklik(x, y, nehir) > 6 &&
    Math.hypot(x - C[0], y - C[1]) > dis - 2;
  m.push(...agaclar(r, Z, a === 5 ? 20 : 30, bos, { igne: 0.35 }));
  const kiyi = (x: number, y: number) => {
    const d = cizgiyeUzaklik(x, y, nehir);
    return d > 5.5 && d < 8.5 && uzak(dolu, x, y, 1);
  };
  m.push(...agaclar(r, Z, 8, kiyi, { igne: 0.1, olcek: 0.75 }));
  return m;
}

/* ── Maden ─────────────────────────────────────────────────────────── */

function dagRengi(g: Gurultu) {
  return (x: number, y: number, z: number, dik: number) => {
    const t = g(x - 90, y + 40, 7, 2);
    // Alçakta kahverengi-sıcak kaya, yükseldikçe gri, tepede kar.
    let c = karistir(
      karistir('#7d6a55', '#8e7f6a', t),
      karistir('#77736b', '#9a958b', t),
      Math.min(1, z / 14),
    );
    if (z < 2.5 && dik < 0.3)
      c = karistir('#6c7a44', '#857357', Math.min(1, Math.max(0, z / 2.5 + t * 0.4)));
    else if (dik < 0.3 && z < 12) c = karistir(c, '#6a7440', 0.45);
    if (z > 17) c = karistir(c, P.kar, Math.min(0.9, (z - 17) / 4));
    return c;
  };
}

function madenSahnesi(a: Asama, r: () => number, g: Gurultu, ra: () => number): Model {
  const Y = yer(54, 62);
  // Dağ: arkada, sol yanı daha yüksek; tepe gürültüsü ve kısa dalgalı
  // pürüz birlikte — tek gürültüyle yamaç düz bir duvar gibi duruyordu.
  const dag = (x: number, y: number) => {
    const d = -(x + y) - 4 + (x - y) * 0.25;
    const t = yumusakAdim(d / 20);
    return t * (13 + 16 * g(x + 40, y - 20, 13, 3)) + t * 4 * g(x * 2.3, y * 2.3, 5, 1);
  };
  const h0: Yukseklik = (x, y) => (g(x, y, 16, 3) - 0.5) * 2 + dag(x, y);
  const agizlar: [Nokta, 'x' | 'y'][] =
    a === 1
      ? [[yer(47, 45), 'y']]
      : a === 3
        ? [
            [yer(47, 45), 'y'],
            [yer(26, 46), 'x'],
          ]
        : [
            [yer(47, 45), 'y'],
            [yer(26, 46), 'x'],
            [yer(68, 38), 'y'],
          ];
  const agizZ = agizlar.map(([[x, y]]) => Math.max(1.2, h0(x, y) * 0.5));
  const duzluk: Duzluk[] = [
    { x: Y[0], y: Y[1], r: a === 5 ? 15 : 12, z: 1.2, yumusak: 7 },
    ...agizlar.map(([[x, y], yon], i) => ({
      x: yon === 'y' ? x : x + 2,
      y: yon === 'y' ? y + 2 : y,
      r: 2.6,
      z: agizZ[i]!,
      kare: true,
      yumusak: 2.5,
    })),
  ];
  const h = duzle(h0, duzluk);
  const m = arazi({ cerceve: BOLGE_KUTUSU, adim: 4, h, renk: dagRengi(g), r: ra });
  const dolu: Daire[] = [[Y[0], Y[1], a === 5 ? 14 : 11]];

  // Ağızlar ve raylar
  agizlar.forEach(([[x, y], yon], i) => {
    const z = agizZ[i]!;
    m.push(...madenAgzi(x, y, z, yon, r));
    dolu.push([x, y, 5]);
    const cikis: Nokta = yon === 'y' ? [x, y + 0.6] : [x + 0.6, y];
    const yol = yumusat(
      [cikis, yon === 'y' ? [x, y + 5] : [x + 5, y], [Y[0] - 2, Y[1] - 2], [Y[0] + 4, Y[1] + 3]],
      5,
    );
    m.push(...yerYolu(yol, 3, '#6e6252', h, -1.1));
    m.push(...ray(yol, h));
    const vy = yol[Math.min(yol.length - 1, 6)]!;
    m.push(...vagon(vy[0] - 0.6, vy[1] - 0.6, h(vy[0], vy[1]), yon === 'y' ? 'y' : 'x'));
    if (a >= 3)
      m.push(...mesale(yon === 'y' ? x + 2.4 : x + 1, yon === 'y' ? y + 1 : y + 2.4, z, 2.4));
  });

  // Avlu: yığınlar, baraka, alet
  m.push(...cevher(Y[0] + 6, Y[1] + 1, 1.2, 2.2, r));
  m.push(...cevher(Y[0] + 3, Y[1] + 7, 1.2, 1.8, r, P.altin));
  m.push(...ev(Y[0] - 10, Y[1] + 2, 1.2, 5, 4, 2.8, { duvar: P.tahta, cati: P.tahta }));
  m.push(...vagon(Y[0] + 7.5, Y[1] - 3, 1.2, 'x'));
  m.push(...sandikYigini(Y[0] - 3, Y[1] + 8, 1.2));
  if (a >= 3) {
    const [kx, ky] = yer(36, 55);
    m.push(...kuyuKulesi(kx, ky, h(kx, ky), a === 5 ? 12 : 9, a === 5 ? 4.6 : 4));
    m.push(
      ...ev(Y[0] + 9, Y[1] - 9, 1.2, 6, 4.5, 3.4, { duvar: P.tas, cati: P.arduvaz, baca: true }),
    );
    m.push(...duman(Y[0] + 10.6, Y[1] - 7.6, 1.2 + 3.4 + 3.6, r, 3));
    m.push(...cevher(Y[0] - 5, Y[1] - 6, 1.2, 1.6, r));
  }
  if (a === 5) {
    m.push(...izabe(Y[0] + 1, Y[1] - 13, 1.2));
    m.push(...duman(Y[0] + 2.6, Y[1] - 11.6, 1.2 + 9.6, r, 3));
    m.push(...duman(Y[0] + 5.8, Y[1] - 11.6, 1.2 + 8.6, r, 3));
    m.push(
      ...ev(Y[0] - 14, Y[1] - 6, 1.2, 5, 4.2, 3.8, { duvar: P.tas, cati: P.arduvaz, kiris: true }),
    );
    m.push(...cevher(Y[0] + 12, Y[1] + 5, 1.2, 2.4, r, P.celik));
    for (const [x, y] of [
      [Y[0] - 1, Y[1] + 12],
      [Y[0] + 10, Y[1] + 10],
    ])
      m.push(...mesale(x!, y!, 1.2, 2.6));
  }

  // Dağda çamlar ve kaya
  const bos = (x: number, y: number) => {
    const z = h(x, y);
    return z > 2.5 && z < 17 && uzak(dolu, x, y, 1.5);
  };
  m.push(...agaclar(r, h, 26, bos, { igne: 1, olcek: 0.8, alt: 60 }));
  const onBos = (x: number, y: number) => h(x, y) < 3 && uzak(dolu, x, y, 1.5);
  m.push(...agaclar(r, h, 10, onBos, { igne: 0.6, olcek: 0.8, ust: 50 }));
  for (let i = 0; i < 8; i++) {
    const [x, y] = yer(r() * 100, 30 + r() * 50);
    if (!uzak(dolu, x, y, 1)) continue;
    m.push(...kaya(x, y, h(x, y) - 0.2, 0.9 + r() * 1.2, r));
  }
  return m;
}

function sandikYigini(x: number, y: number, z: number): Model {
  return [
    ...kutu(x, y, z, 1.3, 1.3, 1.2, { ust: P.acikTahta, yan: P.tahta }),
    ...kutu(x + 1.4, y + 0.2, z, 1.2, 1.2, 1, { ust: P.acikTahta, yan: P.tahta }),
    ...kutu(x + 0.4, y + 0.3, z + 1.2, 1.1, 1.1, 0.9, { ust: P.acikTahta, yan: P.tahta }),
  ];
}

/* ── Şehir ─────────────────────────────────────────────────────────── */

function sehirSahnesi(a: Asama, r: () => number, g: Gurultu, ra: () => number): Model {
  const C = yer(46, 50);
  const nehir = yumusat([yer(114, 8), yer(92, 36), yer(96, 66), yer(84, 120)]);
  const nehirGen = a === 5 ? 9 : 6.5;
  let h0: Yukseklik = (x, y) => g(x, y, 26, 3) * 1.8 + arkaTepeler(g, x, y, 38, 10);
  h0 = nehirOy(h0, nehir, nehirGen, -2);
  const su = -0.6;
  const Rb = a === 1 ? 13 : a === 3 ? 18 : 23;
  const zC = Math.max(0.3, h0(C[0], C[1]));
  const h = duzle(h0, [{ x: C[0], y: C[1], r: Rb + 4, z: zC, kare: true, yumusak: 6 }]);
  const Z = (x: number, y: number) => Math.max(h(x, y), su);
  const m = arazi({ cerceve: BOLGE_KUTUSU, adim: 4, h, renk: cayir(g, 0.05), su, r: ra });
  const dolu: Daire[] = [];

  // Sokaklar ve meydan
  const tas = isikla(P.acikTas, 0.92);
  const sokakBoy = Rb + 12;
  m.push(
    ...yerYolu(
      [
        [C[0], C[1] - sokakBoy],
        [C[0], C[1] + sokakBoy + 16],
      ],
      2.4,
      tas,
      h,
    ),
  );
  m.push(
    ...yerYolu(
      [
        [C[0] - sokakBoy - 16, C[1]],
        [C[0] + sokakBoy, C[1]],
      ],
      2.4,
      tas,
      h,
    ),
  );
  m.push(...doseli(C[0] - 5.5, C[1] - 5.5, 11, 11, P.acikTas, h));
  // Pazar tezgâhları + çeşme
  const renkler = [P.kirmiziBez, P.maviBez, '#b0753a', P.bakir, P.kirmiziBez, P.maviBez];
  const tezgahYerleri: Nokta[] = [
    [C[0] - 4.8, C[1] - 4.6],
    [C[0] + 1.8, C[1] - 4.6],
    [C[0] - 4.8, C[1] + 2.6],
    [C[0] + 1.8, C[1] + 2.6],
    [C[0] - 1.2, C[1] - 4.6],
    [C[0] - 4.8, C[1] - 1],
  ];
  tezgahYerleri
    .slice(0, a === 1 ? 3 : a === 3 ? 4 : 6)
    .forEach(([x, y], i) => m.push(...tezgah(x, y, zC, renkler[i]!)));
  if (a === 1) m.push(...kuyuKucuk(C[0] + 0.5, C[1] + 0.5, zC));
  else {
    m.push(...silindir(C[0] + 0.5, C[1] + 0.5, zC, 1.6, 0.6, P.tas, 10));
    m.push(...silindir(C[0] + 0.5, C[1] + 0.5, zC + 0.55, 1.3, 0.06, P.su, 10));
    m.push(...silindir(C[0] + 0.5, C[1] + 0.5, zC, 0.3, 1.8, P.acikTas, 6));
  }

  // Önemli yapılar
  if (a === 1) {
    m.push(...kilise(C[0] - 13, C[1] - 12.5, zC, { tas: P.siva, cati: P.kiremit }));
    dolu.push([C[0] - 8, C[1] - 10, 6]);
  } else if (a === 3) {
    m.push(...kilise(C[0] - 15, C[1] - 13, zC, { buyuk: true }));
    dolu.push([C[0] - 8, C[1] - 10, 8]);
  } else {
    m.push(...katedral(C[0] - 21, C[1] - 12, zC));
    dolu.push([C[0] - 12, C[1] - 9, 11]);
    m.push(...burc(C[0] + 6, C[1] - 21, zC, 7, 11, P.tas, 'kirma'));
    dolu.push([C[0] + 9.5, C[1] - 17.5, 6.5]);
  }

  // Ev blokları: sokaklarla bölünmüş hücrelerde birer ev
  const hucre = a === 5 ? 6 : 6.6;
  const n = Math.ceil(Rb / hucre) + 1;
  const evRenk = [P.siva, P.siva, P.kumTasi, P.acikTas, '#cdb89a'];
  for (let i = -n; i < n; i++)
    for (let j = -n; j < n; j++) {
      const x0 = C[0] + (i < 0 ? i * hucre - 0.2 : i * hucre + 1.6);
      const y0 = C[1] + (j < 0 ? j * hucre - 0.2 : j * hucre + 1.6);
      const sx = hucre - 2.6 + r() * 1.3;
      const sy = hucre - 2.6 + r() * 1.3;
      const x = i < 0 ? x0 + hucre - 1.4 - sx : x0;
      const y = j < 0 ? y0 + hucre - 1.4 - sy : y0;
      const cx = x + sx / 2;
      const cy = y + sy / 2;
      if (Math.max(Math.abs(cx - C[0]), Math.abs(cy - C[1])) > Rb) continue;
      if (Math.max(Math.abs(cx - C[0]), Math.abs(cy - C[1])) < 7.5) continue;
      if (!uzak(dolu, cx, cy, 1) || cizgiyeUzaklik(cx, cy, nehir) < nehirGen + 2) continue;
      const yuk = a === 1 ? 3 + r() * 1.4 : a === 3 ? 3.4 + r() * 2.4 : 3.8 + r() * 3.2;
      const cati = r() < 0.65 ? P.kiremit : P.arduvaz;
      m.push(
        ...ev(x, y, zC, sx, sy, yuk, {
          duvar: renkSec(r, evRenk),
          cati,
          kiris: yuk > 4.4 && r() < 0.6,
          yon: r() < 0.5 ? 'x' : 'y',
          baca: r() < 0.25,
        }),
      );
    }

  // Sur
  if (a >= 3) {
    const s = Rb + 4;
    m.push(
      ...kaleSuru(C[0] - s, C[1] - s, zC, s * 2, s * 2, a === 5 ? 4.6 : 3.8, {
        kule: a === 5 ? 'kulah' : 'kare',
        kuleR: a === 5 ? 2.1 : 1.7,
      }),
    );
  }

  // Nehir: köprü ve tekneler
  let kesisim: Nokta | null = null;
  for (let t = 0; t < 80; t += 0.5) {
    if (cizgiyeUzaklik(C[0], C[1] + t, nehir) < 1) {
      kesisim = [C[0], C[1] + t];
      break;
    }
  }
  if (kesisim) {
    const L = nehirGen * 2 + 2;
    m.push(
      ...kopru(kesisim[0] - 1.3, kesisim[1] - L / 2, 0.9, L, 'y', su, a === 1 ? P.tahta : P.tas),
    );
  }
  const tekneler = a === 1 ? 1 : a === 3 ? 2 : 4;
  for (let i = 0; i < tekneler; i++) {
    const p = nehir[Math.floor(nehir.length * (0.12 + i * 0.12))]!;
    if (!gorunur(p[0], p[1], 0, -2)) continue;
    m.push(...tasi(tekne(p[0] - 2, p[1] - 3, a === 5 ? 5 : 4, 'y', a >= 3), [0, 0, su + 0.35]));
  }

  // Dış: tarlalar ve ağaçlar
  const disDolu = (x: number, y: number) =>
    Math.max(Math.abs(x - C[0]), Math.abs(y - C[1])) < Rb + 7;
  for (let k = 0; k < 10; k++) {
    const [x, y] = yer(r() * 90 + 5, 18 + r() * 40);
    if (disDolu(x, y) || cizgiyeUzaklik(x, y, nehir) < nehirGen + 4) continue;
    m.push(...parsel(x, y, 7, 7, renkSec(r, EKIN), h, { yon: r() < 0.5 ? 'x' : 'y', aralik: 1.3 }));
    dolu.push([x + 3.5, y + 3.5, 5]);
  }
  const bos = (x: number, y: number) =>
    !disDolu(x, y) && cizgiyeUzaklik(x, y, nehir) > nehirGen && uzak(dolu, x, y, 1);
  m.push(...agaclar(r, Z, 22, bos, { igne: 0.3 }));
  return m;
}

/* ── Kale ──────────────────────────────────────────────────────────── */

function kaleSahnesi(a: Asama, r: () => number, g: Gurultu, ra: () => number): Model {
  const K = yer(50, 56);
  const ust = a === 1 ? 6 : a === 3 ? 7 : 10;
  const yari = a === 1 ? 9 : a === 3 ? 11.5 : 10;
  const h0: Yukseklik = (x, y) =>
    g(x, y, 18, 3) * 3 +
    tepe(x, y, K[0], K[1], a === 5 ? 34 : 26, ust + 3) * (0.85 + 0.3 * g(x + 5, y, 8, 2)) +
    arkaTepeler(g, x, y, 42, 16);
  const duzluk: Duzluk[] = [];
  if (a === 5) duzluk.push({ x: K[0], y: K[1], r: 18, z: ust - 4.5, kare: true, yumusak: 6 });
  duzluk.push({ x: K[0], y: K[1], r: yari + 1.5, z: ust, kare: true, yumusak: a === 5 ? 2.5 : 5 });
  const h = duzle(h0, duzluk);
  const nehir = yumusat([yer(-10, 40), yer(16, 64), yer(10, 88), yer(26, 120)]);
  const hN = nehirOy(h, nehir, 5, -1.8);
  const su = -0.5;
  const Z = (x: number, y: number) => Math.max(hN(x, y), su);
  const m = arazi({ cerceve: BOLGE_KUTUSU, adim: 4, h: hN, renk: cayir(g, 0.08), su, r: ra });
  const tas = a === 5 ? P.acikTas : P.tas;
  const dolu: Daire[] = [[K[0], K[1], a === 5 ? 20 : yari + 7]];

  // Yol: kapıdan aşağı kıvrılarak
  const kapi: Nokta = [K[0], K[1] + yari + 1];
  const disKapi: Nokta = [K[0], K[1] + 19];
  const yol =
    a === 5
      ? yumusat([
          kapi,
          [K[0] + 5, K[1] + 13],
          disKapi,
          [K[0] + 6, K[1] + 22],
          [K[0] + 2, K[1] + 30],
          [K[0] + 12, K[1] + 42],
        ])
      : yumusat([
          kapi,
          [K[0] + 6, K[1] + yari + 4],
          [K[0] + 3, K[1] + yari + 10],
          [K[0] + 10, K[1] + yari + 16],
          [K[0] + 6, K[1] + 40],
        ]);
  m.push(...yerYolu(yol, 1.9, isikla(P.toprak, 1.1), Z));
  m.push(
    ...doseli(
      K[0] - yari + 1,
      K[1] - yari + 1,
      yari * 2 - 2,
      yari * 2 - 2,
      isikla(P.acikTas, 0.9),
      Z,
    ),
  );

  // Surlar
  if (a === 5) {
    m.push(
      ...kaleSuru(K[0] - 18, K[1] - 18, ust - 4.5, 36, 36, 4.2, {
        renk: tas,
        kule: 'kulah',
        kuleR: 2.2,
      }),
    );
  }
  m.push(
    ...kaleSuru(K[0] - yari, K[1] - yari, ust, yari * 2, yari * 2, a === 1 ? 3.6 : 4.4, {
      renk: tas,
      kule: a === 1 ? 'kare' : 'kulah',
      kuleR: a === 1 ? 1.6 : 2,
    }),
  );
  // İç yapılar
  if (a === 1) {
    m.push(...burc(K[0] - 5, K[1] - 5.5, ust, 6.5, 10, tas));
    m.push(...bayrak(K[0] - 1.8, K[1] - 2.2, ust + 10, 3.6, P.kirmiziBez, 'y', 2.2, 1.3));
    m.push(...ev(K[0] + 1.5, K[1] - 5.5, ust, 4.4, 3.4, 2.6, { duvar: P.tahta, cati: P.tahta }));
  } else {
    const s = a === 3 ? 8 : 8.5;
    m.push(
      ...burc(K[0] - s / 2 - 1.5, K[1] - s / 2 - 1.5, ust, s, a === 3 ? 10 : 12, tas, 'kirma'),
    );
    m.push(
      ...bayrak(
        K[0] - 1.5 + s / 2,
        K[1] - 1.5 + s / 2,
        ust + (a === 3 ? 10 : 12) + s * 0.6,
        3,
        P.kirmiziBez,
        'y',
        2.4,
        1.4,
      ),
    );
    m.push(
      ...ev(K[0] + 2.8, K[1] - yari + 1.6, ust, 5, 3.4, 3.2, {
        duvar: tas,
        cati: P.arduvaz,
        yon: 'x',
      }),
    );
    m.push(
      ...ev(K[0] - yari + 1.6, K[1] + 2.4, ust, 3.4, 5, 3.2, {
        duvar: tas,
        cati: P.arduvaz,
        yon: 'y',
      }),
    );
    if (a === 5) {
      m.push(
        ...ev(K[0] - 14.5, K[1] - 6, ust - 4.5, 3.8, 6, 3.4, {
          duvar: tas,
          cati: P.arduvaz,
          yon: 'y',
        }),
      );
      m.push(
        ...ev(K[0] + 4, K[1] - 15, ust - 4.5, 6, 3.8, 3.4, {
          duvar: tas,
          cati: P.arduvaz,
          yon: 'x',
        }),
      );
      m.push(...ev(K[0] + 11, K[1] - 15, ust - 4.5, 3.6, 3.6, 3, { duvar: tas, cati: P.kiremit }));
    }
  }
  if (a >= 3) {
    for (const [x, y] of [
      [K[0] - yari - 1.2, K[1] + yari + 1],
      [K[0] + yari + 1, K[1] - yari - 1.2],
    ] as Nokta[])
      m.push(...mesale(x, y, Z(x, y), 2.2));
  }

  // Tepenin eteğinde köy
  const koyEv = a === 1 ? 0 : a === 3 ? 5 : 9;
  const etek = yer(22, 72);
  const evler = evYerleri(
    r,
    etek,
    koyEv,
    2,
    13,
    dolu,
    (x, y) => cizgiyeUzaklik(x, y, nehir) < 7 || h(x, y) > 3,
    (rr) => ({
      sx: 3.6 + rr() * 1.2,
      sy: 3.2 + rr() * 1,
      h: 2.6 + rr() * 0.8,
      o: { cati: rr() < 0.5 ? P.kiremit : P.saman, yon: rr() < 0.5 ? 'x' : 'y', baca: rr() < 0.3 },
    }),
  );
  for (const e of evler)
    m.push(...ev(e.x, e.y, Z(e.x + e.sx / 2, e.y + e.sy / 2), e.sx, e.sy, e.h, e.o));

  // Kaya ve ağaç
  for (let i = 0; i < 10; i++) {
    const aci = r() * Math.PI * 2;
    const rr = (a === 5 ? 20 : yari + 5) + r() * 8;
    const x = K[0] + Math.cos(aci) * rr;
    const y = K[1] + Math.sin(aci) * rr;
    if (cizgiyeUzaklik(x, y, yol) < 2.5) continue;
    m.push(...kaya(x, y, Z(x, y) - 0.3, 1 + r() * 1.3, r));
  }
  const bos = (x: number, y: number) =>
    uzak(dolu, x, y, 1.5) && cizgiyeUzaklik(x, y, nehir) > 6 && cizgiyeUzaklik(x, y, yol) > 2.5;
  m.push(...agaclar(r, Z, 30, bos, { igne: 0.45 }));
  return m;
}

/* ── Taht ──────────────────────────────────────────────────────────── */

function tahtSahnesi(a: Asama, r: () => number, g: Gurultu, ra: () => number): Model {
  const C = yer(50, 54);
  const nehir = yumusat([yer(-12, 36), yer(12, 58), yer(6, 84), yer(20, 120)]);
  let h0: Yukseklik = (x, y) => g(x, y, 26, 3) * 1.6 + arkaTepeler(g, x, y, 40, 18);
  h0 = nehirOy(h0, nehir, 5.5, -1.8);
  const h = duzle(h0, [{ x: C[0] + 2, y: C[1] + 2, r: 24, z: 0.2, kare: true, yumusak: 6 }]);
  const su = -0.5;
  const Z = (x: number, y: number) => Math.max(h(x, y), su);
  const m = arazi({ cerceve: BOLGE_KUTUSU, adim: 4, h, renk: cayir(g, -0.05), su, r: ra });
  const [cx, cy] = C;
  const z0 = 0.2;

  // Taş meydan ve bahçe
  m.push(...doseli(cx - 22, cy - 20, 44, 42, isikla(P.acikTas, 0.9), h));
  m.push(
    ...yerYolu(
      [
        [cx, cy + 20],
        [cx, cy + 60],
      ],
      4,
      isikla(P.acikTas, 0.9),
      h,
    ),
  );

  // Teraslar ve merdivenler
  const z1 = z0 + 2.2;
  const z2 = z1 + 2.2;
  m.push(...teras(cx - 16, cy - 14, z0, 32, 28, 2.2));
  m.push(...merdiven(cx - 3, cy + 14, z0, z1, 6, 3.6));
  m.push(...teras(cx - 11, cy - 10, z1, 22, 18, 2.2, P.acikTas));
  m.push(...merdiven(cx - 2.5, cy + 8, z1, z2, 5, 3));

  // Ana salon: kemerli pencereler, sütunlu giriş, alınlık, kubbe
  const zs = z2;
  const H = 5.5;
  m.push(...kutu(cx - 8, cy - 7, zs, 16, 10, H, P.acikTas));
  for (let u = cx - 7; u < cx + 7; u += 2.4) m.push(...kemer('y', cy + 3, u, zs + 1.2, 1, 3));
  for (let u = cy - 6; u < cy + 2; u += 2.4) m.push(...kemer('x', cx + 8, u, zs + 1.2, 1, 3));
  m.push(...kirmaCati(cx - 8, cy - 7, zs + H, 16, 10, 2.2, a === 1 ? P.kiremit : P.bakir, 0.3));
  m.push(...sutunlar(cx - 5, cx + 5, cy + 6.2, zs, H, 6));
  m.push(...kutu(cx - 5.7, cy + 3, zs + H, 11.4, 3.9, 0.7, P.acikTas));
  m.push(
    ...besikCati(
      cx - 5.7,
      cy + 3,
      zs + H + 0.7,
      11.4,
      3.9,
      2,
      'y',
      a === 1 ? P.kiremit : P.bakir,
      P.acikTas,
      0.2,
    ),
  );
  const kr = a === 5 ? 3.6 : 3;
  m.push(...silindir(cx, cy - 2, zs + H + 1.2, kr, 1.6, P.acikTas, 12));
  m.push(...kubbe(cx, cy - 2, zs + H + 2.8, kr, P.altin, 12, 3));
  m.push(...koni(cx, cy - 2, zs + H + 2.8 + kr, 0.5, 1.6, P.koyuAltin, 6));

  // Köşkler: üst terasın köşelerinde altın külahlı kuleler
  for (const [x, y] of [
    [cx - 9.5, cy - 8.5],
    [cx + 9.5, cy - 8.5],
    [cx - 9.5, cy + 6.5],
    [cx + 9.5, cy + 6.5],
  ] as Nokta[]) {
    m.push(...kosk(x, y, z2, 1.4, a === 1 ? 7 : 8.5, P.acikTas, P.altin));
  }
  m.push(
    ...bayrak(cx + 9.5, cy + 6.5, z2 + (a === 1 ? 7 : 8.5) + 4.6, 3.2, P.kirmiziBez, 'y', 2.6, 1.5),
  );
  m.push(
    ...bayrak(cx - 9.5, cy - 8.5, z2 + (a === 1 ? 7 : 8.5) + 4.6, 3.2, P.kirmiziBez, 'y', 2.6, 1.5),
  );

  // Alt teras: havuzlar, selviler
  m.push(...havuz(cx - 13, cy + 10, z1, 6, 3.2), ...havuz(cx + 5, cy + 10, z1, 6, 3.2));
  for (let u = -14; u <= 14; u += 4) m.push(...selvi(cx + u, cy + 12.8, z1, 4));
  for (let v = -12; v <= 8; v += 4) m.push(...selvi(cx + 14.5, cy + v, z1, 4));

  if (a >= 3) {
    // Yan kanatlar
    for (const kx of [cx - 15.2, cx + 11.4]) {
      m.push(...kutu(kx, cy - 12, z1, 3.8, 11, 4.2, P.acikTas));
      m.push(...kirmaCati(kx, cy - 12, z1 + 4.2, 3.8, 11, 1.8, P.bakir, 0.25));
      m.push(...kemer('y', cy - 1, kx + 1.2, z1 + 0.8, 1.2, 2.6));
    }
    for (const [x, y] of [
      [cx - 22, cy + 17],
      [cx + 18, cy + 17],
    ] as Nokta[])
      m.push(
        ...havuz(x, y, z0, 4, 4),
        ...silindir(x + 2, y + 2, z0 + 0.45, 0.3, 1.6, P.acikTas, 6),
      );
  }
  if (a === 5) {
    // Ön köşelerde ince minareler, merdiven başında altın heykeller, dış sur
    for (const [x, y] of [
      [cx - 17.5, cy + 12.5],
      [cx + 15.5, cy + 12.5],
    ] as Nokta[])
      m.push(...kosk(x, y, z0, 1, 13, P.acikTas, P.altin));
    for (const x of [cx - 4.4, cx + 4.4]) {
      m.push(...kutu(x - 0.6, cy + 15, z0, 1.2, 1.2, 1.4, P.acikTas));
      m.push(...silindir(x, cy + 15.6, z0 + 1.4, 0.35, 2.4, P.altin, 6));
      m.push(...kubbe(x, cy + 15.6, z0 + 3.8, 0.55, P.altin, 6, 2));
    }
    m.push(
      ...kaleSuru(cx - 24, cy - 22, z0, 48, 46, 3.2, {
        renk: P.kumTasi,
        kule: 'kulah',
        kuleR: 1.9,
      }),
    );
  }

  // Bahçenin dışı: ağaçlar
  const bos = (x: number, y: number) =>
    (Math.abs(x - cx) > 25 || Math.abs(y - cy) > 23) &&
    cizgiyeUzaklik(x, y, nehir) > 6.5 &&
    Math.abs(x - cx) > 4;
  m.push(...agaclar(r, Z, 26, bos, { igne: 0.25 }));
  return m;
}

/* ── Giriş noktası ─────────────────────────────────────────────────── */

const SAHNE: Record<BolgeTipi, (a: Asama, r: () => number, g: Gurultu, ra: () => number) => Model> =
  {
    tarla: tarlaSahnesi,
    koy: koySahnesi,
    maden: madenSahnesi,
    sehir: sehirSahnesi,
    kale: kaleSahnesi,
    taht: tahtSahnesi,
  };

/** `tarla_3` → ['tarla', 3]; tanınmayan ad → null. */
export function bolgeAdiCoz(ad: string): [BolgeTipi, Asama] | null {
  const [tip, as] = ad.split('_');
  if (!BOLGE_TIPLERI.includes(tip as BolgeTipi)) return null;
  const asama = as === '5' ? 5 : as === '3' ? 3 : 1;
  return [tip as BolgeTipi, asama];
}

export function bolgeModeli(ad: string): Model {
  const c = bolgeAdiCoz(ad) ?? ['koy', 1];
  const [tip, a] = c;
  // Arazi türün adıyla tohumlanıyor: üç aşama aynı manzarada.
  const g = gurultu('bolge:' + tip);
  const ra = rastgele('arazi:' + tip);
  const r = rastgele('bolge:' + tip + ':' + a);
  return SAHNE[tip](a, r, g, ra);
}
