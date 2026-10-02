/**
 * MİMARİ VE DOĞA PARÇALARI (docs/24).
 *
 * Binalar, yerleşimler ve bölge sahneleri bu parçalardan kuruluyor.
 * Parçalar ölçü birimiyle çalışıyor: 1 birim ≈ yarım metre; bir kapı
 * 2×4, bir kat 5 birim yüksek.
 *
 * Duvar yüzü seçimi: kamera +x ve +y yüzlerini görüyor. Pencere, kapı ve
 * kiriş gibi yüzey ayrıntıları yalnız bu iki yüze konuyor — arkadakiler
 * zaten çizilmezdi.
 */
import { P, isikla } from './renk';
import {
  besikCati,
  birlestir,
  cember,
  dilim,
  dondur,
  koni,
  katmanla,
  kure,
  kutu,
  levha,
  normal,
  prizma,
  silindir,
  tasi,
  type Model,
  type V3,
  type Yuz,
} from './uc';

export type Yon = 'x' | 'y';

/* ── Zemin ─────────────────────────────────────────────────────────── */

/**
 * Binanın oturduğu toprak parçası: köşeleri kırık, kenarı hafif oynak.
 * Eski resimlerdeki gibi her yapı kendi küçük arazisinde duruyor.
 */
export function zeminPlakasi(
  x: number,
  y: number,
  sx: number,
  sy: number,
  r: () => number,
  ust: string = P.cimen,
  yan: string = P.toprak,
  kalinlik = 1,
): Model {
  const k = Math.min(sx, sy) * 0.18;
  const oyna = () => (r() - 0.5) * 0.6;
  const taban: [number, number][] = [
    [x + k, y + oyna()],
    [x + sx - k, y + oyna()],
    [x + sx + oyna(), y + k],
    [x + sx + oyna(), y + sy - k],
    [x + sx - k, y + sy + oyna()],
    [x + k, y + sy + oyna()],
    [x + oyna(), y + sy - k],
    [x + oyna(), y + k],
  ];
  return katmanla(prizma(taban, -kalinlik, kalinlik, { ust, yan }), -2);
}

/** Düz taş döşeme / yol (zemin üstünde ince katman). */
export function doseme(x: number, y: number, sx: number, sy: number, renk: string = P.acikTas) {
  return katmanla(kutu(x, y, 0, sx, sy, 0.15, renk), -1);
}

/* ── Duvar ayrıntıları ─────────────────────────────────────────────── */

/**
 * Bir duvar yüzüne yapışık kutu. `yuz` 'x' ise duvar x = `duz` düzleminde
 * (+x'e bakıyor), `u` y ekseni boyunca; 'y' ise y = `duz`, `u` x boyunca.
 * `derin`: yüzden dışarı taşma.
 */
export function yuzeyKutusu(
  yuz: Yon,
  duz: number,
  u: number,
  z: number,
  en: number,
  boy: number,
  derin: number,
  renk: string,
): Model {
  return yuz === 'x'
    ? kutu(duz - 0.02, u, z, derin + 0.02, en, boy, renk)
    : kutu(u, duz - 0.02, z, en, derin + 0.02, boy, renk);
}

/** İnce ayrıntı: yalnız GPU (SVG yedeği çizmiyor; bkz. `Yuz.gpu`). */
export function ince(m: Model): Model {
  for (const y of m) y.gpu = true;
  return m;
}

/**
 * Pencere: koyu boşluk + çerçeve; `isikli` ise içeriden sıcak ışık. Üstüne
 * (yalnız GPU) haç biçimli kayıt ve denizlik; `kepenk` verilirse iki yanda
 * açık kepenk (boyalı tahta). Düz bir boşluk "pencere" diye okunmuyordu.
 */
export function pencere(
  yuz: Yon,
  duz: number,
  u: number,
  z: number,
  en = 1.4,
  boy = 1.8,
  isikli = false,
  cerceve: string = P.koyuTahta,
  kepenk?: string,
): Model {
  const m = yuzeyKutusu(yuz, duz, u - 0.2, z - 0.2, en + 0.4, boy + 0.4, 0.12, cerceve);
  const ic = yuzeyKutusu(yuz, duz, u, z, en, boy, 0.16, isikli ? '#e8a84a' : '#231a14');
  if (isikli) for (const y of ic) y.isima = 0.6;
  const ayrinti: Model = [
    // Kayıt: dikey ve yatay çıta.
    ...yuzeyKutusu(yuz, duz, u + en / 2 - 0.06, z, 0.12, boy, 0.22, cerceve),
    ...yuzeyKutusu(yuz, duz, u, z + boy * 0.55, en, 0.1, 0.22, cerceve),
    // Denizlik.
    ...yuzeyKutusu(yuz, duz, u - 0.35, z - 0.34, en + 0.7, 0.14, 0.34, isikla(cerceve, 1.3)),
  ];
  if (kepenk) {
    const k = boy + 0.3;
    ayrinti.push(
      ...yuzeyKutusu(yuz, duz, u - 0.86, z - 0.15, 0.6, k, 0.08, kepenk),
      ...yuzeyKutusu(yuz, duz, u + en + 0.26, z - 0.15, 0.6, k, 0.08, kepenk),
      // Kepenk tahtalarının arası (ince koyu çizgi).
      ...yuzeyKutusu(yuz, duz, u - 0.58, z - 0.15, 0.05, k, 0.1, isikla(kepenk, 0.7)),
      ...yuzeyKutusu(yuz, duz, u + en + 0.54, z - 0.15, 0.05, k, 0.1, isikla(kepenk, 0.7)),
    );
  }
  return birlestir(m, ic, ince(ayrinti));
}

