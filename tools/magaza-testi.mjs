/**
 * Mağaza — öde, zamanı atla (docs/25). Sunucu tarafı uçtan uca.
 *
 * Ölçtüğü:
 *   1. Elmasla hızlandırma: bedel sunucuda, iş beklenerek bitenle aynı
 *      yoldan çözülüyor; yetmeyen elmas, kuyruk olmayan şey reddediliyor.
 *   2. Play satın alma: Play'e sorulmadan elmas yok; jeton bir kez;
 *      başka hesabın jetonu, bekleyen, iptal, yanlış ürün reddediliyor;
 *      elmas yazıldıktan SONRA tüketiliyor; tüketme düşerse worker
 *      tamamlıyor; iade elması geri alıyor (bakiye eksiye inebiliyor).
 *   3. Ödüllü reklam: ödülü yalnız Google'ın imzalı çağrısı veriyor;
 *      kurcalanan imza, tekrar eden işlem, başka lordun oturumu ödül
 *      vermiyor; ödül kuyruğa ya da bankaya; bekleme ve günlük tavan.
 *
 * Google'ın yerini geliştirme taklitleri tutuyor (routes/devMagaza.ts);
 * bizim doğrulama kodumuzun hiçbir parçası atlanmıyor.
 *
 * API ayakta olmalı. node tools/magaza-testi.mjs
 */
import { kayitOl, onerilenDiyar } from './lib/kayit.mjs';
import { ekrana, rehberiSustur } from './lib/gezin.mjs';
import { ogreticiyiGec } from './lib/ogretici.mjs';
import { tarayiciAc } from './lib/tarayici.mjs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}

console.log('Lordlar Çağı — mağaza (öde, zamanı atla)\n');

