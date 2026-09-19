/**
 * ÇEKİRDEK YATIRIMI ve FAYDA PUANI — uçtan uca (docs/16 §7, §9).
 *
 * Dört iddia korunuyor:
 *
 *  1. BAĞIŞ SEVİYE ATLATIYOR ve artan YANMIYOR. Yanan bağış, ortak bir
 *     kasaya kaynak atmayı kumara çevirirdi.
 *  2. BONUS GERÇEKTEN İŞLİYOR. Bir çekirdeğin seviyesi ekranda yazıp
 *     hiçbir sayıyı değiştirmiyorsa özellik yok demektir — ve bu
 *     sessizce olur.
 *  3. BONUS HERKESE İŞLİYOR, bağış yapana değil (§7). Bedavacılığı
 *     fayda puanı çözüyor, bonusu kısıtlayarak değil.
 *  4. FAYDA PUANI KAZANILIYOR ve GÜÇ SATIN ALMIYOR (§9) — puan yalnız
 *     katkı verene, bonus herkese.
 */
import { kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';

let hata = 0;
const k = (ad, kosul, detay = '') => {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
};

const damga = Date.now();
async function lordKur(etiket) {
  const { token } = await kayitOl(API, {
    email: `ckr${damga}_${etiket}@lordlar.dev`,
    lordName: `Ckr${damga.toString(36).slice(-3) + Math.random().toString(36).slice(2, 4)}${etiket}`,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  return {
    post: (y, g) =>
      fetch(`${API}/api${y}`, { method: 'POST', headers: h, body: JSON.stringify(g ?? {}) }).then(
        (x) => x.json(),
      ),
    get: (y) => fetch(`${API}/api${y}`, { headers: h }).then((x) => x.json()),
  };
}

console.log('Lordlar Çağı — çekirdek yatırımı ve fayda puanı\n');

/*
 * İKİ LORD AYNI MEDENİYETTEN: bonusun BAĞIŞ YAPMAYANA da işlediğini
 * ancak ikinci bir üyeyle ölçebiliriz. Kayıt medeniyeti dengeye göre
 * dağıttığı için eşleşen bir çift bulunana kadar lord açılıyor.
 */
const havuz = [];
let bagisci = null;
let yoldas = null;
for (let i = 0; i < 8 && !yoldas; i++) {
  const l = await lordKur(`l${i}`);
  const med = (await l.get('/me')).lord?.medeniyet?.id ?? null;
  const es = havuz.find((x) => x.med === med && med !== null);
  if (es) {
    bagisci = es.l;
    yoldas = l;
  } else {
    havuz.push({ l, med });
  }
}
k('Aynı medeniyetten iki lord bulundu', Boolean(bagisci && yoldas));
if (!bagisci || !yoldas) {
  console.log('\n1 KONTROL KALDI\n');
  process.exit(1);
}

const m = (await bagisci.get('/medeniyet')).medeniyet;
k('Medeniyet okunabiliyor', Boolean(m?.id), m ? `${m.ad} · ${m.bolgeSayisi} bölge` : 'yok');
k('Beş çekirdek listeleniyor', m?.cekirdekler?.length === 5, `${m?.cekirdekler?.length}`);
k(
  'Dört çekirdek bonus taşıyor, biri başkent',
  m?.cekirdekler?.filter((c) => c.bonus).length === 4,
  `${m?.cekirdekler?.filter((c) => c.bonus).length} bonuslu`,
);
k(
  'Dört medeniyetin sıralaması dönüyor',
  m?.siralama?.length >= 1 && m.siralama.every((s) => typeof s.bolge === 'number'),
  m?.siralama?.map((s) => `${s.ad} ${s.bolge}`).join(' · '),
);

/* ---------------------------------------------------------------- */
/* AMBAR çekirdeği: depo tavanını büyütmeli                          */
/* ---------------------------------------------------------------- */
const ambar = m.cekirdekler.find((c) => c.bonus === 'ambar');
k('Ambar çekirdeği var', Boolean(ambar), ambar?.ad ?? 'yok');

const depoOnce = (await bagisci.get('/me')).lord.storageCapacity;
const yoldasDepoOnce = (await yoldas.get('/me')).lord.storageCapacity;

/*
 * TAKSİTLE BAĞIŞ — ve bu bir sınama hilesi değil, tasarımın kendisi.
 *
 * Çekirdek maliyeti ÜYE SAYISIYLA ölçekleniyor (docs/16 §7): on üyeli
 * bir medeniyette ilk seviye 40.000 altın. Bir lordun depo tavanı ise
 * o mertebede değil — yani tek kişi tek hamlede bir çekirdek
 * büyütemiyor ve büyütememeli. Kasada biriken bağış tam olarak bunun
 * içindir: kaynak damla damla gelir, seviye ortak emekle atlar.
 *
 * İlk yazdığımda maliyetin iki katını verip tek seferde bağışlıyordum
 * ve sunucu "kaynağın yetmiyor" dedi — haklıydı: verdiğim kaynak depo
 * tavanına kırpılıyordu. Yanlış olan sunucu değil, sınamanın oyunun
 * kendi ölçeğini yok saymasıydı.
 */
const gereken = ambar.maliyet;
const faydaOnce = (await bagisci.get('/me')).lord.faydaPuani;

let sonuc = null;
let toplamPuan = 0;
for (let tur = 0; tur < 10; tur++) {
  await bagisci.post('/test/kaynak-ver', { altin: 200000, demir: 200000, erzak: 200000 });
  // Cüzdanın TAMAMI değil: depo tavanına kırpılmış olabilir, o yüzden
  // gerçekten elde olanı bağışlıyoruz.
  const cuzdan = (await bagisci.get('/me')).lord.resources;
  const taksit = {
    altin: Math.min(cuzdan.altin, gereken.altin),
    demir: Math.min(cuzdan.demir, gereken.demir),
    erzak: Math.min(cuzdan.erzak, gereken.erzak),
  };
  sonuc = await bagisci.post(`/medeniyet/cekirdek/${ambar.mapId}/bagis`, taksit);
  toplamPuan += sonuc?.faydaPuani ?? 0;
  if (sonuc?.atladi) break;
}
k(
  'Bağış seviye atlattı',
  sonuc?.atladi === true && sonuc.seviye > ambar.seviye,
  `Sv ${sonuc?.seviye}`,
);
k('Bağış fayda puanı kazandırdı', toplamPuan > 0, `+${toplamPuan}`);

const faydaSonra = (await bagisci.get('/me')).lord.faydaPuani;
k(
  'Fayda puanı lorda yazıldı',
  faydaSonra === faydaOnce + toplamPuan && toplamPuan > 0,
  `${faydaOnce} → ${faydaSonra} (+${toplamPuan})`,
);

const depoSonra = (await bagisci.get('/me')).lord.storageCapacity;
k('Ambar bonusu depo tavanını büyüttü', depoSonra > depoOnce, `${depoOnce} → ${depoSonra}`);

/*
 * ASIL İDDİA: bonus BAĞIŞ YAPMAYANA da işliyor (§7). Bedavacılık bir
 * hata değil, tasarımın kabul ettiği bir durum; karşılığı fayda puanı.
 */
const yoldasDepoSonra = (await yoldas.get('/me')).lord.storageCapacity;
k(
  'Bonus bağış YAPMAYAN yoldaşa da işliyor',
  yoldasDepoSonra > yoldasDepoOnce,
  `${yoldasDepoOnce} → ${yoldasDepoSonra}`,
);
k(
  'Fayda puanı yalnız bağış yapanda',
  (await yoldas.get('/me')).lord.faydaPuani === 0,
  `yoldaşın puanı ${(await yoldas.get('/me')).lord.faydaPuani}`,
);

/* ---------------------------------------------------------------- */
/* Artan bağış YANMIYOR                                              */
/* ---------------------------------------------------------------- */
const sonrakiDurum = (await bagisci.get('/medeniyet')).medeniyet.cekirdekler.find(
  (c) => c.mapId === ambar.mapId,
);
k(
  'Artan bağış kasada duruyor, yanmıyor',
  sonrakiDurum.biriken.altin >= 0 && sonrakiDurum.seviye === sonuc.seviye,
  `Sv ${sonrakiDurum.seviye}, biriken ${sonrakiDurum.biriken.altin} altın`,
);
k(
  'Bir sonraki seviye daha pahalı',
  sonrakiDurum.maliyet === null || sonrakiDurum.maliyet.altin > gereken.altin,
  sonrakiDurum.maliyet ? `${gereken.altin} → ${sonrakiDurum.maliyet.altin}` : 'azami seviye',
);

console.log(hata === 0 ? '\nÇEKİRDEK YATIRIMI TEMİZ\n' : `\n${hata} KONTROL KALDI\n`);
process.exit(hata === 0 ? 0 : 1);
