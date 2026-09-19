/**
 * GARNİZON PAYI — uçtan uca (docs/16 §6).
 *
 * Oyunun ekonomisini değiştiren tek cümle burada korunuyor:
 *
 *   > Bölge geliri, orada garnizon tutan lordlar arasında YER oranında
 *   > bölünür.
 *
 * Üç iddia ölçülüyor ve üçü de sessizce bozulabilir cinsten — hiçbiri
 * hata vermez, oyun çalışmaya devam eder, yalnız sayı yanlış olur:
 *
 *  1. FETHEDİLEN BÖLGEDE ASKER KALIYOR. Kalmazsa fatih aldığı yerden
 *     hiçbir şey kazanmaz ve her fetih ikinci bir işlem gerektirir.
 *  2. GARNİZON GELİR GETİRİYOR. Getirmiyorsa garnizon bırakmanın hiçbir
 *     karşılığı kalmaz ve harita boşalır.
 *  3. PAY BÖLÜNÜYOR. Eşit yer tutan iki lord bölgenin gelirini yarı
 *     yarıya paylaşmalı; bölünmezse gelir yoktan çoğalır.
 *
 * MALİKÂNE GELİRİ sabit kalıyor ve ölçüm ondan arınıyor: garnizon
 * tamamen çekildiğinde kalan gelir malikânenin kendisi (docs/16 §8 —
 * kişisel olan bölünmüyor).
 */
import { kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};
const say = (a) => Object.values(a ?? {}).reduce((t, n) => t + Number(n || 0), 0);

const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `gpy${damga}_${etiket}@lordlar.dev`,
    lordName: `Gpy${damga.toString(36).slice(-3) + Math.random().toString(36).slice(2, 4)}${etiket}`,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
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
  const p = (await l.get('/me')).lord.statPoints;
  if (p > 0) await l.post('/me/stats', { liderlik: p });
}

/** Oyunun kendi önerisiyle bir bölge alır. */
async function bolgeAl(l) {
  for (let i = 0; i < 8; i++) {
    const oneri = (await l.get('/map')).oneri;
    if (!oneri) return null;
    if (oneri.eksik?.adet > 0) {
      await l.post('/army/train', { unitType: oneri.eksik.birim, count: oneri.eksik.adet });
      await l.post('/test/kuyruklari-bitir');
    }
    const ordu = (await l.get('/army')).home;
    if (Object.keys(ordu).length === 0) return null;
    await l.post('/march', { toRegionId: oneri.regionId, army: ordu });
    await l.post('/test/yuruyusleri-bitir');
    await l.post('/test/yuruyusleri-bitir');
    const benim = (await l.get('/map')).regions.find((r) => r.isMine && r.type !== 'taht');
    if (benim) return benim;
  }
  return null;
}

const gelir = async (l) => (await l.get('/me')).lord.hourlyIncome;
const toplam = (g) => (g?.altin ?? 0) + (g?.demir ?? 0) + (g?.erzak ?? 0);

console.log('Lordlar Çağı — garnizon payı\n');

/*
 * İKİ LORD AYNI MEDENİYETTEN olmalı.
 *
 * Pay yalnız bölgeyi TUTAN medeniyetin üyeleri arasında bölünüyor:
 * rakip medeniyetten gelen asker kuşatma sayılıyor, ortak değil. Kayıt
 * medeniyeti dengeye göre dağıttığı için arka arkaya açılan iki lord
 * farklı medeniyetlere düşüyor; bu yüzden eşleşen bir çift bulunana
 * kadar lord açılıyor. Dört medeniyet var, sekizde bir çift kesin var.
 *
 * Bu ayrıntı sınamanın kurulumu değil, ölçtüğü kuralın kendisi: ilk
 * hâlde iki lord farklı medeniyetlerdendi ve sınama "pay bölünmedi"
 * diye kaldı — haklı olarak.
 */
