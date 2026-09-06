import { describe, expect, it } from 'vitest';
import {
  REHBER,
  REHBER_ISIKLARI,
  REHBER_ASAMALARI,
  rehberAsamaDurumu,
  rehberGorunsunMu,
  rehberIlerlemesi,
  type RehberDurumu,
  rehberIsaretSebebi,
  rehberIsigi,
  rehberSozleri,
  rehberSozu,
} from './rehber.js';
import { ALT_SEKMELER, ANA_SEKME, EKRANLAR, KAPILAR, KAPI_ADI } from './types.js';
import { ipuclari, ipucuSec } from './ipuclari.js';
import { ilkEgitimMi, egitimSuresiSn } from './march.js';
import { B } from './balance.js';

describe('rehberin sözü', () => {
  it('her omurga adımı için tek cümle var', () => {
    for (const s of rehberSozleri()) {
      expect(s.soz.length).toBeGreaterThan(20);
      // Tek cümle: kâhya paragraf okumaz, oyuncunun şikâyeti zaten
      // "her yerde bir şeyler yazıyor" idi.
      expect(s.soz.length).toBeLessThan(200);
    }
  });

  it('aynı adım iki kez tanımlanmamış', () => {
    const adimlar = rehberSozleri().map((s) => s.adim);
    expect(new Set(adimlar).size).toBe(adimlar.length);
  });

  it('bilinmeyen adımda susuyor', () => {
    expect(rehberSozu('boyle-bir-adim-yok')).toBeNull();
    expect(rehberSozu(null)).toBeNull();
    expect(rehberSozu(undefined)).toBeNull();
  });

  it('oyunun ilk iki adımında konuşuyor', () => {
    expect(rehberSozu('ordu-kur')).toBeTruthy();
    expect(rehberSozu('saldir')).toBeTruthy();
  });

  /**
   * Sayılar `balance.json`'dan TÜRETİLMELİ. Kâhya "5 saniyede toplarım"
   * derken denge dosyası 30 diyorsa, oyun oyuncuya yalan söylüyor demektir.
   */
  it('süreler dengeden türüyor, elle yazılmamış', () => {
    expect(rehberSozu('ordu-kur')).toContain(String(B.ilk_egitim.saniye));
    expect(rehberSozu('ordu-yolda')).toContain(String(B.yuruyus.ilk_saldiri_dakika));
  });

  it('rehber portresi olan bir generali işaret ediyor', () => {
    expect(REHBER.key).toBe('kahya_sinan');
  });
});

/** Hiçbir şey yapmamış yeni lord. */
const yeniLord: RehberDurumu = {
  orduVar: false,
  bolgeSayisi: 0,
  kusanilanEkipman: 0,
  generalVar: false,
  gelismisBolgeVar: false,
  arastirmaBasladi: false,
};

/** Bütün aşamaları bitirmiş lord. */
const bitiren: RehberDurumu = {
  orduVar: true,
  bolgeSayisi: 1,
  kusanilanEkipman: 1,
  generalVar: true,
  gelismisBolgeVar: true,
  arastirmaBasladi: true,
};

