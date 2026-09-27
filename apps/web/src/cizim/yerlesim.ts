/**
 * YERLEŞİM ZEMİNİ — kamp, köy, kasaba, şehir, kale, metropol (docs/24).
 *
 * Şehir ekranının arka planı: binalar bunun ÜSTÜNE, `data/binalar.json`
 * içindeki ekran yüzdeleriyle diziliyor. Zemin o noktaları dünyaya geri
 * yansıtıyor (`zemineGeri`) ve yolları, meydanı, çitleri onlara göre
 * kuruyor — patika binanın kapısına çıkıyor.
 *
 * Kademe büyüdükçe zemin de "yerleşiyor": toprak açıklık → patikalar →
 * çitli yollar ve kuyu → taş yollar, meydan, sur → kale avlusu →
 * bahçeli meydan ve çeşme.
 */
import { agac, cam, cit, duman, kaya, mesale, palisat } from './parca';
import { P, isikla } from './renk';
import { rastgele } from './rastgele';
import {
  cember,
  katmanla,
  koni,
  kure,
  kutu,
  mazgal,
  prizma,
  silindir,
  yansitici,
  zemineGeri,
  type Model,
} from './uc';

export type Kademe = 'kamp' | 'koy' | 'kasaba' | 'sehir' | 'kale' | 'metropol';

/** Sahnenin 4:3 çerçevesi (ekran birimi). Binaların yüzdeleri buna göre. */
const EN = 64;
const BOY = 48;
export const YERLESIM_KUTUSU: [number, number, number, number] = [-EN / 2, -BOY / 2, EN, BOY];

/** Ekran yüzdesini dünya noktasına çevirir. */
const geri = zemineGeri();
function yuzdeden(px: number, py: number): [number, number] {
  return geri(-EN / 2 + (EN * px) / 100, -BOY / 2 + (BOY * py) / 100);
}

/** Yapıların ayak bastığı yerler (data/binalar.json ile aynı). */
const YUVALAR: Record<string, [number, number]> = {
  malikane: [51, 53],
  kisla: [24, 95],
  gorev_panosu: [36, 72],
  demirhane: [20, 55],
  hastane: [63, 75],
  pazar: [52, 96],
  surlar: [79, 94],
  karargah: [82, 56],
  kutuphane: [13, 75],
  haberci_kulesi: [15, 31],
  liman: [88, 73],
  elcilik: [45, 30],
  onur_meydani: [77, 32],
};

/** Ayak noktası: binanın sprite'ı tabanından çakılı; yol biraz önüne çıksın. */
const nokta = (k: string): [number, number] => {
  const [px, py] = YUVALAR[k]!;
  return yuzdeden(px, py);
};

/** İki nokta arasında düz, yere yatık şerit (yol). */
function serit(
  a: [number, number],
  b: [number, number],
  gen: number,
  renk: string,
  z = 0.02,
): Model {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * (gen / 2);
  const ny = (dx / l) * (gen / 2);
  return [
    {
      p: [
        [a[0] + nx, a[1] + ny, z],
        [a[0] - nx, a[1] - ny, z],
        [b[0] - nx, b[1] - ny, z],
        [b[0] + nx, b[1] + ny, z],
      ],
      renk,
      ciftYuz: true,
      katman: -1,
      kenarsiz: true,
    },
  ];
}

/** Yere yatık süs (yol, leke, döşeme): kenar çizgisiz — boncuk dizisi gibi görünmesin. */
function duz(m: Model, katman: number): Model {
  return m.map((f) => ({ ...f, katman, kenarsiz: true }));
}

/** Kırık çizgi yol: köşeleri yuvarlatmak için her düğüme bir disk. */
function yol(noktalar: [number, number][], gen: number, renk: string, z = 0.02): Model {
  const m: Model = [];
  for (let i = 0; i < noktalar.length - 1; i++)
    m.push(...serit(noktalar[i]!, noktalar[i + 1]!, gen, renk, z));
  for (const [x, y] of noktalar)
    m.push(...duz(prizma(cember(x, y, gen / 2, 14), z - 0.01, 0.01, renk), -1));
  return m;
}

/**
 * Zemine serpiştirilmiş hafif renk lekeleri: düz yeşil "boyanmış"
 * görünmesin. Büyük, düzensiz ve SİLİK — ilk hâlde belirgin altıgenlerdi
 * ve zemin puantiyeli bir kumaş gibi okunuyordu.
 */
