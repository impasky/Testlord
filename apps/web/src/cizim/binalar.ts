/**
 * ŞEHİR YAPILARI — 12 bina × 3 aşama + arsa, görev panosu, haberci
 * kulesi, onur meydanı (docs/24).
 *
 * Aşamanın dili bütün binalarda aynı (Sehir.tsx `spriteAdi`):
 *   _1  ahşap, tek kat, saman ya da tahta çatı
 *   _3  taş taban + yarı ahşap üst kat, arduvaz/kiremit
 *   _5  tam taş, çok katlı; kule, sancak, avlu
 * Oyuncu binayı yükselttiğinde değişikliği bir bakışta görmeli.
 *
 * Hepsi 16×16'lık aynı zemin plakasında ve aynı çerçevede çiziliyor
 * (`BINA_KUTUSU`): yan yana durduklarında ölçek tutuyor.
 */
import {
  agac,
  baca,
  bayrak,
  cadir,
  cit,
  doseme,
  duman,
  fener,
  fici,
  ince,
  kapi,
  kaya,
  kemer,
  kirisler,
  mesale,
  palisat,
  pencere,
  sancak,
  sandik,
  tabela,
  tasDokusu,
  tekne,
  tente,
  yuvarlakKule,
  yuzeyKutusu,
  zeminPlakasi,
  type Ikon,
  type Yon,
} from './parca';
import { P, isikla } from './renk';
import { rastgele } from './rastgele';
import {
  besikCati,
  birlestir,
  dokula,
  dondur,
  katmanla,
  kirmaCati,
  koni,
  kure,
  kutu,
  levha,
  mazgal,
  prizma,
  sabitKutu,
  silindir,
  tasi,
  type Model,
  type V3,
} from './uc';

export const BINA_KUTUSU = sabitKutu([-0.8, -0.8, -1.2], [16.8, 16.8, 17.5]);

/* ── Genel yapı kurucu ─────────────────────────────────────────────── */

type Duvar = 'tahta' | 'tas' | 'kiris' | 'acikTas';

interface Kat {
  h: number;
  duvar: Duvar;
  /** Üst katın alttakinden dışarı taşması (yarı ahşap evlerin çıkması). */
  tasma?: number;
}

interface Cati {
  tip: 'besik' | 'kirma' | 'duz';
  renk: string;
  h: number;
  yon?: Yon;
}

const DUVAR_RENGI: Record<Duvar, string> = {
  tahta: P.tahta,
  tas: P.tas,
  kiris: P.siva,
  acikTas: P.acikTas,
};

/** Kepenk boyaları: yapıdan yapıya biri (tohumlu). */
const KEPENK = ['#4e6a4a', '#4a5f78', '#7a3f30', '#8a6a3a', '#5a4a6a'];

/** Pencere altında çiçeklik: tahta saksı, içinde renkli çiçekler (yalnız GPU). */
function ciceklik(yuz: Yon, duz: number, u: number, z: number, r: () => number): Model {
  const m: Model = [...yuzeyKutusu(yuz, duz, u - 0.1, z - 0.75, 1.6, 0.4, 0.42, P.tahta)];
  const renk = ['#d84a4a', '#f2d25a', '#e88ab8', '#f4f1e4'][Math.floor(r() * 4)]!;
  for (let j = 0; j < 4; j++) {
    const uu = u + 0.05 + j * 0.38;
    const c = j % 2 ? '#5f8a3a' : renk;
    m.push(...yuzeyKutusu(yuz, duz, uu, z - 0.42, 0.28, 0.24, 0.36, c));
  }
  return ince(m);
}

/**
 * Beşik çatının ayrıntısı (yalnız GPU): mahya kirişi, görünen alında iki
 * eğik alın tahtası ve küçük çatı penceresi. Düz iki yüzey "kutu üstüne
 * kapak" gibi duruyordu.
 */
function catiAyrintisi(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  h: number,
  yon: Yon,
  renk: string,
): Model {
  const m: Model = [];
  const koyu = isikla(renk, 0.72);
  const tahta = P.koyuTahta;
  // `besikCati` ile aynı taşmalar.
  const sacak = 0.5;
  const uc = 0.25;
  const serit = (A: V3, B: V3, d: V3): Model =>
    levha(
      [A, B, [B[0] + d[0], B[1] + d[1], B[2] + d[2]], [A[0] + d[0], A[1] + d[1], A[2] + d[2]]],
      tahta,
    );
  if (yon === 'x') {
    const ym = y + sy / 2;
    m.push(...kutu(x - uc, ym - 0.28, z + h - 0.12, sx + uc * 2, 0.56, 0.24, koyu));
    const X = x + sx + uc + 0.03;
    const [y0, y1] = [y - sacak, y + sy + sacak];
    const L = Math.hypot(ym - y0, h);
    const [ey, ez] = [(ym - y0) / L, h / L];
    m.push(...serit([X, y0, z], [X, ym, z + h], [0, ez * 0.32, -ey * 0.32]));
    m.push(...serit([X, y1, z], [X, ym, z + h], [0, -ez * 0.32, -ey * 0.32]));
    if (h >= 2.6 && sy >= 4)
      m.push(...pencere('x', x + sx, ym - 0.45, z + h * 0.24, 0.9, 0.9, true));
  } else {
    const xm = x + sx / 2;
    m.push(...kutu(xm - 0.28, y - uc, z + h - 0.12, 0.56, sy + uc * 2, 0.24, koyu));
    const Y = y + sy + uc + 0.03;
    const [x0, x1] = [x - sacak, x + sx + sacak];
    const L = Math.hypot(xm - x0, h);
    const [ex, ez] = [(xm - x0) / L, h / L];
    m.push(...serit([x0, Y, z], [xm, Y, z + h], [ez * 0.32, 0, -ex * 0.32]));
    m.push(...serit([x1, Y, z], [xm, Y, z + h], [-ez * 0.32, 0, -ex * 0.32]));
    if (h >= 2.6 && sx >= 4)
      m.push(...pencere('y', y + sy, xm - 0.45, z + h * 0.24, 0.9, 0.9, true));
  }
  return ince(m);
}

/** Sıradaki yapının tabelası (`binaModeli` koyuyor, ilk `yapi` alıyor). */
let siradakiTabela: Ikon | undefined;

/**
 * Katları üst üste kurar, görünen iki yüze pencere dizer, zemin katına
 * kapı koyar, en üste çatıyı oturtur. Dönen `ust`: çatının başladığı z.
 * Ayrıntı: ahşap ve sıvalı zemin katın altında taş temel, taş duvarın
 * köşesinde köşe taşları, kepenkli pencereler ve çiçeklikler, kapının
 * yanında fener ve yapının tabelası, beşik çatıda mahya, alın tahtası,
 * çatı penceresi (ince olanlar yalnız GPU).
 */
