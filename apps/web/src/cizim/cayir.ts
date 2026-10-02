/**
 * ÇAYIR — yerleşkenin zemini ve otları (docs/24 "Çayır").
 *
 * Oyuncu: "görsel olarak hâlâ çok yetersiz." Ekranın büyük kısmı tek renk,
 * dümdüz bir yeşil plakaydı; üstündeki çokgen lekeler zemini zenginleştirmek
 * yerine yama gibi okunuyordu ve rüzgârın dalgası boş bir yüzeyde kayan
 * soluk bir ışıktı.
 *
 * - Zemin köşe renkli bir arazi ızgarası (`arazi`, düz: yapılar havada
 *   kalmasın): geniş koyu ve açık çayır lekeleri, yer yer kuru ot, kasabanın
 *   çevresinde çiğnenmiş açık yeşil, kenarlara doğru koyulaşan orman
 *   zemini. GPU renkleri üçgenin içinde ara değerliyor, geçişler yumuşak.
 *   Yalnız GPU; SVG yedeği altındaki düz plakayı görüyor.
 * - Otlar: çimen görünen her yerde öbek öbek ot tutamları (dört ince
 *   yaprak, dipte koyu, uçta açık; rüzgâr yönünde hafif yatık). Yalnız GPU
 *   (`Yuz.gpu`): SVG yedeği binlerce minik çokgenle ağırlaşırdı. Yer
 *   geçişinde çiziliyorlar (katman < 0): gölge düşürmüyorlar, çimen
 *   maskesinin içindeler, rüzgâr dalgası onların üstünden geçiyor.
 *
 * Yer: model kurulduktan SONRA. Çimen olmayan bütün yer yüzleri (yol,
 * patika, tarla, avlu, döşeme, su) bir ızgaraya dökülüyor; tutam yalnız
 * hiçbirinin içine düşmeyen noktaya konuyor. Sonradan eklenen her yer
 * parçası kendiliğinden saygı görüyor.
 */
import { arazi, gurultu, yumusakAdim } from './arazi';
import { karistir, isikla } from './renk';
import { rastgele } from './rastgele';
import {
  cember,
  dokula,
  kameraTabani,
  prizma,
  normal,
  yansitici,
  zemineGeri,
  type Model,
  type V3,
  type Yuz,
} from './uc';

const KOYU = '#46652a';
const ORTA = '#5f803a';
const ACIK = '#86a24a';
const KURU = '#a09d5a';
const CIGNENMIS = '#8c9a52';
const ORMAN = '#3f5a27';

/** Çayırın rengi: geniş lekeler, kuru ot, çiğnenmiş göbek, koyu kıyı. */
function cayirRengi(anahtar: string): (x: number, y: number) => string {
  const g = gurultu('cayir:' + anahtar);
  const ekran = yansitici();
  return (x, y) => {
    const n = g(x, y, 30, 3);
    let c =
      n < 0.5
        ? karistir(KOYU, ORTA, yumusakAdim(n / 0.5))
        : karistir(ORTA, ACIK, yumusakAdim((n - 0.5) / 0.5));
    const ince = g(x + 91, y - 37, 8, 2);
    c = karistir(c, KURU, Math.max(0, (ince - 0.58) / 0.42) * 0.55);
    // Ekranda kasabanın göbeği çiğnenmiş, kenarlar ormanın gölgesinde.
    const [sx, sy] = ekran([x, y, 0]);
    const d = Math.hypot(sx / 52, (sy - 4) / 56);
    c = karistir(c, CIGNENMIS, (1 - yumusakAdim(d / 0.45)) * 0.28);
    c = karistir(c, ORMAN, yumusakAdim((d - 0.7) / 0.35) * 0.5);
    return c;
  };
}

/**
 * Çayır zemini: ekrandaki `kutu`yu (görüş kutusu) taşan köşe renkli düz
 * ızgara. Yalnız GPU: SVG yedeği altındaki düz plakayı çiziyor (ızgaranın
 * binlerce üçgeni GPU'suz telefonda boşuna yük olurdu).
 */
export function cayirZemini(anahtar: string, kutu: [number, number, number, number]): Model {
  const renk = cayirRengi(anahtar);
  const [x, y, w, h] = kutu;
  const m = dokula(
    arazi({
      cerceve: [x - 6, y - 6, w + 12, h + 12],
      adim: 3,
      h: () => 0,
      renk: (px, py) => renk(px, py),
      r: rastgele('cayir:' + anahtar),
      titrek: 0.3,
    }),
    'cimen',
  );
  for (const f of m) f.gpu = true;
  return m;
}

/* ── Otlar ─────────────────────────────────────────────────────────── */

/** Izgara hücresi (dünya birimi). */
const HUCRE = 3;

type Ucgen = [number, number, number, number, number, number];

function ucgenIcinde([ax, ay, bx, by, cx, cy]: Ucgen, x: number, y: number): boolean {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  const eksi = d1 < 0 || d2 < 0 || d3 < 0;
  const arti = d1 > 0 || d2 > 0 || d3 > 0;
  return !(eksi && arti);
}

