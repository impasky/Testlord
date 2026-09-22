/**
 * Eşya pazarı (docs/19) — uçtan uca.
 *
 * Sorulan sorular:
 *
 *   1. İlan ve ön sipariş BULUŞUYOR mu, ve para doğru yere gidiyor mu?
 *      Alıcı ilanın fiyatını ödüyor, satıcının kasasına vergisi düşülmüş
 *      tutar giriyor, eşyanın sahibi değişiyor. Yoktan altın yok.
 *   2. Pazardaki eşya iş göremiyor: kuşanılamıyor, demirhaneye
 *      satılamıyor, envanterde görünmüyor.
 *   3. Sınırlar tutuyor: bant, kademe kilidi, aynı ürüne ikinci emir,
 *      altın yetmezliği, doğrulanmamış hesap.
 *   4. Kenarda gerçekleşen işlem tabanı bir basamak itiyor.
 *   5. Değerli eşya kayıt kuyruğuna giriyor, kuyruktayken geri
 *      çekilemiyor, süre bitince KURA ile tek bir alıcıya gidiyor.
 *   6. Saatlik baskı tabanı kaydırıyor; bant dışında kalan emrin sahibi
 *      haber alıyor.
 *   7. EŞZAMANLI istekler: tek siparişe yetecek altınla on sipariş, aynı
 *      eşyayla on ilan, tek ilana iki alıcı, çapraz ilan-sipariş —
 *      çift harcama yok, kilitlenme yok, sunucu hatası yok.
 *
 * Eşyalar veritabanına DOĞRUDAN konuyor: dövme zarı hangi nadirliğin
 * çıkacağını seçtirmiyor ve sınama belirli bir ürün istiyor.
 *
 * API ayakta olmalı, psql erişilebilir olmalı.
 *   DATABASE_URL=... node tools/esya-pazari-testi.mjs
 */
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { benzersizAd, kayitOl, onerilenDiyar } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const DB = process.env.DATABASE_URL ?? 'postgresql://lordlar@127.0.0.1:5432/lordlar_cagi';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

function sql(ifade) {
  return execSync(`psql "${DB}" -tAq -v ON_ERROR_STOP=1 -f -`, { input: ifade }).toString().trim();
}

const worldId = await onerilenDiyar(API);

async function lord(onek, { dogrula = true, altin = 0 } = {}) {
  const ad = benzersizAd(onek);
  const eposta = `${ad.toLowerCase().replace(/[^a-z0-9]/g, '')}${Date.now()}@lordlar.dev`;
  const { token } = await kayitOl(API, { email: eposta, lordName: ad, worldId, dogrula });
  const bas = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const al = (y) => fetch(`${API}/api${y}`, { headers: bas }).then((r) => r.json());
  const post = (y, g = {}) =>
    fetch(`${API}/api${y}`, { method: 'POST', headers: bas, body: JSON.stringify(g) }).then(
      async (r) => ({ s: r.status, b: await r.json().catch(() => ({})) }),
    );
  if (altin) await post('/test/kaynak-ver', { altin });
  const me = await al('/me');
  return { ad, token, id: me.lord.id, worldId: me.lord.worldId, al, post };
}

/** Lorda doğrudan eşya koyar; kimliğini döndürür. */
function esyaKoy(lordId, { slot = 'kalkan', tier = 1, rarity = 'nadir', upgradeLevel = 0 } = {}) {
  const id = `ept-${randomUUID()}`;
  sql(
    `INSERT INTO "Item" ("id","lordId","slot","tier","rarity","upgradeLevel","equipped","createdAt")
     VALUES ('${id}','${lordId}','${slot}',${tier},'${rarity}',${upgradeLevel},false,now());`,
  );
  return id;
}

const sahibi = (itemId) => sql(`SELECT "lordId" FROM "Item" WHERE id = '${itemId}';`);
const kasa = (lordId) => Number(sql(`SELECT "pazarKasasi" FROM "Lord" WHERE id = '${lordId}';`));
const altin = (lordId) => Number(sql(`SELECT altin FROM "Lord" WHERE id = '${lordId}';`));
const urunSorgu = (u) =>
  `/esya-pazari/urun?slot=${u.slot}&tier=${u.tier}&rarity=${u.rarity}&upgradeLevel=${u.upgradeLevel}`;