describe('rehberin kapsadığı aşamalar', () => {
  it('aşama anahtarları benzersiz ve hepsinin adı var', () => {
    const anahtarlar = REHBER_ASAMALARI.map((a) => a.key);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
    for (const a of REHBER_ASAMALARI) expect(a.ad.length).toBeGreaterThan(4);
  });

  it('oyunun ana mekaniklerini kapsıyor', () => {
    // Eskiden tek aşama vardı (ilk bölge) ve tur oyunun altıda birini
    // gösterip bitiyordu. Dizilim saldırı aşamasının içinde öğretiliyor,
    // o yüzden ayrı bir aşama değil.
    const anahtarlar = REHBER_ASAMALARI.map((a) => a.key);
    for (const beklenen of ['ordu', 'bolge', 'ekipman', 'general', 'gelistir', 'arastirma']) {
      expect(anahtarlar).toContain(beklenen);
    }
  });

  it('yeni lordda hiçbir aşama bitmemiş', () => {
    expect(rehberIlerlemesi(yeniLord)).toEqual({ biten: 0, toplam: REHBER_ASAMALARI.length });
  });

  it('her aşama KENDİ koşuluyla kapanıyor', () => {
    // Bir alanı doğru aşamaya bağlamayı unutmak sessiz bir hata olurdu:
    // oyuncu bir şeyi yapar, tur ilerlemez.
    const tekil: [keyof RehberDurumu, string][] = [
      ['orduVar', 'ordu'],
      ['kusanilanEkipman', 'ekipman'],
      ['generalVar', 'general'],
      ['gelismisBolgeVar', 'gelistir'],
      ['arastirmaBasladi', 'arastirma'],
    ];
    for (const [alan, asama] of tekil) {
      const durum = { ...yeniLord, [alan]: alan === 'kusanilanEkipman' ? 1 : true };
      const biten = rehberAsamaDurumu(durum).filter((a) => a.bitti);
      expect(biten.map((a) => a.key)).toEqual([asama]);
    }
    const bolgeli = rehberAsamaDurumu({ ...yeniLord, bolgeSayisi: 1 }).filter((a) => a.bitti);
    expect(bolgeli.map((a) => a.key)).toEqual(['bolge']);
  });
});

describe('rehber ne zaman susar', () => {
  it('hiçbir şey yapmamış yeni lorda görünür', () => {
    expect(rehberGorunsunMu(yeniLord, false)).toBe(true);
  });

  /**
   * Eskiden ilk bölge alınınca susuyordu ve oyunun geri kalanı oyuncunun
   * kendi başına bulmasına kalıyordu — bulunmuyordu.
   */
  it('ilk bölge alınınca SUSMUYOR: tur daha bitmedi', () => {
    expect(rehberGorunsunMu({ ...yeniLord, orduVar: true, bolgeSayisi: 1 }, false)).toBe(true);
  });

  it('bütün aşamalar bitince susar', () => {
    expect(rehberGorunsunMu(bitiren, false)).toBe(false);
  });

  /**
   * Kapatma düğmesi YOK — oyuncu "öğretici ile zorunlu yaptırmayı ayır,
   * okusa da okumasa da yaptırmalı" dedi.
   */
  it('tamamlanmış damgası vurulmuş lorda susar', () => {
    expect(rehberGorunsunMu(yeniLord, true)).toBe(false);
  });

  /**
   * Damganın asıl işi bu: ordusunu ve bölgelerini savaşta kaybetmiş
   * kıdemli lord. Ölçüt tek başına duruma baksaydı, kaçış düğmesi de
   * olmadığı için kendini yeniden zorunlu turun içinde bulurdu.
   */
  it('her şeyini kaybeden KIDEMLİ lord zorunlu tura geri düşmez', () => {
    expect(rehberGorunsunMu(yeniLord, true)).toBe(false);
  });
});

describe('ilk eğitim kısayolu', () => {
  it('hiç askeri ve hiç eğitimi olmayan lorda geçerli', () => {
    expect(ilkEgitimMi(0, 0)).toBe(true);
  });

  it('ikinci eğitimde normal süreye dönülüyor', () => {
    expect(ilkEgitimMi(1, 10)).toBe(false);
  });

  /**
   * Asıl korunan hâl bu: ordusunu savaşta kaybetmiş kıdemli bir lord.
   * Tek başına "hiç eğitim yapmamış" koşulu ona da uyardı ve bedava ordu
   * verirdi; askeri olmama şartı kısayolu gerçekten ilk ana bağlıyor.
   */
  it('ordusu kırılmış kıdemli lorda GEÇERSİZ', () => {
    expect(ilkEgitimMi(40, 0)).toBe(false);
  });

  it('askeri olan ama kuyruğu boş lorda geçersiz', () => {
    expect(ilkEgitimMi(0, 25)).toBe(false);
  });

  it('kısayol dengedeki süreyi kullanıyor', () => {
    expect(egitimSuresiSn(90, 10, true)).toBe(B.ilk_egitim.saniye);
  });

  it('kısayol yokken adet ile çarpılıyor', () => {
    expect(egitimSuresiSn(90, 10, false)).toBe(900);
  });

  /**
   * Sıfır değil beş: anında biten kuyruk, kuyruk diye bir şey olduğunu
   * hiç öğretmiyor. Beş saniye hem sonucu aynı oturumda veriyor hem
   * "burada bir bekleme var" bilgisini bırakıyor.
   */
  it('kısayol sıfır değil — kuyruk kavramı yine öğreniliyor', () => {
    expect(B.ilk_egitim.saniye).toBeGreaterThan(0);
    expect(B.ilk_egitim.saniye).toBeLessThanOrEqual(15);
  });
});

