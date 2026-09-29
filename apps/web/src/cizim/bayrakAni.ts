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

/**
 * Modeldeki salınan ve canlı parçaların kareleri; yoksa `undefined`.
 *
 * Her parçanın kendi kare sayısı var: bayrak, sancak ve ağaç 12; canlı
 * parça (`bez.canli`: talimdeki okçu, koşan at) kendi sayısı. Kare
 * tamponları en uzun turun sayısı kadar; turu kısa olan parçanın sonraki
 * karelerde yeri boş tutuluyor ve çizilmiyor (`kareSayilari`).
 *
 * Kareler TEMBEL (`kareAl`): çizici onları sırayla istiyor, her kare
 * istenince kuruluyor ve çizildikten sonra bırakılıyor. Yerleşkenin 40
 * karesi önceden kurulunca işçide ~195 MB tutuyordu (telefonun belleğini
 * aşar). Atlasın yerleşimi için gereken kapsam (`kapsam`) karelerden
 * değil, duruşların köşelerinden önceden bulunuyor.
 */
export function bayrakKareleri(model: Model, kamera?: Kamera): BayrakKareleri | undefined {
  const gruplar = bayrakGruplari(model, kamera);
  if (!gruplar.length) return undefined;
  const { c, sag, yukari } = kameraTabani(kamera);
  // Uzaktan yakına: parça derinliğe yazmadan çiziliyor, kıvrım üst üste
  // binince yakın olan üstte kalsın. Derinlik yüz başına bir kez: her
  // karşılaştırmada yeniden toplamak sıralamanın kendisinden pahalıydı.
  const sirala = (g: Yuz[]) =>
    g
      .map((y) => ({ y, d: y.p.reduce((t, q) => t + q[0] * c[0] + q[1] * c[1] + q[2] * c[2], 0) }))
      .sort((a, b) => a.d - b.d)
      .map(({ y }) => y);
  const canli = gruplar.map((g) => g[0]!.bez!.canli?.kare ?? 0);
  const kareSayilari = canli.map((k) => k || BAYRAK_KARE);
  const toplamKare = Math.max(...kareSayilari);
  // Sancak ve ağaç hızlı yoldan; bayrağın dalgası normali de değiştiriyor,
  // her karede yeniden kuruluyor (bayrak az).
  const sarkac = gruplar.map((g, i) => !canli[i] && !!g[0]!.bez!.yon);
  // Salınanların 12 karesi bir kez, baştan (küçükler; kapsamları da
  // onlardan): uzun turlu sahnede başa sararak yeniden kullanılıyor.
  const salinan: Float32Array[][] = [];
  if (canli.some((k) => !k)) {
    const hizli = salinanKareler(
      gruplar.filter((_, i) => sarkac[i]),
      kamera,
      sirala,
    );
    for (let fs = 0; fs < BAYRAK_KARE; fs++) {
      const adim = (2 * Math.PI * fs) / BAYRAK_KARE;
      const hizliParcalar = hizli.kare(adim);
      let h = 0;
      salinan.push(
        gruplar.map((g, i) =>
          canli[i]
            ? new Float32Array(0)
            : sarkac[i]
              ? hizliParcalar[h++]!
              : agYap(sirala(g.map((y) => bezAni(y, bezFazi(y) + adim))), kamera).nesne,
        ),
      );
    }
  }
  // Kapsam: her parçanın bütün karelerde kameranın düzleminde kapladığı
  // yer. Salınanda karelerinden; canlıda duruşların köşelerinden.
  const kapsam = gruplar.map((): [number, number, number, number] => [
    Infinity,
    -Infinity,
    Infinity,
    -Infinity,
  ]);
  const genislet = (i: number, x: number, y: number, z: number) => {
    const k = kapsam[i]!;
    const a = x * sag[0] + y * sag[1] + z * sag[2];
    const b = x * yukari[0] + y * yukari[1] + z * yukari[2];
    if (a < k[0]) k[0] = a;
    if (a > k[1]) k[1] = a;
    if (b < k[2]) k[2] = b;
    if (b > k[3]) k[3] = b;
  };
  for (const kare of salinan)
    kare.forEach((t, i) => {
      for (let o = 0; o < t.length; o += KOSE) genislet(i, t[o]!, t[o + 1]!, t[o + 2]!);
    });

  // Canlı parçanın f. karesi: aktörün o duruşu (bütün yüzleri bir kez
  // kurulup dönüşüyor, bkz. `uc.Yuz.bez`). Duruşlar TEK geçişte, kapsamla
  // birlikte kuruluyor; karede yalnız köşeler ve köşe normalleri değişiyor
  // (renk, malzeme, yüz sırası aynı), onlar sıkışık bir tampona yazılıyor
  // ve kare istenince ilk karenin yüzlerinden yeniden kuruluyor. Duruşu ve
  // dönüşümleri iki kez hesaplamak (kapsam, sonra kare) sürenin yarısıydı.
  const kayit: Float32Array[][] = gruplar.map(() => []);
  const duruslar = (i: number, f: number) =>
    gruplar[i]!.map((y) => {
      const c = y.bez!.canli!;
      return c.model(f)[c.i]!;
    });
  for (let f = 0; f < toplamKare; f++)
    canli.forEach((k, i) => {
      if (!k || f >= k) return;
      const yuzler = duruslar(i, f);
      let n = 0;
      for (const y of yuzler) n += y.p.length * (y.vn ? 6 : 3);
      const t = new Float32Array(n);
      let o = 0;
      for (const y of yuzler) {
        for (const q of y.p) {
          genislet(i, q[0], q[1], q[2]);
          t[o++] = q[0];
          t[o++] = q[1];
          t[o++] = q[2];
        }
        if (y.vn)
          for (const v of y.vn) {
            t[o++] = v[0];
            t[o++] = v[1];
            t[o++] = v[2];
          }
      }
      kayit[i]![f] = t;
    });
  // İki yüzlü: dönen uzuv arkasını gösterse de köşe sayısı karede karede aynı.
  const canliKare = (i: number, f: number): Float32Array => {
    const t = kayit[i]![f];
    let o = 0;
    const oku = (): V3 => [t![o++]!, t![o++]!, t![o++]!];
    // Kaydı bırakılmış kare (sırası geçmiş) duruştan yeniden kuruluyor;
    // kayıttaki gibi 32 bitlik sayıya yuvarlanarak: iki yol aynı kareyi versin.
    const yuvarla = (q: V3): V3 => [Math.fround(q[0]), Math.fround(q[1]), Math.fround(q[2])];
    const yuzler: Yuz[] = t
      ? gruplar[i]!.map((y) => {
          const p = y.p.map(oku);
          return { ...y, p, ...(y.vn ? { vn: y.vn.map(oku) } : {}), bez: undefined };
        })
      : duruslar(i, f).map((y) => ({
          ...y,
          p: y.p.map(yuvarla),
          ...(y.vn ? { vn: y.vn.map(yuvarla) } : {}),
        }));
    return agYap(sirala(yuzler.map((y) => ({ ...y, ciftYuz: true }))), kamera).nesne;
  };
  const parcalar = (f: number) =>
    gruplar.map((_, i) =>
      f >= kareSayilari[i]! ? null : canli[i] ? canliKare(i, f) : salinan[f % BAYRAK_KARE]![i]!,
    );

  let ilk: (Float32Array | null)[] | null = parcalar(0);
  const sayilar = ilk.map((p) => p!.length / KOSE);
  const toplam = sayilar.reduce((t, n) => t + n, 0) * KOSE;
  return {
    kare: toplamKare,
    kareAl: (f) => {
      const p = f === 0 && ilk ? ilk : parcalar(f);
      if (f === 0) ilk = null;
      // Geride kalan karelerin kaydı bırakılıyor: çizici sırayla istiyor.
      for (const k of kayit) delete k[f - 1];
      const t = new Float32Array(toplam);
      let bas = 0;
      p.forEach((x, i) => {
        // Turu bitmiş parçanın yeri boş kalıyor: o karede çizilmiyor.
        if (x) t.set(x, bas);
        bas += sayilar[i]! * KOSE;
      });
      return t;
    },
    gruplar: sayilar,
    sureler: gruplar.map((g) => g[0]!.bez!.sure ?? BAYRAK_SURE),
    kareSayilari,
    kapsam,
  };
}

/**
 * Karelerin hepsi önceden kurulmuş, aktarılabilir biçim: ana iş
 * parçacığından işçiye giden istek için (tembel işlev gönderilemiyor).
 * Yalnız tarifsiz sahnede (galeri) gerekiyor; oyunun sahneleri işçide
 * kuruluyor.
 */
export function kareleriKur(by: BayrakKareleri): BayrakKareleri {
  const { kareAl, ...geri } = by;
  return kareAl ? { ...geri, kareler: Array.from({ length: by.kare }, (_, f) => kareAl(f)) } : by;
}
