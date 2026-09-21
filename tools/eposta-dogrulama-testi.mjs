/**
 * E-posta doğrulama testi.
 *
 * Çekirdek soru: DOĞRULAMA BİR ŞEYE YARIYOR MU. Bir damga sütunu tek
 * başına hiçbir şeydir; ölçülen, kapının gerçekten kapanıp gerçekten
 * açılması:
 *
 *   kayıt → jeton çıktı mı → kısıtlı eylem KAPALI mı → doğrula →
 *   kapı AÇILDI mı → aynı jeton ikinci kez geçiyor mu →
 *   serbest süre dolunca giriş kapanıyor mu.
 *
 * İkinci çekirdek: kapı ilk oturumu HİÇ engellemiyor. Kayıt olan oyuncu
 * jetonu beklemeden oynayabilmeli — "ilk saldırı dakikalarda bitsin"
 * (docs/08) kuralı bunu gerektiriyor.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/eposta-dogrulama-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now().toString(36).slice(-4);
const tuz = Math.random().toString(36).slice(2, 5);

async function lordKur(etiket) {
  const eposta = `dgr${damga}${tuz}${etiket}@lordlar.dev`;
  const parola = 'Dogrula123!';
  const { token } = await kayitOl(API, {
    email: eposta,
    password: parola,
    lordName: `Dgr${damga}${tuz}${etiket}`,
    // Doğrulamanın KENDİSİNİ ölçüyoruz: kurulum kısayolu kapalı.
    dogrula: false,
  });
  const cagir = async (yol, yontem, govde) => {
    const c = await fetch(`${API}/api${yol}`, {
      method: yontem,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(yontem === 'POST' ? { body: JSON.stringify(govde ?? {}) } : {}),
    });
    return { kod: c.status, govde: await c.json().catch(() => null) };
  };
  return {
    eposta,
    parola,
    token,
    post: (yol, govde) => cagir(yol, 'POST', govde).then((r) => r.govde),
    postHam: (yol, govde) => cagir(yol, 'POST', govde),
    get: (yol) => cagir(yol, 'GET').then((r) => r.govde),
    getHam: (yol) => cagir(yol, 'GET'),
  };
}

async function giris(eposta, parola) {
  const c = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: eposta, password: parola }),
  });
  return { kod: c.status, govde: await c.json().catch(() => null) };
}

async function dogrula(jeton) {
  const c = await fetch(`${API}/api/auth/dogrula`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jeton }),
  });
  return { kod: c.status, govde: await c.json().catch(() => null) };
}

console.log('Lordlar Çağı — e-posta doğrulama\n');

const oyuncu = await lordKur('a');

/* 1. İlk oturum HİÇ engellenmiyor                                     */
const ilkDurum = await oyuncu.getHam('/me');
kontrol('Doğrulamadan oyun açılıyor', ilkDurum.kod === 200, `kod ${ilkDurum.kod}`);

const durum = await oyuncu.get('/moderasyon/durum');
kontrol('Hesap ekranı "doğrulanmadı" diyor', durum?.epostaDogrulandi === false);
kontrol(
  'Kalan gün söyleniyor',
  typeof durum?.dogrulamaKalanGun === 'number' && durum.dogrulamaKalanGun > 0,
  `${durum?.dogrulamaKalanGun} gün · ${durum?.dogrulamaMetni ?? ''}`,
);

/* 2. Kısıtlı eylemler kapalı                                          */
const sohbet = await oyuncu.postHam('/ittifak/sohbet', { metin: 'Merhaba millet.' });
kontrol(
  'İttifak sohbeti kapalı',
  sohbet.kod === 403 && sohbet.govde?.code === 'DOGRULANMADI',
  `${sohbet.kod} · ${sohbet.govde?.error ?? ''}`.slice(0, 80),
);
const gonderim = await oyuncu.postHam('/ticaret/gonder', {
  lordId: 'baskasi',
  yuk: { altin: 10, demir: 0, erzak: 0 },
});
kontrol(
  'Kaynak gönderme kapalı',
  gonderim.kod === 403 && gonderim.govde?.code === 'DOGRULANMADI',
  `${gonderim.kod}`,
);