describe('rehber ışığı', () => {
  it('yalnız basılacak düğmesi olan adımlarda yanıyor', () => {
    expect(rehberIsigi('ordu-kur').length).toBeGreaterThan(0);
    expect(rehberIsigi('saldir').length).toBeGreaterThan(0);
  });

  /**
   * Beklerken ekranı karartmak öğretmek değil hapsetmektir: "askerlerin
   * eğitiliyor" adımında basılacak bir düğme yok, oyuncu o sürede
   * gezinebilmeli.
   */
  it('bekleme adımlarında sönük', () => {
    expect(rehberIsigi('egitim-bekle')).toEqual([]);
    expect(rehberIsigi('ordu-yolda')).toEqual([]);
    expect(rehberIsigi('yarali')).toEqual([]);
  });

  it('bilinmeyen adımda ve adım yokken sönük', () => {
    expect(rehberIsigi('boyle-bir-adim-yok')).toEqual([]);
    expect(rehberIsigi(null)).toEqual([]);
    expect(rehberIsigi(undefined)).toEqual([]);
  });

  /**
   * TURUN ASIL SINAVI. Zorunlu turun bir aşaması varsa, ışığın o aşamada
   * gösterecek bir düğmesi de olmalı — yoksa "yaptıran" öğretici o
   * mekanikte yine "anlatan" öğreticiye düşer ve aşama listesinde kapanmayı
   * bekleyen bir satır kalır.
   */
  it('zorunlu turun HER aşamasında ışık yanıyor', () => {
    for (const a of REHBER_ASAMALARI) {
      expect(rehberIsigi(a.adim).length, a.key).toBeGreaterThan(0);
    }
  });

  it('her aşamanın kâhya cümlesi var', () => {
    for (const a of REHBER_ASAMALARI) {
      expect(rehberSozu(a.adim), a.key).toBeTruthy();
    }
  });

  it('ışığın yandığı her adım gerçek bir omurga adımı', () => {
    const adimlar = new Set(rehberSozleri().map((s) => s.adim));
    for (const a of Object.keys(REHBER_ISIKLARI)) expect(adimlar.has(a)).toBe(true);
  });

  /**
   * ZİNCİR KOPMASIN. Oyuncu ışık yanarken alâkasız bir ekranda olabilir
   * (ör. "saldır" adımındayken Demirhane'de). Orada listedeki hiçbir işaret
   * bulunmazsa perde kalkar ve "yaptıran öğretici" yine anlatan öğreticiye
   * döner. Son çare her zaman Malikâne sekmesi: o her ekranda duruyor ve
   * omurga düğmesinin bulunduğu tek yere götürüyor.
   */
  it('her zincir ANA SAYFA sekmesiyle bitiyor', () => {
    for (const liste of Object.values(REHBER_ISIKLARI)) {
      expect(liste[liste.length - 1]?.isaret).toBe('nav-ana');
    }
  });

  it('bir zincirde aynı işaret iki kez geçmiyor', () => {
    for (const liste of Object.values(REHBER_ISIKLARI)) {
      const adlar = liste.map((x) => x.isaret);
      expect(new Set(adlar).size).toBe(adlar.length);
    }
  });

  /**
   * Her zincirde en az bir İŞ düğmesi olmalı. Hepsi `yol` olsaydı ışık
   * oyuncuyu ekranlar arasında dolaştırır, hiçbir şey yaptırmazdı — ve
   * kilitlenmeye karşı emniyet ("iş düğmelerinin hepsi kapalıysa perde
   * kalksın") ölçecek bir şey bulamazdı.
   */
  it('her zincirde en az bir İŞ düğmesi var', () => {
    for (const liste of Object.values(REHBER_ISIKLARI)) {
      expect(liste.some((x) => !x.yol)).toBe(true);
    }
  });

  it('yalnız yol düğmeleri zincirin SONUNDA', () => {
    for (const liste of Object.values(REHBER_ISIKLARI)) {
      const ilkYol = liste.findIndex((x) => x.yol);
      if (ilkYol === -1) continue;
      // İlk yol düğmesinden sonra iş düğmesi gelmemeli: iş düğmeleri
      // ekranın derininde, yol düğmeleri yüzeyinde.
      expect(liste.slice(ilkYol).every((x) => x.yol)).toBe(true);
    }
  });

  /**
   * Sıra ekranın derininden yüzeyine doğru olmalı: en spesifik düğme
   * (Saldır) başta, en genel çıkış (Malikâne sekmesi) sonda. Ters sırada
   * ışık oyuncuyu zaten üstünde durduğu düğmeden alıp sekmeye yollardı.
   */
  it('saldırı zinciri seçimden düğmeye doğru sıralı', () => {
    expect(rehberIsigi('saldir').map((x) => x.isaret)).toEqual([
      'harita-saldir',
      'harita-hepsi',
      'omurga-dugme',
      'nav-ana',
    ]);
  });
});