function lekeler(r: () => number, renk: string, adet: number, alan = 34): Model {
  const m: Model = [];
  for (let i = 0; i < adet; i++) {
    const x = (r() - 0.5) * alan * 2;
    const y = (r() - 0.5) * alan * 2;
    const rr = 2.2 + r() * 3.4;
    const n = 9;
    const taban = cember(x, y, rr, n, r() * 3).map(([px, py], j): [number, number] => {
      const k = 0.75 + r() * 0.5 + (j % 2) * 0.05;
      return [x + (px - x) * k, y + (py - y) * k];
    });
    m.push(...duz(prizma(taban, 0, 0.01, isikla(renk, 0.95 + r() * 0.09)), -1.5));
  }
  return m;
}

/** Kıvrımlı patika: iki nokta arası ikinci derece eğri, yana büküm `bukum`. */
function egriYol(
  a: [number, number],
  b: [number, number],
  bukum: number,
  gen: number,
  renk: string,
): Model {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const kx = (a[0] + b[0]) / 2 + (-dy / l) * bukum;
  const ky = (a[1] + b[1]) / 2 + (dx / l) * bukum;
  const n = Math.max(4, Math.round(l / 2));
  const noktalar: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    noktalar.push([
      u * u * a[0] + 2 * u * t * kx + t * t * b[0],
      u * u * a[1] + 2 * u * t * ky + t * t * b[1],
    ]);
  }
  return yol(noktalar, gen, renk);
}

/** Yuvaların dışında kalan kenar bölgelere ağaç/kaya serper. */
function kenarSusu(r: () => number, adet: number, iglecik = 0.4): Model {
  const m: Model = [];
  const yuvaNoktalari = Object.keys(YUVALAR).map(nokta);
  let kalan = adet;
  let deneme = 0;
  while (kalan > 0 && deneme++ < adet * 20) {
    const px = r() * 104 - 2;
    const py = r() * 40 - 6; // üst kenar ve yanlar
    const yan = r() < 0.5;
    const [x, y] = yan
      ? yuzdeden(r() < 0.5 ? r() * 6 - 2 : 96 + r() * 6, r() * 100)
      : yuzdeden(px, py);
    if (yuvaNoktalari.some(([a, b]) => Math.hypot(a - x, b - y) < 6)) continue;
    if (r() < iglecik) m.push(...cam(x, y, 0, r, 0.9 + r() * 0.3));
    else if (r() < 0.8) m.push(...agac(x, y, 0, r, 0.9 + r() * 0.3));
    else m.push(...kaya(x, y, 0, 0.8 + r() * 0.6, r));
    kalan--;
  }
  return m;
}

/** Göbek: malikanenin önü; bütün yollar oraya bağlanıyor. */
function gobek(): [number, number] {
  const [x, y] = nokta('malikane');
  return [x + 3.5, y + 3.5];
}

/**
 * Yol ağı: yapıları EN KISA BAĞLANTI AĞACIYLA (Prim) birbirine bağlar.
 *
 * İlk iki denemede her yapıdan göbeğe ayrı yol vardı: önce dirsekli
 * (ızgara gibi okunuyordu), sonra kıvrımlı (göbekten çıkan bir yıldız).
 * Gerçek köyde patika komşudan komşuya gider; ağaç tam bunu veriyor.
 * Köy ve kasabada kıvrımlı patika, şehirde düz taş yol.
 */
function yolAgi(r: () => number, gen: number, renk: string, egri = false): Model {
  const noktalar: [number, number][] = [
    gobek(),
    ...Object.keys(YUVALAR)
      .filter((k) => k !== 'malikane')
      .map((k): [number, number] => {
        const [x, y] = nokta(k);
        return [x + 1.8, y + 1.8];
      }),
  ];
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
    if (egri) m.push(...egriYol(a, b, (r() - 0.5) * 5, gen, renk));
    else m.push(...yol([a, b], gen, renk));
  }
  return m;
}

