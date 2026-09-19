/**
 * KARTOPU FRENİ — uçtan uca (docs/16 §10, dördüncü risk).
 *
 * §10 fraksiyon kartopunun panzehirini iki parça yazmıştı: üyeyle
 * ölçeklenen çekirdek maliyeti (büyümeyi yavaşlatır) VE lider avının
 * fraksiyon sürümü (büyüyeni HEDEF yapar). İkincisi uzun süre yazılmadı;
 * ölçüm kartopunu görüyor ama hiçbir şey frene basmıyordu.
 *
 * Dört iddia ölçülüyor:
 *
 *  1. HARİTA DOĞDUĞUNDA FREN KAPALI. Yurtlar eşit büyüklükte değil
 *     (17-18-21-21) ve eşik onların üstünde. Fren ilk gün açık olsaydı
 *     hiçbir şey yapmamış bir medeniyet doğuştan hedef olurdu.
 *  2. EŞİK GEÇİLİNCE FREN AÇILIYOR ve dünya şeridi bunu söylüyor.
 *  3. ÖNİZLEME BONUSU GÖSTERİYOR. Teşvik, oyuncunun kararı verdiği
 *     ekranda görünmüyorsa yok demektir. Önizleme uzun süre yağma
 *     bonuslarını HİÇ saymıyordu — bireysel lider avını da.
 *  4. SAVAŞ ÖNİZLEMEYLE AYNI ŞEYİ VERİYOR. Bu projenin en çok
 *     tekrarlayan hatası aynı sayının iki yerde ayrışması.
 *
 * SADECE GELİŞTİRME. node tools/kartopu-testi.mjs
 */
import { readFileSync } from 'node:fs';
import { kayitOl } from './lib/kayit.mjs';
import { fethedilebilirMi } from './lib/hedef.mjs';

// Sayılar DENGEDEN, kopyasından değil: eşik ya da bonus değişirse bu
// sınama kendiliğinden yeni sayıyla ölçer (öbür uçtan uca araçların
// tamamı böyle okuyor).
const KOK = new URL('..', import.meta.url).pathname;
const DENGE = JSON.parse(readFileSync(`${KOK}data/balance.json`, 'utf8'));
const MEDENIYETLER = DENGE.medeniyetler.liste;
const KARTOPU_FRENI = {
  esik: DENGE.medeniyetler.kartopu_freni.onde_esik,
  yagmaBonusu: DENGE.medeniyetler.kartopu_freni.yagma_bonusu,
};

const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};
const topla = (y) => (y?.altin ?? 0) + (y?.demir ?? 0) + (y?.erzak ?? 0);

console.log('Lordlar Çağı — kartopu freni\n');

const damga = Date.now();
const { token } = await kayitOl(API, {
  email: `kar${damga}@lordlar.dev`,
  lordName: `Kar${damga.toString(36).slice(-4)}`,
});
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (yol, govde) =>
  fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) }).then(
    (x) => x.json(),
  );
const get = (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json());

await post('/test/bolgeleri-sifirla');
await post('/test/kaynak-ver', { altin: 900000, demir: 500000, erzak: 500000 });
await post('/test/xp-ver', { miktar: 200000 });
const puan = (await get('/me')).lord.statPoints;
if (puan > 0) await post('/me/stats', { liderlik: puan });

/*
 * Haritayı DOĞDUĞU güne döndür. Uçtan uca sınamalar aynı diyarı
 * paylaşıyor: önceki bir koşunun (ya da bu sınamanın kendisinin)
 * bıraktığı toprak, "doğuşta fren kapalı" iddiasını ölçülemez yapardı.
 * Kendi medeniyetimi kullanmıyorum; anahtar yalnız ucun istediği alan.
 */
const benimIlk = (await get('/me')).lord?.medeniyet?.id ?? MEDENIYETLER[0].id;
await post('/test/medeniyet-toprak-ver', { key: benimIlk, sifirla: true });

/* --- 1. Doğuşta fren kapalı --- */
{
  const dunya = await get('/dunya');
  k(
    'Harita doğduğunda fren KAPALI',
    dunya.medeniyetAvi === null,
    dunya.medeniyetAvi ? `${dunya.medeniyetAvi.ad} önde` : 'önde giden yok',
  );
}

// Kendi medeniyetine saldırılamıyor (docs/16 §17): hedef RAKİP olmalı.
const benim = (await get('/me')).lord?.medeniyet?.id ?? null;
const rakip = MEDENIYETLER.find((m) => m.id !== benim)?.id;
k('Rakip medeniyet seçildi', Boolean(rakip), `benim: ${benim ?? 'yok'} · rakip: ${rakip}`);

/* --- Hedef: rakibin, hiçbir lordun tutmadığı bir bölgesi --- */
const hedefBul = async () => {
  const harita = await get('/map');
  return harita.regions.find((r) => r.medeniyet?.id === rakip && fethedilebilirMi(r)) ?? null;
};

// Önce yalnız DEPO: fren hâlâ kapalı, ölçümün taban çizgisi bu.
await post('/test/medeniyet-toprak-ver', { key: rakip, adet: 0, depo: 200000 });
const hedef = await hedefBul();
k('Rakibin yağmalanabilir bir bölgesi var', Boolean(hedef), hedef?.name ?? 'yok');
if (!hedef) {
  console.log(`\n${hata + 1} KONTROL KALDI\n`);
  process.exit(1);
}

