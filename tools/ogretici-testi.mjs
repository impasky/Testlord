/**
 * Öğretici testi: yeni lord ilk girdiğinde öğreticiyi GÖRÜYOR, geçince
 * bir daha görmüyor, Hesap ekranından tekrar açabiliyor.
 *
 * Tarayıcı testi olması şart: öğreticinin bütün değeri ilk saniyede ekranı
 * kaplamasında. Sunucu bayrağı doğru dönse bile arayüz onu açmazsa öğretici
 * yok demektir — bunu ancak gerçek bir sayfada görürüz.
 *
 * API ve web ayakta olmalı. node tools/ogretici-testi.mjs
 */
import { tarayiciAc } from './lib/tarayici.mjs';
import { ekrana, rehberiSustur } from './lib/gezin.mjs';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
// Varsayılan çıktı klasörü: ekran görüntüleri deponun köküne düşmesin.
// Kökteyken her test koşusu 20 MB'lık PNG'yi 'değişti' diye işaretliyordu ve
// bu üretilen dosyalar depoya girmişti. Klasör .gitignore'da.
const CIKTI = process.env.CIKTI ?? 'ekran-goruntuleri';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — öğretici testi (iPhone 13)\n');

const tarayici = await tarayiciAc();
const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
const konsolHatalari = [];
sayfa.on('console', (m) => m.type() === 'error' && konsolHatalari.push(m.text()));

await sayfa.goto(WEB, { waitUntil: 'domcontentloaded' });
await sayfa.waitForSelector('input[type=email]', { timeout: 15000 });
const damga = Date.now();
await sayfa.fill('input[placeholder="Kara Yusuf"]', `Ogr ${damga.toString(36).slice(-4)}`);
await sayfa.fill('input[type=email]', `ogretici${damga}@lordlar.dev`);
await sayfa.fill('input[type=password]', 'parola1234');
await sayfa.click('button[type=submit]');

// --- 1. Yeni lord öğreticiyi görüyor
const ogretici = sayfa.locator('[role=dialog][aria-label="Öğretici"]');
await ogretici.waitFor({ timeout: 20000 }).catch(() => {});
kontrol('Yeni lord öğreticiyi görüyor', await ogretici.isVisible());
await sayfa.screenshot({ path: `${CIKTI}/ogretici-1-ilk.png` });

// --- 2. Sayfalar gerçekten ilerliyor ve içerik doluyor
const ilkBaslik = await sayfa.locator('[role=dialog] h2').innerText();
const sayfaSayisi = Number(
  (await sayfa.locator('[role=dialog] p').first().innerText()).split('/')[1],
);
kontrol('Sayfa sayacı okunuyor', sayfaSayisi >= 6, `${sayfaSayisi} sayfa`);

await sayfa.getByRole('button', { name: 'Devam' }).click();
const ikinciBaslik = await sayfa.locator('[role=dialog] h2').innerText();
kontrol('Devam sayfayı ilerletiyor', ikinciBaslik !== ilkBaslik, `${ilkBaslik} -> ${ikinciBaslik}`);

// Ortadaki bir sayfada taş-kağıt-makas gerçekten anlatılıyor mu: öğreticinin
// tek somut STRATEJİ dersi bu.
let karsiGorundu = false;
for (let i = 2; i < sayfaSayisi; i++) {
  const metin = await sayfa.locator('[role=dialog]').innerText();
  if (/Mızrakçı → Süvari/.test(metin)) {
    karsiGorundu = true;
    await sayfa.screenshot({ path: `${CIKTI}/ogretici-2-ordu.png` });
    break;
  }
  await sayfa.getByRole('button', { name: 'Devam' }).click();
  await sayfa.waitForTimeout(150);
}
kontrol('Taş-kağıt-makas öğreticide anlatılıyor', karsiGorundu);

// Her sayfayı çek: bir öğreticinin tek gerçek testi okunabilirliği ve
// bunu ancak göze bakarak anlarız. Aynı geçişte içeriğin boş olmadığını
// da doğruluyoruz.
if (process.env.TUM_SAYFALAR === '1') {
  for (let i = 0; i < sayfaSayisi; i++) {
    const geri = sayfa.getByRole('button', { name: 'Geri' });
    if (await geri.isEnabled()) await geri.click();
    else break;
    await sayfa.waitForTimeout(120);
  }
  for (let i = 1; i <= sayfaSayisi; i++) {
    await sayfa.screenshot({ path: `${CIKTI}/ogretici-s${i}.png` });
    const govde = await sayfa.locator('[role=dialog]').innerText();
    kontrol(`Sayfa ${i} dolu`, govde.length > 200, `${govde.length} karakter`);
    if (i < sayfaSayisi) {
      await sayfa.getByRole('button', { name: 'Devam' }).click();
      await sayfa.waitForTimeout(180);
    }
  }
}

// --- 3. Geç: öğretici kapanıyor ve oyun görünüyor
await sayfa.getByRole('button', { name: 'Öğreticiyi geç' }).click();
await sayfa.waitForTimeout(500);
kontrol('Geç düğmesi öğreticiyi kapatıyor', !(await ogretici.isVisible()));
await sayfa.waitForSelector('nav button:has-text("Şehir")', { timeout: 15000 });
kontrol('Öğreticiden sonra oyun açılıyor', true);

// --- 4. Yenilemede geri GELMİYOR. Asıl kural bu: geçtiğini söyleyen
// oyuncuya aynı ekranı tekrar göstermek öğreticiyi cezaya çevirir.
await sayfa.reload({ waitUntil: 'domcontentloaded' });
await sayfa.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
await sayfa.waitForTimeout(1200);
kontrol('Yenilemede öğretici geri gelmiyor', !(await ogretici.isVisible()));

// --- 5. Hesap ekranından tekrar açılabiliyor
// Öğretici kapandı, sıra rehber ışığında: ekranı karartıp tek düğmeyi
// açıkta bırakıyor ve menüyü bilerek engelliyor. Buradan sonrası "oyunu
// öğrenmiş oyuncu" senaryosu (Hesap ekranından öğreticiyi tekrar açmak),
// o yüzden rehber ürünün kendi ucundan kapatılıyor.
await rehberiSustur(sayfa);
await sayfa.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
// Hesap artık Lord sekmesinin içinde bir KAPI (panel).
await ekrana(sayfa, 'hesap', 800);
const tekrarDugmesi = sayfa.getByRole('button', { name: 'Öğreticiyi tekrar oku' });
kontrol('Hesap ekranında "tekrar oku" var', await tekrarDugmesi.isVisible());
await tekrarDugmesi.click();
await ogretici.waitFor({ timeout: 10000 }).catch(() => {});
kontrol('Öğretici tekrar açılıyor', await ogretici.isVisible());

// --- 6. Öğretici hiçbir yere GÖTÜRMÜYOR
//
// Sayfalarda "ŞİMDİ ORAYA BAK" diye bir düğme vardı; öğreticiyi yarıda
// kapatıp bir sekmeye atlıyordu. Oyuncu kaldırılmasını istedi ve gerekçe
// şuydu: iki katman aynı anda oyuncuyu farklı yerlere çekiyordu. Artık
// öğretici yalnız ANLATIYOR, götürme işi zorunlu rehberin.
kontrol(
  'Öğreticide "oraya bak" düğmesi YOK',
  !(await sayfa.getByRole('button', { name: /ORAYA BAK/i }).isVisible()),
);

kontrol('Konsol hatası yok', konsolHatalari.length === 0, konsolHatalari[0] ?? '');

await tarayici.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
