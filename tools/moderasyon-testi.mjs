/**
 * Moderasyon testi.
 *
 * Testin çekirdeği tek bir soru: ŞİKÂYET BİR ŞEYE YARIYOR MU. `Report`
 * tablosu zaten vardı ama okuyan yoktu — şikâyet kaydediliyor, orada
 * kalıyordu. "İnceleyeceğiz" deyip hiç incelememek, şikâyet düğmesini
 * olmamasından daha kötü yapar.
 *
 * Bu yüzden zincirin tamamı kontrol ediliyor:
 *   şikâyet → kuyrukta görünüyor → karar → gerçekten etkisi var.
 *
 * İkinci çekirdek: yetki sınırı. Yönetici olmayan kuyruğu göremiyor ve
 * karar veremiyor.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/moderasyon-testi.mjs
 */
import { readFileSync } from 'node:fs';
import { kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';

const B = JSON.parse(readFileSync(new URL('../data/balance.json', import.meta.url), 'utf8'));
/** Sohbetin spam freni. Sayı testte değil dengede: kural tek kaynaktan. */
const bekle = (sn) => new Promise((r) => setTimeout(r, sn * 1000));

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
const tuz = Math.random().toString(36).slice(2, 5);
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `mod${damga}_${tuz}_${etiket}@lordlar.dev`,
    lordName: `Mod${damga.toString(36).slice(-3)}${tuz}${etiket}`,
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
  return {
    etiket,
    // Tarayıcı bölümü aynı hesaba jetonla giriyor: ikinci bir kayıt
    // atmak hız sınırını boşuna yiyor ve başka bir lord üretirdi.
    token,
    post: (yol, govde) => cagir(yol, 'POST', govde).then((r) => r.govde),
    postHam: (yol, govde) => cagir(yol, 'POST', govde),
    get: (yol) => cagir(yol, 'GET').then((r) => r.govde),
    getHam: (yol) => cagir(yol, 'GET'),
    sil: (yol) => cagir(yol, 'DELETE').then((r) => r.govde),
  };
}

/** Şikâyet freni aynı lordun art arda şikâyetini engelliyor: ayrı kişiler. */
const [lider, uye, uye2, uye3, yabanci] = await Promise.all([
  lordKur('a'),
  lordKur('b'),
  lordKur('c'),
  lordKur('d'),
  lordKur('e'),
]);

// --- Herkes aynı ittifakta olsun ki sohbeti görsünler
await lider.post('/test/kaynak-ver', { altin: 200000, demir: 100000, erzak: 100000 });
const kuruldu = await lider.post('/ittifak/kur', {
  ad: `Moderasyon ${tuz}`,
  etiket: `M${tuz.slice(0, 2).toUpperCase()}`,
  katilim: 'acik',
});
kontrol('İttifak kuruldu', !!kuruldu?.id, JSON.stringify(kuruldu).slice(0, 80));
// Kuruluşta verilen `katilim` yok sayılıyor; ayar ayrı uçtan geliyor.
await lider.post('/ittifak/ayarlar', { katilim: 'acik' });
async function ittifakaAl(u) {
  const k = await u.post(`/ittifak/${kuruldu.id}/katil`);
  if (!k?.katildi) {
    console.error(`  [KALDI] ${u.etiket} ittifaka katılamadı — ${JSON.stringify(k)}`);
    process.exit(1);
  }
  return u;
}
for (const u of [uye, uye2, uye3]) await ittifakaAl(u);

/**
 * Her yeni şikâyet için TAZE bir şikâyetçi.
 *
 * Şikâyetin kendi spam freni var (20 sn) ve test ondan hızlı koşuyor;
 * aynı lorda ikinci kez şikâyet ettirmek "uç bozuk" gibi görünen ama
 * aslında frenin çalıştığı bir hata üretiyordu.
 */
let sayac = 0;
const tazeUye = async () => ittifakaAl(await lordKur(`t${sayac++}`));