/** Arkadaki (üst kenardaki) sur: x ve y eksenleri boyunca iki kol. */
function arkaSur(renk: string, h: number, kuleler: boolean, r: () => number): Model {
  const [kx, ky] = yuzdeden(50, -6);
  const m: Model = [];
  const L = 60;
  m.push(...kutu(kx - 1, ky - 1, 0, L, 2, h, renk));
  m.push(...mazgal(kx - 1, ky - 1, h, L, 2, 'x', renk, 1.2));
  m.push(...kutu(kx - 1, ky - 1, 0, 2, L, h, renk));
  m.push(...mazgal(kx - 1, ky - 1, h, L, 2, 'y', renk, 1.2));
  if (kuleler) {
    for (const [tx, ty] of [
      [kx, ky],
      [kx + 18, ky],
      [kx, ky + 18],
      [kx + 36, ky],
      [kx, ky + 36],
    ] as [number, number][]) {
      m.push(...silindir(tx, ty, 0, 2.6, h + 3.5, renk, 10));
      m.push(...koni(tx, ty, h + 3.5, 3.1, 3.4, P.arduvaz, 10));
    }
  }
  void r;
  return m;
}

/** Zemin: arayüzün koyu tonlarıyla yarışmasın diye bir tık toprağa çekik yeşil. */
const ZEMIN_RENGI: Record<Kademe, string> = {
  kamp: '#56703a',
  koy: '#5e7a3a',
  kasaba: '#627c3c',
  sehir: '#5f783c',
  kale: '#5c7240',
  metropol: '#5f7a3e',
};

export const YERLESIM_KADEMELERI: Kademe[] = ['kamp', 'koy', 'kasaba', 'sehir', 'kale', 'metropol'];

