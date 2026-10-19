/**
 * ÜLKE ve SINIR — uçtan uca (docs/27).
 *
 * Gerçek dünyanın beş kuralı korunuyor. Hepsi sessizce bozulabilir
 * cinsten: hiçbiri hata vermez, yalnız harita zamanla yanlış bir şekle
 * girer.
 *
 *  1. ÜLKE LİSTESİ HARİTAYLA AYNI. Her ülkenin bir başkenti (tahtı) var
 *     ve şehir sayılarının toplamı haritanın kendisi.
 *  2. KAMP SEÇİLEN ÜLKEDE. Bozulursa oyuncu başka bir ülkede doğar ve
 *     ilk fethi "kendi" ülkesinin dışından olur.
 *  3. SEÇİM BİR KEZ; SEÇMEYEN SALDIRAMIYOR. Seçim tekrar edilebilseydi
 *     ülke bir ışınlanma düğmesi olurdu.
 *  4. SINIR KURALI. Kendi ülkenin her şehri açık; uzak bir ülkenin şehri
 *     ancak evin ya da toprağının komşusuysa. Bozulursa bir lord ilk gün
 *     dünyanın öbür ucuna yürür ve sınırın anlamı kalmaz.
 *  5. FETİH LORDUN ADINA YAZILIYOR ve SINIRI GENİŞLETİYOR. Herkes kendi
 *     adına oynuyor; alınan şehrin komşuları artık sınırda.
 */
import { kayitOl } from './lib/kayit.mjs';
import { readFileSync } from 'node:fs';
import { fethedilebilirMi } from './lib/hedef.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const KOK = new URL('..', import.meta.url).pathname;
const OZET = JSON.parse(readFileSync(`${KOK}data/dunya-ozet.json`, 'utf8'));

let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};

