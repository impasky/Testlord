/**
 * General uzmanlığı (docs/09 §2.3).
 *
 * Ölçtüğü:
 *   1. Uzmanlık 10. seviyede açılıyor; altında reddediliyor.
 *   2. İlk seçim bedava ve generalin bonusunu gerçekten değiştiriyor
 *      (`toplamBonus` — savaşla aynı hesap, `aggregateGeneralBonus`).
 *   3. Aynı yolu yeniden seçmek reddediliyor; değiştirmek bedelli ve
 *      bedel altından düşüyor; eski yolun etkisi kalkıyor.
 *   4. Seferdeki generalin yolu değişmiyor; savaş raporu uzmanlığı yazıyor.
 *   5. Arayüz: generalin kartında iki yol, seçilen işaretli.
 *
 * API ve web ayakta olmalı. node tools/general-uzmanlik-testi.mjs
 */
import { kayitOl, onerilenDiyar } from './lib/kayit.mjs';
import { sehriKur } from './lib/ilerlet.mjs';
import { ekrana, rehberiSustur } from './lib/gezin.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { tarayiciAc } from './lib/tarayici.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const GENERAL = 'demirci_yusuf';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — general uzmanlığı\n');

const damga = Date.now().toString(36);
const { token } = await kayitOl(API, {
  email: `gu${damga}@lordlar.dev`,
  lordName: `Gu${damga.slice(-5)}`,
  worldId: await onerilenDiyar(API),
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const al = (y) => fetch(`${API}/api${y}`, { headers: h }).then((r) => r.json());
const gonder = async (y, govde = {}) => {
  const r = await fetch(`${API}/api${y}`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify(govde),
  });
  return { kod: r.status, govde: await r.json().catch(() => null) };
};
const general = async () => (await al('/generals')).kadro.find((g) => g.key === GENERAL);
const bonus = async () => (await al('/generals')).toplamBonus;
const altin = async () => Math.floor((await al('/me')).lord.resources.altin);

await sehriKur(API, token);
await gonder('/test/kaynak-ver', { altin: 60000, demir: 0, erzak: 0 });
await gonder(`/generals/${GENERAL}/hire`);
await gonder(`/generals/${GENERAL}/assign`, { slotIndex: 0 });
const tanim = await general();
const [derin, yan] = tanim.uzmanliklar;

/* 1. Seviye kapısı ------------------------------------------------ */
const erken = await gonder(`/generals/${GENERAL}/uzmanlik`, { uzmanlik: yan.key });
kontrol(
  'Seviye 10 altında uzmanlık reddediliyor',
  erken.kod === 400 && erken.govde?.code === 'SEVIYE_YETERSIZ',
  `${erken.kod} ${erken.govde?.code ?? ''}`,
);
await gonder('/test/general-xp', { key: GENERAL, level: 10, xp: 0 });
kontrol('Seviye 10 olunca uzmanlık açık', (await general()).uzmanlikAcik === true);

/* 2. İlk seçim bedava, bonusu değiştiriyor ----------------------- */
const once = await bonus();
const altinOnce = await altin();
const ilk = await gonder(`/generals/${GENERAL}/uzmanlik`, { uzmanlik: yan.key });
const sonra = await bonus();
kontrol(
  'İlk seçim bedava',
  ilk.kod === 200 && ilk.govde?.bedel === 0 && (await altin()) >= altinOnce,
  `${ilk.kod} bedel ${ilk.govde?.bedel}`,
);
kontrol(
  `"${yan.ad}" bonusu gerçekten ekliyor (${yan.etki})`,
  sonra.orduCan > once.orduCan,
  `can ${once.orduCan.toFixed(3)} → ${sonra.orduCan.toFixed(3)}`,
);

/* 3. Aynısı reddediliyor; değiştirmek bedelli -------------------- */
const ayni = await gonder(`/generals/${GENERAL}/uzmanlik`, { uzmanlik: yan.key });
kontrol('Aynı yol yeniden seçilemiyor', ayni.kod === 400 && ayni.govde?.code === 'ZATEN_SECILI');
const bilinmeyen = await gonder(`/generals/${GENERAL}/uzmanlik`, { uzmanlik: 'yok_boyle' });
kontrol('Bilinmeyen yol reddediliyor', bilinmeyen.govde?.code === 'UZMANLIK_YOK');
const a1 = await altin();
const degis = await gonder(`/generals/${GENERAL}/uzmanlik`, { uzmanlik: derin.key });
const a2 = await altin();
const yeni = await bonus();
kontrol(
  'Değiştirmek bedelli, bedel altından düşüyor',
  degis.kod === 200 &&
    degis.govde?.bedel === tanim.uzmanlikBedeli &&
    a1 - a2 >= tanim.uzmanlikBedeli - 5,
  `bedel ${degis.govde?.bedel}, altın ${a1} → ${a2}`,
);
kontrol(
  'Eski yolun etkisi kalkıyor, yenisi geliyor',
  Math.abs(yeni.orduCan - once.orduCan) < 1e-9 && yeni.orduSavunma > sonra.orduSavunma,
  `can ${yeni.orduCan.toFixed(3)}, savunma ${sonra.orduSavunma.toFixed(3)} → ${yeni.orduSavunma.toFixed(3)}`,
);

/* 4. Seferde değişmiyor; rapor uzmanlığı yazıyor ----------------- */
await gonder('/test/kaynak-ver', { altin: 60000, demir: 60000, erzak: 60000 });
await gonder('/army/train', { unitType: 'mizrakci', count: 20 });
await gonder('/test/kuyruklari-bitir');
const hedef = (await al('/map')).oneri;
const ordu = Object.fromEntries(
  Object.entries((await al('/army')).home ?? {}).filter(([, n]) => (n ?? 0) > 0),
);
const yuru = await gonder('/march', {
  toRegionId: hedef?.regionId,
  army: ordu,
  generalIds: [GENERAL],
});
const seferde = await gonder(`/generals/${GENERAL}/uzmanlik`, { uzmanlik: yan.key });
kontrol(
  'Seferdeki generalin yolu değişmiyor',
  yuru.kod === 200 && seferde.kod === 400 && seferde.govde?.code === 'GENERAL_SEFERDE',
  `${yuru.kod} ${yuru.govde?.code ?? ''} / ${seferde.kod} ${seferde.govde?.code ?? ''}`,
);
await gonder('/test/yuruyusleri-bitir');
const savas = ((await al('/battles')) ?? [])[0];
const rapor = savas ? await al(`/battles/${savas.id}`) : null;
const katki = rapor?.log?.attackerGenerals?.find((g) => g.key === GENERAL);
kontrol(
  'Savaş raporu uzmanlığı yazıyor',
  katki?.uzmanlik?.ad === derin.ad,
  JSON.stringify(katki?.uzmanlik ?? null),
);

/* 5. Arayüz --------------------------------------------------------- */
const tarayici = await tarayiciAc();
const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
await sayfa.goto(WEB, { waitUntil: 'domcontentloaded' });
await sayfa.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await sayfa.reload({ waitUntil: 'domcontentloaded' });
await sayfa.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
await ogreticiyiGec(sayfa);
await rehberiSustur(sayfa);
try {
  await ekrana(sayfa, 'generaller');
  // Demirci bronz rafta.
  await sayfa.getByRole('button', { name: /^Bronz/ }).click();
  await sayfa.waitForTimeout(500);
  const kart = sayfa.locator(`[data-uzmanlik="${derin.key}"]`);
  const secili = kart.locator(`[data-uzmanlik-yolu="${derin.key}"][aria-pressed="true"]`);
  kontrol(
    'Kartta iki yol, seçilen işaretli',
    (await kart.count()) === 1 &&
      (await kart.locator('[data-uzmanlik-yolu]').count()) === 2 &&
      (await secili.count()) === 1,
  );
  await sayfa.screenshot({
    path: `${process.env.CIKTI ?? 'ekran-goruntuleri'}/general-uzmanlik.png`,
  });
} catch (e) {
  kontrol('Generaller ekranına ulaşıldı', false, String(e?.message ?? e).slice(0, 120));
}
await tarayici.close();

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
