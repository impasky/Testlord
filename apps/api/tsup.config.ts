import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/worker.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // @lordlar/shared kaynak TypeScript olarak tüketiliyor (derlenmiş JS yayınlamıyor),
  // bu yüzden bundle'a DAHİL edilmeli. Dışarıda bırakılırsa Node çalışma anında
  // .ts dosyalarını çözemez ve sunucu ERR_MODULE_NOT_FOUND ile ölür.
  noExternal: ['@lordlar/shared'],
  // data/*.json içeriği de bundle'a gömülür; üretimde ayrı dosya taşımaya gerek kalmaz.
});
