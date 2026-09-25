/**
 * Genel sohbet, profil kartı ve uygulama kasası — uçtan uca.
 *
 * Oyuncunun istekleri:
 *   1. "Tüm oyuncuların sohbet edebileceği genel sohbet yap, her sayfadan
 *      erişilebilsin."
 *   2. "İsmine ya da profil resmine tıklayınca profil ve bazı bilgiler
 *      görünsün, kritik bilgiler görünmesin."
 *   3. "Mesajlar rapor edilebilsin, oyuncular engellenebilsin; engellenen
 *      oyuncunun mesajlarını engelleyen ASLA bir daha görmesin."
 *   4. "Footer yukarı çekilince bütün sayfalara erişilen bir alan olsun."
 *
 * İlk yarı API (kural sunucuda), ikinci yarı tarayıcı (oyuncu gerçekten
 * bunları görüyor mu).
 *
 * SADECE GELİŞTİRME. node tools/genel-sohbet-testi.mjs
 */
import { readFileSync } from 'node:fs';
import { devices } from 'playwright';
import { kayitOl } from './lib/kayit.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { rehberiSustur } from './lib/gezin.mjs';
import { tarayiciAc } from './lib/tarayici.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const B = JSON.parse(readFileSync(new URL('../data/balance.json', import.meta.url), 'utf8'));
const G = B.genel_sohbet;
const bekle = (sn) => new Promise((r) => setTimeout(r, sn * 1000));

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
const tuz = Math.random().toString(36).slice(2, 5);
async function lordKur(etiket, dogrula = true) {
  const { token } = await kayitOl(API, {
    email: `gs${damga}_${tuz}_${etiket}@lordlar.dev`,
    lordName: `Gs${damga.toString(36).slice(-3)}${tuz}${etiket}`,
    dogrula,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const cagir = async (yol, yontem, govde) => {
    const c = await fetch(`${API}/api${yol}`, {
      method: yontem,
      headers: h,
      ...(yontem !== 'GET' ? { body: JSON.stringify(govde ?? {}) } : {}),
    });
    return { kod: c.status, govde: await c.json().catch(() => null) };
  };
  const me = await (await fetch(`${API}/api/me`, { headers: h })).json();
  return {
    etiket,
    token,
    id: me.lord.id,
    ad: me.lord.name,
    post: (yol, govde) => cagir(yol, 'POST', govde).then((r) => r.govde),
    postHam: (yol, govde) => cagir(yol, 'POST', govde),
    get: (yol) => cagir(yol, 'GET').then((r) => r.govde),
    getHam: (yol) => cagir(yol, 'GET'),
    sil: (yol) => cagir(yol, 'DELETE').then((r) => r.govde),
  };
}

console.log('Genel sohbet — API');
const [a, b, c, d, e, yonetici] = await Promise.all(
  ['a', 'b', 'c', 'd', 'e', 'y'].map((x) => lordKur(x)),
);
const dogrulanmamis = await lordKur('u', false);

/* --- Yazma ve okuma --- */
const s1 = `Selam diyar ${tuz}`;
const yazildi = await a.post('/sohbet/genel', { metin: s1 });
kontrol('Doğrulanmış lord genel sohbete yazıyor', Boolean(yazildi?.id), JSON.stringify(yazildi));
const bListe = await b.get('/sohbet/genel');
const bGorulen = bListe.mesajlar.find((m) => m.id === yazildi.id);
kontrol('Başka bir lord mesajı görüyor (bütün diyarlar tek kanal)', Boolean(bGorulen));
kontrol(
  'Mesaj yazarın resmini ve armasını taşıyor',
  bGorulen?.resim?.tur && bGorulen?.arma?.kalkan,
  JSON.stringify(bGorulen?.resim),
);
const aListe = await a.get('/sohbet/genel');
kontrol(
  'Kendi mesajı "benim" işaretli',
  aListe.mesajlar.find((m) => m.id === yazildi.id)?.benim === true,
);

/* --- Frenler --- */
const hizli = await a.post('/sohbet/genel', { metin: 'hemen ikinci' });
kontrol('Yavaş mod: iki mesaj arası bekleme', hizli?.code === 'COK_HIZLI', hizli?.code);
await bekle(G.iki_mesaj_arasi_sn + 0.3);
const ayni = await a.post('/sohbet/genel', { metin: `SELAM diyar ${tuz}!!!` });
kontrol(
  'Aynı söz üst üste yazılamıyor (büyük harf, noktalama farkı sayılmıyor)',
  ayni?.code === 'AYNI_MESAJ',
  ayni?.code,
);
const kufur = await b.post('/sohbet/genel', { metin: 'siktir git' });
kontrol('Süzgeç: uygunsuz mesaj reddediliyor', kufur?.code === 'MESAJ_UYGUNSUZ', kufur?.code);
const uzun = await b.postHam('/sohbet/genel', { metin: 'x'.repeat(G.mesaj_en_fazla_harf + 1) });
kontrol('Uzun mesaj reddediliyor', uzun.kod === 400, String(uzun.kod));
const dgr = await dogrulanmamis.postHam('/sohbet/genel', { metin: 'merhaba' });
kontrol(
  'Doğrulanmamış hesap yazamıyor',
  dgr.kod === 403 && dgr.govde?.code === 'DOGRULANMADI',
  `${dgr.kod}`,
);
kontrol(
  'Doğrulanmamış hesap okuyabiliyor',
  Array.isArray((await dogrulanmamis.get('/sohbet/genel'))?.mesajlar),
);

/* --- Profil kartı: kritik bilgi yok --- */
const kart = await b.get(`/lord/${a.id}/profil`);
kontrol('Profil kartı açılıyor', kart?.ad === a.ad, kart?.ad);
const IZINLI = new Set([
  'lordId',
  'ad',
  'resim',
  'arma',
  'seviye',
  'sohret',
  'unvan',
  'medeniyet',
  'faydaRutbesi',
  'ittifak',
  'bolgeSayisi',
  'diyar',
  'katildi',
  'rakip',
  'benim',
  'engelledin',
]);
const fazla = Object.keys(kart ?? {}).filter((k) => !IZINLI.has(k));
kontrol(
  'Profil kartında izinli alanlar dışında hiçbir şey yok',
  fazla.length === 0,
  fazla.join(', '),
);
// Anahtarlara bakılıyor, metne değil: medeniyetin adı "Demir Ocağı"
// olabilir ve bu bir sızıntı değil.
const tumAnahtarlar = JSON.stringify(kart, (k, v) => v).match(/"([a-zA-Z]+)":/g) ?? [];
kontrol(
  'Kaynak, ordu, e-posta, son görülme sızmıyor',
  !tumAnahtarlar.some((k) =>
    /altin|demir|erzak|units|army|email|eposta|lastSeen|sonGorulme|homeBolge/i.test(k),
  ),
  tumAnahtarlar.join(' '),
);
kontrol('Katılış yalnız AY (gün değil)', /-01T00:00:00/.test(kart?.katildi ?? ''), kart?.katildi);
kontrol('Olmayan lordun profili 404', (await b.getHam('/lord/yok/profil')).kod === 404);

/* --- Engel: engelleyen ASLA görmüyor --- */
await bekle(G.iki_mesaj_arasi_sn + 0.3);
const s2 = await a.post('/sohbet/genel', { metin: `engelden önce ${tuz}` });
await b.post(`/engel/${a.id}`);
const bSonra = await b.get('/sohbet/genel');
kontrol(
  'Engelleyen, engellenenin ESKİ mesajlarını görmüyor',
  !bSonra.mesajlar.some((m) => m.lordId === a.id),
);
await bekle(G.iki_mesaj_arasi_sn + 0.3);
const s3 = await a.post('/sohbet/genel', { metin: `engelden sonra ${tuz}` });
const bSonra2 = await b.get('/sohbet/genel');
kontrol(
  'Engelleyen, engellenenin YENİ mesajlarını da görmüyor',
  !bSonra2.mesajlar.some((m) => m.id === s3.id),
);
const cGorur = await c.get('/sohbet/genel');
kontrol(
  'Başkaları görmeye devam ediyor (engel tek yönlü, sessiz)',
  cGorur.mesajlar.some((m) => m.id === s3.id),
);
kontrol('Profil kartı engeli biliyor', (await b.get(`/lord/${a.id}/profil`))?.engelledin === true);
await b.sil(`/engel/${a.id}`);
kontrol(
  'Engel kalkınca mesajlar geri geliyor',
  (await b.get('/sohbet/genel')).mesajlar.some((m) => m.id === s2.id),
);

/* --- Şikâyet ve otomatik gizleme --- */
const kendi = await a.postHam(`/rapor/genel/${s3.id}`, { sebep: 'hakaret', aciklama: '' });
kontrol('Kendi mesajı şikâyet edilemiyor', kendi.kod === 400, String(kendi.kod));
const r1 = await b.post(`/rapor/genel/${s3.id}`, { sebep: 'hakaret', aciklama: '' });
kontrol('Mesaj şikâyet edildi', r1?.alindi === true && r1?.gizlendi === false, JSON.stringify(r1));
await c.post(`/rapor/genel/${s3.id}`, { sebep: 'reklam', aciklama: '' });
const r3 = await d.post(`/rapor/genel/${s3.id}`, { sebep: 'hakaret', aciklama: '' });
kontrol(
  `${B.moderasyon.otomatik_gizleme_esigi} farklı şikâyetçide mesaj gizleniyor`,
  r3?.gizlendi === true,
);
const gizli = (await e.get('/sohbet/genel')).mesajlar.find((m) => m.id === s3.id);
kontrol(
  'Gizlenen mesajın metni sunucudan çıkmıyor',
  gizli && gizli.kaldirildi && !gizli.metin.includes(tuz),
  gizli?.metin,
);

/* --- Yönetici kararı --- */
await yonetici.post('/test/yonetici-yap');
const kuyruk = await yonetici.get('/moderasyon/kuyruk?durum=acik');
const satir = kuyruk.satirlar.find((s) => s.mesaj?.id === s3.id);
kontrol('Şikâyet kuyrukta, kanalıyla', satir?.tur === 'genel', satir?.tur);
kontrol('Yönetici gizlenen metni görüyor', satir?.mesaj?.metin?.includes(tuz));
const karar = await yonetici.post('/moderasyon/karar', { raporId: satir?.id, karar: 'mesaj_sil' });
kontrol('Mesaj kaldırıldı', karar?.tamam === true, JSON.stringify(karar));
const sil = (await e.get('/sohbet/genel')).mesajlar.find((m) => m.id === s3.id);
kontrol(
  'Kaldırılan mesaj "kaldırıldı" görünüyor',
  sil?.kaldirildi && sil.metin === 'Bu mesaj kaldırıldı.',
  sil?.metin,
);
const oyuncu = await yonetici.get(`/yonetici/oyuncu/${a.id}`);
kontrol(
  'Yönetici panelinde genel sohbet mesajları kanalıyla',
  oyuncu?.mesajlar?.some((m) => m.kanal === 'genel'),
);

/* --- Susturulan genel sohbete de yazamıyor --- */
await yonetici.post(`/yonetici/oyuncu/${e.id}/sustur`, { saat: 1, sebep: 'deneme susturması' });
const sus = await e.postHam('/sohbet/genel', { metin: 'susturuldum mu' });
kontrol(
  'Susturulmuş lord genel sohbete yazamıyor',
  sus.kod === 403 && sus.govde?.code === 'SUSTURULDUN',
  `${sus.kod}`,
);

/* --- Okunmamış işareti --- */
const son = await b.get('/sohbet/genel/son');
kontrol('Son mesaj anı dönüyor', typeof son?.son === 'string');

/* ------------------------------------------------------------------ */
/* Tarayıcı                                                            */
/* ------------------------------------------------------------------ */
console.log('\nGenel sohbet — tarayıcı');
await bekle(G.iki_mesaj_arasi_sn + 0.3);
await a.post('/sohbet/genel', { metin: `tarayıcı için ${tuz}` });

const tarayici = await tarayiciAc();
const ctx = await tarayici.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('pageerror', (x) => konsol.push(String(x)));
page.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));
await page.goto(WEB);
await page.evaluate((t) => {
  localStorage.setItem('lordlar_token', t);
  localStorage.setItem('lordlar_dil', 'tr');
}, b.token);
await page.goto(WEB);
await page.waitForSelector('nav button');
await ogreticiyiGec(page);
await rehberiSustur(page, API);
await page.waitForSelector('nav button');

