/**
 * Modelden GPU ağı (docs/24). Saf: DOM yok, WebGL yok — node'da test ediliyor.
 *
 * SVG çizimiyle AYNI kararları veriyor, yalnız sonucu üçgen tamponu olarak:
 *
 * - Görünürlük: bakana dönük olmayan yüz atılıyor; `ciftYuz` ise çevrilip
 *   normali ters çevriliyor (`ciz` ile aynı).
 * - Yer katmanları (`katman < 0`: arazi, yol, parsel, bina plakası)
 *   ressam sırasıyla — katman, sonra derinlik — tek tamponda. GPU onları
 *   derinlik sınaması OLMADAN bu sırayla boyuyor; kompozisyon SVG'yle birebir.
 * - Nesneler (`katman >= 0`) derinlik tamponuyla: iç içe geçen parçalar
 *   ressam algoritmasının yanıldığı yerde de doğru örtüyor.
 * - Saydam yüzler (duman, parıltı) en sonda, uzaktan yakına.
 * - Gölge düşürenler: nesnelerin bütün yüzleri, iki yüzlü (ışıktan
 *   bakınca arka yüz de gölge yapar).
 */
import {
  KENAR,
  KENAR_YUMUSAK,
  kameraTabani,
  normal,
  type Kamera,
  type Model,
  type V3,
  type Yuz,
} from './uc';

/**
 * Köşe başına kayan sayı: konum 3, normal 3, renk 3, ek 4 (ışıma,
 * saydamlık, çizgi, boş), su 4 (renk 3, derinlik — suyu olmayanda -9),
 * kum 3.
 */
export const KOSE = 20;

export interface Ag {
  yer: Float32Array;
  nesne: Float32Array;
  saydam: Float32Array;
  /** Yalnız konum (3). */
  golge: Float32Array;
  /** Görünen her şeyin dünya sınırı (gölge kamerası bununla kuruluyor). */
  enAz: V3;
  enCok: V3;
  /** Bakana doğru derinlik aralığı (z tamponu ölçeği). */
  derinlik: [number, number];
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const nokta = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const birim = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Çizgi: SVG'de her yüzün kenarı koyuydu (yumuşak dilimde silik, yer
 * süsünde yok). GPU'da kenar yalnız siluette ve keskin kırılımda çiziliyor;
 * bu değer o kenarın ne kadar koyu olacağını taşıyor (1 = çizgi yok).
 */
function cizgi(y: { kenarsiz?: boolean; yumusak?: boolean }): number {
  if (y.kenarsiz) return 1;
  return y.yumusak ? KENAR_YUMUSAK : KENAR;
}

interface Parca {
  y: Yuz;
  /** Bakana dönük değil, çevrilecek (ince levhanın arkası). */
  cevir: boolean;
  k: number;
  d: number;
}

