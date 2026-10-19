/**
 * Gerçek dünya haritasının geometrisi (docs/27): `dunyaGeo.json`u ilk
 * kullanımda ayrı bir paket olarak indirir ve tuvalde çizilecek yollara
 * çevirir.
 *
 * Dosya bir kez ve yalnız harita açılınca iniyor: telefonun ilk indirdiği
 * pakete girseydi oyunun açılışı bir MB'a yakın büyürdü. Çözülen yollar
 * (Path2D) bellekte kalıyor; ekran her açılışta yeniden çözmüyor.
 *
 * Koordinatlar izdüşüm birimi × `olcek` (tamsayı): halkada ilk nokta
 * mutlak, sonrakiler fark (`tools/gercek-dunya-uret.mjs`). Bölgenin
 * yüzdelik x/y'si aynı izdüşümde: x% × en / 100.
 */

/** Kutu: [x0, y0, x1, y1], izdüşüm biriminde. */
export type Kutu = [number, number, number, number];

export interface Hucre {
  /** Kanonik harita numarası. */
  mapId: number;
  /** Ölçekli koordinatlarda (birim × olcek) yol: çizerken dönüşüm 1/olcek. */
  yol: Path2D;
  kutu: Kutu;
  /** Alan (birim²): küçük toprakta dokunma işaretçiye düşüyor. */
  alan: number;
}

export interface UlkeSekli {
  kod: string;
  yol: Path2D;
  kutu: Kutu;
  /** Ülke adının yazılacağı yer: en büyük parçanın ağırlık merkezi (birim). */
  etiket: [number, number];
  /** En büyük parçanın kutusu — ad ancak oraya sığıyorsa yazılıyor. */
  parcaKutu: Kutu;
}

export interface DunyaGeometrisi {
  en: number;
  boy: number;
  olcek: number;
  /** mapId → hücre. */
  hucreler: Map<number, Hucre>;
  ulkeler: UlkeSekli[];
  /** Deniz yolları: kanonik bölge numarası çiftleri. */
  deniz: [number, number][];
}

interface HamGeo {
  en: number;
  boy: number;
  olcek: number;
  ulkeler: { k: string; h: number[][] }[];
  hucreler: number[][][];
  deniz: [number, number][];
}

/** Halkanın mutlak noktaları (ölçekli). */
function noktalar(h: number[]): number[] {
  const n: number[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < h.length; i += 2) {
    x += h[i]!;
    y += h[i + 1]!;
    n.push(x, y);
  }
  return n;
}

function alanVeMerkez(n: number[]): { alan: number; cx: number; cy: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  const m = n.length / 2;
  for (let i = 0, j = m - 1; i < m; j = i++) {
    const xi = n[2 * i]!;
    const yi = n[2 * i + 1]!;
    const xj = n[2 * j]!;
    const yj = n[2 * j + 1]!;
    const c = xj * yi - xi * yj;
    a += c;
    cx += (xj + xi) * c;
    cy += (yj + yi) * c;
  }
  if (Math.abs(a) < 1e-9) return { alan: 0, cx: n[0] ?? 0, cy: n[1] ?? 0 };
  return { alan: Math.abs(a / 2), cx: cx / (3 * a), cy: cy / (3 * a) };
}

function kutuOf(n: number[], k: Kutu): void {
  for (let i = 0; i + 1 < n.length; i += 2) {
    if (n[i]! < k[0]) k[0] = n[i]!;
    if (n[i + 1]! < k[1]) k[1] = n[i + 1]!;
    if (n[i]! > k[2]) k[2] = n[i]!;
    if (n[i + 1]! > k[3]) k[3] = n[i + 1]!;
  }
}

function yolKur(halkalar: number[][], olcek: number) {
  const yol = new Path2D();
  const kutu: Kutu = [Infinity, Infinity, -Infinity, -Infinity];
  let enBuyuk = { alan: -1, cx: 0, cy: 0, kutu: [0, 0, 0, 0] as Kutu };
  let alanToplam = 0;
  for (const h of halkalar) {
    const n = noktalar(h);
    if (n.length < 6) continue;
    yol.moveTo(n[0]!, n[1]!);
    for (let i = 2; i + 1 < n.length; i += 2) yol.lineTo(n[i]!, n[i + 1]!);
    yol.closePath();
    kutuOf(n, kutu);
    const am = alanVeMerkez(n);
    alanToplam += am.alan;
    if (am.alan > enBuyuk.alan) {
      const pk: Kutu = [Infinity, Infinity, -Infinity, -Infinity];
      kutuOf(n, pk);
      enBuyuk = { ...am, kutu: pk };
    }
  }
  const o = olcek;
  return {
    yol,
    kutu: kutu.map((v) => v / o) as Kutu,
    alan: alanToplam / (o * o),
    etiket: [enBuyuk.cx / o, enBuyuk.cy / o] as [number, number],
    parcaKutu: enBuyuk.kutu.map((v) => v / o) as Kutu,
  };
}

let YUKLEME: Promise<DunyaGeometrisi> | null = null;

/** Geometriyi bir kez indirip çözer; sonraki çağrılar aynı sözü alıyor. */
export function dunyaGeometrisiYukle(): Promise<DunyaGeometrisi> {
  if (!YUKLEME) {
    YUKLEME = import('./dunyaGeo.json').then((m) => {
      const ham = (m.default ?? m) as unknown as HamGeo;
      const hucreler = new Map<number, Hucre>();
      ham.hucreler.forEach((h, i) => {
        const k = yolKur(h, ham.olcek);
        hucreler.set(i + 1, { mapId: i + 1, yol: k.yol, kutu: k.kutu, alan: k.alan });
      });
      const ulkeler = ham.ulkeler.map((u) => {
        const k = yolKur(u.h, ham.olcek);
        return { kod: u.k, yol: k.yol, kutu: k.kutu, etiket: k.etiket, parcaKutu: k.parcaKutu };
      });
      return { en: ham.en, boy: ham.boy, olcek: ham.olcek, hucreler, ulkeler, deniz: ham.deniz };
    });
    // İnemezse bir sonraki açılış yeniden denesin.
    YUKLEME.catch(() => {
      YUKLEME = null;
    });
  }
  return YUKLEME;
}
