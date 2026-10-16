/**
 * Adres seçimi ve ağ özeti.
 *
 * İkisi de sessizce yanlış olabilir: yanlış adres seçilirse giriş sınırı
 * herkese tek kova olur ya da istemci kendi adresini uydurur; yanlış ağ
 * anahtarı aynı evi iki ağ, iki evi tek ağ gösterir. Hiçbiri hata vermez.
 */
import { describe, expect, it } from 'vitest';
import { agAnahtari, agOzeti, ipSec } from './ag.js';

const URETIM = { uretim: true, baslik: 'cf-connecting-ip' };

describe('istemci adresi seçimi', () => {
  it('ayarlı başlık geçerliyse o', () => {
    expect(ipSec({ 'cf-connecting-ip': '203.0.113.7' }, '10.0.0.1', URETIM)).toEqual({
      ip: '203.0.113.7',
      baslikEksik: false,
    });
  });

  it('başlık yoksa ya da geçersizse bağlantı, eksik diye işaretli', () => {
    for (const deger of [undefined, '', 'uydurma', '203.0.113.7, 10.0.0.2']) {
      expect(ipSec({ 'cf-connecting-ip': deger }, '10.0.0.1', URETIM)).toEqual({
        ip: '10.0.0.1',
        baslikEksik: true,
      });
    }
  });

  it("X-Forwarded-For'un başı kendiliğinden güvenilmiyor", () => {
    // İstemci bunu kendi yazabiliyor; Render silmeden ekliyor.
    const b = { 'x-forwarded-for': '1.2.3.4, 203.0.113.7' };
    expect(ipSec(b, '10.0.0.1', { uretim: true }).ip).toBe('10.0.0.1');
  });

  it('test başlığı yalnız geliştirmede', () => {
    const b = { 'x-test-ip': '198.51.100.9', 'cf-connecting-ip': '203.0.113.7' };
    expect(ipSec(b, '10.0.0.1', { uretim: false, baslik: 'cf-connecting-ip' }).ip).toBe(
      '198.51.100.9',
    );
    expect(ipSec(b, '10.0.0.1', URETIM).ip).toBe('203.0.113.7');
    expect(ipSec({ 'x-test-ip': '198.51.100.9' }, '10.0.0.1', { uretim: true }).ip).toBe(
      '10.0.0.1',
    );
  });
});

describe('ağ anahtarı', () => {
  it('IPv4 adresin tamamı; eşlenik biçim aynı ağ', () => {
    expect(agAnahtari('203.0.113.7')).toBe('4:203.0.113.7');
    expect(agAnahtari('::ffff:203.0.113.7')).toBe('4:203.0.113.7');
  });

  it('IPv6 ilk 64 bit: aynı evin cihazları aynı ağ', () => {
    const a = agAnahtari('2001:db8:aa:1:1111:2222:3333:4444');
    expect(a).toBe('6:2001:0db8:00aa:0001');
    expect(agAnahtari('2001:db8:aa:1::5')).toBe(a);
    expect(agAnahtari('2001:DB8:AA:1:abcd::1')).toBe(a);
    expect(agAnahtari('2001:db8:aa:2::5')).not.toBe(a);
    expect(agAnahtari('::1')).toBe('6:0000:0000:0000:0000');
    expect(agAnahtari('fe80::1%eth0')).toBe('6:fe80:0000:0000:0000');
  });

  it('geçersiz adres iz bırakmıyor', () => {
    for (const x of ['', 'yok', '1.2.3', '2001:db8::1::2', '1:2:3:4:5:6:7:8:9']) {
      expect(agAnahtari(x)).toBeNull();
    }
  });
});

describe('ağ özeti', () => {
  it('aynı ağ aynı özet, anahtar değişince bambaşka', () => {
    const o = agOzeti('203.0.113.7', 'a'.repeat(32));
    expect(o).toMatch(/^[0-9a-f]{16}$/);
    expect(agOzeti('::ffff:203.0.113.7', 'a'.repeat(32))).toBe(o);
    expect(agOzeti('203.0.113.8', 'a'.repeat(32))).not.toBe(o);
    expect(agOzeti('203.0.113.7', 'b'.repeat(32))).not.toBe(o);
    expect(agOzeti('yok', 'a'.repeat(32))).toBeNull();
  });

  it('özet adresi içermiyor', () => {
    expect(agOzeti('203.0.113.7', 'a'.repeat(32))).not.toContain('203');
  });
});
