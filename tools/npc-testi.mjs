/**
 * RAKİP LORDLAR gerçekten hareket ediyor mu.
 *
 * Diyar kalabalıktı ama ölüydü: demo lordlar sıralamada bir isim olarak
 * duruyor, hiç saldırmıyor, hiç büyümüyordu. Oyuncu girmediği sürece
 * haritada tek bir şey değişmiyordu.
 *
 * Bu test iki şeyi ölçüyor ve ikisi de "NPC ayrı bir uç değil AYNI
 * motoru kullanıyor" iddiasının sınavı:
 *
 *   1. Sırası gelen NPC gerçek bir YÜRÜYÜŞ başlatıyor mu, ve o yürüyüş
 *      oyuncununkiyle aynı kodla çözülüp bölgeyi el değiştiriyor mu.
 *   2. Koruma kuralları gerçekten tutuyor mu — yeni oyuncu kalkanı
 *      altındaki bir lorda saldırılmıyor.
 *
 * Bir de kapsam kontrolü: oyuncusuz bir dünyada NPC hiç oynamamalı.
 */
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
  if (!r.ok) throw new Error(`${yol} -> ${r.status} ${metin.slice(0, 200)}`);
  return metin ? JSON.parse(metin) : null;
}

async function yeniOyuncu(onek) {
  const ad = benzersizAd(onek);
  const { token } = await kayitOl(API, { email: `${ad.toLowerCase()}@test.local`, lordName: ad });
  return token;
}

/** Evde asker biriktirir: eğit, kuyruğu bitir. */
async function askerYetistir(jeton, tur, adet) {
  await istek('/army/train', jeton, { unitType: tur, count: adet });
  await istek('/test/kuyruklari-bitir', jeton, {});
}

console.log('\nLordlar Çağı — rakip lordlar testi\n');

// ── Hazırlık ─────────────────────────────────────────────────────────
// Rakibin dünyasında gerçek bir oyuncu olmalı: NPC'ler oyuncusuz dünyada
// oynamıyor. İkisi de aynı dünyaya düşüyor (kapasite 120).
const oyuncu = await yeniOyuncu('Sahit');
const rakip = await yeniOyuncu('Rakip');

const oyuncuHarita = await istek('/map', oyuncu);
const rakipHarita = await istek('/map', rakip);
kontrol(
  'İki lord da aynı dünyada',
  oyuncuHarita.regions[0]?.id === rakipHarita.regions[0]?.id,
  `${oyuncuHarita.regions.length} bölge`,
);

// ── 1. Oyuncusuz dünyada NPC oynamaz — henüz kimse NPC değil ──────────
const bosTur = await istek('/test/npc-turu', oyuncu, {});
kontrol('NPC yokken tur boş geçiyor', bosTur.oynayan === 0, `${bosTur.oynayan} oynadı`);

// ── 2. Rakibi NPC yap, ordu ver, sıra ver ────────────────────────────
// Başlangıç altını 5000; 25 mızrakçı + 12 okçu bunun içinde kalıyor ve
// en zayıf köyü almaya yetiyor.
await askerYetistir(rakip, 'mizrakci', 25);
await askerYetistir(rakip, 'okcu', 12);
await istek('/test/npc-yap', rakip, {});

const tur = await istek('/test/npc-turu', oyuncu, {});
kontrol('Sırası gelen NPC bir iş yaptı', tur.oynayan > 0, JSON.stringify(tur.isler));

const yuruyusler = await istek('/marches', rakip);
const yuruyus = yuruyusler[0];
kontrol(
  'NPC gerçek bir yürüyüş başlattı',
  Boolean(yuruyus) && yuruyus.kind === 'attack',
  yuruyus ? `hedef bölge ${yuruyus.toRegionId}, ${yuruyus.distance} adım` : 'yürüyüş yok',
);

if (yuruyus) {
  // ── 3. Yürüyüş oyuncununkiyle AYNI kodla çözülüyor ─────────────────
  const hedefOnce = await istek(`/map/${yuruyus.toRegionId}`, oyuncu);
  await istek('/test/yuruyusleri-bitir', rakip, {});
  const hedefSonra = await istek(`/map/${yuruyus.toRegionId}`, oyuncu);

  // Saldırı çözülünce sağ kalan ordu EVE DÖNÜYOR: yolda bir 'return'
  // yürüyüşü kalması doğru davranış, ölçtüğümüz saldırının bitmesi.
  const kalanlar = await istek('/marches', rakip);
  kontrol(
    'Saldırı yürüyüşü çözüldü',
    kalanlar.every((m) => m.kind !== 'attack'),
    kalanlar.length ? `yolda: ${kalanlar.map((m) => m.kind).join(', ')}` : 'yol boş',
  );
  kontrol(
    'NPC saldırısı bölgeyi el değiştirdi',
    hedefOnce.ownerLordId === null && hedefSonra.ownerLordId !== null,
    `${hedefSonra.name}: sahipsiz -> ${hedefSonra.owner?.name ?? 'sahipli'}`,
  );

  // Savaş kaydı gerçek: NPC ayrı bir çözüm kullanmıyor.
  const savaslar = await istek('/battles', rakip);
  const savas = savaslar[0];
  kontrol(
    'Savaş raporu oluştu',
    Boolean(savas) && savas.regionId === yuruyus.toRegionId,
    savas ? `${savas.result}, fetih: ${savas.captured}` : 'rapor yok',
  );
}

// ── 4. Yeni oyuncu kalkanı NPC'ye de geçerli ─────────────────────────
//
// `oyuncu` az önce kaydoldu, yani 72 saatlik kalkanın altında. NPC ne
// kadar tur atarsa atsın onun bölgesine saldıramaz.
const oyuncuBolgeleri = () =>
  istek('/map', oyuncu).then((h) => h.regions.filter((r) => r.isMine).map((r) => r.id));

const once = await oyuncuBolgeleri();
for (let i = 0; i < 5; i++) {
  await istek('/test/npc-yap', rakip, {}); // sırasını tekrar aç
  await istek('/test/npc-turu', oyuncu, {});
}
const rakipYuruyusleri = await istek('/marches', rakip);
const oyuncuyaGiden = rakipYuruyusleri.filter(
  (m) => m.kind === 'attack' && once.includes(m.toRegionId),
);
kontrol(
  'Korumalı oyuncuya saldırılmadı',
  oyuncuyaGiden.length === 0,
  `${rakipYuruyusleri.length} yürüyüş var, hiçbiri oyuncunun bölgesine değil`,
);

console.log(
  kalan === 0 ? '\nSONUÇ: rakip lordlar hareket ediyor.\n' : `\nSONUÇ: ${kalan} kontrol kaldı.\n`,
);
process.exit(kalan === 0 ? 0 : 1);
