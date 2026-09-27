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
 */
import { KARA_YOLU } from '../components/harita/kara';
import { WORLD_MAP } from '@lordlar/shared';
import { gurultu, tepe } from './arazi';
import { P, isikla, karistir } from './renk';
import { rastgele } from './rastgele';

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

/** Tek-çift kuralıyla nokta çokgen(ler)in içinde mi (SVG `evenodd` ile aynı). */
function icinde(x: number, y: number, cok: Nokta[][]): boolean {
  let ic = false;
  for (const c of cok)
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      const [xi, yi] = c[i]!;
      const [xj, yj] = c[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ic = !ic;
    }
  return ic;
}

/** Işık: sol üstten (harita y aşağı), bir tık yukarıdan. */
const L = (() => {
  const v = [-0.5, -0.6, 1];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((a) => a / l) as [number, number, number];
})();

/** `adim` ızgara aralığı; `agacli` false: küçük önizleme (uygulama kasası karosu). */
export function dunyaUcgenleri(adim = 1.25, agacli = true): Ucgen[] {
  const g = gurultu('dunya');
  const r = rastgele('dunya');
  const kara = karaCokgenleri();
  const bolgeler = WORLD_MAP.regions as unknown as { x: number; y: number; arazi: string }[];
  const daglar = bolgeler.filter((b) => b.arazi === 'dag');
  const ormanlar = bolgeler.filter((b) => b.arazi === 'orman');

  // Köşe ızgarası: yükseklik ve kara/deniz
  const n = Math.ceil(100 / adim);
  const K: { x: number; y: number; z: number; kara: boolean }[][] = [];
  for (let i = 0; i <= n; i++) {
    const sat: (typeof K)[number] = [];
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

  const cikti: Ucgen[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const A = K[i]![j]!;
      const B = K[i + 1]![j]!;
      const C = K[i + 1]![j + 1]!;
      const D = K[i]![j + 1]!;
      const ucler =
        (i + j) % 2
          ? [
              [A, B, C],
              [A, C, D],
            ]
          : [
              [A, B, D],
              [B, C, D],
            ];
      for (const u of ucler) {
        const karaSay = u.filter((q) => q.kara).length;
        const cx = (u[0]!.x + u[1]!.x + u[2]!.x) / 3;
        const cy = (u[0]!.y + u[1]!.y + u[2]!.y) / 3;
        const cz = (u[0]!.z + u[1]!.z + u[2]!.z) / 3;
        // Normal (y aşağı eksende sağ el kuralı: z yukarı için çapraz çarpım işareti)
        const ax = u[1]!.x - u[0]!.x;
        const ay = u[1]!.y - u[0]!.y;
        const az = (karaSay ? Math.max(0, u[1]!.z) : 0) - (karaSay ? Math.max(0, u[0]!.z) : 0);
        const bx = u[2]!.x - u[0]!.x;
        const by = u[2]!.y - u[0]!.y;
        const bz = (karaSay ? Math.max(0, u[2]!.z) : 0) - (karaSay ? Math.max(0, u[0]!.z) : 0);
        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;
        if (nz < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        const nl = Math.hypot(nx, ny, nz) || 1;
        const isik = 0.46 + 0.58 * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / nl);
        let renk: string;
        if (karaSay === 0) renk = karistir(P.su, P.derinSu, Math.min(1, -cz / 1.8));
        else if (karaSay < 3) renk = '#9b9362';
        else {
          const t = g(cx + 17, cy - 9, 6, 2);
          renk = karistir('#5f7f3a', '#8a9a4c', t);
          if (cz > 2.6)
            renk = karistir(renk, karistir('#7a6a55', '#8e8578', t), Math.min(1, (cz - 2.6) / 1.4));
          if (cz > 5.2) renk = karistir(renk, P.kar, Math.min(0.9, (cz - 5.2) / 1.2));
        }
        cikti.push({
          n: [u[0]!.x, u[0]!.y, u[1]!.x, u[1]!.y, u[2]!.x, u[2]!.y],
          renk: isikla(renk, (karaSay === 0 ? 1 : isik) * (0.97 + r() * 0.06)),
        });
      }
    }

  // Ormanlar: bölgenin çevresine koyu yeşil ağaç tepeleri (üstten altıgen,
  // sol üstü açık — ışık oradan)
  if (agacli)
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
        cikti.push({ n: altigen(x, y, s), renk: isikla(P.koyuYaprak, 0.8 + r() * 0.15) });
        cikti.push({
          n: altigen(x - s * 0.25, y - s * 0.25, s * 0.55),
          renk: isikla(P.yaprak, 0.95 + r() * 0.2),
        });
      }
  return cikti;
}
