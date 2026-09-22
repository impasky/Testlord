/**
 * Ölü abonelik silinmeli, geçici hata silinMEmeli.
 *
 * İkisi de sessiz kusur: yanlış yönde bir karar aylarca fark edilmez.
 * Silmemek push servisinin bütün bildirimlerimizi engellemesiyle biter;
 * fazla silmek oyuncunun aboneliğini ekranda "açık" yazarken sessizce
 * kaybetmesiyle.
 */
import { describe, expect, it } from 'vitest';
import { gonderimKarari, pushAdresiGecerli } from './pushPolitika.js';

describe('push gönderim kararı', () => {
  it('abonelik gerçekten bittiyse siliniyor', () => {
    expect(gonderimKarari(404)).toBe('sil');
    expect(gonderimKarari(410)).toBe('sil');
  });

  it('geçici hatalarda abonelik korunuyor', () => {
    // 429: hız sınırı. 500/502/503: servis sorunu. Hepsi geçici.
    for (const durum of [429, 500, 502, 503, 504]) {
      expect(gonderimKarari(durum), `durum ${durum}`).toBe('gunlukle');
    }
  });

  it('durum kodu olmayan hata (ağ, TLS) abonelik silmiyor', () => {
    // En sinsi hâl: ağ kesintisinde durum kodu hiç gelmiyor. Burada
    // silmek, bir dakikalık kesintide bütün aboneleri kaybetmek demek.
    expect(gonderimKarari(undefined)).toBe('gunlukle');
  });

  it('401/403 de abonelik silmiyor — sorun bizim anahtarımızda', () => {
    // VAPID anahtarı yanlışsa her abone 403 alır. Silmek, yapılandırma
    // hatasını veri kaybına çevirirdi.
    expect(gonderimKarari(401)).toBe('gunlukle');
    expect(gonderimKarari(403)).toBe('gunlukle');
  });
});

describe('push abonelik adresi (SSRF)', () => {
  it('bilinen push servisleri kabul ediliyor', () => {
    for (const a of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) {
      expect(pushAdresiGecerli(a, true), a).toBe(true);
    }
  });

  it('iç ağ, düz HTTP ve yabancı adresler reddediliyor', () => {
    for (const a of [
      'http://169.254.169.254/latest/meta-data/',
      'https://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:5432/x',
      'https://localhost/x',
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://fcm.googleapis.com:8443/fcm/send/abc',
      'https://kotu.ornek.com/x',
      'https://fcm.googleapis.com.kotu.com/x',
      'https://kullanici:parola@fcm.googleapis.com/x',
      'bu-bir-adres-degil',
    ]) {
      expect(pushAdresiGecerli(a, true), a).toBe(false);
    }
  });

  it('.test yalnız geliştirmede', () => {
    expect(pushAdresiGecerli('https://push.gecersiz.test/x', false)).toBe(true);
    expect(pushAdresiGecerli('https://push.gecersiz.test/x', true)).toBe(false);
  });
});
