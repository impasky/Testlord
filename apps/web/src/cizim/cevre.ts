/**
 * YERLEŞKENİN ÇEVRESİ (docs/24): kasabayı saran köy hayatı ve doğa.
 *
 * Oyuncu: "şehir sayfası aşırı boş duruyor." Kasaba, tarlalar ve talim
 * alanı arasında geniş çimen vardı. Burada dolduruluyor:
 *
 * - Sağdan akan dere (su parıltısı canlı), üstünde ahşap köprü, kıyıda
 *   çarkı dönen su değirmeni.
 * - Solda bacası tüten köy evleri, sebze bahçeleri, çitler; sazlıklı,
 *   ördekli gölet; kanatları dönen yel değirmeni.
 * - Sol altta koyunlu, inekli mera ve ahır; sağ altta meyve bahçesi ve arı
 *   kovanları; kasabayla düello arasında talim kampı (çadırlar, ateş) ve
 *   atlı ahır.
 * - Açık çimene çalı, çiçek, kaya, kütük; kıyıda sık orman.
 *
 * Yerler yerleşkenin EKRAN biriminde yazılı (`YERLESIM_KUTUSU`) ve zemine
 * geri yansıtılıyor: ekranda nereye düşeceği okunarak yerleştirildi.
 * Doğa durağan (salınan her ağaç GPU'da ayrı katman, telefonun belleği);
 * canlılık su, duman ve dönen iki çarktan.
 */
import { canlandir } from './canli';
import { at } from './figur';
import { ambar, araba, balya, degirmen, ev, kuyuKucuk } from './kir';
import { agac, cadir, cam, cit, duman, fici, kaya, mesale, sandik } from './parca';
import { P, isikla } from './renk';
import {
  birlestir,
  cember,
  dondur,
  koni,
  kure,
  kutu,
  olcekle,
  prizma,
  silindir,
  tasi,
  zemineGeri,
  type Model,
  type V3,
  type Yuz,
} from './uc';

type Kademe = 'kamp' | 'koy' | 'kasaba' | 'sehir' | 'kale' | 'metropol';
type Nokta = [number, number];

/** Ekran noktasının (yerleşke çerçevesinde) yerdeki karşılığı. */
const yere = zemineGeri();

/** Figür biriminde kurulan aktörlerin ölçeği (bkz. `yerlesim.YERLESIM_OLCEK`). */
const FIGUR_OLCEK = 0.55;

/* ── Bölgeler: neresi dolu ─────────────────────────────────────────── */

/** Ekran dikdörtgeni [x0, y0, x1, y1]. */
type Alan = [number, number, number, number];

/** Kasaba, tarlalar ve talim alanı (yerleşimin kendi parçaları). */
const ESKI: Alan[] = [
  [-33, -25, 33, 25], // kasaba
  [-42, -45, 42, -28], // tarlalar
  [-43, 17, -20, 32], // okçular
  [23, 21, 42, 40], // mızrakçılar
  [-34, 39, 32, 53], // düello
  [-15, 33, 11, 40], // seyirciler
];

/** Derenin ekrandaki yolu (üstten alta, sağ kıyıda). */
const DERE: Nokta[] = [
  [46, -48],
  [43, -32],
  [44.5, -16],
  [41, -2],
  [42.5, 12],
  [45.5, 26],
  [44, 42],
  [46.5, 58],
];
const DERE_YARI = 2.6;

const GOLET: Nokta = [-40, -8];
const GOLET_R = 4.2;

const YEL_DEGIRMENI: Nokta = [-41, -25];
const SU_DEGIRMENI: Nokta = [39, -19.5];
const KOPRU: Nokta = [41.3, -2];

/** Köy evleri: sıra, kademeyle kaçının dikildiği (önce yakınlar). */
const EVLER: { yer: Nokta; bahce: -1 | 0 | 1 }[] = [
  { yer: [-40, 4], bahce: 1 },
  { yer: [33, -9], bahce: -1 },
  { yer: [-45, -18], bahce: 1 },
  { yer: [-36, 13], bahce: -1 },
  { yer: [34, 5], bahce: 0 },
  { yer: [30, -20], bahce: 1 },
  { yer: [-46, 12], bahce: 0 },
  { yer: [-35, -17], bahce: -1 },
];
const EV_SAYISI: Record<Kademe, number> = {
  kamp: 0,
  koy: 5,
  kasaba: 7,
  sehir: 8,
  kale: 8,
  metropol: 8,
};

const MERA: Alan = [-47, 37, -23, 55];
const BAHCE: Alan = [24, 43, 40, 56];
const KAMP: Alan = [-18, 25, 22, 36];