const havuz = [];
let sahip = null;
let dost = null;
for (let i = 0; i < 8 && !dost; i++) {
  const l = await lordKur(`l${i}`);
  const med = (await l.get('/me')).lord?.medeniyet?.id ?? null;
  const es = havuz.find((x) => x.med === med && med !== null);
  if (es) {
    sahip = es.l;
    dost = l;
  } else {
    havuz.push({ l, med });
  }
}
k('Aynı medeniyetten iki lord bulundu', Boolean(sahip && dost));
if (!sahip || !dost) {
  console.log('\n1 KONTROL KALDI\n');
  process.exit(1);
}
await sahip.post('/test/bolgeleri-sifirla');
for (const l of [sahip, dost]) await hazirla(l);

const itt = await sahip.post('/ittifak/kur', {
  ad: `Pay ${damga % 10000}`,
  etiket: `P${damga % 100}`,
});
await sahip.post('/ittifak/ayarlar', { katilim: 'acik' });
await dost.post(`/ittifak/${itt.id}/katil`);

const bolge = await bolgeAl(sahip);
k('Bir bölge fethedildi', Boolean(bolge), bolge?.name ?? 'alınamadı');
if (!bolge) {
  console.log('\n1 KONTROL KALDI\n');
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* 1. Fetih garnizon bırakıyor                                       */
/* ---------------------------------------------------------------- */
const fetihGarnizonu = say((await sahip.get(`/map/${bolge.id}`)).kendiGarnizonum);
k(
  'Fethedilen bölgede sağ kalan ordu kaldı',
  fetihGarnizonu > 0,
  `${fetihGarnizonu} birim garnizonda`,
);

/* ---------------------------------------------------------------- */
/* 2. Garnizon gelir getiriyor, pay eşit bölünüyor                   */
/* ---------------------------------------------------------------- */
// İki tarafı da EŞİT yere getiriyoruz: 100 mızrakçı = 100 yer.
await sahip.post('/army/train', { unitType: 'mizrakci', count: 200 });
await sahip.post('/test/kuyruklari-bitir');
await sahip.post(`/map/${bolge.id}/garrison`, { army: { mizrakci: 100 } });

const tekBasina = await gelir(sahip);
const payBilgisi = (await sahip.get('/map')).regions.find((r) => r.id === bolge.id)?.pay;
k(
  'Tek garnizonda pay tam (oran 1)',
  payBilgisi?.oran === 1,
  `oran ${payBilgisi?.oran} · ${payBilgisi?.yer}/${payBilgisi?.toplamYer} yer`,
);

await dost.post('/army/train', { unitType: 'mizrakci', count: 100 });
await dost.post('/test/kuyruklari-bitir');
await dost.post(`/map/${bolge.id}/takviye`, { army: { mizrakci: 100 } });
await dost.post('/test/yuruyusleri-bitir');

const yarisi = await gelir(sahip);
const dostPayi = (await dost.get('/map')).regions.find((r) => r.id === bolge.id)?.pay;
k(
  'Takviye gelince pay ikiye bölündü',
  Math.abs((dostPayi?.oran ?? 0) - 0.5) < 0.01,
  `dostun oranı ${dostPayi?.oran?.toFixed(3)} · ${dostPayi?.yer}/${dostPayi?.toplamYer} yer`,
);

// Garnizonu tamamen çek: kalan gelir MALİKÂNENİN kendisi.
await sahip.post(`/map/${bolge.id}/garrison`, { army: {} });
const malikane = await gelir(sahip);

const tamPay = toplam(tekBasina) - toplam(malikane);
const yariPay = toplam(yarisi) - toplam(malikane);
k('Garnizon gelir getiriyor', tamPay > 0, `bölge payı ${tamPay.toFixed(1)}/sa`);
k(
  'Garnizonsuz bölgeden gelir GELMİYOR',
  Math.abs(toplam(malikane) - toplam(await gelir(sahip))) < 0.001 && tamPay > 0,
  `garnizonsuz gelir ${toplam(malikane).toFixed(1)}/sa`,
);
k(
  'Eşit yerde pay yarı yarıya',
  tamPay > 0 && Math.abs(yariPay - tamPay / 2) < Math.max(1, tamPay * 0.02),
  `tam ${tamPay.toFixed(1)} → yarım ${yariPay.toFixed(1)} (beklenen ${(tamPay / 2).toFixed(1)})`,
);

console.log(hata === 0 ? '\nGARNİZON PAYI TEMİZ\n' : `\n${hata} KONTROL KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
