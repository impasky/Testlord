import { describe, expect, it } from 'vitest';
import { bekleyenMigrationlar, migrationKlasorleri } from './migrationDurumu';

const k = (ad: string, bitti = true, geriAlindi = false) => ({ ad, bitti, geriAlindi });

describe('bekleyen migration', () => {
  it('hepsi uygulanmışsa boş: CLI hiç başlamıyor', () => {
    expect(bekleyenMigrationlar(['a', 'b'], [k('a'), k('b')])).toEqual([]);
  });

  it('veritabanında olmayan yeni migration bekliyor', () => {
    expect(bekleyenMigrationlar(['a', 'b', 'c'], [k('a'), k('b')])).toEqual(['c']);
  });

  it('yarım kalmış ya da geri alınmış kayıt uygulanmış sayılmıyor: karar CLI’nın', () => {
    expect(bekleyenMigrationlar(['a', 'b'], [k('a', false), k('b', true, true)])).toEqual([
      'a',
      'b',
    ]);
  });

  it('boş veritabanında hepsi bekliyor', () => {
    expect(bekleyenMigrationlar(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('depodaki migration klasörleri okunuyor, kilit dosyası değil', () => {
    const klasorler = migrationKlasorleri(new URL('..', import.meta.url).pathname);
    expect(klasorler.length).toBeGreaterThan(10);
    expect(klasorler).not.toContain('migration_lock.toml');
    expect([...klasorler].sort()).toEqual(klasorler);
  });
});