function icinde([x0, y0, x1, y1]: Alan, x: number, y: number) {
  return x > x0 && x < x1 && y > y0 && y < y1;
}

/** Yolun (kırık çizgi) noktaya uzaklığı. */
function cizgiyeUzaklik(x: number, y: number, yol: Nokta[]): number {
  let en = Infinity;
  for (let i = 0; i < yol.length - 1; i++) {
    const [ax, ay] = yol[i]!;
    const [bx, by] = yol[i + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    en = Math.min(en, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return en;
}

/** Ekran noktası dolu mu (çevrenin ve yerleşimin parçaları); `pay` kenar payı. */
export function doluMu(x: number, y: number, pay = 0): boolean {
  const genis = (a: Alan): Alan => [a[0] - pay, a[1] - pay, a[2] + pay, a[3] + pay];
  if (ESKI.some((a) => icinde(genis(a), x, y))) return true;
  if ([MERA, BAHCE, KAMP].some((a) => icinde(genis(a), x, y))) return true;
  if (cizgiyeUzaklik(x, y, DERE) < DERE_YARI + 1.5 + pay) return true;
  if (Math.hypot(x - GOLET[0], y - GOLET[1]) < GOLET_R + 2.5 + pay) return true;
  for (const [nx, ny] of [YEL_DEGIRMENI, SU_DEGIRMENI])
    if (Math.hypot(x - nx, y - ny) < 5 + pay) return true;
  if (EVLER.some(({ yer: [ex, ey] }) => Math.hypot(x - ex, y - ey) < 5.5 + pay)) return true;
  return false;
}

/* ── Su ────────────────────────────────────────────────────────────── */

const SIG = '#6a9aad';
const DERIN = P.su;
const KIYI = '#a99a6c';

/** Su yüzü: köşe başına derinlik (0 kıyı) ve renk; GPU parıltıyı bundan çiziyor. */
function suYuzu(p: V3[], d: number[]): Yuz {
  const renk = d.map((v) => (v > 1.5 ? DERIN : v > 0.5 ? isikla(SIG, 0.92) : SIG));
  return {
    p,
    renk: renk[0]!,
    katman: -1.05,
    kenarsiz: true,
    su: { d, renk, kum: KIYI },
  };
}

/** Dere: ekrandaki yol boyunca şerit, kıyıda sığ, ortada derin. */
function dere(): Model {
  const m: Model = [];
  // Yolu sıklaştır: kıvrım yumuşak kalsın.
  const yol: Nokta[] = [];
  for (let i = 0; i < DERE.length - 1; i++)
    for (let k = 0; k < 4; k++) {
      const t = k / 4;
      const [ax, ay] = DERE[i]!;
      const [bx, by] = DERE[i + 1]!;
      yol.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  yol.push(DERE[DERE.length - 1]!);
  const dunya = yol.map(([x, y]) => yere(x, y));
  // Şeridin enine kesiti: kıyı, sığ, orta, sığ, kıyı.
  const kesit = [-1, -0.55, 0, 0.55, 1];
  const derinlik = [0, 1.2, 2.6, 1.2, 0];
  const halkalar = dunya.map((q, i) => {
    const a = dunya[Math.max(0, i - 1)]!;
    const b = dunya[Math.min(dunya.length - 1, i + 1)]!;
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l;
    const ny = tx / l;
    // Genişlik biraz dalgalı: kanal değil dere.
    const w = DERE_YARI * (1 + 0.18 * Math.sin(i * 1.3));
    return kesit.map((k): V3 => [q[0] + nx * w * k, q[1] + ny * w * k, 0.03]);
  });
  for (let i = 0; i < halkalar.length - 1; i++)
    for (let j = 0; j < kesit.length - 1; j++)
      m.push(
        suYuzu(
          [halkalar[i]![j]!, halkalar[i + 1]![j]!, halkalar[i + 1]![j + 1]!, halkalar[i]![j + 1]!],
          [derinlik[j]!, derinlik[j]!, derinlik[j + 1]!, derinlik[j + 1]!],
        ),
      );
  return m;
}

/** Gölet: merkezden kıyıya yelpaze, kenarı düzensiz. */
function golet(r: () => number): Model {
  const [cx, cy] = yere(...GOLET);
  const n = 14;
  const kenar = cember(cx, cy, GOLET_R, n, r()).map(([x, y]): V3 => {
    const k = 0.85 + r() * 0.3;
    return [cx + (x - cx) * k, cy + (y - cy) * k, 0.03];
  });
  const orta: V3 = [cx, cy, 0.03];
  const m: Model = [];
  for (let i = 0; i < n; i++) {
    const a = kenar[i]!;
    const b = kenar[(i + 1) % n]!;
    const ic = (q: V3): V3 => [cx + (q[0] - cx) * 0.55, cy + (q[1] - cy) * 0.55, 0.03];
    m.push(suYuzu([orta, ic(a), ic(b)], [2.4, 1.2, 1.2]));
    m.push(suYuzu([ic(a), a, b, ic(b)], [1.2, 0, 0, 1.2]));
  }
  // Sazlık: kıyıda ince sapların ucunda koyu püskül.
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = GOLET_R * (0.9 + r() * 0.25);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const h = 1 + r() * 0.8;
    m.push(...koni(x, y, 0, 0.12, h, isikla('#6f7f3a', 0.9 + r() * 0.2), 4));
    if (r() < 0.6) m.push(...silindir(x, y, h - 0.35, 0.1, 0.35, '#5a3a22', 4));
  }
  // Nilüferler ve iki ördek.
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const d = GOLET_R * r() * 0.6;
    m.push(
      ...prizma(cember(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.45, 6), 0.04, 0.03, '#5e8a3a'),
    );
  }
  for (const [dx, dy] of [
    [-1, 0.6],
    [0.8, -1.2],
  ] as Nokta[])
    m.push(...ordek(cx + dx, cy + dy));
  return m;
}

function ordek(x: number, y: number): Model {
  return birlestir(
    kure(x, y, 0.2, 0.45, '#f1ede2', 6, 3, 0, () => 0.5, 0.7),
    kure(x + 0.35, y + 0.35, 0.6, 0.22, '#2f5a3a', 5, 3),
    koni(x + 0.52, y + 0.52, 0.55, 0.1, 0.25, '#e0a23a', 4),
  );
}

/** Ahşap köprü: iki kıyı noktası arası (dünya), korkuluklu. */
function kopru(a: Nokta, b: Nokta): Model {
  const [ax, ay] = yere(...a);
  const [bx, by] = yere(...b);
  const L = Math.hypot(bx - ax, by - ay);
  const aci = Math.atan2(by - ay, bx - ax);
  const m: Model = [
    ...kutu(0, -1, 0.35, L, 2, 0.28, P.acikTahta),
    ...kutu(0, -1.05, 0.63, L, 0.16, 0.12, P.koyuTahta),
    ...kutu(0, 0.89, 0.63, L, 0.16, 0.12, P.koyuTahta),
  ];
  for (let t = 0; t <= L; t += L / 3)
    for (const s of [-1.05, 0.89])
      m.push(...kutu(Math.min(t, L - 0.2), s, 0, 0.2, 0.16, 1.3, P.koyuTahta));
  // Tahtaların arası: ince koyu çizgiler.
  for (let t = 0.5; t < L; t += 0.6) m.push(...kutu(t, -0.98, 0.63, 0.05, 1.96, 0.01, P.tahta));
  return tasi(dondur(m, 'z', aci), [ax, ay, 0]);
}

/* ── Değirmenler (dönen iki çark) ──────────────────────────────────── */

const YEL_KARE = 12;
const YEL_SURE = 4.2;

/** Yel değirmeni: kanatlar dört katlı simetrik, bir tur çeyrek dönüş. */
function yelDegirmeni(): Model {
  const [x, y] = yere(...YEL_DEGIRMENI);
  const poz = (t: number) => degirmen(0, 0, 0, 0.75, 0.35 + (t * Math.PI) / 2);
  return tasi(canlandir(poz, YEL_KARE, YEL_SURE, [0, 0, 0]), [x, y, 0]);
}

const CARK_KARE = 8;
const CARK_SURE = 2.4;
const CARK_KANAT = 8;

/** Su çarkı: kanatlar sekiz katlı simetrik, bir tur bir kanat aralığı. Ekseni x boyunca. */
function carkPoz(t: number): Model {
  const m: Model = [];
  const R = 1.9;
  const faz = (t * 2 * Math.PI) / CARK_KANAT;
  for (let k = 0; k < CARK_KANAT; k++) {
    const a = faz + (k * 2 * Math.PI) / CARK_KANAT;
    const kanat = kutu(-0.35, -0.08, R - 0.9, 0.7, 0.16, 1.1, P.tahta);
    m.push(...dondur(kanat, 'x', a));
    const kol = kutu(-0.08, -0.06, 0, 0.16, 0.12, R - 0.2, P.koyuTahta);
    m.push(...dondur(kol, 'x', a));
  }
  m.push(...dondur(silindir(0, 0, -0.45, 0.35, 0.9, P.koyuTahta, 6), 'y', Math.PI / 2));
  return m;
}

function suDegirmeni(r: () => number): Model {
  const [x, y] = yere(...SU_DEGIRMENI);
  const m: Model = [];
  // Ev: taş taban, tahta üst, saman çatı; çark +y yüzünde (ekranda sağda, derede).
  m.push(...ev(x - 2.5, y - 2, 0, 5, 4, 3.4, { duvar: P.tahta, cati: P.saman, baca: true }));
  m.push(...kutu(x - 2.6, y - 2.1, 0, 5.2, 4.2, 1.2, P.tas));
  m.push(...duman(x - 1.3, y - 0.8, 7.2, r, 2));
  const cark = canlandir(carkPoz, CARK_KARE, CARK_SURE, [0, 0, 0]);
  m.push(...tasi(dondur(cark, 'z', Math.PI / 2), [x + 0.2, y + 3.4, 1.9]));
  // Çarkı dereye bağlayan oluk.
  m.push(...kutu(x - 0.4, y + 2, 3.9, 1.2, 3.4, 0.35, P.koyuTahta));
  return m;
}

/* ── Köy ───────────────────────────────────────────────────────────── */

/** Kademenin ev dokusu: köyde tahta ve saman, kasabada sıva ve kiremit, şehirde taş. */
function evAyari(kademe: Kademe, i: number) {
  const tas = kademe === 'sehir' || kademe === 'kale' || kademe === 'metropol';
  const koy = kademe === 'koy' || kademe === 'kamp';
  return {
    duvar: koy ? (i % 2 ? P.tahta : P.siva) : tas ? (i % 2 ? P.acikTas : P.siva) : P.siva,
    cati: koy ? P.saman : tas ? (i % 3 ? P.kiremit : P.arduvaz) : i % 2 ? P.kiremit : P.saman,
    h: tas ? 3.2 : 2.4,
    kiris: !koy && i % 2 === 0,
  };
}

/** Sebze bahçesi: sıra sıra yeşil ve toprak, kısa çitle. */
function bostan(x: number, y: number, sx: number, sy: number): Model {
  const m: Model = [
    ...prizma(
      [
        [x, y],
        [x + sx, y],
        [x + sx, y + sy],
        [x, y + sy],
      ],
      0,
      0.05,
      '#6e5034',
    ).map((f) => ({ ...f, katman: -1.2, kenarsiz: true })),
  ];
  for (let u = x + 0.4; u < x + sx - 0.3; u += 0.8)
    m.push(...kutu(u, y + 0.3, 0.05, 0.4, sy - 0.6, 0.35, u % 1.6 < 0.8 ? '#6f9a3a' : '#88a84a'));
  m.push(...cit(x - 0.2, y + sy + 0.2, sx + 0.4, 'x', P.tahta, 0.9));
  m.push(...cit(x + sx + 0.2, y - 0.2, sy + 0.4, 'y', P.tahta, 0.9));
  return m;
}

/** Odun yığını: üst üste kütükler. */
function odun(x: number, y: number): Model {
  const m: Model = [];
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < 3 - k; i++)
      m.push(
        ...dondur(
          silindir(0, 0, -0.9, 0.28, 1.8, { ust: '#c9a26a', yan: P.koyuTahta }, 6),
          'x',
          Math.PI / 2,
        ).map((f) => ({
          ...f,
          p: f.p.map(([a, b, c]): V3 => [a + x + i * 0.58 + k * 0.29, b + y, c + 0.28 + k * 0.5]),
        })),
      );
  return m;
}

function koyEvleri(kademe: Kademe, r: () => number): Model {
  const m: Model = [];
  const n = EV_SAYISI[kademe];
  for (let i = 0; i < n; i++) {
    const { yer: yer_, bahce } = EVLER[i]!;
    const [x, y] = yere(...yer_);
    const o = evAyari(kademe, i);
    const sx = 3.4 + (i % 3) * 0.4;
    const sy = 2.6 + (i % 2) * 0.4;
    m.push(
      ...ev(x - sx / 2, y - sy / 2, 0, sx, sy, o.h, {
        duvar: o.duvar,
        cati: o.cati,
        baca: true,
        kiris: o.kiris,
        isik: true,
      }),
    );
    // Bacanın ucundan duman (evlerin yarısında: hepsi birden tütmesin).
    if (i % 2 === 0)
      m.push(...duman(x - sx / 2 + sx * 0.2 + 0.35, y - sy / 2 + sy * 0.3, o.h + 2.6, r, 2));
    // Önünde çiğnenmiş toprak.
    m.push(
      ...prizma(
        cember(x + 0.4, y + sy / 2 + 1.4, 1.8, 8, r()),
        0,
        0.02,
        isikla(P.toprak, 1.04),
      ).map((f) => ({ ...f, katman: -1.3, kenarsiz: true })),
    );
    if (bahce) m.push(...bostan(x + (bahce > 0 ? sx / 2 + 1 : -sx / 2 - 4.2), y - 1.6, 3.2, 3.2));
    // Yanında odun, fıçı ya da saman.
    const [px, py] = [x - sx / 2 - 1.4, y + sy / 2 - 0.4];
    if (i % 3 === 0) m.push(...odun(px - 1, py));
    else if (i % 3 === 1) m.push(...olcekle(fici(px, py), 0.8, [px, py, 0]));
    else m.push(...balya(px, py, 0, 0.7));
    if (r() < 0.7) m.push(...durgun(agac(x - sx / 2 - 2.6, y - sy / 2 - 1.8, 0, r, 0.8)));
  }
  return m;
}

/* ── Mera, meyve bahçesi, kamp ─────────────────────────────────────── */

function koyun(x: number, y: number, yon: number): Model {
  const m = birlestir(
    kure(0, 0, 0.75, 0.6, '#ece6d6', 6, 3, 0, () => 0.5, 0.85),
    kure(-0.45, 0, 0.8, 0.5, '#e4ddcb', 6, 3),
    kutu(0.45, -0.18, 0.75, 0.42, 0.36, 0.4, '#3a3430'),
  );
  for (const [lx, ly] of [
    [-0.4, -0.25],
    [-0.4, 0.2],
    [0.3, -0.25],
    [0.3, 0.2],
  ] as Nokta[])
    m.push(...kutu(lx, ly, 0, 0.12, 0.12, 0.45, '#3a3430'));
  return tasi(dondur(m, 'z', yon), [x, y, 0]);
}

function inek(x: number, y: number, yon: number): Model {
  const beyaz = '#ece6d6';
  const kara = '#3b302a';
  const m = birlestir(
    kutu(-1.1, -0.5, 0.9, 2.2, 1, 1, beyaz),
    kutu(-0.5, -0.52, 1.3, 0.8, 1.04, 0.62, kara),
    kutu(1.05, -0.35, 1.3, 0.7, 0.7, 0.6, beyaz),
    kutu(1.55, -0.3, 1.3, 0.3, 0.6, 0.35, '#c99a8a'),
    kutu(1.2, -0.45, 1.9, 0.12, 0.9, 0.12, '#d8cfb8'),
  );
  for (const [lx, ly] of [
    [-0.95, -0.42],
    [-0.95, 0.28],
    [0.8, -0.42],
    [0.8, 0.28],
  ] as Nokta[])
    m.push(...kutu(lx, ly, 0, 0.2, 0.18, 0.9, kara));
  return tasi(dondur(m, 'z', yon), [x, y, 0]);
}

function mera(r: () => number): Model {
  const m: Model = [];
  const [x0, y0, x1, y1] = MERA;
  const ic = (x: number, y: number) => yere(x0 + 2 + (x1 - x0 - 4) * x, y0 + 2 + (y1 - y0 - 4) * y);
  // Çit: dünya eksenlerinde kare (ekranda eşkenar dörtgen).
  const [cx, cy] = yere((x0 + x1) / 2, (y0 + y1) / 2);
  const L = 14;
  m.push(
    ...cit(cx - L / 2, cy - L / 2, L, 'x', P.tahta, 1.1),
    ...cit(cx - L / 2, cy - L / 2, L, 'y', P.tahta, 1.1),
    ...cit(cx + L / 2, cy - L / 2, L, 'y', P.tahta, 1.1),
    ...cit(cx - L / 2, cy + L / 2, L * 0.6, 'x', P.tahta, 1.1),
  );
  m.push(...ambar(cx - L / 2 + 0.8, cy - L / 2 + 0.8, 0, 4, 3.4, 2.6));
  m.push(...kutu(cx + 2, cy - 4, 0, 2.4, 0.9, 0.55, P.koyuTahta));
  m.push(...kutu(cx + 2.15, cy - 3.85, 0.4, 2.1, 0.6, 0.12, P.su));
  m.push(...balya(cx - 3, cy + 4.5, 0, 0.8));
  for (let i = 0; i < 6; i++) {
    const [x, y] = ic(0.25 + r() * 0.7, 0.2 + r() * 0.7);
    m.push(...koyun(x, y, r() * Math.PI * 2));
  }
  for (let i = 0; i < 2; i++) {
    const [x, y] = ic(0.35 + r() * 0.5, 0.3 + r() * 0.5);
    m.push(...inek(x, y, r() * Math.PI * 2));
  }
  return m;
}

function meyveAgaci(x: number, y: number, r: () => number): Model {
  const m = birlestir(
    silindir(x, y, 0, 0.26, 1.8, P.koyuTahta, 5),
    kure(x, y, 2.8, 1.55, isikla(P.yaprak, 1.05), 6, 3, 0.15, r),
  );
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    m.push(
      ...kure(x + Math.cos(a) * 1.3, y + Math.sin(a) * 1.3, 2.4 + r() * 1, 0.22, '#c0392b', 4, 2),
    );
  }
  return m;
}

