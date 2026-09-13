/**
 * PUSH BİLDİRİMİ — sunucu tarafının uçtan uca sınavı.
 *
 * Lordlar Çağı bekleme üzerine kurulu: ordu yürür, kuyruk dolar, saldırı
 * gelir. Oyuncu bunların hiçbirini uygulama kapalıyken göremiyordu.
 *
 * ── Neden gerçek tarayıcı YOK ────────────────────────────────────────
 *
 * İlk deneme Chromium açıp `pushManager.subscribe` çağırdı ve
 * "Registration failed - permission denied" aldı: tarayıcı aboneliği
 * gerçek bir push servisine (Chrome'da FCM) kaydolmayı gerektiriyor,
 * yani Google'a giden bir ağ bağlantısına. Test ortamında bu yok ve
 * olsaydı bile testi başka birinin sunucusuna bağımlı kılardı.
 *
 * İkinci deneme yerel bir HTTP sunucusunu sahte push servisi yaptı ve o
 * da tutmadı: `web-push` hedefe her hâlükârda TLS ile bağlanıyor
 * ("packet length too long" — düz HTTP portuna TLS el sıkışması). Sahte
 * servisi HTTPS yapmak, sunucuya kendi sertifikamızı tanıtmayı
 * gerektirirdi; yani testin ölçtüğü şeyi çalıştırmak için sunucunun
 * güven ayarlarını değiştirmek.
 *
 * ── Ne ölçülüyor, ne ölçülmüyor ──────────────────────────────────────
 *
 * ÖLÇÜLEN, dış ağ gerektirmeyen her şey: abonelik kaydı, aynı cihazın
 * satır çoğaltmaması, cihaz sayımı, abonelikten çıkış ve push kapalıyken
 * uçların açıkça reddetmesi. Bunların hepsi bizim kodumuz.
 *
 * ÖLÇÜLMEYEN teslimin kendisi — VAPID imzası, şifreleme ve push
 * servisine ulaşmak. Onun ilk halkası (hangi hatada abonelik silinir)
 * `services/pushPolitika.test.ts`te birim testi olarak duruyor; geri
 * kalanı `web-push` kitaplığının ve tarayıcının işi.
 *
 * ANAHTAR YOKSA test kendini atlıyor ve bunu SÖYLÜYOR — ama kapalıyken
 * uçların verdiği sözü (503 + açık kod) yine de ölçüyor. Sessizce geçen
 * bir test, hiç olmayan bir testten kötüdür.
 */
import { createECDH, randomBytes } from 'node:crypto';
import { benzersizAd, kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

let kalan = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  [${kosul ? 'GEÇTİ' : 'KALDI'}] ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) kalan++;
}