export function yerlesimModeli(kademe: Kademe): Model {
  const r = rastgele('yerlesim:' + kademe);
  const zemin = ZEMIN_RENGI[kademe] ?? ZEMIN_RENGI.koy;
  const m: Model = [];
  // Taban: çerçeveyi taşan geniş bir düzlem.
  m.push(...katmanla(kutu(-60, -60, -1, 120, 120, 1, zemin), -2));
  const tasli = kademe === 'kale' || kademe === 'metropol';
  if (!tasli) {
    m.push(...lekeler(r, zemin, 34));
    m.push(...lekeler(r, isikla(P.toprak, 1.05), kademe === 'kamp' ? 12 : 5, 28));
  }
  const g = gobek();

  switch (kademe) {
    case 'kamp': {
      // Açıklık: toprak halka + ateş, çevrede çadır kazıkları ve kütükler.
      m.push(...katmanla(prizma(cember(g[0], g[1], 7, 9, r()), 0, 0.02, P.toprak), -1.2));
      m.push(...prizma(cember(g[0], g[1], 1.3, 7), 0.02, 0.3, P.kaya));
      const alev = koni(g[0], g[1], 0.3, 0.8, 2, P.ates, 6);
      for (const f of alev) f.isima = 1;
      m.push(...alev, ...duman(g[0] + 0.4, g[1] - 0.2, 3.2, r, 2));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const lx = g[0] + Math.cos(a) * 3.6;
        const ly = g[1] + Math.sin(a) * 3.6;
        m.push(...kutu(lx - 0.9, ly - 0.35, 0, 1.8, 0.7, 0.7, P.koyuTahta));
      }
      m.push(...yolAgi(r, 1.4, isikla(P.toprak, 1.05), true));
      m.push(...kenarSusu(r, 26, 0.6));
      break;
    }
    case 'koy': {
      m.push(...yolAgi(r, 2, P.toprak, true));
      m.push(...katmanla(prizma(cember(g[0], g[1], 4, 10), 0, 0.03, P.toprak), -0.9));
      // Tarla şeritleri (üst sol köşe)
      const [fx, fy] = yuzdeden(30, 8);
      for (let i = 0; i < 5; i++)
        m.push(...kutu(fx + i * 2.2, fy, 0, 1.8, 9, 0.35, i % 2 ? P.saman : isikla(P.saman, 0.85)));
      m.push(...cit(fx - 1, fy - 1, 12, 'x'), ...cit(fx - 1, fy - 1, 11, 'y'));
      m.push(...kenarSusu(r, 22, 0.35));
      break;
    }
    case 'kasaba': {
      m.push(...yolAgi(r, 2.4, isikla(P.toprak, 1.08), true));
      m.push(...katmanla(prizma(cember(g[0], g[1], 5, 10), 0, 0.03, isikla(P.toprak, 1.08)), -0.9));
      // Kuyu
      m.push(
        ...silindir(g[0], g[1], 0, 1.2, 1.1, P.tas, 8),
        ...silindir(g[0], g[1], 1.05, 0.9, 0.1, P.su, 8),
      );
      // Arkada palisat
      const [kx, ky] = yuzdeden(50, -6);
      m.push(...palisat(kx - 1, ky - 1, 50, 'x', 4), ...palisat(kx - 1, ky - 1, 50, 'y', 4));
      m.push(...kenarSusu(r, 16, 0.3));
      break;
    }
    case 'sehir': {
      m.push(...yolAgi(r, 2.6, P.acikTas));
      m.push(...katmanla(prizma(cember(g[0], g[1], 6, 12), 0, 0.05, P.acikTas), -0.9));
      m.push(
        ...katmanla(prizma(cember(g[0], g[1], 5.2, 12), 0.05, 0.05, isikla(P.acikTas, 0.94)), -0.8),
      );
      m.push(
        ...silindir(g[0], g[1], 0.1, 1.4, 0.8, P.tas, 10),
        ...silindir(g[0], g[1], 0.85, 1.1, 0.1, P.su, 10),
      );
      m.push(...arkaSur(P.tas, 5, false, r));
      m.push(...kenarSusu(r, 10, 0.2));
      break;
    }
    case 'kale': {
      // Taş avlu: bütün iç taş döşeli, kenarda sur ve kuleler.
      m.push(...katmanla(kutu(-40, -40, 0, 80, 80, 0.04, isikla(P.acikTas, 0.95)), -1.8));
      for (let i = 0; i < 90; i++) {
        const x = (r() - 0.5) * 60;
        const y = (r() - 0.5) * 60;
        m.push(
          ...duz(
            kutu(x, y, 0.04, 1.6 + r() * 1.4, 1.2 + r(), 0.02, isikla(P.acikTas, 0.9 + r() * 0.14)),
            -1.6,
          ),
        );
      }
      m.push(...yolAgi(r, 2.4, P.tas));
      m.push(...arkaSur(P.tas, 7, true, r));
      for (const k of ['malikane', 'karargah', 'demirhane']) {
        const [x, y] = nokta(k);
        m.push(...mesale(x + 4, y + 1));
      }
      break;
    }
    case 'metropol': {
      m.push(...katmanla(kutu(-40, -40, 0, 80, 80, 0.04, isikla(P.acikTas, 0.97)), -1.8));
      m.push(...yolAgi(r, 3, isikla(P.acikTas, 0.9)));
      // Büyük meydan + çeşme
      m.push(...katmanla(prizma(cember(g[0], g[1], 7.5, 16), 0.04, 0.06, P.acikTas), -0.8));
      m.push(...prizma(cember(g[0], g[1], 2.6, 12), 0.1, 0.8, P.tas));
      m.push(...prizma(cember(g[0], g[1], 2.2, 12), 0.2, 0.75, P.su));
      m.push(...silindir(g[0], g[1], 0.9, 0.35, 2.2, P.acikTas, 8));
      const su = kure(g[0], g[1], 3.3, 0.7, isikla(P.buyu, 0.9), 6, 3);
      for (const f of su) {
        f.saydam = 0.7;
        f.kenarsiz = true;
      }
      m.push(...su);
      // Çit bahçeleri: meydanın dört köşesinde budanmış çalı kareleri
      for (const [dx, dy] of [
        [-9, -9],
        [6, -9],
        [-9, 6],
        [6, 6],
      ] as [number, number][]) {
        const x = g[0] + dx;
        const y = g[1] + dy;
        m.push(...kutu(x, y, 0.04, 3.4, 3.4, 0.9, P.koyuYaprak));
        m.push(...kure(x + 1.7, y + 1.7, 1.4, 0.7, isikla(P.yaprak, 1.1), 6, 3));
      }
      m.push(...arkaSur(P.acikTas, 8, true, r));
      break;
    }
  }
  return m;
}

/** Ekrandaki yüzde → dünya (test ve yerleşim hesapları için). */
export const yerlesimNoktasi = yuzdeden;
/** Dünya → ekran yüzdesi (test: geri yansıtma tutarlı mı). */
export function yerlesimYuzdesi(x: number, y: number): [number, number] {
  const [sx, sy] = yansitici()([x, y, 0]);
  return [((sx + EN / 2) / EN) * 100, ((sy + BOY / 2) / BOY) * 100];
}
