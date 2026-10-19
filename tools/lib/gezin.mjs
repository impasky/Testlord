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
  ['sehir', 'Şehir'],
  ['kisla', 'Ordu'],
  ['akin', 'Akın'],
  ['harita', 'Dünya'],
  ['lord', 'Lord'],
];

/**
 * Ana sayfa: ŞEHİR. Bütün kapıların girişi orada — ama artık bir düğme
 * ızgarası değil, yerleşim haritasındaki BİNALAR (docs/12 §3).
 */
export const ANA = 'sehir';

/**
 * Kapılar: kendi sayfası olmayan, ana sayfadan panel olarak açılanlar.
 * Panel `data-kapi` imzalı bir düğmeyle açılıyor.
 */
export const KAPILAR = [
  'malikane',
  'gorevler',
  'generaller',
  'demirhane',
  'arastirma',
  'ittifak',
  'olaylar',
  'siralama',
  'hesap',
  // Pazar (docs/19): binası köyde açılıyor, bu yüzden aşağıda Malikâne'deki
  // bağlantıdan giriliyor.
  'pazar',
];

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

  /*
   * HESAP şehirde bir bina DEĞİL: parola ve çıkış diyarın bir yapısı
   * değil, oyuncunun kendi işi. Girişi Lord (karakter) sayfasının sonunda.
   */
  if (ad === 'hesap') {
    await page.click('nav button:has-text("Lord")');
    await page.waitForTimeout(500);
    await page.locator('[data-kapi="hesap"]').first().click();
    await page.waitForTimeout(bekle);
    return;
  }

  /*
   * PAZAR'ın binası köyde açılıyor, testlerin yeni lordu ise kampta: bina
   * haritada ama dikili değil, dokununca kapı değil inşa kartı çıkıyor.
   * Kamptaki oyuncunun yolu Malikâne'deki bağlantı — test de oradan
   * giriyor.
   */
  if (ad === 'pazar') {
    await ekrana(page, 'malikane', 600);
    await page.locator('[role="dialog"] [data-kapi="pazar"]').first().click();
    await page.waitForTimeout(bekle);
    return;
  }

  if (KAPILAR.includes(ad)) {
    /*
     * Kapılar ŞEHİRDEKİ BİNALARDAN açılıyor.
     *
     * Eskiden ana sayfada `data-kapi` imzalı bir düğme ızgarası vardı;
     * şimdi yerleşim haritasındaki binaya dokunuluyor. DİKİLİ yapıda bu
     * TEK dokunuş: kapı doğrudan açılıyor (docs/12 §3.5). Kart yalnız
     * dikilmemiş ya da gidilecek yeri olmayan yapıda çıkıyor; orada
     * ikinci dokunuş hâlâ gerekiyor, o yüzden ikisi de deneniyor.
     */
    const anaEtiket = CUBUK.find(([k]) => k === ANA)[1];
    await page.click(`nav button:has-text("${anaEtiket}")`);
    await page.waitForTimeout(600);
    const bina = page.locator(`[data-bina-kapi="${ad}"]`);
    if ((await bina.count()) === 0) {
      throw new Error(`ekrana: "${ad}" kapısını açan bina şehirde yok (kademe yetmiyor olabilir)`);
    }
    await bina.first().click();
    await page.waitForTimeout(500);
    const git = page.locator('[data-rehber="sehir-kapiya-git"]');
    if ((await git.count()) > 0) await git.first().click();
  } else {
    const kayit = CUBUK.find(([k]) => k === ad);
    if (!kayit) throw new Error(`bilinmeyen ekran: ${ad}`);
    await page.click(`nav button:has-text("${kayit[1]}")`);
  }
  await page.waitForTimeout(bekle);
}

/**
 * Ağ bir süre (`sessiz` ms) hiç istek başlatmayıp bitirmeyene kadar bekler,
 * en çok `enCok` ms. Yolda kalan istek bittiğinde bir olay doğuruyor; sessiz
 * pencere boyunca olay yoksa yolda istek kalmamış demektir.
 */
export async function agSakinlesin(page, sessiz = 1000, enCok = 8000) {
  let son = Date.now();
  const tazele = () => {
    son = Date.now();
  };
  const olaylar = ['request', 'requestfinished', 'requestfailed'];
  for (const o of olaylar) page.on(o, tazele);
  const bas = Date.now();
  while (Date.now() - son < sessiz && Date.now() - bas < enCok) {
    await page.waitForTimeout(100);
  }
  for (const o of olaylar) page.off(o, tazele);
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
  /*
   * Yolda istek varken yenilemek onu yarıda kesiyor ve konsolu denetleyen
   * testler bunu "istek düştü" diye sayıyordu: ülke seçiminden (docs/27)
   * sonra açılan uygulamanın ilk istekleri yenilemeye denk geliyor.
   * `waitForLoadState('networkidle')` burada işe yaramıyor — sayfanın ilk
   * yüklenişinde zaten gerçekleşmiş sayılıyor ve hemen dönüyor.
   */
  await agSakinlesin(page);
  // /me önbellekte duruyor olabilir; yeni bayrağı okusun.
  await page.reload({ waitUntil: 'domcontentloaded' });
}