console.log('Lordlar Çağı — eşya pazarı testi\n');

/*
 * Ürünler T1 (yeni lord yalnız T1 alabiliyor) ve +0 (ucuz: sınamanın
 * altını yetsin). Her bölüm kendi ürününün defterini BAŞTAN kuruyor:
 * aynı veritabanında önceki bir koşunun bıraktığı emir bu koşunun
 * eşleşmesini bozmasın.
 */
const YUVALAR = ['silah', 'kalkan', 'zirh', 'migfer', 'at', 'sancak'];
const yuva = (n) => YUVALAR[n % YUVALAR.length];
const U = { slot: yuva(0), tier: 1, rarity: 'nadir', upgradeLevel: 0 };

/** Bir grubun (kademe, nadirlik, yükseltme) defterini ve tabanını sıfırlar. */
function grubuSifirla(wid, g) {
  const k = `"worldId"='${wid}' AND tier=${g.tier} AND rarity='${g.rarity}' AND "upgradeLevel"=${g.upgradeLevel}`;
  sql(
    `DELETE FROM "EsyaIlani" WHERE ${k}; DELETE FROM "OnSiparis" WHERE ${k}; DELETE FROM "EsyaFiyati" WHERE ${k};`,
  );
}

// Satıcının ek altına ihtiyacı yok; depo dolu olursa kasadan alamazdı.
const satici = await lord('Satici');
// Depo tavanı 23.000: fazlası ilk tick'te kırpılır ve harcama ölçümünü bozar.
const alici = await lord('Alici', { altin: 15000 });
const alici2 = await lord('Alicii', { altin: 15000 });
kontrol(
  'üç lord aynı diyarda',
  satici.worldId === alici.worldId && alici.worldId === alici2.worldId,
);

const W = satici.worldId;
grubuSifirla(W, U);

// ── 1. İlan → ön sipariş → takas ────────────────────────────────────
console.log('— İlan ve ön sipariş');
const esya1 = esyaKoy(satici.id, U);
const defter = await satici.al(urunSorgu(U));
kontrol(
  'ürün defteri geliyor: taban, bant, on beş basamak',
  defter.taban?.fiyat > 0 && defter.defter?.length === 15,
  `taban ${defter.taban?.fiyat}, bant ${defter.bant?.altFiyat}–${defter.bant?.ustFiyat}`,
);
const T = defter.taban.basamak;

const ilan = await satici.post('/esya-pazari/ilan', { itemId: esya1, basamak: T });
kontrol('ilan açıldı', ilan.s === 200 && ilan.b.durum === 'listede', JSON.stringify(ilan.b));
const envanter = await satici.al('/items');
kontrol('pazardaki eşya envanterde görünmüyor', !envanter.items.some((i) => i.id === esya1));
const kusan = await satici.post(`/items/${esya1}/equip`);
kontrol(
  'pazardaki eşya kuşanılamıyor',
  kusan.s === 400 && kusan.b.code === 'PAZARDA',
  kusan.b.code,
);
const npcSat = await satici.post(`/items/${esya1}/sell`);
kontrol('pazardaki eşya demirhaneye satılamıyor', npcSat.s === 400 && npcSat.b.code === 'PAZARDA');

const altinOnce = altin(alici.id);
const ucuz = await alici.post('/esya-pazari/siparis', { ...U, basamak: T - 2 });
kontrol(
  'ilandan ucuz ön sipariş beklemeye giriyor',
  ucuz.s === 200 && ucuz.b.durum === 'bekliyor',
  JSON.stringify(ucuz.b),
);
kontrol(
  'ön siparişin altını emanete alındı',
  altin(alici.id) <= altinOnce - ucuz.b.fiyat + 50,
  `${altinOnce} → ${altin(alici.id)} (sipariş ${ucuz.b.fiyat})`,
);

