import { describe, expect, it } from 'vitest';
import { haritaGorunumuOku } from './haritaGorunumu';

describe('haritanın saklı görünümü', () => {
  it('geçerli değer okunuyor; bozuk, eksik ya da sınır dışı olan yok sayılıyor', () => {
    const oku = (v: unknown) => haritaGorunumuOku(JSON.stringify(v), 4.5);
    expect(oku({ k: 3.2, merkez: [41.5, 63] })).toEqual({ k: 3.2, merkez: [41.5, 63] });
    expect(haritaGorunumuOku(null, 4.5)).toBeNull();
    expect(haritaGorunumuOku('{bozuk', 4.5)).toBeNull();
    expect(oku({ k: 2 })).toBeNull();
    expect(oku({ k: '2', merkez: [50, 50] })).toBeNull();
    expect(oku({ k: 0, merkez: [50, 50] })).toBeNull();
    expect(oku({ k: 5, merkez: [50, 50] })).toBeNull();
    expect(oku({ k: 2, merkez: [120, 50] })).toBeNull();
    expect(oku({ k: 2, merkez: [50, null] })).toBeNull();
  });
});