/**
 * Ülke seçim ekranı (docs/27): arayüzden kaydolan lordun ülkesi yok ve
 * oyuna bu ekrandan giriyor — ekran şehri, haritayı, her şeyi örtüyor.
 * Gerçek oyuncu gibi bir ülke seçilip başlanıyor. Ekran gelmezse (ülke
 * zaten seçili) bir şey yapmıyor.
 *
 * @returns ekran geldi ve seçim yapıldıysa true
 */
export async function ulkeyiSec(page, kod = 'TUR', bekle = 20000) {
  await page.waitForSelector('[data-ulke-secimi], nav button', { timeout: bekle }).catch(() => {});
  const ekran = page.locator('[data-ulke-secimi]');
  if ((await ekran.count()) === 0) return false;
  await page.locator(`[data-ulke="${kod}"]`).click();
  await page.locator('[data-rehber="ulke-sec"]').click();
  await ekran.waitFor({ state: 'detached', timeout: 15000 });
  return true;
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

/**
 * Haritada bir bölgeye dokunur — OYUNCUNUN dokunabileceği bir bölgeye.
 *
 * Harita bir TUVAL (docs/27): 3.000 şehrin her biri için bir DOM düğümü
 * yok, şehir bir noktada çiziliyor. Seçici yine `[data-bolge="12"]`
 * biçiminde yazılıyor (bir ya da virgülle ayrılmış birkaç tane); buradan
 * bölge numaraları okunuyor ve sırayla deneniyor.
 *
 * Her aday için harita o şehre götürülüyor (`__dunyaHaritasi.git`, oyuncu
 * da "listeden haritada göster" ile aynı yere varıyor), şehrin ekrandaki
 * noktası soruluyor ve o noktanın üstünde gerçekten tuval var mı diye
 * bakılıyor: bir düğme ya da çekmece örtüyorsa sıradaki aday. Zorlamalı
 * tıklama değil; zorlamak, oyuncunun yapamayacağı bir şeyi ölçmek olurdu.
 *
 * Eskiden (SVG haritada) asıl tuzak örtülen işaretçiydi: `.first()` ile
 * eşleşen ilk işaretçiye basıp, o işaretçi başlığın altında kaldığında
 * otuz saniye bekleyip kalıyorlardı. Kural aynı kaldı: dokunulan nokta
 * görünür olmalı.
 *
 * @returns dokunulan bölgenin numarası (metin), hiçbiri uygun değilse null
 */
export async function bolgeyeDokun(page, secici) {
  const idler = [...String(secici).matchAll(/data-bolge="(\d+)"/g)].map((m) => Number(m[1]));
  if (idler.length === 0) return null;
  await page.waitForSelector('[data-harita-hazir]', { timeout: 20000 });
  for (const id of idler) {
    const nokta = await page.evaluate((id) => {
      const h = window.__dunyaHaritasi;
      if (!h) return null;
      h.git(id, 3);
      const k = h.konum(id);
      if (!k) return null;
      if (k.x < 0 || k.y < 0 || k.x > innerWidth || k.y > innerHeight) return null;
      const ust = document.elementFromPoint(k.x, k.y);
      return ust?.hasAttribute('data-harita-tuval') ? k : null;
    }, id);
    if (!nokta) continue;
    // Çizim bir sonraki karede: dokunuş ondan sonra.
    await page.waitForTimeout(120);
    await page.mouse.click(nokta.x, nokta.y);
    return String(id);
  }
  return null;
}

/**
 * BELİRLİ bir bölgeyi seçer: önce oyuncu gibi şehrine dokunur; nokta bir
 * düğmenin altında kalıyorsa listeden seçer — haritanın "Liste"
 * görünümü, klavye ve ekran okuyucu oyuncusunun da yolu.
 *
 * Dokunma doğruluğunu `harita-testi` ölçüyor; buradaki testler bölgenin
 * ARKASINDAKİ işi sınıyor, oraya varmanın güvenilir bir yolu yeter.
 */
export async function bolgeyiSec(page, id) {
  if (await bolgeyeDokun(page, `[data-bolge="${id}"]`)) return 'dokunuş';
  await page.getByRole('button', { name: /Liste/ }).first().click();
  const sekme = page.getByRole('tab', { name: /Hepsi/ });
  if (await sekme.count()) await sekme.first().click();
  await page.locator(`[data-liste-bolge="${id}"]`).first().click();
  return 'liste';
}