const siparisId = (await alici.al('/esya-pazari')).siparislerim?.[0]?.id;
const yukselt = await alici.post(`/esya-pazari/siparis/${siparisId}/fiyat`, { basamak: T + 3 });
kontrol(
  'fiyatı ilanın üstüne çekilen sipariş HEMEN alıyor',
  yukselt.s === 200 && yukselt.b.durum === 'alindi',
  JSON.stringify(yukselt.b),
);
const ilanFiyati = ilan.b.fiyat;
kontrol(
  'alıcı ilanın fiyatını ödüyor, yazdığını değil',
  yukselt.b.fiyat === ilanFiyati,
  `ödenen ${yukselt.b.fiyat}, ilan ${ilanFiyati}`,
);
const harcanan = altinOnce - altin(alici.id) - kasa(alici.id);
kontrol(
  'alıcıdan tam olarak ilan fiyatı çıktı (gelir payı ±50)',
  Math.abs(harcanan - ilanFiyati) <= 50,
  `harcanan ${harcanan}`,
);
kontrol('eşyanın sahibi alıcı', sahibi(esya1) === alici.id);
const net = Math.floor(ilanFiyati * 0.8 + 1e-9);
kontrol(
  'satıcının kasasına vergisi düşülmüş tutar girdi',
  kasa(satici.id) === net,
  `${kasa(satici.id)} = ${net}`,
);

const olaylar = sql(
  `SELECT kind FROM "Event" WHERE "lordId"='${satici.id}' AND kind='esya_satildi';`,
);
kontrol('satıcıya "eşyan satıldı" olayı düştü', olaylar.includes('esya_satildi'));

const altinSatici = altin(satici.id);
const kasaAl = await satici.post('/esya-pazari/kasa/al');
kontrol(
  'kasa depoya alınıyor',
  kasaAl.s === 200 && kasaAl.b.alinan === net && kasa(satici.id) === 0,
  JSON.stringify(kasaAl.b),
);
kontrol('alınan altın depoda', altin(satici.id) - altinSatici >= net - 50);
const bosKasa = await satici.post('/esya-pazari/kasa/al');
kontrol('boş kasa ikinci kez alınamıyor', bosKasa.s === 400 && bosKasa.b.code === 'KASA_BOS');

// ── 2. Kenar işlemi tabanı itiyor ───────────────────────────────────
console.log('— Taban');
const d2 = await satici.al(urunSorgu(U));
const ust = d2.bant.ust;
const alt = d2.bant.alt;
const tavanSiparis = await alici2.post('/esya-pazari/siparis', { ...U, basamak: ust });
kontrol(
  'bandın tavanına ön sipariş',
  tavanSiparis.b.durum === 'bekliyor',
  JSON.stringify(tavanSiparis.b),
);
const esya2 = esyaKoy(satici.id, U);
const dipIlan = await satici.post('/esya-pazari/ilan', { itemId: esya2, basamak: alt });
kontrol(
  'bandın dibine açılan ilan tavandaki siparişin fiyatından satılıyor',
  dipIlan.b.durum === 'satildi' && dipIlan.b.fiyat === d2.bant.ustFiyat,
  JSON.stringify(dipIlan.b),
);
const d3 = await satici.al(urunSorgu(U));
kontrol(
  'tavanda gerçekleşen işlem tabanı bir basamak yükseltti',
  d3.taban.basamak === d2.taban.basamak + 1,
  `${d2.taban.basamak} → ${d3.taban.basamak}`,
);
kontrol(
  'son işlemler listesinde',
  (d3.sonIslemler ?? []).length >= 2,
  `${(d3.sonIslemler ?? []).length} işlem`,
);

