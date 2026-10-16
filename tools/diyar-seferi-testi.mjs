/**
 * Hafta sonu diyar seferi (docs/09 §2.6).
 *
 * Ölçtüğü:
 *   1. Hafta içi etkinlik "yaklaşıyor": tema belli, ödül kapalı.
 *   2. Cumartesi açık; çubuk DİYARIN — iki lordun katkısı tek toplamda.
 *      Hedefe varılmadan ödül reddediliyor.
 *   3. Hedef tutunca katılan alıyor, katkısız lord almıyor; ikinci alım
 *      reddediliyor.
 *   4. Pazartesi ödül günü: hafta sonu almayan hâlâ alabiliyor.
 *   5. Salı yeni hafta sonu: geçen haftanın alımı yenisini kapatmıyor.
 *   6. Arayüz: Görevler'de kart.
 *
 * Hafta sonu penceresini hafta içinde sınamak için iki geliştirme kapısı:
 * `x-test-an` başlığı sunucunun "şimdi"sini kaydırıyor (üretimde yok
 * sayılıyor), `/test/etkinlik-kayitlari` lordun kayıtlarını o ana taşıyor.
 * Lordlar kendi diyarlarında (`/test/diyar-ac`): başka testlerin lordları
 * ortak toplamı kirletmesin.
 *
 * API ve web ayakta olmalı. node tools/diyar-seferi-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';
import { sehriKur } from './lib/ilerlet.mjs';
import { ekrana, rehberiSustur } from './lib/gezin.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { tarayiciAc } from './lib/tarayici.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const GUN = 86_400_000;

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — hafta sonu diyar seferi\n');

const { worldId } = await fetch(`${API}/api/test/diyar-ac`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
}).then((r) => r.json());

const damga = Date.now().toString(36);
async function lord(harf) {
  const { token } = await kayitOl(API, {
    email: `ds${harf}${damga}@lordlar.dev`,
    lordName: `Ds${harf}${damga.slice(-5)}`,
    worldId,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const saat = (an) => (an ? { 'x-test-an': an.toISOString() } : {});
  return {
    token,
    al: (y, an) =>
      fetch(`${API}/api${y}`, { headers: { ...h, ...saat(an) } }).then((r) => r.json()),
    gonder: async (y, govde = {}, an) => {
      const r = await fetch(`${API}/api${y}`, {
        method: 'POST',
        headers: { ...h, ...saat(an) },
        body: JSON.stringify(govde),
      });
      return { kod: r.status, govde: await r.json().catch(() => null) };
    },
  };
}
const a = await lord('a');
const b = await lord('b');
const c = await lord('c');
const durum = (l, an) => l.al('/diyar-etkinligi', an);

/* Asker eğitme haftası: tema dönüyor, sekiz günden ötedeki ilk
 * "egitilen_asker" cumartesisi. Sekiz gün: aktiflik penceresi bugünü
 * kapsamasın, hedef taban kalsın (bugün kayıt olan üç lord sayılmasın). */
const bugun = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
let cumartesi = new Date(bugun.getTime() + ((6 - bugun.getUTCDay() + 7) % 7) * GUN + 7 * GUN);
let tema = null;
for (let i = 0; i < 6; i++) {
  const d = await durum(a, new Date(cumartesi.getTime() - GUN + 12 * 3_600_000));
  if (d.etkinlik?.olcut === 'egitilen_asker') {
    tema = d;
    break;
  }
  cumartesi = new Date(cumartesi.getTime() + 7 * GUN);
}
const saatte = (gun, saat) => new Date(cumartesi.getTime() + gun * GUN + saat * 3_600_000);
const CUMA = saatte(-1, 12);

/* 1. Hafta içi --------------------------------------------------- */
kontrol(
  'Cuma: etkinlik yaklaşıyor, tema belli',
  tema?.etkinlik?.durum === 'yaklasiyor' &&
    new Date(tema.etkinlik.bas).getTime() === cumartesi.getTime(),
  `${cumartesi.toISOString().slice(0, 10)} ${tema?.etkinlik?.key ?? 'tema yok'}`,
);
const kapali = await a.gonder('/diyar-etkinligi/odul', {}, CUMA);
kontrol(
  'Cuma: ödül kapalı',
  kapali.kod === 400 && kapali.govde?.code === 'ETKINLIK_KAPALI',
  `${kapali.kod} ${kapali.govde?.code ?? ''}`,
);
kontrol(
  'Hedef taban (pencerede aktif lord yok)',
  tema?.hedef === tema?.etkinlik?.taban,
  `${tema?.hedef}/${tema?.etkinlik?.taban}`,
);
const hedef = tema?.hedef ?? 200;

/* 2. Cumartesi: ortak çubuk, hedefe varmadan ret ------------------ */
// İlk lord yeni: küçük bir bölük eğitiyor, tek başına hedefe varmıyor.
// İkincisi kurulu bir şehir (`sehriKur` kendi ordusunu eğitiyor).
const kayit = saatte(0, 10);
const BOLUK = 40;
await a.gonder('/test/kaynak-ver', { altin: BOLUK * 50, demir: 0, erzak: BOLUK * 20 });
const aEgit = await a.gonder('/army/train', { unitType: 'milis', count: BOLUK });
await a.gonder('/test/etkinlik-kayitlari', { an: kayit.toISOString() });
const ilk = await durum(a, saatte(0, 11));
kontrol(
  'Cumartesi açık; ilk lordun eğittiği asker toplamda',
  aEgit.kod === 200 &&
    ilk.etkinlik?.durum === 'acik' &&
    ilk.katkim === BOLUK &&
    ilk.toplam === ilk.katkim,
  `${aEgit.kod} ${aEgit.govde?.code ?? ''} toplam ${ilk.toplam}, katkı ${ilk.katkim}`,
);
if (ilk.toplam < hedef) {
  const erken = await a.gonder('/diyar-etkinligi/odul', {}, saatte(0, 11));
  kontrol(
    'Hedefe varılmadan ödül reddediliyor',
    erken.kod === 400 && erken.govde?.code === 'HEDEF_TUTMADI',
    `${erken.kod} ${erken.govde?.code ?? ''}`,
  );
} else {
  kontrol('Tek lordun katkısı hedefin altında', false, `${ilk.toplam}/${hedef}`);
}