function yapi(
  r: () => number,
  x: number,
  y: number,
  sx: number,
  sy: number,
  katlar: Kat[],
  cati: Cati,
  { kapiYuz = 'y' as Yon, isikli = false, pencereYok = false } = {},
): { m: Model; ust: number; kutu: [number, number, number, number] } {
  const m: Model = [];
  // Yapının kimliği (bkz. `binaModeli`): ilk yapı tabelayı alıyor.
  const ikon = siradakiTabela;
  siradakiTabela = undefined;
  const kepenk = KEPENK[Math.floor(r() * KEPENK.length)]!;
  let z = 0;
  let [kx, ky, ksx, ksy] = [x, y, sx, sy];
  katlar.forEach((k, i) => {
    const t = k.tasma ?? 0;
    kx -= t;
    ky -= t;
    ksx += t * 2;
    ksy += t * 2;
    const renk = DUVAR_RENGI[k.duvar];
    const govde = kutu(kx, ky, z, ksx, ksy, k.h, renk);
    m.push(...(k.duvar === 'tahta' ? dokula(govde, 'tahta') : govde));
    if (k.duvar === 'tas' || k.duvar === 'acikTas')
      m.push(...tasDokusu(kx, ky, z, ksx, ksy, k.h, renk, r));
    if (k.duvar === 'kiris') m.push(...kirisler(kx, ky, z, ksx, ksy, k.h));
    // Ahşap ve sıvalı zemin katın altında taş temel: yapı yere oturuyor.
    if (i === 0 && (k.duvar === 'tahta' || k.duvar === 'kiris'))
      m.push(...dokula(kutu(kx - 0.18, ky - 0.18, 0, ksx + 0.36, ksy + 0.36, 0.6, P.tas), 'tas'));
    // Taş duvarın görünen köşesinde açık renk köşe taşları (sırayla uzun-kısa).
    if (k.duvar === 'tas' || k.duvar === 'acikTas') {
      const X = kx + ksx;
      const Y = ky + ksy;
      const acik = isikla(renk, 1.18);
      const kose: Model = [];
      for (let zz = z + 0.1, j = 0; zz < z + k.h - 0.4; zz += 0.85, j++) {
        const [a, b] = j % 2 ? [0.6, 1.1] : [1.1, 0.6];
        kose.push(...kutu(X - a, Y - 0.06, zz, a + 0.06, 0.12, 0.5, acik));
        kose.push(...kutu(X - 0.06, Y - b, zz, 0.12, b + 0.06, 0.5, acik));
      }
      m.push(...ince(kose));
    }
    if (k.duvar === 'tahta') {
      // Tahta duvar: köşe dikmeleri ve üst kuşak.
      m.push(...kutu(kx + ksx - 0.3, ky + ksy - 0.3, z, 0.4, 0.4, k.h, P.koyuTahta));
      m.push(...kutu(kx + ksx - 0.3, ky - 0.1, z, 0.4, 0.4, k.h, P.koyuTahta));
      m.push(...kutu(kx - 0.1, ky + ksy - 0.3, z, 0.4, 0.4, k.h, P.koyuTahta));
    }
    // Pencereler: iki görünen yüzde, aralıklı.
    if (!pencereYok) {
      const dizi = (uzun: number) => {
        const n = Math.max(1, Math.floor((uzun - 1) / 3.4));
        return Array.from({ length: n }, (_, j) => (uzun / (n + 1)) * (j + 1) - 0.7);
      };
      const pz = z + (i === 0 ? k.h * 0.38 : k.h * 0.3);
      const ph = Math.min(1.8, k.h * 0.38);
      const kp = k.duvar === 'tas' ? undefined : kepenk;
      for (const u of dizi(ksy)) {
        if (i === 0 && kapiYuz === 'x' && Math.abs(u + 0.7 - ksy / 2) < 1.8) continue;
        m.push(...pencere('x', kx + ksx, ky + u, pz, 1.4, ph, isikli && r() > 0.4, undefined, kp));
        if (i === 0 && r() < 0.5) m.push(...ciceklik('x', kx + ksx, ky + u, pz, r));
      }
      for (const u of dizi(ksx)) {
        if (i === 0 && kapiYuz === 'y' && Math.abs(u + 0.7 - ksx / 2) < 1.8) continue;
        m.push(...pencere('y', ky + ksy, kx + u, pz, 1.4, ph, isikli && r() > 0.4, undefined, kp));
        if (i === 0 && r() < 0.5) m.push(...ciceklik('y', ky + ksy, kx + u, pz, r));
      }
    }
    if (i === 0) {
      const kh = Math.min(3.4, k.h - 0.6);
      const duz = kapiYuz === 'y' ? ky + ksy : kx + ksx;
      const orta = kapiYuz === 'y' ? kx + ksx / 2 : ky + ksy / 2;
      m.push(...kapi(kapiYuz, duz, orta - 1, z, 2, kh));
      // Kapının bir yanında fener, öbür yanında yapının tabelası.
      m.push(...fener(kapiYuz, duz, orta - 1.75, z + kh + 0.1));
      if (ikon)
        m.push(...tabela(kapiYuz, duz, orta + 1.85, z + Math.min(kh + 0.6, k.h - 0.2), ikon));
    }
    z += k.h;
  });
  if (cati.tip === 'besik') {
    const alin = DUVAR_RENGI[katlar[katlar.length - 1]!.duvar];
    m.push(...besikCati(kx, ky, z, ksx, ksy, cati.h, cati.yon ?? 'x', cati.renk, alin));
    m.push(...catiAyrintisi(kx, ky, z, ksx, ksy, cati.h, cati.yon ?? 'x', cati.renk));
  } else if (cati.tip === 'kirma') {
    m.push(...kirmaCati(kx, ky, z, ksx, ksy, cati.h, cati.renk));
  } else {
    // Düz çatı + mazgallı korkuluk: kale gövdesi.
    const tr = DUVAR_RENGI[katlar[katlar.length - 1]!.duvar];
    m.push(...mazgal(kx, ky + ksy - 0.8, z, ksx, 0.8, 'x', tr));
    m.push(...mazgal(kx + ksx - 0.8, ky, z, ksy, 0.8, 'y', tr));
    m.push(...mazgal(kx, ky, z, ksx, 0.8, 'x', tr));
    m.push(...mazgal(kx, ky, z, ksy, 0.8, 'y', tr));
  }
  return { m, ust: z, kutu: [kx, ky, ksx, ksy] };
}

function plaka(r: () => number, ust: string = P.cimen, yan: string = P.toprak) {
  return zeminPlakasi(0, 0, 16, 16, r, ust, yan);
}

/** Talim kuklası: direk + kol + çuval gövde. */
export function kukla(x: number, y: number): Model {
  return birlestir(
    silindir(x, y, 0, 0.15, 3.2, P.koyuTahta, 5),
    kutu(x - 1.1, y - 0.12, 2.3, 2.2, 0.24, 0.24, P.tahta),
    silindir(x, y, 1.3, 0.55, 1.5, P.bez, 6),
    kure(x, y, 3.2, 0.45, P.bez, 6, 3),
  );
}

/** Mızrak sehpası. */
export function mizrakSehpasi(x: number, y: number): Model {
  const m = kutu(x, y, 0.8, 0.25, 3, 0.25, P.koyuTahta);
  m.push(
    ...kutu(x, y, 0, 0.25, 0.25, 1.2, P.koyuTahta),
    ...kutu(x, y + 2.75, 0, 0.25, 0.25, 1.2, P.koyuTahta),
  );
  for (let i = 0; i < 4; i++) {
    m.push(...silindir(x + 0.3, y + 0.4 + i * 0.7, 0, 0.07, 3.6, P.tahta, 4));
    m.push(...koni(x + 0.3, y + 0.4 + i * 0.7, 3.6, 0.16, 0.6, P.celik, 4));
  }
  return m;
}

/** Kamp ateşi: taş halka + kor. */
export function ates(x: number, y: number): Model {
  const m: Model = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    m.push(
      ...kutu(
        x + Math.cos(a) * 0.9 - 0.25,
        y + Math.sin(a) * 0.9 - 0.25,
        0,
        0.5,
        0.5,
        0.35,
        P.kaya,
      ),
    );
  }
  const alev = koni(x, y, 0.1, 0.55, 1.4, P.ates, 5);
  const ic = koni(x, y, 0.1, 0.3, 0.9, P.kor, 5);
  for (const f of [...alev, ...ic]) f.isima = 1;
  return birlestir(m, alev, ic);
}