/**
 * Kapı: kanat + söve; üstüne (yalnız GPU) lento, önünde taş basamak, kanatta
 * tahta aralıkları ve demir halka.
 */
export function kapi(
  yuz: Yon,
  duz: number,
  u: number,
  z: number,
  en = 2,
  boy = 3.4,
  renk: string = P.koyuTahta,
): Model {
  const koyu = isikla(renk, 0.7);
  const basamak =
    yuz === 'x'
      ? kutu(duz, u - 0.35, z, 0.75, en + 0.7, 0.24, P.acikTas)
      : kutu(u - 0.35, duz, z, en + 0.7, 0.75, 0.24, P.acikTas);
  return birlestir(
    yuzeyKutusu(yuz, duz, u - 0.25, z, en + 0.5, boy + 0.3, 0.1, isikla(renk, 0.8)),
    yuzeyKutusu(yuz, duz, u, z, en, boy, 0.16, renk),
    ince([
      ...yuzeyKutusu(yuz, duz, u - 0.5, z + boy + 0.3, en + 1, 0.38, 0.3, koyu),
      ...yuzeyKutusu(yuz, duz, u + en / 3 - 0.03, z, 0.06, boy, 0.19, koyu),
      ...yuzeyKutusu(yuz, duz, u + (en * 2) / 3 - 0.03, z, 0.06, boy, 0.19, koyu),
      ...yuzeyKutusu(yuz, duz, u + en * 0.74, z + boy * 0.46, 0.16, 0.16, 0.26, P.demir),
      ...basamak,
    ]),
  );
}

/** Duvar feneri: dirsek, içi yanan küçük kafes, koyu başlık (yalnız GPU). */
export function fener(yuz: Yon, duz: number, u: number, z: number): Model {
  const dis = (d: number, a: number, w: number, zz: number, h: number, sw: number, renk: string) =>
    yuz === 'x'
      ? kutu(duz + d, u + a, zz, sw, w, h, renk)
      : kutu(u + a, duz + d, zz, w, sw, h, renk);
  const isik = dis(0.32, -0.16, 0.32, z - 0.5, 0.42, 0.32, '#ffc860');
  for (const y of isik) y.isima = 1;
  return ince([
    ...dis(0, -0.05, 0.1, z + 0.05, 0.1, 0.5, P.demir),
    ...dis(0.27, -0.21, 0.42, z - 0.08, 0.12, 0.42, '#2a2420'),
    ...isik,
    ...dis(0.27, -0.21, 0.42, z - 0.6, 0.1, 0.42, '#2a2420'),
  ]);
}

/** Tabelanın simgesi: tahtanın görünen yüzünde, tahta biriminde (0..1) dikdörtgenler. */
export type Ikon =
  'ors' | 'hac' | 'kitap' | 'kese' | 'kilic' | 'kalkan' | 'capa' | 'mektup' | 'sancak';

const IKON: Record<Ikon, { zemin: string; parca: [number, number, number, number, string][] }> = {
  ors: {
    zemin: '#c9a878',
    parca: [
      [0.18, 0.5, 0.56, 0.16, '#3a3a40'],
      [0.08, 0.54, 0.14, 0.08, '#3a3a40'],
      [0.36, 0.3, 0.24, 0.22, '#3a3a40'],
      [0.28, 0.2, 0.4, 0.1, '#3a3a40'],
    ],
  },
  hac: {
    zemin: '#efe8d8',
    parca: [
      [0.4, 0.18, 0.18, 0.64, '#b8322a'],
      [0.18, 0.42, 0.64, 0.18, '#b8322a'],
    ],
  },
  kitap: {
    zemin: '#c9a878',
    parca: [
      [0.2, 0.22, 0.6, 0.56, '#6a3a2a'],
      [0.26, 0.28, 0.48, 0.44, '#efe3c0'],
      [0.48, 0.22, 0.04, 0.56, '#6a3a2a'],
    ],
  },
  kese: {
    zemin: '#7a5a3a',
    parca: [
      [0.3, 0.22, 0.4, 0.4, '#e2b64a'],
      [0.22, 0.3, 0.56, 0.24, '#e2b64a'],
      [0.4, 0.62, 0.2, 0.12, '#b08a3a'],
    ],
  },
  kilic: {
    zemin: '#7a3f30',
    parca: [
      [0.46, 0.3, 0.08, 0.52, '#d8dde2'],
      [0.3, 0.3, 0.4, 0.08, '#b08a3a'],
      [0.46, 0.16, 0.08, 0.14, '#6a4a2a'],
    ],
  },
  kalkan: {
    zemin: '#c9a878',
    parca: [
      [0.24, 0.36, 0.52, 0.44, '#9a2a24'],
      [0.32, 0.22, 0.36, 0.16, '#9a2a24'],
      [0.46, 0.22, 0.08, 0.58, '#e2b64a'],
    ],
  },
  capa: {
    zemin: '#c9a878',
    parca: [
      [0.46, 0.22, 0.08, 0.56, '#3a4450'],
      [0.24, 0.22, 0.52, 0.08, '#3a4450'],
      [0.36, 0.7, 0.28, 0.07, '#3a4450'],
      [0.2, 0.22, 0.07, 0.16, '#3a4450'],
      [0.73, 0.22, 0.07, 0.16, '#3a4450'],
    ],
  },
  mektup: {
    zemin: '#7a5a3a',
    parca: [
      [0.2, 0.32, 0.6, 0.36, '#efe3c0'],
      [0.14, 0.3, 0.1, 0.4, '#c9a26a'],
      [0.76, 0.3, 0.1, 0.4, '#c9a26a'],
      [0.44, 0.38, 0.12, 0.1, '#b8322a'],
    ],
  },
  sancak: {
    zemin: '#c9a878',
    parca: [
      [0.28, 0.16, 0.06, 0.7, '#4a3020'],
      [0.34, 0.5, 0.42, 0.3, '#9a2a24'],
      [0.34, 0.5, 0.42, 0.06, '#e2b64a'],
    ],
  },
};

