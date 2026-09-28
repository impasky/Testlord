/**
 * Dalgalanan bayrak ve salınan sancak (docs/24 "Hareket"): kumaşın bir
 * turu, GPU için.
 *
 * Bayrak kumaşı dinlenik hâlini taşıyor (`Yuz.bez`); her kare aynı
 * kumaşın dalganın bir sonraki evresindeki hâli (`parca.bezAni`). İlk kare
 * durağan bayrakla aynı: hareketsiz sahnedeki bayrak buradan başlıyor.
 * Kareler bayrak bayrak ardışık: çizici her bayrağın kutusunu ayrı buluyor.
 */
import { KOSE, agYap } from './glAg';
import type { BayrakKareleri } from './glCizici';
import { BAYRAK_SURE, bezAni, bezFazi, salinimBicimi } from './parca';
import { kameraTabani, type Kamera, type Model, type V3, type Yuz } from './uc';

export { AGAC_SURE, ASKER_SURE, BAYRAK_SURE, SANCAK_SURE } from './parca';

/** Bir dalga turundaki kare sayısı. */
export const BAYRAK_KARE = 12;

const anahtar = (q: V3) => q.map((v) => v.toFixed(4)).join(',');

/**
 * Salınan yüzleri parça parça toplar (bayrak, sancak, ağaç): aynı kökü
 * (`bez.kok`) ya da dinlenik köşesini paylaşan yüzler aynı parça. Parçalar
 * uzaktan yakına: sayfada yakın olan üstte kalsın.
 */
export function bayrakGruplari(model: Model, kamera?: Kamera): Yuz[][] {
  const yuzler = model.filter((y) => y.bez);
  const ata = yuzler.map((_, i) => i);
  const bul = (i: number): number => (ata[i] === i ? i : (ata[i] = bul(ata[i]!)));
  const sahip = new Map<string, number>();
  const bagla = (a: string, i: number) => {
    const j = sahip.get(a);
    if (j === undefined) sahip.set(a, i);
    else ata[bul(i)] = bul(j);
  };
  yuzler.forEach((y, i) => {
    if (y.bez!.kok) bagla('k' + anahtar(y.bez!.kok), i);
    else for (const q of y.bez!.dinlenik) bagla(anahtar(q), i);
  });
  const gruplar = new Map<number, Yuz[]>();
  yuzler.forEach((y, i) => {
    const g = bul(i);
    if (!gruplar.has(g)) gruplar.set(g, []);
    gruplar.get(g)!.push(y);
  });
  const { c } = kameraTabani(kamera);
  const derinlik = (g: Yuz[]) => {
    let t = 0;
    let n = 0;
    for (const y of g)
      for (const q of y.bez!.dinlenik) {
        t += q[0] * c[0] + q[1] * c[1] + q[2] * c[2];
        n++;
      }
    return t / n;
  };
  return [...gruplar.values()]
    .map((g) => ({ g, d: derinlik(g) }))
    .sort((a, b) => a.d - b.d)
    .map(({ g }) => g);
}

/**
 * Salınan parçaların (sancak, ağaç) kareleri, hızlı yol: ağ bir kez
 * kuruluyor, her karede yalnız köşeler kayıyor (salınım iki sabit biçimin
 * toplamı). Normaller durağan hâlden: salınım hafif. Parça parça ardışık.
 */
function salinanKareler(
  gruplar: Yuz[][],
  kamera: Kamera | undefined,
  sirala: (g: Yuz[]) => Yuz[],
): { kare: (adim: number) => Float32Array[] } {
  const yuzler: Yuz[] = [];
  const grubu: number[] = [];
  gruplar.forEach((g, i) =>
    sirala(g).forEach((y) => {
      yuzler.push(y);
      grubu.push(i);
    }),
  );
  const ag = agYap(yuzler, kamera, { kaynak: true });
  const kaynak = ag.nesneKaynak!;
  const n = kaynak.length / 2;
  const temel = new Float32Array(n * 3);
  const yon = new Float32Array(n * 3);
  const bicim = new Float32Array(n * 2);
  const faz = new Float32Array(n);
  const sinir: number[] = gruplar.map(() => 0);
  for (let v = 0; v < n; v++) {
    const y = yuzler[kaynak[v * 2]!]!;
    const i = kaynak[v * 2 + 1]!;
    const b = y.bez!;
    const d = b.dinlenik[i]!;
    temel.set(d, v * 3);
    yon.set(b.yon!, v * 3);
    bicim.set(salinimBicimi(b.u[i]!, b.kivrim), v * 2);
    faz[v] = bezFazi(y);
    sinir[grubu[kaynak[v * 2]!]!]!++;
  }
  return {
    kare: (adim) => {
      const f = ag.nesne.slice();
      for (let v = 0; v < n; v++) {
        const s =
          Math.sin(faz[v]! + adim) * bicim[v * 2]! + Math.cos(faz[v]! + adim) * bicim[v * 2 + 1]!;
        for (let e = 0; e < 3; e++) f[v * KOSE + e] = temel[v * 3 + e]! + yon[v * 3 + e]! * s;
      }
      const parcalar: Float32Array[] = [];
      let bas = 0;
      for (const say of sinir) {
        parcalar.push(f.subarray(bas * KOSE, (bas + say) * KOSE));
        bas += say;
      }
      return parcalar;
    },
  };
}

/** Modeldeki bayrakların kareleri; bayrak yoksa `undefined`. */
export function bayrakKareleri(model: Model, kamera?: Kamera): BayrakKareleri | undefined {
  const gruplar = bayrakGruplari(model, kamera);
  if (!gruplar.length) return undefined;
  const { c } = kameraTabani(kamera);
  const derinlik = (y: Yuz) => y.p.reduce((t, q) => t + q[0] * c[0] + q[1] * c[1] + q[2] * c[2], 0);
  // Uzaktan yakına: parça derinliğe yazmadan çiziliyor, kıvrım üst üste
  // binince yakın olan üstte kalsın.
  const sirala = (g: Yuz[]) => [...g].sort((a, b) => derinlik(a) - derinlik(b));
  // Sancak ve ağaç hızlı yoldan; bayrağın dalgası normali de değiştiriyor,
  // her karede yeniden kuruluyor (bayrak az).
  const sarkac = gruplar.map((g) => !!g[0]!.bez!.yon);
  const hizli = salinanKareler(
    gruplar.filter((_, i) => sarkac[i]),
    kamera,
    sirala,
  );
  const kareler: Float32Array[] = [];
  let sayilar: number[] = [];
  for (let f = 0; f < BAYRAK_KARE; f++) {
    const adim = (2 * Math.PI * f) / BAYRAK_KARE;
    const hizliParcalar = hizli.kare(adim);
    let h = 0;
    const parcalar = gruplar.map((g, i) =>
      sarkac[i]
        ? hizliParcalar[h++]!
        : agYap(sirala(g.map((y) => bezAni(y, bezFazi(y) + adim))), kamera).nesne,
    );
    if (f === 0) sayilar = parcalar.map((p) => p.length / KOSE);
    const toplam = new Float32Array(parcalar.reduce((t, p) => t + p.length, 0));
    let bas = 0;
    for (const p of parcalar) {
      toplam.set(p, bas);
      bas += p.length;
    }
    kareler.push(toplam);
  }
  return {
    kareler,
    gruplar: sayilar,
    sureler: gruplar.map((g) => g[0]!.bez!.sure ?? BAYRAK_SURE),
  };
}
