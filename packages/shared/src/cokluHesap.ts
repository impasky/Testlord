/**
 * Çoklu hesap şüphesi — yöneticiye bir liste, oyuncuya hiçbir şey.
 *
 * İkinci bir hesap açıp onu ana hesaba "besleme" bu türün bilinen
 * istismarı: yeni hesap kaynağını, askerini ya da pazardaki altınını tek
 * yönlü olarak ötekine akıtıyor. Ticaret ve takviye açıldığından beri
 * kapı açık; bunu görmenin yolu yoktu.
 *
 * İKİ İLKE
 *
 * 1. AĞ İZİ YOK. Gizlilik metni "IP adresin veritabanına yazılmıyor"
 *    diyor; bu söz duruyor. Yalnız oyunun zaten tuttuğu davranış izleri
 *    okunuyor: ittifak içi sevkiyat, takviye yürüyüşü, eşya pazarında
 *    aynı çiftin işlemleri.
 * 2. OTOMATİK CEZA YOK. Arkadaşlar da birbirine yardım eder ve tek yönlü
 *    bir yardım (güçlü olan zayıfı kaldırıyor) tamamen meşru olabilir.
 *    Liste bir insanın BAKMASI için; karar yöneticinin.
 *
 * Eşikler `balance.json` → `moderasyon.coklu_hesap`.
 */
import { B } from './balance.js';

const C = B.moderasyon.coklu_hesap;

export const COKLU_HESAP = {
  pencereGun: C.pencere_gun,
  sevkiyatEsigi: C.sevkiyat_esigi,
  tekYonOrani: C.tek_yon_orani,
  takviyeEsigi: C.takviye_esigi,
  pazarCiftEsigi: C.pazar_cift_esigi,
  gencHesapGun: C.genc_hesap_gun,
  listeBoyu: C.liste_boyu,
} as const;

export type CokluHesapIsareti = 'sevkiyat' | 'takviye' | 'pazar';

export interface CokluHesapGirdisi {
  /** Pencere içindeki sevkiyatlar; `agirlik` = yükün altın karşılığı. */
  sevkiyatlar: readonly { from: string; to: string; agirlik: number }[];
  /** Pencere içindeki takviye yürüyüşleri; `to` = hedef bölgenin sahibi. */
  takviyeler: readonly { from: string; to: string }[];
  /** Pencere içindeki eşya pazarı işlemleri. */
  pazar: readonly { satici: string; alici: string }[];
}

/** İki lord arasındaki bağ: `besleyen` akışın KAYNAĞI. */
export interface CokluHesapBagi {
  besleyen: string;
  alan: string;
  /** besleyen → alan sevkiyat ağırlığı. */
  sevkiyat: number;
  /** alan → besleyen (karşı yön). */
  geriSevkiyat: number;
  /** besleyen → alanın bölgelerine takviye. */
  takviye: number;
  /** İki lord arasındaki pazar işlemi (yönsüz). */
  pazar: number;
  isaretler: CokluHesapIsareti[];
}

/** Yönsüz çift anahtarı: aynı iki lord tek bağ. */
const ciftAnahtari = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function cokluHesapBaglari(g: CokluHesapGirdisi): CokluHesapBagi[] {
  // Yönlü toplamlar: "a>b" anahtarıyla.
  const sevk = new Map<string, number>();
  const takv = new Map<string, number>();
  const pazar = new Map<string, number>();
  const ciftler = new Set<string>();
  const ekle = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);

  for (const s of g.sevkiyatlar) {
    if (s.from === s.to) continue;
    ekle(sevk, `${s.from}>${s.to}`, s.agirlik);
    ciftler.add(ciftAnahtari(s.from, s.to));
  }
  for (const t of g.takviyeler) {
    if (t.from === t.to) continue;
    ekle(takv, `${t.from}>${t.to}`, 1);
    ciftler.add(ciftAnahtari(t.from, t.to));
  }
  for (const p of g.pazar) {
    if (p.satici === p.alici) continue;
    const k = ciftAnahtari(p.satici, p.alici);
    ekle(pazar, k, 1);
    ciftler.add(k);
  }

  const baglar: CokluHesapBagi[] = [];
  for (const cift of ciftler) {
    const [a, b] = cift.split('|') as [string, string];
    const ab = sevk.get(`${a}>${b}`) ?? 0;
    const ba = sevk.get(`${b}>${a}`) ?? 0;
    const tab = takv.get(`${a}>${b}`) ?? 0;
    const tba = takv.get(`${b}>${a}`) ?? 0;
    // Besleyen: daha çok VEREN taraf. Sevkiyat önce, eşitse takviye.
    const aVeriyor = ab > ba || (ab === ba && tab >= tba);
    const [besleyen, alan] = aVeriyor ? [a, b] : [b, a];
    const sevkiyat = aVeriyor ? ab : ba;
    const geriSevkiyat = aVeriyor ? ba : ab;
    const takviye = aVeriyor ? tab : tba;
    const p = pazar.get(cift) ?? 0;

    const isaretler: CokluHesapIsareti[] = [];
    if (
      sevkiyat >= COKLU_HESAP.sevkiyatEsigi &&
      geriSevkiyat < sevkiyat * COKLU_HESAP.tekYonOrani
    ) {
      isaretler.push('sevkiyat');
    }
    if (takviye >= COKLU_HESAP.takviyeEsigi) isaretler.push('takviye');
    if (p >= COKLU_HESAP.pazarCiftEsigi) isaretler.push('pazar');
    if (isaretler.length === 0) continue;
    baglar.push({ besleyen, alan, sevkiyat, geriSevkiyat, takviye, pazar: p, isaretler });
  }

  // Çok işaretli önce; eşitse büyük akış önce.
  return baglar
    .sort(
      (x, y) =>
        y.isaretler.length - x.isaretler.length ||
        y.sevkiyat - x.sevkiyat ||
        y.takviye + y.pazar - (x.takviye + x.pazar),
    )
    .slice(0, COKLU_HESAP.listeBoyu);
}