function meyveBahcesi(r: () => number): Model {
  const m: Model = [];
  const [x0, y0, x1, y1] = BAHCE;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const [x, y] = yere(x0 + 3 + i * 5, y0 + 2 + j * 4);
      m.push(...meyveAgaci(x + (r() - 0.5), y + (r() - 0.5), r));
    }
  // Arı kovanları ve bir sepet.
  const [kx, ky] = yere(x1 - 2, y1 - 3);
  for (let i = 0; i < 3; i++)
    m.push(
      ...kutu(kx + i * 1.2, ky, 0, 0.8, 0.8, 0.45, P.acikTahta),
      ...kutu(kx + i * 1.2, ky, 0.45, 0.8, 0.8, 0.4, '#d9b86a'),
      ...kutu(kx + i * 1.2 - 0.08, ky - 0.08, 0.85, 0.96, 0.96, 0.12, P.koyuTahta),
    );
  const [sx, sy] = yere(x0 + 8, y1 - 1);
  m.push(...silindir(sx, sy, 0, 0.5, 0.5, P.saman, 7), ...kure(sx, sy, 0.55, 0.3, '#c0392b', 5, 2));
  return m;
}

/** Talim kampı: çadırlar, ateş, silah sehpası; atlı ahır. */
function kamp(r: () => number): Model {
  const m: Model = [];
  const [x0, y0, x1] = KAMP;
  const [c1x, c1y] = yere(x0 + 4, y0 + 4);
  const [c2x, c2y] = yere(x0 + 10, y0 + 5.5);
  m.push(...cadir(c1x - 1.8, c1y - 1.5, 3.6, 3, 2.6, P.cadir, 'y'));
  m.push(...cadir(c2x - 1.8, c2y - 1.5, 3.6, 3, 2.6, P.kirmiziBez, 'y'));
  // Ateş: taş halka, kütükler, alev, duman.
  const [fx, fy] = yere(x0 + 14, y0 + 3.5);
  m.push(...prizma(cember(fx, fy, 0.9, 7), 0, 0.3, P.kaya));
  const alev = koni(fx, fy, 0.3, 0.55, 1.4, P.ates, 6);
  for (const f of alev) f.isima = 1;
  m.push(...alev, ...duman(fx + 0.3, fy - 0.2, 2.2, r, 2));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    m.push(
      ...kutu(
        fx + Math.cos(a) * 2 - 0.7,
        fy + Math.sin(a) * 2 - 0.25,
        0,
        1.4,
        0.5,
        0.45,
        P.koyuTahta,
      ),
    );
  }
  const [sx, sy] = yere(x0 + 18.5, y0 + 2.5);
  m.push(
    ...sandik(sx, sy, 0, 1),
    ...sandik(sx + 1.2, sy + 0.3, 0, 0.9),
    ...fici(sx - 1.2, sy + 1.2),
  );
  m.push(...mesale(sx + 2.5, sy - 1.5));
  // Ahır: dört direk üstünde saman çatı; altında iki at, yemlik.
  const [ax, ay] = yere(x1 - 7, y0 + 4.5);
  for (const [px, py] of [
    [0, 0],
    [5, 0],
    [0, 4],
    [5, 4],
  ] as Nokta[])
    m.push(...kutu(ax + px - 0.15, ay + py - 0.15, 0, 0.3, 0.3, 3.8, P.koyuTahta));
  // Çatı atların sırtının üstünde ve arkaya eğik: öndeki at görünsün.
  m.push(...kutu(ax - 0.4, ay - 0.4, 3.8, 5.8, 2.6, 0.3, P.saman));
  m.push(...kutu(ax + 0.3, ay + 0.4, 0, 4.4, 0.6, 0.7, P.tahta));
  for (let i = 0; i < 2; i++) {
    const a = durgun(
      olcekle(
        at({ renk: i ? '#6b4a2e' : '#d8d0c0', yele: i ? '#2e2018' : '#8a7a66', eyer: '#5a3a22' }),
        FIGUR_OLCEK,
      ),
    );
    m.push(...tasi(dondur(a, 'z', Math.PI / 2), [ax + 1.4 + i * 2.2, ay + 2.2, 0]));
  }
  m.push(...balya(ax + 6.4, ay + 1, 0, 0.7));
  return m;
}