/**
 * Asma tabela: duvardan dışarı uzanan dirsek, altında duvara dik sallanan
 * tahta, görünen yüzünde yapının simgesi (örs, haç, kitap...). Yapı bir
 * bakışta ne olduğunu söylüyor (yalnız GPU).
 */
export function tabela(yuz: Yon, duz: number, u: number, z: number, ikon: Ikon): Model {
  const { zemin, parca } = IKON[ikon];
  const B = 1.0;
  const m: Model = [];
  if (yuz === 'y') {
    // Dirsek +y boyunca; tahta x'e dik, görünen yüzü +x.
    m.push(...kutu(u - 0.06, duz, z, 0.12, 1.45, 0.12, P.demir));
    m.push(...kutu(u - 0.06, duz + 0.3, z - 0.15, 0.12, 0.05, 0.15, P.demir));
    m.push(...kutu(u - 0.06, duz + 1.2, z - 0.15, 0.12, 0.05, 0.15, P.demir));
    m.push(...kutu(u - 0.06, duz + 0.25, z - 0.15 - B, 0.12, B, B, zemin));
    for (const [a, b, w, h, renk] of parca)
      m.push(
        ...yuzeyKutusu(
          'x',
          u + 0.06,
          duz + 0.25 + (1 - a - w) * B,
          z - 0.15 - B + b * B,
          w * B,
          h * B,
          0.04,
          renk,
        ),
      );
  } else {
    m.push(...kutu(duz, u - 0.06, z, 1.45, 0.12, 0.12, P.demir));
    m.push(...kutu(duz + 0.3, u - 0.06, z - 0.15, 0.05, 0.12, 0.15, P.demir));
    m.push(...kutu(duz + 1.2, u - 0.06, z - 0.15, 0.05, 0.12, 0.15, P.demir));
    m.push(...kutu(duz + 0.25, u - 0.06, z - 0.15 - B, B, 0.12, B, zemin));
    for (const [a, b, w, h, renk] of parca)
      m.push(
        ...yuzeyKutusu(
          'y',
          u + 0.06,
          duz + 0.25 + a * B,
          z - 0.15 - B + b * B,
          w * B,
          h * B,
          0.04,
          renk,
        ),
      );
  }
  return ince(m);
}

/**
 * Yarı ahşap (fachwerk) kirişler: sıvalı bir kutunun iki görünen yüzüne
 * köşe dikmeleri, üst-alt kuşak ve çapraz payandalar.
 */
export function kirisler(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  renk: string = P.koyuTahta,
): Model {
  const k = 0.35;
  const m: Model = [];
  const X = x + sx;
  const Y = y + sy;
  // +x yüzü (x = X), u = y ekseni
  m.push(...yuzeyKutusu('x', X, y, z, k, sz, 0.08, renk));
  m.push(...yuzeyKutusu('x', X, Y - k, z, k, sz, 0.08, renk));
  m.push(...yuzeyKutusu('x', X, y, z + sz - k, sy, k, 0.08, renk));
  m.push(...yuzeyKutusu('x', X, y, z, sy, k, 0.08, renk));
  // +y yüzü (y = Y), u = x ekseni
  m.push(...yuzeyKutusu('y', Y, x, z, k, sz, 0.08, renk));
  m.push(...yuzeyKutusu('y', Y, X - k, z, k, sz, 0.08, renk));
  m.push(...yuzeyKutusu('y', Y, x, z + sz - k, sx, k, 0.08, renk));
  m.push(...yuzeyKutusu('y', Y, x, z, sx, k, 0.08, renk));
  // Ara dikmeler ve çaprazlar (yüzün ortası)
  const ara = (yuz: Yon, duz: number, u0: number, uzun: number) => {
    const orta = u0 + uzun / 2 - k / 2;
    m.push(...yuzeyKutusu(yuz, duz, orta, z, k, sz, 0.08, renk));
    // Çapraz: ince bir levha şeridi (dörtgen), duvarın hemen önünde.
    const d = duz + 0.1;
    const a = u0 + k;
    const b = orta;
    const p = (uu: number, zz: number): V3 => (yuz === 'x' ? [d, uu, zz] : [uu, d, zz]);
    const t = k * 0.9;
    const serit = (u1: number, z1: number, u2: number, z2: number) =>
      m.push({
        p:
          yuz === 'x'
            ? [p(u1, z1), p(u2, z2), p(u2, z2 + t), p(u1, z1 + t)]
            : [p(u1, z1 + t), p(u2, z2 + t), p(u2, z2), p(u1, z1)],
        renk,
        ciftYuz: true,
      });
    serit(a, z + k, b, z + sz - k - t);
  };
  if (sy > 5) ara('x', X, y, sy);
  if (sx > 5) ara('y', Y, x, sx);
  return m;
}

/**
 * Taş dokusu: duvar yüzüne serpiştirilmiş, bir tık açık/koyu taşlar.
 * Düz renkli bir kutuyu "örülmüş" gösteren tek şey bu.
 */
export function tasDokusu(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  renk: string,
  r: () => number,
  sik = 0.18,
): Model {
  const m: Model = [];
  const tek = (yuz: Yon, duz: number, u0: number, uzun: number) => {
    const sayi = Math.floor(uzun * sz * sik * 0.5);
    for (let i = 0; i < sayi; i++) {
      const en = 0.8 + r() * 1;
      const boy = 0.45 + r() * 0.35;
      const u = u0 + 0.3 + r() * Math.max(0.1, uzun - en - 0.6);
      const zz = z + 0.3 + r() * Math.max(0.1, sz - boy - 0.6);
      m.push(...yuzeyKutusu(yuz, duz, u, zz, en, boy, 0.07, isikla(renk, 0.88 + r() * 0.24)));
    }
  };
  tek('x', x + sx, y, sy);
  tek('y', y + sy, x, sx);
  return m;
}