// ── 3. Sınırlar ─────────────────────────────────────────────────────
console.log('— Sınırlar');
const esya3 = esyaKoy(satici.id, U);
const disari = await satici.post('/esya-pazari/ilan', { itemId: esya3, basamak: d3.bant.ust + 1 });
kontrol(
  'bant dışı fiyat reddediliyor',
  disari.s === 400 && disari.b.code === 'BANT_DISI',
  disari.b.error ?? disari.b.message,
);
const ondalik = await satici.post('/esya-pazari/ilan', {
  itemId: esya3,
  basamak: d3.taban.basamak + 0.5,
});
kontrol('ondalık basamak Türkçe reddediliyor', ondalik.s === 400 && ondalik.b.code === 'BANT_DISI');
const kademe = await alici.post('/esya-pazari/siparis', {
  ...U,
  tier: 4,
  basamak: 1000,
});
kontrol(
  'seviyenin açmadığı kademe alınamıyor',
  kademe.s === 400 && kademe.b.code === 'KADEME_KILITLI',
  kademe.b.code,
);
const ilanA = await satici.post('/esya-pazari/ilan', { itemId: esya3, basamak: d3.bant.ust });
kontrol(
  'ilan açıldı (alıcısı yok, tavanda bekliyor)',
  ilanA.b.durum === 'listede',
  JSON.stringify(ilanA.b),
);
const esya4 = esyaKoy(satici.id, U);
const ikinci = await satici.post('/esya-pazari/ilan', { itemId: esya4, basamak: d3.bant.ust });
kontrol('aynı ürüne ikinci ilan yok', ikinci.s === 400 && ikinci.b.code === 'AYNI_URUN');
const ikiYon = await satici.post('/esya-pazari/siparis', { ...U, basamak: d3.bant.alt });
kontrol('aynı ürünü hem satıp hem alamıyor', ikiYon.s === 400 && ikiYon.b.code === 'IKI_YON');

const fakir = await lord('Fakir');
sql(`UPDATE "Lord" SET altin = 10 WHERE id = '${fakir.id}';`);
const yetmez = await fakir.post('/esya-pazari/siparis', {
  ...U,
  slot: yuva(1),
  basamak: d3.bant.alt,
});
kontrol(
  'altın yetmezse sipariş yok',
  yetmez.s === 400 && yetmez.b.code === 'ALTIN_YETERSIZ',
  yetmez.b.code,
);

const dogrulanmamis = await lord('Dogrusuz', { dogrula: false, altin: 5000 });
const kapali = await dogrulanmamis.post('/esya-pazari/siparis', {
  ...U,
  slot: yuva(2),
  basamak: d3.bant.alt,
});
kontrol(
  'doğrulanmamış hesap pazarda emir veremiyor',
  kapali.s === 403 && kapali.b.code === 'DOGRULANMADI',
  `HTTP ${kapali.s} ${kapali.b.code}`,
);

// İptal: emanet kesintisiz kasaya.
const iptalEdilecek = await alici.post('/esya-pazari/siparis', {
  ...U,
  slot: yuva(3),
  basamak: d3.bant.alt,
});
const kasaOnce = kasa(alici.id);
const iptal = await alici.post(
  `/esya-pazari/siparis/${(await alici.al('/esya-pazari')).siparislerim.find((s) => s.urun.slot === yuva(3)).id}/iptal`,
);
kontrol(
  'iptal edilen siparişin altını kesintisiz kasaya döndü',
  iptal.s === 200 && kasa(alici.id) - kasaOnce === iptalEdilecek.b.fiyat,
  `${kasaOnce} → ${kasa(alici.id)} (sipariş ${iptalEdilecek.b.fiyat})`,
);

// Geri çek: eşya envantere döner.
const ilanlarim = (await satici.al('/esya-pazari')).ilanlarim;
const geri = await satici.post(`/esya-pazari/ilan/${ilanlarim[0].id}/geri-cek`);
kontrol(
  'geri çekilen ilanın eşyası envantere döndü',
  geri.s === 200 && (await satici.al('/items')).items.some((i) => i.id === esya3),
);

