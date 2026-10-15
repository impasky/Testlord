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
import { adiDenetle, bosLordAdi, lordAdiAnahtari, normalize } from './adDenetimi.js';
import { benzersizlikIhlali } from '../errors.js';

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

describe('lord adı benzersizlik anahtarı (docs/18)', () => {
  it('büyük/küçük harf, Türkçe I ve boşluk farkı aynı ad', () => {
    const k = lordAdiAnahtari('Işık Bey');
    for (const ad of [
      'IŞIK BEY',
      'ışık bey',
      '  Işık   Bey ',
      'İŞIK BEY',
      'isik bey'.replace('s', 'ş'),
    ]) {
      expect(lordAdiAnahtari(ad), ad).toBe(k);
    }
    expect(lordAdiAnahtari('Çağrı')).toBe('çağri');
    expect(lordAdiAnahtari('ALİ')).toBe(lordAdiAnahtari('Ali'));
  });

  it('benzer görünen ama farklı adlar ayrı kalıyor', () => {
    // 5→s gibi benzetmeler süzgecin işi; benzersizlikte "Ali5" ≠ "Alis".
    expect(lordAdiAnahtari('Ali5')).not.toBe(lordAdiAnahtari('Alis'));
    expect(lordAdiAnahtari('Ali Bey')).not.toBe(lordAdiAnahtari('AliBey'));
    expect(lordAdiAnahtari('Ali_Bey')).not.toBe(lordAdiAnahtari('Ali Bey'));
  });

  it('göçteki SQL ile aynı kural (örnekler göç denemesinden)', () => {
    // lower(translate(regexp_replace(btrim(name), '\s+', ' ', 'g'), 'İIıÇĞÖŞÜ', 'iiiçğöşü'))
    expect(lordAdiAnahtari('IŞIK BEY-0002')).toBe('işik bey-0002');
    expect(lordAdiAnahtari('ışık  bey-0003')).toBe('işik bey-0003');
  });

  it('boş ad: düz ad doluysa hükümdar sırası', async () => {
    const dolu = new Set([lordAdiAnahtari('Sungur Bey'), lordAdiAnahtari('Sungur Bey II')]);
    const alinmis = async (a: string) => dolu.has(a);
    expect(await bosLordAdi('Sungur Bey', alinmis)).toBe('Sungur Bey III');
    expect(await bosLordAdi('Aybüke Hatun', alinmis)).toBe('Aybüke Hatun');
    const hepsi = await bosLordAdi('X', async () => true);
    expect(hepsi).toMatch(/^X [0-9a-z]{4}$/);
  });

  it('benzersizlik ihlali: hangi alan', () => {
    expect(benzersizlikIhlali({ code: 'P2002', meta: { target: ['adAnahtari'] } })).toBe(
      'adAnahtari',
    );
    expect(benzersizlikIhlali({ code: 'P2002', meta: { target: 'User_email_key' } })).toBe('email');
    expect(benzersizlikIhlali({ code: 'P2025' })).toBeNull();
    expect(benzersizlikIhlali(new Error('x'))).toBeNull();
  });
});
