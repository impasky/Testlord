/**
 * DÜNYA ZEMİNİ — haritanın altındaki arazi, kuşbakışı (docs/24).
 *
 * Bölge verisinden kuruluyor: her bölgenin arazisi (ova, orman, dağ)
 * çevresindeki toprağı biçimliyor, kara ile deniz `KARA_YOLU`ndan (bölge
 * hücrelerinin de kırpıldığı çizgi) ayrılıyor. Böylece zemin ve bölge
 * çokgenleri aynı kıyıyı paylaşıyor; eskiden resim ile çizgi ayrı ayrı
 * üretildiği için kıyıda bir iki piksel kayma vardı.
 *
 * Çizim izometrik değil, tepeden: harita koordinatı (0-100) doğrudan
 * ekran. Üçgenler yine tek renk ve eğimlerine göre gölgeli; ışık sol
 * üstten, bütün çizimlerle aynı yönden.
 *
 * Bu dosya saf: üçgen listesi üretiyor. Tuvale dökmek bileşenin işi
 * (20 bin üçgen SVG'de yakınlaştırmada her karede yeniden çiziliyordu).
 *
 * İki çıktı aynı ızgaradan: `dunyaUcgenleri` düz renkli üçgenler (2D tuval,
 * WebGL yoksa), `dunyaModeli` GPU için model — ışık ve renk köşede, kıyı
 * çizgisi kara yoluna işaretli uzaklıktan piksel piksel (docs/24).
 */
import { KARA_YOLU } from '../components/harita/kara';
import { WORLD_MAP } from '@lordlar/shared';
import { gurultu, tepe } from './arazi';
import { P, isikla, karistir } from './renk';
import { rastgele } from './rastgele';
import { normal, type Kamera, type Model, type V3 } from './uc';

export interface Ucgen {
  /** x0 y0 x1 y1 x2 y2 — harita koordinatı (0-100). */
  n: number[];
  renk: string;
}

type Nokta = [number, number];

/** `KARA_YOLU` (M … Z alt yolları) → çokgen listesi. */
function karaCokgenleri(): Nokta[][] {
  return KARA_YOLU.split('M')
    .map((p) => p.replace(/Z/g, '').trim())
    .filter(Boolean)
    .map((p) => {
      const s = p.split(/[\s,]+/).map(Number);
      const c: Nokta[] = [];
      for (let i = 0; i + 1 < s.length; i += 2) c.push([s[i]!, s[i + 1]!]);
      return c;
    });
}

/**
 * Kara yolu, hızlı sorgu için: kenarlar düz dizide (xi yi xj yj), yatay
 * şeritlere (içinde mi) ve kare hücrelere (kıyıya uzaklık) dağıtılmış.
 * Dünya ızgarası on binlerce köşe soruyor; her biri yüzlerce kenarı
 * taramasın, yalnız kendi şeridini/komşu hücrelerini.
 */
interface Kara {
  k: Float64Array;
  y0: number;
  seritBoyu: number;
  serit: number[][];
  hucre: Map<number, number[]>;
}

const SERIT = 128;
/** Uzaklık hücresi: `UZAK` kadar; 3×3 komşuluk o yarıçaptaki her kenarı kapsıyor. */
const HUCRE = 3;
const hucreAnahtari = (i: number, j: number) => (i + 64) * 4096 + (j + 64);