const damga = Date.now().toString(36);
const diyar = await onerilenDiyar(API);
async function lord(harf) {
  const { token } = await kayitOl(API, {
    email: `mg${harf}${damga}@lordlar.dev`,
    lordName: `Mg${harf}${damga.slice(-5)}`,
    worldId: diyar,
  });
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const istek = async (yontem, y, govde) => {
    const r = await fetch(`${API}/api${y}`, {
      method: yontem,
      headers: h,
      ...(yontem === 'POST' ? { body: JSON.stringify(govde ?? {}) } : {}),
    });
    return { kod: r.status, govde: await r.json().catch(() => null) };
  };
  return {
    token,
    al: (y) => istek('GET', y).then((r) => r.govde),
    gonder: (y, g) => istek('POST', y, g),
  };
}
const ham = (y, g) =>
  fetch(`${API}/api${y}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(g ?? {}),
  }).then((r) => r.json());
const a = await lord('a');
const b = await lord('b');
const elmas = async (l) => (await l.al('/magaza')).elmas;

/* 0. Durum ------------------------------------------------------- */
const durum = await a.al('/magaza');
kontrol(
  'Mağaza durumu: paketler, Play (taklit), reklam, hesap etiketi',
  durum.paketler?.length >= 3 &&
    durum.play?.acik === true &&
    durum.reklam?.acik === true &&
    /^[0-9a-f]{40}$/.test(durum.play?.hesapEtiketi ?? '') &&
    !durum.play.hesapEtiketi.includes(durum.lordId ?? '§'),
  `${durum.paketler?.length} paket, birim ${durum.reklam?.birim}`,
);

/* 1. Elmasla hızlandırma ----------------------------------------- */
await a.gonder('/test/kaynak-ver', { altin: 20000, demir: 0, erzak: 20000 });
await a.gonder('/army/train', { unitType: 'milis', count: 10 });
const kisa = (await a.al('/magaza')).kuyruklar?.find((q) => q.kind === 'train');
const e0 = await elmas(a);
const hz = await a.gonder(`/kuyruk/${kisa?.id}/hizlandir`, { yontem: 'elmas' });
const e1 = await elmas(a);
const evde = (await a.al('/army')).home?.milis ?? 0;
kontrol(
  'Elmasla hızlandırma: bedel düşüyor, askerler evde',
  hz.kod === 200 &&
    e0 - e1 === kisa?.bedel &&
    hz.govde?.harcananElmas === kisa?.bedel &&
    evde >= 10,
  `${hz.kod} ${hz.govde?.code ?? ''} bedel ${kisa?.bedel}, elmas ${e0} → ${e1}, evde ${evde}`,
);
// Komuta kapasitesi 90: 10 + 60 + sonra 15 (borçluyken denenecek iş).
await a.gonder('/army/train', { unitType: 'milis', count: 60 });
const uzun = (await a.al('/magaza')).kuyruklar?.find((q) => q.kind === 'train');
const pahali = await a.gonder(`/kuyruk/${uzun?.id}/hizlandir`, { yontem: 'elmas' });
kontrol(
  'Elmas yetmezse reddediliyor',
  uzun?.bedel > e1 && pahali.kod === 400 && pahali.govde?.code === 'YETERSIZ_ELMAS',
  `bedel ${uzun?.bedel} > ${e1}: ${pahali.kod} ${pahali.govde?.code ?? ''}`,
);
const yok = await a.gonder('/kuyruk/olmayan-is/hizlandir', { yontem: 'elmas' });
const baskasi = await b.gonder(`/kuyruk/${uzun?.id}/hizlandir`, { yontem: 'elmas' });
const bos = await a.gonder(`/kuyruk/${uzun?.id}/hizlandir`, { yontem: 'banka' });
kontrol(
  'Olmayan ya da başkasının işi hızlanmıyor; banka boşsa ret',
  yok.govde?.code === 'KUYRUK_YOK' &&
    baskasi.govde?.code === 'KUYRUK_YOK' &&
    bos.govde?.code === 'BANKA_BOS',
  `${yok.govde?.code} / ${baskasi.govde?.code} / ${bos.govde?.code}`,
);

/* 2. Play satın alma --------------------------------------------- */
const paket = durum.paketler.find((p) => p.ek > 0) ?? durum.paketler[0];
const { jeton } = (await a.gonder('/test/play/satin-al', { urun: paket.urun })).govde;
const p0 = await elmas(a);
const ilk = await a.gonder('/magaza/play/dogrula', { urun: paket.urun, jeton });
const p1 = await elmas(a);
const playDurum = await fetch(`${API}/api/test/play/durum?jeton=${encodeURIComponent(jeton)}`).then(
  (r) => r.json(),
);
kontrol(
  'Satın alma: Play doğruladı, paket toplamı kadar elmas, sonra tüketildi',
  ilk.kod === 200 &&
    ilk.govde?.durum === 'verildi' &&
    p1 - p0 === paket.toplam &&
    playDurum.tuketildi === true,
  `${ilk.kod} ${ilk.govde?.durum ?? ilk.govde?.code} +${p1 - p0}/${paket.toplam}, tüketildi=${playDurum.tuketildi}`,
);
const tekrar = await a.gonder('/magaza/play/dogrula', { urun: paket.urun, jeton });
const baskaHesap = await b.gonder('/magaza/play/dogrula', { urun: paket.urun, jeton });
kontrol(
  'Aynı jeton ikinci kez elmas vermiyor; başka hesap kullanamıyor',
  tekrar.govde?.durum === 'zaten' &&
    (await elmas(a)) === p1 &&
    baskaHesap.kod === 409 &&
    baskaHesap.govde?.code === 'BASKA_HESAP',
  `${tekrar.govde?.durum} / ${baskaHesap.kod} ${baskaHesap.govde?.code ?? ''}`,
);

// Aynı jeton aynı anda iki istekle: tek elmas.
const { jeton: es } = (await a.gonder('/test/play/satin-al', { urun: 'elmas_100' })).govde;
const e2 = await elmas(a);
const [x1, x2] = await Promise.all([
  a.gonder('/magaza/play/dogrula', { urun: 'elmas_100', jeton: es }),
  a.gonder('/magaza/play/dogrula', { urun: 'elmas_100', jeton: es }),
]);
const e3 = await elmas(a);
kontrol(
  'Eş zamanlı iki doğrulama: elmas bir kez',
  [x1.govde?.durum, x2.govde?.durum].sort().join(',') === 'verildi,zaten' && e3 - e2 === 100,
  `${x1.govde?.durum}/${x2.govde?.durum}, +${e3 - e2}`,
);

const yabanci = (
  await a.gonder('/test/play/satin-al', { urun: 'elmas_100', hesapEtiketi: 'f'.repeat(40) })
).govde.jeton;
const bekleyen = (await a.gonder('/test/play/satin-al', { urun: 'elmas_100', durum: 'bekliyor' }))
  .govde.jeton;
const iptal = (await a.gonder('/test/play/satin-al', { urun: 'elmas_100', durum: 'iptal' })).govde
  .jeton;
const e4 = await elmas(a);
const r1 = await a.gonder('/magaza/play/dogrula', { urun: 'elmas_100', jeton: yabanci });
const r2 = await a.gonder('/magaza/play/dogrula', { urun: 'elmas_100', jeton: bekleyen });
const r3 = await a.gonder('/magaza/play/dogrula', { urun: 'elmas_100', jeton: iptal });
const r4 = await a.gonder('/magaza/play/dogrula', { urun: 'elmas_2600', jeton: bekleyen });
const r5 = await a.gonder('/magaza/play/dogrula', { urun: 'elmas_bedava', jeton: bekleyen });
const r6 = await a.gonder('/magaza/play/dogrula', {
  urun: 'elmas_100',
  jeton: 'uydurma-jeton-123',
});
kontrol(
  'Başka hesabın, bekleyen, iptal, yanlış ürün, uydurma: hiçbiri elmas vermiyor',
  r1.govde?.code === 'BASKA_HESAP' &&
    r2.govde?.durum === 'bekliyor' &&
    r3.govde?.code === 'SATIN_ALMA_IPTAL' &&
    r4.govde?.code === 'GECERSIZ_SATIN_ALMA' &&
    r5.govde?.code === 'URUN_YOK' &&
    r6.govde?.code === 'GECERSIZ_SATIN_ALMA' &&
    (await elmas(a)) === e4,
  [r1, r2, r3, r4, r5, r6].map((r) => r.govde?.code ?? r.govde?.durum).join(' / '),
);

// Tüketme düşerse: elmas verilmiş, worker sonra tüketiyor.
const { jeton: gec } = (await a.gonder('/test/play/satin-al', { urun: 'elmas_100' })).govde;
await ham('/test/play/kesinti', { kip: 'tuketme' });
const tg = await a.gonder('/magaza/play/dogrula', { urun: 'elmas_100', jeton: gec });
const once = await fetch(`${API}/api/test/play/durum?jeton=${encodeURIComponent(gec)}`).then((r) =>
  r.json(),
);
await ham('/test/play/kesinti', { kip: 'yok' });
const tara = await ham('/test/play-tara');
const sonra = await fetch(`${API}/api/test/play/durum?jeton=${encodeURIComponent(gec)}`).then((r) =>
  r.json(),
);
kontrol(
  'Tüketme düşünce elmas yine verildi; worker sonra tüketti',
  tg.govde?.durum === 'verildi' &&
    once.tuketildi === false &&
    sonra.tuketildi === true &&
    tara.tuketilen >= 1,
  `${tg.govde?.durum}, ${once.tuketildi} → ${sonra.tuketildi}`,
);
await ham('/test/play/kesinti', { kip: 'hepsi' });
const { jeton: kes } = (await a.gonder('/test/play/satin-al', { urun: 'elmas_100' })).govde;
const kesik = await a.gonder('/magaza/play/dogrula', { urun: 'elmas_100', jeton: kes });
await ham('/test/play/kesinti', { kip: 'yok' });
kontrol(
  "Google'a ulaşılamıyorsa elmas yok, yeniden denenebilir",
  kesik.kod === 503 && kesik.govde?.code === 'PLAY_ULASILAMIYOR',
  `${kesik.kod} ${kesik.govde?.code ?? ''}`,
);

// İade: elmas geri alınıyor; harcanmışsa bakiye eksiye.
// Satın alınan elmasın bir kısmı harcanıyor: yukarıdaki uzun eğitim.
await a.gonder(`/kuyruk/${uzun?.id}/hizlandir`, { yontem: 'elmas' });
const i0 = await elmas(a);
await ham('/test/play/iade', { jeton });
const iadeTara = await ham('/test/play-tara');
const i1 = await elmas(a);
const gecmis = (await a.al('/magaza')).gecmis ?? [];
kontrol(
  'İade edilen satın almanın elması geri alındı, geçmişte "iade"',
  iadeTara.iade >= 1 && i0 - i1 === paket.toplam && gecmis.some((g) => g.durum === 'iade'),
  `${i0} → ${i1}`,
);
await ham('/test/play/iade', { jeton: es });
await ham('/test/play/iade', { jeton: gec });
await ham('/test/play-tara');
const borc = await elmas(a);
await a.gonder('/army/train', { unitType: 'milis', count: 15 });
const kucuk = (await a.al('/magaza')).kuyruklar?.find((q) => q.kind === 'train');
const borcluyken = await a.gonder(`/kuyruk/${kucuk?.id}/hizlandir`, { yontem: 'elmas' });
kontrol(
  'Harcanmış elmasın iadesi bakiyeyi eksiye indiriyor; borçluyken hiçbir şey hızlanmıyor',
  borc < 0 && borcluyken.govde?.code === 'YETERSIZ_ELMAS',
  `bakiye ${borc}, ${borcluyken.govde?.code ?? borcluyken.kod}`,
);

/* 3. Ödüllü reklam ----------------------------------------------- */
await b.gonder('/test/kaynak-ver', { altin: 20000, demir: 0, erzak: 20000 });
// İlk eğitim bilerek kısa (öğretici): ödülün kuyruğa yazıldığını görmek
// için ikinci, uzun bir eğitim.
await b.gonder('/army/train', { unitType: 'milis', count: 5 });
await b.gonder('/test/kuyruklari-bitir');
await b.gonder('/army/train', { unitType: 'milis', count: 60 });
const hedef = (await b.al('/magaza')).kuyruklar?.find((q) => q.kind === 'train');
const o1 = await b.gonder('/reklam/oturum', { hedefKuyrukId: hedef?.id });
const izle = await b.gonder('/test/reklam/izle', { oturumId: o1.govde?.oturumId });
const od = await b.al(`/reklam/oturum/${o1.govde?.oturumId}`);
const hedefSonra = (await b.al('/magaza')).kuyruklar?.find((q) => q.id === hedef?.id);
kontrol(
  'İmzalı çağrı ödülü verdi: kuyruktan 15 dakika silindi',
  o1.kod === 200 &&
    izle.govde?.kod === 200 &&
    od?.durum === 'odullendi' &&
    od?.kuyrukSaniye === 900 &&
    hedef.kalanSaniye - hedefSonra?.kalanSaniye >= 890,
  `${o1.kod} ${o1.govde?.code ?? ''} · ${JSON.stringify(izle.govde?.govde)} · ${hedef?.kalanSaniye} → ${hedefSonra?.kalanSaniye}`,
);
const tekrarIs = await b.gonder('/test/reklam/izle', {
  oturumId: o1.govde?.oturumId,
  islemNo: izle.govde?.islemNo,
});
const hedefTekrar = (await b.al('/magaza')).kuyruklar?.find((q) => q.id === hedef?.id);
kontrol(
  'Aynı Google işlemi ikinci kez ödül vermiyor',
  tekrarIs.govde?.govde?.sonuc === 'tekrar' &&
    Math.abs(hedefTekrar.kalanSaniye - hedefSonra.kalanSaniye) <= 5,
  JSON.stringify(tekrarIs.govde?.govde),
);
const hemen = await b.gonder('/reklam/oturum', {});
kontrol(
  'İki reklam arası bekleme',
  hemen.kod === 429 && hemen.govde?.code === 'REKLAM_BEKLE',
  `${hemen.kod} ${hemen.govde?.code ?? ''}`,
);
await b.gonder('/test/reklam/bekleme-gecir');
const o2 = await b.gonder('/reklam/oturum', {});
const kurcali = await b.gonder('/test/reklam/izle', {
  oturumId: o2.govde?.oturumId,
  kurcala: true,
});
const yabanciLord = await b.gonder('/test/reklam/izle', {
  oturumId: o2.govde?.oturumId,
  kullanici: (await a.al('/magaza')).play.hesapEtiketi,
});
const o2d = await b.al(`/reklam/oturum/${o2.govde?.oturumId}`);
kontrol(
  'Kurcalanmış imza reddediliyor; başka lordun etiketi ödül almıyor',
  kurcali.govde?.kod === 400 &&
    yabanciLord.govde?.govde?.sonuc === 'yok_sayildi' &&
    o2d?.durum === 'bekliyor',
  `${kurcali.govde?.kod} / ${yabanciLord.govde?.govde?.sonuc} / ${o2d?.durum}`,
);
const izle2 = await b.gonder('/test/reklam/izle', { oturumId: o2.govde?.oturumId });
const banka = (await b.al('/magaza')).reklamDakikasi;
kontrol(
  'Hedefsiz reklam: ödül bankaya',
  izle2.govde?.govde?.sonuc === 'odullendi' && banka === 15,
  `banka ${banka} dk`,
);
const bh = await b.gonder(`/kuyruk/${hedef?.id}/hizlandir`, { yontem: 'banka' });
const hedefBanka = (await b.al('/magaza')).kuyruklar?.find((q) => q.id === hedef?.id);
kontrol(
  'Biriken süre bir kuyrukta kullanılıyor',
  bh.kod === 200 &&
    bh.govde?.harcananDakika === 15 &&
    bh.govde?.kalanBanka === 0 &&
    hedefSonra.kalanSaniye - (hedefBanka?.kalanSaniye ?? 0) >= 890,
  `${bh.kod} ${JSON.stringify(bh.govde)}`,
);
let son;
for (let i = 0; i < 6; i++) {
  await b.gonder('/test/reklam/bekleme-gecir');
  son = await b.gonder('/reklam/oturum', {});
  if (son.kod !== 200) break;
}
const durumB = await b.al('/magaza');
kontrol(
  'Günlük tavan: açılan oturumlar sayılıyor',
  son.kod === 429 && son.govde?.code === 'REKLAM_TAVAN' && durumB.reklam?.hak?.kalan === 0,
  `${son.kod} ${son.govde?.code ?? ''}, kalan ${durumB.reklam?.hak?.kalan}`,
);
// Aydınlatma Metni "N gün sonra siliniyor" diyor: süresi dolan gidiyor, yenisi kalıyor.
const saklama = (await b.gonder('/test/reklam/saklama')).govde;
kontrol(
  'Saklama süresi dolan reklam oturumu siliniyor, yenileri kalıyor',
  saklama?.silinen >= 1 &&
    saklama.eskiKaldi === false &&
    saklama.sonra === saklama.once - 1 &&
    saklama.sonra > 0,
  JSON.stringify(saklama),
);

/* 4. app-ads.txt ------------------------------------------------- */
const appAds = await fetch(`${API}/app-ads.txt`);
kontrol('app-ads.txt yayıncı kimliği yokken yok (404)', appAds.status === 404, `${appAds.status}`);

/* 5. Arayüz (web kipi) ------------------------------------------- */
{
  const c = await lord('c');
  await c.gonder('/test/kaynak-ver', { altin: 20000, demir: 0, erzak: 20000 });
  await c.gonder('/army/train', { unitType: 'milis', count: 5 });
  await c.gonder('/test/kuyruklari-bitir');
  await c.gonder('/army/train', { unitType: 'milis', count: 8 });
  const once = (await c.al('/magaza')).kuyruklar.find((q) => q.kind === 'train');
  const tarayici = await tarayiciAc();
  const sayfa = await tarayici.newPage({ viewport: { width: 390, height: 844 } });
  const hatalar = [];
  sayfa.on('pageerror', (e) => hatalar.push(e.message));
  await sayfa.goto(WEB, { waitUntil: 'domcontentloaded' });
  await sayfa.evaluate((t) => localStorage.setItem('lordlar_token', t), c.token);
  await sayfa.reload({ waitUntil: 'domcontentloaded' });
  await sayfa.waitForSelector('nav button:has-text("Şehir")', { timeout: 20000 });
  await ogreticiyiGec(sayfa);
  await rehberiSustur(sayfa);
  try {
    /*
     * CI'da binaya dokunuş şehir sahnesi hazır olmadan gidebiliyor ve kapı
     * açılmıyordu (yerelde hiç görülmedi). Panel görünene kadar bekle,
     * açılmadıysa bir kez daha dokun.
     */
    for (let deneme = 0; deneme < 2; deneme++) {
      await ekrana(sayfa, 'kisla');
      const acildi = await sayfa
        .locator('[role="dialog"][aria-label="Kışla"]')
        .waitFor({ timeout: 10000 })
        .then(
          () => true,
          () => false,
        );
      if (acildi) break;
    }
    const dugme = sayfa.locator(`[data-hizlandir="${once.id}"]`).first();
    await dugme.waitFor({ state: 'visible', timeout: 20000 });
    await dugme.scrollIntoViewIfNeeded();
    await dugme.click();
    const elmasDugmesi = sayfa.locator('[data-hizlandir-penceresi] [data-hizlandir-elmas]');
    await elmasDugmesi.waitFor({ timeout: 8000 });
    await sayfa.screenshot({ path: `${process.env.CIKTI ?? 'ekran-goruntuleri'}/hizlandir.png` });
    await elmasDugmesi.click();
    await sayfa.waitForTimeout(1500);
    const sonra = (await c.al('/magaza')).kuyruklar.find((q) => q.id === once.id);
    kontrol(
      'Arayüz: Kışla’da Hızlandır → elmasla bitir',
      !sonra && (await sayfa.locator('[data-hizlandir-penceresi]').count()) === 0,
      sonra ? `iş hâlâ sürüyor (${sonra.kalanSaniye} sn)` : 'iş bitti, pencere kapandı',
    );
    await sayfa.locator('[data-ust-elmas]').click();
    const magaza = sayfa.locator('[data-magaza="web"]');
    await magaza.waitFor({ timeout: 8000 });
    const paketSayisi = await sayfa.locator('[data-paket]').count();
    const metin = await magaza.innerText();
    kontrol(
      'Arayüz: elmas sayacından Mağaza (web): paketler, ilke, satış uygulamada',
      paketSayisi === durum.paketler.length &&
        (await sayfa.locator('[data-magaza-web]').count()) === 1 &&
        /Satılmayanlar/i.test(metin) &&
        (await sayfa.locator('[data-magaza-reklam="kapali"]').count()) === 1,
      `${paketSayisi} paket`,
    );
    await sayfa.screenshot({
      path: `${process.env.CIKTI ?? 'ekran-goruntuleri'}/magaza.png`,
      fullPage: false,
    });
  } catch (e) {
    // CI kalanında neyin açık olduğu görünsün: görüntü /tmp'de (yapıt), pencereler raporda.
    await sayfa.screenshot({ path: '/tmp/magaza-arayuz-hata.png' }).catch(() => {});
    const pencereler = await sayfa
      .$$eval('[role="dialog"]', (d) => d.map((x) => x.getAttribute('aria-label') ?? '?'))
      .catch(() => []);
    kontrol(
      'Arayüz akışı tamamlandı',
      false,
      `${String(e?.message ?? e).slice(0, 140)} · açık pencereler: ${JSON.stringify(pencereler)}`,
    );
  }
  kontrol('Arayüzde sayfa hatası yok', hatalar.length === 0, hatalar.slice(0, 2).join(' | '));
  await tarayici.close();
}

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