/* 3. Kayıtta jeton çıkmış mı                                          */
const jetonCevabi = await oyuncu.post('/test/dogrulama-jetonu');
kontrol('Kayıtta doğrulama jetonu üretilmiş', jetonCevabi?.oncekiVar === true);
kontrol(
  'Ham jeton alındı',
  typeof jetonCevabi?.jeton === 'string' && jetonCevabi.jeton.length > 20,
);

/* 4. Doğrulama                                                        */
const bozuk = await dogrula('bu-jeton-uydurma-bir-sey');
kontrol('Uydurma jeton reddediliyor', bozuk.kod === 400, `kod ${bozuk.kod}`);

const sonuc = await dogrula(jetonCevabi.jeton);
kontrol('Jeton doğrulandı', sonuc.kod === 200 && sonuc.govde?.dogrulandi === true, `${sonuc.kod}`);

const tekrar = await dogrula(jetonCevabi.jeton);
kontrol('Aynı jeton İKİNCİ kez geçmiyor', tekrar.kod === 400, `kod ${tekrar.kod}`);

const sonDurum = await oyuncu.get('/moderasyon/durum');
kontrol('Hesap ekranı artık "doğrulandı" diyor', sonDurum?.epostaDogrulandi === true);

/* 5. Kapı açıldı mı                                                   */
const sohbet2 = await oyuncu.postHam('/ittifak/sohbet', { metin: 'Artik yazabilirim.' });
kontrol(
  'Doğrulayınca sohbet kapısı açılıyor',
  sohbet2.govde?.code !== 'DOGRULANMADI',
  `${sohbet2.kod} · ${sohbet2.govde?.error ?? ''}`.slice(0, 60),
);

const zaten = await oyuncu.post('/auth/dogrulama-gonder');
kontrol('Doğrulanmış hesaba posta gönderilmiyor', zaten?.zatenDogrulandi === true);

/* 6. Serbest süre dolunca giriş kapanıyor                             */
const eski = await lordKur('b');
await eski.post('/test/hesabi-eskit', { gun: 30 });

const girisDeneme = await giris(eski.eposta, eski.parola);
kontrol(
  'Serbest süre dolunca giriş kapalı',
  girisDeneme.kod === 403 && girisDeneme.govde?.code === 'DOGRULANMADI',
  `${girisDeneme.kod} · ${girisDeneme.govde?.error ?? ''}`.slice(0, 70),
);

const eskiJeton = await eski.getHam('/me');
kontrol('ESKİ JETON da çalışmıyor', eskiJeton.kod === 403, `kod ${eskiJeton.kod}`);

/*
 * 403 DEĞİL herhangi bir şey: uç kapıdan geçti demektir.
 *
 * Hesap az önce açıldı ve kayıt postası çıktı; bir dakika dolmadan
 * yeniden gönderme freni 429 veriyor. Fren de bir cevap — kapıya
 * takılsaydı 403 DOGRULANMADI alırdık ve oyuncunun çıkış yolu hiç
 * olmazdı.
 */
const gonderUc = await eski.postHam('/auth/dogrulama-gonder');
kontrol(
  'Doğrulama ucu kapıdan MUAF — yoksa çıkış yolu kalmazdı',
  gonderUc.kod !== 403,
  `kod ${gonderUc.kod} (429 = gönderim freni, kapı değil)`,
);

const yeniJeton = await eski.postHam('/test/dogrulama-jetonu');
kontrol(
  'Kapalıyken test ucu da çalışıyor (muaf değil)',
  yeniJeton.kod === 403,
  `kod ${yeniJeton.kod}`,
);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
