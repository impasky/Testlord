/**
 * Araştırma ağacını uçtan uca sınar (docs/20).
 *
 * Asıl soru "uç 200 dönüyor mu" değil, "araştırma bir şey DEĞİŞTİRİYOR
 * mu" ve "kurallar sunucuda mı": her düğüm oyuncudan yüz binlerce kaynak
 * istiyor. Hiçbir yere bağlanmamış bir etki, alınmış ve karşılığı
 * verilmemiş kaynak demek; yalnız ekranda duran bir kural (dışlayan
 * seçim, erken araştırma penceresi, yol bırakma beklemesi) ise ilk
 * elle yazılmış istekte delinen bir kural. O yüzden her kontrol ya
 * araştırmadan ÖNCEKİ ve SONRAKİ sayıyı karşılaştırıyor ya da kuralı
 * doğrudan API'ye çiğnetmeye çalışıyor.
 *
 * API ayakta olmalı. node tools/arastirma-testi.mjs
 */
import { readFileSync } from 'node:fs';

const API = process.env.API_URL ?? 'http://localhost:3000';
const B = JSON.parse(readFileSync(new URL('../data/balance.json', import.meta.url), 'utf8'));
const A = B.arastirma;

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
    lordName: `Arastirici ${damga.toString(36).slice(-4) + Math.random().toString(36).slice(2, 4)}`,
  }),
}).then((r) => r.json());