/* ── Çatı ayrıntıları ──────────────────────────────────────────────── */

export function baca(x: number, y: number, z: number, h: number, renk: string = P.tas): Model {
  return birlestir(
    kutu(x, y, z, 1.2, 1.2, h, renk),
    kutu(x - 0.15, y - 0.15, z + h, 1.5, 1.5, 0.35, isikla(renk, 0.85)),
  );
}

/** Duman: yükseldikçe büyüyüp solan birkaç yumru. */
export function duman(x: number, y: number, z: number, r: () => number, adet = 3): Model {
  const m: Model = [];
  for (let i = 0; i < adet; i++) {
    const kuruk = kure(
      x + i * 0.5,
      y - i * 0.3,
      z + i * 1.3,
      0.55 + i * 0.3,
      '#ddd8cf',
      6,
      3,
      0.2,
      r,
    );
    for (const y2 of kuruk) {
      y2.saydam = 0.55 - i * 0.15;
      y2.kenarsiz = true;
      y2.duman = [x, y, z];
    }
    m.push(...kuruk);
  }
  return m;
}

/* ── Nesneler ──────────────────────────────────────────────────────── */

/** Bayrak kumaşının dilim sayısı: dalga dilim dilim kırılıyor. */
const BEZ_DILIM = 6;
/** Durağan bayrağın (SVG, hareketsiz sahne) dalga evresi. */
export const BAYRAK_FAZ = 1.9;
/** Durağan sancağın (ve ağacın) evresi: salınımın ortası. */
export const SANCAK_FAZ = 0;
/**
 * Bir turun süresi (sn): direkteki bayrak rüzgârda çırpınıyor, askıdaki
 * sancak ağır ağır salınıyor, ağaç daha da yavaş.
 */
export const BAYRAK_SURE = 1.2;
export const SANCAK_SURE = 3.2;
export const AGAC_SURE = 4.4;
/** Askerin duruşu: ağırlığını bir ayağından öbürüne verir gibi, ağır. */
export const ASKER_SURE = 3.6;

/**
 * Sarkaç salınımı (sancak, ağaç): bağlı uçtan oran `u`, evre `faz`. Uç
 * sarkaç gibi (u²), üstüne hafif bir kıvrım. İki sabit biçimin toplamı:
 * sin(faz)·a(u) + cos(faz)·b(u) — kareler ağı bir kez kurup köşeleri
 * bununla kaydırıyor (`salinimBicimi`).
 */
const SALINIM_KIVRIM = 2 * Math.PI * 0.9;
export function salinimBicimi(u: number, kivrim = 0.25): [number, number] {
  return [
    u * u - kivrim * u * Math.cos(SALINIM_KIVRIM * u),
    kivrim * u * Math.sin(SALINIM_KIVRIM * u),
  ];
}
export function salinim(u: number, faz: number, kivrim?: number): number {
  const [a, b] = salinimBicimi(u, kivrim);
  return Math.sin(faz) * a + Math.cos(faz) * b;
}

/** Kumaşın durağan hâlinin evresi: sancakta salınımın ortası, bayrakta dalganın bir anı. */
export const bezFazi = (y: Yuz): number => (y.bez?.yon ? SANCAK_FAZ : BAYRAK_FAZ);
/** Dalga: kumaş boyunda kaç dalga boyu, genlik kumaş boyunun kaçta kaçı. */
const BEZ_DALGA = 1.1;
const BEZ_GENLIK = 0.16;

/**
 * Kumaşın bir anı (`Yuz.bez`): dinlenik düz hâlinden, direkten uca büyüyen
 * ve uca doğru yürüyen bir dalga (`faz` arttıkça tepe uca kayıyor). Direk
 * kenarı yerinde, genlik kumaşın boyuyla orantılı. Köşe normali dalganın
 * eğiminden: kumaş kıvrımlı gölgeleniyor, dilimler arasında çizgi yok.
 */
export function bezAni(y: Yuz, faz: number): Yuz {
  const { dinlenik: d, u, yon, kivrim } = y.bez!;
  if (yon) {
    // Askıdaki sancak: çubuğa bağlı üst kenar yerinde, uç duvar boyunca
    // sarkaç gibi salınıyor; üstüne kumaş boyunca hafif bir kıvrım.
    const p = d.map((q, i): V3 => {
      const s = salinim(u[i]!, faz, kivrim);
      return [q[0] + yon[0] * s, q[1] + yon[1] * s, q[2] + yon[2] * s];
    });
    return { ...y, p };
  }
  const n = normal(d);
  // Kumaş boyunca yön ve kumaşın boyu: oranı farklı iki köşeden.
  let t: V3 = [0, 0, 0];
  let boy = 0;
  for (let i = 1; i < d.length && !boy; i++) {
    const du = u[i]! - u[0]!;
    if (Math.abs(du) < 1e-6) continue;
    const f: V3 = [d[i]![0] - d[0]![0], d[i]![1] - d[0]![1], 0];
    const l = Math.hypot(f[0], f[1]);
    boy = l / Math.abs(du);
    t = [(f[0] / l) * Math.sign(du), (f[1] / l) * Math.sign(du), 0];
  }
  const a = BEZ_GENLIK * boy;
  const w = 2 * Math.PI * BEZ_DALGA;
  const p: V3[] = [];
  const vn: V3[] = [];
  d.forEach((q, i) => {
    const k = u[i]!;
    const th = w * k - faz;
    const s = a * k * Math.sin(th);
    // Eğim (kumaş boyunca birim uzunluk başına sapma) normali yatırıyor.
    const e = boy ? (a * (Math.sin(th) + k * w * Math.cos(th))) / boy : 0;
    p.push([q[0] + n[0] * s, q[1] + n[1] * s, q[2] + n[2] * s]);
    const m: V3 = [n[0] - t[0] * e, n[1] - t[1] * e, n[2]];
    const l = Math.hypot(m[0], m[1], m[2]) || 1;
    vn.push([m[0] / l, m[1] / l, m[2] / l]);
  });
  return { ...y, p, vn };
}

