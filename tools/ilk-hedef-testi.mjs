/**
 * İlk hedef testi: oyunun yeni oyuncuya verdiği İLK talimat yapılabilir mi?
 *
 * ilk-oturum-testi tek bir oyuncuyla çalışıyor ve bu soruyu tek örnekle
 * cevaplıyor. Ama cevap DOĞUM YERİNE bağlı: kale komşusuyla doğan oyuncuya
 * daha büyük ordu gerekiyor. Ölçünce 40 oyuncunun 10'una (%25) kurulamayacak
 * bir ordu tarif edildiği çıktı — "35 okçu eğit" deniyordu, kesesinde 5000
 * altın vardı, okçular 5250 tutuyordu. Yeni oyuncunun gördüğü ilk talimat
 * duvara çarpıyordu ve tek örnekli test bunu göremiyordu.
 *
 * Bu yüzden test POPÜLASYON ölçüyor: birden çok yeni oyuncu kurar ve
 * hepsinin ilk talimatının yapılabilir olmasını ister. Örnekleme olduğu için
 * sayı önemli — 12 oyuncu, %25'lik bir bozukluğu %97 ihtimalle yakalar.
 *
 * İkinci soru: hedef, oyuncu ona doğru asker eğitirken ELİNDEN KAYIYOR mu?
 * Kayması tek başına hata değil (oyuncu güçlendikçe daha iyi hedefler
 * açılır) ama her adımda gösterilen talimatın YAPILABİLİR kalması şart.
 *
 * SADECE GELİŞTİRME. /api/test/* uçlarını kullanır.
 * API ayakta olmalı. node tools/ilk-hedef-testi.mjs
 */
import { readFileSync } from 'node:fs';

const API = process.env.API_URL ?? 'http://localhost:3000';

// Doğum yerleri SABİT ve SAYILI: pickHomeAnchor ring 4'ten en az yüklü hex'i
// seçiyor, yani art arda gelen kayıtlar bütün çapaları sırayla dolaşıyor.
// Bu yüzden test örneklem değil TAM TARAMA yapabiliyor: çapa sayısı kadar
// oyuncu kurmak her doğum yerini bir kez ziyaret ediyor. Rastgele 12 oyuncu
// denemek yanıltıcıydı — turun neresine denk geldiğine göre bozuk çapaların
// hepsini ıskalayabiliyordu.
const DUNYA = JSON.parse(readFileSync(new URL('../data/world-map.json', import.meta.url), 'utf8'));
const OYUNCU = DUNYA.regions.filter((r) => r.ring === 4).length;

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

async function yeniOyuncu(i) {
  const damga = Date.now() + i * 13;
  const r = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `ilkhedef${damga}@lordlar.dev`,
      password: 'parola1234',
      lordName: `Ilk${damga.toString(36).slice(-5)}`,
    }),
  });
  const { token } = await r.json();
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    post: (yol, govde) =>
      fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) })
        .then((x) => x.json()),
    get: (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json()),
  };
}

console.log(`Lordlar Çağı — ilk hedef testi (${OYUNCU} doğum yeri taranıyor)\n`);

let onerisiz = 0;
let karsilanamayan = 0;
let araAdimKarsilanamayan = 0;
let kazanamayan = 0;
let kayan = 0;
const enPahali = { altin: 0, ad: '' };

for (let i = 0; i < OYUNCU; i++) {
  const o = await yeniOyuncu(i);
  // Taze dünya bir kez kuruluyor: önceki koşuların ele geçirdiği bölgeler
  // komşulukları boşaltıyor. Bu turun oyuncuları saldırmıyor, o yüzden
  // her oyuncu için tekrarlamak gerekmiyor (60 bölgeyi tek tek yazmak
  // testin süresini katlıyordu).
  if (i === 0) await o.post('/test/bolgeleri-sifirla');

  const ilk = (await o.get('/map')).oneri;
  if (!ilk?.eksik) {
    onerisiz++;
    continue;
  }
  if (!ilk.eksik.karsilanabilir) {
    karsilanamayan++;
    if (ilk.eksik.maliyet.altin > enPahali.altin) {
      enPahali.altin = ilk.eksik.maliyet.altin;
      enPahali.ad = `${ilk.name} (${ilk.eksik.adet} ${ilk.eksik.birim})`;
    }
    continue;
  }

  // Talimatın yarısını uygula: ara adımda da yapılabilir bir şey görmeli.
  const yari = Math.max(1, Math.floor(ilk.eksik.adet / 2));
  await o.post('/army/train', { unitType: ilk.eksik.birim, count: yari });
  await o.post('/test/kuyruklari-bitir');

  const orta = (await o.get('/map')).oneri;
  if (orta?.eksik && !orta.eksik.karsilanabilir) araAdimKarsilanamayan++;
  if (orta?.regionId !== ilk.regionId) kayan++;

  // Kalanı da uygula: sonunda gerçekten alınabilir bir hedefe varmalı.
  if (orta?.eksik) {
    await o.post('/army/train', { unitType: orta.eksik.birim, count: orta.eksik.adet });
    await o.post('/test/kuyruklari-bitir');
  }
  const son = (await o.get('/map')).oneri;
  if (son?.kazanir !== true) kazanamayan++;
}

kontrol('Her yeni oyuncuya bir ilk hedef gösteriliyor', onerisiz === 0, `${onerisiz}/${OYUNCU} önerisiz`);
kontrol(
  'İlk talimat mevcut kaynakla YAPILABİLİR',
  karsilanamayan === 0,
  karsilanamayan === 0
    ? `${OYUNCU}/${OYUNCU} oyuncu`
    : `${karsilanamayan}/${OYUNCU} karşılanamıyor — en pahalısı ${enPahali.altin} altın: ${enPahali.ad}`,
);
kontrol(
  'Talimatın yarısı uygulanınca da yapılabilir bir şey gösteriliyor',
  araAdimKarsilanamayan === 0,
  `${araAdimKarsilanamayan}/${OYUNCU} ara adımda tıkanıyor`,
);
kontrol(
  'Talimat tamamlanınca hedef gerçekten alınabilir oluyor',
  kazanamayan === 0,
  `${kazanamayan}/${OYUNCU} hâlâ "alınamaz"`,
);

// Kayma hata değil, ölçü: oyuncu güçlendikçe daha iyi hedefler açılıyor.
// Yine de hepsinin kayması, hedefin oyuncunun altından kaydığı anlamına
// gelirdi — o zaman oyuncu bir plan kuramaz.
kontrol(
  'Hedef oyuncunun altından sürekli kaymıyor',
  kayan < OYUNCU,
  `${kayan}/${OYUNCU} oyuncuda ara adımda hedef değişti`,
);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