await sehriKur(API, b.token);
const eksik = Math.max(1, hedef - ilk.toplam);
await b.gonder('/test/kaynak-ver', { altin: 200000, demir: 60000, erzak: 100000 });
const egit = await b.gonder('/army/train', { unitType: 'milis', count: eksik });
await b.gonder('/test/etkinlik-kayitlari', { an: kayit.toISOString() });
const ikinci = await durum(a, saatte(0, 12));
const bninki = await durum(b, saatte(0, 12));
kontrol(
  'İki lordun katkısı tek toplamda, hedef tuttu',
  egit.kod === 200 &&
    ikinci.toplam === ilk.katkim + bninki.katkim &&
    ikinci.toplam >= hedef &&
    ikinci.katkim === ilk.katkim,
  `${egit.kod} toplam ${ikinci.toplam} = ${ilk.katkim} + ${bninki.katkim}, hedef ${hedef}`,
);

/* 3. Katılan alıyor, katkısız almıyor, bir kez -------------------- */
const cninki = await durum(c, saatte(0, 12));
const cRet = await c.gonder('/diyar-etkinligi/odul', {}, saatte(0, 12));
kontrol(
  'Katkısız lord almıyor',
  cninki.katkim === 0 &&
    cninki.odul?.engel === 'katki' &&
    cRet.kod === 400 &&
    cRet.govde?.code === 'KATKI_YOK',
  `${cninki.odul?.engel} / ${cRet.kod} ${cRet.govde?.code ?? ''}`,
);
const altinOnce = (await a.al('/me')).lord.resources.altin;
const odul = await a.gonder('/diyar-etkinligi/odul', {}, saatte(0, 12));
const altinSonra = (await a.al('/me')).lord.resources.altin;
const fark = altinSonra - altinOnce;
kontrol(
  'Katılan lord ödülü alıyor, altın kasaya giriyor',
  ikinci.odul?.hakEdildi === true &&
    odul.kod === 200 &&
    odul.govde?.verilen?.altin > 0 &&
    Math.abs(fark - odul.govde.verilen.altin) < 50,
  `${odul.kod} verilen ${JSON.stringify(odul.govde?.verilen)}, altın +${Math.floor(fark)}`,
);
const tekrar = await a.gonder('/diyar-etkinligi/odul', {}, saatte(1, 9));
const sonra = await durum(a, saatte(1, 9));
kontrol(
  'İkinci alım reddediliyor',
  tekrar.kod === 400 && tekrar.govde?.code === 'ODUL_ALINDI' && sonra.odul?.alindi === true,
  `${tekrar.kod} ${tekrar.govde?.code ?? ''}`,
);

/* 4. Pazartesi ödül günü ------------------------------------------ */
const pazartesi = await durum(b, saatte(2, 10));
const bAl = await b.gonder('/diyar-etkinligi/odul', {}, saatte(2, 10));
kontrol(
  'Pazartesi: hafta sonu almayan hâlâ alabiliyor',
  pazartesi.etkinlik?.durum === 'odul' && pazartesi.odul?.hakEdildi === true && bAl.kod === 200,
  `${pazartesi.etkinlik?.durum} / ${bAl.kod} ${bAl.govde?.code ?? ''}`,
);

/* 5. Salı: yeni hafta sonu ---------------------------------------- */
const sali = await durum(a, saatte(3, 10));
kontrol(
  'Salı: sıradaki hafta sonu, başka tema, geçen alım kapatmıyor',
  sali.etkinlik?.durum === 'yaklasiyor' &&
    new Date(sali.etkinlik.bas).getTime() === cumartesi.getTime() + 7 * GUN &&
    sali.etkinlik.key !== tema?.etkinlik?.key &&
    sali.odul?.alindi === false &&
    sali.odul?.engel === 'kapali',
  `${sali.etkinlik?.durum} ${sali.etkinlik?.key} alındı=${sali.odul?.alindi}`,
);

/* 6. Arayüz ------------------------------------------------------- */
const tarayici = await tarayiciAc();
const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
await sayfa.goto(WEB, { waitUntil: 'domcontentloaded' });
await sayfa.evaluate((t) => localStorage.setItem('lordlar_token', t), a.token);
await sayfa.reload({ waitUntil: 'domcontentloaded' });
await sayfa.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
await ogreticiyiGec(sayfa);
await rehberiSustur(sayfa);
try {
  await ekrana(sayfa, 'gorevler');
  const kart = sayfa.locator('[data-diyar-seferi]');
  await kart.waitFor({ timeout: 10000 });
  await kart.scrollIntoViewIfNeeded();
  const deger = await kart.getAttribute('data-diyar-seferi');
  kontrol(
    'Görevler ekranında diyar seferi kartı',
    ['yaklasiyor', 'acik', 'odul'].includes(deger ?? ''),
    deger ?? '',
  );
  await sayfa.screenshot({ path: `${process.env.CIKTI ?? 'ekran-goruntuleri'}/diyar-seferi.png` });
} catch (e) {
  kontrol('Görevler ekranına ulaşıldı', false, String(e?.message ?? e).slice(0, 120));
}
await tarayici.close();

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
