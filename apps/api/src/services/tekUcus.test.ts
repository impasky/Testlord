import { describe, expect, it } from 'vitest';
import { tekUcus, ucustakiSayisi, yazmaSiniri } from './tekUcus';

/** Elle bitirilen iş: ne zaman çözüleceğine test karar veriyor. */
function bekleyenIs<T>() {
  let coz!: (v: T) => void;
  let kosma = 0;
  const p = new Promise<T>((r) => (coz = r));
  return {
    is: () => {
      kosma++;
      return p;
    },
    coz: (v: T) => coz(v),
    sayi: () => kosma,
  };
}

describe('tek uçuş', () => {
  it('aynı anda gelen istekler tek işi paylaşıyor', async () => {
    const i = bekleyenIs<number>();
    const a = tekUcus('k1', i.is);
    const b = tekUcus('k1', i.is);
    i.coz(7);
    expect(await Promise.all([a, b])).toEqual([7, 7]);
    expect(i.sayi()).toBe(1);
  });

  it('biten iş saklanmıyor: sonraki istek yeniden koşuyor', async () => {
    let n = 0;
    expect(await tekUcus('k2', async () => ++n)).toBe(1);
    expect(await tekUcus('k2', async () => ++n)).toBe(2);
    expect(ucustakiSayisi()).toBe(0);
  });

  it('arada yazma başladıysa uçuştaki işe katılınmıyor', async () => {
    const eski = bekleyenIs<string>();
    const a = tekUcus('k3', eski.is);
    yazmaSiniri();
    const b = tekUcus('k3', async () => 'taze');
    eski.coz('eski');
    expect(await a).toBe('eski');
    expect(await b).toBe('taze');
  });

  it('hata da paylaşılıyor ve kayıt temizleniyor', async () => {
    const a = tekUcus('k4', () => Promise.reject(new Error('yok')));
    const b = tekUcus('k4', async () => 'hiç koşmamalı');
    await expect(a).rejects.toThrow('yok');
    await expect(b).rejects.toThrow('yok');
    expect(ucustakiSayisi()).toBe(0);
  });

  it('farklı anahtarlar birbirine karışmıyor', async () => {
    expect(await Promise.all([tekUcus('x', async () => 1), tekUcus('y', async () => 2)])).toEqual([
      1, 2,
    ]);
  });
});
