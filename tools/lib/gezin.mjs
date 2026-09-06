/**
 * Test araçları için ekran gezinme.
 *
 * Arayüz BEŞ sekme + KAPI mimarisine geçti (oyuncunun tarifi:
 * "nav bar ile gidebileceğimiz yerler sadece 5 tane, gerisi o 5 sayfanın
 * içinde pop-up"). Bu dosya o mimarinin test tarafındaki karşılığı.
 *
 * Not: bu liste arayüzün kopyası, kaynağı değil — kaynak
 * `packages/shared/src/types.ts` (ALT_SEKMELER, KAPILAR, KAPI_EVI).
 * İkisi ayrışırsa `ekrana()` ile gezen araçlar hemen kalıyor, çünkü
 * tıklanacak düğmeyi bulamıyorlar. Sessizce yanlış çalışan bir gezinme
 * yerine gürültülü bir hata.
 */

/** Alt çubuktaki BEŞ sekme; ilki ANA SAYFA. */
export const CUBUK = [
  ['lord', 'Lord'],
  ['gorevler', 'Görevler'],
  ['kisla', 'Kışla'],
  ['harita', 'Harita'],
  ['malikane', 'Malikâne'],
];

/** Ana sayfa: bütün kapıların girişi orada. */
export const ANA = 'lord';

/**
 * Kapılar: kendi sayfası olmayan, ana sayfadan panel olarak açılanlar.
 * Panel `data-kapi` imzalı bir düğmeyle açılıyor.
 */
export const KAPILAR = ['generaller', 'demirhane', 'ittifak', 'olaylar', 'siralama', 'hesap'];

/** Denetlenen bütün ekranlar: önce sekmeler, sonra kapılar. */
export const EKRANLAR = [...CUBUK, ...KAPILAR.map((k) => [k, k])];

/** Açık bir kapı panelini kapatır; açık değilse bir şey yapmaz. */
export async function kapiyiKapat(page) {
  const kapat = page.locator('[role="dialog"] button[aria-label="Kapat"]');
  if (await kapat.count()) {
    await kapat.first().click();
    await page.waitForTimeout(350);
  }
}

/**
 * Bir ekrana gider: sekmeyse çubuktan, kapıysa ANA SAYFAYA geçip paneli
 * açarak.
 *
 * Kapı düğmeleri `data-kapi` ile imzalı — metinle aramak kırılgandı:
 * "İttifak" hem kapı düğmesinde hem Sıralama ekranındaki sekmede geçiyor
 * ve Playwright ilkini seçiyordu.
 */
export async function ekrana(page, ad, bekle = 1200) {
  // Önce varsa açık paneli kapat: üst üste iki panel açılmasın.
  await kapiyiKapat(page);

  if (KAPILAR.includes(ad)) {
    const anaEtiket = CUBUK.find(([k]) => k === ANA)[1];
    await page.click(`nav button:has-text("${anaEtiket}")`);
    await page.waitForTimeout(500);
    await page.locator(`[data-kapi="${ad}"]`).first().click();
  } else {
    const kayit = CUBUK.find(([k]) => k === ad);
    if (!kayit) throw new Error(`bilinmeyen ekran: ${ad}`);
    await page.click(`nav button:has-text("${kayit[1]}")`);
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
 * Karar ÜRÜNÜN kendi ucundan veriliyor: `POST /me/rehber-bitti`, oyunun
 * ilk bölge alınınca kendi vurduğu damga. Rehberin oyuncuya sunulan bir
 * kapatma düğmesi YOK (zorunlu); bu uç "bu lord turu tamamladı" demek ve
 * araçlar da tam olarak onu söylüyor — testi geçirmek için ürüne kapı
 * açmıyoruz.
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

/**
 * Açık kapı panelinin İÇİNDE arayan seçici.
 *
 * Kapı mimarisinin test tarafındaki tuzağı bu: panel açıkken EV EKRANI
 * arkada duruyor ve DOM'da hâlâ var. `button:has-text("Kuşan")` hem
 * Demirhane panelindeki düğmeyi hem Lord ekranındaki ekipman yuvasını
 * buluyor, `.first()` de arkadakini seçip perdeye çarpıyordu.
 *
 * Panel içi seçiciler bu yardımcıdan geçmeli.
 */
export function kapida(page, secici) {
  // Panelin kendisinden zincirleniyor: `[role="dialog"] text=...` biçimi
  // CSS ayrıştırıcısını kırıyor (text= bir Playwright motoru, CSS değil).
  return page.locator('[role="dialog"]').locator(secici);
}
