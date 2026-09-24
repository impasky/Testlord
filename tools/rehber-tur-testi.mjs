/**
 * Zorunlu rehber — BAŞTAN SONA, yalnız ışığa basarak.
 *
 * Oyuncunun bildirdiği hata:
 *
 *   "öğretici olmayan düğmelere tıklamamızı istiyor ve zorunlu eğiticide
 *    takılıp kalıyoruz."
 *
 * `rehber-isigi-testi` ışığın DİLİNİ ölçüyor (delik gerçek mi, perde
 * kapalı mı) ama turu ilk akından sonra API ile ilerletiyordu. Kilitler
 * tam o atlanan kısımdaydı. Bu test turu gerçek oyuncu gibi oynuyor:
 * her adımda ışığın açık bıraktığı TEK öğeye basıyor, başka hiçbir yere
 * dokunmuyor. Sunucuya yalnız ZAMANI ilerletmek için gidiyor (kuyruk,
 * yürüyüş, akın, gelir birikmesi) — oyuncu o sürede sadece bekliyor.
 *
 * Yakaladığı kilitler (docs/08 §rehber):
 *  - ışık, açık bir panelin ARKASINDA kalan düğmeyi gösteriyordu,
 *  - tur ilk bölgeden sonra "eğit → saldır" döngüsüne kilitleniyordu,
 *  - eğitim kuyruktayken ışık aynı "eğit"e bastırmaya devam ediyordu,
 *  - panelde iş bitince ışık sönüp oyuncuyu içeride bırakıyordu,
 *  - Generaller'de yeni oyuncunun alamayacağı generali gösteriyordu,
 *  - paneldeki düğme ekranın kenarında yarım kalıyor, kaydırılmıyordu.
 *
 * SADECE GELİŞTİRME. node tools/rehber-tur-testi.mjs
 */
import { devices } from 'playwright';
import { tarayiciAc } from './lib/tarayici.mjs';
import { kayitOl, benzersizAd } from './lib/kayit.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — zorunlu rehber, baştan sona (iPhone 13)\n');

const { token } = await kayitOl(API, {
  email: `tur${Date.now()}@lordlar.dev`,
  lordName: benzersizAd('Tur'),
});
const baslik = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const uc = (yol, govde) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: baslik, body: JSON.stringify(govde ?? {}) })
    .then((r) => r.json())
    .catch(() => null);
const ben = () =>
  fetch(`${API}/api/me`, { headers: baslik })
    .then((r) => r.json())
    .then((j) => j.lord);

const tarayici = await tarayiciAc();
const ctx = await tarayici.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const konsol = [];
page.on('console', (m) => m.type() === 'error' && konsol.push(m.text()));

await page.goto(WEB, { waitUntil: 'domcontentloaded' });
await page.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await page.reload({ waitUntil: 'domcontentloaded' });

// Öğretici: oyuncu gibi "Devam" ile sonuna kadar.
const ogretici = page.locator('[role=dialog][aria-label="Öğretici"]');
await ogretici.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
for (let i = 0; i < 20 && (await ogretici.isVisible().catch(() => false)); i++) {
  await ogretici
    .locator('button:has-text("Devam"), button:has-text("Diyarıma dön")')
    .last()
    .click();
  await page.waitForTimeout(250);
}
kontrol('Öğretici "Devam" ile sonuna kadar okunup kapandı', !(await ogretici.isVisible()));
await page.waitForTimeout(2000);

/** Işığın o anki hâli: perde var mı, delikte hangi işaret duruyor. */
const isik = () =>
  page.evaluate(() => {
    const perde = document.querySelectorAll('[data-rehber-perde]').length > 0;
    const omurga = document.querySelector('[data-omurga-serit]')?.textContent?.trim() ?? '';
    if (!perde) return { perde, omurga };
    const hedef = [...document.querySelectorAll('[data-rehber]')].find((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      const u = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(u && (e === u || e.contains(u)));
    });
    const r = hedef?.getBoundingClientRect();
    return {
      perde,
      omurga,
      isaret: hedef?.getAttribute('data-rehber') ?? null,
      metin: hedef?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 40) ?? '',
      x: r ? r.left + r.width / 2 : 0,
      y: r ? r.top + r.height / 2 : 0,
    };
  });