/** Salınımı kaldırır: kalabalık sahnede her figür ayrı katman olurdu. */
function durgun(m: Model): Model {
  for (const y of m) delete y.bez;
  return m;
}

/* ── Serpinti ve orman ─────────────────────────────────────────────── */

const CICEK = ['#e8d44a', '#f2f0e6', '#c9463d', '#9b6ad0', '#e88a3a'];

function cali(x: number, y: number, r: () => number): Model {
  const renk = r() < 0.5 ? P.koyuYaprak : isikla(P.yaprak, 0.92);
  return birlestir(
    kure(x, y, 0.45, 0.7 + r() * 0.3, renk, 6, 3, 0.2, r),
    kure(x + 0.55, y - 0.3, 0.35, 0.5 + r() * 0.2, isikla(renk, 1.08), 5, 3, 0.2, r),
  );
}

function cicekler(x: number, y: number, r: () => number): Model {
  const m: Model = [];
  const renk = CICEK[Math.floor(r() * CICEK.length)]!;
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 1.1;
    m.push(...kutu(x + Math.cos(a) * d, y + Math.sin(a) * d, 0, 0.22, 0.22, 0.3 + r() * 0.2, renk));
  }
  return m;
}

function kutuk(x: number, y: number): Model {
  return silindir(x, y, 0, 0.45, 0.5, { ust: '#c9a26a', yan: P.koyuTahta }, 6);
}

