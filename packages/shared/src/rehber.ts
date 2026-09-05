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
 * `tamamlandi` ise hesabın kalıcı kaydı (`Lord.rehberBittiAt`). İki işi
 * var:
 *
 *  - Rehber ZORUNLU: kapatma düğmesi yok. Oyuncu sekiz sayfalık tanıtımı
 *    okusa da okumasa da, geçse de geçmese de, elinden tutulan bu bölümü
 *    yapıyor. İki şey ayrı: biri ANLATIYOR, öbürü YAPTIRIYOR; birini
 *    atlamak öbürünü atlamak değil.
 *
 *  - Kayıt olmasaydı ölçüt tek başına "bölgesi yok" olurdu ve bölgelerini
 *    savaşta kaybetmiş KIDEMLİ bir lord kendini yeniden zorunlu turun
 *    içinde bulurdu. Damga bir kez konur, bir daha dönmez.
 */
export function rehberGorunsunMu(bolgeSayisi: number, tamamlandi: boolean): boolean {
  return !tamamlandi && bolgeSayisi === 0;
}

/* ---------------- Rehber ışığı: zorunlu tek düğme ---------------- */

/**
 * Rehber ışığının aydınlatabileceği bir düğme.
 *
 * `sebep` neden BU düğmeye basıldığını söyler. Oyuncunun ikinci geri
 * dönüşü buydu: "oyuncuya şuraya bas diyoruz ama neden bastığını
 * söylemiyoruz." Sebep aslında kâhyanın kartında yazıyordu — ama kart
 * perdenin ALTINDA kalıyordu. Yani sebep ekrandaydı, görünmüyordu.
 *
 * Bu yüzden sebep artık adımın değil DÜĞMENİN yanında duruyor: zincirin
 * ara düğmelerinin ("Hepsi", Malikâne sekmesi) adım cümlesiyle
 * açıklanamayacak kendi gerekçeleri var.
 *
 * `yol` işaretli düğmeler iş yapmaz, yalnız oyuncuyu işin yapılacağı
 * ekrana taşır. Ayrım kilitlenmeye karşı: ekrandaki İŞ düğmelerinin hepsi
 * kapalıysa (ör. parası yetmiyor) ışık sönüyor. Yoksa oyuncu Malikâne ile
 * Kışla arasında sonsuza kadar gidip gelirdi — basılabilir tek düğme onu
 * hep diğer ekrana yollardı.
 */
export interface RehberIsaret {
  /** Arayüzdeki `data-rehber` imzası. */
  isaret: string;
  /** Neden bu düğme. Verilmezse adımın kendi sözü kullanılır. */
  sebep?: string;
  /** İş yapmıyor, yalnız doğru ekrana götürüyor. */
  yol?: true;
}

/**
 * Hangi omurga adımında ışık hangi düğmeleri arar.
 *
 * Arayüzdeki düğmeler `data-rehber="<ad>"` ile imzalanıyor; ışık listeyi
 * baştan tarar ve BULUNAN VE BASILABİLİR ilk düğmeyi açıkta bırakır.
 *
 * Sıra öncelik değil KONUM: aynı anda hepsi ekranda olamaz. Liste ekranın
 * en derinindeki düğmeden başlar ve geriye doğru gider — "Saldır" yoksa
 * "Hepsi", o da yoksa Malikâne'deki omurga düğmesi, o da yoksa Malikâne
 * sekmesi. Böylece oyuncu hangi ekranda olursa olsun ışık onu adım adım
 * aynı düğmeye götürür ve zincir hiçbir yerde kopmaz.
 *
 * ── Neden yalnız iki adım ─────────────────────────────────────────────
 *
 * Işık sadece "ordunu kur" ve "saldır" adımlarında yanar; ilk döngünün
 * basılacak düğmesi olan iki adımı bunlar. "Askerlerin eğitiliyor" ya da
 * "ordun yolda" adımlarında yapılacak bir şey yok — orada ekranı karartmak
 * öğretmek değil, oyuncuyu hapsetmek olurdu.
 */
export const REHBER_ISIKLARI: Record<string, RehberIsaret[]> = {
  'ordu-kur': [
    {
      isaret: 'kisla-egit',
      sebep:
        'Bu düğme askerleri kışlaya yazdırır. Sayıyı senin için hazır seçtim — ' +
        'hedefi almaya yetecek kadarı bu.',
    },
    { isaret: 'omurga-dugme', yol: true },
    {
      isaret: 'nav-malikane',
      sebep: 'Yapılacak iş Malikâne\'de yazılı. Önce oraya dönelim lordum.',
      yol: true,
    },
  ],
  saldir: [
    {
      isaret: 'harita-saldir',
      sebep:
        'Bu düğme orduyu yola çıkarır. Geri dönüşü yok — ama hesabı yaptım, ' +
        'bu bölge senin olur.',
    },
    {
      isaret: 'harita-hepsi',
      sebep:
        'Önce kimi göndereceğini seç. "Hepsi" evdeki bütün askeri katar; ' +
        'ilk seferde orduyu bölmenin bir faydası yok.',
    },
    { isaret: 'omurga-dugme', yol: true },
    {
      isaret: 'nav-malikane',
      sebep: 'Yapılacak iş Malikâne\'de yazılı. Önce oraya dönelim lordum.',
      yol: true,
    },
  ],
};

/** Bir omurga adımında ışığın arayacağı işaretler; yoksa boş dizi. */
export function rehberIsigi(adim: string | null | undefined): RehberIsaret[] {
  if (!adim) return [];
  return REHBER_ISIKLARI[adim] ?? [];
}

/**
 * Aydınlatılan düğmenin yanında yazacak cümle.
 *
 * Düğmenin kendi sebebi yoksa adımın sözüne düşüyor: omurga düğmesi zaten
 * adımın ta kendisi, onun için ayrı bir cümle yazmak aynı şeyi iki kez
 * söylemek olurdu.
 */
export function rehberIsaretSebebi(
  adim: string | null | undefined,
  isaret: string,
): string | null {
  const kayit = rehberIsigi(adim).find((x) => x.isaret === isaret);
  return kayit?.sebep ?? rehberSozu(adim);
}