// ── 4. Kayıt kuyruğu ve kura ────────────────────────────────────────
console.log('— Kayıt kuyruğu');
const K = { slot: yuva(4), tier: 1, rarity: 'efsanevi', upgradeLevel: 0 };
grubuSifirla(W, K);
const dk = await satici.al(urunSorgu(K));
kontrol('efsanevi eşya kayıt kuyruğuna tabi', dk.kayitKuyrugu === true);
const degerli = esyaKoy(satici.id, K);
const s1 = await alici.post('/esya-pazari/siparis', { ...K, basamak: dk.bant.ust });
const s2 = await alici2.post('/esya-pazari/siparis', { ...K, basamak: dk.bant.ust });
kontrol('iki alıcı tavanda bekliyor', s1.b.durum === 'bekliyor' && s2.b.durum === 'bekliyor');
const kuyrukIlan = await satici.post('/esya-pazari/ilan', {
  itemId: degerli,
  basamak: dk.bant.alt,
});
kontrol(
  'değerli eşya hemen satılmıyor, kuyruğa giriyor',
  kuyrukIlan.b.durum === 'kuyrukta' && !!kuyrukIlan.b.kuyrukBitis,
  JSON.stringify(kuyrukIlan.b),
);
kontrol('kuyruktaki eşya hâlâ satıcıda', sahibi(degerli) === satici.id);
const kuyrukIlanId = (await satici.al('/esya-pazari')).ilanlarim.find(
  (i) => i.urun.rarity === 'efsanevi',
).id;
const kuyrukGeri = await satici.post(`/esya-pazari/ilan/${kuyrukIlanId}/geri-cek`);
kontrol(
  'kuyruktaki ilan geri çekilemiyor',
  kuyrukGeri.s === 400 && kuyrukGeri.b.code === 'KUYRUKTA',
);

sql(
  `UPDATE "EsyaIlani" SET "kuyrukBitis" = now() - interval '1 second' WHERE id = '${kuyrukIlanId}';`,
);
await satici.post('/test/pazar-turu');
const kazanan = sahibi(degerli);
kontrol(
  'kura çekildi: eşya iki alıcıdan BİRİNE gitti',
  kazanan === alici.id || kazanan === alici2.id,
  kazanan === alici.id ? 'Alıcı 1' : kazanan === alici2.id ? 'Alıcı 2' : kazanan,
);
const kaybeden = kazanan === alici.id ? alici2 : alici;
kontrol(
  'kaybedenin siparişi yerinde bekliyor',
  (await kaybeden.al('/esya-pazari')).siparislerim.some((s) => s.urun.rarity === 'efsanevi'),
);
kontrol(
  'kura işlemi fiyat geçmişinde kura olarak işaretli',
  sql(
    `SELECT kura FROM "EsyaIslemi" WHERE "saticiId"='${satici.id}' AND rarity='efsanevi' ORDER BY "createdAt" DESC LIMIT 1;`,
  ) === 't',
);

// ── 5. Saatlik baskı ve bant dışı haberi ────────────────────────────
console.log('— Saatlik baskı');
const B5 = { slot: yuva(5), tier: 1, rarity: 'usta', upgradeLevel: 0 };
grubuSifirla(W, B5);
const db5 = await alici.al(urunSorgu(B5));
// İki sipariş: biri tabanın üstünde (baskı yapan), biri bandın dibinde
// (taban çıkınca bant dışında kalacak olan).
const baski = await alici.post('/esya-pazari/siparis', { ...B5, basamak: db5.taban.basamak + 2 });
const dip = await alici2.post('/esya-pazari/siparis', { ...B5, basamak: db5.bant.alt });
kontrol('baskı kurulumu', baski.b.durum === 'bekliyor' && dip.b.durum === 'bekliyor');
sql(
  `UPDATE "OnSiparis" SET sira = now() - interval '2 hours' WHERE "lordId" IN ('${alici.id}','${alici2.id}') AND rarity='usta' AND "upgradeLevel"=0;
   UPDATE "EsyaFiyati" SET "sonBaskiAt" = now() - interval '2 hours' WHERE "worldId"='${W}' AND tier=1 AND rarity='usta' AND "upgradeLevel"=0;`,
);
await alici.post('/test/pazar-turu');
const db6 = await alici.al(urunSorgu(B5));
kontrol(
  'ilan yokken tabanın üstünde bekleyen sipariş tabanı bir basamak yükseltti',
  db6.taban.basamak === db5.taban.basamak + 1,
  `${db5.taban.basamak} → ${db6.taban.basamak}`,
);
const haber = sql(
  `SELECT count(*) FROM "Event" WHERE "lordId"='${alici2.id}' AND kind='pazar_bant_disi';`,
);
kontrol('bant dışında kalan siparişin sahibi haber aldı', Number(haber) >= 1, `${haber} olay`);
const disarida = (await alici2.al('/esya-pazari')).siparislerim.find(
  (s) => s.urun.rarity === 'usta',
);
kontrol('siparişi silinmedi, "bant dışı" olarak duruyor', disarida && disarida.bantta === false);
const guncelle = await alici2.post(`/esya-pazari/siparis/${disarida.id}/fiyat`, {
  basamak: db6.bant.alt,
});
kontrol(
  'bant dışı sipariş tek dokunuşla banda alınıyor',
  guncelle.s === 200,
  JSON.stringify(guncelle.b),
);