/** Çimen olmayan yer yüzlerinin ızgarası: nokta onlardan birinin içinde mi. */
function yerIzgarasi(m: Model): (x: number, y: number) => boolean {
  const izgara = new Map<number, Ucgen[]>();
  const anahtar = (i: number, j: number) => i * 100003 + j;
  for (const f of m) {
    if ((f.katman ?? 0) >= 0 || f.doku === 'cimen' || f.p.length < 3 || f.gpu) continue;
    const p = f.p;
    for (let k = 1; k < p.length - 1; k++) {
      const u: Ucgen = [p[0]![0], p[0]![1], p[k]![0], p[k]![1], p[k + 1]![0], p[k + 1]![1]];
      const i0 = Math.floor(Math.min(u[0], u[2], u[4]) / HUCRE);
      const i1 = Math.floor(Math.max(u[0], u[2], u[4]) / HUCRE);
      const j0 = Math.floor(Math.min(u[1], u[3], u[5]) / HUCRE);
      const j1 = Math.floor(Math.max(u[1], u[3], u[5]) / HUCRE);
      for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++) {
          const a = anahtar(i, j);
          const l = izgara.get(a);
          if (l) l.push(u);
          else izgara.set(a, [u]);
        }
    }
  }
  return (x, y) =>
    (izgara.get(anahtar(Math.floor(x / HUCRE), Math.floor(y / HUCRE))) ?? []).some((u) =>
      ucgenIcinde(u, x, y),
    );
}

/**
 * Bir ot tutamı: dört ince yaprak, dipte zeminden biraz koyu, uçta ışığı
 * yakalayan açık sarımsı yeşil; rüzgâr yönünde hafif yatık. Yaprağın köşe
 * normalleri YUKARI: dik yaprak yandan ışık alıp kapkara bir çizik gibi
 * okunuyordu; çimen gibi gökten aydınlanınca rengin kendisi görünüyor.
 * Köşeler bakana dönük sırada (çevrilen yüzün normali eksi olurdu).
 */
function tutam(
  x: number,
  y: number,
  r: () => number,
  zemin: string,
  sag: V3,
  yatik: V3,
  c: V3,
): Yuz[] {
  const m: Yuz[] = [];
  const dip = isikla(zemin, 0.84);
  const uc = karistir(isikla(zemin, 1.22), '#b8c564', 0.15 + r() * 0.25);
  const yukari: V3 = [0, 0, 1];
  for (let i = 0; i < 4; i++) {
    const o = (i - 1.5) * 0.1 + (r() - 0.5) * 0.08;
    const bx = x + sag[0] * o;
    const by = y + sag[1] * o;
    const gen = 0.06 + r() * 0.05;
    const boy = 0.32 + r() * 0.45;
    const egik = (i - 1.5) * 0.1 + (r() - 0.4) * 0.16;
    let p: V3[] = [
      [bx - sag[0] * gen, by - sag[1] * gen, 0],
      [bx + sag[0] * gen, by + sag[1] * gen, 0],
      [bx + sag[0] * egik + yatik[0] * boy * 0.35, by + sag[1] * egik + yatik[1] * boy * 0.35, boy],
    ];
    const n = normal(p);
    if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] < 0) p = [p[1]!, p[0]!, p[2]!];
    m.push({
      p,
      renk: isikla(zemin, 1.05),
      vr: [dip, dip, uc],
      vn: [yukari, yukari, yukari],
      ciftYuz: true,
      kenarsiz: true,
      katman: -1.45,
      doku: 'cimen',
      gpu: true,
    });
  }
  return m;
}

/**
 * Çimen görünen yerlere ot tutamları (`m` kurulmuş yerleşke). Öbek öbek:
 * yoğunluk gürültüyle değişiyor, tek düze serpiştirme halı deseni gibi
 * okunuyordu. Çimen olmayan yer yüzünün (ve kenarının) üstüne düşmüyor.
 */
export function otlar(
  m: Model,
  anahtar: string,
  kutu: [number, number, number, number],
  adet = 3000,
): Model {
  const dolu = yerIzgarasi(m);
  const renk = cayirRengi(anahtar);
  const g = gurultu('ot:' + anahtar);
  const r = rastgele('ot:' + anahtar);
  const geri = zemineGeri();
  const { sag, c } = kameraTabani();
  // Yaprağın düzlemi bakana dönük (ekranda yatay), uçlar rüzgârla sola yatık
  // (dumanla aynı yön).
  const s = Math.hypot(sag[0], sag[1]) || 1;
  const yatay: V3 = [sag[0] / s, sag[1] / s, 0];
  const yatik: V3 = [-yatay[0], -yatay[1], 0];
  const [kx, ky, kw, kh] = kutu;
  const out: Model = [];
  let kalan = adet;
  let deneme = 0;
  // Yolun, tarlanın kenarından bu kadar içeride (yaprağın ucu taşmasın).
  const PAY = 0.35;
  while (kalan > 0 && deneme++ < adet * 6) {
    const [x, y] = geri(kx + r() * kw, ky + r() * kh);
    // Öbek: seyrek yerde çoğu aday eleniyor.
    if (r() > 0.2 + 0.8 * yumusakAdim((g(x, y, 9, 2) - 0.3) / 0.45)) continue;
    if (dolu(x, y) || dolu(x + PAY, y) || dolu(x - PAY, y) || dolu(x, y + PAY) || dolu(x, y - PAY))
      continue;
    out.push(...tutam(x, y, r, renk(x, y), yatay, yatik, c));
    kalan--;
  }
  // Kır çiçekleri: seyrek öbekler, çimen görünen yerde.
  let cicek = Math.round(adet / 11);
  deneme = 0;
  while (cicek > 0 && deneme++ < adet * 3) {
    const [x, y] = geri(kx + r() * kw, ky + r() * kh);
    if (g(x - 40, y + 25, 14, 2) < 0.48) continue;
    if (dolu(x, y) || dolu(x + 1, y) || dolu(x - 1, y) || dolu(x, y + 1) || dolu(x, y - 1))
      continue;
    out.push(...kirCicegi(x, y, r));
    cicek--;
  }
  return out;
}