function karaKur(): Kara {
  const kenar: number[] = [];
  for (const c of karaCokgenleri())
    for (let i = 0, j = c.length - 1; i < c.length; j = i++)
      kenar.push(c[i]![0], c[i]![1], c[j]![0], c[j]![1]);
  const k = Float64Array.from(kenar);
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let o = 0; o < k.length; o += 4) {
    y0 = Math.min(y0, k[o + 1]!, k[o + 3]!);
    y1 = Math.max(y1, k[o + 1]!, k[o + 3]!);
  }
  const seritBoyu = (y1 - y0) / SERIT || 1;
  const serit: number[][] = Array.from({ length: SERIT + 1 }, () => []);
  const hucre = new Map<number, number[]>();
  for (let e = 0; e < k.length / 4; e++) {
    const [xi, yi, xj, yj] = [k[e * 4]!, k[e * 4 + 1]!, k[e * 4 + 2]!, k[e * 4 + 3]!];
    const a = Math.floor((Math.min(yi, yj) - y0) / seritBoyu);
    const b = Math.floor((Math.max(yi, yj) - y0) / seritBoyu);
    for (let s = a; s <= b; s++) serit[s]!.push(e);
    for (
      let i = Math.floor(Math.min(xi, xj) / HUCRE);
      i <= Math.floor(Math.max(xi, xj) / HUCRE);
      i++
    )
      for (
        let j = Math.floor(Math.min(yi, yj) / HUCRE);
        j <= Math.floor(Math.max(yi, yj) / HUCRE);
        j++
      ) {
        const h = hucreAnahtari(i, j);
        const l = hucre.get(h);
        if (l) l.push(e);
        else hucre.set(h, [e]);
      }
  }
  return { k, y0, seritBoyu, serit, hucre };
}

/**
 * Tek-çift kuralıyla nokta karada mı (SVG `evenodd` ile aynı). Sınamanın
 * kendisi her kenarda eskisiyle aynı; noktanın şeridinde olmayan kenar
 * zaten koşulu sağlayamıyor.
 */
function icinde(x: number, y: number, kara: Kara): boolean {
  const s = Math.floor((y - kara.y0) / kara.seritBoyu);
  if (s < 0 || s > SERIT) return false;
  const k = kara.k;
  let ic = false;
  for (const e of kara.serit[s]!) {
    const xi = k[e * 4]!;
    const yi = k[e * 4 + 1]!;
    const xj = k[e * 4 + 2]!;
    const yj = k[e * 4 + 3]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ic = !ic;
  }
  return ic;
}

/** Noktanın kara yoluna uzaklığı; `UZAK`tan ötesi `UZAK`. */
function kiyiyaUzaklik(x: number, y: number, kara: Kara): number {
  const k = kara.k;
  const hi = Math.floor(x / HUCRE);
  const hj = Math.floor(y / HUCRE);
  let d = UZAK;
  for (let i = hi - 1; i <= hi + 1; i++)
    for (let j = hj - 1; j <= hj + 1; j++)
      for (const e of kara.hucre.get(hucreAnahtari(i, j)) ?? []) {
        const ax = k[e * 4]!;
        const ay = k[e * 4 + 1]!;
        const bx = k[e * 4 + 2]! - ax;
        const by = k[e * 4 + 3]! - ay;
        const l2 = bx * bx + by * by || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / l2));
        d = Math.min(d, Math.hypot(x - ax - bx * t, y - ay - by * t));
      }
  return d;
}

/** Işık: sol üstten (harita y aşağı), bir tık yukarıdan. */
const L = (() => {
  const v = [-0.5, -0.6, 1];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((a) => a / l) as [number, number, number];
})();

interface Kose {
  x: number;
  y: number;
  z: number;
  kara: boolean;
}

/**
 * Ortak ızgara: köşeler (oynatılmış, yükseklikli, kara/deniz), köşe
 * normalleri ve üçgenler. Rastgele dizi (`r`) ızgaranın oynamasını
 * tüketmiş hâlde dönüyor; iki çıktı da üçgen başına bir `r()` çekip sonra
 * ağaçları diziyor — ağaçlar ikisinde de aynı yerde.
 */
