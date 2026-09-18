/**
 * MEDENİYET — uçtan uca (docs/16 §12 adım 2).
 *
 * Üç tasarım kararı burada korunuyor. Üçü de sessizce bozulabilir
 * cinsten: hiçbiri hata vermez, oyun çalışmaya devam eder, yalnız
 * tasarım kaybolur.
 *
 *  1. MEDENİYET KAYITTA ATANIYOR VE DENGELİ. Atama bozulursa oyuncular
 *     tek fraksiyona yığılır ve dört köşeli harita tek renge boyanır.
 *     Fark ancak aylar sonra, sıralamaya bakınca görülürdü.
 *  2. KAMP KENDİ YURDUNDA KURULUYOR (§8). Bozulursa oyuncu başka bir
 *     medeniyetin toprağında doğar — ilk fethi "kendi" bölgesine olur.
 *  3. HARİTA DÖRT YURT + ÇEKİŞMELİ ORTA OLARAK AÇILIYOR (§5). Yurt
 *     sahiplikleri yazılmazsa harita gene çalışır, ama artık fraksiyon
 *     haritası değildir.
 */
import { benzersizAd, kayitOl } from './lib/kayit.mjs';
import { readFileSync } from 'node:fs';

const API = process.env.API_URL ?? 'http://localhost:3000';
/*
 * DIYAR verilirse bütün kayıtlar O diyara gidiyor.
 *
 * Zincirde (`pnpm e2e`) verilmiyor: orada açık diyar zaten tek. Elle
 * koşarken ise gerekli — geliştirme veritabanında geçmişten kalmış,
 * bölgeleri çoktan fethedilmiş bir diyar varsa yurt sayımı haklı olarak
 * tutmaz ve sınama ölçmediği bir şey yüzünden kalırdı.
 */
const DIYAR = process.env.DIYAR || undefined;
const KOK = new URL('..', import.meta.url).pathname;
const DENGE = JSON.parse(readFileSync(`${KOK}data/balance.json`, 'utf8'));
const HARITA = JSON.parse(readFileSync(`${KOK}data/world-map.json`, 'utf8'));
const MEDENIYETLER = DENGE.medeniyetler.liste;

let hata = 0;
const k = (a, c, d = '') => {
  console.log(`  ${c ? '[GEÇTİ]' : '[KALDI]'} ${a}${d ? ` — ${d}` : ''}`);
  if (!c) hata++;
};

