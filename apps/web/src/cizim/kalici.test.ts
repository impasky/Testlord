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

  /*
   * Sürüm yalnız çizimi belirleyen kaynaklardan (`vite-cizim-surumu.mjs`):
   * çizim kodu ve okuduğu tek ortak değerin kaynağı. Çizim dışarıdan yeni
   * bir şey okumaya başlarsa o kaynak özete girmeli, yoksa değişince
   * cihazdaki eski resim kalır. Bu test o anı yakalıyor.
   */
  it('çizim kodu dışarıdan yalnız özetteki kaynakları okuyor', () => {
    const kaynaklar = import.meta.glob<string>(['./*.ts', './*.tsx', '!./*.test.*'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const disaridan = new Set<string>();
    for (const kod of Object.values(kaynaklar)) {
      for (const [, adlar, yer] of kod.matchAll(
        /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g,
      )) {
        if (yer!.startsWith('./') || yer === 'react') continue;
        for (const a of adlar!.split(',').map((x: string) => x.trim().replace(/^type\s+/, '')))
          if (a) disaridan.add(`${yer} ${a}`);
      }
      for (const [, yer] of kod.matchAll(/from\s+'([^']+)'/g))
        if (!yer!.startsWith('./') && yer !== 'react' && yer !== '@lordlar/shared')
          disaridan.add(yer!);
    }
    // Yeni bir satır eklendiyse: kaynağını vite-cizim-surumu.mjs KAYNAKLAR'a ekle.
    expect([...disaridan].sort()).toEqual(['@lordlar/shared AKIN_YOL']);
  });
});