const bas = { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' };
const al = (y) => fetch(`${API}/api${y}`, { headers: bas }).then((r) => r.json());
const gonder = (y, g = {}, yontem = 'POST') =>
  fetch(`${API}/api${y}`, { method: yontem, headers: bas, body: JSON.stringify(g) }).then(
    async (r) => ({ durum: r.status, govde: await r.json().catch(() => ({})) }),
  );

const dugum = (agac, key) => (agac.dallar ?? []).find((d) => d.key === key);
const grup = (agac, key) => (agac.gruplar ?? []).find((g) => g.key === key);

/**
 * Lordu TAM hedef seviyeye çıkarır. Erken araştırma penceresi seviye
 * farkına bağlı; fazla XP verip hedefi aşmak kontrolleri sessizce
 * anlamsızlaştırırdı. Her çağrı yalnız bir sonraki seviyenin eksiğini veriyor.
 */
async function seviyeyeCik(hedef) {
  for (let i = 0; i < 80; i++) {
    const l = (await al('/me')).lord;
    if (l.level >= hedef) return l.level;
    await gonder('/test/xp-ver', { miktar: l.xpForNext - l.xp });
  }
  return (await al('/me')).lord.level;
}

/** Araştırmayı başlatır ve bitirir; olmazsa sebebiyle KALDI yazar. */
async function arastir(key) {
  const y = await gonder('/arastirma', { key });
  if (y.durum !== 200) {
    kontrol(`zincir: ${key}`, false, JSON.stringify(y.govde).slice(0, 110));
    return false;
  }
  await gonder('/test/kuyruklari-bitir');
  return true;
}

const zengin = () =>
  gonder('/test/kaynak-ver', { altin: 1_500_000, demir: 800_000, erzak: 800_000 });

/* --- 1. Ağaç okunuyor mu --- */
const bos = await al('/arastirma');
kontrol('ağaç 60 düğümle geliyor', bos.dallar?.length === 60, `${bos.dallar?.length} düğüm`);
kontrol(
  'ilerleme 47 üzerinden sıfır (dışlayan seçimler sayılmıyor)',
  bos.ilerleme?.biten === 0 && bos.ilerleme?.toplam === 47,
  JSON.stringify(bos.ilerleme),
);
kontrol(
  'dört sekme, her birinin sütun başlıkları var',
  bos.sekmeler?.length === 4 &&
    bos.sekmeler.every((s) => s.ad && Array.isArray(s.sutunlar) && s.sutunlar.length >= 3),
  (bos.sekmeler ?? []).map((s) => `${s.key}:${s.sutunlar?.join(',')}`).join(' '),
);
kontrol(
  'altı çağ, seviye kapısı artarak',
  bos.caglar?.length === 6 && bos.caglar.every((c, i, a) => i === 0 || c.seviye > a[i - 1].seviye),
  (bos.caglar ?? []).map((c) => `${c.ad}:${c.seviye}`).join(' '),
);
const bosDoktrin = grup(bos, 'doktrin');
kontrol(
  'üç büyük seçim; öğretide üç yol, hiçbiri seçili değil',
  bos.gruplar?.length === 3 &&
    bosDoktrin?.secenekler?.length === 3 &&
    bosDoktrin.secili === null &&
    bosDoktrin.birakma === null,
  (bos.gruplar ?? []).map((g) => `${g.key}:${g.secenekler?.length}`).join(' '),
);
kontrol(
  'süren araştırma yok',
  bos.suren === null && bos.surenler?.length === 0 && bos.esZamanli >= 1,
  `yuva ${bos.esZamanli}`,
);

const kilitli = (bos.dallar ?? []).filter((d) => !d.acik && !d.tamamlandi);
kontrol('yeni lordun çoğu düğümü kilitli', kilitli.length > 40, `${kilitli.length} kilitli`);
kontrol(
  'her kilitli düğüm sebebini yazıyor',
  kilitli.every((d) => (d.engel ?? '').length > 10),
  kilitli.find((d) => (d.engel ?? '').length <= 10)?.key ?? kilitli[0]?.engel ?? '',
);
const bosDegirmen = dugum(bos, 'degirmenler');
kontrol(
  'önkoşulu eksik düğüm önkoşulun adını söylüyor',
  bosDegirmen?.acik === false && /Önce Ambarlar/.test(bosDegirmen?.engel ?? ''),
  bosDegirmen?.engel ?? '',
);

/* --- 2. Erken araştırma: kapı kalkmıyor, süre uzuyor --- */
await seviyeyeCik(1);
const L0 = (await al('/arastirma')).lordSeviyesi;
const ambar = dugum(bos, 'ambarlar');
const hamSure = A.sure_taban_dakika * 60; // 1. çağ, çarpansız
const erkenFark = ambar.lord_seviyesi - L0;
kontrol(
  `kapısının ${erkenFark} seviye altında Ambarlar açık, "erken" işaretli`,
  erkenFark > 0 &&
    ambar.acik === true &&
    ambar.erken === true &&
    /erken/.test(ambar.sureNotu ?? ''),
  `${ambar.engel ?? ''} ${ambar.sureNotu ?? ''}`,
);
const beklenenErken = hamSure * (1 + erkenFark * A.erken_ceza_seviye_basina);
kontrol(
  'erken araştırmanın süresi seviye başına cezayla uzuyor',
  Math.abs(ambar.sureSn - beklenenErken) <= 2,
  `${ambar.sureSn} sn, beklenen ${beklenenErken}`,
);

await zengin();
const onceDepo = (await al('/me')).lord?.storageCapacity ?? 0;
const t0 = Date.now();
const basla = await gonder('/arastirma', { key: 'ambarlar' });
kontrol(
  'erken araştırma başlatıldı, cevap erken olduğunu söylüyor',
  basla.durum === 200 && basla.govde.erken === true,
  `HTTP ${basla.durum}`,
);
const kalanSn = (new Date(basla.govde.finishAt).getTime() - t0) / 1000;
kontrol(
  'kuyruğa yazılan süre ön izlemedekiyle aynı',
  Math.abs(kalanSn - ambar.sureSn) <= 5,
  `${Math.round(kalanSn)} sn / ön izleme ${ambar.sureSn} sn`,
);

const suren = await al('/arastirma');
kontrol(
  'süren araştırma görünüyor',
  suren.suren?.key === 'ambarlar' && suren.surenler?.length === 1 && !!suren.surenler[0].startedAt,
  suren.suren?.ad ?? 'yok',
);
kontrol(
  'süren düğüm "Araştırılıyor" diyor, açık değil',
  dugum(suren, 'ambarlar')?.suruyor === true && dugum(suren, 'ambarlar')?.acik === false,
);
if (suren.esZamanli === 1) {
  const ikinci = await gonder('/arastirma', { key: 'talim_meydani' });
  kontrol('tek yuvada ikinci araştırma açılamıyor', ikinci.durum >= 400, `HTTP ${ikinci.durum}`);
}

await gonder('/test/kuyruklari-bitir');
const sonrasi = await al('/arastirma');
kontrol(
  'araştırma tamamlandı, ilerleme arttı',
  sonrasi.tamamlanan?.includes('ambarlar') === true && sonrasi.ilerleme?.biten === 1,
  JSON.stringify(sonrasi.tamamlanan),
);
const sonraDepo = (await al('/me')).lord?.storageCapacity ?? 0;
kontrol('Ambarlar depoyu BÜYÜTTÜ', sonraDepo > onceDepo, `${onceDepo} -> ${sonraDepo}`);
kontrol(
  'önkoşul bitince üst düğümün engeli önkoşul değil',
  !/Önce/.test(dugum(sonrasi, 'degirmenler')?.engel ?? ''),
  dugum(sonrasi, 'degirmenler')?.engel ?? 'açık',
);

/* --- 3. Pencerenin dışı kapalı --- */
await arastir('talim_meydani');
const pencere = await al('/arastirma');
const zirh = dugum(pencere, 'zirh_atolyesi');
const acilisSeviyesi = zirh.lord_seviyesi - A.erken_pencere_seviye;
if (L0 < acilisSeviyesi) {
  kontrol(
    'pencere dışındaki düğüm kapalı ve hangi seviyede açılacağını söylüyor',
    zirh.acik === false &&
      new RegExp(`Lord seviyesi ${zirh.lord_seviyesi}`).test(zirh.engel ?? '') &&
      new RegExp(`seviye ${acilisSeviyesi}`).test(zirh.engel ?? ''),
    zirh.engel ?? '',
  );
  const zorla = await gonder('/arastirma', { key: 'zirh_atolyesi' });
  kontrol(
    'API pencere dışındaki düğümü reddediyor',
    zorla.durum === 400 && zorla.govde.code === 'ARASTIRMA_KAPALI',
    `HTTP ${zorla.durum} ${zorla.govde.code ?? ''}`,
  );
}
await seviyeyeCik(acilisSeviyesi);
const kenar = dugum(await al('/arastirma'), 'zirh_atolyesi');
kontrol(
  `seviye ${acilisSeviyesi}: pencerenin kenarında açıldı, en ağır cezayla`,
  kenar.acik === true && kenar.erken === true,
  kenar.sureNotu ?? kenar.engel ?? '',
);

/* --- 4. Çoklu önkoşul: Lonca Düzeni iki düğüm istiyor --- */
await seviyeyeCik(10);
await zengin();
await arastir('degirmenler');
const yarim = await al('/arastirma');
const lonca = dugum(yarim, 'lonca_duzeni');
const loncaOnkosul = Object.fromEntries((lonca?.onkosulDurumu ?? []).map((o) => [o.key, o.tamam]));
kontrol(
  'önkoşulun biri bitince Lonca yalnız eksik olanı istiyor',
  lonca?.acik === false &&
    /Taş Ocakları/.test(lonca.engel ?? '') &&
    !/Değirmenler/.test(lonca.engel ?? '') &&
    loncaOnkosul.degirmenler === true &&
    loncaOnkosul.tas_ocaklari === false,
  lonca?.engel ?? '',
);
const loncaZorla = await gonder('/arastirma', { key: 'lonca_duzeni' });
kontrol('API eksik önkoşulu reddediyor', loncaZorla.durum === 400, `HTTP ${loncaZorla.durum}`);
await arastir('tas_ocaklari');
kontrol(
  'iki önkoşul da bitince Lonca açıldı',
  dugum(await al('/arastirma'), 'lonca_duzeni')?.acik === true,
);

/* --- 5. Geride kalma indirimi ve araştırma yuvası --- */
await seviyeyeCik(20);
await zengin();
const gec = await al('/arastirma');
const katip = dugum(gec, 'katipler');
const geride = 20 - katip.lord_seviyesi - A.geride_esik_seviye;
const indirim = Math.min(A.geride_azami_indirim, geride * A.geride_indirim_seviye_basina);
kontrol(
  'çağının gerisindeki düğüm indirimle daha kısa sürüyor',
  Math.abs(katip.sureSn - hamSure * (1 - indirim)) <= 2 &&
    /gerisindesin/.test(katip.sureNotu ?? ''),
  `${katip.sureSn} sn, ${katip.sureNotu ?? ''}`,
);
const onceYuva = gec.esZamanli;
await arastir('katipler');
await arastir('medrese');
const yuvali = await al('/arastirma');
kontrol(
  'Medrese bir araştırma yuvası açtı',
  yuvali.esZamanli === onceYuva + 1 && yuvali.yuva?.arastirma === 1,
  `${onceYuva} -> ${yuvali.esZamanli} (${JSON.stringify(yuvali.yuva)})`,
);

/* --- 6. Dışlayan seçim: iki öğreti aynı anda başlatılamaz --- */
await arastir('savas_sanati');
const [y1, y2] = await Promise.all([
  gonder('/arastirma', { key: 'akinci_ogretisi' }),
  gonder('/arastirma', { key: 'menzil_ogretisi' }),
]);
const kazananlar = [y1, y2].filter((y) => y.durum === 200).length;
const kaybeden = [y1, y2].find((y) => y.durum !== 200);
kontrol(
  'aynı anda gelen iki öğretiden yalnız biri başladı (yuva boşken)',
  kazananlar === 1 && kaybeden?.govde?.code === 'ARASTIRMA_KAPALI',
  `${y1.durum}/${y2.durum} ${kaybeden?.govde?.error ?? ''}`,
);
const secilen = y1.durum === 200 ? 'akinci' : 'menzil';
const secilenIlk = `${secilen}_ogretisi`;
const ikinciDugum = secilen === 'akinci' ? 'hilal_ustaligi' : 'ok_yagmuru_ustaligi';
const sureIcinde = await al('/arastirma');
const kale = dugum(sureIcinde, 'kale_ogretisi');
kontrol(
  'bir öğreti sürerken öteki yollar kapalı ve nedenini söylüyor',
  kale?.kapali === true &&
    kale.acik === false &&
    /Savaş öğretisi: .+ seçili/.test(kale.engel ?? ''),
  kale?.engel ?? '',
);
const surerkenBirak = await gonder('/arastirma/yol-birak', { grup: 'doktrin' });
kontrol(
  'henüz bitmemiş bir seçim bırakılmıyor (iptal ediliyor)',
  surerkenBirak.durum === 400 && surerkenBirak.govde.code === 'YOL_SECILMEDI',
  `HTTP ${surerkenBirak.durum} ${surerkenBirak.govde.code ?? ''}`,
);
await gonder('/test/kuyruklari-bitir');

/* --- 7. Yolu bırakmak: bedel, iade, bekleme --- */
const yolda = await gonder('/arastirma', { key: ikinciDugum });
kontrol('yolun ikinci düğümü başladı', yolda.durum === 200, `HTTP ${yolda.durum}`);
const arastirilirken = await gonder('/arastirma/yol-birak', { grup: 'doktrin' });
kontrol(
  'yolun bir düğümü arastirilirken yol bırakılamıyor',
  arastirilirken.durum === 400 && arastirilirken.govde.code === 'YOL_ARASTIRILIYOR',
  `HTTP ${arastirilirken.durum} ${arastirilirken.govde.error ?? ''}`,
);
await gonder('/test/kuyruklari-bitir');

const birakmadan = await al('/arastirma');
const dk = grup(birakmadan, 'doktrin');
const beklenenIade = (kademeler) =>
  Math.floor(
    kademeler.reduce((t, k) => t + A.maliyet_taban.altin * Math.pow(k, A.maliyet_us), 0) *
      A.yol_degisim_iadesi,
  );
kontrol(
  'seçili yol ve bırakmanın bedeli önceden görünüyor',
  dk?.secili === secilen &&
    dk.birakma?.acik === true &&
    dk.birakma.silinecek?.length === 2 &&
    Math.abs(dk.birakma.iade.altin - beklenenIade([2, 3])) <= 2,
  `${dk?.secili} silinecek ${dk?.birakma?.silinecek?.map((s) => s.ad).join(', ')} iade ${dk?.birakma?.iade?.altin}`,
);

const onceAltin = (await al('/me')).lord?.resources?.altin ?? 0;
const birak = await gonder('/arastirma/yol-birak', { grup: 'doktrin' });
kontrol(
  'yol bırakıldı, iki düğümü silindi',
  birak.durum === 200 &&
    birak.govde.yol === secilen &&
    birak.govde.silinen?.length === 2 &&
    birak.govde.silinen.includes(secilenIlk) &&
    birak.govde.silinen.includes(ikinciDugum),
  `HTTP ${birak.durum} ${JSON.stringify(birak.govde.silinen ?? birak.govde)}`,
);
const sonraAltin = (await al('/me')).lord?.resources?.altin ?? 0;
kontrol(
  'bedellerin yarısı geri geldi',
  sonraAltin - onceAltin >= (birak.govde.iade?.altin ?? 1) && birak.govde.iade?.altin > 0,
  `${onceAltin} -> ${sonraAltin} (iade ${birak.govde.iade?.altin})`,
);
const birakti = await al('/arastirma');
kontrol(
  'silinen düğümler tamamlananlardan çıktı, kök kaldı',
  !birakti.tamamlanan.includes(secilenIlk) &&
    !birakti.tamamlanan.includes(ikinciDugum) &&
    birakti.tamamlanan.includes('savas_sanati'),
  JSON.stringify(birakti.tamamlanan),
);
kontrol(
  'bırakınca öteki yollar yeniden açık',
  dugum(birakti, 'kale_ogretisi')?.acik === true && grup(birakti, 'doktrin')?.secili === null,
  dugum(birakti, 'kale_ogretisi')?.engel ?? '',
);

await arastir('kale_ogretisi');
const beklemede = await al('/arastirma');
const dk2 = grup(beklemede, 'doktrin');
kontrol(
  'yeni yol seçildi; değiştirme bekleme süresini söylüyor',
  dk2?.secili === 'kale' &&
    dk2.birakma?.acik === false &&
    /sonra değiştirebilirsin/.test(dk2.birakma?.engel ?? '') &&
    !!dk2.birakma?.sonrakiDegisim,
  dk2?.birakma?.engel ?? '',
);
const tekrarBirak = await gonder('/arastirma/yol-birak', { grup: 'doktrin' });
kontrol(
  `${A.yol_degisim_bekleme_saat} saat dolmadan ikinci kez bırakılamıyor`,
  tekrarBirak.durum === 400 && tekrarBirak.govde.code === 'YOL_BEKLEMEDE',
  `HTTP ${tekrarBirak.durum} ${tekrarBirak.govde.error ?? ''}`,
);
const ekonomi = await gonder('/arastirma/yol-birak', { grup: 'ekonomi' });
kontrol(
  'seçilmemiş bir grup bırakılamıyor',
  ekonomi.durum === 400 && ekonomi.govde.code === 'YOL_SECILMEDI',
  `HTTP ${ekonomi.durum} ${ekonomi.govde.code ?? ''}`,
);
const uydurmaGrup = await gonder('/arastirma/yol-birak', { grup: 'hanedan' });
kontrol('uydurma grup reddedildi', uydurmaGrup.durum === 404, `HTTP ${uydurmaGrup.durum}`);

/* --- 8. Komuta kapasitesi etkisi --- */
const onceKomuta = (await al('/me')).lord?.commandCapacity ?? 0;
await seviyeyeCik(27);
await zengin();
await arastir('zirh_atolyesi');
await arastir('sancak_beyligi');
const komutaSonra = (await al('/me')).lord?.commandCapacity ?? 0;
kontrol(
  'Sancak Beyliği komuta kapasitesini büyüttü',
  komutaSonra > onceKomuta,
  `${onceKomuta} -> ${komutaSonra}`,
);

/* --- 9. Tamamlanan tekrar başlatılamaz --- */
const tekrar = await gonder('/arastirma', { key: 'ambarlar' });
kontrol('tamamlanan araştırma tekrar başlatılamıyor', tekrar.durum >= 400, `HTTP ${tekrar.durum}`);

/* --- 10. İptal ve yarı iade --- */
await zengin();
const oncekiAltin = (await al('/me')).lord?.resources?.altin ?? 0;
const iptalEdilecek = await gonder('/arastirma', { key: 'tahil_ambarlari' });
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

/* --- 11. Uydurma anahtar --- */
const uydurma = await gonder('/arastirma', { key: 'ejderha_terbiyesi' });
kontrol('uydurma araştırma reddedildi', uydurma.durum === 404, `HTTP ${uydurma.durum}`);

console.log(`\n${hata === 0 ? 'TÜMÜ GEÇTİ' : `${hata} KONTROL KALDI`}`);
process.exit(hata === 0 ? 0 : 1);