const istek = (token) => ({
  get: (y) =>
    fetch(`${API}/api${y}`, { headers: { Authorization: `Bearer ${token}` } }).then((x) =>
      x.json(),
    ),
  post: (y, g) =>
    fetch(`${API}/api${y}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(g ?? {}),
    }).then((x) => x.json()),
});

console.log('Lordlar Çağı — medeniyetler\n');

/* ---------------------------------------------------------------- */
/* 1. Kayıt medeniyet atıyor ve kamp kendi yurduna kuruluyor         */
/* ---------------------------------------------------------------- */
const ad = benzersizAd('Med');
const { token } = await kayitOl(API, {
  email: `${ad}@lordlar.dev`,
  lordName: ad,
  worldId: DIYAR,
});
const { get, post } = istek(token);

const me = await get('/me');
const med = me.lord?.medeniyet;
k('yeni lordun medeniyeti var', !!med, med ? `${med.ad}` : JSON.stringify(me).slice(0, 140));

if (med) {
  const tanim = MEDENIYETLER.find((m) => m.id === med.id);
  k('medeniyet dengeden geliyor', !!tanim, tanim ? `yurt: ${tanim.yurt}` : `bilinmeyen: ${med.id}`);

  /*
   * Kamp çıpası HARİTA ucundan okunuyor, `/me`den değil.
   *
   * `/me` lordun durumunu anlatıyor ve içinde kamp yok; `/api/map` ise
   * "burası senin kampın" işaretini koyabilmek için `homeBolgeId`
   * döndürüyor. Orada numara SATIR kimliği (mapId değil), çünkü istemci
   * bölgeleri o kimlikle gösteriyor — bu yüzden bölgeyi kanonik dosyada
   * değil, yanıtın kendi listesinde arıyoruz.
   */
  const harita = await get('/map');
  const kamp = harita.regions?.find((r) => r.id === harita.homeBolgeId);
  k(
    'kamp kendi yurdunda kuruldu',
    !!kamp && !!tanim && kamp.province === tanim.yurt,
    kamp ? `${kamp.name} (${kamp.province})` : `bölge ${harita.homeBolgeId} bulunamadı`,
  );
  k('kamp bir köyün yanında', kamp?.type === 'koy', kamp?.type ?? '—');
}

k('fayda puanı sıfırdan başlıyor', me.lord?.faydaPuani === 0, `${me.lord?.faydaPuani}`);

/* ---------------------------------------------------------------- */
/* 2. Diyar dört medeniyetle ve çekişmeli ortayla doğuyor            */
/* ---------------------------------------------------------------- */
const durum = await post('/test/medeniyet-durumu');
k(
  `diyarda ${MEDENIYETLER.length} medeniyet var`,
  durum.medeniyetler?.length === MEDENIYETLER.length,
  `${durum.medeniyetler?.length}`,
);

if (durum.medeniyetler?.length === MEDENIYETLER.length) {
  // Yurt bölge sayısı kanonik haritadan hesaplanıyor: elle yazılmış bir
  // sayı harita değişince sessizce yanlışa düşerdi.
  const beklenen = Object.fromEntries(
    MEDENIYETLER.map((m) => [m.id, HARITA.regions.filter((r) => r.province === m.yurt).length]),
  );
  const yanlis = durum.medeniyetler.filter((m) => m.bolge !== beklenen[m.key]);
  k(
    'her medeniyet kendi yurdunun tamamını tutuyor',
    yanlis.length === 0,
    yanlis.length
      ? yanlis.map((m) => `${m.key}: ${m.bolge} ≠ ${beklenen[m.key]}`).join(', ')
      : durum.medeniyetler.map((m) => `${m.key} ${m.bolge}`).join(' · '),
  );

  const cekirdekYanlis = durum.medeniyetler.filter(
    (m) => m.cekirdek !== DENGE.medeniyetler.yurt_basina_cekirdek,
  );
  k(
    'her medeniyetin beş çekirdek satırı var',
    cekirdekYanlis.length === 0,
    cekirdekYanlis.map((m) => `${m.key}: ${m.cekirdek}`).join(', ') || 'hepsi 5',
  );

  const yurtToplam = Object.values(beklenen).reduce((s, n) => s + n, 0);
  k(
    'orta çekişmeli: yurtların dışı sahipsiz başlıyor',
    durum.sahipsizBolge === HARITA.regions.length - yurtToplam,
    `${durum.sahipsizBolge} sahipsiz / ${HARITA.regions.length} bölge`,
  );
}

/* ---------------------------------------------------------------- */
/* 3. Atama DENGELİ — hepsi aynı medeniyete gitmiyor                 */
/* ---------------------------------------------------------------- */
/*
 * Ölçüt "dört farklı medeniyet çıktı" DEĞİL: diyar zaten dengesizse
 * (önceki sınamalar kaydolmuş) sekiz yeni oyuncunun hepsi haklı olarak
 * geride kalan bir iki medeniyete gidebilir. Ölçülen şey davranışın
 * kendisi: FARK BÜYÜMESİN. Dengeleme bozulup atama sabitlenseydi fark
 * sekiz kişilik büyürdü.
 */
const oncesi = Object.fromEntries((durum.medeniyetler ?? []).map((m) => [m.key, m.lord]));
const yayilim = (n) => Math.max(...Object.values(n)) - Math.min(...Object.values(n));

const EK = 8;
let sonToken = token;
for (let i = 0; i < EK; i++) {
  const a = benzersizAd('Mdn');
  const r = await kayitOl(API, { email: `${a}@lordlar.dev`, lordName: a, worldId: DIYAR });
  sonToken = r.token;
}
const sonra = await istek(sonToken).post('/test/medeniyet-durumu');
const sonrasi = Object.fromEntries((sonra.medeniyetler ?? []).map((m) => [m.key, m.lord]));

k(
  `${EK} yeni oyuncu eklendi`,
  Object.values(sonrasi).reduce((s, n) => s + n, 0) >=
    Object.values(oncesi).reduce((s, n) => s + n, 0) + EK,
  Object.entries(sonrasi)
    .map(([kk, v]) => `${kk} ${v}`)
    .join(' · '),
);
k(
  'atama dengeyi bozmuyor — fark büyümedi',
  yayilim(sonrasi) <= Math.max(yayilim(oncesi), 1),
  `önce ${yayilim(oncesi)} → sonra ${yayilim(sonrasi)}`,
);

console.log(hata === 0 ? '\nMEDENİYETLER TEMİZ\n' : `\n${hata} MEDENİYET SINAMASI KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
