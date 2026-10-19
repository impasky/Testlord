/**
 * HARİTA DOKUNMA JESTLERİ — gerçek parmakla (docs/23).
 *
 * Oyuncu bir zamanlar "haritada sağa sola çekerken çok donuyor" dedi.
 * Donma yoktu; ÖLÜ JEST vardı: "sığdır"dan sonra kayacak yer kalmıyordu
 * ve parmak gidince ekranda hiçbir şey olmuyordu — hareketsiz bir ekran
 * donmuş bir ekrandan ayırt edilemez.
 *
 * Harita artık tam ekran bir gerçek dünya TUVALİ (docs/27). Sayfa arkada
 * kaymıyor; parmağın her yönü haritanın. Görünüm haritanın test
 * kancasından (`window.__dunyaHaritasi`) okunuyor. Bu test beş şeyi koruyor:
 *   1. Tek parmak haritayı kaydırıyor (yatay da dikey de).
 *   2. "Dünyayı göster"de ölü jest yok: harita parmağı dirençle izliyor ve
 *      bırakınca yerine yaylanıyor.
 *   3. İki parmak yakınlaştırıyor.
 *   4. Kısa dokunuş toprağı SEÇİYOR, haritayı oynatmıyor.
 *   5. Sayfa arkada kaymıyor — haritanın altında içerik yok.
 *
 * BU TEST FARE İLE YAZILAMAZ: `touch-action` fare girdisine uygulanmıyor.
 * CDP `Input.dispatchTouchEvent` gerçek parmak gönderiyor.
 */
import { tarayiciAc } from './lib/tarayici.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { rehberiSustur } from './lib/gezin.mjs';
import { benzersizAd, kayitOl } from './lib/kayit.mjs';
import { bolgeKazandir, sehriKur } from './lib/ilerlet.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const ad = benzersizAd('Dk');
const { token } = await kayitOl(API, { email: `${ad}@lordlar.dev`, lordName: ad });
await bolgeKazandir(API, token);
await sehriKur(API, token);
const b = await tarayiciAc();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const s = await ctx.newPage();
const cdp = await ctx.newCDPSession(s);
await s.goto(WEB);
await s.evaluate((t) => localStorage.setItem('lordlar_token', t), token);
await s.goto(WEB, { waitUntil: 'networkidle' });
await ogreticiyiGec(s);
await rehberiSustur(s).catch(() => {});
await s.click('nav button:has-text("Dünya")', { force: true });
await s.waitForSelector('[data-harita-hazir]', { timeout: 20000 });
await s.waitForTimeout(1500);

/** Görünüm metin olarak: "k tx ty" (iki ondalık). */
const donusum = () =>
  s.evaluate(() => {
    const g = window.__dunyaHaritasi?.gorunum();
    return g ? `${g.k.toFixed(4)} ${g.tx.toFixed(2)} ${g.ty.toFixed(2)}` : 'YOK';
  });
const olcek = (t) => Number(t.split(' ')[0]);
const sayfaY = () => s.evaluate(() => window.scrollY);

/** Harita kutusunun ortasına yakın bir başlangıç noktası. */
async function orta() {
  return s.evaluate(() => {
    const r = document.querySelector('[data-harita-sayfasi]').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.45 };
  });
}

/**
 * Parmakla sürükler. `ortada` hareketin ortasında (parmak henüz kalkmadan)
 * dönüşümü okur: esneme ancak o an görünüyor, bırakınca yaylanıyor.
 */
async function surukle(dx, dy) {
  const { x, y } = await orta();
  const once = await donusum();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  let ortada = once;
  for (let i = 1; i <= 18; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 18, y: y + (dy * i) / 18 }],
    });
    await s.waitForTimeout(16);
    if (i === 12) ortada = await donusum();
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await s.waitForTimeout(600);
  return { once, ortada, sonra: await donusum() };
}

let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};

/**
 * Kaymaya YER OLAN yön. Açılış oyuncunun toprağına ortalanıyor; toprak
 * dünyanın kenarındaysa harita o kenara dayalı açılır ve kenarın ötesine
 * çekilen parmak doğru olarak esneyip geri yaylanır. "Kaydırıyor" ancak
 * haritanın ortasına doğru çekilince ölçülebilir.
 */
