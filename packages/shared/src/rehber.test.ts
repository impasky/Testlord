import { describe, expect, it } from 'vitest';
import { REHBER, rehberGorunsunMu, rehberSozleri, rehberSozu } from './rehber.js';
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

  it('oyuncu kapatınca susar — zorunlu tur değil', () => {
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