async function istek(yol, jeton, govde) {
  const r = await fetch(`${API}/api${yol}`, {
    method: govde === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${jeton}`,
      ...(govde === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(govde === undefined ? {} : { body: JSON.stringify(govde) }),
  });
  const metin = await r.text();
  return { durum: r.status, govde: metin ? JSON.parse(metin) : null };
}

const b64url = (b) => b.toString('base64url');

/**
 * Tarayıcının ürettiği türden bir anahtar çifti.
 *
 * `p256dh` P-256 eğrisinde açık anahtar, `auth` on altı baytlık rastgele
 * sır. web-push gövdeyi bu ikisiyle şifreliyor; uydurma değerler
 * verseydik şifreleme adımı hiç çalışmaz ve test bir şey ölçmezdi.
 */
function istemciAnahtari() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { p256dh: b64url(ecdh.getPublicKey()), auth: b64url(randomBytes(16)) };
}

console.log('\nLordlar Çağı — bildirim testi\n');

const ad = benzersizAd('Bildirim');
const { token } = await kayitOl(API, { email: `${ad.toLowerCase()}@test.local`, lordName: ad });

const anahtar = await istek('/push/anahtar', token);
kontrol('Anahtar ucu cevap veriyor', anahtar.durum === 200, `açık: ${anahtar.govde?.acik}`);

if (!anahtar.govde?.acik) {
  const abone = await istek('/push/abone', token, {
    endpoint: 'https://ornek.gecersiz/x',
    keys: { p256dh: 'x', auth: 'y' },
  });
  kontrol(
    'Push kapalıyken uç açıkça reddediyor',
    abone.durum === 503 && abone.govde?.code === 'PUSH_KAPALI',
    `HTTP ${abone.durum} ${abone.govde?.code ?? ''}`,
  );
  console.log(
    '\n  ATLANDI: sunucuda VAPID anahtarı yok, bildirim borusu ölçülemedi.' +
      '\n  Ölçmek için: pnpm push-anahtari ile üret, VAPID_ACIK_ANAHTAR ve' +
      '\n  VAPID_GIZLI_ANAHTAR ile sunucuyu yeniden başlat.\n',
  );
  console.log(kalan === 0 ? 'SONUÇ: push kapalı, sözleşme doğru.\n' : `SONUÇ: ${kalan} kaldı.\n`);
  process.exit(kalan === 0 ? 0 : 1);
}

const anahtarlar = istemciAnahtari();
// Ulaşılamayan ama GEÇERLİ bir adres: kayıt, sayım ve çıkış yollarının
// hiçbiri teslime bağlı değil ve bu test de tam olarak onları ölçüyor.
const adres = `https://push.gecersiz.test/abone/${ad}`;

// ── 1. Abonelik ──────────────────────────────────────────────────────
const kayit = await istek('/push/abone', token, {
  endpoint: adres,
  keys: anahtarlar,
  cihaz: 'test cihazı',
});
kontrol(
  'Abonelik kaydedildi',
  kayit.durum === 200 && kayit.govde?.cihazSayisi === 1,
  `${kayit.govde?.cihazSayisi ?? 0} cihaz`,
);

// Aynı adres iki kez: satır ÇOĞALMAMALI. Tarayıcı izni yenileyince aynı
// adresi veriyor ve iki satır, aynı cihaza iki bildirim demek.
const tekrar = await istek('/push/abone', token, { endpoint: adres, keys: istemciAnahtari() });
kontrol(
  'Aynı cihaz iki kez abone olunca satır çoğalmıyor',
  tekrar.govde?.cihazSayisi === 1,
  `${tekrar.govde?.cihazSayisi ?? 0} cihaz`,
);

// ── 2. İkinci cihaz ayrı sayılıyor ───────────────────────────────────
//
// Abonelik oyuncu başına değil CİHAZ başına: aynı lord telefondan ve
// tabletten girebilir ve ikisine de haber gitmeli.
const adres2 = `https://push.gecersiz.test/abone/${ad}-ikinci`;
const ikinci = await istek('/push/abone', token, { endpoint: adres2, keys: istemciAnahtari() });
kontrol(
  'İkinci cihaz ayrı sayılıyor',
  ikinci.govde?.cihazSayisi === 2,
  `${ikinci.govde?.cihazSayisi} cihaz`,
);

// ── 3. Geçersiz abonelik reddediliyor ────────────────────────────────
//
// Eksik anahtarla kaydedilen abonelik sessizce hiçbir şey almaz ve bunu
// aylar sonra fark edersin; uç bu yüzden şekli doğruluyor.
const bozuk = await istek('/push/abone', token, { endpoint: 'bu-bir-adres-degil', keys: {} });
kontrol('Geçersiz abonelik reddediliyor', bozuk.durum >= 400, `HTTP ${bozuk.durum}`);

// ── 4. Abonelikten çıkış ─────────────────────────────────────────────
const cikis = await istek('/push/cik', token, { endpoint: adres });
kontrol(
  'Abonelikten çıkılabiliyor',
  cikis.govde?.cikildi === true && cikis.govde?.cihazSayisi === 1,
  `${cikis.govde?.cihazSayisi} cihaz kaldı`,
);

// Başkasının aboneliği silinemez: uç `lordId` ile birlikte siliyor.
const yabanci = await istek('/push/cik', token, {
  endpoint: 'https://push.gecersiz.test/baskasinin-cihazi',
});
kontrol('Olmayan abonelikten çıkış sessizce yalan söylemiyor', yabanci.govde?.cikildi === false);

console.log(
  '\n  NOT: teslimin kendisi (VAPID imzası, şifreleme, push servisine' +
    '\n  ulaşmak) dış ağ gerektirdiği için burada ölçülmüyor. Hangi hatada' +
    "\n  aboneliğin silineceği services/pushPolitika.test.ts'te ölçülüyor.",
);

console.log(kalan === 0 ? '\nSONUÇ: bildirim borusu çalışıyor.\n' : `\nSONUÇ: ${kalan} kaldı.\n`);
process.exit(kalan === 0 ? 0 : 1);
