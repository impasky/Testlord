/**
 * ARAZİ — düşük çokgenli yükseklik alanı (docs/24).
 *
 * Bölge sahneleri, akın diyarları ve dünya haritası aynı yöntemle
 * kuruluyor: yer bir ızgara, her kare iki üçgen, köşeler biraz
 * oynatılmış (düzenli ızgara "çizim programı" gibi duruyordu). Her üçgen
 * tek renk ve kendi eğimine göre gölgeli; tepeler ışığa dönük yüzünde
 * açık, arkasında koyu — "low-poly" görünümün kendisi bu.
 *
 * Su ayrı bir düzlem değil: yükseklik su seviyesinin altına inen köşeler
 * seviyeye çekiliyor, tamamen altta kalan üçgen su rengini alıyor, yarısı
 * altta kalan kıyı oluyor. Nehir de göl de bu kuraldan çıkıyor.
 *
 * Katmanlar: arazi -2, yere yatık tarla/yol -1.x, nesneler 0 — tarla her
 * zaman arazinin üstünde, ev her zaman tarlanın üstünde.
 */
import { P, isikla, karistir } from './renk';
import { tohum } from './rastgele';
import { cember, normal, yansitici, zemineGeri, type Model, type V3 } from './uc';

export type Yukseklik = (x: number, y: number) => number;
export type Nokta = [number, number];

/* ── Gürültü ───────────────────────────────────────────────────────── */

/**
 * Tohumlu değer gürültüsü (value noise), birkaç oktav üst üste. [0, 1).
 * `olcek`: bir tepenin kabaca genişliği (dünya birimi).
 */
export function gurultu(anahtar: string) {
  const t = tohum(anahtar);
  const kafes = (i: number, j: number) => {
    let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(t, 1442695041)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  };
  const yumusak = (a: number) => a * a * (3 - 2 * a);
  const tek = (x: number, y: number) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = yumusak(x - i);
    const fy = yumusak(y - j);
    const a = kafes(i, j);
    const b = kafes(i + 1, j);
    const c = kafes(i, j + 1);
    const d = kafes(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return (x: number, y: number, olcek = 20, oktav = 3) => {
    let s = 0;
    let g = 1;
    let top = 0;
    let f = 1 / olcek;
    for (let o = 0; o < oktav; o++) {
      s += tek(x * f + o * 17.3, y * f - o * 9.1) * g;
      top += g;
      g *= 0.5;
      f *= 2;
    }
    return s / top;
  };
}

/* ── Yükseklik biçimleyiciler ──────────────────────────────────────── */

export const yumusakAdim = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};

/**
 * Eşik yerine yumuşak geçiş: `x` `esik`in `genislik` kadar altında 0,
 * üstünde 1. Arazi rengi "dikse kaya" gibi sert bir koşula bağlıyken her
 * üçgen iki paletten birine düşüyor ve yamaç yama yama görünüyordu.
 */
export const gecis = (x: number, esik: number, genislik = 0.12) =>
  yumusakAdim((x - esik) / genislik + 0.5);

/** Yuvarlak tepe (ya da `h` < 0 ise çukur). */
export function tepe(x: number, y: number, cx: number, cy: number, r: number, h: number) {
  const d = Math.hypot(x - cx, y - cy) / r;
  return d >= 1 ? 0 : h * yumusakAdim(1 - d);
}