/** Zaman geçsin: kuyruklar, yürüyüşler, akınlar, biraz da gelir. */
const zamanGecsin = async (gelir) => {
  await uc('/test/kuyruklari-bitir');
  await uc('/test/yuruyusleri-bitir');
  await uc('/test/akinlari-bitir');
  if (gelir) await uc('/test/kaynak-ver', { altin: 30000, demir: 15000, erzak: 15000 });
  // Sekmeye dönülmüş gibi: bayat sorgular tazelenir (oyuncu en çok 30 sn bekler).
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(3500);
};

const basilan = [];
let ayniBasis = 0;
let deliksiz = 0;
let isiksiz = 0;
let onceki = '';
let kilit = null;
let turBitti = false;

for (let t = 0; t < 150 && !kilit; t++) {
  const d = await isik();
  if (!d.perde) {
    deliksiz = 0;
    const lord = await ben();
    if (lord?.rehberGorundu) {
      turBitti = true;
      break;
    }
    // Perde yok ama tur bitmedi: bir bekleyiş (akın, yürüyüş, kaynak).
    isiksiz++;
    if (isiksiz > 8) kilit = `perde ${isiksiz} bekleyişte geri gelmedi · omurga="${d.omurga}"`;
    await zamanGecsin(isiksiz > 1);
    continue;
  }
  isiksiz = 0;
  if (!d.isaret) {
    // Perde var, basılacak delik yok: kısa bir yükleme boşluğu olabilir,
    // sürerse oyuncu hiçbir yere basamıyor demektir.
    deliksiz++;
    if (deliksiz > 10) kilit = `perde var, delik yok · omurga="${d.omurga}"`;
    await zamanGecsin(false);
    continue;
  }
  deliksiz = 0;
  // Işık hedefi yumuşak kaydırmayla ortaya getiriyor: oyuncu delik
  // yerine oturunca basar. Kayarken basmak parmağı boşa düşürürdü.
  await page.waitForTimeout(400);
  const d2 = await isik();
  if (d2.isaret !== d.isaret || Math.abs(d2.x - d.x) > 2 || Math.abs(d2.y - d.y) > 2) continue;
  const imza = `${d.isaret}|${d.metin}|${d.omurga}`;
  ayniBasis = imza === onceki ? ayniBasis + 1 : 0;
  onceki = imza;
  if (ayniBasis >= 2) {
    kilit = `"${d.isaret}" (${d.metin}) üç kez basıldı, hiçbir şey değişmedi`;
    break;
  }
  basilan.push(d.isaret);
  await page.mouse.click(d.x, d.y);
  await page.waitForTimeout(1600);
}

if (kilit) await page.screenshot({ path: '/tmp/rehber-tur-kilit.png' });
kontrol('Tur hiçbir yerde kilitlenmedi', kilit === null, kilit ?? `${basilan.length} dokunuş`);
kontrol('Tur BİTTİ (yedi aşama)', turBitti);

// Her aşamanın İŞ düğmesine ışık gerçekten götürdü mü.
const beklenen = {
  'asker eğitimi': ['kisla-egit'],
  akın: ['akina-cik'],
  'ilk bölge': ['harita-saldir'],
  ekipman: ['demirhane-kusan'],
  general: ['general-kirala'],
  'bölge geliştirme': ['bolge-yukselt'],
  araştırma: ['arastirma-baslat'],
};
for (const [asama, isaretler] of Object.entries(beklenen)) {
  kontrol(
    `Işık ${asama} düğmesini gösterdi`,
    isaretler.some((i) => basilan.includes(i)),
    isaretler.join(' / '),
  );
}
kontrol(
  'Işık hiçbir düğmeyi arka arkaya iki kez göstermedi (boşa bastırma yok)',
  basilan.every((x, i) => i === 0 || x !== basilan[i - 1] || x === 'kapi-kapat'),
  basilan.join(' → '),
);
kontrol('Konsolda hata yok', konsol.length === 0, konsol.slice(0, 2).join(' | '));

await tarayici.close();
console.log(hata ? `\n${hata} KONTROL KALDI` : '\nTÜM KONTROLLER GEÇTİ');
process.exit(hata ? 1 : 0);
