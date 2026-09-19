/**
 * MEDENİYET DEĞİŞİMİ ve FAYDA RÜTBESİ (docs/16 §13 soru 3, §9).
 *
 * İki boşluk kapandı ve ikisi de sessiz cinstendi:
 *
 *  1. Taraf değiştirmenin mekanizması HİÇ yoktu ve oyuncuya da
 *     söylenmiyordu. Söylenmeyen kural, oyuncunun kafasında "belki
 *     vardır"ı sonsuza kadar yaşatır.
 *  2. Fayda puanı birikiyor ama hiçbir şey yapmıyordu. Biriken ve işe
 *     yaramayan bir sayı, zamanla oyuncunun güvenini yiyor.
 *
 * Buradaki en önemli kontrol üçüncüsü: KALABALIK medeniyete geçilemiyor.
 * Geçilebilseydi nüfus dengesini kuran bütün kural (§10 birinci risk)
 * tek bir düğmeyle çürürdü — değişim, kartopunun en kısa yolu olurdu.
 *
 * SADECE GELİŞTİRME. node tools/medeniyet-degisim-testi.mjs
 */
import { readFileSync } from 'node:fs';
import { kayitOl, onerilenDiyar } from './lib/kayit.mjs';
import { fethedilebilirMi } from './lib/hedef.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const KOK = new URL('..', import.meta.url).pathname;
const DENGE = JSON.parse(readFileSync(`${KOK}data/balance.json`, 'utf8'));
const MEDENIYETLER = DENGE.medeniyetler.liste;
const BEKLEME_GUN = DENGE.medeniyetler.degisim.bekleme_gun;

let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};

console.log('Lordlar Çağı — medeniyet değişimi ve fayda rütbesi\n');

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `deg${damga}@lordlar.dev`,
  lordName: `Deg${damga.toString(36).slice(-4)}`,
  worldId: await onerilenDiyar(API),
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (y, g) =>
  fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then((x) =>
    x.json(),
  );
const get = (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json());

await post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
await post('/test/xp-ver', { miktar: 200000 });
const puan = (await get('/me')).lord.statPoints;
if (puan > 0) await post('/me/stats', { liderlik: puan });

/* --- 1. Rütbe: puanın karşılığı --- */
{
  const m = (await get('/medeniyet')).medeniyet;
  k('Medeniyet panelinde rütbe var', Boolean(m?.rutbe?.ad), m?.rutbe?.ad ?? 'yok');
  k(
    'Sıfır puanlı yeni üyenin de rütbesi var',
    m.faydaPuanim === 0 && Boolean(m.rutbe.ad),
    `${m.faydaPuanim} puan · ${m.rutbe.ad}`,
  );
  k(
    'Bir sonraki rütbe ve eşiği söyleniyor',
    Boolean(m.rutbe.sonrakiAd) && m.rutbe.sonrakiEsik > m.faydaPuanim,
    `${m.rutbe.sonrakiAd} @ ${m.rutbe.sonrakiEsik}`,
  );
  const lord = (await get('/me')).lord;
  k(
    'Lord durumu da aynı rütbeyi taşıyor',
    lord.faydaRutbesi?.ad === m.rutbe.ad,
    `${lord.faydaRutbesi?.ad} vs ${m.rutbe.ad}`,
  );
}

/* --- 2. Fetih: hem toprak hem fayda puanı --- */
let bolge = null;
for (let i = 0; i < 8 && !bolge; i++) {
  const oneri = (await get('/map')).oneri;
  if (!oneri) break;
  if (oneri.eksik?.adet > 0) {
    await post('/army/train', { unitType: oneri.eksik.birim, count: oneri.eksik.adet });
    await post('/test/kuyruklari-bitir');
  }
  const ordu = (await get('/army')).home;
  if (Object.keys(ordu).length === 0) break;
  await post('/march', { toRegionId: oneri.regionId, army: ordu });
  await post('/test/yuruyusleri-bitir');
  await post('/test/yuruyusleri-bitir');
  bolge = (await get('/map')).regions.find((r) => r.isMine && r.type !== 'taht') ?? null;
}
k('Bir bölge fethedildi', Boolean(bolge), bolge?.name ?? 'alınamadı');
const oncekiPuan = (await get('/medeniyet')).medeniyet.faydaPuanim;
k('Fetih fayda puanı kazandırdı', oncekiPuan > 0, `${oncekiPuan} puan`);

