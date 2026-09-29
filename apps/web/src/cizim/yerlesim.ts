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
 *
 * Kasabanın çevresi YERLEŞKE: arkada tarlalar (saban süren, orak biçen,
 * demet taşıyan köylüler), önde talim alanı (ok atan okçular, kuklaya
 * mızrak saplayan mızrakçılar, mızrak düellosu), yanlarda orman. Aktörler
 * kare kare canlı (`canli.ts`); şehir sayfası yerleşkeyi tam ekran ve
 * kaydırılabilir gösteriyor.
 */
import { BINA_KUTUSU, binaModeli, mizrakSehpasi } from './binalar';
import {
  DEMET_KARE,
  DEMET_SURE,
  DUELLO_KARE,
  DUELLO_SURE,
  MIZRAK_KARE,
  MIZRAK_SURE,
  OKCU_KARE,
  OKCU_SURE,
  ORAK_KARE,
  ORAK_SURE,
  SABAN_KARE,
  SABAN_SURE,
  canlandir,
  demetYigini,
  demetciPoz,
  duelloAlani,
  duelloPoz,
  mizrakciPoz,
  okHedefi,
  okcuPoz,
  orakciPoz,
  sabanPoz,
  seyirci,
} from './canli';
import { cevre } from './cevre';
import { araba, balya } from './kir';
import { agac, cam, cit, duman, fici, kaya, mesale, palisat } from './parca';
import { P, isikla } from './renk';
import { rastgele } from './rastgele';
import {
  birlestir,
  cember,
  dokula,
  dondur,
  katmanla,
  koni,
  kure,
  kutu,
  mazgal,
  olcekle,
  prizma,
  silindir,
  tasi,
  yansitici,
  zemineGeri,
  type Model,
} from './uc';

export type Kademe = 'kamp' | 'koy' | 'kasaba' | 'sehir' | 'kale' | 'metropol';

/** Kasabanın 4:3 çerçevesi (ekran birimi). Binaların yüzdeleri buna göre. */
const EN = 64;
const BOY = 48;
export const KASABA_KUTUSU: [number, number, number, number] = [-EN / 2, -BOY / 2, EN, BOY];

/**
 * Yerleşkenin tamamı (ekran birimi): kasaba ortada, arkada tarlalar, önde
 * talim alanı, yanlarda orman. Şehir sayfası bunu kaydırılabilir gösteriyor.
 */
export const YERLESIM_KUTUSU: [number, number, number, number] = [-48, -44, 96, 100];

/** Ekran yüzdesini dünya noktasına çevirir. */
const geri = zemineGeri();
function yuzdeden(px: number, py: number): [number, number] {
  return geri(-EN / 2 + (EN * px) / 100, -BOY / 2 + (BOY * py) / 100);
}

