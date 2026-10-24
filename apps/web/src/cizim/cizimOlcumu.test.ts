import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CizimKaydi, UzunKare } from './cizimOlcumu';

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

  it('Hesap ekranından açılıyor (uygulamada adres çubuğu yok), cihazda kalıyor', async () => {
    const { m, depo } = await yukle('');
    expect(m.olcumAcik()).toBe(false);
    m.olcumuAc();
    expect(m.olcumAcik()).toBe(true);
    expect((await yukle('', depo)).m.olcumAcik()).toBe(true);
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

  it('takılma: kapalıyken kaydedilmiyor, açıkken ekran ekran özetleniyor', async () => {
    const kapali = await yukle('');
    kapali.m.takilmaKaydet({ tur: 'kare', sure: 120, ekran: 'Şehir', an: 0 });
    expect(kapali.m.takilmalar()).toHaveLength(0);

    const { m } = await yukle('?olcum=1');
    m.takilmaKaydet({ tur: 'kare', sure: 120, ekran: 'Şehir', an: 0 });
    m.takilmaKaydet({ tur: 'kare', sure: 340, ekran: 'Şehir', an: 1 });
    m.takilmaKaydet({ tur: 'gorev', sure: 90, ekran: 'Şehir', an: 2 });
    m.takilmaKaydet({ tur: 'gorev', sure: 60, ekran: 'Dünya', an: 3 });
    const izlenen = new Map([
      ['Şehir', { kare: 200, sure: 4000 }],
      ['Dünya', { kare: 100, sure: 1700 }],
      ['Lord', { kare: 50, sure: 840 }],
    ]);
    const o = m.takilmaOzeti(m.takilmalar(), izlenen);
    // En çok takılan önce; hiç takılmayan da listede (ölçüldü, temiz).
    expect(o.map((t) => t.ekran)).toEqual(['Şehir', 'Dünya', 'Lord']);
    expect(o[0]).toMatchObject({ kare: 200, takilma: 2, oran: 0.01, enUzunKare: 340, gorev: 1 });
    expect(o[1]).toMatchObject({ takilma: 0, gorev: 1, gorevToplam: 60 });
    expect(o[2]).toMatchObject({ takilma: 0, gorev: 0, oran: 0 });

    m.olcumuTemizle();
    expect(m.takilmalar()).toHaveLength(0);
  });

  it('uzun kare: nedeni karenin takılmasında; ana iş parçacığı tıkandıysa uzun görev de', async () => {
    const { m } = await yukle('?olcum=1');
    const uzun = (k: Partial<UzunKare>): UzunKare => ({
      name: 'long-animation-frame',
      entryType: 'long-animation-frame',
      startTime: 1000,
      duration: 600,
      styleAndLayoutStart: 1599,
      blockingDuration: 0,
      scripts: [],
      toJSON: () => ({}),
      ...k,
    });
    // Betik yok, stil 1 ms, tıkanma yok: kare GPU'yu ya da bileşikleyiciyi bekledi.
    m.takilmaKaydet({ tur: 'kare', sure: 600, ekran: 'Şehir', an: 1590 });
    m.uzunKareyiKaydet(uzun({}), 'Şehir');
    expect(m.takilmalar()).toHaveLength(1);
    expect(m.takilmalar()[0]?.neden).toBe('boşta 599 ms (GPU/bileşikleyici)');
    // Kısa bir uzun görev ve uzun bekleme: ikisi de yazılıyor.
    expect(
      m.uzunKareNedeni(
        uzun({
          duration: 588,
          styleAndLayoutStart: 1588,
          blockingDuration: 4,
          scripts: [
            {
              invoker: 'TimerHandler:setTimeout',
              sourceURL: 'https://lordlar.dev/assets/index-abc.js',
              sourceFunctionName: '',
              sourceCharPosition: 16742,
              duration: 54,
            },
          ],
        }),
      ),
    ).toBe(
      'betik 54 ms (TimerHandler:setTimeout index-abc.js:16742), boşta 534 ms (GPU/bileşikleyici)',
    );

    // Uzun betik: en uzunu, dosya adı sorgusuz; karenin dışındaki takılmaya yazılmıyor.
    m.takilmaKaydet({ tur: 'kare', sure: 80, ekran: 'Ordu', an: 1800 });
    m.takilmaKaydet({ tur: 'kare', sure: 600, ekran: 'Ordu', an: 2690 });
    m.uzunKareyiKaydet(
      uzun({
        startTime: 2100,
        styleAndLayoutStart: 2670,
        blockingDuration: 490,
        scripts: [
          {
            invoker: 'Worker.onmessage',
            sourceURL: '',
            sourceFunctionName: '',
            sourceCharPosition: -1,
            duration: 20,
          },
          {
            invoker: 'MessagePort.onmessage',
            sourceURL: 'https://lordlar.dev/assets/index-abc.js?v=1',
            sourceFunctionName: 'V',
            sourceCharPosition: 54403,
            duration: 540,
          },
        ],
      }),
      'Ordu',
    );
    const neden =
      'betik 540 ms (MessagePort.onmessage V index-abc.js:54403), betikler toplam 560 ms, stil+yerleşim 30 ms';
    const [, disari, kare, gorev] = m.takilmalar();
    expect(disari?.neden).toBeUndefined();
    expect(kare?.neden).toBe(neden);
    expect(gorev).toEqual({ tur: 'gorev', sure: 600, ekran: 'Ordu', an: 2100, neden });

    // Eşiği aşmayan kare sayılmıyor.
    m.uzunKareyiKaydet(uzun({ duration: 50, blockingDuration: 10 }), 'Ordu');
    expect(m.takilmalar()).toHaveLength(4);
  });

  it('açık ekran: sekme, üstünde açık panel varsa onun adıyla', async () => {
    const { m } = await yukle('?olcum=1');
    let paneller: { getAttribute: (a: string) => string | null }[] = [];
    vi.stubGlobal('document', {
      querySelector: () => ({ textContent: ' Akın ' }),
      querySelectorAll: () => paneller,
    });
    expect(m.acikEkran()).toBe('Akın');
    paneller = [{ getAttribute: () => 'Öğretici' }, { getAttribute: () => 'Sıralama' }];
    // En üstteki (en son) panel.
    expect(m.acikEkran()).toBe('Akın › Sıralama');
  });

  it('temizle: kayıtlar, takılmalar ve geçişler gidiyor, anı kalıyor', async () => {
    const { m } = await yukle('?olcum=1');
    expect(m.temizlenmeAni()).toBeNull();
    m.olcumKaydet(kayit({}));
    m.takilmaKaydet({ tur: 'kare', sure: 80, ekran: 'Şehir', an: 5 });
    m.olcumuTemizle();
    expect(m.olcumKayitlari()).toHaveLength(0);
    expect(m.takilmalar()).toHaveLength(0);
    expect(m.ekranGecisleri()).toHaveLength(0);
    expect(m.temizlenmeAni()).toBeGreaterThanOrEqual(0);
  });
});
