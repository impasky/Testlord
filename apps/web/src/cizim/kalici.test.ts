import { describe, expect, it } from 'vitest';
import { kaliciOku, kaliciYaz } from './kalici';

/** Eklenti düz .mjs (tipi yok): değişkenle içe aktarılıyor. */
const EKLENTI = '../../vite-cizim-surumu.mjs';
type Eklenti = {
  transform: (kod: string, id: string) => { code: string } | null;
};

describe('kalıcı çizim deposu', () => {
  it('depo yoksa (test ortamı, gizli sekme) sessizce boş: okuma null, yazma hata vermiyor', async () => {
    expect(await kaliciOku('yok')).toBeNull();
    expect(() => kaliciYaz('yok', 'yok', { resim: new Blob() }, 'afis')).not.toThrow();
  });

  it('çizim sürümü: yalnız kalici.ts içinde, içerik özetiyle değiştiriliyor', async () => {
    const { cizimSurumu } = (await import(/* @vite-ignore */ EKLENTI)) as {
      cizimSurumu: () => Eklenti;
    };
    const e = cizimSurumu();
    const kod = 'const S = typeof __CIZIM_SURUMU__ === "string" ? __CIZIM_SURUMU__ : "x";';
    const sonuc = e.transform(kod, '/proje/apps/web/src/cizim/kalici.ts');
    expect(sonuc?.code).toMatch(/typeof "[0-9a-f]{12}" === "string" \? "[0-9a-f]{12}"/);
    // Aynı süreçte aynı özet (her dosya için yeniden hesaplanmıyor).
    expect(e.transform(kod, '/proje/apps/web/src/cizim/kalici.ts?v=2')?.code).toBe(sonuc?.code);
    // Başka dosyaya dokunmuyor.
    expect(e.transform(kod, '/proje/apps/web/src/cizim/gl.ts')).toBeNull();
  });
});