function izgara(adim: number) {
  const g = gurultu('dunya');
  const r = rastgele('dunya');
  const kara = karaKur();
  const bolgeler = WORLD_MAP.regions as unknown as { x: number; y: number; arazi: string }[];
  const daglar = bolgeler.filter((b) => b.arazi === 'dag');
  const ormanlar = bolgeler.filter((b) => b.arazi === 'orman');

  // Köşe ızgarası: yükseklik ve kara/deniz
  const n = Math.ceil(100 / adim);
  const K: Kose[][] = [];
  for (let i = 0; i <= n; i++) {
    const sat: Kose[] = [];
    for (let j = 0; j <= n; j++) {
      const kenar = i === 0 || j === 0 || i === n || j === n;
      const x = i * adim + (kenar ? 0 : (r() - 0.5) * adim * 0.6);
      const y = j * adim + (kenar ? 0 : (r() - 0.5) * adim * 0.6);
      const k = icinde(x, y, kara);
      let z: number;
      if (k) {
        z = 0.6 + g(x, y, 9, 3) * 1.6;
        for (const d of daglar)
          z += tepe(x, y, d.x, d.y, 7.5, 4.5) * (0.6 + g(x * 2.2, y * 2.2, 3, 2) * 0.9);
      } else z = -0.6 - g(x + 50, y, 12, 2) * 1.2;
      sat.push({ x, y, z, kara: k });
    }
    K.push(sat);
  }

  /*
   * Köşe ışığı: komşu köşelerden normal (merkezî fark), deniz kıyıda
   * sıfıra basık. Üçgen ışığını köşelerinin ortalamasından alıyor; dağ
   * yamacı yüzden yüze sıçramadan aydınlanıyor, geometri yine üçgen.
   */
  const kose = (i: number, j: number) =>
    K[Math.max(0, Math.min(n, i))]![Math.max(0, Math.min(n, j))]!;
  const isikOf = new Map<Kose, number>();
  const normalOf = new Map<Kose, V3>();
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const a1 = kose(i + 1, j);
      const a0 = kose(i - 1, j);
      const b1 = kose(i, j + 1);
      const b0 = kose(i, j - 1);
      const dx = [a1.x - a0.x, a1.y - a0.y, Math.max(0, a1.z) - Math.max(0, a0.z)] as const;
      const dy = [b1.x - b0.x, b1.y - b0.y, Math.max(0, b1.z) - Math.max(0, b0.z)] as const;
      let nx = dx[1] * dy[2] - dx[2] * dy[1];
      let ny = dx[2] * dy[0] - dx[0] * dy[2];
      let nz = dx[0] * dy[1] - dx[1] * dy[0];
      if (nz < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const nl = Math.hypot(nx, ny, nz) || 1;
      isikOf.set(K[i]![j]!, 0.46 + 0.58 * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / nl));
      normalOf.set(K[i]![j]!, [nx / nl, ny / nl, nz / nl]);
    }

  const ucgenler: Kose[][] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const A = K[i]![j]!;
      const B = K[i + 1]![j]!;
      const C = K[i + 1]![j + 1]!;
      const D = K[i]![j + 1]!;
      if ((i + j) % 2) ucgenler.push([A, B, C], [A, C, D]);
      else ucgenler.push([A, B, D], [B, C, D]);
    }
  return { g, r, kara, ormanlar, K, n, isikOf, normalOf, ucgenler };
}

/** Kara rengi: alçakta çayır, yükseldikçe kaya, doruklarda kar. */
function karaRengi(g: ReturnType<typeof gurultu>, x: number, y: number, z: number): string {
  const t = g(x + 17, y - 9, 6, 2);
  let renk = karistir('#5f7f3a', '#8a9a4c', t);
  if (z > 2.6)
    renk = karistir(renk, karistir('#7a6a55', '#8e8578', t), Math.min(1, (z - 2.6) / 1.4));
  if (z > 5.2) renk = karistir(renk, P.kar, Math.min(0.9, (z - 5.2) / 1.2));
  return renk;
}

const suRengi = (z: number) => karistir(P.su, P.derinSu, Math.min(1, Math.max(0, -z) / 1.8));
const KIYI = '#9b9362';

/**
 * Ormanlar: bölgenin çevresine koyu yeşil ağaç tepeleri (üstten altıgen,
 * sol üstü açık — ışık oradan). `ust`: açık, küçük tepe (koyunun üstünde).
 */
