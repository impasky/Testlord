import { describe, expect, it } from 'vitest';
import {
  REHBER,
  REHBER_ISIKLARI,
  rehberGorunsunMu,
  rehberIsaretSebebi,
  rehberIsigi,
  rehberSozleri,
  rehberSozu,
} from './rehber.js';
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

describe('rehber ne zaman susar', () => {
  it('bölgesi olmayan yeni lorda görünür', () => {
    expect(rehberGorunsunMu(0, false)).toBe(true);
  });

  /**
   * Ölçüt DÖNGÜNÜN KAPANMASI. Adım sayısı ya da geçen süre yanlış ölçüt
   * olurdu: yirmi dakika gezinip hiçbir şey yapmamış oyuncunun rehbere
   * hâlâ ihtiyacı var, iki dakikada bölge alanınki yok.
   */
  it('ilk bölge alınınca susar', () => {
    expect(rehberGorunsunMu(1, false)).toBe(false);
  });

  /**
   * Kapatma düğmesi YOK — oyuncu "öğretici ile zorunlu yaptırmayı ayır,
   * okusa da okumasa da yaptırmalı" dedi. Bayrağın tek yazarı oyunun
   * kendisi: ilk bölge alınınca damga vuruluyor.
   */
  it('tamamlanmış sayılan lorda susar', () => {
    expect(rehberGorunsunMu(0, true)).toBe(false);
  });

  /**
   * Damganın asıl işi bu: bölgelerini savaşta kaybetmiş kıdemli lord.
   * Ölçüt tek başına "bölgesi yok" olsaydı, kaçış düğmesi de olmadığı için
   * kendini yeniden zorunlu turun içinde bulurdu.
   */
  it('bölgelerini kaybeden KIDEMLİ lord zorunlu tura geri düşmez', () => {
    expect(rehberGorunsunMu(0, true)).toBe(false);
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
  it('her zincir Malikâne sekmesiyle bitiyor', () => {
    for (const liste of Object.values(REHBER_ISIKLARI)) {
      expect(liste[liste.length - 1]?.isaret).toBe('nav-malikane');
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
      'nav-malikane',
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
