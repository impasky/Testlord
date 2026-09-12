/**
 * Tarayıcının NEREDE olduğu — tek yerden.
 *
 * On altı test dosyası Chromium açıyordu ve yol çoğunda elle yazılıydı:
 * `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Bu, geliştirme
 * kabında doğru ve başka hiçbir yerde doğru değil. Testler CI'ya
 * taşınınca on altısı birden, ölçtükleri şeyle hiç ilgisi olmayan bir
 * sebeple kalırdı — üstelik sürüm numarası (1194) kabın kendisi
 * güncellenince burada da bozulur.
 *
 * Sıra şu ve üçü de gerçek bir ortama karşılık geliyor:
 *
 *   CHROME_PATH        Elle söylenmişse tartışma yok.
 *   /opt/pw-browsers   Bu geliştirme kabı; Playwright'a önceden kurulmuş
 *                      ve PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD açık.
 *   (hiçbiri)          `executablePath` hiç verilmiyor ve Playwright kendi
 *                      kurduğu tarayıcıyı buluyor — CI'nın hâli budur
 *                      (`npx playwright install chromium`).
 *
 * `--no-sandbox` her yerde açık: kap içinde kök kullanıcı olarak
 * çalışıyoruz ve sandbox o durumda başlamıyor.
 */
import { existsSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const KAP_KOKU = '/opt/pw-browsers';

/**
 * Geliştirme kabındaki chromium — sürüm numarasını OKUYARAK, yazarak değil.
 *
 * İki tuzak var ve ikisi de bir kez tökezletti:
 *   - Klasörün yanında `chromium_headless_shell-...` de duruyor ve düz bir
 *     `startsWith('chromium')` onu seçebiliyor; içinde `chrome-linux/chrome`
 *     yok, yalnız kabuk var. Kalıp tam eşleşme olmalı.
 *   - Sürüm METİN olarak sıralanırsa "chromium-99" "chromium-1194"ün
 *     önüne geçiyor. Sayıya çevirip öyle sıralanıyor.
 */
function kaptakiTarayici() {
  if (!existsSync(KAP_KOKU)) return null;
  try {
    const klasor = readdirSync(KAP_KOKU)
      .map((a) => /^chromium-(\d+)$/.exec(a))
      .filter((e) => e !== null)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .pop()?.[0];
    if (!klasor) return null;
    const yol = `${KAP_KOKU}/${klasor}/chrome-linux/chrome`;
    return existsSync(yol) ? yol : null;
  } catch {
    return null;
  }
}

/** Bu makinede Chromium'un yolu; Playwright kendi bulsun diye null olabilir. */
export function tarayiciYolu() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  return kaptakiTarayici();
}

/**
 * Testlerin kullandığı tek açılış noktası.
 *
 * `secenek` doğrudan `chromium.launch`a geçiyor; `args` verilirse
 * `--no-sandbox`un üstüne EKLENİYOR, onu ezmiyor.
 */
export async function tarayiciAc(secenek = {}) {
  const { args = [], ...kalan } = secenek;
  const yol = tarayiciYolu();
  return chromium.launch({
    ...(yol ? { executablePath: yol } : {}),
    args: ['--no-sandbox', ...args],
    ...kalan,
  });
}