// Ordu: hedefi alabilecek kadar. Öneri motoru hangi birimden kaç
// gerektiğini zaten biliyor; aynı sayıyı burada tekrar hesaplamıyoruz.
await post('/army/train', { unitType: 'mizrakci', count: 120 });
await post('/test/kuyruklari-bitir');
const ordu = (await get('/army')).home;

const onizle = () => post('/battle/preview', { toRegionId: hedef.id, army: ordu });
const frensiz = await onizle();
k(
  'Frensiz önizleme yağma gösteriyor',
  topla(frensiz.tahmin?.yagma) > 0,
  JSON.stringify(frensiz.tahmin?.yagma),
);

/* --- 2. Eşik geçilince fren açılıyor --- */
const verilen = await post('/test/medeniyet-toprak-ver', { key: rakip, adet: 60, depo: 200000 });
{
  const dunya = await get('/dunya');
  k(
    'Eşik geçilince fren AÇILIYOR',
    dunya.medeniyetAvi?.medeniyetId === rakip,
    dunya.medeniyetAvi
      ? `${dunya.medeniyetAvi.ad} · pay %${Math.round(dunya.medeniyetAvi.pay * 100)}`
      : 'kapalı',
  );
  k(
    'Payı eşiğin üstünde',
    (dunya.medeniyetAvi?.pay ?? 0) > KARTOPU_FRENI.esik,
    `pay ${dunya.medeniyetAvi?.pay?.toFixed(3)} · eşik ${KARTOPU_FRENI.esik} · ${verilen.bolge} bölge`,
  );
  k(
    'Bonus dengeden geliyor',
    dunya.medeniyetAvi?.yagmaBonusu === KARTOPU_FRENI.yagmaBonusu,
    String(dunya.medeniyetAvi?.yagmaBonusu),
  );
}

/* --- 3. Önizleme bonusu sayıyor --- */
const frenli = await onizle();
{
  const once = topla(frensiz.tahmin.yagma);
  const sonra = topla(frenli.tahmin.yagma);
  const beklenen = 1 + KARTOPU_FRENI.yagmaBonusu;
  k('Önizleme yağması fren açılınca büyüyor', sonra > once, `${once} -> ${sonra}`);
  // Aynı tohum, aynı ordu, aynı savunan: tek değişen bonus. Oran bu
  // yüzden tam olarak dengedeki sayı olmalı.
  k(
    `Oran dengedeki bonusla aynı (×${beklenen})`,
    once > 0 && Math.abs(sonra / once - beklenen) < 0.02,
    `oran ${(sonra / once).toFixed(3)}`,
  );
}

/* --- 4. Savaş önizlemeyle aynı --- */
{
  await post('/march', { toRegionId: hedef.id, army: ordu });
  await post('/test/yuruyusleri-bitir');
  await post('/test/yuruyusleri-bitir');
  // Yağma savaş kaydının LOG'unda duruyor (Battle.log.loot); ayrı bir
  // sütun yok.
  const savaslar = await get('/battles');
  const rapor = Array.isArray(savaslar) ? (savaslar[0] ?? null) : null;
  const yagma = topla(rapor?.log?.loot ?? null);
  const beklenen = topla(frenli.tahmin.yagma);
  k('Savaş gerçekleşti ve yağma geldi', yagma > 0, `${yagma} kaynak`);
  /*
   * TOLERANS: önizleme dokuz savaşın ORTANCASI, gerçek savaş tek
   * kuradır ve her turda ±%7 varyans var; sağ kalan asker sayısı
   * değişince taşıma kapasitesi de değişiyor. Ölçülen şey sayının
   * aynı olması değil, BONUSUN GERÇEKTEN UYGULANMIŞ olması: frensiz
   * önizlemenin belirgin üstünde.
   */
  k(
    'Savaş yağması frenli önizlemeye yakın',
    yagma > 0 && Math.abs(yagma - beklenen) / beklenen < 0.25,
    `savaş ${yagma} · önizleme ${beklenen}`,
  );
  k(
    'Savaş yağması frensiz tahminin üstünde',
    yagma > topla(frensiz.tahmin.yagma) * 1.1,
    `savaş ${yagma} · frensiz ${topla(frensiz.tahmin.yagma)}`,
  );
}

/*
 * TEMİZLİK. Sınama haritayı bozduğu gibi bırakırsa bir sonraki lord
 * kendi medeniyetinin yuttuğu bir diyara doğar ve "yoldaşına
 * saldıramazsın" kuralı onun ilk hedefini kapatır — ilk oturum sözü
 * (docs/08 İ3) buradan kırılırdı.
 */
await post('/test/medeniyet-toprak-ver', { key: benimIlk, sifirla: true });
{
  const dunya = await get('/dunya');
  k('Sınama haritayı temiz bıraktı', dunya.medeniyetAvi === null, 'fren yeniden kapalı');
}

console.log(hata === 0 ? '\nKARTOPU FRENİ TEMİZ\n' : `\n${hata} KONTROL KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
