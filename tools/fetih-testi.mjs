/**
 * FETİH — medeniyet kuralları (docs/16 §5, §12 adım 4).
 *
 * Üç kural korunuyor. Üçü de koda yazıldığı gün doğru çalışıyor ama
 * sessizce bozulabilir: hiçbiri hata vermez, yalnız harita zamanla
 * yanlış bir şekle girer.
 *
 *  1. ÇEKİRDEK ELE GEÇİRİLEMEZ. Bozulursa bir medeniyet haritadan
 *     silinebilir ve o medeniyetin bütün oyuncuları oyundan silinmiş
 *     olur (docs/09 kural 6'nın fraksiyon karşılığı).
 *  2. KENDİ MEDENİYETİNE SALDIRAMAZSIN. Medeniyet seçilmiyor,
 *     ATANIYOR; iç savaş çıkarabilmek atanmış bir tarafta olmayı
 *     cezaya çevirirdi.
 *  3. FETİH TOPRAĞI MEDENİYETE YAZIYOR. Yazmazsa harita hiç renk
 *     değiştirmez ve bütün fraksiyon savaşı görünmez olur.
 */
import { kayitOl } from './lib/kayit.mjs';
import { readFileSync } from 'node:fs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const KOK = new URL('..', import.meta.url).pathname;
const DENGE = JSON.parse(readFileSync(`${KOK}data/balance.json`, 'utf8'));
const CEKIRDEKLER = DENGE.medeniyetler.liste.flatMap((m) => m.cekirdek_bolge_id);

let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};

const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `fth${damga}_${etiket}@lordlar.dev`,
    lordName: `Fth${damga.toString(36).slice(-3) + Math.random().toString(36).slice(2, 4)}${etiket}`,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    ham: (yol, govde) =>
      fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) }),
    post: (yol, govde) =>
      fetch(`${API}/api${yol}`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify(govde ?? {}),
      }).then((x) => x.json()),
    get: (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json()),
  };
}

console.log('Lordlar Çağı — fetih ve medeniyet\n');

const l = await lordKur('a');
await l.post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
await l.post('/test/xp-ver', { miktar: 200000 });
const puan = (await l.get('/me')).lord.statPoints;
if (puan > 0) await l.post('/me/stats', { liderlik: puan });
await l.post('/army/train', { unitType: 'mizrakci', count: 250 });
await l.post('/test/kuyruklari-bitir');

const benimMedeniyetim = (await l.get('/me')).lord?.medeniyet?.id ?? null;
k('Lordun medeniyeti var', Boolean(benimMedeniyetim), benimMedeniyetim ?? 'yok');

const harita = await l.get('/map');

/* ---------------------------------------------------------------- */
/* 1. Harita medeniyeti ve çekirdeği bildiriyor                      */
/* ---------------------------------------------------------------- */
const cekirdekler = harita.regions.filter((r) => r.cekirdek);
k(
  `Haritada ${CEKIRDEKLER.length} çekirdek bölge işaretli`,
  cekirdekler.length === CEKIRDEKLER.length,
  `${cekirdekler.length} bölge`,
);
k(
  'Her çekirdeğin bir medeniyeti var',
  cekirdekler.length > 0 && cekirdekler.every((r) => r.medeniyet?.id && r.medeniyet?.renk),
  cekirdekler.find((r) => !r.medeniyet)?.name ?? 'hepsinde var',
);
const sahipsizler = harita.regions.filter((r) => !r.medeniyet);
k(
  'Çekişmeli orta sahipsiz duruyor',
  sahipsizler.length > 0 && sahipsizler.every((r) => !r.cekirdek),
  `${sahipsizler.length} bölge sahipsiz`,
);

/* ---------------------------------------------------------------- */
/* 2. Çekirdeğe saldırı reddediliyor                                 */
/* ---------------------------------------------------------------- */
const cekirdek = cekirdekler.find((r) => r.medeniyet?.id !== benimMedeniyetim) ?? cekirdekler[0];
const ordu = (await l.get('/army')).home;
const c = await l.ham('/march', { toRegionId: cekirdek.id, army: ordu });
const cGovde = await c.json().catch(() => ({}));
k(
  'Çekirdeğe saldırı reddediliyor',
  c.status === 400 && cGovde.code === 'CEKIRDEK_DOKUNULMAZ',
  `HTTP ${c.status} ${cGovde.code ?? ''} — ${cekirdek.name}`,
);