/** Örs + ocak: demircinin işareti. */
export function ors(x: number, y: number): Model {
  return birlestir(
    kutu(x, y, 0, 0.9, 0.9, 0.9, P.koyuTahta),
    kutu(x - 0.3, y + 0.1, 0.9, 1.5, 0.7, 0.45, P.demir),
    kutu(x + 1.2, y + 0.25, 1.1, 0.5, 0.4, 0.2, P.demir),
  );
}

/* ── Yapı çevresinin ayrıntıları (yalnız GPU olanlar `ince`) ──────── */

/** Serbest duran tabela: direk ve üstünden sarkan simgeli tahta. */
function tabelaDiregi(x: number, y: number, ikon: Ikon, z = 3.2): Model {
  return birlestir(
    kutu(x - 0.14, y - 0.14, 0, 0.28, 0.28, z + 0.25, P.koyuTahta),
    tabela('x', x + 0.14, y, z, ikon),
  );
}

/** İçi dolu kasa: tahta kasa, üstünde öbek öbek meyve ya da sebze. */
function doluKasa(x: number, y: number, renk: string, r: () => number): Model {
  const m: Model = [...kutu(x, y, 0, 1.3, 1.0, 0.7, { ust: P.acikTahta, yan: P.tahta })];
  const ic: Model = [];
  for (let i = 0; i < 6; i++)
    ic.push(
      ...kure(
        x + 0.25 + (i % 3) * 0.4,
        y + 0.28 + Math.floor(i / 3) * 0.42,
        0.78,
        0.22,
        isikla(renk, 0.9 + r() * 0.2),
        5,
        2,
      ),
    );
  return birlestir(m, ince(ic));
}

/** Çuval: ağzı bağlı, tombul. */
function cuval(x: number, y: number, renk = '#c9b48a'): Model {
  return birlestir(
    kutu(x, y, 0, 0.9, 0.8, 0.75, renk),
    kutu(x + 0.15, y + 0.12, 0.75, 0.6, 0.56, 0.2, isikla(renk, 0.92)),
    ince(kutu(x + 0.33, y + 0.3, 0.95, 0.24, 0.2, 0.14, isikla(renk, 0.75))),
  );
}

/** Alet rafı: iki direk ve kiriş, kirişte asılı çekiç, kerpeten, testere (yalnız GPU ayrıntı). */
function aletRafi(x: number, y: number): Model {
  const m: Model = [
    ...kutu(x, y, 0, 0.22, 0.22, 2.6, P.koyuTahta),
    ...kutu(x, y + 2.6, 0, 0.22, 0.22, 2.6, P.koyuTahta),
    ...kutu(x, y, 2.4, 0.22, 2.82, 0.2, P.koyuTahta),
  ];
  const alet: Model = [];
  for (let i = 0; i < 4; i++) {
    const u = y + 0.45 + i * 0.6;
    alet.push(...kutu(x + 0.05, u, 1.3, 0.1, 0.08, 1.1, P.tahta));
    alet.push(...kutu(x - 0.05, u - 0.12, 1.15 + (i % 2) * 0.1, 0.3, 0.32, 0.22, P.demir));
  }
  return birlestir(m, ince(alet));
}

/** Silah rafı: kalkanlar ve dik duran mızraklar. */
function kalkanRafi(x: number, y: number): Model {
  const m: Model = [
    ...kutu(x, y, 0, 0.2, 3.2, 0.2, P.koyuTahta),
    ...kutu(x, y, 1.4, 0.2, 3.2, 0.2, P.koyuTahta),
  ];
  const k: Model = [];
  ['#9a2a24', '#3a5a8a', '#9a2a24'].forEach((renk, i) => {
    const u = y + 0.3 + i * 1.0;
    k.push(...kutu(x + 0.2, u, 0.3, 0.14, 0.85, 1.1, renk));
    k.push(...kutu(x + 0.34, u + 0.36, 0.7, 0.06, 0.14, 0.3, P.altin));
  });
  return birlestir(m, ince(k));
}

/** Balık ağı: iki direk arasında kurumaya serilmiş ağ (yalnız GPU). */
function balikAgi(x: number, y: number): Model {
  const m: Model = [
    ...kutu(x, y, 0, 0.18, 0.18, 2.4, P.koyuTahta),
    ...kutu(x, y + 3, 0, 0.18, 0.18, 2.4, P.koyuTahta),
  ];
  const ag: Model = [...kutu(x + 0.05, y, 2.2, 0.08, 3.2, 0.06, '#d8c9a0')];
  for (let i = 0; i < 6; i++)
    ag.push(...kutu(x + 0.06, y + 0.25 + i * 0.5, 0.9, 0.05, 0.05, 1.3, '#bfae88'));
  for (let j = 0; j < 3; j++)
    ag.push(...kutu(x + 0.06, y + 0.2, 1.0 + j * 0.42, 0.05, 2.8, 0.05, '#bfae88'));
  return birlestir(m, ince(ag));
}

export function ocak(x: number, y: number, s = 2.2): Model {
  const kor = kutu(x + 0.3, y + 0.3, s * 0.55, s - 0.6, s - 0.6, 0.15, P.ates);
  for (const f of kor) f.isima = 1;
  return birlestir(kutu(x, y, 0, s, s, s * 0.55, P.koyuTas), kor);
}

/** Bostan: toprak sırası + yeşil yumrular. */
function bostan(
  x: number,
  y: number,
  sx: number,
  sy: number,
  r: () => number,
  renk: string = P.koyuCimen,
): Model {
  const m = katmanla(kutu(x, y, 0, sx, sy, 0.25, P.toprak), -1);
  for (let i = 0.6; i < sx - 0.3; i += 1.2)
    for (let j = 0.6; j < sy - 0.3; j += 1.1)
      m.push(...kure(x + i, y + j, 0.4, 0.38, isikla(renk, 0.9 + r() * 0.3), 5, 2, 0.2, r));
  return m;
}

/** Kuyu: taş halka + çatı. */
function kuyu(x: number, y: number): Model {
  return birlestir(
    silindir(x, y, 0, 1.1, 1, P.tas, 8),
    silindir(x, y, 0.95, 0.8, 0.1, P.su, 8),
    kutu(x - 1, y - 0.1, 1, 0.2, 0.2, 2.4, P.koyuTahta),
    kutu(x + 0.8, y - 0.1, 1, 0.2, 0.2, 2.4, P.koyuTahta),
    besikCati(x - 1.2, y - 0.8, 3.3, 2.4, 1.6, 0.8, 'x', P.kiremit, P.koyuTahta, 0.1),
  );
}

/** Su yüzeyi (plakaya gömülü). */
function su(x: number, y: number, sx: number, sy: number): Model {
  const m = katmanla(kutu(x, y, -0.6, sx, sy, 0.45, P.su), -1);
  // Parıltı çizgileri
  for (let i = 0; i < 4; i++)
    m.push(
      ...levha(
        [
          [x + 1 + i * 1.7, y + 0.8 + (i % 2) * 1.6, -0.12],
          [x + 2.2 + i * 1.7, y + 0.8 + (i % 2) * 1.6, -0.12],
          [x + 2.2 + i * 1.7, y + 1.0 + (i % 2) * 1.6, -0.12],
          [x + 1 + i * 1.7, y + 1.0 + (i % 2) * 1.6, -0.12],
        ],
        isikla(P.su, 1.35),
      ).map((f) => ({ ...f, katman: -1 })),
    );
  return m;
}

/* ── Binalar ───────────────────────────────────────────────────────── */

type Tarif = (r: () => number) => Model;