/**
 * Direk + dalgalı bayrak. `yon` bayrağın açıldığı eksen. Kumaş dilimli ve
 * dinlenik hâlini taşıyor (`Yuz.bez`): hareketli sahnede dalgalanıyor.
 */
export function bayrak(
  x: number,
  y: number,
  z: number,
  h: number,
  renk: string,
  yon: Yon = 'y',
  en = 2.6,
  boy = 1.6,
): Model {
  const direk = silindir(x, y, z, 0.12, h, P.koyuTahta, 5);
  const t = z + h - 0.2;
  const u = (d: number) => (yon === 'y' ? ([x, y + d] as const) : ([x + d, y] as const));
  // Uç biraz aşağıda: kumaş kendi ağırlığıyla sarkıyor.
  const sarkma = 0.25;
  const bez: Model = [];
  for (let i = 0; i < BEZ_DILIM; i++) {
    const k0 = i / BEZ_DILIM;
    const k1 = (i + 1) / BEZ_DILIM;
    const [a0, a1] = u(k0 * en);
    const [b0, b1] = u(k1 * en);
    const dinlenik: V3[] = [
      [a0, a1, t - sarkma * k0],
      [b0, b1, t - sarkma * k1],
      [b0, b1, t - sarkma * k1 - boy],
      [a0, a1, t - sarkma * k0 - boy],
    ];
    const [y0] = levha(dinlenik, renk);
    bez.push(
      bezAni(
        { ...y0!, yumusak: true, bez: { dinlenik, u: [k0, k1, k1, k0], kok: [x, y, t] } },
        BAYRAK_FAZ,
      ),
    );
  }
  return birlestir(direk, bez, koni(x, y, z + h, 0.22, 0.4, P.altin, 5));
}

/** Sancağın kumaşı kaç kat: salınımda kumaş katlar arasında kıvrılıyor. */
const SANCAK_KAT = 4;
/** Sancak ucunun salınımı, kumaş boyunun kaçta kaçı (hafif). */
const SANCAK_GENLIK = 0.09;

/**
 * Uzun dikey sancak (duvara asılı kumaş). Kumaş katlı ve dinlenik hâlini
 * taşıyor (`Yuz.bez`, `yon` duvar boyunca): hareketli sahnede askı
 * çubuğundan yavaşça salınıyor.
 */
export function sancak(yuz: Yon, duz: number, u: number, z: number, renk: string, boy = 3): Model {
  const uzun = boy + 0.5;
  const yon: V3 = yuz === 'x' ? [0, SANCAK_GENLIK * uzun, 0] : [SANCAK_GENLIK * uzun, 0, 0];
  const bezle = (m: Model) =>
    m.map((y) =>
      bezAni(
        {
          ...y,
          bez: { dinlenik: y.p, u: y.p.map((q) => (z - q[2]) / uzun), yon, kok, sure: SANCAK_SURE },
        },
        SANCAK_FAZ,
      ),
    );
  const kok: V3 = yuz === 'x' ? [duz, u + 0.6, z] : [u + 0.6, duz, z];
  const kumas: Model = [];
  for (let i = 0; i < SANCAK_KAT; i++) {
    const h = boy / SANCAK_KAT;
    kumas.push(...yuzeyKutusu(yuz, duz, u, z - (i + 1) * h, 1.2, h, 0.06, renk));
  }
  const ucu = yuzeyKutusu(yuz, duz, u + 0.3, z - boy - 0.5, 0.6, 0.5, 0.06, renk);
  return birlestir(
    bezle(kumas),
    bezle(ucu),
    yuzeyKutusu(yuz, duz, u - 0.2, z, 1.6, 0.2, 0.12, P.koyuTahta),
  );
}

export function cit(
  x: number,
  y: number,
  uzunluk: number,
  yon: Yon,
  renk: string = P.tahta,
  h = 1.6,
): Model {
  const m: Model = [];
  const n = Math.max(2, Math.round(uzunluk / 2) + 1);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * uzunluk;
    const [px, py] = yon === 'x' ? [x + t, y] : [x, y + t];
    m.push(...kutu(px - 0.15, py - 0.15, 0, 0.3, 0.3, h, isikla(renk, 0.9)));
  }
  const ray = (z: number) =>
    yon === 'x'
      ? kutu(x, y - 0.08, z, uzunluk, 0.16, 0.22, renk)
      : kutu(x - 0.08, y, z, 0.16, uzunluk, 0.22, renk);
  m.push(...ray(h * 0.45), ...ray(h * 0.85));
  return m;
}

/** Sivri kazıklı çit (palisat): ahşap surun kendisi. */
export function palisat(x: number, y: number, uzunluk: number, yon: Yon, h = 6): Model {
  const m: Model = [];
  const n = Math.max(2, Math.round(uzunluk / 0.9));
  const adim = uzunluk / n;
  for (let i = 0; i < n; i++) {
    const t = i * adim + adim / 2;
    const [px, py] = yon === 'x' ? [x + t, y] : [x, y + t];
    const hh = h + ((i * 37) % 5) * 0.12;
    const renk = i % 2 ? P.tahta : isikla(P.tahta, 0.9);
    m.push(...silindir(px, py, 0, adim * 0.5, hh, renk, 5));
    m.push(...koni(px, py, hh, adim * 0.5, 0.9, isikla(renk, 1.05), 5));
  }
  return m;
}