// Her sekmeden erişim: üst çubuktaki düğme beş sekmenin hepsinde.
let herSekmede = true;
for (const ad of ['Şehir', 'Ordu', 'Akın', 'Dünya', 'Lord']) {
  await page.locator('nav').getByRole('button', { name: ad }).click();
  await page.waitForTimeout(300);
  if (!(await page.locator('[data-ust-sohbet]').isVisible())) herSekmede = false;
}
kontrol('Sohbet düğmesi beş sekmenin hepsinde', herSekmede);
kontrol(
  'Okunmamış mesaj varken düğme bunu söylüyor',
  /yeni mesaj/.test((await page.locator('[data-ust-sohbet]').getAttribute('aria-label')) ?? ''),
);

await page.click('[data-ust-sohbet]');
const panel = page.getByRole('dialog', { name: 'Genel Sohbet' });
await panel.waitFor();
await panel.getByText(`tarayıcı için ${tuz}`).waitFor({ timeout: 10000 });
kontrol('Sohbet paneli açılıyor ve mesajları gösteriyor', true);

await panel.getByRole('textbox', { name: 'Genel sohbete mesaj' }).fill(`tarayıcıdan ${tuz}`);
await panel.getByRole('button', { name: 'Yaz', exact: true }).click();
await panel.getByText(`tarayıcıdan ${tuz}`).waitFor({ timeout: 10000 });
kontrol('Arayüzden yazılan mesaj akışa düşüyor', true);
kontrol(
  'Yavaş mod düğmede sayıyor',
  /Yaz \(\d\)/.test((await panel.getByRole('button', { name: /^Yaz/ }).textContent()) ?? ''),
);

