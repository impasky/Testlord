/**
 * Tam oyun döngüsü entegrasyon testi (sunucu API'si üzerinden).
 * API ayakta olmalı. Worker'a gerek yok: kuyruklar test içinde hızlandırılır.
 *
 * node tools/oyun-dongusu-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';
let token = null;
let hata = 0;

async function cagir(yol, opts = {}) {
  const res = await fetch(`${API}/api${yol}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  const metin = await res.text();
  const govde = metin ? JSON.parse(metin) : null;
  if (!res.ok) throw new Error(`${yol} -> ${res.status}: ${govde?.error ?? metin}`);
  return govde;
}
const post = (yol, govde) => cagir(yol, { method: 'POST', body: JSON.stringify(govde ?? {}) });

function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — oyun döngüsü testi\n');

// 1. Kayıt
const damga = Date.now();
({ token } = await post('/auth/register', {
  email: `dongu${damga}@lordlar.dev`,
  password: 'parola1234',
  lordName: `Fatih ${damga}`,
}));
// Testler arası izolasyon: NPC garnizonlarını tabana döndür
await post('/test/bolgeleri-sifirla');
let { lord } = await cagir('/me');
kontrol('Kayıt ve başlangıç durumu', lord.level === 1 && lord.resources.altin === 5000,
  `altın ${lord.resources.altin}`);

// 2. Asker eğitimi
await post('/army/train', { unitType: 'mizrakci', count: 20 });
await post('/army/train', { unitType: 'okcu', count: 15 });
let me = await cagir('/me');
kontrol('Eğitim kuyruğa girdi', me.queues.length === 2, `${me.queues.length} kuyruk`);
kontrol('Maliyet peşin düşüldü', me.lord.resources.altin < 5000,
  `altın ${me.lord.resources.altin}`);

// Kapasite aşımı reddedilmeli
let kapasiteHatasi = null;
try { await post('/army/train', { unitType: 'suvari', count: 500 }); }
catch (e) { kapasiteHatasi = e.message; }
kontrol('Komuta kapasitesi aşımı reddedildi', kapasiteHatasi?.includes('kapasiten'),
  kapasiteHatasi?.slice(0, 60));

// 3. Kuyrukları bitir (test hızlandırması)
await post('/test/kuyruklari-bitir');
me = await cagir('/me');
const ordu = await cagir('/army');
kontrol('Askerler orduya katıldı',
  (ordu.home.mizrakci ?? 0) === 20 && (ordu.home.okcu ?? 0) === 15,
  JSON.stringify(ordu.home));

// 4. Harita
const harita = await cagir('/map');
kontrol('Harita 61 bölge döndü', harita.regions.length === 61);
// Hedefi gerçek oyuncunun yaptığı gibi seçiyoruz: yakın adayları önizleyip
// alınabilecek ilkini buluyoruz. Kale (%30 tahkimat) elenir — 1. gün
// ordusuyla alınamaması bilinçli zorluk farkı.
//
// Neden "en yakın" değil: harita listesi garnizon döndürmüyor, dolayısıyla
// zayıfı listeden seçmek mümkün değil. Sadece en yakını almak testi doğum
// yerine bağlıyordu — lord bir şehrin dibinde doğduğunda 35 kişilik
// başlangıç ordusu şehri alamıyor ve test rastgele kalıyordu.
//
// Kontrol tautoloji değil: docs/00'ın ikinci başarı kriteri "ilk gününde
// bir NPC bölgesi ele geçirebiliyor". Denge bozulup hiçbiri alınamaz hale
// gelirse aday listesi tükenir ve test düşer.
const adaylar = harita.regions
  .filter((r) => r.ring === 4 && !r.owner && r.type !== 'kale')
  .sort((a, b) => a.distance - b.distance)
  .slice(0, 8);

// İlk "ele geçirir" diyeni değil, PAYI EN BÜYÜK olanı seçiyoruz.
//
// Sebep: worker açıkken NPC garnizonları saatte %10 toparlanıyor. Önizleme
// ile yürüyüşün varışı arasında hedef güçlenebiliyor ve kıl payı kazanılacak
// bir savaş kaybedilebiliyor. Bu bir hata değil, oyunun kuralı — ama testi
// kıl payı bir tahmine dayandırmak onu kararsız kılıyordu.
//
// Pay ölçüsü: saldıranın tahmini kaybının azlığı. Az kayıpla kazanılan savaş,
// garnizon biraz toparlansa da kazanılır.
let hedef = null;
let onizleme = null;
let enIyiPay = -1;
const sayi = (a) => Object.values(a ?? {}).reduce((t, n) => t + Number(n || 0), 0);
for (const aday of adaylar) {
  const o = await post('/battle/preview', {
    toRegionId: aday.id, army: { mizrakci: 20, okcu: 15 },
  });
  if (o?.tahmin?.eleGecirir !== true) continue;
  const pay = 35 - sayi(o.tahmin.saldiranKayip);
  if (pay > enIyiPay) {
    enIyiPay = pay;
    hedef = aday;
    onizleme = o;
  }
}
kontrol('Başlangıç ordusuyla alınabilecek bir NPC bölgesi var', Boolean(hedef),
  hedef ? `${hedef.name} (${hedef.type}, ${hedef.distance} hex, pay ${enIyiPay})`
        : `${adaylar.length} aday denendi, hiçbiri alınamıyor`);

const kale = harita.regions.find((r) => r.ring === 4 && !r.owner && r.type === 'kale');
const kaleOnizleme = await post('/battle/preview', {
  toRegionId: kale.id, army: { mizrakci: 20, okcu: 15 },
});
kontrol('Kale aynı orduyla ele geçirilemez (zorluk farkı korunuyor)',
  kaleOnizleme.tahmin.eleGecirir === false,
  `${kale.name}: kazanan ${kaleOnizleme.tahmin.kazanan}`);

// 4b. Bölge detayı liste ucuyla aynı şekli döndürmeli
const detay = await cagir(`/map/${hedef.id}`);
kontrol('Bölge detayı türetilmiş alanları döndürüyor',
  typeof detay.distance === 'number' && typeof detay.shielded === 'boolean' &&
  typeof detay.fortressBonus === 'number',
  `mesafe ${detay.distance}, tahkimat ${detay.fortressBonus}`);

// 5. Savaş önizlemesi (hedef seçilirken alındı)
kontrol('Önizleme zafer ve fetih öngörüyor',
  onizleme.tahmin.kazanan === 'attacker' && onizleme.tahmin.eleGecirir === true,
  `${hedef.type}, ele geçirir: ${onizleme.tahmin.eleGecirir}`);

// 6. Yürüyüş
const yuruyus = await post('/march', {
  toRegionId: hedef.id,
  army: { mizrakci: 20, okcu: 15 },
});
kontrol('Yürüyüş başladı', Boolean(yuruyus.marchId),
  `${Math.round(yuruyus.durationSec / 60)} dk`);

const orduSonra = await cagir('/army');
kontrol('Ordu evden çıktı', (orduSonra.home.mizrakci ?? 0) === 0);

// Yeni oyuncu kalkanı ilk saldırıda düşmeli
me = await cagir('/me');
kontrol('İlk saldırı yeni oyuncu kalkanını düşürdü', me.lord.protectionUntil === null);

// 7. Yürüyüşü vardır ve çöz
await post('/test/yuruyusleri-bitir');
const savaslar = await cagir('/battles');
kontrol('Savaş kaydı oluştu', savaslar.length === 1, savaslar[0]?.result);
kontrol('Bölge ele geçirildi', savaslar[0]?.captured === true);

const haritaSonra = await cagir('/map');
const alinan = haritaSonra.regions.find((r) => r.id === hedef.id);
kontrol('Bölge haritada bana ait görünüyor', alinan?.isMine === true,
  alinan?.owner?.name);

me = await cagir('/me');
// Bölgenin kendi kaynağı malikâne tabanının ÜZERİNE eklenmiş olmalı.
const tabanAlan = { tarla: 'erzak', maden: 'demir', sehir: 'altin' }[hedef.type];
const taban = { altin: 100 + 6 * me.lord.level, demir: 40 + 3 * me.lord.level,
                erzak: 120 + 8 * me.lord.level }[tabanAlan];
kontrol(`Bölge geliri (${hedef.type} -> ${tabanAlan}) gelire eklendi`,
  me.lord.hourlyIncome[tabanAlan] > taban,
  `${Math.round(me.lord.hourlyIncome[tabanAlan])} > malikâne tabanı ${taban}`);
kontrol('Fetihten XP kazanıldı', me.lord.xp > 0 || me.lord.level > 1,
  `seviye ${me.lord.level}, xp ${me.lord.xp}`);

// 8. Korumalar — ordu yürüyüşten dönmediği için önce birkaç asker üret
await post('/test/kaynak-ver', { altin: 50000, demir: 20000, erzak: 20000 });
await post('/army/train', { unitType: 'milis', count: 5 });
await post('/test/kuyruklari-bitir');

let tekrarHatasi = null;
try {
  await post('/march', { toRegionId: hedef.id, army: { milis: 1 } });
} catch (e) { tekrarHatasi = e.message; }
kontrol('Kendi bölgene saldırı reddedildi', tekrarHatasi?.includes('Kendi bölgene'),
  tekrarHatasi?.slice(0, 50));

// 9. Bölge yükseltme
const yukseltme = await post(`/map/${hedef.id}/upgrade`).catch((e) => ({ error: e.message }));
kontrol('Bölge yükseltme kuyruğa girdi', Boolean(yukseltme.queued),
  yukseltme.error ?? '');

// 10. Ekipman
await post('/test/kaynak-ver', { altin: 20000, demir: 10000 });
const ekipman = await cagir('/items');
kontrol('T1 açık, T5 kilitli', ekipman.tiers[0].unlocked && !ekipman.tiers[4].unlocked);
await post('/items/craft', { tier: 1, slot: 'silah' });
await post('/test/kuyruklari-bitir');
const ekipmanSonra = await cagir('/items');
kontrol('Ekipman üretildi', ekipmanSonra.items.length === 1,
  ekipmanSonra.items[0] && `${ekipmanSonra.items[0].rarity} güç ${ekipmanSonra.items[0].power}`);

const esya = ekipmanSonra.items[0];
await post(`/items/${esya.id}/equip`);
me = await cagir('/me');
const kusanikGuc = me.lord.equipmentPower;
kontrol('Ekipman kuşanıldı ve güce yansıdı', kusanikGuc > 0,
  `ekipman gücü ${Math.round(kusanikGuc)}`);

// 11. Ekipman yükseltme — kuşanıkken yükseltilebilmeli ve güce yansımalı.
// Yükseltme kuyruk üzerinden gider, anında bitmez.
const yuk = await post(`/items/${esya.id}/upgrade`);
await post('/test/kuyruklari-bitir');
me = await cagir('/me');
const yukseltilmis = (await cagir('/items')).items.find((i) => i.id === esya.id);
kontrol('Ekipman yükseltildi ve güce yansıdı',
  yukseltilmis?.upgradeLevel > esya.upgradeLevel && me.lord.equipmentPower > kusanikGuc,
  `+${esya.upgradeLevel} -> +${yukseltilmis?.upgradeLevel}, güç ${Math.round(kusanikGuc)} -> ${Math.round(me.lord.equipmentPower)}${yuk?.error ? ` (${yuk.error})` : ''}`);

console.log(hata === 0 ? '\nSONUÇ: oyun döngüsü baştan sona çalışıyor.' : `\nSONUÇ: ${hata} kontrol başarısız.`);
process.exit(hata === 0 ? 0 : 1);