export function fici(x: number, y: number, z = 0): Model {
  return birlestir(
    silindir(x, y, z, 0.7, 1.6, { ust: P.acikTahta, yan: P.tahta }, 8),
    silindir(x, y, z + 0.25, 0.74, 0.18, P.demir, 8),
    silindir(x, y, z + 1.2, 0.74, 0.18, P.demir, 8),
  );
}

export function sandik(x: number, y: number, z = 0, s = 1.3): Model {
  return birlestir(
    kutu(x, y, z, s, s, s, { ust: P.acikTahta, yan: P.tahta }),
    kutu(x - 0.05, y - 0.05, z + s * 0.4, s + 0.1, s + 0.1, s * 0.18, P.koyuTahta),
  );
}

/** Yapraklı ağaç: gövde + iki üç yumru taç. */
/** Rüzgâr: ekranda yatay (varsayılan kamerada), dünyada sabit yön. */
const RUZGAR: V3 = [-Math.SQRT1_2, Math.SQRT1_2, 0];
/** Ağacın tepesinin salınımı, boyunun kaçta kaçı (hafif). */
const AGAC_GENLIK = 0.05;

/**
 * Ağacı rüzgâra bağlar (`Yuz.bez`): kök yerinde, yükseldikçe daha çok,
 * tepe yavaşça salınıyor. `boy` kökten tepeye.
 */
function ruzgarla(m: Model, x: number, y: number, z: number, boy: number): Model {
  const yon: V3 = [RUZGAR[0] * AGAC_GENLIK * boy, RUZGAR[1] * AGAC_GENLIK * boy, 0];
  const kok: V3 = [x, y, z];
  return m.map((f) =>
    bezAni(
      {
        ...f,
        bez: {
          dinlenik: f.p,
          u: f.p.map((q) => Math.min(1, Math.max(0, (q[2] - z) / boy))),
          yon,
          kok,
          sure: AGAC_SURE,
        },
      },
      SANCAK_FAZ,
    ),
  );
}

export function agac(x: number, y: number, z: number, r: () => number, olcek = 1): Model {
  const h = (2.2 + r() * 1.2) * olcek;
  const tac = 1.7 * olcek + r() * 0.6;
  const renk = r() > 0.5 ? P.yaprak : P.koyuYaprak;
  const govde = birlestir(
    silindir(x, y, z, 0.3 * olcek, h, P.koyuTahta, 5),
    kure(x, y, z + h + tac * 0.5, tac, renk, 6, 3, 0.18, r),
    kure(
      x + tac * 0.5,
      y - tac * 0.3,
      z + h + tac * 0.1,
      tac * 0.7,
      isikla(renk, 1.08),
      6,
      3,
      0.2,
      r,
    ),
  );
  return ruzgarla(govde, x, y, z, h + tac * 1.5);
}

/** İğne yapraklı: gövde + üst üste iki üç koni. */
export function cam(x: number, y: number, z: number, r: () => number, olcek = 1): Model {
  const renk = r() > 0.5 ? P.koyuYaprak : '#2f4f2c';
  const m = silindir(x, y, z, 0.28 * olcek, 1.4 * olcek, P.koyuTahta, 5);
  const kat = 3;
  for (let i = 0; i < kat; i++) {
    const rr = (2.1 - i * 0.55) * olcek;
    m.push(
      ...koni(x, y, z + (1.2 + i * 1.5) * olcek, rr, 2.4 * olcek, isikla(renk, 1 + i * 0.06), 7),
    );
  }
  return ruzgarla(m, x, y, z, (1.2 + (kat - 1) * 1.5 + 2.4) * olcek);
}

export function kaya(
  x: number,
  y: number,
  z: number,
  s: number,
  r: () => number,
  renk: string = P.kaya,
): Model {
  return kure(x, y, z + s * 0.3, s, renk, 6, 3, 0.3, r, 0.7);
}

/** Çadır: iki eğimli bez, önü açık. */
export function cadir(
  x: number,
  y: number,
  sx: number,
  sy: number,
  h: number,
  renk: string = P.cadir,
  yon: Yon = 'x',
): Model {
  const bez = besikCati(x, y, 0, sx, sy, h, yon, renk, isikla(renk, 0.92), 0.2);
  const direk =
    yon === 'x'
      ? silindir(x + sx + 0.3, y + sy / 2, 0, 0.12, h + 0.8, P.koyuTahta, 5)
      : silindir(x + sx / 2, y + sy + 0.3, 0, 0.12, h + 0.8, P.koyuTahta, 5);
  // Açık kapı: alın üçgeninin ortasında koyu üçgen.
  const kapiUcgen: Model =
    yon === 'x'
      ? levha(
          [
            [x + sx + 0.03, y + sy / 2 - sy * 0.18, 0],
            [x + sx + 0.03, y + sy / 2 + sy * 0.18, 0],
            [x + sx + 0.03, y + sy / 2, h * 0.62],
          ],
          '#2a1e14',
        )
      : levha(
          [
            [x + sx / 2 + sx * 0.18, y + sy + 0.03, 0],
            [x + sx / 2 - sx * 0.18, y + sy + 0.03, 0],
            [x + sx / 2, y + sy + 0.03, h * 0.62],
          ],
          '#2a1e14',
        );
  return birlestir(bez, direk, kapiUcgen);
}

/**
 * Çizgili tente: eğik düzlem, sırayla iki renk. Pazarın imzası.
 * Yapının +y yüzünün önüne, `u0`dan başlayarak `uzun` boyunca.
 */
