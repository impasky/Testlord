/**
 * İttifak başvuru testi (docs/09 §2.1 "Sırada").
 *
 * Bu testin ölçtüğü şey bir DELİĞİN kapanması: /ittifak/:id/katil ucu
 * herkese açıktı, istediğin ittifağa yürüyüp giriyordun ve liderin söz
 * hakkı yoktu. İttifak seviyesi geldiğinden beri (B1e) bu, aylarca bağışla
 * kazanılan ayrıcalıkların kapıdan girene bedava olması demekti.
 *
 * Sıra kasten böyle: önce kapının GERÇEKTEN kapandığını, sonra kapıyı
 * açanın kim olduğunu, en sonda kapının yeniden açılabildiğini ölçüyoruz.
 *
 * SADECE GELİŞTİRME. API ayakta olmalı. node tools/ittifak-basvuru-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `bsv${damga}_${etiket}@lordlar.dev`,
    lordName: `Bsv ${damga.toString(36).slice(-3)}${etiket}`,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    etiket,
    post: (y, g) =>
      fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then(
        (x) => x.json(),
      ),
    get: (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json()),
  };
}

console.log('Lordlar Çağı — ittifak başvuru testi\n');

const lider = await lordKur('lider');
const aday = await lordKur('aday');
const aday2 = await lordKur('aday2');
const yasli = await lordKur('yasli');
await lider.post('/test/kaynak-ver', { altin: 900000, demir: 200000, erzak: 200000 });

const A = await lider.post('/ittifak/kur', {
  ad: `Kapi ${damga % 100000}`,
  etiket: `K${damga % 1000}`,
});
kontrol('İttifak kuruldu', Boolean(A.id), A.error ?? A.etiket);

// --- 1. Varsayılan kapı: başvuru ---
{
  const g = await aday.get('/ittifak');
  const satir = g.liste.find((x) => x.id === A.id);
  kontrol('Yeni ittifak varsayılan olarak başvuruyla üye alıyor', satir?.katilim === 'basvuru',
    `katilim=${satir?.katilim}`);

  const d = await aday.post(`/ittifak/${A.id}/katil`);
  kontrol('Başvurulu ittifağa DOĞRUDAN katılınamıyor', d.code === 'BASVURU_GEREKLI',
    d.code ?? JSON.stringify(d).slice(0, 60));

  const uyeler = (await lider.get('/ittifak')).ittifakim.uyeler;
  kontrol('Reddedilen katılım gerçekten üye YAPMADI', uyeler.length === 1, `${uyeler.length} üye`);
}

// --- 2. Başvuru ve liderin kararı ---
let basvuruId;
{
  const b = await aday.post(`/ittifak/${A.id}/basvur`, { mesaj: 'Aktifim, gece oynuyorum.' });
  basvuruId = b.basvuruId;
  kontrol('Başvuru alındı', Boolean(basvuruId), b.error ?? '');

  const yabanci = await aday2.get('/ittifak/basvurular');
  kontrol('İttifak dışındaki lord başvuruları GÖREMİYOR',
    yabanci.yonetebilir === false && yabanci.basvurular.length === 0);

  const kutu = await lider.get('/ittifak/basvurular');
  kontrol('Lider başvuruyu ve notunu görüyor',
    kutu.basvurular.length === 1 && kutu.basvurular[0].mesaj?.includes('Aktifim'),
    `${kutu.basvurular.length} başvuru`);

  const tekrar = await aday.post(`/ittifak/${A.id}/basvur`, {});
  kontrol('Aynı ittifağa ikinci kez başvurulamıyor', tekrar.code === 'BASVURU_OLMAZ',
    tekrar.error ?? '');
}

// --- 3. Kabul üyeliği GERÇEKTEN kuruyor ---
{
  const k = await lider.post(`/ittifak/basvuru/${basvuruId}/karar`, { kabul: true });
  kontrol('Lider başvuruyu kabul etti', k.karar === 'kabul', k.error ?? '');

  const uyeler = (await lider.get('/ittifak')).ittifakim.uyeler;
  kontrol('Aday gerçekten üye oldu', uyeler.length === 2, `${uyeler.length} üye`);

  const bos = await lider.get('/ittifak/basvurular');
  kontrol('Karara bağlanan başvuru kuyruktan düştü', bos.basvurular.length === 0);

  const ikinci = await lider.post(`/ittifak/basvuru/${basvuruId}/karar`, { kabul: false });
  kontrol('Aynı başvuru ikinci kez karara bağlanamıyor', ikinci.code === 'BASVURU_KAPALI',
    ikinci.error ?? '');
}

// --- 4. Ret ve ret beklemesi ---
{
  const b = await aday2.post(`/ittifak/${A.id}/basvur`, {});
  const r = await lider.post(`/ittifak/basvuru/${b.basvuruId}/karar`, { kabul: false });
  kontrol('Lider başvuruyu reddedebiliyor', r.karar === 'ret', r.error ?? '');

  const uyeler = (await lider.get('/ittifak')).ittifakim.uyeler;
  kontrol('Reddedilen üye OLMADI', uyeler.length === 2, `${uyeler.length} üye`);

  const tekrar = await aday2.post(`/ittifak/${A.id}/basvur`, {});
  kontrol('Reddedilen lord hemen yeniden başvuramıyor', tekrar.code === 'BASVURU_OLMAZ',
    tekrar.error ?? '');
  kontrol('Ret sebebi kaç saat beklemesi gerektiğini söylüyor',
    /saat/.test(tekrar.error ?? ''), tekrar.error ?? '');
}

// --- 5. Yetki: yaşlı karar verir, sıradan üye vermez ---
{
  // aday 3. adımda kabul edildi, şu an sıradan üye.
  const uye = await aday.get('/ittifak/basvurular');
  kontrol('Sıradan üye başvuru kutusunu göremiyor', uye.yonetebilir === false);

  const adayId = (await aday.get('/me')).lord.id;
  const y = await lider.post('/ittifak/rutbe', { lordId: adayId, rutbe: 'yasli' });
  kontrol('Üye yaşlı yapıldı', y.rutbe === 'yasli', y.error ?? '');

  const kutu = await aday.get('/ittifak/basvurular');
  kontrol('Yaşlı başvuru kutusunu görebiliyor', kutu.yonetebilir === true);
  kontrol('Kapı ayarı yaşlıda YOK — o yalnız liderin', kutu.lider === false);

  const ayar = await aday.post('/ittifak/ayarlar', { katilim: 'acik' });
  kontrol('Yaşlı kapıyı değiştiremiyor', Boolean(ayar.error), ayar.error ?? 'değiştirebildi!');
}

// --- 6. Seviye eşiği ---
{
  const ayar = await lider.post('/ittifak/ayarlar', { asgariSeviye: 20 });
  kontrol('Lider seviye eşiği koyabiliyor', ayar.asgariSeviye === 20, ayar.error ?? '');

  const dusuk = await yasli.post(`/ittifak/${A.id}/basvur`, {});
  kontrol('Eşiğin altındaki lord başvuramıyor', dusuk.code === 'BASVURU_OLMAZ', dusuk.error ?? '');
  kontrol('Eşik sebebi kaçıncı seviye gerektiğini söylüyor',
    /Sv20/.test(dusuk.error ?? ''), dusuk.error ?? '');

  const asiri = await lider.post('/ittifak/ayarlar', { asgariSeviye: 999 });
  kontrol('Ölçüsüz eşik reddediliyor', asiri.code === 'SEVIYE_ESIGI', asiri.error ?? '');
}

// --- 7. Kapı açılınca: doğrudan katılım geri geliyor ---
{
  await lider.post('/ittifak/ayarlar', { katilim: 'acik', asgariSeviye: 1 });
  const g = await yasli.get('/ittifak');
  const satir = g.liste.find((x) => x.id === A.id);
  kontrol('Liste kapının açıldığını gösteriyor', satir?.katilim === 'acik', `${satir?.katilim}`);

  const k = await yasli.post(`/ittifak/${A.id}/katil`);
  kontrol('Açık ittifağa doğrudan katılınabiliyor', k.katildi === A.id, k.error ?? '');

  const uyeler = (await lider.get('/ittifak')).ittifakim.uyeler;
  kontrol('Katılan gerçekten üye oldu', uyeler.length === 3, `${uyeler.length} üye`);
}

// --- 8. Açık ittifakta da seviye eşiği geçerli ---
{
  const yeni = await lordKur('esik');
  await lider.post('/ittifak/ayarlar', { asgariSeviye: 25 });
  const k = await yeni.post(`/ittifak/${A.id}/katil`);
  kontrol('Açık ittifakta seviye eşiği hâlâ süzüyor', k.code === 'SEVIYE_YETERSIZ', k.error ?? '');
  await lider.post('/ittifak/ayarlar', { asgariSeviye: 1 });
}

// --- 9. Aynı anda açık başvuru tavanı ---
{
  const gezgin = await lordKur('gezgin');
  const tavan = (await gezgin.get('/ittifak')).basvuru.azami;

  // Tavandan bir fazla ittifak kur; hepsi varsayılan olarak başvurulu.
  const hedefler = [];
  for (let i = 0; i <= tavan; i++) {
    const k = await lordKur(`kur${i}`);
    await k.post('/test/kaynak-ver', { altin: 900000 });
    const it = await k.post('/ittifak/kur', {
      ad: `Kapi ${damga % 100000} ${i}`,
      etiket: `K${damga % 1000}${i}`,
    });
    if (!it.id) throw new Error(`ittifak kurulamadı: ${JSON.stringify(it).slice(0, 120)}`);
    hedefler.push(it.id);
  }

  const sonuclar = [];
  for (const id of hedefler) sonuclar.push(await gezgin.post(`/ittifak/${id}/basvur`, {}));
  const kabul = sonuclar.filter((r) => r.basvuruId).length;
  kontrol(`En fazla ${tavan} başvuru açık kalabiliyor`, kabul === tavan, `${kabul} kabul edildi`);
  kontrol(
    'Tavandan sonraki başvuru sebebiyle reddediliyor',
    /geri çek/.test(sonuclar[tavan]?.error ?? ''),
    sonuclar[tavan]?.error ?? '',
  );

  const geri = await gezgin.post(`/ittifak/basvuru/${sonuclar[0].basvuruId}/geri-cek`);
  kontrol('Başvuru geri çekilebiliyor', Boolean(geri.geriCekildi), geri.error ?? '');

  /**
   * Geri çekmek ret DEĞİL: kendi kararı, ceza değil. O yüzden açılan yeri
   * AYNI ittifağa yeniden başvurarak ölçüyoruz — hem "yer açıldı" hem
   * "bekleme yok" tek hamlede görünüyor. Başka bir ittifağa başvurmak
   * yalnız birincisini gösterirdi.
   */
  const tekrar = await gezgin.post(`/ittifak/${hedefler[0]}/basvur`, {});
  kontrol('Geri çekilen başvuru bekleme getirmiyor, yer de açıldı',
    Boolean(tekrar.basvuruId), tekrar.error ?? '');

  const dolu = await gezgin.post(`/ittifak/${hedefler[tavan]}/basvur`, {});
  kontrol('Yer yeniden dolunca tavan gene işliyor',
    !dolu.basvuruId && /geri çek/.test(dolu.error ?? ''), dolu.error ?? 'kabul edildi!');
}

