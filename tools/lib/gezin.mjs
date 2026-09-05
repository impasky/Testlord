/**
 * Test araçları için ekran gezinme.
 *
 * Hangi ekranın alt çubukta, hangisinin menüde olduğu ÜÇ ayrı araçta üç
 * ayrı listede yazıyordu (gorsel-denetim, okunurluk-denetim,
 * tarayici-tam-akis). Demirhane çubuktan menüye taşınınca üçü birden
 * kırıldı ve üçünü de elle düzeltmek gerekti.
 *
 * Liste artık tek yerde. Bir ekran çubukla menü arasında taşınırsa
 * araçların hiçbiri değişmiyor.
 *
 * Not: bu liste arayüzün kopyası, kaynağı değil — kaynak
 * `apps/web/src/components/MobilKabuk.tsx`. İkisi ayrışırsa `ekranlar()`
 * ile gezen araçlar hemen kalıyor, çünkü tıklanacak düğmeyi bulamıyorlar.
 * Sessizce yanlış çalışan bir gezinme yerine gürültülü bir hata.
 */

/** Alt çubuktaki ekranlar: her oturumda açılanlar. */
export const CUBUK = [
  ['malikane', 'Malikâne'],
  ['gorevler', 'Görevler'],
  ['kisla', 'Kışla'],
  ['harita', 'Harita'],
];

/** Menüdeki ekranlar: oturumda bir ya da daha seyrek açılanlar. */
export const MENU = [
  ['demirhane', 'Demirhane'],
  ['olaylar', 'Olaylar'],
  ['generaller', 'Generaller'],
  ['ittifak', 'İttifak'],
  ['lord', 'Lord'],
  ['siralama', 'Sıralama'],
];

/** Denetlenen bütün ekranlar, çubuk önce. */
export const EKRANLAR = [...CUBUK, ...MENU];

const menude = (ad) => MENU.some(([k]) => k === ad);

/**
 * Bir ekrana gider. Çubukta mı menüde mi olduğunu kendi biliyor.
 *
 * Menü tıklaması IZGARAYA daraltılmış: `text=İttifak` iki eleman buluyor
 * (menüdeki sayfa ve Sıralama ekranındaki ittifak sekmesi) ve Playwright
 * ilkini seçip menü perdesine çarpıyordu.
 */
export async function ekrana(page, ad, bekle = 1200) {
  const kayit = EKRANLAR.find(([k]) => k === ad);
  if (!kayit) throw new Error(`bilinmeyen ekran: ${ad}`);
  const [, etiket] = kayit;

  if (menude(ad)) {
    await page.click('nav button:has-text("Menü")');
    await page.waitForTimeout(400);
    await page.locator(`div.fixed ul.grid button:has-text("${etiket}")`).click();
  } else {
    await page.click(`nav button:has-text("${etiket}")`);
  }
  await page.waitForTimeout(bekle);
}