/** Açık çimene serpinti: çalı, çiçek, kaya, kütük (dolu yerlere değil). */
function serpinti(r: () => number, adet: number): Model {
  const m: Model = [];
  let kalan = adet;
  let deneme = 0;
  while (kalan > 0 && deneme++ < adet * 30) {
    const sx = -48 + r() * 96;
    const sy = -44 + r() * 100;
    if (doluMu(sx, sy, 0.5)) continue;
    const [x, y] = yere(sx, sy);
    const t = r();
    if (t < 0.4) m.push(...cali(x, y, r));
    else if (t < 0.72) m.push(...cicekler(x, y, r));
    else if (t < 0.88) m.push(...kaya(x, y, 0, 0.4 + r() * 0.5, r));
    else m.push(...kutuk(x, y));
    kalan--;
  }
  return m;
}

/** Kıyıda orman: yerleşkenin dolu olmayan her yerinde; durağan. */
function orman(r: () => number): Model {
  const m: Model = [];
  let kalan = 84;
  let deneme = 0;
  while (kalan > 0 && deneme++ < 4000) {
    const sx = -50 + r() * 100;
    const sy = -46 + r() * 104;
    if (doluMu(sx, sy, 1.5)) continue;
    const [x, y] = yere(sx, sy);
    if (r() < 0.45) m.push(...cam(x, y, 0, r, 1 + r() * 0.35));
    else m.push(...agac(x, y, 0, r, 1 + r() * 0.35));
    kalan--;
  }
  // Kıyıdaki orman durağan: salınan her ağaç ayrı bir katman ve seksen ağaç
  // telefonun GPU belleğinde megapikseller demekti. Kasabadakiler salınıyor.
  return durgun(m);
}