/**
 * 10. Bir ittifağa giren lordun DİĞER başvuruları düşüyor.
 *
 * Bırakılsaydı başka bir liderin kuyruğunda, kabul edilse bile işlemeyecek
 * bir satır dururdu: lider "kabul" der, işlem "zaten bir ittifakta" diye
 * düşerdi. Kuyruğu temiz tutmak liderin işi olmamalı.
 */
{
  const cifte = await lordKur('cifte');
  const oncekiler = [];
  for (let i = 0; i < 2; i++) {
    const k = await lordKur(`hedef${i}`);
    await k.post('/test/kaynak-ver', { altin: 900000 });
    const it = await k.post('/ittifak/kur', {
      ad: `Ciftе ${damga % 100000} ${i}`,
      etiket: `C${damga % 1000}${i}`,
    });
    if (!it.id) throw new Error(`ittifak kurulamadı: ${JSON.stringify(it).slice(0, 120)}`);
    const b = await cifte.post(`/ittifak/${it.id}/basvur`, {});
    if (!b.basvuruId) throw new Error(`başvuru olmadı: ${JSON.stringify(b).slice(0, 120)}`);
    oncekiler.push(it.id);
  }
  kontrol('Lordun iki açık başvurusu var', (await cifte.get('/ittifak')).basvuru.acik === 2);

  // A hâlâ açık ve eşiksiz: doğrudan katılıyor.
  const kat = await cifte.post(`/ittifak/${A.id}/katil`);
  kontrol('Açık ittifağa doğrudan katıldı', kat.katildi === A.id, kat.error ?? '');
  const sonra = (await cifte.get('/ittifak')).basvuru.acik;
  kontrol('İttifağa girince diğer başvurular düştü', sonra === 0, `${sonra} başvuru kaldı`);
}

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
