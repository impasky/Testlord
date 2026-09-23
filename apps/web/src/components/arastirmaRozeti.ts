/**
 * Araştırma kutusunun ETKİ ROZETİ: kutu ne verdiğini okumadan söylesin.
 *
 * Ağaçta kutular yalnız ad taşıyordu ("Ambarlar", "Kâtipler") ve oyuncu
 * ne kazanacağını görmek için altmış kutunun her birine tek tek
 * dokunmak zorundaydı. Ağacın asıl sorusu "bu yol beni NEREYE götürür"
 * ve cevabı kutunun üstünde olmalı: bir simge (neyi etkiliyor) ve bir
 * sayı (ne kadar).
 *
 * Burada yalnız EŞLEME var — etki anahtarı → simge, yön, sayı. Metin
 * bileşende `+%{0}` kalıbıyla yazılıyor ki çeviri sistemi onu öteki
 * yüzdeler gibi çevirsin ("+10%").
 */
import type { IkonAnahtari } from './ikon-verisi';

/** Birim etkisinde ikinci küçük simge: saldırı mı savunma mı. */
export type RozetYonu = 'saldiri' | 'savunma' | null;

export interface EtkiRozeti {
  ikon: IkonAnahtari;
  yon: RozetYonu;
  /** Mutlak değer: yüzdeyse tam sayı yüzde (10), değilse adet (40). */
  deger: number;
  tur: 'yuzde' | 'sayi';
  /** Artış mı azalış mı — "−%30 casus maliyeti" azalış ama iyi bir şey. */
  isaret: 1 | -1;
  /** Kutuya sığmayan öteki etkilerin sayısı. */
  fazla: number;
}

interface Esleme {
  ikon: IkonAnahtari;
  yon?: RozetYonu;
  /** Değer adet mi (komuta +40, yuva +1), yüzde değil. */
  sayi?: boolean;
  /** Veride artı yazılan ama oyunda AZALTAN etki (bakım indirimi). */
  ters?: boolean;
}

const BIRIMLER = ['milis', 'mizrakci', 'okcu', 'suvari', 'kusatma'] as const;

const ESLEME: Record<string, Esleme> = {
  ordu_saldiri: { ikon: 'saldiri' },
  ordu_savunma: { ikon: 'savunma' },
  kale_savunmasi: { ikon: 'kale', yon: 'savunma' },
  yuruyus_hizi: { ikon: 'hiz' },
  depo_carpani: { ikon: 'depo' },
  bolge_geliri: { ikon: 'sehir' },
  malikane_geliri: { ikon: 'navMalikane' },
  altin_geliri: { ikon: 'altin' },
  demir_geliri: { ikon: 'demir' },
  erzak_geliri: { ikon: 'erzak' },
  yagma: { ikon: 'yagma' },
  bolge_yukseltme_hizi: { ikon: 'cekic' },
  bina_hizi: { ikon: 'cekic' },
  arastirma_hizi: { ikon: 'kitap' },
  arastirma_yuvasi: { ikon: 'kitap', sayi: true },
  bakim_indirimi: { ikon: 'erzak', ters: true },
  komuta_kapasitesi: { ikon: 'sancak', sayi: true },
  casus_maliyeti: { ikon: 'goz' },
  egitim_maliyeti: { ikon: 'navKisla' },
  egitim_hizi: { ikon: 'navKisla' },
  gunluk_saldiri: { ikon: 'saldiri', sayi: true },
  ...Object.fromEntries(
    BIRIMLER.flatMap((b) => [
      [`${b}_saldiri`, { ikon: b, yon: 'saldiri' as const }],
      [`${b}_savunma`, { ikon: b, yon: 'savunma' as const }],
    ]),
  ),
};

function eslemeBul(anahtar: string): Esleme | null {
  if (ESLEME[anahtar]) return ESLEME[anahtar];
  // Taktik ustalıkları: altı ayrı anahtar, hepsi aynı simge.
  if (anahtar.startsWith('taktik_')) return { ikon: 'taktik' };
  return null;
}

/**
 * Düğümün ilk (tanınan) etkisinin rozeti; tanınan etki yoksa null.
 * Sıra verideki sıra — düğümü yazan, en önemli etkiyi başa koyuyor.
 */
export function etkiRozeti(etki: Record<string, number | undefined>): EtkiRozeti | null {
  const kalemler = Object.entries(etki).filter(
    (e): e is [string, number] => typeof e[1] === 'number' && e[1] !== 0,
  );
  const ilk = kalemler.find(([k]) => eslemeBul(k));
  if (!ilk) return null;
  const [anahtar, ham] = ilk;
  const e = eslemeBul(anahtar)!;
  const isaret: 1 | -1 = ham < 0 !== Boolean(e.ters) ? -1 : 1;
  return {
    ikon: e.ikon,
    yon: e.yon ?? null,
    deger: e.sayi ? Math.abs(ham) : Math.round(Math.abs(ham) * 100),
    tur: e.sayi ? 'sayi' : 'yuzde',
    isaret,
    fazla: kalemler.length - 1,
  };
}
