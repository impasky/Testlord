/**
 * Vadesi gelmiş işler OKUMA yolunda çözülüyor mu?
 *
 * Bir oyuncu gerçek dağıtımda şu ekranı gönderdi:
 *
 *   "EĞİTİMDE 26 — bitti"   ama   "Evde 0", "0/90 komuta"
 *
 * Eğitim bitmişti, askerler orduya hiç katılmamıştı. Sebebi worker'ın
 * uyuması: tek servisli dağıtımda API uykuya dalınca arka plan işçisi de
 * uyuyor. Sonuç zincirleme: omurga haklı olarak "hâlâ ordun yok, asker
 * eğit" diyor, altın o eğitime gittiği için düğme kapalı, rehber ışığı da
 * basılabilir düğme bulamayıp sönüyor. Oyuncu ne düğme ne açıklama olan
 * bir ekranda kalıyor ve "öğretici bu şekilde ekranda kalıyor" diyor.
 *
 * Artık her `/me` okuması o lordun gecikmiş işlerini kapatıyor. Bu araç
 * worker'a HİÇ dokunmadan onu ölçüyor: kuyruğun vadesi geçmişe alınıyor
 * (çözülmeden), sonra tek bir /me çağrısı yapılıyor.
 *
 * SADECE GELİŞTİRME. node tools/kuyruk-cozulme-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — gecikmiş iş çözülme testi\n');

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `kyr${damga}@lordlar.dev`,
  lordName: `Kyr ${damga.toString(36).slice(-4)}`,
});
const bas = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const gonder = (yol, govde = {}) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: bas, body: JSON.stringify(govde) }).then((r) =>
    r.json(),
  );
const oku = (yol) => fetch(`${API}/api${yol}`, { headers: bas }).then((r) => r.json());

// --- Eğitim başlat ---
const egitim = await gonder('/army/train', { unitType: 'milis', count: 10 });
kontrol('Eğitim kuyruğa girdi', egitim.queued === true, JSON.stringify(egitim).slice(0, 90));

const once = await oku('/me');
kontrol('Kuyruk /me yanıtında görünüyor', (once.queues ?? []).length === 1,
  `${(once.queues ?? []).length} kuyruk`);
const evdeOnce = Object.values(once.lord?.homeArmy ?? {}).reduce((t, n) => t + (n ?? 0), 0);
kontrol('Askerler henüz evde DEĞİL', evdeOnce === 0, `${evdeOnce} asker`);

/**
 * "Worker uyuyakaldı" hâli: vade geçti, kimse çözmedi.
 * Ekran görüntüsündeki durum birebir bu.
 */
const vade = await gonder('/test/kuyruklari-vadesinde-birak');
kontrol('Kuyruğun vadesi geçti (çözülmeden)', vade.vadesiGecen === 1,
  `${vade.vadesiGecen} kuyruk`);

// --- TEK bir /me çağrısı ---
const sonra = await oku('/me');
const evdeSonra = Object.values(sonra.lord?.homeArmy ?? {}).reduce((t, n) => t + (n ?? 0), 0);

kontrol('Tek /me çağrısı askerleri orduya kattı', evdeSonra === 10, `${evdeSonra} asker`);
kontrol('Biten kuyruk artık listede değil', (sonra.queues ?? []).length === 0,
  `${(sonra.queues ?? []).length} kuyruk`);
kontrol('Komuta kapasitesi de güncellendi', (sonra.lord?.usedSlots ?? 0) > 0,
  `${sonra.lord?.usedSlots} yer`);

/**
 * İdempotenslik: ikinci okuma askerleri İKİ KEZ vermemeli. `resolved`
 * bayrağı koşullu yazıldığı için veremez, ama okuma yoluna taşınan bir
 * işte bunu ölçmeden geçmek olmaz — her /me çağrısı bu kodu çalıştırıyor.
 */
const ucuncu = await oku('/me');
const evdeUcuncu = Object.values(ucuncu.lord?.homeArmy ?? {}).reduce((t, n) => t + (n ?? 0), 0);
kontrol('İkinci okuma askerleri tekrar vermiyor', evdeUcuncu === 10, `${evdeUcuncu} asker`);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
