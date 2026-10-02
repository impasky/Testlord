/**
 * ÇİZİM SÜRÜMÜ — kalıcı çizim deposunun (`src/cizim/kalici.ts`) anahtarı.
 *
 * Yerleşkenin GPU resimleri cihazda saklanıyor: uygulama açılınca yeniden
 * çizilmeden geliyor. Saklanan resim onu çizen kodun ve verinin ürünü;
 * çizim kodu ya da veri değişince eski resim yanlış olur (eski çatı, eski
 * renk). Sürüm bu yüzden elle artırılan bir sayı değil, çizimi belirleyen
 * dosyaların İÇERİK ÖZETİ: `src/cizim` (testler hariç), `data/*.json` ve
 * `packages/shared/src`. Biri değişince sürüm değişiyor, eski kayıtlar
 * okunmuyor. Elle artırılan sayı unutulurdu.
 *
 * Özet `kalici.ts` içindeki `__CIZIM_SURUMU__` yerine yazılıyor. Geliştirme
 * sunucusunda bu dosyalardan biri değişince özet yeniden hesaplanıyor ve
 * sayfa baştan yükleniyor (eski sürümle kalmasın).
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = fileURLToPath(new URL('../..', import.meta.url));
const KAYNAKLAR = [
  {
    dizin: join(KOK, 'apps/web/src/cizim'),
    uygun: (f) => /\.tsx?$/.test(f) && !/\.test\./.test(f),
  },
  { dizin: join(KOK, 'data'), uygun: (f) => f.endsWith('.json') },
  { dizin: join(KOK, 'packages/shared/src'), uygun: (f) => f.endsWith('.ts') },
];
const HEDEF = '/cizim/kalici.ts';
/** Vite kimlikleri ve değişen dosya yolları her işletim sisteminde `/` ile. */
const duz = (yol) => yol.split(sep).join('/');

function dosyalar() {
  const liste = [];
  for (const { dizin, uygun } of KAYNAKLAR)
    for (const ad of readdirSync(dizin, { recursive: true }))
      if (uygun(String(ad))) liste.push(join(dizin, String(ad)));
  return liste.sort();
}

function ilgili(dosya) {
  return KAYNAKLAR.some(
    ({ dizin, uygun }) => duz(dosya).startsWith(duz(dizin) + '/') && uygun(dosya),
  );
}

function hesapla() {
  const h = createHash('sha1');
  for (const f of dosyalar()) {
    h.update(duz(relative(KOK, f)));
    h.update(readFileSync(f));
  }
  return h.digest('hex').slice(0, 12);
}

export function cizimSurumu() {
  let ozet = null;
  return {
    name: 'cizim-surumu',
    transform(kod, id) {
      if (!duz(id.split('?')[0]).endsWith(HEDEF) || !kod.includes('__CIZIM_SURUMU__')) return null;
      ozet ??= hesapla();
      return { code: kod.replaceAll('__CIZIM_SURUMU__', JSON.stringify(ozet)), map: null };
    },
    handleHotUpdate(ctx) {
      if (!ilgili(ctx.file)) return;
      ozet = null;
      const kalici = [...ctx.server.moduleGraph.idToModuleMap.values()].filter((m) =>
        duz(m.id ?? '').endsWith(HEDEF),
      );
      for (const m of kalici) ctx.server.moduleGraph.invalidateModule(m);
      // Kalıcı depo modülü HMR kabul etmiyor: sayfa yeni sürümle baştan yükleniyor.
      return [...ctx.modules, ...kalici];
    },
  };
}