const T: Record<string, Tarif> = {
  /*
   * Boş arsa: yapılmaya hazır bir inşaat yeri. Önceden toprak bir plakanın
   * üç yanı çitliydi; yerleşkede çamurlu bir ağıl gibi okunuyordu. Şimdi
   * zemin çayır (sahnede plaka yok, çayır görünüyor), ortada sıkıştırılmış
   * temel izi, köşe kazıkları arasında gerili ip, arka kenarlarda dizilmeye
   * başlanmış temel taşları; önde kereste ve taş yığını, tabela.
   */
  arsa: (r) => {
    const m: Model = [...plaka(r)];
    // Temel izi (yere yapışık; yerleşkede çimen sayılmıyor).
    m.push(
      ...katmanla(
        prizma(
          [
            [3.4, 3.4],
            [12.6, 3.4],
            [12.6, 12.6],
            [3.4, 12.6],
          ],
          0,
          0.04,
          isikla(P.toprak, 1.14),
        ),
        -1,
      ).map((f) => ({ ...f, kenarsiz: true })),
    );
    // Köşe kazıkları ve aralarında ip.
    const kose: [number, number][] = [
      [3.2, 3.2],
      [12.8, 3.2],
      [12.8, 12.8],
      [3.2, 12.8],
    ];
    for (const [x, y] of kose) m.push(...kutu(x - 0.16, y - 0.16, 0, 0.32, 0.32, 1.4, P.koyuTahta));
    const ip = '#efe3c0';
    m.push(
      ...kutu(3.2, 3.16, 1.05, 9.6, 0.08, 0.08, ip),
      ...kutu(3.2, 12.76, 1.05, 9.6, 0.08, 0.08, ip),
      ...kutu(3.16, 3.2, 1.05, 0.08, 9.6, 0.08, ip),
      ...kutu(12.76, 3.2, 1.05, 0.08, 9.6, 0.08, ip),
    );
    // Arka iki kenarda temel taşları (dizilmeye başlanmış).
    const tas = { ust: P.acikTas, yan: P.tas };
    for (let i = 0; i < 5; i++) {
      const b = 0.5 + r() * 0.15;
      m.push(...dokula(kutu(3.6 + i * 1.75, 3.6, 0.04, 1.5, 1.0, b, tas), 'tas'));
    }
    for (let j = 0; j < 3; j++) {
      const b = 0.5 + r() * 0.15;
      m.push(...dokula(kutu(3.6, 5.5 + j * 1.75, 0.04, 1.0, 1.5, b, tas), 'tas'));
    }
    // Önde kereste yığını ve taş öbeği.
    m.push(
      ...kutu(9.6, 13.6, 0, 4.2, 1.3, 0.32, P.acikTahta),
      ...kutu(9.8, 13.65, 0.32, 3.9, 1.2, 0.32, P.tahta),
      ...kutu(9.7, 13.7, 0.64, 3.6, 1.1, 0.3, P.acikTahta),
      ...kaya(13.9, 9.8, 0, 0.9, r),
      ...kaya(14.4, 11.2, 0, 0.7, r),
      ...kaya(13.6, 11.0, 0.3, 0.6, r),
    );
    // Tabela: direk ve tahta.
    m.push(
      ...kutu(14.2, 14.2, 0, 0.22, 0.22, 2.6, P.koyuTahta),
      ...kutu(13.6, 14.08, 1.7, 1.4, 0.12, 0.8, P.acikTahta),
    );
    return m;
  },

  malikane_1: (r) => {
    const ev = yapi(r, 3.5, 4, 8, 6, [{ h: 4.2, duvar: 'tahta' }], {
      tip: 'besik',
      renk: P.saman,
      h: 3.6,
    });
    return birlestir(
      plaka(r),
      ev.m,
      baca(5, 5, ev.ust + 1.2, 2.4, P.kaya),
      cit(13.5, 2.5, 11, 'y'),
      cit(2.5, 13.5, 11, 'x'),
      bostan(12.8 - 3, 11, 3, 2, r),
      fici(12.5, 5),
    );
  },

  malikane_3: (r) => {
    const ev = yapi(
      r,
      3.5,
      3.5,
      8,
      6.5,
      [
        { h: 4.2, duvar: 'tas' },
        { h: 4, duvar: 'kiris', tasma: 0.4 },
      ],
      { tip: 'besik', renk: P.arduvaz, h: 4 },
      { isikli: true },
    );
    return birlestir(
      plaka(r),
      ev.m,
      baca(9, 4, ev.ust + 1.5, 3, P.tas),
      kutu(13.6, 2, 0, 0.7, 12, 1.4, P.tas),
      kutu(2, 13.6, 0, 12.3, 0.7, 1.4, P.tas),
      bostan(12, 11.5, 1.4, 1.8, r, P.cimen),
      agac(13.8, 3.2, 0, r, 0.9),
    );
  },

  malikane_5: (r) => {
    const ev = yapi(
      r,
      2.5,
      3,
      9.5,
      7,
      [
        { h: 5, duvar: 'tas' },
        { h: 4.5, duvar: 'tas' },
      ],
      { tip: 'kirma', renk: P.kiremit, h: 4.5 },
      { isikli: true },
    );
    return birlestir(
      plaka(r),
      doseme(5.5, 10, 3.5, 5.5),
      ev.m,
      yuvarlakKule(12.8, 11.6, 0, 2.1, 10, P.tas, false),
      koni(12.8, 11.6, 10, 2.6, 3.6, P.kiremit, 10),
      pencere('x', 14.9, 11.1, 6.2, 1, 1.5, true),
      bayrak(12.8, 11.6, 13.4, 3, P.kirmiziBez),
      kutu(14.5, 1.5, 0, 0.8, 7.5, 2, P.tas),
      mazgal(14.5, 1.5, 2, 7.5, 0.8, 'y', P.tas),
      kutu(1.5, 14.5, 0, 9.5, 0.8, 2, P.tas),
      mazgal(1.5, 14.5, 2, 9.5, 0.8, 'x', P.tas),
      sancak('y', 10, 4, 9, P.kirmiziBez),
    );
  },

  kisla_1: (r) =>
    birlestir(
      plaka(r),
      cadir(2.5, 3, 6, 5, 4.2, P.cadir, 'x'),
      cadir(9.5, 2.5, 5, 4.5, 3.8, isikla(P.cadir, 0.9), 'x'),
      ates(7.5, 11),
      mizrakSehpasi(12.5, 9),
      kukla(4, 12),
      sandik(10, 13),
      // Ateşin çevresinde kütük oturaklar, kalkan rafı, flama direği, tabela.
      kutu(5.6, 9.6, 0, 2.2, 0.7, 0.55, P.tahta),
      kutu(8.9, 12.2, 0, 0.7, 2.0, 0.55, P.tahta),
      kalkanRafi(14.2, 2.6),
      kutu(1.6, 8.4, 0, 0.18, 0.18, 4.6, P.koyuTahta),
      levha(
        [
          [1.7, 8.5, 4.5],
          [1.7, 10.4, 4.1],
          [1.7, 8.5, 3.6],
        ],
        P.kirmiziBez,
      ),
      cuval(11.6, 13.4, '#bfa878'),
      tabelaDiregi(14.4, 11.6, 'kilic'),
    ),

  kisla_3: (r) => {
    const ev = yapi(r, 2.5, 3.5, 11, 5.5, [{ h: 4.4, duvar: 'tahta' }], {
      tip: 'besik',
      renk: P.koyuTahta,
      h: 3.4,
    });
    return birlestir(
      plaka(r),
      ev.m,
      // Sundurma: +y yüzünde direkli saçak
      kutu(3, 9.5, 3.2, 10, 2.4, 0.25, P.tahta),
      silindir(3.4, 11.6, 0, 0.15, 3.2, P.koyuTahta, 5),
      silindir(12.6, 11.6, 0, 0.15, 3.2, P.koyuTahta, 5),
      kukla(5, 13.5),
      kukla(8, 13.5),
      mizrakSehpasi(14, 5),
      bayrak(14.5, 13, 0, 7, P.kirmiziBez),
    );
  },

  kisla_5: (r) => {
    const ev = yapi(
      r,
      2.5,
      2.5,
      11,
      9,
      [
        { h: 5.5, duvar: 'tas' },
        { h: 4.5, duvar: 'tas' },
      ],
      { tip: 'duz', renk: P.tas, h: 0 },
      { isikli: true },
    );
    return birlestir(
      plaka(r),
      doseme(6, 11.5, 3, 4),
      ev.m,
      sancak('y', 11.5, 4, 9, P.kirmiziBez, 4),
      sancak('y', 11.5, 10, 9, P.kirmiziBez, 4),
      sancak('x', 13.5, 5, 9, P.kirmiziBez, 4),
      bayrak(8, 7, 10, 4.5, P.kirmiziBez),
      kukla(14.5, 13.5),
      mizrakSehpasi(1, 12),
    );
  },

  demirhane_1: (r) =>
    birlestir(
      plaka(r, P.toprak, isikla(P.toprak, 0.8)),
      // Açık sundurma: dört direk + çatı
      silindir(3.5, 3.5, 0, 0.2, 4, P.koyuTahta, 5),
      silindir(11.5, 3.5, 0, 0.2, 4, P.koyuTahta, 5),
      silindir(3.5, 9.5, 0, 0.2, 4, P.koyuTahta, 5),
      silindir(11.5, 9.5, 0, 0.2, 4, P.koyuTahta, 5),
      besikCati(3.2, 3.2, 4, 8.6, 6.6, 2.8, 'x', P.koyuTahta, P.tahta),
      ocak(4.2, 4.2),
      baca(4.7, 4.7, 4, 5.5, P.koyuTas),
      duman(5.3, 5.3, 11, r),
      ors(8, 7),
      fici(12.5, 12),
      sandik(9.5, 12),
      // Su teknesi (kızgın demiri söndürmek), alet rafı, demir çubuk istifi,
      // odun ve kömür, tabela.
      kutu(7.2, 10.2, 0, 2.4, 1.1, 0.8, P.koyuTahta),
      katmanla(kutu(7.4, 10.4, 0.62, 2.0, 0.7, 0.12, P.su), 0),
      aletRafi(3.2, 10.4),
      ince([
        ...kutu(12.2, 3.6, 0, 2.2, 0.2, 0.18, P.demir),
        ...kutu(12.2, 3.9, 0, 2.2, 0.2, 0.18, P.demir),
        ...kutu(12.3, 3.75, 0.18, 2.0, 0.2, 0.18, P.demir),
      ]),
      kutu(12.4, 5.6, 0, 2.2, 1.6, 0.9, P.tahta),
      kure(13.3, 8.6, 0.1, 0.8, '#2a2622', 6, 3),
      tabelaDiregi(14.4, 11, 'ors'),
    ),

  demirhane_3: (r) => {
    const ev = yapi(
      r,
      2.5,
      3,
      8,
      6,
      [{ h: 4.6, duvar: 'tas' }],
      { tip: 'besik', renk: P.arduvaz, h: 3.4 },
      { isikli: true },
    );
    return birlestir(
      plaka(r, P.toprak, isikla(P.toprak, 0.8)),
      ev.m,
      baca(8.5, 4, ev.ust + 1, 4.2, P.koyuTas),
      duman(9.1, 4.6, ev.ust + 6, r),
      silindir(11, 4, 0, 0.18, 3.6, P.koyuTahta, 5),
      silindir(11, 8.8, 0, 0.18, 3.6, P.koyuTahta, 5),
      kutu(10.5, 3.2, 3.6, 3.2, 6.4, 0.25, P.koyuTahta),
      ocak(11.3, 5),
      ors(7, 11.5),
      kutu(13.8, 2, 0, 0.6, 12, 1.2, P.tas),
      kutu(2, 13.8, 0, 12.4, 0.6, 1.2, P.tas),
      fici(4, 12),
    );
  },

  demirhane_5: (r) => {
    const ev = yapi(
      r,
      2.5,
      2.5,
      9.5,
      7,
      [
        { h: 5, duvar: 'tas' },
        { h: 3.8, duvar: 'tas' },
      ],
      { tip: 'besik', renk: P.arduvaz, h: 3.8 },
      { isikli: true },
    );
    // Su çarkı: +y yüzünün yanında dikey disk.
    const cark = dondur(
      silindir(0, 0, -0.4, 2.4, 0.8, { ust: P.tahta, yan: P.koyuTahta }, 10),
      'x',
      Math.PI / 2,
    );
    return birlestir(
      plaka(r, P.toprak, isikla(P.toprak, 0.8)),
      su(12.5, 1, 3, 14.5),
      ev.m,
      baca(4, 3.5, ev.ust + 1.5, 4.5, P.koyuTas),
      baca(9.5, 3.5, ev.ust + 1.5, 4.5, P.koyuTas),
      duman(4.6, 4.1, ev.ust + 6.3, r, 2),
      duman(10.1, 4.1, ev.ust + 6.3, r, 2),
      tasi(cark, [13.3, 6, 2.2]),
      ors(6, 11.5),
      ocak(9, 11),
      fici(3.5, 12.5),
    );
  },

  hastane_1: (r) => {
    const ev = yapi(r, 3, 3, 7.5, 6, [{ h: 4.2, duvar: 'tahta' }], {
      tip: 'besik',
      renk: P.saman,
      h: 3.3,
    });
    return birlestir(
      plaka(r),
      ev.m,
      tente(3.5, 9.2, 3.4, 6.5, 2.4, isikla(P.cadir, 1.05), P.bez, 4),
      kutu(4, 10.5, 0.6, 2.4, 1.1, 0.4, P.bez),
      kutu(7, 10.5, 0.6, 2.4, 1.1, 0.4, P.bez),
      bostan(12, 3.5, 2.4, 5, r, '#5f8f4a'),
      fici(12.8, 11.8),
    );
  },

  hastane_3: (r) => {
    const ev = yapi(
      r,
      3,
      3,
      8,
      6,
      [
        { h: 4.2, duvar: 'tas' },
        { h: 3.8, duvar: 'kiris', tasma: 0.4 },
      ],
      { tip: 'besik', renk: P.kiremit, h: 3.6 },
      { isikli: true },
    );
    return birlestir(
      plaka(r),
      ev.m,
      bostan(3, 11.5, 3.5, 2.8, r, '#5f8f4a'),
      bostan(7.5, 11.5, 3.5, 2.8, r, '#7aa85a'),
      kuyu(13, 6),
      sancak('y', 9.4, 9, 7.5, '#3f7a4a'),
    );
  },

  hastane_5: (r) => {
    const kanat = (x: number, y: number, sx: number, sy: number, yon: Yon) =>
      yapi(
        r,
        x,
        y,
        sx,
        sy,
        [
          { h: 5, duvar: 'acikTas' },
          { h: 3.6, duvar: 'acikTas' },
        ],
        { tip: 'besik', renk: P.kiremit, h: 3, yon },
        { isikli: true },
      ).m;
    return birlestir(
      plaka(r),
      kanat(2, 2, 12, 4, 'x'),
      kanat(2, 6, 4, 8.5, 'y'),
      doseme(6.5, 6.5, 7.5, 7.5, P.acikTas),
      kuyu(10, 10),
      agac(13.5, 13.5, 0, r, 0.8),
      bostan(7, 12.5, 2.4, 1.6, r, '#5f8f4a'),
      bayrak(13.5, 7, 0, 7.5, '#3f7a4a'),
    );
  },

  pazar_1: (r) =>
    birlestir(
      plaka(r),
      kutu(3.5, 5, 0, 7, 2, 1.8, P.tahta),
      silindir(3.7, 5.2, 0, 0.15, 4.4, P.koyuTahta, 5),
      silindir(10.3, 5.2, 0, 0.15, 4.4, P.koyuTahta, 5),
      tente(3.4, 4.6, 4.4, 7.2, 3.2, P.kirmiziBez, P.bez, 6),
      sandik(4, 5.3, 1.8, 1),
      kure(6.5, 6, 2.2, 0.5, '#c0392b', 5, 2),
      kure(7.3, 5.7, 2.2, 0.45, P.altin, 5, 2),
      kure(8.4, 6, 2.2, 0.5, '#6f8f3c', 5, 2),
      fici(12, 5.5),
      fici(12.5, 7.5),
      sandik(11.2, 10),
      sandik(12.6, 10.2, 0, 1.1),
      silindir(5, 11, 0, 0.9, 1, P.bez, 7),
      silindir(6.8, 11.4, 0, 0.8, 0.9, P.bez, 7),
      // İkinci tezgâh (mavi-beyaz tente), dolu kasalar, çuvallar, tabela.
      kutu(9.6, 9.4, 0, 3.2, 1.6, 1.6, P.tahta),
      silindir(9.8, 9.6, 0, 0.12, 3.8, P.koyuTahta, 5),
      silindir(12.6, 9.6, 0, 0.12, 3.8, P.koyuTahta, 5),
      tente(9.5, 9.0, 3.8, 3.4, 2.6, '#3a5a8a', P.bez, 4),
      doluKasa(2.6, 9.0, '#c0392b', r),
      doluKasa(3.0, 10.4, '#6f9a3a', r),
      doluKasa(9.8, 7.2, '#e08a2a', r),
      cuval(1.8, 12.4),
      cuval(2.9, 12.8, '#bfa878'),
      tabelaDiregi(14.2, 13.6, 'kese'),
    ),

  pazar_3: (r) => {
    const ev = yapi(r, 2.5, 2.5, 7, 5, [{ h: 4.3, duvar: 'kiris' }], {
      tip: 'besik',
      renk: P.kiremit,
      h: 3,
    });
    return birlestir(
      plaka(r),
      ev.m,
      tente(2.8, 7.5, 3.4, 6.4, 2.6, P.maviBez, P.bez, 5),
      kutu(3, 8, 0, 6, 1.5, 1.4, P.tahta),
      kutu(11, 4, 0, 1.6, 6.5, 1.5, P.tahta),
      tente(10.8, 3.8, 4, 2.2, 0.01, P.kirmiziBez),
      silindir(12.8, 4.2, 0, 0.14, 4, P.koyuTahta, 5),
      silindir(12.8, 10.2, 0, 0.14, 4, P.koyuTahta, 5),
      kutu(11, 3.8, 3.9, 2.4, 6.8, 0.2, P.kirmiziBez),
      sandik(11.2, 11.5),
      fici(4, 13),
      fici(5.7, 13.3),
      silindir(8.5, 12.5, 0, 0.9, 1, P.bez, 7),
    );
  },

  pazar_5: (r) => {
    const ev = yapi(
      r,
      2.5,
      2.5,
      10,
      7,
      [
        { h: 5.5, duvar: 'acikTas' },
        { h: 3.8, duvar: 'acikTas' },
      ],
      { tip: 'besik', renk: P.kiremit, h: 3.8 },
      { pencereYok: true },
    );
    const kemerler: Model = [];
    for (let i = 0; i < 4; i++) kemerler.push(...kemer('y', 9.5, 3.1 + i * 2.35, 0, 1.6, 4.2));
    for (let i = 0; i < 3; i++) kemerler.push(...kemer('x', 12.5, 3.1 + i * 2.2, 0, 1.6, 4.2));
    for (let i = 0; i < 4; i++)
      kemerler.push(...pencere('y', 9.5, 3.2 + i * 2.35, 6.8, 1.2, 1.6, true));
    return birlestir(
      plaka(r),
      doseme(1.5, 10, 13, 4.5),
      ev.m,
      kemerler,
      tente(2.8, 11, 3, 4.5, 2.2, P.kirmiziBez),
      tente(8.3, 11, 3, 4.5, 2.2, P.maviBez),
      sandik(3.2, 13.8, 0, 1),
      fici(9.2, 14),
      bayrak(14, 13.5, 0, 8, P.maviBez),
    );
  },

  surlar_1: (r) =>
    birlestir(
      plaka(r),
      palisat(2, 2, 12.5, 'x', 5.5),
      palisat(2, 2.9, 4.5, 'y', 5.5),
      palisat(2, 10.2, 4.3, 'y', 5.5),
      // Kapı: iki kalın direk + lento
      silindir(2, 7.9, 0, 0.45, 6.6, P.koyuTahta, 6),
      silindir(2, 9.8, 0, 0.45, 6.6, P.koyuTahta, 6),
      kutu(1.6, 7.5, 5.6, 0.8, 2.7, 0.7, P.koyuTahta),
      // Gözetleme iskelesi
      silindir(11, 4, 0, 0.18, 4, P.koyuTahta, 5),
      silindir(13.5, 4, 0, 0.18, 4, P.koyuTahta, 5),
      kutu(10.7, 2.7, 4, 3.1, 1.6, 0.3, P.tahta),
      mesale(13, 12),
      bayrak(12.5, 6.5, 0, 6.5, P.kirmiziBez),
    ),

  surlar_3: (r) =>
    birlestir(
      plaka(r),
      kutu(2, 2, 0, 12.5, 1.4, 3.2, P.tas),
      tasDokusu(2, 2, 0, 12.5, 1.4, 3.2, P.tas, r),
      tasi(palisat(0, 0, 12.5, 'x', 3), [2, 2.7, 3.2]),
      palisat(2, 3.4, 11, 'y', 5.8),
      // Ahşap kapı kulesi (köşede)
      kutu(1, 1, 0, 4, 4, 7.5, P.tahta),
      kutu(0.8, 0.8, 7.5, 4.4, 4.4, 2.4, P.acikTahta),
      pencere('x', 5.2, 2.3, 8.2, 1.4, 1),
      pencere('y', 5.2, 2.3, 8.2, 1.4, 1),
      kirmaCati(0.8, 0.8, 9.9, 4.4, 4.4, 2.6, P.koyuTahta),
      kapi('y', 5, 2, 0, 2, 3.8),
      bayrak(3, 3, 12.5, 3.5, P.kirmiziBez),
      mesale(6, 6),
    ),

  surlar_5: (r) =>
    birlestir(
      plaka(r),
      kutu(2, 1.5, 0, 13, 2, 6, P.tas),
      tasDokusu(2, 1.5, 0, 13, 2, 6, P.tas, r),
      mazgal(2, 2.7, 6, 13, 0.8, 'x', P.tas),
      kutu(1.5, 2, 0, 2, 13, 6, P.tas),
      tasDokusu(1.5, 2, 0, 2, 13, 6, P.tas, r),
      mazgal(2.7, 2, 6, 13, 0.8, 'y', P.tas),
      yuvarlakKule(3, 3, 0, 2.6, 9.5),
      yuvarlakKule(14.5, 2.5, 0, 1.8, 8),
      yuvarlakKule(2.5, 14.5, 0, 1.8, 8),
      kemer('x', 3.5, 7.5, 0, 2.6, 4),
      pencere('x', 5.55, 2.4, 6, 0.7, 1.4),
      bayrak(3, 3, 10.9, 4, P.kirmiziBez),
      sancak('y', 3.5, 9, 5.8, P.kirmiziBez, 3),
    ),

  karargah_1: (r) => {
    const ev = yapi(r, 3, 3.5, 9, 6, [{ h: 4.5, duvar: 'tahta' }], {
      tip: 'besik',
      renk: P.koyuTahta,
      h: 3.4,
    });
    return birlestir(
      plaka(r),
      ev.m,
      bayrak(13, 5, 0, 7, P.kirmiziBez),
      bayrak(13, 9, 0, 7, P.maviBez),
      kutu(5, 11.5, 0.9, 3.5, 2, 0.2, P.acikTahta),
      kutu(5.2, 11.7, 0, 0.3, 0.3, 0.9, P.koyuTahta),
      kutu(8.2, 13.2, 0, 0.3, 0.3, 0.9, P.koyuTahta),
      levha(
        [
          [5.6, 12, 1.12],
          [8, 12, 1.12],
          [8, 13.2, 1.12],
          [5.6, 13.2, 1.12],
        ],
        P.bez,
      ),
      mesale(11, 13),
    );
  },

  karargah_3: (r) => {
    const ev = yapi(
      r,
      3,
      3,
      9,
      6.5,
      [
        { h: 4.5, duvar: 'tas' },
        { h: 4, duvar: 'kiris', tasma: 0.35 },
      ],
      { tip: 'besik', renk: P.kiremit, h: 3.8 },
      { isikli: true },
    );
    return birlestir(
      plaka(r),
      ev.m,
      bayrak(7.5, 6.2, ev.ust + 3.4, 4, P.kirmiziBez),
      sancak('y', 9.85, 4.2, 8.2, P.kirmiziBez),
      sancak('y', 9.85, 9.8, 8.2, P.kirmiziBez),
      mesale(4, 12),
      mesale(11.5, 12),
    );
  },

  karargah_5: (r) => {
    const ev = yapi(
      r,
      2.5,
      3.5,
      9,
      7,
      [
        { h: 5.2, duvar: 'tas' },
        { h: 4.6, duvar: 'tas' },
      ],
      { tip: 'kirma', renk: P.arduvaz, h: 4 },
      { isikli: true },
    );
    const kule = yapi(
      r,
      11.5,
      2.5,
      4,
      4,
      [
        { h: 6, duvar: 'tas' },
        { h: 5.5, duvar: 'tas' },
      ],
      { tip: 'duz', renk: P.tas, h: 0 },
      { isikli: true },
    );
    return birlestir(
      plaka(r),
      doseme(5, 10.5, 4, 5),
      ev.m,
      kule.m,
      bayrak(13.5, 4.5, 11.5, 5, P.kirmiziBez),
      sancak('y', 10.5, 4, 9, P.kirmiziBez, 4),
      sancak('y', 10.5, 9.6, 9, P.kirmiziBez, 4),
      mesale(4.5, 13.5),
      mesale(9.5, 13.5),
    );
  },

  kutuphane_1: (r) => {
    const ev = yapi(
      r,
      3.5,
      3.5,
      7,
      6,
      [{ h: 4.2, duvar: 'tahta' }],
      { tip: 'besik', renk: P.saman, h: 3.4 },
      { isikli: true },
    );
    return birlestir(
      plaka(r),
      ev.m,
      sandik(11.5, 5),
      sandik(12, 6.6, 0, 1),
      kutu(11.7, 6.7, 1, 0.8, 0.6, 0.3, P.kirmiziBez),
      mesale(11, 11.5),
      agac(4, 13, 0, r, 0.8),
    );
  },

  kutuphane_3: (r) => {
    const ev = yapi(
      r,
      4,
      4,
      6.5,
      6,
      [
        { h: 4.2, duvar: 'tas' },
        { h: 3.8, duvar: 'kiris', tasma: 0.35 },
        { h: 3.4, duvar: 'kiris', tasma: 0.25 },
      ],
      { tip: 'besik', renk: P.arduvaz, h: 3.6, yon: 'y' },
      { isikli: true },
    );
    return birlestir(
      plaka(r),
      ev.m,
      baca(5, 5, ev.ust + 1, 3.2, P.tas),
      agac(13, 4, 0, r),
      mesale(12, 12),
      sandik(11.5, 9.5),
    );
  },

  kutuphane_5: (r) => {
    const ev = yapi(
      r,
      2.5,
      2.5,
      10,
      10,
      [
        { h: 5.5, duvar: 'acikTas' },
        { h: 3.5, duvar: 'acikTas' },
      ],
      { tip: 'duz', renk: P.acikTas, h: 0 },
      { isikli: true },
    );
    const kubbe = kure(7.5, 7.5, 11.2, 3.6, P.bakir, 10, 6).filter((f) =>
      f.p.every((q) => q[2] >= 11.19),
    );
    return birlestir(
      plaka(r),
      ev.m,
      silindir(7.5, 7.5, 9, 3.6, 2.2, P.acikTas, 10),
      kubbe,
      koni(7.5, 7.5, 14.7, 0.5, 1.5, P.altin, 6),
      // Gözlem dürbünü
      tasi(dondur(silindir(0, 0, 0, 0.35, 3.4, P.bronz, 6), 'y', 0.9), [11.5, 11.5, 9]),
      kutu(11, 11, 9, 1, 1, 0.6, P.koyuTahta),
      mesale(14, 5),
      mesale(5, 14),
    );
  },

  liman_1: (r) =>
    birlestir(
      zeminPlakasi(0, 0, 16, 7, r),
      su(0, 7, 16, 9),
      // İskele
      kutu(6, 6, 0.2, 3, 8.5, 0.35, P.acikTahta),
      silindir(6.2, 9, -0.6, 0.2, 1.1, P.koyuTahta, 5),
      silindir(8.8, 9, -0.6, 0.2, 1.1, P.koyuTahta, 5),
      silindir(6.2, 13.8, -0.6, 0.2, 1.1, P.koyuTahta, 5),
      silindir(8.8, 13.8, -0.6, 0.2, 1.1, P.koyuTahta, 5),
      tekne(10.5, 10.5, 4.6, 'y'),
      fici(3, 3),
      sandik(4, 4.5),
      cit(1, 1.5, 13, 'x'),
      // Kurumaya serilmiş ağ, halat kangalı, fıçılar, tabela.
      balikAgi(12.8, 2.4),
      silindir(5.4, 2.6, 0, 0.55, 0.35, '#c9b48a', 8),
      fici(10.6, 3.2),
      fici(11.4, 4.4),
      tabelaDiregi(14.6, 6.2, 'capa'),
    ),

  liman_3: (r) => {
    const ev = yapi(r, 1.5, 1, 6, 4.5, [{ h: 4, duvar: 'kiris' }], {
      tip: 'besik',
      renk: P.kiremit,
      h: 2.8,
    });
    return birlestir(
      zeminPlakasi(0, 0, 16, 7, r),
      su(0, 7, 16, 9),
      ev.m,
      kutu(1, 6, -0.4, 14, 1.4, 0.8, P.tas),
      kutu(8, 6.5, 0.2, 3, 8, 0.35, P.acikTahta),
      // Vinç
      silindir(10, 7.5, 0, 0.3, 6, P.koyuTahta, 6),
      tasi(dondur(kutu(0, -0.15, 0, 5, 0.3, 0.3, P.tahta), 'y', -0.5), [10, 7.5, 5]),
      kutu(13.8, 7.35, 1.5, 0.08, 0.08, 4.8, '#3a2a1c'),
      sandik(13.3, 7, 0.5, 1),
      tekne(11.5, 11, 5, 'y'),
      fici(12, 3),
      sandik(13.5, 4),
    );
  },

  liman_5: (r) => {
    const ev = yapi(
      r,
      1,
      0.8,
      8,
      5,
      [
        { h: 4.6, duvar: 'tas' },
        { h: 3.6, duvar: 'tas' },
      ],
      { tip: 'besik', renk: P.kiremit, h: 3.4 },
      { isikli: true },
    );
    return birlestir(
      zeminPlakasi(0, 0, 16, 7.5, r, P.acikTas, P.tas),
      su(0, 7.5, 16, 8.5),
      ev.m,
      kutu(0.5, 6, -0.6, 15, 1.8, 1.2, P.tas),
      tasDokusu(0.5, 6, -0.6, 15, 1.8, 1.2, P.tas, r),
      silindir(11.5, 6.8, 0.6, 0.35, 7, P.koyuTahta, 6),
      tasi(dondur(kutu(0, -0.18, 0, 5.5, 0.36, 0.36, P.tahta), 'y', -0.45), [11.5, 6.8, 6.5]),
      kutu(15.1, 6.62, 2.5, 0.08, 0.08, 5.8, '#3a2a1c'),
      sandik(14.6, 6.3, 1.6, 1),
      tekne(3, 10.5, 9, 'x', true),
      fici(12.5, 2.5),
      fici(14, 3.5),
      bayrak(10, 3, 0, 8, P.maviBez),
    );
  },

  elcilik_1: (r) => {
    const ev = yapi(r, 3.5, 3.5, 7.5, 6, [{ h: 4.3, duvar: 'tahta' }], {
      tip: 'besik',
      renk: P.kiremit,
      h: 3.3,
    });
    return birlestir(
      plaka(r),
      ev.m,
      bayrak(12.5, 6, 0, 7.5, P.maviBez),
      bayrak(12.5, 10, 0, 7.5, P.altin),
      mesale(5, 12.5),
    );
  },

  elcilik_3: (r) => {
    const ev = yapi(
      r,
      3,
      3,
      8.5,
      6.5,
      [
        { h: 4.4, duvar: 'tas' },
        { h: 4, duvar: 'kiris', tasma: 0.35 },
      ],
      { tip: 'kirma', renk: P.arduvaz, h: 3.8 },
      { isikli: true },
    );
    return birlestir(
      plaka(r),
      doseme(5.5, 9.8, 3.5, 5),
      ev.m,
      bayrak(13, 4, 0, 8, P.maviBez),
      bayrak(13, 7.5, 0, 8, P.altin),
      bayrak(13, 11, 0, 8, P.kirmiziBez),
    );
  },

  elcilik_5: (r) => {
    const ev = yapi(
      r,
      2,
      2.5,
      11,
      7.5,
      [
        { h: 5.5, duvar: 'acikTas' },
        { h: 4.5, duvar: 'acikTas' },
      ],
      { tip: 'kirma', renk: P.bakir, h: 4 },
      { isikli: true },
    );
    const sutunlar: Model = [];
    for (let i = 0; i < 4; i++)
      sutunlar.push(...silindir(4 + i * 2.4, 11.5, 0, 0.45, 5, P.acikTas, 8));
    return birlestir(
      plaka(r),
      doseme(2.5, 10, 10, 5, P.acikTas),
      ev.m,
      sutunlar,
      kutu(3, 10.3, 5, 9.5, 2, 0.6, P.acikTas),
      bayrak(3.5, 4, ev.ust + 3.4, 3, P.maviBez),
      bayrak(7.5, 4, ev.ust + 3.4, 3, P.altin),
      bayrak(11.5, 4, ev.ust + 3.4, 3, P.kirmiziBez),
      agac(14.5, 5, 0, r, 0.8),
    );
  },

  gorev_panosu: (r) => {
    const kagitlar: Model = [];
    const renkler = ['#f3ead2', '#fff4da', '#eadbb8', '#f7ecd4'];
    for (let i = 0; i < 6; i++)
      kagitlar.push(
        ...yuzeyKutusu(
          'y',
          8.4,
          4.4 + (i % 3) * 2.4,
          2.1 + Math.floor(i / 3) * 2.1,
          1.6,
          1.7,
          0.08,
          renkler[i % 4]!,
        ),
      );
    return birlestir(
      plaka(r),
      doseme(2.5, 7, 11, 4.5, P.acikTas),
      kutu(3.6, 7.9, 0, 0.6, 0.6, 7, P.koyuTahta),
      kutu(11.8, 7.9, 0, 0.6, 0.6, 7, P.koyuTahta),
      kutu(3.9, 7.95, 1.5, 8.2, 0.45, 4.8, P.tahta),
      kagitlar,
      besikCati(3.2, 7.3, 7, 9.2, 1.7, 1.4, 'x', P.koyuTahta, P.tahta, 0.25),
      mesale(12.5, 9.5),
      fici(3, 12),
    );
  },

  haberci_kulesi: (r) => {
    const govde = yapi(
      r,
      5,
      5,
      5,
      5,
      [
        { h: 5, duvar: 'tas' },
        { h: 4, duvar: 'tas' },
      ],
      { tip: 'kirma', renk: P.arduvaz, h: 0.01 },
      { kapiYuz: 'x' },
    );
    const oda = yapi(
      r,
      4.6,
      4.6,
      5.8,
      5.8,
      [{ h: 3.2, duvar: 'kiris' }],
      { tip: 'kirma', renk: P.arduvaz, h: 3 },
      { isikli: true },
    );
    const kus = (x: number, y: number, z: number): Model =>
      levha(
        [
          [x - 0.6, y, z + 0.3],
          [x, y, z],
          [x + 0.6, y, z + 0.3],
          [x, y, z + 0.12],
        ],
        '#2a2522',
      );
    return birlestir(
      plaka(r),
      govde.m,
      tasi(oda.m, [0, 0, 9]),
      bayrak(7.5, 7.5, 15.2, 1.9, P.maviBez),
      kus(12, 4, 14.5),
      kus(13.5, 6, 15.8),
      kus(3, 12, 13.5),
      // Dış merdiven
      ...Array.from({ length: 6 }, (_, i) =>
        kutu(10.1, 10 - i * 0.8, i * 0.9, 1.4, 0.8, 0.9, P.tas),
      ),
    );
  },

  onur_meydani: (r) => {
    const sekiz = (rr: number): [number, number][] =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return [8 + Math.cos(a) * rr, 8 + Math.sin(a) * rr];
      });
    // Defne çelengi: altın küreler halkası
    const celenk: Model = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      celenk.push(...kure(8 + Math.cos(a) * 1, 8, 13.2 + Math.sin(a) * 1, 0.32, P.altin, 5, 2));
    }
    return birlestir(
      plaka(r),
      prizma(sekiz(7), 0, 0.4, P.acikTas),
      prizma(sekiz(5), 0.4, 0.4, P.tas),
      prizma(sekiz(3), 0.8, 0.5, P.acikTas),
      silindir(8, 8, 1.3, 0.9, 9, P.acikTas, 8),
      kutu(7, 7, 10.3, 2, 2, 0.8, P.acikTas),
      celenk,
      ...[
        [3, 3],
        [13, 3],
        [3, 13],
        [13, 13],
      ].map(([x, y]) =>
        birlestir(
          silindir(x!, y!, 0.4, 0.4, 1.4, P.koyuTas, 6),
          ates(x!, y!).map((f) => ({
            ...f,
            p: f.p.map((q) => [q[0], q[1], q[2] + 1.8] as typeof q),
          })),
        ),
      ),
    );
  },
};

export const BINA_ADLARI = Object.keys(T);

/** Bir binanın modeli; bilinmeyen ad için boş arsa. */
export function binaModeli(ad: string): Model {
  const tarif = T[ad] ?? T.arsa!;
  siradakiTabela = TABELA[ad.replace(/_\d$/, '')];
  try {
    return tarif(rastgele('bina:' + ad));
  } finally {
    siradakiTabela = undefined;
  }
}

/** Yapının tabelasındaki simge: türü bir bakışta söylesin. */
export const TABELA: Record<string, Ikon> = {
  malikane: 'kalkan',
  kisla: 'kilic',
  demirhane: 'ors',
  hastane: 'hac',
  pazar: 'kese',
  karargah: 'sancak',
  kutuphane: 'kitap',
  liman: 'capa',
  elcilik: 'mektup',
};
