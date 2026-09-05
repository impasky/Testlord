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

/**
 * Rehber ışığını bu OYUNCU için kapatır.
 *
 * Işık ilk oturumda ekranı karartıp TEK düğmeyi açıkta bırakıyor
 * (`RehberIsigi.tsx`) — yani bir aracın "menüye bas, şu sekmeye geç"
 * gezinmesini bilerek engelliyor. Engel doğru; engellenen araçlar yanlış
 * oyuncuyu canlandırıyordu: ekranları gezen bu testler ilk oturumdaki
 * oyuncuyu değil, oyunu zaten öğrenmiş oyuncuyu ölçüyor.
 *
 * Karar ÜRÜNÜN kendi ucundan veriliyor (`POST /me/rehber-bitti` — oyuncu
 * "yeter, anladım" deyince çağrılan uç): testi geçirmek için ürüne kapı
 * açmıyoruz, olan kapıdan giriyoruz.
 *
 * Tarayıcı deposuna yazmıyor. Yazsaydı testler ürünün DÜZELTİLEN hatasını
 * canlandırırdı: karar hesaba değil tarayıcıya bağlanır, aynı tarayıcıda
 * açılan yeni hesap da sessizce rehbersiz kalırdı.
 *
 * Sayfa GİRİŞ YAPMIŞ olmalı; jetonu sayfanın kendi deposundan okuyor.
 *
 * Rehberin KENDİSİNİ ölçen araçlar (rehber-testi, rehber-isigi-testi)
 * bunu ÇAĞIRMAZ — orada ışığın yanması testin konusu.
 */
export async function rehberiSustur(page, api = process.env.API_URL ?? 'http://localhost:3000') {
  const jeton = await page.evaluate(() => localStorage.getItem('lordlar_token'));
  if (!jeton) throw new Error('rehberiSustur: sayfada jeton yok — giriş yapıldıktan sonra çağır');
  const y = await fetch(`${api}/api/me/rehber-bitti`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jeton}` },
  });
  if (!y.ok) throw new Error(`rehberiSustur: ${y.status} ${await y.text()}`);
  // /me önbellekte duruyor olabilir; yeni bayrağı okusun.
  await page.reload({ waitUntil: 'domcontentloaded' });
}