/* ── Patikalar ─────────────────────────────────────────────────────── */

/** Toprak patika: ekrandaki kırık çizgi boyunca yere yatık şerit, köşeleri yuvarlak. */
function patika(yol: Nokta[], gen = 1.5): Model {
  const renk = isikla(P.toprak, 1.06);
  const m: Model = [];
  const d = yol.map(([x, y]) => yere(x, y));
  const zemin = (f: Yuz): Yuz => ({ ...f, katman: -1, kenarsiz: true });
  for (let i = 0; i < d.length - 1; i++) {
    const [ax, ay] = d[i]!;
    const [bx, by] = d[i + 1]!;
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / l) * (gen / 2);
    const ny = ((bx - ax) / l) * (gen / 2);
    m.push(
      zemin({
        p: [
          [ax + nx, ay + ny, 0.02],
          [ax - nx, ay - ny, 0.02],
          [bx - nx, by - ny, 0.02],
          [bx + nx, by + ny, 0.02],
        ],
        renk,
        ciftYuz: true,
      }),
    );
  }
  for (const [x, y] of d) m.push(...prizma(cember(x, y, gen / 2, 12), 0.01, 0.01, renk).map(zemin));
  return m;
}

/**
 * Kasabadan çevreye patikalar: köy evlerine ve gölete, yel değirmenine,
 * köprüye ve su değirmenine, talim kampına, tarlaya, meraya. Çevre
 * kasabaya bağlı görünsün: yolsuz ev ıssız duruyordu.
 */