const damga = Date.now();
async function lordKur(etiket, ulke) {
  const { token } = await kayitOl(API, {
    email: `ulk${damga}_${etiket}@lordlar.dev`,
    lordName: `Ulk${damga.toString(36).slice(-3) + Math.random().toString(36).slice(2, 4)}${etiket}`,
    ulke,
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

async function hazirla(l) {
  await l.post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
  await l.post('/test/xp-ver', { miktar: 200000 });
  const puan = (await l.get('/me')).lord.statPoints;
  if (puan > 0) await l.post('/me/stats', { liderlik: puan });
  await l.post('/army/train', { unitType: 'mizrakci', count: 250 });
  await l.post('/test/kuyruklari-bitir');
}

/** Yürüyüşü dener; sunucunun hata kodunu ya da 'tamam'ı döner. */
async function yuru(l, hedef) {
  const ordu = (await l.get('/army')).home;
  const r = await l.ham('/march', {
    toRegionId: hedef.id,
    army: { mizrakci: Math.min(10, ordu.mizrakci ?? 0) },
  });
  const g = await r.json().catch(() => ({}));
  return r.ok ? 'tamam' : (g.code ?? `HTTP ${r.status}`);
}

console.log('Lordlar Çağı — ülke ve sınır\n');

/* ---------------------------------------------------------------- */
/* 1. Ülke listesi haritayla aynı                                    */
/* ---------------------------------------------------------------- */
const yunan = await lordKur('a', 'GRC');
const liste = await yunan.get('/ulkeler');
k(
  `Ülke listesi ${OZET.provinces.length} ülke`,
  liste.ulkeler?.length === OZET.provinces.length,
  `${liste.ulkeler?.length}`,
);
k(
  'Her ülkenin başkenti var',
  liste.ulkeler?.every((u) => u.baskent),
  liste.ulkeler?.find((u) => !u.baskent)?.kod ?? 'hepsinde',
);
const sehirToplami = (liste.ulkeler ?? []).reduce((t, u) => t + u.sehirSayisi, 0);
k('Şehir sayıları haritanın toplamı', sehirToplami === OZET.region_count, `${sehirToplami}`);
k('Seçtiğim ülke işaretli', liste.ulkem === 'GRC', String(liste.ulkem));

/* ---------------------------------------------------------------- */
/* 2. Kamp seçilen ülkede                                            */
/* ---------------------------------------------------------------- */
const me = (await yunan.get('/me')).lord;
k('Lordun ülkesi Yunanistan', me.ulke?.kod === 'GRC', JSON.stringify(me.ulke));
let harita = await yunan.get('/map');
const ev = harita.regions.find((r) => r.id === harita.homeBolgeId);
k("Kamp Yunanistan'da kuruldu", ev?.province === 'GRC', `${ev?.name} (${ev?.province})`);
k('Kampın yanındaki şehir taht değil', ev?.type !== 'taht', ev?.type);

/* ---------------------------------------------------------------- */
/* 3. Seçim bir kez; seçmeyen saldıramıyor                           */
/* ---------------------------------------------------------------- */
const ulkesiz = await lordKur('b', null);
k('Ülkesiz kayıt ülkesiz açılıyor', (await ulkesiz.get('/me')).lord.ulke === null);
await hazirla(ulkesiz);
const herhangi = (await ulkesiz.get('/map')).regions.find((r) => !r.owner && r.type !== 'taht');
k('Ülke seçmeden saldırı reddediliyor', (await yuru(ulkesiz, herhangi)) === 'ULKE_SECILMEDI');
const yanlis = await ulkesiz.ham('/ulke/sec', { ulke: 'XYZ' });
k('Olmayan ülke seçilemiyor', yanlis.status === 400, `HTTP ${yanlis.status}`);
const sec = await ulkesiz.ham('/ulke/sec', { ulke: 'EGY' });
k('Ülke seçiliyor', sec.ok, `HTTP ${sec.status}`);
const ikinci = await ulkesiz.ham('/ulke/sec', { ulke: 'TUR' });
const ikinciGovde = await ikinci.json().catch(() => ({}));
k(
  'İkinci seçim reddediliyor',
  ikinciGovde.code === 'ULKE_SECILDI',
  ikinciGovde.code ?? `HTTP ${ikinci.status}`,
);
const misir = await ulkesiz.get('/map');
const misirEv = misir.regions.find((r) => r.id === misir.homeBolgeId);
k(
  'Kamp seçilen ülkeye taşındı',
  misirEv?.province === 'EGY',
  `${misirEv?.name} (${misirEv?.province})`,
);

/* ---------------------------------------------------------------- */
/* 4. Sınır kuralı                                                   */
/* ---------------------------------------------------------------- */
await hazirla(yunan);
harita = await yunan.get('/map');
const komsu = new Set(ev.komsular);
const yurt = harita.regions.filter((r) => r.province === 'GRC');
k(
  'Kendi ülkemin her şehri sınırda',
  yurt.length > 0 && yurt.every((r) => r.sinirda),
  `${yurt.filter((r) => r.sinirda).length}/${yurt.length}`,
);
const uzak = harita.regions.find((r) => r.province === 'BRA' && !r.owner);
k('Uzak bir ülkenin şehri sınır dışı', uzak && !uzak.sinirda, uzak?.name);
k('Sınır dışına yürüyüş reddediliyor', (await yuru(yunan, uzak)) === 'SINIR_YOK', uzak?.name);
const yabanciKomsu = harita.regions.filter((r) => komsu.has(r.id) && r.province !== 'GRC');
k(
  'Evimin yabancı komşusu sınırda',
  yabanciKomsu.every((r) => r.sinirda),
  yabanciKomsu.map((r) => `${r.name}/${r.province}`).join(', ') || 'yabancı komşu yok',
);
const yurtUzak = yurt.find((r) => !komsu.has(r.id) && r.id !== ev.id && fethedilebilirMi(r));
if (yurtUzak) {
  const sonuc = await yuru(yunan, yurtUzak);
  k('Ülkemin uzak bir şehrine yürüyüş açık', sonuc !== 'SINIR_YOK', `${yurtUzak.name}: ${sonuc}`);
  await yunan.post('/test/yuruyusleri-bitir');
  await yunan.post('/test/yuruyusleri-bitir');
}

/* ---------------------------------------------------------------- */
/* 5. Fetih lordun adına, sınır genişliyor                           */
/* ---------------------------------------------------------------- */
/*
 * Yunanistan'ın kara komşuları (Arnavutluk, Makedonya, Bulgaristan,
 * Türkiye) sınırın ötesinde bir halka. Onlardan birine komşu bir Yunan
 * şehrini alınca o yabancı şehir sınıra girmeli.
 */
harita = await yunan.get('/map');
const id = new Map(harita.regions.map((r) => [r.id, r]));
const kopru = harita.regions.find(
  (r) =>
    r.province === 'GRC' &&
    fethedilebilirMi(r) &&
    r.komsular.some((n) => {
      const x = id.get(n);
      return x && x.province !== 'GRC' && !x.sinirda;
    }),
);
k('Yabancı komşusu sınır dışı olan bir Yunan şehri var', Boolean(kopru), kopru?.name);
if (kopru) {
  await yunan.post('/test/kalkanlari-kaldir');
  await yunan.post('/army/train', { unitType: 'mizrakci', count: 400 });
  await yunan.post('/test/kuyruklari-bitir');
  const ordu = (await yunan.get('/army')).home;
  const r = await yunan.ham('/march', { toRegionId: kopru.id, army: ordu });
  k('Köprü şehrine yürüyüş çıktı', r.ok, `HTTP ${r.status}`);
  await yunan.post('/test/yuruyusleri-bitir');
  await yunan.post('/test/yuruyusleri-bitir');
  const sonra = await yunan.get('/map');
  const alinan = sonra.regions.find((x) => x.id === kopru.id);
  k('Şehir lordun adına yazıldı', alinan?.isMine === true, `sahip ${alinan?.owner?.name ?? 'yok'}`);
  if (alinan?.isMine) {
    const yeni = alinan.komsular
      .map((n) => sonra.regions.find((x) => x.id === n))
      .filter((x) => x && x.province !== 'GRC');
    k(
      'Alınan şehrin yabancı komşuları artık sınırda',
      yeni.length > 0 && yeni.every((x) => x.sinirda),
      yeni.map((x) => `${x.name}/${x.province}`).join(', '),
    );
    const ulkem = (await yunan.get('/ulke')).ulke;
    k('Ülke paneli şehrimi sayıyor', ulkem?.benim >= 1, `benim ${ulkem?.benim}`);
  }
}

console.log(hata === 0 ? '\nÜLKE VE SINIR TEMİZ\n' : `\n${hata} KONTROL KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