/**
 * Oyuncunun ikinci geri dönüşü: "şuraya bas diyoruz ama neden bastığını
 * söylemiyoruz." Sebep aslında kâhyanın kartında yazıyordu ama kart
 * perdenin ALTINDA kalıyordu — yani ekrandaydı, görünmüyordu.
 */
describe('neden bu düğme', () => {
  it('aydınlatılan her düğmenin bir sebebi var', () => {
    for (const [adim, liste] of Object.entries(REHBER_ISIKLARI)) {
      for (const { isaret } of liste) {
        const sebep = rehberIsaretSebebi(adim, isaret);
        expect(sebep, `${adim}/${isaret}`).toBeTruthy();
        expect(sebep!.length, `${adim}/${isaret}`).toBeGreaterThan(20);
        // Tek cümlelik ölçü: oyuncunun ilk şikâyeti "her yerde bir şeyler
        // yazıyor" idi, perdenin üstüne paragraf koyamayız.
        expect(sebep!.length, `${adim}/${isaret}`).toBeLessThan(180);
      }
    }
  });

  /**
   * Ara düğmelerin KENDİ gerekçesi olmalı. "Hepsi" düğmesini adımın
   * cümlesiyle ("ordun hazır, saldır") açıklamak, sorulan soruyu
   * cevaplamamak olurdu: oyuncu neden ORAYA bastığını soruyor.
   */
  it('ara düğmeler adımın cümlesini tekrarlamıyor', () => {
    for (const [adim, liste] of Object.entries(REHBER_ISIKLARI)) {
      for (const { isaret, yol } of liste) {
        if (yol || isaret === 'omurga-dugme') continue;
        expect(rehberIsaretSebebi(adim, isaret)).not.toBe(rehberSozu(adim));
      }
    }
  });

  /**
   * Omurga düğmesinin sebebi adımın kendi sözü: o düğme zaten adımın ta
   * kendisi, ona ayrı bir cümle yazmak aynı şeyi iki kez söylemek olurdu.
   */
  it('omurga düğmesi adımın sözünü kullanıyor', () => {
    expect(rehberIsaretSebebi('ordu-kur', 'omurga-dugme')).toBe(rehberSozu('ordu-kur'));
    expect(rehberIsaretSebebi('saldir', 'omurga-dugme')).toBe(rehberSozu('saldir'));
  });

  it('bilinmeyen işarette adımın sözüne düşüyor', () => {
    expect(rehberIsaretSebebi('ordu-kur', 'boyle-bir-dugme-yok')).toBe(rehberSozu('ordu-kur'));
  });
});