function patikalar(): Model {
  return [
    ...patika([
      [-27, 7],
      [-33, 5],
      [-38.5, 6.5],
    ]),
    ...patika([
      [-38.5, 6.5],
      [-37, 11],
    ]),
    ...patika([
      [-38.5, 6.5],
      [-40, 0],
      [-39, -3],
    ]),
    ...patika([
      [-23, -13],
      [-31, -19],
      [-38, -22.5],
    ]),
    ...patika([
      [-31, -19],
      [-38, -17],
      [-43, -16.5],
    ]),
    ...patika([
      [26, 8],
      [31, 6.5],
      [33.5, 3],
      [37, -1.2],
    ]),
    ...patika([
      [22, -13],
      [29, -16],
      [35.5, -18],
    ]),
    ...patika([
      [29, -16],
      [32, -11],
    ]),
    ...patika([
      [1, 23],
      [0, 28],
      [1, 35],
    ]),
    ...patika([
      [-18, 22],
      [-24, 24.5],
      [-28, 25],
    ]),
    ...patika([
      [-3, -11],
      [-4, -19],
      [-2.5, -27],
    ]),
    ...patika([
      [-30, 32],
      [-33, 38],
      [-35, 41.5],
    ]),
  ];
}

/* ── Hepsi ─────────────────────────────────────────────────────────── */

