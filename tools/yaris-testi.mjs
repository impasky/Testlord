/**
 * Yarış testi: aynı anda gelen istekler aynı kaynağı iki kez harcayamaz.
 *
 * NEDEN VAR — ölçülmüş bir açık. İşlemler lordu okuyup kontrol edip
 * düşüyordu ve arada kilit yoktu: iki istek aynı eski bakiyeyi okuyup
 * ikisi de "yetiyor" diyordu. Yalnız BİR eğitime yetecek 1.620 altınla
 * aynı anda gönderilen on eğitimden dördü geçti, son bakiye 540 kaldı —
 * üç eğitim bedava. Düzeltme `services/kilit.ts`te.
 *
 * Her senaryo aynı kalıpta: kaynağı TAM BİR işleme yetecek kadar bırak,
 * aynı anda on işlem gönder, TAM BİRİNİN geçtiğini ve bakiyenin eksiye
 * düşmediğini ölç. Tek istekle ölçen bir test bu açığı hiçbir zaman
 * göremezdi; açık yalnızca eşzamanlılıkta var.
 *
 * API ayakta olmalı. node tools/yaris-testi.mjs
 */
import { benzersizAd, kayitOl } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const N = 10;

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

async function yeniLord(onek) {
  const ad = benzersizAd(onek);
  const { token } = await kayitOl(API, {
    email: `${ad.toLowerCase().replace(/[^a-z0-9]/g, '')}${Date.now()}@lordlar.dev`,
    lordName: ad,
  });
  const bas = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const al = (y) => fetch(`${API}/api${y}`, { headers: bas }).then((r) => r.json());
  // `/me` lordu `lord` alanının altında döndürüyor.
  const lord = () => al('/me').then((j) => j.lord);
  const post = (y, g = {}) =>
    fetch(`${API}/api${y}`, { method: 'POST', headers: bas, body: JSON.stringify(g) }).then(
      async (r) => ({ s: r.status, b: await r.json().catch(() => ({})) }),
    );
  return { al, post, lord };
}

/** Kaynağı hedef değere çeker (kaynak-ver ekliyor; farkı veriyoruz). */
async function kaynagiAyarla(l, hedef) {
  const r = (await l.lord()).resources;
  await l.post('/test/kaynak-ver', {
    altin: (hedef.altin ?? r.altin) - Math.floor(r.altin),
    demir: (hedef.demir ?? r.demir) - Math.floor(r.demir),
    erzak: (hedef.erzak ?? r.erzak) - Math.floor(r.erzak),
  });
  return (await l.lord()).resources;
}

const ayni = (istekler) => Promise.all(istekler.map((f) => f()));
const gecenler = (sonuclar) => sonuclar.filter((x) => x.s === 200 || x.s === 201).length;
const sunucuHatasi = (sonuclar) => sonuclar.filter((x) => x.s >= 500).length;

console.log('Lordlar Çağı — yarış testi\n');

// ── 1. Eğitim: kaynak iki kez harcanamaz ──────────────────────────────
{
  const l = await yeniLord('Yaris');
  const ordu = await l.al('/army');
  const u = ordu.units.find((x) => x.type === 'mizrakci');
  // Kapasite on partiye yetsin; engel yalnız KAYNAK olsun.
  const adet = Math.max(1, Math.floor((ordu.commandCapacity - ordu.usedSlots) / N / u.yer));
  const parti = u.maliyet.altin * adet;
  const once = await kaynagiAyarla(l, { altin: Math.floor(parti * 1.5) });
  const s = await ayni(
    Array.from(
      { length: N },
      () => () => l.post('/army/train', { unitType: 'mizrakci', count: adet }),
    ),
  );
  const son = (await l.lord()).resources;
  kontrol(
    'Eğitim: bir partiye yeten altınla on eşzamanlı istekten biri geçiyor',
    gecenler(s) === 1,
    `${gecenler(s)}/${N} geçti`,
  );
  kontrol('Eğitim: sunucu hatası yok (kilit bekletiyor, öldürmüyor)', sunucuHatasi(s) === 0);
  kontrol(
    'Eğitim: altın bir partilik düştü, eksiye inmedi',
    son.altin >= 0 && son.altin <= once.altin - parti + 5,
    `${Math.floor(once.altin)} -> ${Math.floor(son.altin)} (parti ${parti})`,
  );
}