function agaclar(
  r: () => number,
  kara: Kara,
  ormanlar: { x: number; y: number }[],
): (Ucgen & { ust: boolean })[] {
  const cikti: (Ucgen & { ust: boolean })[] = [];
  for (const o of ormanlar)
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 5.5;
      const x = o.x + Math.cos(a) * d;
      const y = o.y + Math.sin(a) * d;
      if (!icinde(x, y, kara)) continue;
      const s = 0.45 + r() * 0.35;
      const altigen = (cx: number, cy: number, rr: number) =>
        Array.from({ length: 6 }, (_, i) => {
          const t = (i / 6) * Math.PI * 2;
          return [cx + Math.cos(t) * rr, cy + Math.sin(t) * rr];
        }).flat();
      cikti.push({ n: altigen(x, y, s), renk: isikla(P.koyuYaprak, 0.8 + r() * 0.15), ust: false });
      cikti.push({
        n: altigen(x - s * 0.25, y - s * 0.25, s * 0.55),
        renk: isikla(P.yaprak, 0.95 + r() * 0.2),
        ust: true,
      });
    }
  return cikti;
}

/** `adim` ızgara aralığı; `agacli` false: küçük önizleme (uygulama kasası karosu). */
export function dunyaUcgenleri(adim = 1.25, agacli = true): Ucgen[] {
  const { g, r, kara, ormanlar, isikOf, ucgenler } = izgara(adim);
  const cikti: Ucgen[] = [];
  for (const u of ucgenler) {
    const karaSay = u.filter((q) => q.kara).length;
    const cx = (u[0]!.x + u[1]!.x + u[2]!.x) / 3;
    const cy = (u[0]!.y + u[1]!.y + u[2]!.y) / 3;
    const cz = (u[0]!.z + u[1]!.z + u[2]!.z) / 3;
    const isik = (isikOf.get(u[0]!)! + isikOf.get(u[1]!)! + isikOf.get(u[2]!)!) / 3;
    let renk: string;
    if (karaSay === 0) renk = karistir(P.su, P.derinSu, Math.min(1, -cz / 1.8));
    else if (karaSay < 3) renk = KIYI;
    else renk = karaRengi(g, cx, cy, cz);
    cikti.push({
      n: [u[0]!.x, u[0]!.y, u[1]!.x, u[1]!.y, u[2]!.x, u[2]!.y],
      // Tohumlu ton oynaması hafif; `r()` çağrısı yerinde kalıyor ki
      // ağaçların yeri kaymasın.
      renk: isikla(renk, (karaSay === 0 ? 1 : isik) * (0.985 + r() * 0.03)),
    });
  }
  if (agacli) for (const { n, renk } of agaclar(r, kara, ormanlar)) cikti.push({ n, renk });
  return cikti;
}

/* ── GPU modeli ────────────────────────────────────────────────────── */

/**
 * Tepeden bakan kamera. Harita y'si aşağı, dünyanın y'si yukarı: model
 * harita noktasını (x, -y) olarak koyuyor, ekranda yine (x, y) çıkıyor.
 */
export const DUNYA_KAMERASI: Kamera = { yon: -Math.PI / 2, egim: Math.PI / 2 };
/** Aynı ışık (sol üstten), dünya eksenlerinde. */
export const DUNYA_ISIGI: V3 = [L[0], -L[1], L[2]];
export const DUNYA_KUTUSU: [number, number, number, number] = [0, 0, 100, 100];

/** Kum şeridi: kıyıdan içeri (harita birimi). */
const KUM = 0.5;
/** Kıyıya bundan uzak köşelerin uzaklığı yalnız işaret için; tam değer gereksiz. */
const UZAK = 3;

/**
 * Köşenin kara yoluna işaretli uzaklığı: denizde artı, karada eksi. Üçgenin
 * içinde ara değerlenince sıfır eğrisi kıyının kendisi — toprak hücreleri
 * de aynı yolla kırpıldığı için zemin ve hücreler aynı kıyıyı paylaşıyor.
 * Yalnız kıyıya yakın köşeler (üç adım içinde kara/deniz değişiyor)
 * ölçülüyor; gerisi ±UZAK.
 */