/** Bir noktanın kırık çizgiye uzaklığı. */
export function cizgiyeUzaklik(x: number, y: number, yol: Nokta[]): number {
  let en = Infinity;
  for (let i = 0; i < yol.length - 1; i++) {
    const [ax, ay] = yol[i]!;
    const [bx, by] = yol[i + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    en = Math.min(en, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return en;
}

/**
 * Nehir yatağı: kırık çizgi boyunca `gen` genişliğinde, `taban` yüksekliğine
 * oyar. Yatağın iç yarısı düz tabanlı: yalnız orta çizgi inseydi ızgaranın
 * köşeleri çoğu yerde suya değmez, nehir kesik kesik göletlere dönerdi.
 */
export function nehirOy(h: Yukseklik, yol: Nokta[], gen: number, taban: number): Yukseklik {
  return (x, y) => {
    const z = h(x, y);
    const d = cizgiyeUzaklik(x, y, yol);
    if (d >= gen) return z;
    const t = d <= gen * 0.5 ? 1 : yumusakAdim((gen - d) / (gen * 0.5));
    return Math.min(z, z + (taban - z) * t);
  };
}

export interface Duzluk {
  x: number;
  y: number;
  /** Tam düz yarıçap; kenarında `yumusak` kadar genişlikte eski yere karışıyor. */
  r: number;
  z: number;
  yumusak?: number;
  /** Kare düzlük (bina oturağı): uzaklık Chebyshev. */
  kare?: boolean;
}

/** Bina oturakları, meydanlar, kale düzlüğü: yeri bu noktalarda düzler. */
export function duzle(h: Yukseklik, alanlar: Duzluk[]): Yukseklik {
  return (x, y) => {
    let z = h(x, y);
    for (const a of alanlar) {
      const d = a.kare
        ? Math.max(Math.abs(x - a.x), Math.abs(y - a.y))
        : Math.hypot(x - a.x, y - a.y);
      const yum = a.yumusak ?? a.r * 0.6;
      const t = d <= a.r ? 1 : yumusakAdim(1 - (d - a.r) / yum);
      z += (a.z - z) * t;
    }
    return z;
  };
}

/** Catmull-Rom: kontrol noktalarından geçen yumuşak eğri. */
export function yumusat(kontrol: Nokta[], parca = 6): Nokta[] {
  if (kontrol.length < 3) return kontrol;
  const s: Nokta[] = [];
  for (let i = 0; i < kontrol.length - 1; i++) {
    const p0 = kontrol[Math.max(0, i - 1)]!;
    const p1 = kontrol[i]!;
    const p2 = kontrol[i + 1]!;
    const p3 = kontrol[Math.min(kontrol.length - 1, i + 2)]!;
    for (let k = 0; k < parca; k++) {
      const t = k / parca;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      s.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  s.push(kontrol[kontrol.length - 1]!);
  return s;
}

/* ── Arazinin kendisi ──────────────────────────────────────────────── */

export interface AraziAyari {
  /** Görüş kutusu (viewBox): arazi yalnız bunun içinde kalan üçgenleri üretiyor. */
  cerceve: [number, number, number, number];
  /** Izgara adımı (dünya birimi). Küçük = daha çok üçgen. */
  adim: number;
  h: Yukseklik;
  /** Kuru toprağın rengi; `dik` 0 düz, 1 dikey. */
  renk: (x: number, y: number, z: number, dik: number) => string;
  /** Su seviyesi; verilmezse su yok. */
  su?: number;
  suRengi?: string;
  derinSu?: string;
  kiyi?: string;
  r: () => number;
  /** Köşe oynaması, adımın oranı. */
  titrek?: number;
}

const fark3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const tek3 = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function arazi(a: AraziAyari): Model {
  const [vx, vy, ve, vb] = a.cerceve;
  const geri = zemineGeri();
  const ekran = yansitici();
  const koseler = [geri(vx, vy), geri(vx + ve, vy), geri(vx, vy + vb), geri(vx + ve, vy + vb)];
  // Pay: tepeler yukarı, çukurlar aşağı kayıyor — çerçevenin kenarı boş kalmasın.
  const pay = 16;
  const x0 = Math.min(...koseler.map((k) => k[0])) - pay;
  const x1 = Math.max(...koseler.map((k) => k[0])) + pay;
  const y0 = Math.min(...koseler.map((k) => k[1])) - pay;
  const y1 = Math.max(...koseler.map((k) => k[1])) + pay;
  const { adim, r } = a;
  const nx = Math.ceil((x1 - x0) / adim);
  const ny = Math.ceil((y1 - y0) / adim);
  const titrek = (a.titrek ?? 0.3) * adim;

  const K: V3[][] = [];
  for (let i = 0; i <= nx; i++) {
    const sat: V3[] = [];
    for (let j = 0; j <= ny; j++) {
      const x = x0 + i * adim + (r() - 0.5) * 2 * titrek;
      const y = y0 + j * adim + (r() - 0.5) * 2 * titrek;
      sat.push([x, y, a.h(x, y)]);
    }
    K.push(sat);
  }

  /*
   * Köşe normalleri: komşu köşelerden (merkezî fark). Her üçgen ışığı
   * kendi düz normaliyle değil köşelerinin ortalamasıyla alıyor; geometri
   * düşük çokgenli kalıyor ama yamaç yüzden yüze sıçramadan aydınlanıyor.
   */
  const kose = (i: number, j: number): V3 =>
    K[Math.max(0, Math.min(nx, i))]![Math.max(0, Math.min(ny, j))]!;
  const N: V3[][] = K.map((sat, i) =>
    sat.map((_, j) => {
      const dx = fark3(kose(i + 1, j), kose(i - 1, j));
      const dy = fark3(kose(i, j + 1), kose(i, j - 1));
      return tek3([
        dx[1] * dy[2] - dx[2] * dy[1],
        dx[2] * dy[0] - dx[0] * dy[2],
        dx[0] * dy[1] - dx[1] * dy[0],
      ]);
    }),
  );
  const normalOf = new Map<V3, V3>();
  K.forEach((sat, i) => sat.forEach((q, j) => normalOf.set(q, N[i]![j]!)));

  const su = a.su ?? -Infinity;
  const suRengi = a.suRengi ?? P.su;
  const derinSu = a.derinSu ?? P.derinSu;
  // Kıyı: kumla çimen arası — saf kum rengi geniş üçgenlerde leke gibi duruyordu.
  const kiyi = a.kiyi ?? '#9b9362';
  /*
   * Köşe rengi (GPU çizimi): renk köşede hesaplanıyor ve üçgenin içinde
   * ara değerleniyor. Su varsa her köşe su rengini (derinleştikçe koyu) ve
   * kum şeridine uzaklığını da taşıyor; kıyı çizgisini ve kumu GPU piksel
   * piksel buluyor. SVG yüz başına tek renk kullanmaya devam ediyor.
   */
  const KUM_SERIDI = 0.7;
  const karaRengi = new Map<V3, string>();
  const renkAl = (q: V3): string => {
    let c = karaRengi.get(q);
    if (!c) karaRengi.set(q, (c = a.renk(q[0], q[1], q[2], 1 - normalOf.get(q)![2])));
    return c;
  };
  const suAl = (q: V3): string =>
    karistir(suRengi, derinSu, Math.min(1, Math.max(0, su - q[2]) / 5));
  const kx0 = vx - 1;
  const kx1 = vx + ve + 1;
  const ky0 = vy - 1;
  const ky1 = vy + vb + 1;
  const m: Model = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const A = K[i]![j]!;
      const B = K[i + 1]![j]!;
      const C = K[i + 1]![j + 1]!;
      const D = K[i]![j + 1]!;
      const ucgenler =
        (i + j) % 2
          ? [
              [A, B, C],
              [A, C, D],
            ]
          : [
              [A, B, D],
              [B, C, D],
            ];
      for (const u of ucgenler) {
        const alti = u.filter((q) => q[2] < su).length;
        const p = u.map((q): V3 => [q[0], q[1], Math.max(q[2], su)]);
        const s = p.map(ekran);
        if (
          s.every(([sx]) => sx < kx0) ||
          s.every(([sx]) => sx > kx1) ||
          s.every(([, sy]) => sy < ky0) ||
          s.every(([, sy]) => sy > ky1)
        )
          continue;
        const cx = (p[0]![0] + p[1]![0] + p[2]![0]) / 3;
        const cy = (p[0]![1] + p[1]![1] + p[2]![1]) / 3;
        const cz = (u[0]![2] + u[1]![2] + u[2]![2]) / 3;
        // Su ve kıyı SVG'de düz (su yüzeyi zaten yatay); kara köşe
        // normalleriyle. Köşe normalleri (`vn`) kıyıda da var: GPU'da kara
        // tarafı komşu yamaçla aynı ışığı alıyor, su tarafını GPU düzlüyor.
        const gn =
          alti === 3
            ? undefined
            : alti > 0
              ? normal(p)
              : tek3(
                  u.reduce<V3>(
                    (t, q) => {
                      const k = normalOf.get(q)!;
                      return [t[0] + k[0], t[1] + k[1], t[2] + k[2]];
                    },
                    [0, 0, 0],
                  ),
                );
        let renk: string;
        if (alti === 3) renk = karistir(suRengi, derinSu, Math.min(1, (su - cz) / 5));
        else if (alti > 0) renk = kiyi;
        else renk = a.renk(cx, cy, cz, 1 - gn![2]);
        // Tohumlu ton oynaması hafif: sert olunca her üçgen ayrı bir yama
        // gibi okunuyordu. `r()` çağrısı yerinde, yoksa dizinin geri kalanı
        // (ağaçların yeri) kayardı.
        m.push({
          p,
          renk: isikla(renk, 0.985 + r() * 0.03),
          katman: -2,
          kenarsiz: true,
          gn,
          // GPU çizimi için köşe başına: ışık ve renk üçgenin içinde ara
          // değerleniyor.
          ...(gn ? { vn: u.map((q) => normalOf.get(q)!) } : {}),
          vr: u.map(renkAl),
          ...(isFinite(su)
            ? { su: { d: u.map((q) => (su - q[2]) / KUM_SERIDI), renk: u.map(suAl), kum: kiyi } }
            : {}),
        });
      }
    }
  }
  return m;
}

/* ── Yere yatık süsler ─────────────────────────────────────────────── */

/**
 * Arazinin üstünde yol: kırık çizgi, yüksekliği her parçada yeniden
 * okunuyor (tepeye tırmanan patika tepeyle birlikte kalkıyor).
 */
export function yerYolu(
  noktalar: Nokta[],
  gen: number,
  renk: string,
  h: Yukseklik,
  katman = -1,
): Model {
  const m: Model = [];
  const z = (x: number, y: number) => h(x, y) + 0.08;
  // Parçaları kısa tut: uzun parça tepede havada asılı kalır.
  const ince: Nokta[] = [];
  for (let i = 0; i < noktalar.length - 1; i++) {
    const [ax, ay] = noktalar[i]!;
    const [bx, by] = noktalar[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2.5));
    for (let k = 0; k < n; k++) ince.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  ince.push(noktalar[noktalar.length - 1]!);
  for (let i = 0; i < ince.length - 1; i++) {
    const [ax, ay] = ince[i]!;
    const [bx, by] = ince[i + 1]!;
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / l) * (gen / 2);
    const ny = ((bx - ax) / l) * (gen / 2);
    m.push({
      p: [
        [ax + nx, ay + ny, z(ax, ay)],
        [ax - nx, ay - ny, z(ax, ay)],
        [bx - nx, by - ny, z(bx, by)],
        [bx + nx, by + ny, z(bx, by)],
      ],
      renk,
      ciftYuz: true,
      katman,
      kenarsiz: true,
    });
  }
  for (const [x, y] of ince) {
    const zz = z(x, y);
    m.push({
      p: cember(x, y, gen / 2, 10).map(([px, py]): V3 => [px, py, zz]),
      renk,
      katman,
      kenarsiz: true,
    });
  }
  return m;
}

/**
 * Tarla parseli: araziye yatık dörtgen + sürülmüş sıralar. `yon` sıraların
 * uzandığı eksen. Buğday, sebze, nadas: hepsi aynı parça, rengi farklı.
 */
export function parsel(
  x: number,
  y: number,
  sx: number,
  sy: number,
  renk: string,
  h: Yukseklik,
  { yon = 'x' as 'x' | 'y', aralik = 1.4, sira = isikla(renk, 0.84) } = {},
): Model {
  const z = (px: number, py: number) => h(px, py) + 0.1;
  const m: Model = [
    {
      p: [
        [x, y, z(x, y)],
        [x + sx, y, z(x + sx, y)],
        [x + sx, y + sy, z(x + sx, y + sy)],
        [x, y + sy, z(x, y + sy)],
      ],
      renk,
      katman: -1.5,
      kenarsiz: true,
      ciftYuz: true,
    },
  ];
  const uzun = yon === 'x' ? sy : sx;
  const k = aralik * 0.32;
  for (let t = aralik * 0.6; t < uzun - aralik * 0.3; t += aralik) {
    const [ax, ay, bx, by] =
      yon === 'x' ? [x + 0.3, y + t, x + sx - 0.3, y + t] : [x + t, y + 0.3, x + t, y + sy - 0.3];
    const [nx, ny] = yon === 'x' ? [0, k] : [k, 0];
    m.push({
      p: [
        [ax, ay, z(ax, ay) + 0.02],
        [bx, by, z(bx, by) + 0.02],
        [bx + nx, by + ny, z(bx, by) + 0.02],
        [ax + nx, ay + ny, z(ax, ay) + 0.02],
      ],
      renk: sira,
      katman: -1.4,
      kenarsiz: true,
      ciftYuz: true,
    });
  }
  return m;
}

/** Çerçeve yüzdesini (0-100) yer düzlemindeki dünya noktasına çevirir. */
export function ekrandanYere(cerceve: [number, number, number, number]) {
  const geri = zemineGeri();
  const [vx, vy, ve, vb] = cerceve;
  return (px: number, py: number): Nokta => geri(vx + (ve * px) / 100, vy + (vb * py) / 100);
}
