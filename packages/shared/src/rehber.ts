/**
 * Rehber — ilk oturumda yanında duran kâhya.
 *
 * Bir oyuncu testinden çıktı ve öğreticinin TÜRÜNÜ sorguluyordu:
 *
 *   "oyunun içine giremiyorum, kendimi kaptıramıyorum... böyle yavaş yavaş
 *    açılsa her şey, bu 4X oyunlarındaki gibi bir komutan ya da yardımcımız
 *    oluyor, teker teker hem yaptırıyor hem direkt sonucunu gösteriyor...
 *    şu an her şeyi üstümüze atıyor, al öğren oyna diyor."
 *
 * Bizim öğreticimiz sekiz sayfalık bir TANITIM: oku, sonra kendin dene.
 * İstenen bir ZİNCİR: şimdi şuna bas, oldu mu bak, şimdi şuna. Aradaki
 * fark "anlattım" ile "yaptırdım" farkı.
 *
 * ── Neden ikinci bir sistem DEĞİL ──────────────────────────────────────
 *
 * Rehber kendi adım sayacını tutmuyor. Omurga (docs/08 İ4) zaten "şimdi ne
 * yapmalısın"ı oyun durumundan türetiyor; rehber onun ÜSTÜNE ses ekliyor.
 * Ayrı bir senaryo yazsaydık iki doğruluk kaynağı olurdu ve klasik öğretici
 * hatası çıkardı: senaryo "şimdi asker eğit" derken oyuncunun zaten askeri
 * olur, ya da tersi. Burada öyle bir hâl mümkün değil — rehberin gösterdiği
 * adım, omurganın hesapladığı adımdır.
 *
 * Bu yüzden burada yalnız METİN var: hangi omurga adımında kâhya ne der.
 * Adımın kendisi Omurga.tsx'te hesaplanıyor.
 *
 * ── Neden kâhya ───────────────────────────────────────────────────────
 *
 * Kâhya Sinan generaller listesinde zaten var (portresi dahil) ve yeni bir
 * lorda malikâneyi anlatacak kişi tam olarak odur. Yeni bir karakter
 * uydurup yeni bir görsel istemek gerekmedi.
 */
import { B } from './balance.js';

/** Rehberin kimliği. Portre `gorseller/generaller/<key>.webp`. */
export const REHBER = {
  key: 'kahya_sinan',
  ad: 'Kâhya Sinan',
  unvan: 'Malikâne kâhyan',
} as const;

export interface RehberSozu {
  /** Omurga adımının anahtarı. */
  adim: string;
  /** Tek cümle. Kâhyanın ağzından, ikinci tekil. */
  soz: string;
}

/**
 * Kâhyanın her omurga adımında söylediği tek cümle.
 *
 * Kural: cümle EYLEMİ değil, SEBEBİ söyler. Düğmenin üstünde zaten
 * "Kışlada mızrakçı eğit" yazıyor; kâhyanın "kışlaya git" demesi aynı şeyi
 * iki kez söylemek olurdu. Onun işi neden oraya gittiğini söylemek.
 */
export function rehberSozleri(): RehberSozu[] {
  const ilkEgitimSn = B.ilk_egitim.saniye;
  const ilkSaldiriDk = B.yuruyus.ilk_saldiri_dakika;
  return [
    {
      adim: 'ordu-kur',
      soz:
        'Lordum, toprağın var ama askerin yok. Kışlada birkaç mızrakçı yazdıralım — ' +
        `ilkini ${ilkEgitimSn} saniyede toplarım, beklemene gerek kalmaz.`,
    },
    {
      adim: 'egitim-bekle',
      soz: 'Adamlar toplanıyor. Şuracıkta bekle, bittiğinde haber vereceğim.',
    },
    {
      adim: 'saldir',
      soz:
        'Ordun hazır. Karşıdakinin sayısı seninkinden çok olabilir — bakma sen ona, ' +
        'önemli olan hangi askerin hangisini yediği. Aşağıda yazıyor.',
    },
    {
      adim: 'ordu-yolda',
      soz: `Ordun yolda. İlk yürüyüşün ${ilkSaldiriDk} dakika sürer; sonucu bu oturumda görürsün.`,
    },
    {
      adim: 'liderlik',
      soz: 'Ordu büyüdükçe komuta gerekir. Liderlik statın kaç asker taşıyabileceğini söyler.',
    },
    {
      adim: 'ekipman',
      soz: 'Bir bölgen oldu. Demirhanede kuşanacağın her parça, savaşa senin katkını büyütür.',
    },
    {
      adim: 'general',
      soz: 'Artık bir general tutabilirsin. Onlar ordunun değil, ORDUNUN KURALLARININ gücüdür.',
    },
    {
      adim: 'aclik',
      soz: 'Erzak eksiye düştü lordum. Aç ordu dağılır — önce burayı kapatalım.',
    },
    {
      adim: 'yarali',
      soz: 'Yaralısın. Dinlenmeden sefere çıkmak, orduyu iki kez kaybetmektir.',
    },
  ];
}

/** Bir omurga adımı için kâhyanın sözü; yoksa null. */
export function rehberSozu(adim: string | null | undefined): string | null {
  if (!adim) return null;
  return rehberSozleri().find((x) => x.adim === adim)?.soz ?? null;
}

/**
 * Rehber hâlâ görünsün mü?
 *
 * Ölçüt DÖNGÜNÜN KAPANMASI: oyuncu bir bölge aldıysa kaynak → asker →
 * saldırı → bölge zincirini bir kez tamamlamış demektir ve kâhyanın işi
 * bitmiştir. Adım sayısına ya da geçen süreye bakmak yanlış olurdu:
 * yirmi dakika gezinip hiçbir şey yapmamış oyuncunun rehbere hâlâ
 * ihtiyacı var, iki dakikada bölge almışınki yok.
 *
 * `elleKapatildi` oyuncunun kendi kararı — rehber zorunlu bir tur değil.
 */
export function rehberGorunsunMu(bolgeSayisi: number, elleKapatildi: boolean): boolean {
  return !elleKapatildi && bolgeSayisi === 0;
}
