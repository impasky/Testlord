/**
 * İlk oturum testi (docs/08).
 *
 * Tek soru: oyunu ilk kez açan biri, bir savaş kazanıp bir bölge alarak
 * gelirinin arttığını BU OTURUMDA görebiliyor mu — ve her adımda ne
 * kazanacağı kendisine söyleniyor mu?
 *
 * node tools/ilk-oturum-testi.mjs
 */
import { kayitOl } from './lib/kayit.mjs';
const API = process.env.API_URL ?? 'http://localhost:3000';
let token = null;
let hata = 0;

async function cagir(yol, opts = {}) {
  const res = await fetch(`${API}/api${yol}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  const metin = await res.text();
  const govde = metin ? JSON.parse(metin) : null;
  if (!res.ok) throw new Error(`${yol} -> ${res.status}: ${govde?.error ?? metin}`);
  return govde;
}
const post = (yol, govde) => cagir(yol, { method: 'POST', body: JSON.stringify(govde ?? {}) });

function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

/**
 * Savaşta tur başına ±%7 tohumlu varyans var: oyun "ordun yetiyor" dediğinde
 * bölge ölçülen oranla 25 seferin 24'ünde el değiştiriyor (%96). Kalan %4
 * bir hata değil, oyunun bilerek seçtiği belirsizlik — önizleme de bunu
 * "neredeyse kesin" diye söylüyor, "kesin" demiyor.
 *
 * Bu yüzden savaş sonucuna bakan kontroller bir kez daha deneniyor: iki
 * bağımsız oyuncunun ikisinde birden başarısız olmak (%0,16) artık varyans
 * değil, gerçek bir bozulmadır.
 */
const SAVAS_DENEMESI = 2;
const say = (a) => Object.values(a ?? {}).reduce((t, n) => t + n, 0);

console.log('Lordlar Çağı — ilk oturum testi\n');

let basladi = Date.now();

/** Bir yeni oyuncunun ilk oturumunu baştan sona yaşar. */
async function oturum() {
  const yaz = kontrol;
  const basHata = hata;

  const damga = Date.now() + Math.floor(Math.random() * 1000);
  token = null;
  ({ token } = await kayitOl(API, {
    email: `ilkoturum${damga}@lordlar.dev`,
    lordName: `Yeni ${damga}`,
  }));
  // Testler arası izolasyon: önceki koşuların ele geçirdiği bölgeler yeni
  // oyuncunun komşuluğunu boşaltıyor ve "yürüme mesafesinde hedef var mı"
  // sorusunu ortamın geçmişine bağlıyor. Taze dünya koşulunu kuruyoruz.
  await post('/test/bolgeleri-sifirla');
  basladi = Date.now();

  // --- 1. Ordusu olmayan oyuncuya da hedef gösterilir
  let harita = await cagir('/map');
  yaz('Ordusuz oyuncuya hedef gösteriliyor', harita.oneri !== null,
    harita.oneri ? `${harita.oneri.name}` : 'öneri yok');
  yaz('Hedef yürüme mesafesinde', (harita.oneri?.distance ?? 99) <= 1,
    `${harita.oneri?.distance} hex`);
  yaz('Ordusu yokken "kazanır" demiyor',
    harita.oneri?.orduVar === false && harita.oneri?.kazanir === false);

  // --- 2. Oyunun verdiği tavsiye İŞE YARIYOR mu?
  // Testin asıl sorusu bu: "daha fazla asker eğit" demek kolay; oyun kaç asker
  // gerektiğini söylüyor mu, söylediği ordu KURULABİLİYOR mu ve yetiyor mu?
  await post('/army/train', { unitType: 'mizrakci', count: 20 });
  await post('/test/kuyruklari-bitir');

  harita = await cagir('/map');
  const eksik = harita.oneri?.eksik;
  yaz('Yetersiz orduya somut eksik sayısı veriliyor',
    harita.oneri?.kazanir === false && eksik?.adet > 0,
    eksik ? `${eksik.adet} ${eksik.birim}` : 'eksik yok');
  yaz('Önerilen ordu mevcut kaynakla kurulabiliyor', eksik?.karsilanabilir === true,
    eksik ? `${eksik.maliyet.altin} altın` : '');

  if (eksik?.karsilanabilir) {
    await post('/army/train', { unitType: eksik.birim, count: eksik.adet });
    await post('/test/kuyruklari-bitir');
  }
  const me = await cagir('/me');

  harita = await cagir('/map');
  const hedef = harita.oneri;
  yaz('Söylenen kadar asker eğitince hedef "alınabilir" oluyor', hedef?.kazanir === true,
    hedef ? `${hedef.name}, ${say(hedef.garrison)} savunan` : 'öneri yok');

  // --- 3. Önizleme kazancı ve bedeli söylüyor
  const onizleme = await post('/battle/preview', {
    toRegionId: hedef.regionId,
    army: me.lord.homeArmy,
  });
  yaz('Önizleme fetih öngörüyor', onizleme.tahmin.eleGecirir === true,
    `fetih oranı ${onizleme.tahmin.fetihOrani}`);
  yaz('Önizleme saatlik geliri söylüyor',
    say(onizleme.odul.saatlikGelir) > 0,
    JSON.stringify(onizleme.odul.saatlikGelir));
  yaz('Önizleme şöhret farkını söylüyor',
    onizleme.odul.sohretSonrasi > onizleme.odul.sohretOncesi,
    `${onizleme.odul.sohretOncesi} -> ${onizleme.odul.sohretSonrasi}`);
  yaz('Önizleme sıralama tahminini söylüyor',
    onizleme.odul.siraSonrasi <= onizleme.odul.siraOncesi,
    `${onizleme.odul.siraOncesi}. -> ${onizleme.odul.siraSonrasi}.`);
  yaz('Önizleme kaybın bedelini söylüyor',
    onizleme.bedel.yenidenEgitim.altin > 0 && onizleme.bedel.yenidenEgitimSn > 0,
    `${onizleme.bedel.yenidenEgitim.altin} altın / ${onizleme.bedel.yenidenEgitimSn} sn`);

  // --- 4. İlk saldırı dakikalar içinde varıyor
  yaz('İlk saldırı kısayolu geçerli', onizleme.ilkSaldiri === true);
  const yuruyus = await post('/march', { toRegionId: hedef.regionId, army: me.lord.homeArmy });
  yaz('İlk saldırı 3 dakikadan kısa', yuruyus.durationSec <= 180, `${yuruyus.durationSec} sn`);
  yaz('Önizleme ile gerçek süre aynı', yuruyus.durationSec === onizleme.marchSec);

  // --- 5. Savaş çözülünce oyuncu SONUCU görüyor
  await post('/test/yuruyusleri-bitir');
  const savaslar = await cagir('/battles');
  const savas = savaslar[0];
  yaz('Bölge ele geçirildi', savas?.captured === true);

  const sonuc = savas?.log?.sonuc?.saldiran;
  yaz('Savaş raporu öncesi/sonrası taşıyor', Boolean(sonuc));
  yaz('Raporda şöhret arttı', (sonuc?.sonrasi.sohret ?? 0) > (sonuc?.oncesi.sohret ?? 0),
    `${sonuc?.oncesi.sohret} -> ${sonuc?.sonrasi.sohret}`);
  yaz('Raporda sıralama yükseldi', (sonuc?.sonrasi.sira ?? 99) <= (sonuc?.oncesi.sira ?? 0),
    `${sonuc?.oncesi.sira}. -> ${sonuc?.sonrasi.sira}.`);
  yaz('Raporda saatlik gelir arttı',
    say(sonuc?.sonrasi.gelir) > say(sonuc?.oncesi.gelir),
    `${say(sonuc?.oncesi.gelir)} -> ${say(sonuc?.sonrasi.gelir)}`);
  yaz('Raporda bölge sayısı arttı',
    (sonuc?.sonrasi.bolgeSayisi ?? 0) > (sonuc?.oncesi.bolgeSayisi ?? 0));

  // --- 5b. Alınan bölge GELİŞTİRİLEBİLİYOR mu?
  // Oyuncu "bölgeyi ele geçirdim ama şehri geliştiremiyorum" diyordu.
  // Geliştirebiliyordu; arayüz ona "Seviye 2'ye yükselt" diyordu. Aşama
  // adları da bu yüzden dengede: mekanik aynı, anlatım değişti.
  const benimBolge = (await cagir('/map')).regions.find((r) => r.isMine && r.type !== 'taht');
  yaz('Alınan bölge haritada benim görünüyor', Boolean(benimBolge), benimBolge?.name);
  if (benimBolge) {
    const detay = await cagir(`/map/${benimBolge.id}`);
    yaz('Bölgenin geliştirme maliyeti var', detay.upgradeCost?.altin > 0,
      `${detay.upgradeCost?.altin} altın`);
    await post('/test/kaynak-ver', { altin: 50000, demir: 50000 });
    const gelistirme = await post(`/map/${benimBolge.id}/upgrade`);
    yaz('Bölge geliştirme kuyruğa girdi', gelistirme.queued === true);
    await post('/test/kuyruklari-bitir');
    const sonra = await cagir(`/map/${benimBolge.id}`);
    yaz('Bölge bir aşama ilerledi', sonra.level === benimBolge.level + 1,
      `seviye ${benimBolge.level} -> ${sonra.level}`);
  }

  // --- 6. Ekipman kuşanmak savaş katkısını söylüyor
  await post('/test/kaynak-ver', { altin: 20000, demir: 10000 });
  await post('/items/craft', { tier: 1, slot: 'silah' });
  await post('/test/kuyruklari-bitir');
  const envanter = await cagir('/items');
  const esya = envanter.items.find((i) => !i.equipped);
  const kusanma = await post(`/items/${esya.id}/equip`);
  yaz('Kuşanma savaş katkısını öncesi/sonrası veriyor',
    kusanma.etki.katkiSonrasi > kusanma.etki.katkiOncesi,
    `${kusanma.etki.katkiOncesi} -> ${kusanma.etki.katkiSonrasi}`);
  yaz('Kuşanma sonucu ya hedefe bağlı ya sebebini söylüyor',
    kusanma.etki.hedef !== null || kusanma.etki.neden !== null,
    kusanma.etki.hedef?.name ?? kusanma.etki.neden);

  return hata - basHata;
}

for (let deneme = 1; deneme <= SAVAS_DENEMESI; deneme++) {
  const kalan = await oturum();
  if (kalan === 0) break;
  if (deneme < SAVAS_DENEMESI) {
    console.log(
      `\n  (${kalan} kontrol kaldı — savaş varyansı olabilir, yeni bir oyuncuyla tekrarlanıyor)\n`,
    );
    hata = 0;
  }
}

// --- 7. Ölçüt: kayıttan ilk savaş raporuna kadar geçen süre
const gecen = Math.round((Date.now() - basladi) / 1000);
console.log(`\n  Kayıttan ilk savaş raporuna: ${gecen} sn (istek süreleri; yürüyüş hızlandırıldı)`);

console.log(
  hata === 0
    ? '\nTÜM KONTROLLER GEÇTİ — ilk oturum bir sonuca varıyor.'
    : `\n${hata} KONTROL KALDI`,
);
process.exit(hata === 0 ? 0 : 1);