// ── 2. Pazar: kaynak ve günlük tavan iki kez harcanamaz ───────────────
{
  const l = await yeniLord('Tuccar');
  const pazar = await l.al('/pazar');
  const miktar = 1000;
  await kaynagiAyarla(l, { altin: 1500 });
  const s = await ayni(
    Array.from(
      { length: N },
      () => () => l.post('/pazar/takas', { veren: 'altin', alan: 'demir', miktar }),
    ),
  );
  const son = (await l.lord()).resources;
  kontrol('Pazar: bir takasa yeten altınla biri geçiyor', gecenler(s) === 1, `${gecenler(s)}/${N}`);
  kontrol('Pazar: altın eksiye inmedi', son.altin >= 0, `son ${Math.floor(son.altin)}`);

  // Günlük tavan: her biri tavanın %60'ı — yalnız biri sığar. Kaynak bol,
  // engel yalnız TAVAN olsun.
  const tavan = pazar.gunluk.tavan;
  const buyuk = Math.floor((tavan * 0.6) / pazar.kurlar.demir);
  const l2 = await yeniLord('Tuccar');
  await kaynagiAyarla(l2, { demir: buyuk * 3 });
  const t = await ayni(
    Array.from(
      { length: N },
      () => () => l2.post('/pazar/takas', { veren: 'demir', alan: 'altin', miktar: buyuk }),
    ),
  );
  const d = await l2.al('/pazar');
  kontrol(
    'Pazar: günlük tavan eşzamanlı isteklerle aşılamıyor',
    gecenler(t) === 1 && d.gunluk.kullanilan <= d.gunluk.tavan,
    `${gecenler(t)}/${N} geçti, kullanılan ${d.gunluk.kullanilan}/${d.gunluk.tavan}`,
  );
}

// ── 3. Stat puanı iki kez dağıtılamaz ─────────────────────────────────
{
  const l = await yeniLord('Yaris');
  await l.post('/test/xp-ver', { miktar: 5000 });
  const puan = (await l.lord()).statPoints;
  const s = await ayni(Array.from({ length: N }, () => () => l.post('/me/stats', { guc: puan })));
  const me = await l.lord();
  kontrol(
    'Stat: bütün puanı isteyen on eşzamanlı istekten biri geçiyor',
    puan > 0 && gecenler(s) === 1 && me.statPoints === 0,
    `${puan} puan, ${gecenler(s)}/${N} geçti, kalan ${me.statPoints}`,
  );
}

// ── 4. Okuma, harcamayı ezemez ────────────────────────────────────────
//
// `/me` her çağrıda geliri işleyip bakiyeyi MUTLAK değer olarak yazıyor.
// Kilitsizken, harcamayla aynı anda gelen bir `/me` eski bakiyeyi geri
// yazıp harcamayı silebiliyordu — bu kez bedeli oyuncu değil oyun
// ödüyordu ve kimse bir şey yapmamış görünüyordu.
{
  const l = await yeniLord('Yaris');
  const ordu = await l.al('/army');
  const u = ordu.units.find((x) => x.type === 'mizrakci');
  const once = await kaynagiAyarla(l, { altin: 3000 });
  const [egitim] = await ayni([
    () => l.post('/army/train', { unitType: 'mizrakci', count: 5 }),
    ...Array.from({ length: N }, () => () => l.lord().then(() => ({ s: 0 }))),
  ]);
  const son = (await l.lord()).resources;
  const beklenen = once.altin - u.maliyet.altin * 5;
  kontrol(
    'Eşzamanlı /me okumaları harcamayı geri almıyor',
    egitim.s === 200 && Math.abs(son.altin - beklenen) <= 5,
    `beklenen ~${Math.floor(beklenen)}, son ${Math.floor(son.altin)}`,
  );
}

console.log(
  hata === 0
    ? '\nSONUÇ: eşzamanlı istekler kaynağı çoğaltamıyor.'
    : `\nSONUÇ: ${hata} kontrol kaldı.`,
);
process.exit(hata === 0 ? 0 : 1);
