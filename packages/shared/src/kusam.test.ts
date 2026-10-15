import { describe, expect, it } from 'vitest';
import { kusamKodu, kusamSeviyesi } from './equipment';
import {
  KUSAM_PORTRESI,
  hazirPortreVarMi,
  kusamPortresiMi,
  profilResmiCoz,
  profilResmiSutunu,
} from './profil';

describe('kuşam kodu (docs/24 "Kuşam")', () => {
  it('altı yuva EQUIP_SLOTS sırasıyla; boş yuva 0', () => {
    expect(kusamKodu([])).toBe('000000');
    expect(
      kusamKodu([
        { slot: 'silah', tier: 3 },
        { slot: 'zirh', tier: 2 },
        { slot: 'sancak', tier: 5 },
      ]),
    ).toBe('302005');
  });

  it('kademe 0–5 aralığına sıkışıyor, bilinmeyen yuva sayılmıyor', () => {
    expect(kusamKodu([{ slot: 'silah', tier: 9 }])).toBe('500000');
    expect(kusamKodu([{ slot: 'yuzuk', tier: 4 }])).toBe('000000');
  });

  it('seviye (rozet) ortalamadan kalıyor', () => {
    const items = [{ slot: 'silah' as const, tier: 5 }];
    expect(kusamSeviyesi(items)).toBe(1);
    expect(kusamKodu(items)).toBe('500000');
  });
});

describe('Kuşamım portresi', () => {
  it('seçilebilir bir hazır portre', () => {
    expect(hazirPortreVarMi(KUSAM_PORTRESI)).toBe(true);
  });

  it('sütun kodu taşıyor ve çizilecek ada çözülüyor', () => {
    expect(profilResmiCoz('hazir:kusam:302005')).toEqual({ tur: 'hazir', key: 'giy-302005' });
    // Kodsuz ya da bozuk kod: çıplak kuşam, arma değil.
    expect(profilResmiCoz('hazir:kusam')).toEqual({ tur: 'hazir', key: 'giy-000000' });
    expect(profilResmiCoz('hazir:kusam:99')).toEqual({ tur: 'hazir', key: 'giy-000000' });
  });

  it('gidiş-dönüş: çözülen ad sütuna aynı kodla yazılıyor', () => {
    expect(profilResmiSutunu({ tur: 'hazir', key: 'giy-302005' })).toBe('hazir:kusam:302005');
    expect(profilResmiSutunu({ tur: 'hazir', key: 'kusam' })).toBe('hazir:kusam');
    expect(profilResmiSutunu({ tur: 'hazir', key: 'casus_leyla' })).toBe('hazir:casus_leyla');
  });

  it('seçici "Kuşamım"ı hem seçimde hem çözülmüş hâlde tanıyor', () => {
    expect(kusamPortresiMi('kusam')).toBe(true);
    expect(kusamPortresiMi('giy-123450')).toBe(true);
    expect(kusamPortresiMi('giy-6')).toBe(false);
    expect(kusamPortresiMi('lord_3')).toBe(false);
  });
});
