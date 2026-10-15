import { describe, expect, it } from 'vitest';
import {
  VARSAYILAN_TERCIH,
  bildirimGitsinMi,
  sessizMi,
  tercihiCoz,
  yerelSaat,
} from './bildirimTercihi';

describe('bildirim tercihleri', () => {
  it('bozuk ya da eski değer varsayılana düşüyor', () => {
    expect(tercihiCoz(null)).toEqual(VARSAYILAN_TERCIH);
    expect(tercihiCoz('x')).toEqual(VARSAYILAN_TERCIH);
    expect(tercihiCoz({ kapali: ['pazar', 'yok', 3] })).toEqual({
      kapali: ['pazar'],
      sessiz: null,
    });
    expect(tercihiCoz({ sessiz: { bas: 30, son: 2, dilim: 'Europe/Istanbul' } }).sessiz).toBeNull();
    expect(tercihiCoz({ sessiz: { bas: 1, son: 2, dilim: 'Mars/Olympus' } }).sessiz).toBeNull();
  });

  it('sessiz aralık gece yarısını aşabiliyor', () => {
    expect(sessizMi(23, 23, 8)).toBe(true);
    expect(sessizMi(3, 23, 8)).toBe(true);
    expect(sessizMi(8, 23, 8)).toBe(false);
    expect(sessizMi(12, 23, 8)).toBe(false);
    expect(sessizMi(14, 13, 15)).toBe(true);
    expect(sessizMi(15, 13, 15)).toBe(false);
    // Başı sonuna eşit: kapalı.
    expect(sessizMi(5, 5, 5)).toBe(false);
  });

  it('saat oyuncunun saat diliminde', () => {
    const an = new Date('2026-10-15T21:30:00Z');
    expect(yerelSaat(an, 'Europe/Istanbul')).toBe(0);
    expect(yerelSaat(an, 'UTC')).toBe(21);
    expect(yerelSaat(an, 'America/New_York')).toBe(17);
  });

  it('kapatılan konu gitmiyor; açık konu gidiyor', () => {
    const t = tercihiCoz({ kapali: ['pazar'] });
    expect(bildirimGitsinMi(t, 'pazar')).toBe(false);
    expect(bildirimGitsinMi(t, 'savas')).toBe(true);
  });

  it('sessiz saatte hiçbir konu gitmiyor, sonra gidiyor', () => {
    const t = tercihiCoz({ sessiz: { bas: 23, son: 8, dilim: 'Europe/Istanbul' } });
    // 00:30 İstanbul
    expect(bildirimGitsinMi(t, 'savas', new Date('2026-10-15T21:30:00Z'))).toBe(false);
    // 12:00 İstanbul
    expect(bildirimGitsinMi(t, 'savas', new Date('2026-10-15T09:00:00Z'))).toBe(true);
  });

  it('konusuz bildirim (deneme) her zaman gidiyor', () => {
    const t = tercihiCoz({
      kapali: ['savas', 'ordu', 'fetih', 'kuyruk', 'pazar'],
      sessiz: { bas: 0, son: 23, dilim: 'UTC' },
    });
    expect(bildirimGitsinMi(t, 'deneme', new Date('2026-10-15T05:00:00Z'))).toBe(true);
    expect(bildirimGitsinMi(t, undefined, new Date('2026-10-15T05:00:00Z'))).toBe(true);
  });
});