// İsme dokununca profil kartı.
await panel
  .getByRole('button', { name: `${a.ad} profilini aç` })
  .last()
  .click();
const kartD = page.getByRole('dialog', { name: `${a.ad} — profil` });
await kartD.waitFor();
kontrol('Resme dokununca profil kartı açılıyor', true);
const kartMetni = (await kartD.textContent()) ?? '';
kontrol('Kartta diyar ve katılış var', /Diyar/.test(kartMetni) && /Katıldı/.test(kartMetni));
const satirlar = await kartD.locator('dt').allTextContents();
kontrol(
  'Kartta yalnız güvenli satırlar var',
  satirlar.join(',') === 'Şöhret,Medeniyet,İttifak,Toprak,Diyar,Katıldı',
  satirlar.join(','),
);

// Karttan engelle → mesajları akıştan düşüyor.
await kartD
  .getByRole('button', { name: /Engelle/ })
  .first()
  .click();
await kartD.getByRole('button', { name: 'Engelle', exact: true }).click();
await kartD.getByText(/Engellendi/).waitFor();
await kartD.getByRole('button', { name: 'Kapat', exact: true }).click();
await page.waitForTimeout(800);
kontrol(
  'Engellenen lordun mesajları arayüzden de kalkıyor',
  (await panel.getByText(`tarayıcı için ${tuz}`).count()) === 0,
);
await b.sil(`/engel/${a.id}`);

