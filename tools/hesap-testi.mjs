/**
 * Hesap testi: parola değiştirme, parola sıfırlama ve hesap silme.
 *
 * Bu üçü olmadan bir hesap sistemi eksiktir: parolasını unutan oyuncu
 * hesabını kaybeder, verisini silmek isteyenin yolu olmaz.
 *
 * Sıfırlama jetonu geliştirmede cevaba konuyor (üretimde asla), test de
 * onu kullanıyor. E-posta taşıyıcısı "log" olduğu için dışarıya posta
 * gitmez.
 *
 * SADECE GELİŞTİRME. node tools/hesap-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — hesap testi\n');

const d = Date.now();
const eposta = `hesap${d}@lordlar.dev`;
const JS = { 'Content-Type': 'application/json' };
const POST = (yol, govde, baslik = JS) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: baslik, body: JSON.stringify(govde ?? {}) });

const kayit = await kayitOl(API, {
  email: eposta,
  lordName: `Hsp ${d.toString(36).slice(-3)}`,
});
const h = { ...JS, Authorization: `Bearer ${kayit.token}` };

// --- 1. Parola değiştirme ---
const degistir = await (await POST('/me/parola', { mevcut: 'parola1234', yeni: 'yeniparola99' }, h)).json();
kontrol('Parola değiştirildi', degistir.degistirildi === true);

kontrol(
  'Yeni parolayla giriş yapılıyor',
  (await POST('/auth/login', { email: eposta, password: 'yeniparola99' })).ok,
);
kontrol(
  'Eski parola artık çalışmıyor',
  (await POST('/auth/login', { email: eposta, password: 'parola1234' })).status === 401,
);
kontrol(
  'Yanlış mevcut parolayla değiştirilemiyor',
  (await POST('/me/parola', { mevcut: 'yanlis', yeni: 'baskasi123' }, h)).status === 400,
);

// --- 2. Parola sıfırlama ---
const istek = await (await POST('/auth/sifirlama-iste', { email: eposta })).json();
const yok = await (await POST('/auth/sifirlama-iste', { email: `yok${d}@lordlar.dev` })).json();
kontrol(
  'Kayıtsız adres varlığı sızdırmıyor',
  yok.gonderildi === true && yok.jeton === undefined,
  'kayıtsız adrese de aynı cevap dönüyor',
);
kontrol('Sıfırlama jetonu üretildi', typeof istek.jeton === 'string' && istek.jeton.length > 20);

kontrol(
  'Geçersiz jeton reddediliyor',
  (await POST('/auth/sifirlama-yap', { token: 'x'.repeat(40), password: 'gecersiz123' })).status === 400,
);

const yap = await (await POST('/auth/sifirlama-yap', { token: istek.jeton, password: 'sifirlanan55' })).json();
kontrol('Jetonla yeni parola belirlendi', yap.degistirildi === true);
kontrol(
  'Sıfırlanan parolayla giriş yapılıyor',
  (await POST('/auth/login', { email: eposta, password: 'sifirlanan55' })).ok,
);
kontrol(
  'Jeton tek kullanımlık',
  (await POST('/auth/sifirlama-yap', { token: istek.jeton, password: 'tekrar1234' })).status === 400,
);

// --- 3. Hesap silme ---
const yeniGiris = await (await POST('/auth/login', { email: eposta, password: 'sifirlanan55' })).json();
const h2 = { ...JS, Authorization: `Bearer ${yeniGiris.token}` };

// Bölge al ki silmenin bölgeyi serbest bıraktığını görebilelim
await POST('/test/kaynak-ver', { altin: 900000, demir: 400000, erzak: 400000 }, h2);
await POST('/test/xp-ver', { miktar: 200000 }, h2);
const me0 = await (await fetch(`${API}/api/me`, { headers: h2 })).json();
if (me0.lord.statPoints > 0) await POST('/me/stats', { liderlik: me0.lord.statPoints }, h2);
for (const [t, n] of [['mizrakci', 400], ['okcu', 300]]) {
  await POST('/army/train', { unitType: t, count: n }, h2);
}
await POST('/test/kuyruklari-bitir', {}, h2);
const harita = await (await fetch(`${API}/api/map`, { headers: h2 })).json();
const adaylar = harita.regions.filter((r) => !r.owner && r.type !== 'taht')
  .sort((a, b) => a.distance - b.distance).slice(0, 8);
let alinan = null;
for (const aday of adaylar) {
  const ordu = (await (await fetch(`${API}/api/army`, { headers: h2 })).json()).home;
  const o = await (await POST('/battle/preview', { toRegionId: aday.id, army: ordu }, h2)).json();
  if (o?.tahmin?.eleGecirir !== true) continue;
  await POST('/march', { toRegionId: aday.id, army: ordu }, h2);
  await POST('/test/yuruyusleri-bitir', {}, h2);
  const me = await (await fetch(`${API}/api/me`, { headers: h2 })).json();
  if (me.lord.regionCount > 0) { alinan = aday; break; }
}
kontrol('Silmeden önce bir bölge alındı', Boolean(alinan), alinan?.name ?? 'alınamadı');

const yanlis = await fetch(`${API}/api/me`, {
  method: 'DELETE', headers: h2,
  body: JSON.stringify({ parola: 'yanlis', onay: 'HESABIMI SIL' }),
});
kontrol('Yanlış parolayla silinemiyor', yanlis.status === 400, `HTTP ${yanlis.status}`);

const onaysiz = await fetch(`${API}/api/me`, {
  method: 'DELETE', headers: h2,
  body: JSON.stringify({ parola: 'sifirlanan55', onay: 'sil' }),
});
kontrol('Onay metni birebir istiyor', onaysiz.status === 400, `HTTP ${onaysiz.status}`);

const sil = await fetch(`${API}/api/me`, {
  method: 'DELETE', headers: h2,
  body: JSON.stringify({ parola: 'sifirlanan55', onay: 'HESABIMI SIL' }),
});
kontrol('Hesap silindi', sil.ok, `HTTP ${sil.status}`);
kontrol(
  'Silinen hesapla giriş yapılamıyor',
  (await POST('/auth/login', { email: eposta, password: 'sifirlanan55' })).status === 401,
);

if (alinan) {
  // Bölgeyi başka bir hesapla sorgula: sahipsiz kalmalı, haritadan silinmemeli
  const d2 = Date.now();
  const bakan = await kayitOl(API, {
    email: `bakan${d2}@lordlar.dev`,
    lordName: `Bkn ${d2.toString(36).slice(-3)}`,
  });
  const hb = { ...JS, Authorization: `Bearer ${bakan.token}` };
  const bolge = await (await fetch(`${API}/api/map/${alinan.id}`, { headers: hb })).json();
  kontrol(
    'Silinen lordun bölgesi sahipsiz kaldı, haritadan kaybolmadı',
    bolge.id === alinan.id && bolge.owner === null,
    bolge.owner ? `hâlâ ${bolge.owner.name}` : 'sahipsiz',
  );
}

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
