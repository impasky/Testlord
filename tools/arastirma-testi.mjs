/**
 * Araştırma ağacını uçtan uca sınar.
 *
 * Asıl soru "uç 200 dönüyor mu" değil, "araştırma bir şey DEĞİŞTİRİYOR
 * mu": on beş düğümün her biri oyuncudan yüz binlerce kaynak istiyor.
 * Hiçbir yere bağlanmamış bir etki, alınmış ve karşılığı verilmemiş
 * kaynak demek. O yüzden her kontrol araştırmadan ÖNCEKİ ve SONRAKİ
 * sayıyı karşılaştırıyor.
 *
 * API ayakta olmalı. node tools/arastirma-testi.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — araştırma testi\n');

const damga = Date.now();
const { token: jeton } = await fetch(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: `ar${damga}@lordlar.dev`,
    password: 'parola1234',
    lordName: `Arastirici ${damga.toString(36).slice(-4)}`,
  }),
}).then((r) => r.json());

const bas = { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' };
const al = (y) => fetch(`${API}/api${y}`, { headers: bas }).then((r) => r.json());
const gonder = (y, g = {}, yontem = 'POST') =>
  fetch(`${API}/api${y}`, { method: yontem, headers: bas, body: JSON.stringify(g) }).then(
    async (r) => ({ durum: r.status, govde: await r.json().catch(() => ({})) }),
  );

/* --- 1. Ağaç okunuyor mu --- */
const bos = await al('/arastirma');
kontrol('ağaç 15 düğümle geliyor', bos.dallar?.length === 15, `${bos.dallar?.length} düğüm`);
kontrol('ilerleme sıfırdan başlıyor', bos.ilerleme?.biten === 0 && bos.ilerleme?.toplam === 15);
kontrol('süren araştırma yok', bos.suren === null);

const kilitli = (bos.dallar ?? []).filter((d) => !d.acik && !d.tamamlandi);
kontrol('yeni lordun çoğu düğümü kilitli', kilitli.length > 5, `${kilitli.length} kilitli`);
kontrol(
  'her kilitli düğüm sebebini yazıyor',
  kilitli.every((d) => (d.engel ?? '').length > 10),
  kilitli[0]?.engel ?? '',
);

/* --- 2. Seviye ve kaynak şartları --- */
const ambar = (bos.dallar ?? []).find((d) => d.key === 'ambarlar');
kontrol(
  'Ambarlar seviye şartıyla kilitli',
  ambar && !ambar.acik && /seviyesi/.test(ambar.engel ?? ''),
  ambar?.engel ?? '',
);

const erken = await gonder('/arastirma', { key: 'ambarlar' });
kontrol('şartı tutmayan araştırma reddedildi', erken.durum >= 400, `HTTP ${erken.durum}`);

for (let i = 0; i < 8; i++) await gonder('/test/xp-ver', { miktar: 200000 });
await gonder('/test/kaynak-ver', { altin: 900000, demir: 600000, erzak: 600000 });

const acik = await al('/arastirma');
const ambar2 = acik.dallar.find((d) => d.key === 'ambarlar');
kontrol('seviye gelince 1. kademe açıldı', ambar2?.acik === true, ambar2?.engel ?? '');
const ikinci = acik.dallar.find((d) => d.key === 'degirmenler');
kontrol(
  '2. kademe hâlâ önkoşula bağlı',
  ikinci?.acik === false && /Önce/.test(ikinci?.engel ?? ''),
  ikinci?.engel ?? '',
);

/* --- 3. Depo tavanı gerçekten büyüyor mu (A3'ün cevabı) --- */
const onceMe = await al('/me');
const onceDepo = onceMe.lord?.storageCapacity ?? 0;

const basla = await gonder('/arastirma', { key: 'ambarlar' });
kontrol('araştırma başlatıldı', basla.durum === 200, `HTTP ${basla.durum}`);

const suren = await al('/arastirma');
kontrol('süren araştırma görünüyor', suren.suren?.key === 'ambarlar', suren.suren?.ad ?? 'yok');

const ikinciBaslat = await gonder('/arastirma', { key: 'talim_meydani' });
kontrol(
  'aynı anda ikinci araştırma açılamıyor',
  ikinciBaslat.durum >= 400,
  `HTTP ${ikinciBaslat.durum}`,
);

