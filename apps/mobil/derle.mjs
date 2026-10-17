/**
 * Android paketini hazırlar: arayüzü oyun sunucusunun adresiyle derler ve
 * Capacitor'a kopyalar (docs/25). Sonra Android Studio ya da Gradle
 * (`android/gradlew bundleRelease`) paketi üretir.
 *
 *   OYUN_ADRESI=https://lordlarcagi.com node apps/mobil/derle.mjs
 *
 * Uygulama arayüzü kendi içinden (https://localhost) sunuyor ve API'ye
 * OYUN_ADRESI'nden konuşuyor; adres yoksa paket hiçbir sunucuya
 * bağlanamaz — o yüzden zorunlu.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const adres = process.env.OYUN_ADRESI?.replace(/\/+$/, '');
if (!adres || !/^https:\/\//.test(adres)) {
  console.error('OYUN_ADRESI gerekli ve https olmalı (ör. https://lordlarcagi.com).');
  process.exit(1);
}

const kok = fileURLToPath(new URL('../..', import.meta.url));
const kos = (komut, args, cwd, ek = {}) =>
  execFileSync(komut, args, { cwd, stdio: 'inherit', env: { ...process.env, ...ek } });

// SIKISTIRMA=yok: dosyalar cihazdan okunuyor, .br/.gz kopyaları paketi şişirirdi.
kos('pnpm', ['--filter', '@lordlar/web', 'build'], kok, { VITE_API_URL: adres, SIKISTIRMA: 'yok' });
kos('npx', ['cap', 'sync', 'android'], `${kok}apps/mobil`);
console.log(
  `\nAndroid paketi hazır: API ${adres}. Derleme: apps/mobil/android/gradlew bundleRelease`,
);
