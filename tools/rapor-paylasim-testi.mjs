/**
 * Savaş raporunu ittifak sohbetinde paylaşma (docs/09 B3).
 *
 * Ölçtüğü:
 *   1. Savaşın tarafı raporunu kendi ittifakının sohbetinde paylaşabiliyor;
 *      aynı rapor ikinci kez paylaşılamıyor.
 *   2. Sohbette rapor kartı var: bölge, taraflar, paylaşanın gözünden sonuç.
 *   3. İttifak üyesi raporun TAMAMINI açabiliyor; ittifak dışından biri
 *      açamıyor (paylaşım yalnız o ittifaka).
 *   4. Başkasının savaşı paylaşılamıyor; ittifakı olmayan paylaşamıyor.
 *
 * API ayakta olmalı. node tools/rapor-paylasim-testi.mjs
 */
import { kayitOl, onerilenDiyar } from './lib/kayit.mjs';
import { bolgeKazandir } from './lib/ilerlet.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `rp${damga}_${etiket}@lordlar.dev`,
    lordName: `Rp${damga.toString(36).slice(-3) + Math.random().toString(36).slice(2, 4)}${etiket}`,
    worldId: await onerilenDiyar(API),
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const cagir = async (yol, yontem = 'GET', govde) => {
    const r = await fetch(`${API}/api${yol}`, {
      method: yontem,
      headers: h,
      ...(yontem === 'GET' ? {} : { body: JSON.stringify(govde ?? {}) }),
    });
    return { kod: r.status, govde: await r.json().catch(() => null) };
  };
  return {
    token,
    post: (yol, govde) => cagir(yol, 'POST', govde),
    get: (yol) => cagir(yol),
  };
}

console.log('Lordlar Çağı — rapor paylaşımı\n');

const [a, b, c] = await Promise.all(['a', 'b', 'c'].map(lordKur));

// İttifak: A kuruyor, kapıyı açıyor, B katılıyor; C dışarıda.
await a.post('/test/kaynak-ver', { altin: 200000, demir: 0, erzak: 0 });
const kuruldu = (
  await a.post('/ittifak/kur', { ad: `Rapor ${damga % 10000}`, etiket: `R${damga % 1000}` })
).govde;
await a.post('/ittifak/ayarlar', { katilim: 'acik' });
const katildi = (await b.post(`/ittifak/${kuruldu?.id}/katil`)).govde;
kontrol('İttifak kuruldu, ikinci lord katıldı', Boolean(kuruldu?.id && katildi?.katildi));

// A bir savaş yapıyor.
await bolgeKazandir(API, a.token);
const savaslar = (await a.get('/battles')).govde ?? [];
const savas = Array.isArray(savaslar) ? savaslar[0] : null;
kontrol('Paylaşılacak bir savaş var', Boolean(savas?.id), `${savaslar.length ?? 0} savaş`);

/* 4. Ön koşullar: ittifaksız ve başkasının savaşı ---------------- */
const cPaylas = await c.post('/ittifak/sohbet/rapor', { battleId: savas?.id });
kontrol(
  'İttifakı olmayan paylaşamıyor',
  cPaylas.kod === 400 && cPaylas.govde?.code === 'ITTIFAK_YOK',
  `${cPaylas.kod} ${cPaylas.govde?.code ?? ''}`,
);
const bBaskasi = await b.post('/ittifak/sohbet/rapor', { battleId: savas?.id });
kontrol('Başkasının savaşı paylaşılamıyor', bBaskasi.kod === 404, `${bBaskasi.kod}`);

/* 3a. Paylaşmadan önce üye raporu açamıyor ------------------------- */
const once = await b.get(`/battles/${savas?.id}`);
kontrol('Paylaşılmamış rapor üyeye kapalı', once.kod === 403, `${once.kod}`);

/* 1. Paylaşım ----------------------------------------------------- */
const pay = await a.post('/ittifak/sohbet/rapor', { battleId: savas?.id });
kontrol(
  'Savaşın tarafı raporunu paylaşıyor',
  pay.kod === 200,
  `${pay.kod} ${pay.govde?.code ?? ''}`,
);
await new Promise((r) => setTimeout(r, 3500)); // hız freni
const tekrar = await a.post('/ittifak/sohbet/rapor', { battleId: savas?.id });
kontrol(
  'Aynı rapor ikinci kez paylaşılamıyor',
  tekrar.kod === 409 && tekrar.govde?.code === 'ZATEN_PAYLASILDI',
  `${tekrar.kod} ${tekrar.govde?.code ?? ''}`,
);

/* 2. Sohbette kart ------------------------------------------------ */
const sohbet = (await b.get('/ittifak/sohbet')).govde;
const kart = sohbet?.mesajlar?.find((m) => m.rapor?.battleId === savas?.id)?.rapor;
kontrol(
  'Sohbette rapor kartı var',
  Boolean(kart?.bolge) && typeof kart?.zafer === 'boolean' && kart?.paylasanSaldiran === true,
  JSON.stringify(kart),
);

/* 3b. Üye açabiliyor, dışarıdan açılamıyor ------------------------ */
const uye = await b.get(`/battles/${savas?.id}`);
kontrol(
  'İttifak üyesi paylaşılan raporun tamamını açıyor',
  uye.kod === 200 && Array.isArray(uye.govde?.log?.rounds),
  `${uye.kod}`,
);
const disari = await c.get(`/battles/${savas?.id}`);
kontrol('İttifak dışından açılamıyor', disari.kod === 403, `${disari.kod}`);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
