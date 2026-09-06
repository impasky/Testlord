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
      adim: 'depo',
      soz:
        'Ambarlar taştı lordum — bu saatten sonra ürettiğimiz her şey yere dökülüyor. ' +
        'Depoyu büyütmeden biriktirmenin anlamı yok.',
    },
    {
      adim: 'bolge-gelistir',
      soz:
        'Toprağı çoğaltmak tek yol değil. Elindekini yükselt: aynı bölge daha çok ' +
        'verir, üstelik saldırana da daha pahalıya patlar.',
    },
    {
      adim: 'arastirma',
      soz:
        'Şimdi diyarını kendine benzetme vakti. Araştırma kalıcıdır — iki lord aynı ' +
        'seviyede olsa bile aynı olmaz.',
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

/* ---------------- Rehberin kapsadığı aşamalar ---------------- */

/**
 * Zorunlu turun oyuncuya YAPTIRDIĞI şeyler.
 *
 * Önceden tek aşama vardı ve rehber ilk bölge alınınca kapanıyordu:
 * kaynak → asker → saldırı → bölge. Oyunun geri kalanı — dizilim,
 * ekipman, general, bölge geliştirme, araştırma — oyuncunun kendi
 * başına bulmasına bırakılmıştı ve bulunmuyordu.
 *
 * Her aşamanın tamamlanması OYUN DURUMUNDAN türetiliyor, sayaçla değil.
 * Sebep bu dosyanın en başındaki ilkeyle aynı: sayaç tutan bir senaryo
 * ile gerçek durum er ya da geç ayrışır ve öğretici "şimdi asker eğit"
 * derken oyuncunun zaten askeri olur.
 *
 * Sıra, omurganın kendi sırasıyla aynı — rehber omurganın üstüne biniyor,
 * onu yönetmiyor.
 */
export interface RehberAsamasi {
  key: string;
  /** Aşama listesinde görünen kısa ad. */
  ad: string;
  /**
   * Bu aşamayı kapatan OMURGA adımı.
   *
   * Rehberin omurganın üstüne bindiği yer tam burası: aşama, omurganın
   * uğradığı bir adımla kapanmıyorsa oyuncu oraya hiç yönlendirilmiyor
   * demektir — yani tur o mekaniği "kapsıyor" görünüp aslında
   * öğretmiyordur. Bağ yazılı olduğu için sınanabiliyor.
   */
  adim: string;
}

export const REHBER_ASAMALARI: RehberAsamasi[] = [
  { key: 'ordu', ad: 'Ordunu kur', adim: 'ordu-kur' },
  { key: 'bolge', ad: 'İlk bölgeni al', adim: 'saldir' },
  { key: 'ekipman', ad: 'Ekipman kuşan', adim: 'ekipman' },
  { key: 'general', ad: 'General kirala', adim: 'general' },
  { key: 'gelistir', ad: 'Bölgeni geliştir', adim: 'bolge-gelistir' },
  { key: 'arastirma', ad: 'Araştırma başlat', adim: 'arastirma' },
];

/** Rehberin bitip bitmediğini belirleyen oyun durumu. */
export interface RehberDurumu {
  /** Evde ya da yolda askeri var mı (kuyruktakiler dahil). */
  orduVar: boolean;
  bolgeSayisi: number;
  kusanilanEkipman: number;
  generalVar: boolean;
  /** Herhangi bir bölgesi 1. seviyenin üstünde mi. */
  gelismisBolgeVar: boolean;
  /** Bir araştırma bitmiş ya da sürüyor mu. */
  arastirmaBasladi: boolean;
}

/** Hangi aşamalar bitti. Sıra REHBER_ASAMALARI ile aynı. */
export function rehberAsamaDurumu(d: RehberDurumu): { key: string; ad: string; bitti: boolean }[] {
  const bitti: Record<string, boolean> = {
    ordu: d.orduVar,
    bolge: d.bolgeSayisi > 0,
    ekipman: d.kusanilanEkipman > 0,
    general: d.generalVar,
    gelistir: d.gelismisBolgeVar,
    arastirma: d.arastirmaBasladi,
  };
  return REHBER_ASAMALARI.map((a) => ({ ...a, bitti: bitti[a.key] === true }));
}

export function rehberIlerlemesi(d: RehberDurumu): { biten: number; toplam: number } {
  const durumlar = rehberAsamaDurumu(d);
  return { biten: durumlar.filter((x) => x.bitti).length, toplam: durumlar.length };
}

/**
 * Rehber hâlâ görünsün mü?
 *
 * Ölçüt BÜTÜN AŞAMALARIN kapanması. Eskiden ilk bölgeye bakıyordu ve tur
 * oyunun altıda birini gösterip bitiyordu.
 *
 * `tamamlandi` ise hesabın kalıcı kaydı (`Lord.rehberBittiAt`). İki işi
 * var:
 *
 *  - Rehber ZORUNLU: kapatma düğmesi yok. Oyuncu sekiz sayfalık tanıtımı
 *    okusa da okumasa da, geçse de geçmese de, elinden tutulan bu bölümü
 *    yapıyor. İki şey ayrı: biri ANLATIYOR, öbürü YAPTIRIYOR; birini
 *    atlamak öbürünü atlamak değil.
 *
 *  - Kayıt olmasaydı ölçüt tek başına duruma bakardı ve ordusunu savaşta
 *    kaybetmiş KIDEMLİ bir lord kendini yeniden zorunlu turun içinde
 *    bulurdu. Damga bir kez konur, bir daha dönmez.
 */
export function rehberGorunsunMu(durum: RehberDurumu, tamamlandi: boolean): boolean {
  if (tamamlandi) return false;
  return rehberAsamaDurumu(durum).some((a) => !a.bitti);
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
 * kapalıysa (ör. parası yetmiyor) ışık sönüyor. Yoksa oyuncu ana sayfa ile
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
 * ── Hangi adımlarda yanar ─────────────────────────────────────────────
 *
 * Zorunlu turun BÜTÜN aşamalarında (`REHBER_ASAMALARI`): ordu, bölge,
 * ekipman, general, bölge geliştirme, araştırma. Işık eskiden yalnız ilk
 * ikisinde yanıyordu ve tur oyunun altıda birini gösterip bitiyordu.
 *
 * Yanmadığı yerler kasıtlı: "askerlerin eğitiliyor", "ordun yolda" gibi
 * adımlarda basılacak bir düğme YOK. Orada ekranı karartmak öğretmek
 * değil, oyuncuyu hapsetmek olurdu — bekleme adımlarının kendi kuralı
 * aşağıda (`REHBER_BEKLEYISLERI`).
 *
 * Kapı adımlarının (`demirhane`, `generaller`, `arastirma`) zinciri üç
 * halkalı: kapının içindeki İŞ düğmesi → onu açan omurga düğmesi → ana
 * sayfa sekmesi. Kapılar sekme değil, ana sayfadan açılan panel; ışık o
 * yüzden oyuncuyu önce ana sayfaya, oradan kapıya götürüyor.
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
      isaret: 'nav-ana',
      sebep: 'Yapılacak iş ana sayfada yazılı. Önce oraya dönelim lordum.',
      yol: true,
    },
  ],
  ekipman: [
    {
      isaret: 'demirhane-kusan',
      sebep:
        'Bu parçayı kuşan. Ekipman ordunun sayısını değil, senin savaşa kattığın ' +
        'gücü büyütür — aynı orduyla daha sert vurursun.',
    },
    { isaret: 'omurga-dugme', yol: true },
    {
      isaret: 'nav-ana',
      sebep: 'Demirhanenin girişi ana sayfada lordum. Önce oraya dönelim.',
      yol: true,
    },
  ],
  general: [
    {
      isaret: 'general-kirala',
      sebep:
        'Bunu kirala. General tek bir askeri değil ORDUNUN KURALLARINI değiştirir; ' +
        'bir generalin etkisi bütün birliklerine birden işler.',
    },
    { isaret: 'omurga-dugme', yol: true },
    {
      isaret: 'nav-ana',
      sebep: 'Generallerin listesi ana sayfada duruyor. Önce oraya dönelim lordum.',
      yol: true,
    },
  ],
  'bolge-gelistir': [
    {
      isaret: 'bolge-yukselt',
      sebep:
        'Bölgeyi yükselt. Aynı toprak daha çok verir, üstelik savunması da artar — ' +
        'yeni yer almadan güçlenmenin yolu bu.',
    },
    { isaret: 'omurga-dugme', yol: true },
    {
      isaret: 'nav-ana',
      sebep: 'Bölgeni haritadan açacağız; yol ana sayfadaki adımdan geçiyor.',
      yol: true,
    },
  ],
  arastirma: [
    {
      isaret: 'arastirma-baslat',
      sebep:
        'Bunu başlat. Hangisini seçtiğin senin kararın — araştırma kalıcıdır ve ' +
        'diyarını başka lordlarınkinden ayıran tek katman odur.',
    },
    { isaret: 'omurga-dugme', yol: true },
    {
      isaret: 'nav-ana',
      sebep: 'Araştırmanın girişi ana sayfada. Önce oraya dönelim lordum.',
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
      isaret: 'nav-ana',
      sebep: 'Yapılacak iş ana sayfada yazılı. Önce oraya dönelim lordum.',
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
export function rehberIsaretSebebi(adim: string | null | undefined, isaret: string): string | null {
  const kayit = rehberIsigi(adim).find((x) => x.isaret === isaret);
  return kayit?.sebep ?? rehberSozu(adim);
}

/* ---------------- Rehberin beklettiği anlar ---------------- */

/**
 * Oyuncunun basacak bir düğmesi olmadığı, sadece BEKLEDİĞİ adımlar.
 *
 * Oyuncu turu bir bütün olarak istedi:
 *
 *   "oyuncu tam bir eğitim turunu tamamlayana kadar harici işlem
 *    yapamasın. Eğit dedi, o zaman eğitim tamamlanana kadar geçilemesin
 *    ve Kâhya Sinan desin ki askerleriniz eğitiliyor, ve bekletsin
 *    oyuncuyu."
 *
 * Önceden bu adımda ışık sönüyordu (basılacak düğme yok) ve oyuncu
 * serbest kalıyordu; tur da tam orada, sonucu görmeden kopuyordu.
 *
 * ── Neden yalnız eğitim ───────────────────────────────────────────────
 *
 * İlk eğitim `ilk_egitim.saniye` kadar sürüyor — beş saniye. Bir oyuncuyu
 * beş saniye tutmak bekletmek değil, sonucu göstermek. "Ordun yolda"
 * adımı ise `ilk_saldiri_dakika` kadar, yani dakikalar: orada ekranı
 * karartmak öğretmek değil hapsetmek olurdu, üstelik oyun o sürede
 * yapılacak başka şeyler öneriyor.
 *
 * `azamiSaniye` emniyet supabı: kalan süre bundan uzunsa oyuncu
 * tutulmuyor. İlk eğitim kısayolu bir şekilde devreye girmemişse (ör.
 * oyuncu kendi başına uzun bir kuyruk açtıysa) kimseyi kara ekranda
 * dakikalarca bekletmeyelim.
 */
export const REHBER_BEKLEYISLERI: Record<string, { soz: string; azamiSaniye: number }> = {
  'egitim-bekle': {
    soz: 'Askerlerin eğitiliyor lordum. Şuracıkta bekle, bittiğinde haber vereceğim.',
    azamiSaniye: 90,
  },
};

/** Bu adımda oyuncu bekletilmeli mi; bekletilecekse kâhya ne der. */
export function rehberBeklemesi(
  adim: string | null | undefined,
): { soz: string; azamiSaniye: number } | null {
  if (!adim) return null;
  return REHBER_BEKLEYISLERI[adim] ?? null;
}