// --- Sohbete bir mesaj
const mesaj = await uye.post('/ittifak/sohbet', { metin: 'Bu mesaj sikayet edilecek.' });
kontrol('Mesaj yazıldı', !!mesaj?.id, JSON.stringify(mesaj).slice(0, 60));
// Mesaj yoksa kalan kontroller ANLAMSIZ: mesajId undefined olunca
// kuyruktaki `r.mesaj?.id === undefined` karşılaştırması mesajsız bir
// satırla eşleşiyor ve test yanlış satıra bakıp sahte sonuç üretiyor.
if (!mesaj?.id) {
  console.error('\nÖNKOŞUL KIRILDI: sohbete yazılamadı, kalan kontroller koşulmadı.');
  process.exit(1);
}

// --- Kendi mesajını şikâyet edemiyor
const kendi = await uye.postHam(`/rapor/mesaj/${mesaj.id}`, { sebep: 'hakaret', aciklama: '' });
kontrol('Kendi mesajını şikâyet edemiyor', kendi.kod === 400, `HTTP ${kendi.kod}`);

// --- İttifakta olmayan biri göremediği mesajı şikâyet edemiyor
const disaridan = await yabanci.postHam(`/rapor/mesaj/${mesaj.id}`, {
  sebep: 'hakaret',
  aciklama: '',
});
kontrol('Görmediğin mesajı şikâyet edemiyorsun', disaridan.kod === 404, `HTTP ${disaridan.kod}`);

// --- "Diğer" açıklamasız reddediliyor
const bosDiger = await lider.postHam(`/rapor/mesaj/${mesaj.id}`, { sebep: 'diger', aciklama: '' });
kontrol('"Diğer" açıklamasız reddediliyor', bosDiger.kod === 400, `HTTP ${bosDiger.kod}`);

// --- Geçerli şikâyet
const ilk = await lider.post(`/rapor/mesaj/${mesaj.id}`, { sebep: 'hakaret', aciklama: '' });
kontrol('Şikâyet alındı', ilk?.alindi === true, JSON.stringify(ilk));
kontrol('Tek şikâyet mesajı gizlemiyor', ilk?.gizlendi === false, JSON.stringify(ilk));

// --- ENGEL: kötüye kullananı kendi ekranından silmek (App Store 1.2) ---
// Tek yönlü ve sessiz: engelleyen görmüyor, öteki herkes görüyor.
const uyeId = (await uye.get('/me')).lord.id;
const gorunuyorMu = async (u) =>
  ((await u.get('/ittifak/sohbet'))?.mesajlar ?? []).some((m) => m.id === mesaj.id);
kontrol('Engelden önce mesaj görünüyor', await gorunuyorMu(uye2));
const engel = await uye2.post(`/engel/${uyeId}`);
kontrol('Engellendi', engel?.engellendi === true, JSON.stringify(engel));
kontrol('Engelleyen o lordun mesajını artık GÖRMÜYOR', !(await gorunuyorMu(uye2)));
kontrol('Başkaları görmeye devam ediyor (engel tek yönlü)', await gorunuyorMu(lider));
const liste = await uye2.get('/engel');
kontrol(
  'Engel listesinde görünüyor',
  (liste?.engelliler ?? []).some((e) => e.lordId === uyeId),
  JSON.stringify(liste).slice(0, 80),
);
const kendini = await uye2.postHam(`/engel/${(await uye2.get('/me')).lord.id}`);
kontrol('Kendini engelleyemiyor', kendini.kod === 400, `HTTP ${kendini.kod}`);
await uye2.sil(`/engel/${uyeId}`);
kontrol('Engel kaldırılınca mesaj yeniden görünüyor', await gorunuyorMu(uye2));

// --- Yetki sınırı: yönetici olmayan kuyruğu göremiyor
const yetkisiz = await lider.getHam('/moderasyon/kuyruk');
kontrol('Yönetici olmayan kuyruğu göremiyor', yetkisiz.kod === 404, `HTTP ${yetkisiz.kod}`);
const yetkisizKarar = await lider.postHam('/moderasyon/karar', {
  raporId: 'uydurma',
  karar: 'yok_say',
  saat: null,
});
kontrol('Yönetici olmayan karar veremiyor', yetkisizKarar.kod === 404, `HTTP ${yetkisizKarar.kod}`);

