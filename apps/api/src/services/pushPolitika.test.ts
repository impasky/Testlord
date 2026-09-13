/**
 * Ölü abonelik silinmeli, geçici hata silinMEmeli.
 *
 * İkisi de sessiz kusur: yanlış yönde bir karar aylarca fark edilmez.
 * Silmemek push servisinin bütün bildirimlerimizi engellemesiyle biter;
 * fazla silmek oyuncunun aboneliğini ekranda "açık" yazarken sessizce
 * kaybetmesiyle.
 */
import { describe, expect, it } from 'vitest';
import { gonderimKarari } from './pushPolitika.js';

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