function kiyiUzakligi(K: Kose[][], n: number, kara: Kara): Map<Kose, number> {
  const sonuc = new Map<Kose, number>();
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const q = K[i]![j]!;
      let yakin = false;
      for (let a = Math.max(0, i - 3); a <= Math.min(n, i + 3) && !yakin; a++)
        for (let b = Math.max(0, j - 3); b <= Math.min(n, j + 3); b++)
          if (K[a]![b]!.kara !== q.kara) {
            yakin = true;
            break;
          }
      const d = yakin ? kiyiyaUzaklik(q.x, q.y, kara) : UZAK;
      sonuc.set(q, q.kara ? -d : d);
    }
  return sonuc;
}

/**
 * 2D çizimin ağaç sırası: `adim` ızgarasının oynaması (kenar dışındaki her
 * köşe iki çekiş) ve üçgen başına bir çekiş atlanmış rastgele. GPU modeli
 * daha ince ızgara kurduğu hâlde ağaçlar aynı yere düşüyor.
 */
function agacRastgelesi(adim: number): () => number {
  const r = rastgele('dunya');
  const n = Math.ceil(100 / adim);
  const atla = 2 * (n - 1) * (n - 1) + 2 * n * n;
  for (let i = 0; i < atla; i++) r();
  return r;
}

/**
 * GPU için dünya zemini: aynı arazi, ama üçgen düz renk değil — ışık
 * (köşe normali) ve renk (yükseklik) köşede, GPU üçgenin içinde ara
 * değerliyor. Izgara `incelik` kat sık: köşe rengi doruklarda yıldız gibi
 * dilimlenmesin. Kıyı ve kum şeridi `Yuz.su` ile piksel başına. Ağaçlar
 * 2D çizimle aynı yerde, üstte.
 */
export function dunyaModeli(adim = 1.25, agacli = true, incelik = 2): Model {
  const { g, kara, ormanlar, K, n, normalOf, ucgenler } = izgara(adim / incelik);
  const uzaklik = kiyiUzakligi(K, n, kara);
  const dunyada = (x: number, y: number): V3 => [x, -y, 0];
  // Köşe renkleri bir kez (her köşe altı üçgende).
  const karaR = new Map<Kose, string>();
  const suR = new Map<Kose, string>();
  for (const sat of K)
    for (const q of sat) {
      karaR.set(q, karaRengi(g, q.x, q.y, Math.max(0, q.z)));
      suR.set(q, suRengi(q.z));
    }
  const m: Model = [];
  for (const u0 of ucgenler) {
    const u = [...u0];
    let p = u.map((q) => dunyada(q.x, q.y));
    // Y çevrilince köşe sırası da döndü: yüz kameraya baksın.
    if (normal(p)[2] < 0) {
      u.reverse();
      p = p.reverse();
    }
    const karaSay = u.filter((q) => q.kara).length;
    const cz = (u[0]!.z + u[1]!.z + u[2]!.z) / 3;
    m.push({
      p,
      // SVG'ye düşerse (kullanılmıyor) 2D çizimdeki taban renk.
      renk:
        karaSay === 0
          ? suRengi(cz)
          : karaSay < 3
            ? KIYI
            : karaRengi(
                g,
                (u[0]!.x + u[1]!.x + u[2]!.x) / 3,
                (u[0]!.y + u[1]!.y + u[2]!.y) / 3,
                cz,
              ),
      katman: -2,
      kenarsiz: true,
      vn: u.map((q): V3 => {
        const k = normalOf.get(q)!;
        return [k[0], -k[1], k[2]];
      }),
      vr: u.map((q) => karaR.get(q)!),
      su: { d: u.map((q) => uzaklik.get(q)! / KUM), renk: u.map((q) => suR.get(q)!), kum: KIYI },
    });
  }
  if (agacli)
    for (const a of agaclar(agacRastgelesi(adim), kara, ormanlar)) {
      let p: V3[] = [];
      for (let i = 0; i < a.n.length; i += 2) p.push(dunyada(a.n[i]!, a.n[i + 1]!));
      if (normal(p)[2] < 0) p = p.reverse();
      // Açık tepe koyunun üstünde: ayrı katman (ressam sırası tepeden
      // bakınca derinlikle ayırt edemiyor).
      m.push({ p, renk: a.renk, katman: a.ust ? -0.5 : -1, kenarsiz: true });
    }
  return m;
}