// --- Yönetici kuyruğu görüyor
const yonetici = await lordKur('y');
await yonetici.post('/test/yonetici-yap');
const durum = await yonetici.get('/moderasyon/durum');
kontrol('Yönetici olduğunu biliyor', durum?.yonetici === true, JSON.stringify(durum).slice(0, 80));

const kuyruk = await yonetici.get('/moderasyon/kuyruk');
const satir = kuyruk?.satirlar?.find((r) => r.mesaj?.id === mesaj.id);
kontrol('Şikâyet kuyrukta görünüyor', !!satir, `${kuyruk?.toplam ?? 0} kayıt`);
kontrol(
  'Kuyruk şikâyet edilen metni taşıyor',
  satir?.mesaj?.metin === 'Bu mesaj sikayet edilecek.',
  satir?.mesaj?.metin ?? '-',
);
kontrol('Kuyruk sebebi okunur yazıyor', /Hakaret/.test(satir?.sebep ?? ''), satir?.sebep ?? '-');

// --- Otomatik gizleme: üç FARKLI şikâyetçi
const ikinci = await uye2.post(`/rapor/mesaj/${mesaj.id}`, { sebep: 'taciz', aciklama: '' });
kontrol('İki şikâyet hâlâ gizlemiyor', ikinci?.gizlendi === false, JSON.stringify(ikinci));
const ucuncu = await uye3.post(`/rapor/mesaj/${mesaj.id}`, { sebep: 'nefret', aciklama: '' });
kontrol('Üçüncü şikâyet mesajı gizliyor', ucuncu?.gizlendi === true, JSON.stringify(ucuncu));

const gizliSohbet = await uye2.get('/ittifak/sohbet');
const gizliSatir = gizliSohbet?.mesajlar?.find((m) => m.id === mesaj.id);
kontrol(
  'Gizlenen mesajın METNİ sunucudan hiç çıkmıyor',
  gizliSatir && !gizliSatir.metin.includes('sikayet edilecek'),
  gizliSatir?.metin ?? '-',
);
kontrol('Gizlenen mesaj kaldırılmış işaretli', gizliSatir?.kaldirildi === true);

// --- Karar: sustur
const hedefSatir = (await yonetici.get('/moderasyon/kuyruk')).satirlar.find(
  (r) => r.mesaj?.id === mesaj.id,
);
const sure = (await yonetici.get('/moderasyon/kuyruk')).sureler[0];
const gecersizSure = await yonetici.postHam('/moderasyon/karar', {
  raporId: hedefSatir.id,
  karar: 'sustur',
  saat: 7,
});
kontrol('Listede olmayan süre reddediliyor', gecersizSure.kod === 400, `HTTP ${gecersizSure.kod}`);

const karar = await yonetici.post('/moderasyon/karar', {
  raporId: hedefSatir.id,
  karar: 'sustur',
  saat: sure.saat,
});
kontrol('Karar uygulandı', karar?.tamam === true, JSON.stringify(karar));

// --- Susturma GERÇEKTEN yazmayı engelliyor
const yazmaDenemesi = await uye.postHam('/ittifak/sohbet', { metin: 'Yine yaziyorum.' });
kontrol('Susturulmuş lord yazamıyor', yazmaDenemesi.kod === 403, `HTTP ${yazmaDenemesi.kod}`);
kontrol(
  'Susturma sebebini söylüyor',
  /susturuldun/i.test(yazmaDenemesi.govde?.error ?? ''),
  yazmaDenemesi.govde?.error ?? '-',
);

const susturmaDurumu = await uye.get('/moderasyon/durum');
kontrol('Oyuncu susturulduğunu görüyor', susturmaDurumu?.susturulmus === true);