/* ---------------------------------------------------------------- */
/* 3. Sahipsiz yurt bölgesi SERBEST                                  */
/* ---------------------------------------------------------------- */
/*
 * Kural iki yarılı ve ikinci yarı ilk yazdığımda yoktu: medeniyetin
 * tuttuğu ama hiçbir lordun almadığı bölge serbest. Olmasaydı, kampı
 * kendi yurdunda kurulan yeni oyuncunun ÇEVRESİNDEKİ her şey kapalı
 * olurdu ve ilk saldırı 2 dakikadan 1,6 saate çıkardı — `ilk-oturum`
 * sınaması bunu ölçüp kaldı.
 */
const sahipsizYurt = harita.regions.find(
  (r) => r.medeniyet?.id === benimMedeniyetim && !r.cekirdek && r.type !== 'taht' && !r.owner,
);
k('Yurtta sahipsiz bölge var', Boolean(sahipsizYurt), sahipsizYurt?.name ?? 'yok');
if (sahipsizYurt) {
  const o = await l.post('/battle/preview', { toRegionId: sahipsizYurt.id, army: ordu });
  k(
    'Sahipsiz yurt bölgesi hedef alınabiliyor',
    Boolean(o?.tahmin),
    o?.tahmin ? `${sahipsizYurt.name} önizlenebiliyor` : JSON.stringify(o).slice(0, 120),
  );
}

/* ---------------------------------------------------------------- */
/* 4. Fetih toprağı medeniyete yazıyor                               */
/* ---------------------------------------------------------------- */
let alinan = null;
for (let i = 0; i < 8 && !alinan; i++) {
  const oneri = (await l.get('/map')).oneri;
  if (!oneri) break;
  if (oneri.eksik?.adet > 0) {
    await l.post('/army/train', { unitType: oneri.eksik.birim, count: oneri.eksik.adet });
    await l.post('/test/kuyruklari-bitir');
  }
  const simdiki = (await l.get('/army')).home;
  if (Object.keys(simdiki).length === 0) break;
  await l.post('/march', { toRegionId: oneri.regionId, army: simdiki });
  await l.post('/test/yuruyusleri-bitir');
  await l.post('/test/yuruyusleri-bitir');
  alinan = (await l.get('/map')).regions.find((r) => r.isMine && r.type !== 'taht');
}
k('Bir bölge fethedildi', Boolean(alinan), alinan?.name ?? 'alınamadı');
if (alinan) {
  k(
    'Fethedilen bölge artık FATİHİN medeniyetinde',
    alinan.medeniyet?.id === benimMedeniyetim,
    `${alinan.name} → ${alinan.medeniyet?.ad ?? 'sahipsiz'}`,
  );
  // Öneri hiçbir zaman çekirdek göstermemeli: gösterirse omurga oyuncuyu
  // reddedilecek bir saldırıya yollar.
  const oneri = (await l.get('/map')).oneri;
  k(
    'Öneri çekirdek bölge göstermiyor',
    !oneri || !CEKIRDEKLER.includes(harita.regions.find((r) => r.id === oneri.regionId)?.mapId),
    oneri ? `öneri: ${oneri.regionId}` : 'öneri yok',
  );
}

/* ---------------------------------------------------------------- */
/* 5. YOLDAŞIN toprağına saldırı reddediliyor                        */
/* ---------------------------------------------------------------- */
/*
 * Aynı medeniyetten İKİNCİ bir lord gerekiyor: yasak "medeniyetin
 * toprağı" değil, "aynı medeniyetten bir LORDUN toprağı". Kayıt
 * medeniyeti dengeye göre dağıttığı için eşleşen bir çift bulunana
 * kadar lord açılıyor.
 */
if (alinan) {
  let yoldas = null;
  for (let i = 0; i < 8 && !yoldas; i++) {
    const aday = await lordKur(`y${i}`);
    const med = (await aday.get('/me')).lord?.medeniyet?.id ?? null;
    if (med === benimMedeniyetim) yoldas = aday;
  }
  k('Aynı medeniyetten ikinci lord bulundu', Boolean(yoldas));
  if (yoldas) {
    await yoldas.post('/test/kaynak-ver', { altin: 500000, demir: 300000, erzak: 300000 });
    await yoldas.post('/army/train', { unitType: 'mizrakci', count: 60 });
    await yoldas.post('/test/kuyruklari-bitir');
    await yoldas.post('/test/kalkanlari-kaldir');
    const y = await yoldas.ham('/march', {
      toRegionId: alinan.id,
      army: (await yoldas.get('/army')).home,
    });
    const yGovde = await y.json().catch(() => ({}));
    k(
      'Yoldaşın toprağına saldırı reddediliyor',
      y.status === 400 && yGovde.code === 'KENDI_MEDENIYETIN',
      `HTTP ${y.status} ${yGovde.code ?? ''} — ${alinan.name}`,
    );
  }
}

console.log(hata === 0 ? '\nFETİH KURALLARI TEMİZ\n' : `\n${hata} KONTROL KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
