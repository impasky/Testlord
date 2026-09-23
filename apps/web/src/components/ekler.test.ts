import { describe, expect, it } from 'vitest';
import { heceTireli } from './ekler';

const tireli = (m: string) => heceTireli(m).replaceAll('­', '-');

describe('heceTireli — araştırma kutularında kelime bölme', () => {
  it('hece sınırlarından böler', () => {
    expect(tireli('Değirmenler')).toBe('Değir-men-ler');
    expect(tireli('Mühendisliği')).toBe('Mühen-dis-liği');
    expect(tireli('Beytülhikme')).toBe('Bey-tül-hikme');
    expect(tireli('Rasathane')).toBe('Rasat-hane');
    expect(tireli('Menzilhaneler')).toBe('Men-zil-ha-ne-ler');
  });

  it('ünlüyle başlayan kelimede ilk heceyi korur', () => {
    expect(tireli('Ustalığı')).toBe('Usta-lığı');
  });

  it('yan yana iki ünlüyü ayırır', () => {
    expect(tireli('Tabiiyet')).toBe('Tabi-i-yet');
  });

  it('kısa kelimelere ve satır uçlarına dokunmaz', () => {
    expect(tireli('Sur Ustalığı')).toBe('Sur Usta-lığı');
    // Alt satıra bütün sığan kelime iki harflik parçaya bölünmez.
    expect(tireli('Tahıl Ambarları')).toBe('Tahıl Ambar-ları');
    expect(tireli('Divan')).toBe('Divan');
    // Kısa kopuş yok ("A-ra…", "…-rı"): satırın iki ucunda en az üç harf.
    expect(tireli('Arabacılık')).toBe('Ara-ba-cı-lık');
  });

  it('görünen metni değiştirmez, yalnız yumuşak tire ekler', () => {
    const m = 'Karşı Ağırlıklı Mancınık';
    expect(heceTireli(m).replaceAll('­', '')).toBe(m);
  });
});