describe('arayüz mimarisi — ana sayfa ve kapılar', () => {
  it('alt çubukta tam beş sekme var', () => {
    expect(ALT_SEKMELER.length).toBe(5);
  });

  /**
   * Ana sayfa ÇUBUĞUN BAŞINDA. Oyuncu oraya iniyor ve bütün kapılar orada;
   * ortada duran bir ana sayfa, "her şeye buradan erişilir" sözünü
   * görsel olarak da bozardı.
   */
  it('ana sayfa çubuğun ilk sekmesi', () => {
    expect(ALT_SEKMELER[0]).toBe(ANA_SEKME);
  });

  it('ana sayfa Lord', () => {
    expect(ANA_SEKME).toBe('lord');
  });

  /**
   * Hiçbir ekran kaybolmasın: eskiden sayfa olan her şey ya sekme ya kapı.
   * Bu kontrol olmadan bir ekran refaktör sırasında sessizce ulaşılamaz
   * hâle gelebilirdi.
   */
  it('her ekran ya sekme ya kapı — hiçbiri ortada kalmıyor', () => {
    const kapsanan = new Set<string>([...ALT_SEKMELER, ...KAPILAR]);
    for (const e of EKRANLAR) expect(kapsanan.has(e), e).toBe(true);
    expect(kapsanan.size).toBe(EKRANLAR.length);
  });

  it('bir ekran hem sekme hem kapı olamaz', () => {
    for (const k of KAPILAR) expect(ALT_SEKMELER).not.toContain(k as never);
  });

  it('her kapının bir adı var', () => {
    for (const k of KAPILAR) expect(KAPI_ADI[k].length).toBeGreaterThan(2);
  });

  /**
   * Kapı sayısının bir tavanı olmalı: ana sayfa bir simge duvarına
   * dönerse kaçtığımız menüye geri dönmüş oluruz.
   *
   * Sınır önce altıydı (iki satır, üçerli). Araştırma eklenince yediye
   * çıktı ve sayıyı büyütmeden önce şu soruldu: bu gerçekten ana sayfada
   * durması gereken bir sistem mi? Evet — araştırma oyuncunun diyarını
   * şekillendirdiği tek yer ve bir alt menüye gömülürse kimse bulmaz.
   *
   * Tavan dokuz: üçe üçlük ızgara hâlâ TEK BAKIŞTA taranıyor, kuralın
   * asıl amacı o. Dokuzdan sonrası duvar olur.
   */
  it('kapı sayısı taranabilir sınırda', () => {
    expect(KAPILAR.length).toBeLessThanOrEqual(9);
  });
});

describe('ipuçları', () => {
  it('en az altı ipucu var — aynı şey tekrarlanmasın', () => {
    expect(ipuclari().length).toBeGreaterThanOrEqual(6);
  });

  it('her ipucunun başlığı ve tek cümlesi var', () => {
    for (const i of ipuclari()) {
      expect(i.baslik.length).toBeGreaterThan(8);
      expect(i.metin.length).toBeGreaterThan(30);
      // Paragraf değil ipucu: oyuncunun şikâyeti "her yerde bir şeyler
      // yazıyor" idi.
      expect(i.metin.length).toBeLessThan(220);
    }
  });

  /**
   * Sayı geçen ipucu sayıyı DENGEDEN almalı. Elle yazılmış bir sayı denge
   * dosyası değişince sessizce yalana döner.
   */
  it('sayılar dengeden türüyor', () => {
    const hepsi = ipuclari()
      .map((i) => i.metin)
      .join(' ');
    expect(hepsi).toContain(String(B.korumalar.gunluk_saldiri_limiti));
    expect(hepsi).toContain(String(B.korumalar.yeni_oyuncu_saat));
    expect(hepsi).toContain(String(B.korumalar.bolge_ele_gecirme_sonrasi_saat));
  });

  it('sıradaki ipucu sırayla geliyor, rastgele değil', () => {
    const n = ipuclari().length;
    for (let i = 0; i < n; i++) expect(ipucuSec(i)).toEqual(ipuclari()[i]);
    // Başa dönüyor ve negatif sayaçta da patlamıyor.
    expect(ipucuSec(n)).toEqual(ipuclari()[0]);
    expect(ipucuSec(-1)).toEqual(ipuclari()[n - 1]);
  });
});
