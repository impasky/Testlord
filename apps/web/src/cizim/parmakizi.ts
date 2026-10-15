/**
 * ÇİZİMİN PARMAK İZİ — görsel bozulma testi (docs/24 "Görsel bozulma testi").
 *
 * Çizimler koddan çıkıyor ve bir parçayı (`kule`, `insan`, renk paleti)
 * değiştirmek onu kullanan yüz çizimi birden değiştiriyor. Testler "NaN
 * yok, çokgen var" diyordu; kışlanın çatısı kaybolsa da geçiyorlardı.
 *
 * Parmak izi çizimin ekrandaki hâlinden (`ciz`) birkaç sayı: çokgen sayısı,
 * toplam alan, alanın ağırlık merkezi, çerçeve ve rengin alana göre dağılımı.
 * Bir parça kaybolursa alan ve renk payı, kayarsa merkez, büyürse çerçeve
 * değişiyor. Sayılar toplam olduğu için kayan noktanın son hanesi (başka
 * işlemci, başka V8) onları kıpırdatmıyor; karşılaştırma da paylı.
 *
 * Bilerek değişen çizimin izi `PARMAKIZI_YAZ=1 pnpm test` ile yeniden
 * yazılıyor (`parmakizi.json`); değişiklik incelemede görünüyor.
 */
import { ciz, type Model } from './uc';

export interface ParmakIzi {
  /** Çokgen sayısı. */
  n: number;
  /** Toplam alan (ekran birimi²). */
  alan: number;
  /** Alanın ağırlık merkezi. */
  merkez: [number, number];
  /** Çerçeve: x, y, en, boy. */
  kutu: [number, number, number, number];
  /** Rengin alandaki payı (yüzde, ≥ %1 olanlar). */
  renk: Record<string, number>;
}

const yuvarla = (x: number, k = 10) => Math.round(x * k) / k;

/** Çokgenin noktaları (`ciz` çıktısı "x,y x,y …"). */
function noktalar(n: string): [number, number][] {
  return n.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
}

export function parmakIzi(model: Model): ParmakIzi {
  const c = ciz(model);
  let alan = 0;
  let mx = 0;
  let my = 0;
  const renk = new Map<string, number>();
  for (const p of c.cokgenler) {
    const q = noktalar(p.n);
    // Ayakkabı bağı formülü; merkez alanla ağırlıklı.
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < q.length; i++) {
      const [x0, y0] = q[i]!;
      const [x1, y1] = q[(i + 1) % q.length]!;
      const k = x0 * y1 - x1 * y0;
      a += k;
      cx += (x0 + x1) * k;
      cy += (y0 + y1) * k;
    }
    a /= 2;
    if (Math.abs(a) < 1e-9) continue;
    const aa = Math.abs(a);
    alan += aa;
    mx += (cx / (6 * a)) * aa;
    my += (cy / (6 * a)) * aa;
    renk.set(p.renk, (renk.get(p.renk) ?? 0) + aa);
  }
  const pay: Record<string, number> = {};
  for (const [r, a] of [...renk].sort((x, y) => y[1] - x[1])) {
    const yuzde = (a / (alan || 1)) * 100;
    if (yuzde >= 1) pay[r] = yuvarla(yuzde);
  }
  return {
    n: c.cokgenler.length,
    alan: yuvarla(alan),
    merkez: [yuvarla(mx / (alan || 1), 100), yuvarla(my / (alan || 1), 100)],
    kutu: c.kutu.map((x) => yuvarla(x, 100)) as ParmakIzi['kutu'],
    renk: pay,
  };
}

/** Paylar: bunların içindeki fark "aynı çizim" sayılıyor. */
export const PAY = {
  /** Çokgen sayısı: yüzde (sınırdaki birkaç yüz arka yüze dönebiliyor). */
  n: 1,
  /** Alan: yüzde. */
  alan: 0.5,
  /** Merkez ve çerçeve: çerçevenin boyutuna göre yüzde. */
  yer: 0.5,
  /** Renk payı: yüzde puanı. */
  renk: 1.5,
};

/** İki izin farkları (boşsa aynı çizim). */
export function karsilastir(eski: ParmakIzi, yeni: ParmakIzi): string[] {
  const f: string[] = [];
  const yuzde = (a: number, b: number) => (Math.abs(a - b) / Math.max(1e-9, Math.abs(a))) * 100;
  if (yuzde(eski.n, yeni.n) > PAY.n && Math.abs(eski.n - yeni.n) > 2)
    f.push(`çokgen ${eski.n} → ${yeni.n}`);
  if (yuzde(eski.alan, yeni.alan) > PAY.alan) f.push(`alan ${eski.alan} → ${yeni.alan}`);
  const olcu = Math.max(eski.kutu[2], eski.kutu[3], 1);
  const kaydi = (a: number, b: number) => (Math.abs(a - b) / olcu) * 100 > PAY.yer;
  if (kaydi(eski.merkez[0], yeni.merkez[0]) || kaydi(eski.merkez[1], yeni.merkez[1]))
    f.push(`merkez ${eski.merkez.join(',')} → ${yeni.merkez.join(',')}`);
  if (eski.kutu.some((x, i) => kaydi(x, yeni.kutu[i]!)))
    f.push(`çerçeve ${eski.kutu.join(',')} → ${yeni.kutu.join(',')}`);
  for (const r of new Set([...Object.keys(eski.renk), ...Object.keys(yeni.renk)])) {
    const a = eski.renk[r] ?? 0;
    const b = yeni.renk[r] ?? 0;
    if (Math.abs(a - b) > PAY.renk) f.push(`renk ${r} %${a} → %${b}`);
  }
  return f;
}