/** Kasabanın içinde yapıların yanında ufak eşya: fıçı, sandık, odun, saman. */
function kasabaEsyasi(kademe: Kademe, r: () => number): Model {
  const m: Model = [];
  // Ekrandaki yerler: yapı yuvalarının yanında, yolların dışında.
  const yerler: [Nokta, 'fici' | 'sandik' | 'odun' | 'balya' | 'araba' | 'agac'][] = [
    [[-27, 6], 'odun'],
    [[-13, -2], 'fici'],
    [[-11.8, -1.2], 'sandik'],
    [[5, 24], 'sandik'],
    [[-6, 23], 'fici'],
    [[27.5, 13], 'sandik'],
    [[28.5, 14.3], 'fici'],
    [[-27, 19], 'balya'],
    [[-25, 21], 'balya'],
    [[12, -2], 'araba'],
    [[-30, -2], 'agac'],
    [[29, -3], 'agac'],
    [[-3, 5], 'agac'],
    [[9, -21], 'agac'],
    [[-14, -22], 'agac'],
  ];
  for (const [[sx, sy], ne] of yerler) {
    const [x, y] = yere(sx, sy);
    if (ne === 'fici') m.push(...olcekle(fici(x, y), 0.8, [x, y, 0]));
    else if (ne === 'sandik') m.push(...sandik(x, y, 0, 1));
    else if (ne === 'odun') m.push(...odun(x, y));
    else if (ne === 'balya') m.push(...balya(x, y, 0, 0.7));
    else if (ne === 'araba') m.push(...araba(x, y, 0, 'y'));
    else m.push(...durgun(agac(x, y, 0, r, 0.85)));
  }
  // Köy meydanında kuyu (kasabada zaten var; şehir ve üstü taş meydan).
  if (kademe === 'koy') {
    const [x, y] = yere(2.2, 4.5);
    m.push(...kuyuKucuk(x, y, 0));
  }
  return m;
}

/**
 * Yerleşkenin çevresi: dere ve köprü, su ve yel değirmeni, gölet, köy
 * evleri, mera, meyve bahçesi, talim kampı, kasabanın ufak eşyası,
 * serpinti ve orman. Kademe evlerin sayısını ve dokusunu değiştiriyor.
 */
export function cevre(kademe: Kademe, r: () => number): Model {
  return [
    ...patikalar(),
    ...dere(),
    ...kopru([KOPRU[0] - 4.2, KOPRU[1] + 0.4], [KOPRU[0] + 4.2, KOPRU[1] - 0.4]),
    ...golet(r),
    ...yelDegirmeni(),
    ...suDegirmeni(r),
    ...koyEvleri(kademe, r),
    ...mera(r),
    ...meyveBahcesi(r),
    ...kamp(r),
    ...kasabaEsyasi(kademe, r),
    ...serpinti(r, 110),
    ...orman(r),
  ];
}
