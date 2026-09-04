/**
 * Ad denetimi testi.
 *
 * Süzgecin iki yönü de kilitli: küfrü eliyor VE masum adı elemiyor.
 * İkincisi tesadüfen yazılmadı — süzgeç kısa parçaları ("aq", "pic") adın
 * her yerinde arıyordu ve "Aquila", "Şaqir", "Picasso" gibi meşru adları
 * reddediyordu. Bir ad süzgeci ancak yanlış pozitifleri de ölçülürse
 * güvenilir.
 */
import { describe, expect, it } from 'vitest';
import { adiDenetle, normalize } from './adDenetimi.js';

describe('ad denetimi — eleyeceklerini eliyor', () => {
  it('açık küfrü eliyor', () => {
    for (const ad of ['orospu', 'Siktir git', 'amk', 'aq', 'Kral amk', 'yarrak']) {
      expect(adiDenetle(ad).uygun, ad).toBe(false);
    }
  });

  it('araya karakter sıkıştırmak kurtarmıyor', () => {
    // normalize'ın bütün işi bu: "5ik1ş" -> "sikis".
    for (const ad of ['s1kt1r', 'a.m.k', '0r0spu']) {
      expect(adiDenetle(ad).uygun, ad).toBe(false);
    }
  });

  it('ayrılmış adlar alınamıyor', () => {
    expect(adiDenetle('admin').uygun).toBe(false);
    expect(adiDenetle('Sistem Yoneticisi').uygun).toBe(false);
  });

  it('çok kısa ve tekrarlı adlar eleniyor', () => {
    expect(adiDenetle('ab').uygun).toBe(false);
    expect(adiDenetle('aaaaaaa').uygun).toBe(false);
  });
});

describe('ad denetimi — MASUM adı elemiyor', () => {
  it('"aq" içeren meşru adlar geçiyor', () => {
    // Aquila heraldikte kartal: bu oyuna birebir yakışan bir ad ve
    // süzgeç onu reddediyordu.
    for (const ad of ['Aquila', 'Şaqir', 'Jaqueline', 'Aqua', 'Tarquin']) {
      expect(adiDenetle(ad).uygun, ad).toBe(true);
    }
  });

  it('"pic" içeren meşru adlar geçiyor', () => {
    for (const ad of ['Picasso', 'Picard', 'Epic Lord']) {
      expect(adiDenetle(ad).uygun, ad).toBe(true);
    }
  });

  it('sıradan Türkçe adlar geçiyor', () => {
    for (const ad of ['Kara Yusuf', 'Demirhan', 'Şahin Bey', 'Gökçe', 'Çağrı']) {
      expect(adiDenetle(ad).uygun, ad).toBe(true);
    }
  });

  it('normalize Türkçe harfleri sadeleştiriyor', () => {
    expect(normalize('Şahin Bey')).toBe('sahinbey');
    expect(normalize('Çağrı')).toBe('cagri');
  });
});
