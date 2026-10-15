import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CizimKaydi } from './cizimOlcumu';

/** Bayrak modülde bir kez okunuyor: her durum için modül yeniden yükleniyor. */
async function yukle(adres: string, depo: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubGlobal('window', { location: { search: adres } });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => depo[k] ?? null,
    setItem: (k: string, v: string) => void (depo[k] = v),
    removeItem: (k: string) => void delete depo[k],
  });
  return { m: await import('./cizimOlcumu'), depo };
}

const kayit = (k: Partial<CizimKaydi>): CizimKaydi => ({
  anahtar: 'bina:kisla_3|a|136x136',
  piksel: 136 * 136,
  kaynak: 'cizim',
  taslak: false,
  toplam: 100,
  cizim: 80,
  kesilme: 0,
  bitti: 0,
  ...k,
});

afterEach(() => vi.unstubAllGlobals());

describe('telefonda çizim ölçümü', () => {
  it('kapalıyken hiçbir şey kaydedilmiyor', async () => {
    const { m } = await yukle('');
    expect(m.olcumAcik()).toBe(false);
    m.olcumKaydet(kayit({}));
    expect(m.olcumKayitlari()).toHaveLength(0);
  });

  it('?olcum=1 açıyor ve cihazda kalıyor; ?olcum=0 ve "kapat" kapatıyor', async () => {
    const { m, depo } = await yukle('?olcum=1');
    expect(m.olcumAcik()).toBe(true);
    // Adres temiz, cihazda açık.
    expect((await yukle('', depo)).m.olcumAcik()).toBe(true);
    expect((await yukle('?olcum=0', depo)).m.olcumAcik()).toBe(false);
    expect((await yukle('', depo)).m.olcumAcik()).toBe(false);
    const ikinci = await yukle('?olcum=1', depo);
    let haber = 0;
    ikinci.m.olcumuDinle(() => haber++);
    ikinci.m.olcumuKapat();
    expect(ikinci.m.olcumAcik()).toBe(false);
    expect(haber).toBe(1);
    expect((await yukle('', depo)).m.olcumAcik()).toBe(false);
  });

  it('depo kapalıyken yalnız adres', async () => {
    vi.resetModules();
    vi.stubGlobal('window', { location: { search: '?olcum=1' } });
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('kapalı');
      },
      setItem: () => {
        throw new Error('kapalı');
      },
    });
    const m = await import('./cizimOlcumu');
    expect(m.olcumAcik()).toBe(true);
  });

  it('kayıtlar sınırlı, dinleyiciye haber veriliyor', async () => {
    const { m } = await yukle('?olcum=1');
    let haber = 0;
    const birak = m.olcumuDinle(() => haber++);
    for (let i = 0; i < 305; i++) m.olcumKaydet(kayit({ toplam: i }));
    expect(m.olcumKayitlari()).toHaveLength(300);
    expect(m.olcumKayitlari()[0]?.toplam).toBe(5);
    expect(haber).toBe(305);
    birak();
    m.olcumuTemizle();
    expect(m.olcumKayitlari()).toHaveLength(0);
    expect(haber).toBe(305);
  });

  it('özet kaynağa göre ayırıyor; taslak çizimden ayrı', async () => {
    const { m } = await yukle('');
    const o = m.ozet([
      kayit({ kaynak: 'kayit', toplam: 10, cizim: 0 }),
      kayit({ toplam: 100, cizim: 60, kesilme: 2 }),
      kayit({ toplam: 300, cizim: 100 }),
      kayit({ taslak: true, toplam: 50, cizim: 50 }),
      kayit({ kaynak: 'yok', toplam: 5 }),
    ]);
    expect(o.kayit).toMatchObject({ sayi: 1, ortalama: 10 });
    expect(o.cizim).toMatchObject({ sayi: 2, ortalama: 200, enUzun: 300, cizimOrtalama: 80 });
    expect(o.taslak).toMatchObject({ sayi: 1, ortalama: 50 });
    expect(o.kesilme).toBe(2);
    expect(m.ozet([]).cizim).toMatchObject({ sayi: 0, ortalama: 0, enUzun: 0 });
  });

  it('kısa ad: ilk parça ve çıktı boyu', async () => {
    const { m } = await yukle('');
    expect(m.kisaAd('bina:kisla_3|g|1|136x136')).toBe('bina:kisla_3 136×136');
    expect(m.kisaAd('yerlesim:kamp|1344x1400|kaba')).toBe('yerlesim:kamp 1344×1400');
    expect(m.kisaAd('dunya:zemin')).toBe('dunya:zemin');
  });

  it('ölçülen deneme: süre ekleniyor, hata da sayılıyor', async () => {
    const { m } = await yukle('');
    const o = { cizim: 0, deneme: 0 };
    expect(await m.olcerek(o, async () => 7)).toBe(7);
    await expect(
      m.olcerek(o, async () => {
        throw new Error('kesildi');
      }),
    ).rejects.toThrow('kesildi');
    expect(o.deneme).toBe(2);
    expect(o.cizim).toBeGreaterThanOrEqual(0);
  });
});