/** Yapıların ayak bastığı yerler (data/binalar.json ile aynı). */
export const BINA_YUVALARI: Record<string, [number, number]> = {
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
  const [px, py] = BINA_YUVALARI[k]!;
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
  const yuvaNoktalari = Object.keys(BINA_YUVALARI).map(nokta);
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
    ...Object.keys(BINA_YUVALARI)
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
  // Kasabanın üst iki kenarı kadar: daha uzunu surun dışındaki köy
  // evlerinin ve göletin üstünden geçiyordu (`cevre.ts`).
  const L = 46;
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

/* ── Yerleşke: tarlalar, talim alanı, orman ────────────────────────── */

/** Ekran noktasının (yerleşke çerçevesinde) yerdeki karşılığı. */
const ekrandan = (sx: number, sy: number) => geri(sx, sy);

/**
 * Figür biriminde kurulmuş aktörlerin yerleşkedeki ölçeği: insan ~4,5 birim,
 * binaya göre iri (masa oyunu minyatürü gibi): okçunun yayı, mızrakçının
 * hamlesi telefonda seçilsin.
 */
export const YERLESIM_OLCEK = 0.55;

/**
 * Yerel x'i ekranda yataya çeviren dönme. Uzun yol boyunca koşan parça
 * (düello, saban) çapraz dururken kare kutusu hem geniş hem yüksekti ve
 * atlasta yarısı boştu; yatayda yalnız geniş.
 */
const EKRAN_YATAY = -Math.PI / 4;

/** Figür biriminde kurulmuş modeli yerleşkeye koyar: ölçek, yön, ekrandaki yer. */
function koy(m: Model, sx: number, sy: number, yon = 0): Model {
  const [x, y] = ekrandan(sx, sy);
  return tasi(dondur(olcekle(m, YERLESIM_OLCEK), 'z', yon), [x, y, 0]);
}

/** Yere yatık dikdörtgen (dünya ekseninde), kenarsız: tarla, kum alan. */
function yerDortgeni(x0: number, y0: number, x1: number, y1: number, renk: string, k: number) {
  return duz(
    prizma(
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      0,
      0.03,
      renk,
    ),
    k,
  );
}

/**
 * Tarlalar (kasabanın arkası): saban süren köylü ve öküzü, orak biçen iki
 * köylü, demetleri yığına taşıyan kadın, saman arabası.
 */
function tarlalar(): Model {
  const m: Model = [];
  // Sürülen tarla: koyu toprak, iz boyunca çizgiler; saban ortasından geçiyor.
  // Figür biriminde kurulup ekranda yatay dönüyor (iz soldan sağa).
  const tarla: Model = [...yerDortgeni(-30, -9, 30, 9, '#6e5034', -1.4)];
  for (let i = 0; i < 9; i++)
    tarla.push(...yerDortgeni(-29, -8 + i * 2, 29, -7.4 + i * 2, '#5a3f28', -1.3));
  tarla.push(...cit(-31, -10, 62, 'x', P.tahta, 2.2), ...cit(-31, -10, 20, 'y', P.tahta, 2.2));
  tarla.push(...canlandir(sabanPoz, SABAN_KARE, SABAN_SURE, [0, 0, 0], true));
  m.push(...koy(tarla, -20, -35, EKRAN_YATAY));

  // Buğday tarlası: önde anız, arkada ayakta başaklar (sıra sıra); orakçılar arada.
  const [bx, by] = ekrandan(12, -37);
  m.push(...yerDortgeni(bx - 11, by - 9, bx + 11, by + 8, '#b8964e', -1.4));
  for (let y = by - 0.4; y < by + 7.8; y += 1.3)
    m.push(...kutu(bx - 10.6, y, 0, 21.2, 0.9, 1.5, { ust: '#e0bc5c', yan: '#c9a24e' }));
  for (const dx of [-4.5, 3.5]) {
    const [ex, ey] = [bx + dx, by - 2.2];
    m.push(
      ...tasi(olcekle(canlandir(orakciPoz, ORAK_KARE, ORAK_SURE, [dx, 0, 0]), YERLESIM_OLCEK), [
        ex,
        ey,
        0,
      ]),
    );
  }

  // Demetçi ve yığın, saman arabası ve balyalar.
  m.push(
    ...koy(
      birlestir(canlandir(demetciPoz, DEMET_KARE, DEMET_SURE, [0, 0, 0]), demetYigini()),
      29,
      -31,
    ),
  );
  const [ax, ay] = ekrandan(38, -36);
  m.push(
    ...araba(ax, ay, 0, 'y'),
    ...balya(ax + 4, ay - 2, 0, 0.9),
    ...balya(ax + 2, ay - 5, 0, 1),
  );
  return m;
}

/**
 * Talim alanı (kasabanın önü): hedeflere ok atan üç okçu, kuklalara mızrak
 * saplayan üç mızrakçı, ortada mızrak düellosu ve onu izleyen köylüler.
 */
function talimAlani(): Model {
  const m: Model = [];
  // Okçular: yan yana, hedefler ileride (+y); altlarında çiğnenmiş toprak.
  const okcular: Model = [];
  // Ekranda alt alta dizildikleri için aralık geniş: biri ötekini örtmesin.
  for (let i = 0; i < 3; i++) {
    const d = -11 * i;
    okcular.push(
      ...tasi(canlandir(okcuPoz, OKCU_KARE, OKCU_SURE, [0, 0, 0]), [d, 0, 0]),
      ...tasi(okHedefi(), [d, 0, 0]),
    );
  }
  okcular.push(...yerDortgeni(-26, -3, 3, 27, '#7d6848', -1.3));
  // Atış ekranda soldan sağa: okçu profilden, ok yatay uçuyor.
  m.push(...koy(okcular, -38, 28, Math.PI / 4));

  // Mızrakçılar: kuklalara doğru (+x), altlarında kum.
  const mizrakcilar: Model = [];
  for (let i = 0; i < 3; i++)
    mizrakcilar.push(
      ...tasi(canlandir(mizrakciPoz, MIZRAK_KARE, MIZRAK_SURE, [0, 0, 0]), [10 * i, 0, 0]),
    );
  mizrakcilar.push(...yerDortgeni(-4, -4, 24, 15, '#9a8660', -1.3));
  // Hamle ekranda sağdan sola: mızrakçı profilden.
  m.push(...koy(mizrakcilar, 34, 31, (-3 * Math.PI) / 4));
  const [rx, ry] = ekrandan(38, 33);
  m.push(...mizrakSehpasi(rx, ry), ...fici(rx - 2, ry + 3), ...fici(rx - 0.5, ry + 4.2));

  // Düello: perde ortada, yol boyunca kum; iki ucunda çadır.
  const duello = birlestir(
    canlandir(duelloPoz, DUELLO_KARE, DUELLO_SURE, [0, 0, 0], true),
    duelloAlani(),
    yerDortgeni(-30, -6, 30, 6, '#a8936a', -1.3),
  );
  // Koşu yolu ekranda yatay: şövalyeler soldan ve sağdan geliyor.
  m.push(...koy(duello, -2, 46, EKRAN_YATAY));
  // Seyirciler: perdenin arkasında, yolun kenarında.
  for (let i = 0; i < 4; i++) {
    const [px, py] = ekrandan(-11 + i * 6, 37.5 + (i % 2) * 0.8);
    m.push(...tasi(dondur(olcekle(seyirci(i), YERLESIM_OLCEK), 'z', -Math.PI / 4), [px, py, 0]));
  }
  return m;
}

export function yerlesimModeli(kademe: Kademe, binalar: YerlesimBinasi[] = []): Model {
  const r = rastgele('yerlesim:' + kademe);
  const zemin = ZEMIN_RENGI[kademe] ?? ZEMIN_RENGI.koy;
  const m: Model = [];
  // Taban: yerleşke çerçevesini taşan geniş bir düzlem (ekran köşelerinden).
  const [kx, ky, kw, kh] = YERLESIM_KUTUSU;
  const taban = [
    ekrandan(kx - 8, ky - 8),
    ekrandan(kx - 8, ky + kh + 8),
    ekrandan(kx + kw + 8, ky + kh + 8),
    ekrandan(kx + kw + 8, ky - 8),
  ];
  // Çimen (taban ve çimen lekeleri): hareketli sahnede rüzgârda dalgalanıyor.
  m.push(...dokula(katmanla(prizma(taban, -1, 1, zemin), -2), 'cimen'));
  m.push(...dokula(lekeler(r, zemin, 40, 90), 'cimen'));
  const tasli = kademe === 'kale' || kademe === 'metropol';
  if (!tasli) {
    m.push(...dokula(lekeler(r, zemin, 34), 'cimen'));
    // Toprak lekeleri yalnız kampta: köyde ve kasabada kasabanın ortasında
    // anlamsız çamur gölleri gibi duruyordu.
    if (kademe === 'kamp') m.push(...lekeler(r, isikla(P.toprak, 1.05), 12, 28));
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
      m.push(...palisat(kx - 1, ky - 1, 44, 'x', 4), ...palisat(kx - 1, ky - 1, 44, 'y', 4));
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
      m.push(...kasabaDosemesi(isikla(P.acikTas, 0.95)));
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
      m.push(...kasabaDosemesi(isikla(P.acikTas, 0.97)));
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
  // Kasabanın çevresi: arkada tarlalar, önde talim alanı; dere, köy,
  // mera, değirmenler, orman (`cevre.ts`).
  m.push(...tarlalar(), ...talimAlani(), ...cevre(kademe, r));
  for (const b of binalar) m.push(...sahneBinasi(b));
  return m;
}

/** Kasabanın döşemesi (kale, metropol): kasaba çerçevesi kadar, dışı çimen. */
function kasabaDosemesi(renk: string): Model {
  const taban = [yuzdeden(-3, -6), yuzdeden(-3, 106), yuzdeden(103, 106), yuzdeden(103, -6)];
  return katmanla(prizma(taban, 0, 0.04, renk), -1.8);
}

/* ── Binalar sahnede ──────────────────────────────────────────────── */

/**
 * Binanın sayfadaki kutusunun eni, kasaba eninin yüzdesi olarak (× `olcek`).
 * Şehir sayfası dokunma alanını ve rozetleri aynı kutuya koyuyor.
 */
export const BINA_TABAN_BOY = 22;

/** Sahnede çizilen yapı: çizimin adı (`kisla_3`, `arsa`) ve yeri (kasabanın yüzdesi). */
export interface YerlesimBinasi {
  ad: string;
  x: number;
  y: number;
  olcek: number;
}

/**
 * Yerleşke tarifinin adı: kademe ve yapılar (`koy|kisla_3@24,95,1.05|…`).
 * Bina yükselince anahtar değişiyor, sahne yeniden çiziliyor.
 */
export function yerlesimAnahtari(kademe: Kademe, binalar: YerlesimBinasi[] = []): string {
  return [kademe, ...binalar.map((b) => `${b.ad}@${b.x},${b.y},${b.olcek}`)].join('|');
}

/** `yerlesimAnahtari`nın tersi; bozuk parça atlanıyor. */
export function yerlesimAnahtariCoz(ad: string): { kademe: Kademe; binalar: YerlesimBinasi[] } {
  const [kademe = 'koy', ...parcalar] = ad.split('|');
  const binalar: YerlesimBinasi[] = [];
  for (const p of parcalar) {
    const [isim = '', yer = ''] = p.split('@');
    const [x, y, olcek] = yer.split(',').map(Number);
    if (isim && Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(olcek))
      binalar.push({ ad: isim, x: x!, y: y!, olcek: olcek! });
  }
  return { kademe: kademe as Kademe, binalar };
}

/**
 * Binanın yerleşkedeki modeli: kendi çiziminin (`binaModeli`) sayfadaki
 * kutusuna oturduğu yerde ve boyda — dokunma alanı ve rozetler aynı
 * kutuda.
 *
 * Binalar önceden ayrı resimlerdi, her biri kendi kalın toprak plakasının
 * üstünde, kendi ışığı ve gölgesiyle yerleşkenin üstüne yapıştırılıyordu.
 * Oyuncu: "binalar havada uçuyor." Gölgeleri kendi plakalarına düşüyor,
 * yere hiç düşmüyordu. Artık sahnenin içindeler: aynı zeminde, gölgeleri
 * yerleşkenin toprağına düşüyor, ağaçla ve yolla aynı ışıkta. Plaka yok;
 * çimen plakanın yeri zaten çimen, toprak ya da taş olan (arsa, pazar)
 * zemine yapışık bir avlu olarak kalıyor.
 */
function sahneBinasi(b: YerlesimBinasi): Model {
  const [vx, vy, vw, vh] = BINA_KUTUSU;
  const [kx, ky, kw, kh] = KASABA_KUTUSU;
  // Sayfadaki kare kutu (ekran birimi): tabanın ortası (x, y)'de.
  const W = (BINA_TABAN_BOY / 100) * b.olcek * kw;
  const px = kx + (kw * b.x) / 100;
  const py = ky + (kh * b.y) / 100;
  // Çizim kutuya sığdırılıyor ve ortalanıyor (SVG `meet`).
  const s = W / Math.max(vw, vh);
  const [tx, ty] = geri(px - vx * s - (vw * s) / 2, py - W / 2 - vy * s - (vh * s) / 2);
  return tasi(olcekle(plakasiz(binaModeli(b.ad)), s), [tx, ty, 0]);
}

/**
 * Bina plakası (`zeminPlakasi`, katman -2) sahnede yok: yan yüzleri
 * atılıyor, üstü çimense o da (zemin zaten çimen); toprak ya da taşsa
 * zemine yapışık avlu oluyor.
 */
function plakasiz(m: Model): Model {
  const out: Model = [];
  for (const y of m) {
    if (y.katman !== -2) {
      out.push(y);
      continue;
    }
    const ust = y.p.every((q) => q[2] > -0.01);
    if (!ust || y.renk === P.cimen) continue;
    out.push({
      ...y,
      p: y.p.map(([x, yy]) => [x, yy, 0.02]),
      katman: -1.1,
      kenarsiz: true,
    });
  }
  return out;
}

/** Ekrandaki yüzde → dünya (test ve yerleşim hesapları için). */
export const yerlesimNoktasi = yuzdeden;
/** Dünya → ekran yüzdesi (test: geri yansıtma tutarlı mı). */
export function yerlesimYuzdesi(x: number, y: number): [number, number] {
  const [sx, sy] = yansitici()([x, y, 0]);
  return [((sx + EN / 2) / EN) * 100, ((sy + BOY / 2) / BOY) * 100];
}
