/**
 * Çoklu hesap şüphesi — yöneticiye bir liste, oyuncuya hiçbir şey.
 *
 * İkinci bir hesap açıp onu ana hesaba "besleme" bu türün bilinen
 * istismarı: yeni hesap kaynağını, askerini ya da pazardaki altınını tek
 * yönlü olarak ötekine akıtıyor. Ticaret ve takviye açıldığından beri
 * kapı açık; bunu görmenin yolu yoktu.
 *
 * ÜÇ İLKE
 *
 * 1. ÖNCE DAVRANIŞ. Oyunun zaten tuttuğu izler: ittifak içi sevkiyat,
 *    takviye yürüyüşü, eşya pazarında aynı çiftin işlemleri.
 * 2. AĞ YALNIZ AĞIRLAŞTIRIR. İlk sürümde ağ izi hiç yoktu ve en güçlü
 *    işaret eksikti: besleme hesabı çoğu zaman aynı evden açılıyor. Artık
 *    IP'nin gizli anahtarlı ÖZETİ kısa süre tutuluyor (düz adres hiçbir
 *    yere yazılmıyor, bkz. apps/api services/agIzi.ts). Ama aynı ev aynı
 *    kişi değil — iki kardeş, bir yurt — o yüzden ağ tek başına kimseyi
 *    listeye sokmuyor: yalnız ARALARINDA AKIŞ olan çifte işaret ekliyor.
 *    Çok lordun girdiği ağ (mobil operatörün ortak adresi) yok sayılıyor.
 * 3. OTOMATİK CEZA YOK. Arkadaşlar da birbirine yardım eder ve tek yönlü
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
  agGunEsigi: C.ag_gun_esigi,
  kalabalikAgLord: C.kalabalik_ag_lord,
  agIziSaklamaGun: C.ag_izi_saklama_gun,
  listeBoyu: C.liste_boyu,
} as const;

export type CokluHesapIsareti = 'sevkiyat' | 'takviye' | 'pazar' | 'ag';

export interface CokluHesapGirdisi {
  /** Pencere içindeki sevkiyatlar; `agirlik` = yükün altın karşılığı. */
  sevkiyatlar: readonly { from: string; to: string; agirlik: number }[];
  /** Pencere içindeki takviye yürüyüşleri; `to` = hedef bölgenin sahibi. */
  takviyeler: readonly { from: string; to: string }[];
  /** Pencere içindeki eşya pazarı işlemleri. */
  pazar: readonly { satici: string; alici: string }[];
  /**
   * Pencere içindeki ağ izleri: lord, ağın özeti, gün. Verilmezse ağ
   * işareti hiç çıkmıyor (eski çağıranlar ve testler için).
   */
  agIzleri?: readonly { lordId: string; ozet: string; gun: number }[];
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
  /** Aynı gün aynı (kalabalık olmayan) ağdan girdikleri gün sayısı. */
  agGun: number;
  isaretler: CokluHesapIsareti[];
}

/**
 * Çift başına ortak ağ günü. Kalabalık ağ (pencerede `kalabalikAgLord`dan
 * çok lord) sayılmıyor: mobil operatörün ortak adresinde yüzlerce oyuncu
 * "aynı ağda" görünür ve işaret anlamını yitirirdi.
 */
export function ortakAgGunleri(
  izler: NonNullable<CokluHesapGirdisi['agIzleri']>,
): Map<string, number> {
  const agdakiler = new Map<string, Set<string>>();
  const gunde = new Map<string, Set<string>>(); // "ozet|gun" -> lordlar
  for (const iz of izler) {
    let a = agdakiler.get(iz.ozet);
    if (!a) agdakiler.set(iz.ozet, (a = new Set()));
    a.add(iz.lordId);
    const k = `${iz.ozet}|${iz.gun}`;
    let g = gunde.get(k);
    if (!g) gunde.set(k, (g = new Set()));
    g.add(iz.lordId);
  }
  const gunler = new Map<string, Set<number>>(); // çift -> günler
  for (const [k, lordlar] of gunde) {
    const [ozet, gun] = k.split('|') as [string, string];
    if ((agdakiler.get(ozet)?.size ?? 0) > COKLU_HESAP.kalabalikAgLord) continue;
    const l = [...lordlar];
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length; j++) {
        const c = ciftAnahtari(l[i]!, l[j]!);
        let s = gunler.get(c);
        if (!s) gunler.set(c, (s = new Set()));
        s.add(Number(gun));
      }
    }
  }
  return new Map([...gunler].map(([c, s]) => [c, s.size]));
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

  // Ağ yalnız etkileşimi olan çiftlere bakıyor: döngü `ciftler` üstünde.
  const agGunleri = g.agIzleri ? ortakAgGunleri(g.agIzleri) : new Map<string, number>();

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
    const agGun = agGunleri.get(cift) ?? 0;
    if (agGun >= COKLU_HESAP.agGunEsigi) isaretler.push('ag');
    if (isaretler.length === 0) continue;
    baglar.push({ besleyen, alan, sevkiyat, geriSevkiyat, takviye, pazar: p, agGun, isaretler });
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