// --- Aynı mesaja gelen öteki şikâyetler de kapandı: aynı iş iki kez düşmez
const acikKalan = await yonetici.get('/moderasyon/kuyruk?durum=acik&sayfa=0');
kontrol(
  'Aynı mesajın öteki şikâyetleri de kapandı',
  !acikKalan.satirlar.some((r) => r.mesaj?.id === mesaj.id),
  `${acikKalan.toplam} açık kaldı`,
);

// --- Aynı şikâyete iki kez karar verilemiyor
const tekrar = await yonetici.postHam('/moderasyon/karar', {
  raporId: hedefSatir.id,
  karar: 'yok_say',
  saat: null,
});
kontrol('Karara bağlanmış şikâyet tekrar açılmıyor', tekrar.kod === 400, `HTTP ${tekrar.kod}`);

// --- Geçmiş: karar kuyrukta görünüyor
const kapali = await yonetici.get('/moderasyon/kuyruk?durum=kapali&sayfa=0');
const kapaliSatir = kapali.satirlar.find((r) => r.id === hedefSatir.id);
kontrol(
  'Karar kapalı listede yazıyor',
  /[Ss]usturuldu/.test(kapaliSatir?.karar ?? ''),
  kapaliSatir?.karar ?? '-',
);
kontrol(
  'Hedefin geçmişi kayda geçti',
  (kapaliSatir?.gecmis?.length ?? 0) > 0,
  `${kapaliSatir?.gecmis?.length ?? 0} kayıt`,
);

// --- Susturma kaldırılabiliyor: yanlış karar geri alınabilmeli
const kaldirildi = await yonetici.post('/moderasyon/susturma-kaldir', {
  lordId: hedefSatir.hedefId,
});
kontrol('Susturma kaldırıldı', kaldirildi?.tamam === true, JSON.stringify(kaldirildi));
// Sohbetin kendi spam freni susturmadan bağımsız: aynı lord az önce
// yazmayı denedi, frenin süresi dolmadan yazamaz. Beklemezsek "susturma
// kalkmadı" sanırdık — oysa engel bambaşka.
await bekle(B.ittifak.sohbet.iki_mesaj_arasi_sn + 0.5);
const yeniden = await uye.postHam('/ittifak/sohbet', { metin: 'Artik yazabiliyorum.' });
kontrol(
  'Susturma kalkınca yeniden yazabiliyor',
  yeniden.kod === 200,
  yeniden.govde?.error ?? `HTTP ${yeniden.kod}`,
);

// --- Mesajı kaldırma kararı
await bekle(B.ittifak.sohbet.iki_mesaj_arasi_sn + 0.5);
const m2 = await uye.post('/ittifak/sohbet', { metin: 'Ikinci mesaj.' });
const m2Sikayet = await (
  await tazeUye()
).post(`/rapor/mesaj/${m2.id}`, {
  sebep: 'reklam',
  aciklama: '',
});
kontrol('İkinci mesaj şikâyet edildi', m2Sikayet?.alindi === true, JSON.stringify(m2Sikayet));
const m2Satir = (await yonetici.get('/moderasyon/kuyruk')).satirlar.find(
  (r) => r.mesaj?.id === m2.id,
);
await yonetici.post('/moderasyon/karar', { raporId: m2Satir.id, karar: 'mesaj_sil', saat: null });
const sonSohbet = await uye3.get('/ittifak/sohbet');
const silinen = sonSohbet.mesajlar.find((m) => m.id === m2.id);
kontrol(
  'Kaldırılan mesajın metni sunucudan çıkmıyor',
  silinen && !silinen.metin.includes('Ikinci mesaj'),
  silinen?.metin ?? '-',
);