const CICEK = ['#f4f1e4', '#f2d25a', '#c9a3e0', '#e8836b', '#f4f1e4'];

/** Bir öbek kır çiçeği: kısa sap, üstünde küçük yatay taç (yalnız GPU, yer geçişinde). */
function kirCicegi(x: number, y: number, r: () => number): Model {
  const renk = CICEK[Math.floor(r() * CICEK.length)]!;
  const m: Model = [];
  const yukari: V3 = [0, 0, 1];
  const adet = 4 + Math.floor(r() * 5);
  for (let i = 0; i < adet; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.9;
    const cx = x + Math.cos(a) * d;
    const cy = y + Math.sin(a) * d;
    const z = 0.22 + r() * 0.2;
    const t = 0.13 + r() * 0.06;
    const tac = isikla(renk, 0.92 + r() * 0.16);
    m.push({
      p: [
        [cx - t, cy, z],
        [cx, cy - t, z],
        [cx + t, cy, z],
        [cx, cy + t, z],
      ],
      renk: tac,
      vn: [yukari, yukari, yukari, yukari],
      ciftYuz: true,
      kenarsiz: true,
      katman: -1.44,
      doku: 'cimen',
      gpu: true,
    });
  }
  return m;
}

/* ── Yol kenarı ────────────────────────────────────────────────────── */

const YOL_KENARI = 0.6;

/**
 * Yolun ve patikanın altında, ondan biraz geniş, çimenle toprak arası bir
 * şerit: toprak çimene keskin bir bıçak çizgisiyle değil, çiğnenmiş
 * kenarla karışıyor. Çimen sayılıyor (rüzgâr üstünden geçiyor, kenar
 * otları üstüne düşebiliyor); yalnız GPU (SVG yedeği yolu eskisi gibi).
 */
export function yolKenari(noktalar: [number, number][], gen: number, renk: string): Model {
  const kenar = isikla(karistir(renk, ORTA, 0.68), 0.95);
  const g = gen + YOL_KENARI;
  const m: Model = [];
  for (let i = 0; i < noktalar.length - 1; i++) {
    const [ax, ay] = noktalar[i]!;
    const [bx, by] = noktalar[i + 1]!;
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / l) * (g / 2);
    const ny = ((bx - ax) / l) * (g / 2);
    m.push({
      p: [
        [ax + nx, ay + ny, 0.015],
        [ax - nx, ay - ny, 0.015],
        [bx - nx, by - ny, 0.015],
        [bx + nx, by + ny, 0.015],
      ],
      renk: kenar,
      ciftYuz: true,
    });
  }
  for (const [x, y] of noktalar) m.push(...prizma(cember(x, y, g / 2, 12), 0.005, 0.01, kenar));
  const alt = m.map((f): Yuz => ({
    ...f,
    katman: -1.04,
    kenarsiz: true,
    doku: 'cimen',
    gpu: true,
  }));
  return gen >= 1.8 ? [...alt, ...tekerlekIzi(noktalar, gen, renk)] : alt;
}

/** Geniş toprak yolda iki koyu tekerlek izi (yolun üstünde; yalnız GPU). */
function tekerlekIzi(noktalar: [number, number][], gen: number, renk: string): Model {
  const iz = isikla(renk, 0.9);
  const m: Model = [];
  for (let i = 0; i < noktalar.length - 1; i++) {
    const [ax, ay] = noktalar[i]!;
    const [bx, by] = noktalar[i + 1]!;
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const [ux, uy] = [-(by - ay) / l, (bx - ax) / l];
    for (const yan of [-0.2, 0.2]) {
      const o = yan * gen;
      const w = 0.07 * gen;
      m.push({
        p: [
          [ax + ux * (o + w), ay + uy * (o + w), 0.03],
          [ax + ux * (o - w), ay + uy * (o - w), 0.03],
          [bx + ux * (o - w), by + uy * (o - w), 0.03],
          [bx + ux * (o + w), by + uy * (o + w), 0.03],
        ],
        renk: iz,
        ciftYuz: true,
        katman: -0.98,
        kenarsiz: true,
        gpu: true,
      });
    }
  }
  return m;
}