export function agYap(model: Model, kamera?: Kamera): Ag {
  const { c } = kameraTabani(kamera);
  // Bir modelde renkler çok tekrar ediyor (arazi, duvar): bir kez çözülsün.
  const renkler = new Map<string, [number, number, number]>();
  const renk = (h: string) => {
    let r = renkler.get(h);
    if (!r) renkler.set(h, (r = rgb(h)));
    return r;
  };
  const yer: Parca[] = [];
  const nesne: Parca[] = [];
  const saydam: Parca[] = [];
  const golgeler: Yuz[] = [];
  const enAz: V3 = [Infinity, Infinity, Infinity];
  const enCok: V3 = [-Infinity, -Infinity, -Infinity];
  let dMin = Infinity;
  let dMax = -Infinity;

  // 1) Karar: hangi yüz nereye, hangi sırayla (kopya yok).
  for (const y of model) {
    if (y.p.length < 3) continue;
    const alfa = y.saydam ?? 1;
    const k = y.katman ?? 0;
    // Gölge: nesnelerin dolu yüzleri, bakana dönük olsun olmasın.
    if (k >= 0 && alfa >= 1) golgeler.push(y);
    const cevir = nokta(normal(y.p), c) <= 1e-6;
    // Arkası dönük ince levha çevriliyor; değilse atılıyor.
    if (cevir && !y.ciftYuz) continue;
    let d = 0;
    for (const q of y.p) {
      const dq = nokta(q, c);
      d += dq;
      if (dq < dMin) dMin = dq;
      if (dq > dMax) dMax = dq;
      for (let e = 0; e < 3; e++) {
        if (q[e]! < enAz[e]!) enAz[e] = q[e]!;
        if (q[e]! > enCok[e]!) enCok[e] = q[e]!;
      }
    }
    const x: Parca = { y, cevir, k, d: d / y.p.length };
    if (alfa < 1) saydam.push(x);
    else if (k < 0) yer.push(x);
    else nesne.push(x);
  }
  yer.sort((a, b) => a.k - b.k || a.d - b.d);
  saydam.sort((a, b) => a.d - b.d);

  // 2) Yazım: üçgen yelpazesi doğrudan tampona.
  const dizi = (ps: Parca[]) => {
    let n = 0;
    for (const x of ps) n += (x.y.p.length - 2) * 3 * KOSE;
    const f = new Float32Array(n);
    let o = 0;
    for (const { y, cevir } of ps) {
      const m = y.p.length;
      // Çevrilen yüzde köşe sırası ters, normal eksi.
      const j = (i: number) => (cevir ? m - 1 - i : i);
      const s = cevir ? -1 : 1;
      const duz = y.vn ? null : y.gn ? birim(y.gn) : normal(y.p);
      const yuzRengi = renk(y.renk);
      const kum = y.su ? renk(y.su.kum) : yuzRengi;
      const isima = y.isima ?? 0;
      const alfa = y.saydam ?? 1;
      const cz = cizgi(y);
      const yaz = (i: number) => {
        const q = y.p[i]!;
        const n = y.vn ? y.vn[i]! : duz!;
        const r = y.vr ? renk(y.vr[i]!) : yuzRengi;
        f[o++] = q[0];
        f[o++] = q[1];
        f[o++] = q[2];
        f[o++] = s * n[0];
        f[o++] = s * n[1];
        f[o++] = s * n[2];
        f[o++] = r[0];
        f[o++] = r[1];
        f[o++] = r[2];
        f[o++] = isima;
        f[o++] = alfa;
        f[o++] = cz;
        f[o++] = 0;
        if (y.su) {
          const w = renk(y.su.renk[i]!);
          f[o++] = w[0];
          f[o++] = w[1];
          f[o++] = w[2];
          f[o++] = y.su.d[i]!;
        } else {
          f[o++] = yuzRengi[0];
          f[o++] = yuzRengi[1];
          f[o++] = yuzRengi[2];
          f[o++] = -9;
        }
        f[o++] = kum[0];
        f[o++] = kum[1];
        f[o++] = kum[2];
      };
      for (let i = 1; i < m - 1; i++) {
        yaz(j(0));
        yaz(j(i));
        yaz(j(i + 1));
      }
    }
    return f;
  };

  let gn = 0;
  for (const y of golgeler) gn += (y.p.length - 2) * 9;
  const golge = new Float32Array(gn);
  let o = 0;
  for (const y of golgeler)
    for (let i = 1; i < y.p.length - 1; i++)
      for (const q of [y.p[0]!, y.p[i]!, y.p[i + 1]!]) {
        golge[o++] = q[0];
        golge[o++] = q[1];
        golge[o++] = q[2];
      }

  if (!isFinite(dMin)) {
    dMin = 0;
    dMax = 1;
  }
  return {
    yer: dizi(yer),
    nesne: dizi(nesne),
    saydam: dizi(saydam),
    golge,
    enAz,
    enCok,
    derinlik: [dMin, dMax],
  };
}