// --- Lord şikâyetinde "mesajı kaldır" motorda da reddediliyor
const lordSikayeti = await (
  await tazeUye()
).post(`/rapor/${m2Satir.hedefId}`, {
  sebep: 'ad',
  aciklama: '',
});
kontrol('Lord şikâyeti alındı', lordSikayeti?.alindi === true, JSON.stringify(lordSikayeti));
const lordSatir = (await yonetici.get('/moderasyon/kuyruk')).satirlar.find((r) => r.tur === 'lord');
kontrol('Lord şikâyeti kuyruğa düşüyor', !!lordSatir, lordSatir?.sebep ?? '-');
const yanlisKarar = await yonetici.postHam('/moderasyon/karar', {
  raporId: lordSatir.id,
  karar: 'mesaj_sil',
  saat: null,
});
kontrol(
  'Lord şikâyetinde mesaj silinemiyor',
  yanlisKarar.kod === 400 && /silinecek bir mesaj yok/.test(yanlisKarar.govde?.error ?? ''),
  yanlisKarar.govde?.error ?? `HTTP ${yanlisKarar.kod}`,
);

/* ------------------------------------------------------------------ */
/* Arayüz — kuyruk GERÇEKTEN çiziliyor ve karar düğmesi işliyor mu     */
/* ------------------------------------------------------------------ */

/**
 * API'nin doğru çalışması yetmez: kuyruk bir ekranda görünmüyorsa
 * şikâyetler yine kara delikte demektir. Bu bölüm tam da onu ölçüyor —
 * yönetici Hesap'tan kuyruğu açabiliyor mu, satır çiziliyor mu, düğmeye
 * basınca karar gerçekten uygulanıyor mu.
 */
const { tarayiciAc } = await import('./lib/tarayici.mjs');
const { ogreticiyiGec } = await import('./lib/ogretici.mjs');
const { rehberiSustur } = await import('./lib/gezin.mjs');
const { devices } = await import('playwright');
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';

// Karar verilecek taze bir şikâyet: arayüzden basılacak.
await bekle(B.ittifak.sohbet.iki_mesaj_arasi_sn + 0.5);
const m3 = await uye.post('/ittifak/sohbet', { metin: 'Arayuzden karara baglanacak.' });
await (await tazeUye()).post(`/rapor/mesaj/${m3.id}`, { sebep: 'taciz', aciklama: '' });

const yoneticiJeton = yonetici.token;

const b = await tarayiciAc();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), yoneticiJeton);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('nav button:has-text("Lord")', { timeout: 20000 });
await ogreticiyiGec(page);
// Rehber ışığının perdesi (z-55) tıklamaları yutuyor: yönetici ekranı
// öğreticinin parçası değil, ışığı susturmadan hiçbir düğmeye basılamaz.
await rehberiSustur(page);
await page.waitForSelector('nav button:has-text("Lord")', { timeout: 20000 });

await page.locator('nav button:has-text("Lord")').click();
await page.waitForTimeout(600);
await page.locator('[data-kapi="hesap"]').click();
await page.waitForTimeout(900);

const kuyrukDugmesi = page.locator('button:has-text("Şikâyet kuyruğu")');
kontrol('Yöneticiye kuyruk düğmesi çiziliyor', (await kuyrukDugmesi.count()) === 1);
await kuyrukDugmesi.click();
await page.waitForTimeout(1200);

const satirSayisi = await page.locator('button:has-text("Yok say")').count();
kontrol('Kuyrukta karar verilebilir satır var', satirSayisi > 0, `${satirSayisi} satır`);
kontrol(
  'Şikâyet edilen metin ekranda görünüyor',
  (await page.locator('text=Arayuzden karara baglanacak.').count()) > 0,
);

// İlk satırın "Mesajı kaldır" düğmesine bas ve etkisini SUNUCUDAN doğrula.
const oncekiAcik = (await yonetici.get('/moderasyon/kuyruk')).toplam;
await page.locator('button:has-text("Mesajı kaldır")').first().click();
await page.waitForTimeout(1500);
const sonrakiAcik = (await yonetici.get('/moderasyon/kuyruk')).toplam;
kontrol(
  'Arayüzden verilen karar sunucuya işliyor',
  sonrakiAcik < oncekiAcik,
  `${oncekiAcik} → ${sonrakiAcik}`,
);

kontrol('Konsol hatası yok', konsol.length === 0, konsol.slice(0, 2).join(' | '));
await b.close();

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