// Kasayı tutamaktan aç, bir kapıya git.
await panel.getByRole('button', { name: 'Kapat', exact: true }).click();
await page.click('[data-kasa-tutamak]');
const kasa = page.getByRole('dialog', { name: 'Tüm sayfalar' });
await kasa.waitFor();
const karoSayisi = await kasa.locator('[data-kasa]').count();
kontrol('Kasa tutamaktan açılıyor', karoSayisi >= 17, `${karoSayisi} karo`);
kontrol(
  'Her karonun görseli ve adı var',
  (await kasa.locator('[data-kasa] img, [data-kasa] svg').count()) === karoSayisi,
);
await kasa.locator('[data-kasa="siralama"]').click();
await page.getByRole('dialog', { name: 'Sıralama' }).waitFor();
kontrol('Kasadan Sıralama kapısı açılıyor', true);
await page
  .getByRole('dialog', { name: 'Sıralama' })
  .getByRole('button', { name: 'Kapat', exact: true })
  .click();

// Çubuğu yukarı ÇEKEREK aç (oyuncunun tarif ettiği hareket). Çekme bir
// sekme düğmesinin üstünde başlıyor: o sekmeye basılmış SAYILMAMALI.
const onceki = await page.locator('nav [aria-current="page"]').textContent();
const nav = await page.locator('nav').boundingBox();
const x = nav.x + nav.width * 0.3;
const y = nav.y + nav.height / 2;
await page.mouse.move(x, y);
await page.mouse.down();
await page.mouse.move(x, y - 30, { steps: 3 });
await page.mouse.move(x, y - 90, { steps: 4 });
await page.mouse.up();
await kasa.waitFor({ timeout: 5000 }).catch(() => {});
kontrol('Alt çubuk yukarı çekilince kasa açılıyor', await kasa.isVisible());
kontrol(
  'Çekme, altındaki sekmeye basılmış sayılmıyor',
  (await page.locator('nav [aria-current="page"]').textContent()) === onceki,
  onceki ?? '',
);
await kasa.locator('[data-kasa="kisla"]').click();
await page.waitForTimeout(500);
kontrol(
  'Kasadan bir sekmeye gidiliyor',
  (await page.locator('nav [aria-current="page"]').textContent())?.includes('Ordu'),
);

kontrol('Konsolda hata yok', konsol.length === 0, konsol.slice(0, 3).join(' | '));
await tarayici.close();

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
