/**
 * DERLEMEDE SIKIŞTIRMA — her metin dosyasının yanına `.br` ve `.gz`.
 *
 * Sunucu dosyaları istek anında sıkıştırıyordu (@fastify/compress). 0,1
 * CPU'lu ücretsiz sunucuda 745 KB'lık ana paketi Brotli'yle sıkıştırmak
 * tek başına ~1 saniyeydi ve her yeni ziyaretçide yeniden ödeniyordu.
 * Burada bir kez, en yüksek seviyede (Brotli 11) yapılıyor; sunucu hazır
 * dosyayı gönderiyor (`preCompressed`, apps/api index.ts).
 *
 * Android paketi (apps/mobil/derle.mjs) `SIKISTIRMA=yok` diyor: orada
 * dosyalar cihazdan okunuyor, `.br` kopyaları yalnız paketi büyütürdü.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const METIN = /\.(js|mjs|css|html|svg|json|webmanifest|txt)$/;
/** Bundan küçük dosyada sıkıştırmanın başlığı kazancını yer. */
const ESIK = 1024;

function dosyalar(dizin) {
  return readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad);
    return statSync(yol).isDirectory() ? dosyalar(yol) : [yol];
  });
}

export function derlemeSikistirma() {
  let cikti = 'dist';
  return {
    name: 'lordlar-derleme-sikistirma',
    apply: 'build',
    configResolved(c) {
      cikti = c.build.outDir.startsWith('/') ? c.build.outDir : join(c.root, c.build.outDir);
    },
    closeBundle() {
      if (process.env.SIKISTIRMA === 'yok') return;
      for (const yol of dosyalar(cikti)) {
        if (!METIN.test(yol)) continue;
        const ham = readFileSync(yol);
        if (ham.length < ESIK) continue;
        writeFileSync(
          `${yol}.br`,
          brotliCompressSync(ham, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 11,
              [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
              [constants.BROTLI_PARAM_SIZE_HINT]: ham.length,
            },
          }),
        );
        writeFileSync(`${yol}.gz`, gzipSync(ham, { level: 9 }));
      }
    },
  };
}