await gonder('/test/kuyruklari-bitir');
const sonrasi = await al('/arastirma');
kontrol(
  'araştırma tamamlandı',
  sonrasi.tamamlanan?.includes('ambarlar') === true,
  JSON.stringify(sonrasi.tamamlanan),
);
kontrol('ilerleme arttı', sonrasi.ilerleme?.biten === 1);

const sonraMe = await al('/me');
const sonraDepo = sonraMe.lord?.storageCapacity ?? 0;
kontrol('Ambarlar depoyu BÜYÜTTÜ', sonraDepo > onceDepo, `${onceDepo} -> ${sonraDepo}`);

/* --- 4. Önkoşul açıldı mı --- */
const ikinci2 = sonrasi.dallar.find((d) => d.key === 'degirmenler');
kontrol('önkoşul bitince üst kademe açıldı', ikinci2?.acik === true, ikinci2?.engel ?? '');

/* --- 5. Komuta kapasitesi etkisi --- */
const onceKomuta = sonraMe.lord?.commandCapacity ?? 0;
// /test/xp-ver bir çağrıda en fazla birkaç seviye veriyor; Sancak
// Beyliği Lv27 istiyor, o yüzden döngüyle tırmanıyoruz.
for (let i = 0; i < 40; i++) await gonder('/test/xp-ver', { miktar: 500000 });
// Zincir pahalı: kaynak tükenirse hata araştırmada değil testte olur.
await gonder('/test/kaynak-ver', { altin: 2000000, demir: 1500000, erzak: 1500000 });
// Sancak Beyliği'ne kadar olan zinciri hızlıca tamamla.
for (const key of ['talim_meydani', 'zirh_atolyesi', 'ok_atolyesi', 'sancak_beyligi']) {
  const y = await gonder('/arastirma', { key });
  if (y.durum !== 200) {
    kontrol(`zincir: ${key}`, false, JSON.stringify(y.govde).slice(0, 90));
    break;
  }
  await gonder('/test/kuyruklari-bitir');
}
const komutaSonra = (await al('/me')).lord?.commandCapacity ?? 0;
kontrol(
  'Sancak Beyliği komuta kapasitesini büyüttü',
  komutaSonra > onceKomuta,
  `${onceKomuta} -> ${komutaSonra}`,
);

/* --- 6. Tamamlanan tekrar başlatılamaz --- */
const tekrar = await gonder('/arastirma', { key: 'ambarlar' });
kontrol('tamamlanan araştırma tekrar başlatılamıyor', tekrar.durum >= 400, `HTTP ${tekrar.durum}`);

/* --- 7. İptal ve yarı iade --- */
await gonder('/test/kaynak-ver', { altin: 900000, demir: 600000, erzak: 600000 });
const oncekiAltin = (await al('/me')).lord?.resources?.altin ?? 0;
const iptalEdilecek = await gonder('/arastirma', { key: 'degirmenler' });
if (iptalEdilecek.durum === 200) {
  const harcamaSonrasi = (await al('/me')).lord?.resources?.altin ?? 0;
  const y = await gonder(`/arastirma/${iptalEdilecek.govde.id}`, {}, 'DELETE');
  kontrol('araştırma iptal edilebiliyor', y.durum === 200, `HTTP ${y.durum}`);
  const iadeSonrasi = (await al('/me')).lord?.resources?.altin ?? 0;
  kontrol(
    'iptalde yarısı geri geliyor',
    iadeSonrasi > harcamaSonrasi && iadeSonrasi < oncekiAltin,
    `${oncekiAltin} -> ${harcamaSonrasi} -> ${iadeSonrasi}`,
  );
  kontrol('iptalden sonra süren araştırma kalmıyor', (await al('/arastirma')).suren === null);
} else {
  kontrol('araştırma iptal edilebiliyor', false, `başlatılamadı: HTTP ${iptalEdilecek.durum}`);
  kontrol('iptalde yarısı geri geliyor', false);
  kontrol('iptalden sonra süren araştırma kalmıyor', false);
}

/* --- 8. Uydurma anahtar --- */
const uydurma = await gonder('/arastirma', { key: 'ejderha_terbiyesi' });
kontrol('uydurma araştırma reddedildi', uydurma.durum === 404, `HTTP ${uydurma.durum}`);

console.log(`\n${hata === 0 ? 'TÜMÜ GEÇTİ' : `${hata} KONTROL KALDI`}`);
process.exit(hata === 0 ? 0 : 1);