/* --- 3. KALABALIK medeniyete geçilemiyor --- */
const panel = (await get('/medeniyet')).medeniyet;
const benim = panel.id;
const acikIdler = panel.degisim.secenekler.map((s) => s.id);
{
  const kapali = MEDENIYETLER.map((x) => x.id).find(
    (id) => id !== benim && !acikIdler.includes(id),
  );
  if (!kapali) {
    console.log('  [ATLANDI] Dört medeniyet de açık — kalabalık reddi ölçülemedi');
  } else {
    const r = await post('/medeniyet/degis', { key: kapali });
    k(
      'Kalabalık medeniyete geçiş REDDEDİLDİ',
      r?.code === 'DEGISIM_OLMAZ',
      `${kapali}: ${r?.error ?? r?.code}`,
    );
    k('Ret sebebi kalabalığı söylüyor', /kalabalık/i.test(r?.error ?? ''), r?.error ?? '');
  }
}

/* --- 4. Açık medeniyete geçiş --- */
const hedef = panel.degisim.secenekler[0];
k('Geçilebilecek bir medeniyet var', Boolean(hedef), hedef?.ad ?? 'yok');
if (!hedef) {
  console.log(`\n${hata + 1} KONTROL KALDI\n`);
  process.exit(1);
}
{
  const r = await post('/medeniyet/degis', { key: hedef.id });
  k('Taraf değiştirildi', r?.medeniyet?.id === hedef.id, r?.error ?? r?.medeniyet?.ad ?? '');
  k('Toprak da taşındı', (r?.tasinanBolge ?? 0) >= (bolge ? 1 : 0), `${r?.tasinanBolge} bölge`);

  const sonra = (await get('/medeniyet')).medeniyet;
  k('Yeni medeniyet panelde görünüyor', sonra.id === hedef.id, sonra.ad);
  k('Fayda puanı SIFIRLANDI', sonra.faydaPuanim === 0, `${oncekiPuan} -> ${sonra.faydaPuanim}`);

  if (bolge) {
    const kart = await get(`/map/${bolge.id}`);
    k(
      'Tuttuğu bölge yeni medeniyete yazıldı',
      kart.medeniyet?.id === hedef.id,
      `${kart.medeniyet?.ad}`,
    );
  }
}

/* --- 5. Bekleme: hemen tekrar değiştirilemiyor --- */
{
  const sonra = (await get('/medeniyet')).medeniyet;
  k(
    'Bekleme sayacı başladı',
    sonra.degisim.kalanGun > 0 && sonra.degisim.kalanGun <= BEKLEME_GUN,
    `${sonra.degisim.kalanGun} gün`,
  );
  const baska = MEDENIYETLER.map((x) => x.id).find((id) => id !== sonra.id);
  const r = await post('/medeniyet/degis', { key: baska });
  k('İkinci değişim REDDEDİLDİ', r?.code === 'DEGISIM_OLMAZ', r?.error ?? '');
  k('Ret sebebi kaç gün kaldığını söylüyor', /gün/.test(r?.error ?? ''), r?.error ?? '');
}

/* --- 6. Yoldaki ordu varken değişim yok --- */
{
  /*
   * ÖNCE GARNİZONU EVE ÇAĞIR: fetih sağ kalan orduyu bölgede bırakıyor
   * (docs/16 §16), yani fetihten sonra "evdeki ordu" boş oluyor ve
   * yürüyüş kurulamıyordu — kontrol sessizce atlanıyordu.
   */
  const harita = await get('/map');
  for (const r of harita.regions.filter((x) => x.isMine)) {
    await post(`/map/${r.id}/garrison`, { army: {} });
  }
  const hedefBolge = harita.regions.filter(fethedilebilirMi)[0];
  const ordu = (await get('/army')).home ?? {};
  if (hedefBolge && Object.keys(ordu).length > 0) {
    await post('/march', { toRegionId: hedefBolge.id, army: ordu });
    const r = await post('/medeniyet/degis', { key: MEDENIYETLER[0].id });
    k(
      'Yoldaki ordu varken değişim yok',
      r?.code === 'ORDU_YOLDA' || r?.code === 'DEGISIM_OLMAZ',
      r?.error ?? r?.code ?? '',
    );
    await post('/test/yuruyusleri-bitir');
  } else {
    console.log('  [ATLANDI] Yürüyüş kurulamadı (ordu ya da hedef yok)');
  }
}

console.log(hata === 0 ? '\nMEDENİYET DEĞİŞİMİ TEMİZ\n' : `\n${hata} KONTROL KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