// ── 6. Eşzamanlılık ─────────────────────────────────────────────────
console.log('— Eşzamanlı istekler');
{
  // Tek siparişe yetecek altın, on farklı ürüne on sipariş.
  // On ürün: T1 sıradan +1'in altı yuvası ve T1 usta +1'in dört yuvası.
  // Fiyatları yakın; en pahalısının parası var, ikisinin parası yok.
  const yaris = await lord('Yaris');
  const urunler = [
    ...YUVALAR.map((slot) => ({ slot, tier: 1, rarity: 'siradan', upgradeLevel: 1 })),
    ...YUVALAR.slice(0, 4).map((slot) => ({ slot, tier: 1, rarity: 'usta', upgradeLevel: 1 })),
  ];
  grubuSifirla(W, urunler[0]);
  grubuSifirla(W, urunler[6]);
  const defterler = [];
  for (const u of urunler) defterler.push(await yaris.al(urunSorgu(u)));
  const fiyat = Math.max(...defterler.map((d) => d.bant.altFiyat));
  const enUcuz = Math.min(...defterler.map((d) => d.bant.altFiyat));
  kontrol('kurulum: iki siparişin parası yok', 2 * enUcuz > fiyat, `${fiyat} / ${enUcuz}`);
  sql(`UPDATE "Lord" SET altin = ${fiyat}, "lastTickAt" = now() WHERE id = '${yaris.id}';`);
  const sonuc = await Promise.all(
    urunler.map((u, i) =>
      yaris.post('/esya-pazari/siparis', { ...u, basamak: defterler[i].bant.alt }),
    ),
  );
  const gecen = sonuc.filter((r) => r.s === 200).length;
  const coken = sonuc.filter((r) => r.s >= 500).length;
  kontrol(
    'tek siparişlik altınla on eşzamanlı siparişten en fazla biri geçti',
    gecen <= 1 && coken === 0,
    `${gecen} geçti, ${coken} sunucu hatası`,
  );
  kontrol('altın eksiye düşmedi', altin(yaris.id) >= 0, `${altin(yaris.id)}`);
}
{
  // Aynı eşyayla on eşzamanlı ilan.
  const E = { slot: yuva(1), tier: 1, rarity: 'kadim', upgradeLevel: 2 };
  grubuSifirla(W, E);
  sql(`DELETE FROM "EsyaIlani" WHERE "lordId"='${satici.id}';`);
  const tek = esyaKoy(satici.id, E);
  const d = await satici.al(urunSorgu(E));
  const sonuc = await Promise.all(
    Array.from({ length: 10 }, () =>
      satici.post('/esya-pazari/ilan', { itemId: tek, basamak: d.bant.ust }),
    ),
  );
  const ilanSayisi = Number(sql(`SELECT count(*) FROM "EsyaIlani" WHERE "itemId"='${tek}';`));
  kontrol(
    'aynı eşyayla on eşzamanlı ilandan tek ilan',
    ilanSayisi === 1 && sonuc.every((r) => r.s < 500),
    `${ilanSayisi} ilan, ${sonuc.filter((r) => r.s >= 500).length} sunucu hatası`,
  );
  sql(`DELETE FROM "EsyaIlani" WHERE "itemId"='${tek}';`);
}
{
  // Tek ilana iki alıcı aynı anda.
  const E = { slot: yuva(2), tier: 1, rarity: 'siradan', upgradeLevel: 0 };
  grubuSifirla(W, E);
  const tek = esyaKoy(satici.id, E);
  const d = await satici.al(urunSorgu(E));
  await satici.post('/esya-pazari/ilan', { itemId: tek, basamak: d.taban.basamak });
  const a1 = await lord('Yarisa', { altin: 15000 });
  const a2 = await lord('Yarisb', { altin: 15000 });
  const once1 = altin(a1.id) + kasa(a1.id);
  const once2 = altin(a2.id) + kasa(a2.id);
  const [r1, r2] = await Promise.all([
    a1.post('/esya-pazari/siparis', { ...E, basamak: d.bant.ust }),
    a2.post('/esya-pazari/siparis', { ...E, basamak: d.bant.ust }),
  ]);
  const alanlar = [r1, r2].filter((r) => r.b.durum === 'alindi').length;
  const bekleyen = [r1, r2].filter((r) => r.b.durum === 'bekliyor').length;
  kontrol(
    'tek ilana iki eşzamanlı alıcı: biri aldı, öteki beklemede',
    alanlar === 1 && bekleyen === 1,
    `${r1.b.durum ?? r1.b.code} / ${r2.b.durum ?? r2.b.code}`,
  );
  const sahip = sahibi(tek);
  kontrol('eşyanın tek sahibi var ve o, alan', sahip === a1.id || sahip === a2.id);
  // Emanet + ödeme toplamı: iki alıcı birlikte "bir ilan fiyatı + bir tavan siparişi" kadar bağladı.
  const bagli = once1 - altin(a1.id) - kasa(a1.id) + (once2 - altin(a2.id) - kasa(a2.id));
  const beklenen = d.taban.fiyat + d.bant.ustFiyat;
  kontrol(
    'iki alıcıdan çıkan altın = ilan fiyatı + bekleyen siparişin emaneti (gelir payı ±100)',
    Math.abs(bagli - beklenen) <= 100,
    `çıkan ${bagli}, beklenen ${beklenen}`,
  );
}
{
  // Çapraz: A ilan açarken B sipariş veriyor, B ilan açarken A sipariş
  // veriyor — iki grup, iki lord, ters sıra. Kilit sırası tutmasa bu
  // kilitlenmeye (deadlock) düşerdi.
  const x = await lord('Caprazx', { altin: 15000 });
  const y = await lord('Caprazy', { altin: 15000 });
  let hatali = 0;
  let takas = 0;
  grubuSifirla(W, { tier: 1, rarity: 'siradan', upgradeLevel: 2 });
  grubuSifirla(W, { tier: 1, rarity: 'usta', upgradeLevel: 2 });
  for (let i = 0; i < 6; i++) {
    const G1 = { slot: YUVALAR[i], tier: 1, rarity: 'siradan', upgradeLevel: 2 };
    const G2 = { slot: YUVALAR[i], tier: 1, rarity: 'usta', upgradeLevel: 2 };
    const d1 = await x.al(urunSorgu(G1));
    const d2x = await x.al(urunSorgu(G2));
    await x.post('/esya-pazari/siparis', { ...G2, basamak: d2x.bant.ust });
    await y.post('/esya-pazari/siparis', { ...G1, basamak: d1.bant.ust });
    const ex = esyaKoy(x.id, G1);
    const ey = esyaKoy(y.id, G2);
    const sonuc = await Promise.all([
      x.post('/esya-pazari/ilan', { itemId: ex, basamak: d1.bant.alt }),
      y.post('/esya-pazari/ilan', { itemId: ey, basamak: d2x.bant.alt }),
    ]);
    hatali += sonuc.filter((r) => r.s >= 500).length;
    takas += sonuc.filter((r) => r.b.durum === 'satildi').length;
  }
  kontrol(
    'çapraz eşzamanlı ilan-sipariş: kilitlenme ve sunucu hatası yok',
    hatali === 0 && takas === 12,
    `${takas}/12 takas, ${hatali} sunucu hatası`,
  );
}

console.log(hata === 0 ? '\nSONUÇ: eşya pazarı çalışıyor.' : `\nSONUÇ: ${hata} kontrol kaldı.`);
process.exit(hata === 0 ? 0 : 1);