/** Haritanın kayabileceği yön: kenara yakın değil, ortaya doğru. */
async function bosYon() {
  return s.evaluate(() => {
    const h = window.__dunyaHaritasi;
    const g = h.gorunum();
    const [x0, x1, y0, y1] = h.aralik();
    return {
      dx: g.tx - x0 < x1 - g.tx ? 1 : -1,
      dy: g.ty - y0 < y1 - g.ty ? 1 : -1,
    };
  });
}

console.log('=== Açılış (yakın) ===');
const y0 = await sayfaY();
const yon = await bosYon();
const yatay = await surukle(140 * yon.dx, 0);
k(
  'yatay parmak haritayı kaydırıyor',
  yatay.sonra !== yatay.once,
  `${yatay.once} -> ${yatay.sonra}`,
);
const dikey = await surukle(0, 120 * yon.dy);
k(
  'dikey parmak da haritayı kaydırıyor',
  dikey.sonra !== dikey.once,
  `${dikey.once} -> ${dikey.sonra}`,
);
k('sayfa arkada kaymıyor', (await sayfaY()) === y0, `scrollY ${await sayfaY()}`);

console.log('=== İki parmak ===');
{
  const { x, y } = await orta();
  const once = olcek(await donusum());
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: x - 30, y, id: 1 },
      { x: x + 30, y, id: 2 },
    ],
  });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: x - 30 - i * 6, y, id: 1 },
        { x: x + 30 + i * 6, y, id: 2 },
      ],
    });
    await s.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await s.waitForTimeout(500);
  const sonra = olcek(await donusum());
  k('iki parmak açılınca harita yakınlaşıyor', sonra > once + 0.2, `${once} -> ${sonra}`);
}

console.log('=== "Dünyayı göster" sonrası ===');
await s.getByRole('button', { name: 'Dünyayı göster' }).click();
await s.waitForTimeout(700);
const sigdir = await surukle(-150, 0);
k(
  'dünya sığmışken ÖLÜ JEST YOK: harita parmağı izliyor',
  sigdir.ortada !== sigdir.once,
  sigdir.ortada,
);
k('bırakınca yerine yaylanıyor', sigdir.sonra === sigdir.once, sigdir.sonra);

console.log('=== Kısa dokunuş ===');
{
  // Bir şehrin kendi noktasına dokun: kampa yakın, ekranda ve üstünde
  // düğme olmayan bir şehir. Önce kampa dönülüyor ki şehirler görünsün.
  await s.getByRole('button', { name: 'Kampıma git' }).click();
  await s.waitForTimeout(600);
  const harita = await fetch(`${API}/api/map`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const hedef = await s.evaluate(
    (idler) => {
      const h = window.__dunyaHaritasi;
      const kutu = document.querySelector('[data-harita-sayfasi]').getBoundingClientRect();
      let en = null;
      for (const id of idler) {
        const p = h.konum(id);
        if (!p) continue;
        if (!document.elementFromPoint(p.x, p.y)?.hasAttribute('data-harita-tuval')) continue;
        const d = Math.hypot(
          p.x - (kutu.left + kutu.width / 2),
          p.y - (kutu.top + kutu.height * 0.4),
        );
        if (!en || d < en.d) en = { ...p, d, id };
      }
      return en;
    },
    harita.regions.map((r) => r.id),
  );
  const once = await donusum();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: hedef.x, y: hedef.y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: hedef.x + 3, y: hedef.y }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await s.waitForTimeout(1200);
  const kart = await s.locator('[data-bolge-sayfasi]').count();
  k('kısa dokunuş toprağı seçiyor — bölge kartı açıldı', kart === 1, `bölge ${hedef.id}`);
  const sonra = await donusum();
  // Seçim görünür alandaysa harita kıpırdamamalı; kart açılınca görünen
  // alan küçüldüğü için yalnız ÖLÇEK karşılaştırılıyor.
  k(
    'kısa dokunuş haritayı yakınlaştırmıyor',
    olcek(sonra) <= olcek(once) + 0.01,
    `${once} -> ${sonra}`,
  );
}

console.log(hata === 0 ? '\nHARİTA JESTLERİ TEMİZ\n' : `\n${hata} JEST KALDI\n`);
await b.close();
process.exit(hata === 0 ? 0 : 1);
