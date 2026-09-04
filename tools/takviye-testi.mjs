/**
 * Takviye savaşı testi (docs/09 B1c).
 *
 * Takviye gönderip almak ittifak testinde ölçülüyor. Bu test asıl riskli
 * yeri ölçüyor: takviyeli bir garnizon SALDIRIYA UĞRAYINCA ne oluyor?
 *
 * İki soru kritik:
 *  1. Kayıp sahiplerine katkı oranında dağıtılıyor mu — yani yoktan asker
 *     var olmuyor, sessizce kaybolmuyor mu?
 *  2. Bölge el değiştirirse takviye gönderenin evine dönüyor mu? Dönmezse
 *     yardım etmek yardım edene ceza olur ve kimse takviye göndermez.
 *
 * SADECE GELİŞTİRME. node tools/takviye-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}
const say = (a) => Object.values(a ?? {}).reduce((t, n) => t + Number(n || 0), 0);
const mizrak = (a) => Number(a?.mizrakci ?? 0);

const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `tkv${damga}_${etiket}@lordlar.dev`,
    lordName: `Tkv${damga.toString(36).slice(-3)}${etiket}`,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    post: (yol, govde) =>
      fetch(`${API}/api${yol}`, { method: 'POST', headers: h, body: JSON.stringify(govde ?? {}) })
        .then((x) => x.json()),
    get: (yol) => fetch(`${API}/api${yol}`, { headers: h }).then((x) => x.json()),
  };
}

async function hazirla(l, altin = 900000) {
  await l.post('/test/kaynak-ver', { altin, demir: 500000, erzak: 500000 });
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

console.log('Lordlar Çağı — takviye savaşı testi\n');

const savunan = await lordKur('def');
const dost = await lordKur('dost');
const saldiran = await lordKur('atk');
await savunan.post('/test/bolgeleri-sifirla');
for (const l of [savunan, dost, saldiran]) await hazirla(l);

// İttifak: savunan + dost
const itt = await savunan.post('/ittifak/kur', {
  ad: `Kalkan ${damga % 10000}`,
  etiket: `T${damga % 100}`,
});
// Kapıyı aç: ittifak varsayılan olarak BAŞVURUYLA üye alıyor (docs/09
// §2.1). Bu testin ölçtüğü şey başvuru değil; lider gibi davranıp
// kapıyı açıyoruz. Başvurunun kendisi ittifak-basvuru-testi'nde.
await savunan.post('/ittifak/ayarlar', { katilim: 'acik' });

await dost.post(`/ittifak/${itt.id}/katil`);
kontrol('İttifak kuruldu ve dost katıldı', Boolean(itt?.id), itt?.ad ?? itt?.code);

const bolge = await bolgeAl(savunan);
kontrol('Savunan bir bölge aldı', Boolean(bolge), bolge?.name ?? 'alınamadı');

// Savunan kendi garnizonunu koyuyor
await savunan.post('/army/train', { unitType: 'mizrakci', count: 100 });
await savunan.post('/test/kuyruklari-bitir');
await savunan.post(`/map/${bolge.id}/garrison`, { army: (await savunan.get('/army')).home });
const kendiGarnizon = say((await savunan.get(`/map/${bolge.id}`)).garrison);

// Dost takviye gönderiyor
await dost.post('/army/train', { unitType: 'mizrakci', count: 100 });
await dost.post('/test/kuyruklari-bitir');
await dost.post(`/map/${bolge.id}/takviye`, { army: { mizrakci: 100 } });
await dost.post('/test/yuruyusleri-bitir');

const dostGarnizonOnce = (await dost.get(`/map/${bolge.id}`)).kendiGarnizonum;
const savunanGarnizonOnce = (await savunan.get(`/map/${bolge.id}`)).kendiGarnizonum;
const dostPayiOnce = say(dostGarnizonOnce);
const savunanPayiOnce = say(savunanGarnizonOnce);
const toplamOnce = say((await savunan.get(`/map/${bolge.id}`)).garrison);
kontrol('Takviye garnizona katıldı', dostPayiOnce === 100, `${dostPayiOnce} birim`);
kontrol(
  'Toplam garnizon iki payın toplamı',
  toplamOnce === dostPayiOnce + savunanPayiOnce,
  `${savunanPayiOnce} + ${dostPayiOnce} = ${toplamOnce}`,
);
kontrol('Savunanın kendi payı ayrı sayılıyor', savunanPayiOnce === kendiGarnizon,
  `${savunanPayiOnce} vs ${kendiGarnizon}`);

// Muttefikin garnizonu gorunmeli: takviye karari onu gormeden verilemez.
const dostGoruyor = await dost.get(`/map/${bolge.id}`);
kontrol('Müttefikin garnizonu görünüyor', dostGoruyor.garrisonVisible === true,
  `${say(dostGoruyor.garrison)} birim`);
kontrol('Müttefik bayrağı sunucudan geliyor', dostGoruyor.muttefik === true,
  String(dostGoruyor.muttefik));
const yabanciGoruyor = await saldiran.get(`/map/${bolge.id}`);
kontrol('İttifak dışı garnizonu görmüyor', yabanciGoruyor.muttefik === false,
  String(yabanciGoruyor.muttefik));

// --- Saldırı: bölgeyi ALMAYAN bir akın (kayıp dağıtımı ölçülecek)
await saldiran.post('/test/kalkanlari-kaldir');
await saldiran.post('/army/train', { unitType: 'mizrakci', count: 400 });
await saldiran.post('/army/train', { unitType: 'okcu', count: 300 });
await saldiran.post('/test/kuyruklari-bitir');

// Bölgeyi ALMAYACAK bir saldırı arıyoruz: kayıp dağıtımını ölçmek için
// garnizonun savaştan SAĞ ÇIKMASI gerekiyor. En güvenilir yol savunanın
// kazandığı bir savaş — dar zafer bandı garnizona ve tahkimata göre
// kayabiliyor ve her kurulumda bulunmuyor.
const tamOrdu = (await saldiran.get('/army')).home;
let akin = null;
for (const oran of [0.1, 0.15, 0.2, 0.3, 0.4, 0.5]) {
  const ordu = Object.fromEntries(
    Object.entries(tamOrdu).map(([t, n]) => [t, Math.max(1, Math.floor(n * oran))]),
  );
  const t = (await saldiran.post('/battle/preview', { toRegionId: bolge.id, army: ordu }))?.tahmin;
  if (t?.eleGecirir === false) {
    akin = ordu;
    break;
  }
}
kontrol('Bölgeyi almayacak saldırı bulundu', Boolean(akin), akin ? 'bulundu' : 'bulunamadı');

if (akin) {
  await saldiran.post('/march', { toRegionId: bolge.id, army: akin });
  await saldiran.post('/test/yuruyusleri-bitir');

  const savas = (await saldiran.get('/battles')).find((b) => b.regionId === bolge.id);
  const rapor = await saldiran.get(`/battles/${savas.id}`);
  const savunanKayip = say(rapor?.log?.defenderLosses);

  const dostGarnizonSonra = (await dost.get(`/map/${bolge.id}`)).kendiGarnizonum;
  const savunanGarnizonSonra = (await savunan.get(`/map/${bolge.id}`)).kendiGarnizonum;
  const dostPayiSonra = say(dostGarnizonSonra);
  const savunanPayiSonra = say(savunanGarnizonSonra);

  const dostKayip = dostPayiOnce - dostPayiSonra;
  const savunanKaybi = savunanPayiOnce - savunanPayiSonra;

  kontrol('Takviye de kayıp verdi', dostKayip > 0, `${dostKayip} birim`);
  kontrol('Bölge sahibi de kayıp verdi', savunanKaybi > 0, `${savunanKaybi} birim`);
  // ÇEKİRDEK: yoktan asker var olmuyor, sessizce kaybolmuyor.
  kontrol(
    'Kayıpların toplamı savaş raporuyla AYNI',
    dostKayip + savunanKaybi === savunanKayip,
    `${savunanKaybi} + ${dostKayip} = ${dostKayip + savunanKaybi} vs rapor ${savunanKayip}`,
  );
  // Oran AYNI BİRİM TİPİ üzerinden ölçülüyor. Kayıp tip tip dağıtılıyor
  // ve tipler arasında "maruziyet" farkı var (ucuz birim önce ölür); iki
  // tarafın toplamlarını karşılaştırmak, farklı ordu bileşimlerinde
  // yanlış alarm verirdi.
  const dostMizrakOnce = mizrak(dostGarnizonOnce);
  const sahipMizrakOnce = mizrak(savunanGarnizonOnce);
  const dostMizrakKayip = dostMizrakOnce - mizrak(dostGarnizonSonra);
  const sahipMizrakKayip = sahipMizrakOnce - mizrak(savunanGarnizonSonra);
  const beklenenDost =
    ((dostMizrakKayip + sahipMizrakKayip) * dostMizrakOnce) / (dostMizrakOnce + sahipMizrakOnce);
  kontrol(
    'Mızrakçı kaybı katkı oranında dağıldı',
    Math.abs(dostMizrakKayip - beklenenDost) <= 1,
    `dost ${dostMizrakKayip} (beklenen ~${beklenenDost.toFixed(1)}), sahip ${sahipMizrakKayip}`,
  );
}

// --- Bölge el değiştirince takviye EVE döner
//
// İKİNCİ bir saldırgan gerekiyor: aynı saldırgan aynı bölgeye 12 saat
// tekrar gelemiyor (korumalar.ayni_saldirgan_tekrar_saldiri_saat) ve ilk
// saldırganla devam etmek testi sessizce "bölge el değiştirmedi"ye
// düşürüyordu.
const ikinciSaldiran = await lordKur('atk2');
await hazirla(ikinciSaldiran);
await ikinciSaldiran.post('/test/kalkanlari-kaldir');

const dostEvOnce = say((await dost.get('/army')).home);
const kalanTakviye = say((await dost.get(`/map/${bolge.id}`)).kendiGarnizonum);

// Ele geçirecek kadar ordu: önizleme "alırsın" diyene kadar asker ekle.
// Sabit bir sayı garnizona ve tahkimata göre yetmeyebiliyor.
let fetihOrdusu = null;
for (const adet of [400, 700, 1000, 1400, 1800]) {
  await ikinciSaldiran.post('/army/train', { unitType: 'mizrakci', count: adet });
  await ikinciSaldiran.post('/test/kuyruklari-bitir');
  const ordu = (await ikinciSaldiran.get('/army')).home;
  if (say(ordu) === 0) break;
  const t = (
    await ikinciSaldiran.post('/battle/preview', { toRegionId: bolge.id, army: ordu })
  )?.tahmin;
  if (t?.eleGecirir === true) {
    fetihOrdusu = ordu;
    break;
  }
}
kontrol('Fetih ordusu kurulabildi', Boolean(fetihOrdusu), fetihOrdusu ? 'kuruldu' : 'kurulamadı');
if (fetihOrdusu) {
  await ikinciSaldiran.post('/march', { toRegionId: bolge.id, army: fetihOrdusu });
  await ikinciSaldiran.post('/test/yuruyusleri-bitir');
}

const bolgeSon = (await ikinciSaldiran.get('/map')).regions.find((r) => r.id === bolge.id);
kontrol('Bölge el değiştirdi', bolgeSon?.isMine === true, bolgeSon?.owner?.name ?? 'sahipsiz');

const dostKalan = say((await dost.get(`/map/${bolge.id}`)).kendiGarnizonum);
kontrol('Takviye bölgede kalmadı', dostKalan === 0, `${dostKalan} birim`);
const dostEvSonra = say((await dost.get('/army')).home);
kontrol(
  'Sağ kalan takviye GÖNDERENİN evine döndü',
  dostEvSonra > dostEvOnce || kalanTakviye === 0,
  `ev ${dostEvOnce} -> ${dostEvSonra} (bölgede ${kalanTakviye} vardı)`,
);

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