export function tente(
  x0: number,
  y: number,
  z: number,
  uzun: number,
  derin: number,
  renk1: string,
  renk2: string = P.bez,
  serit = 6,
): Model {
  const m: Model = [];
  const w = uzun / serit;
  for (let i = 0; i < serit; i++) {
    const a = x0 + i * w;
    m.push({
      p: [
        [a, y, z],
        [a + w, y, z],
        [a + w, y + derin, z - derin * 0.55],
        [a, y + derin, z - derin * 0.55],
      ],
      renk: i % 2 ? renk2 : renk1,
      ciftYuz: true,
    });
  }
  // Tente direkleri
  m.push(...silindir(x0 + 0.2, y + derin - 0.2, 0, 0.12, z - derin * 0.55, P.koyuTahta, 5));
  m.push(...silindir(x0 + uzun - 0.2, y + derin - 0.2, 0, 0.12, z - derin * 0.55, P.koyuTahta, 5));
  return m;
}

/** Meşale ya da fener: kısa direk + kendinden ışıklı alev. */
export function mesale(x: number, y: number, z = 0, h = 2.2): Model {
  const alev = koni(x, y, z + h, 0.3, 0.8, P.ates, 5);
  for (const f of alev) f.isima = 0.9;
  return birlestir(silindir(x, y, z, 0.1, h, P.koyuTahta, 4), alev);
}

/** Yuvarlak kule gövdesi + mazgallı taç. */
export function yuvarlakKule(
  cx: number,
  cy: number,
  z: number,
  r: number,
  h: number,
  renk: string = P.tas,
  tac = true,
): Model {
  const m = silindir(cx, cy, z, r, h, renk, 10);
  if (tac) {
    m.push(...silindir(cx, cy, z + h, r + 0.35, 0.5, isikla(renk, 0.95), 10));
    const dis = cember(cx, cy, r + 0.1, 10, 0);
    dis.forEach(([px, py], i) => {
      if (i % 2) return;
      m.push(...kutu(px - 0.4, py - 0.4, z + h + 0.5, 0.8, 0.8, 0.9, renk));
    });
  }
  return m;
}

/** Kemerli açıklık izlenimi: koyu dikdörtgen + yarım daire üst (düz yüzeyde). */
export function kemer(
  yuz: Yon,
  duz: number,
  u: number,
  z: number,
  en: number,
  boy: number,
  renk = '#231a14',
): Model {
  const m = yuzeyKutusu(yuz, duz, u, z, en, boy - en / 2, 0.14, renk);
  const n = 5;
  const cx = u + en / 2;
  const cz = z + boy - en / 2;
  const d = duz + 0.14;
  const noktalar: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    const uu = cx + Math.cos(a) * (en / 2);
    const zz = cz + Math.sin(a) * (en / 2);
    noktalar.push(yuz === 'x' ? [d, uu, zz] : [uu, d, zz]);
  }
  m.push({ p: yuz === 'x' ? noktalar : [...noktalar].reverse(), renk, ciftYuz: true });
  return m;
}

/** Tekne: gövde (kesik prizma) + direk. */
export function tekne(x: number, y: number, uzun: number, yon: Yon = 'x', yelken = false): Model {
  const en = uzun * 0.36;
  const govde: [number, number][] = [
    [0, en * 0.5],
    [uzun * 0.2, 0],
    [uzun * 0.85, 0],
    [uzun, en * 0.5],
    [uzun * 0.85, en],
    [uzun * 0.2, en],
  ];
  let m = birlestir(
    prizma(govde, -0.4, 1.1, { ust: P.acikTahta, yan: P.koyuTahta }),
    kutu(uzun * 0.3, en * 0.15, 0.7, uzun * 0.4, en * 0.7, 0.12, P.tahta),
  );
  if (yelken) {
    m.push(...silindir(uzun * 0.5, en / 2, 0.7, 0.14, uzun * 0.9, P.koyuTahta, 5));
    m.push(
      ...levha(
        [
          [uzun * 0.5, en / 2 - 0.05, uzun * 0.95],
          [uzun * 0.5, en / 2 - 0.05, uzun * 0.3],
          [uzun * 0.15, en / 2 - 0.05, uzun * 0.35],
        ],
        P.bez,
      ),
    );
  }
  if (yon === 'y') m = dondur(m, 'z', Math.PI / 2, [0, 0, 0]);
  return tasi(m, [x, y, 0]);
}

/* ── Serbest parçalar ──────────────────────────────────────────────── */

const fark = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const carp = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const tekle = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * İki nokta arası kare kesitli kiriş: eğik payanda, kafes kule, kürek.
 * Yüzlerin yönü kirişin ekseninden dışarı bakacak şekilde düzeltiliyor.
 */
export function cubuk(a: V3, b: V3, k: number, renk: string): Model {
  const d = tekle(fark(b, a));
  const yard: V3 = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = tekle(carp(d, yard));
  const v = tekle(carp(d, u));
  const h = k / 2;
  const kose = (o: V3, su: number, sv: number): V3 => [
    o[0] + (u[0] * su + v[0] * sv) * h,
    o[1] + (u[1] * su + v[1] * sv) * h,
    o[2] + (u[2] * su + v[2] * sv) * h,
  ];
  const isaret: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const A = isaret.map(([s, t]) => kose(a, s, t));
  const B = isaret.map(([s, t]) => kose(b, s, t));
  const orta: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const yuzler: V3[][] = [A, B];
  for (let i = 0; i < 4; i++) yuzler.push([A[i]!, A[(i + 1) % 4]!, B[(i + 1) % 4]!, B[i]!]);
  return yuzler.map((p) => {
    const c = p.reduce<V3>(
      (s, q) => [s[0] + q[0] / 4, s[1] + q[1] / 4, s[2] + q[2] / 4],
      [0, 0, 0],
    );
    const n = carp(fark(p[1]!, p[0]!), fark(p[2]!, p[0]!));
    const disa = fark(c, orta);
    const ters = n[0] * disa[0] + n[1] * disa[1] + n[2] * disa[2] < 0;
    return { p: ters ? [...p].reverse() : p, renk };
  });
}

