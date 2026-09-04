/**
 * Kimlik testi: arma ve unvan (docs/10).
 *
 * Ortaçağ oyunlarında en çok sevilen şey kimlik. Bu testin sorusu şu:
 * oyuncunun seçtiği arma GERÇEKTEN her yerde görünüyor mu? Bir ekranda
 * görünüp diğerinde görünmeyen kimlik, kimlik değildir.
 *
 * SADECE GELİŞTİRME. node tools/kimlik-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
async function lordKur(etiket) {
  const r = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `km${damga}_${etiket}@lordlar.dev`,
      password: 'parola1234',
      lordName: `Km${damga.toString(36).slice(-3)}${etiket}`,
    }),
  });
  const govde = await r.json();
  if (!govde.token) throw new Error(`kayıt başarısız: ${JSON.stringify(govde).slice(0, 150)}`);
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${govde.token}` };
  return {
    post: (y, g) =>
      fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) })
        .then((x) => x.json()),
    get: (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json()),
  };
}

console.log('Lordlar Çağı — kimlik testi (arma ve unvan)\n');

const a = await lordKur('a');
const b = await lordKur('b');

const bas = (await a.get('/me')).lord;
kontrol('Yeni oyuncunun arması var', Boolean(bas.arma?.kalkan), JSON.stringify(bas.arma));
kontrol('Yeni oyuncunun unvanı var', Boolean(bas.unvan?.ad), bas.unvan?.ad);
kontrol('Unvan bir sonrakini söylüyor', Boolean(bas.unvan?.sonrakiAd),
  `${bas.unvan?.sonrakiAd} @ ${bas.unvan?.sonrakiEsik}`);

// Arma ADDAN türüyor: iki farklı lordun arması aynı olmamalı, yoksa
// herkes aynı kalkanla başlar ve arma kimlik olmaktan çıkar.
const basB = (await b.get('/me')).lord;
kontrol(
  'İki lordun arması farklı',
  JSON.stringify(bas.arma) !== JSON.stringify(basB.arma),
  `${JSON.stringify(bas.arma)} vs ${JSON.stringify(basB.arma)}`,
);
kontrol('Armanın iki rengi farklı', bas.arma.renk1 !== bas.arma.renk2,
  `${bas.arma.renk1}/${bas.arma.renk2}`);

// --- Arma değiştirme
const yeni = { kalkan: 'kesik', desen: 'capraz', renk1: 'mor', renk2: 'altin', sembol: 'kartal' };
const kaydedildi = await a.post('/me/arma', yeni);
kontrol('Arma değiştirilebiliyor', kaydedildi?.arma?.sembol === 'kartal',
  JSON.stringify(kaydedildi?.arma));
const sonra = (await a.get('/me')).lord;
kontrol('Değişiklik /me üzerinde kalıcı', sonra.arma.sembol === 'kartal' && sonra.arma.renk1 === 'mor',
  JSON.stringify(sonra.arma));

// Geçersiz parça REDDEDİLMİYOR, düzeltiliyor.
const bozuk = await a.post('/me/arma', { ...yeni, kalkan: 'yok-boyle', sembol: 'ejderha' });
kontrol('Geçersiz parça düzeltiliyor, hata verilmiyor',
  Boolean(bozuk?.arma) && bozuk.arma.kalkan !== 'yok-boyle' && bozuk.arma.sembol !== 'ejderha',
  JSON.stringify(bozuk?.arma ?? bozuk));

// Geri al ki sonraki kontroller net olsun
await a.post('/me/arma', yeni);

// --- ÇEKİRDEK: arma HER YERDE görünüyor mu?
const benimAd = (await a.get('/me')).lord.name;
const siralama = await a.get('/rankings/fame');
const benSatir = siralama.satirlar?.find((r) => r.name === benimAd) ?? siralama.benim;
kontrol('Sıralamada arma var', Boolean(benSatir?.arma?.kalkan), JSON.stringify(benSatir?.arma));
kontrol('Sıralamada unvan var', Boolean(benSatir?.unvan), benSatir?.unvan);
kontrol(
  'Sıralamadaki arma SEÇİLEN arma',
  benSatir?.arma?.sembol === 'kartal' && benSatir?.arma?.renk1 === 'mor',
  JSON.stringify(benSatir?.arma),
);

// İttifak üye listesi
await a.post('/test/kaynak-ver', { altin: 200000, demir: 0, erzak: 0 });
const itt = await a.post('/ittifak/kur', { ad: `Kimlik ${damga % 10000}`, etiket: `M${damga % 100}` });
const uyeler = (await a.get('/ittifak')).ittifakim?.uyeler ?? [];
kontrol('İttifak üye listesinde arma var', Boolean(uyeler[0]?.arma?.kalkan),
  JSON.stringify(uyeler[0]?.arma));
kontrol('İttifak üye listesinde unvan var', Boolean(uyeler[0]?.unvan), uyeler[0]?.unvan);
void itt;

// --- Unvan şöhretle yükseliyor
await a.post('/test/xp-ver', { miktar: 200000 });
const zengin = (await a.get('/me')).lord;
kontrol(
  'Şöhret arttıkça unvan yükseliyor',
  zengin.fame > bas.fame ? zengin.unvan.ad !== bas.unvan.ad || zengin.fame < 400 : true,
  `${bas.fame} şöhret "${bas.unvan.ad}" -> ${zengin.fame} şöhret "${zengin.unvan.ad}"`,
);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