/**
 * İki nokta arası sivrilen uzuv (kesik koni): kol, bacak, at boynu, kuyruk.
 * `r1` a ucunda, `r2` b ucunda yarıçap; `n` kenar sayısı.
 */
export function uzuv(a: V3, b: V3, r1: number, r2: number, renk: string, dilimSayisi = 6): Model {
  const n = dilim(dilimSayisi);
  const yuvarlak = n >= 5;
  const d = tekle(fark(b, a));
  const yard: V3 = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = tekle(carp(d, yard));
  const v = tekle(carp(d, u));
  const halka = (o: V3, r: number): V3[] =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2 + Math.PI / n;
      const c = Math.cos(t) * r;
      const s = Math.sin(t) * r;
      return [o[0] + u[0] * c + v[0] * s, o[1] + u[1] * c + v[1] * s, o[2] + u[2] * c + v[2] * s];
    });
  const A = halka(a, r1);
  const B = halka(b, r2);
  const orta: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  // Yan yüz normali: eksenden dışarı + incelmenin eğimi.
  const boy = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
  const N = Array.from({ length: n }, (_, i): V3 => {
    const t = (i / n) * Math.PI * 2 + Math.PI / n;
    const c = Math.cos(t) * boy;
    const s = Math.sin(t) * boy;
    const e = r1 - r2;
    return tekle([
      u[0] * c + v[0] * s + d[0] * e,
      u[1] * c + v[1] * s + d[1] * e,
      u[2] * c + v[2] * s + d[2] * e,
    ]);
  });
  const yuzler: V3[][] = [A, B];
  const normaller: (V3[] | undefined)[] = [undefined, undefined];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    yuzler.push([A[i]!, A[j]!, B[j]!, B[i]!]);
    normaller.push(yuvarlak ? [N[i]!, N[j]!, N[j]!, N[i]!] : undefined);
  }
  return yuzler.map((p, i) => {
    const c = p.reduce<V3>(
      (s, q) => [s[0] + q[0] / p.length, s[1] + q[1] / p.length, s[2] + q[2] / p.length],
      [0, 0, 0],
    );
    const nn = carp(fark(p[1]!, p[0]!), fark(p[2]!, p[0]!));
    const disa = fark(c, orta);
    const ters = nn[0] * disa[0] + nn[1] * disa[1] + nn[2] * disa[2] < 0;
    // Uçlar düz kapak, yan dilimler eğri yüzey.
    const vn = normaller[i];
    if (!vn) return { p: ters ? [...p].reverse() : p, renk };
    return {
      p: ters ? [...p].reverse() : p,
      renk,
      yumusak: true,
      vn: ters ? [...vn].reverse() : vn,
    };
  });
}

/** Modelin yalnız `tut` koşulunu sağlayan yüzleri (kukuleta: kürenin arka yarısı). */
export function suz(m: Model, tut: (merkez: V3) => boolean): Model {
  return m.filter((y) => {
    const c = y.p.reduce<V3>(
      (s, q) => [s[0] + q[0] / y.p.length, s[1] + q[1] / y.p.length, s[2] + q[2] / y.p.length],
      [0, 0, 0],
    );
    return tut(c);
  });
}

/** Dikey düzlemde teker: araba tekeri, değirmen çarkı. `eksen` tekerin mili. */
export function teker(
  cx: number,
  cy: number,
  cz: number,
  r: number,
  eksen: Yon,
  renk: string = P.koyuTahta,
  n = 8,
): Model {
  const halka = (rr: number, kay: number): V3[] =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return eksen === 'y'
        ? [cx + Math.cos(a) * rr, cy + kay, cz + Math.sin(a) * rr]
        : [cx + kay, cy + Math.cos(a) * rr, cz + Math.sin(a) * rr];
    });
  return [
    { p: halka(r, 0), renk, ciftYuz: true },
    { p: halka(r * 0.3, 0.06), renk: isikla(renk, 0.7), ciftYuz: true },
  ];
}

/** Yarım küre kubbe (altı kasnağın içinde kalıyor, çizilmiyor). */
export function kubbe(
  cx: number,
  cy: number,
  z: number,
  r: number,
  renk: string,
  dilimSayisi = 10,
  halka = 3,
  basik = 1,
): Model {
  const n = dilim(dilimSayisi);
  const nrm = (q: V3): V3 => tekle([q[0] - cx, q[1] - cy, (q[2] - z) / (basik * basik)]);
  const nokta3 = (i: number, j: number): V3 => {
    const t = (i / halka) * (Math.PI / 2);
    const f = (j / n) * Math.PI * 2;
    return [
      cx + Math.sin(t) * Math.cos(f) * r,
      cy + Math.sin(t) * Math.sin(f) * r,
      z + Math.cos(t) * r * basik,
    ];
  };
  const m: Model = [];
  for (let i = 0; i < halka; i++)
    for (let j = 0; j < n; j++) {
      const a = nokta3(i, j);
      const b = nokta3(i, j + 1);
      const c = nokta3(i + 1, j + 1);
      const d = nokta3(i + 1, j);
      const p = i === 0 ? [a, d, c] : [a, d, c, b];
      m.push({ p, renk, yumusak: true, vn: p.map(nrm) });
    }
  return m;
}
