/**
 * 120 sanal oyuncuyla yük testi.
 *
 * docs/00'daki yedinci başarı kriteri: "120 oyuncu aynı dünyada, kimse
 * çökmeden oynayabiliyor." Dünya kapasitesi de 120 (data/balance.json ->
 * dunya.oyuncu_kapasitesi), yani bu sayı keyfi değil: bir shard'ın dolu
 * hâlidir.
 *
 * Ne ölçüyor: gerçek oyun döngüsünün karışımı. Okuma ağır basıyor çünkü
 * oyuncular çoğunlukla bakıyor; yazma da var çünkü asıl yük orada.
 *
 * Neden p95: ortalama gecikme yalan söyler. Bir istek 40 ms, biri 4 saniye
 * sürerse ortalama iyi görünür ama oyuncunun yarısı kötü deneyim yaşar.
 *
 * KULLANIM:
 *   node tools/yuk-testi.mjs                # 120 oyuncu, 5 tur
 *   OYUNCU=40 TUR=3 node tools/yuk-testi.mjs
 *   node tools/yuk-testi.mjs --500          # 500 oyuncu, 3 dk OTURUM (pnpm yuk-testi-500)
 *   OYUNCU=300 SURE=60 DUSUNME=5 node tools/yuk-testi.mjs
 *
 * İKİ KİP.
 *
 * TUR kipi (varsayılan) her oyuncuya sırayla aynı işleri yaptırıyor ve
 * ESZAMAN genişliğinde dalgalar salıyor: bir uçun en kötü hâlini bulmaya
 * iyi, ama gerçek bir akşamı anlatmıyor — 500 oyuncu aynı saniyede aynı
 * düğmeye basmıyor.
 *
 * OTURUM kipi (SURE saniye verilince) her oyuncuyu ayrı bir döngüde
 * yaşatıyor: istemcinin kendi yoklamaları (`/me` 30 sn, sohbet 30 sn,
 * diyar 60 sn — App.tsx, MobilKabuk, DunyaSeridi'deki aralıklar) ve
 * arada, ortalama DUSUNME saniyelik düşünme süresiyle, ağırlıklı bir
 * eylem karışımı (bak, eğit, üret, sohbet et, saldır). Oyuncular RAMPA
 * saniyede oyuna giriyor. Yanında üç ölçüm daha var:
 *
 *   - `/health` 2 sn'de bir: OLAY DÖNGÜSÜ tıkanıyor mu. Hiçbir iş yapmayan
 *     bir uç yavaşlıyorsa sunucu hesap yaparken kilitleniyor demektir.
 *   - API sürecinin belleği ve CPU'su (portu dinleyen süreç bulunabilirse,
 *     /proc'tan): bellek sızıntısı bir oturumda yükselen bir çizgidir.
 *   - SAVAŞ DALGASI: oturum bitince her oyuncu aynı anda bir bölgeye
 *     saldırıyor ve yürüyüş anında çözülüyor (`/test/yuruyusleri-bitir`,
 *     ürünün kendi çözüm yolu). Savaş motorunun eşzamanlı yükü.
 *
 * KAYIT SINIRI: kayıt/giriş IP başına dakikada AUTH_RATE_LIMIT_MAX (varsayılan
 * 60) istekle sınırlı. Yük testi tek IP'den geldiği için 429 alınca bekleyip
 * tekrar dener. Testi hızlandırmak istersen sunucuyu AUTH_RATE_LIMIT_MAX=1000
 * ile başlat.
 *
 * API ayakta olmalı. Test veritabanına yazar — üretimde çalıştırma.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const API = process.env.API_URL ?? 'http://localhost:3000';
// `--500`: yayın hedefinin ön ayarı — 500 oyuncu, 3 dakikalık oturum.
const ON_AYAR = process.argv.includes('--500') ? { OYUNCU: 500, SURE: 180 } : {};
const OYUNCU = Number(process.env.OYUNCU ?? ON_AYAR.OYUNCU ?? 120);
const TUR = Number(process.env.TUR ?? 5);
/** Oturum kipinin süresi (sn). 0 = tur kipi. */
const SURE = Number(process.env.SURE ?? ON_AYAR.SURE ?? 0);
/** İki eylem arası ortalama düşünme süresi (sn). */
const DUSUNME = Number(process.env.DUSUNME ?? 8);
/** Oyuncuların oyuna girişinin yayıldığı süre (sn). */
const RAMPA = Number(process.env.RAMPA ?? 30);
// Aynı anda kaç istek uçsun: hepsini birden salmak istemci tarafını da
// ölçmeye başlar, ölçtüğümüz şey sunucu olsun.
const ESZAMAN = Number(process.env.ESZAMAN ?? 30);

const olcum = new Map(); // uc -> { sureler: [], hata: 0 }
let toplamHata = 0;
let toplamKisitlama = 0; // 429: sunucu hatası değil, kasten konmuş sınır
const hataOrnekleri = [];

function kaydet(uc, ms, hataMi, detay) {
  let o = olcum.get(uc);
  if (!o) olcum.set(uc, (o = { sureler: [], hata: 0 }));
  o.sureler.push(ms);
  if (hataMi) {
    o.hata++;
    toplamHata++;
    if (hataOrnekleri.length < 5) hataOrnekleri.push(`${uc}: ${detay}`);
  }
}

/**
 * Ölçümün aşaması: savaş dalgasının istekleri "dalga · " önekiyle ayrı
 * satırlara düşüyor. Dalga kasten aşırı bir an (yüzlerce savaş aynı
 * saniyede); onun gecikmesi oturumun "oyuncu takıldı mı" eşiğine
 * karışırsa ikisi de bir şey söylemez.
 */
let asama = '';

async function istek(ucAdi, yol, secenek = {}) {
  const uc = asama ? `${asama} · ${ucAdi}` : ucAdi;
  const t = performance.now();
  try {
    const r = await fetch(`${API}/api${yol}`, secenek);
    const ms = performance.now() - t;
    // 4xx beklenen olabilir (kaynak yetmedi, kalkan var). 5xx asla.
    const kotu = r.status >= 500;
    if (r.status === 429) toplamKisitlama++;
    kaydet(uc, ms, kotu, kotu ? `HTTP ${r.status} ${(await r.text()).slice(0, 80)}` : '');
    if (r.ok) return await r.json().catch(() => null);
    return { _durum: r.status };
  } catch (e) {
    kaydet(uc, performance.now() - t, true, String(e).slice(0, 80));
    return null;
  }
}

/** Listeyi ESZAMAN genişliğinde parçalara bölerek işler. */
async function havuz(liste, isle) {
  const sonuc = [];
  for (let i = 0; i < liste.length; i += ESZAMAN) {
    sonuc.push(...(await Promise.all(liste.slice(i, i + ESZAMAN).map(isle))));
  }
  return sonuc;
}

function yuzdelik(dizi, p) {
  if (!dizi.length) return 0;
  const s = [...dizi].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

console.log(
  SURE > 0
    ? `Lordlar Çağı — yük testi: ${OYUNCU} oyuncu, ${SURE} sn oturum, düşünme ~${DUSUNME} sn\n`
    : `Lordlar Çağı — yük testi: ${OYUNCU} oyuncu, ${TUR} tur, ${ESZAMAN} eşzamanlı\n`,
);

// --- Kayıt ---
const damga = Date.now();
console.log('Oyuncular kaydediliyor...');
const baslangic = performance.now();
async function kaydol(i) {
  // 429 sunucunun hatası değil, kasten konmuş bir sınır. Beklenip yeniden
  // denenir; beş denemede olmuyorsa gerçekten bir sorun var.
  for (let deneme = 0; deneme < 5; deneme++) {
    // tools/lib/kayit.mjs kullanılmıyor: yeniden deneme, ölçülen gecikmeyi
    // bozar. Yük testinin sayısı ham isteğin sayısı olmalı.
    const v = await istek('POST /auth/register', '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `yuk${damga}_${i}@lordlar.dev`,
        password: 'parola1234',
        lordName: `Yuk${damga.toString(36).slice(-3) + Math.random().toString(36).slice(2, 4)}${i}`,
        // Ülkesi olmayan lord saldıramıyor (docs/27).
        ulke: 'TUR',
      }),
    });
    if (v?.token) {
      return { i, h: { 'Content-Type': 'application/json', Authorization: `Bearer ${v.token}` } };
    }
    if (v?._durum !== 429) return null;
    // Pencere bir dakika: daha kısa beklemek aynı duvara toslamak demek.
    await new Promise((r) => setTimeout(r, 61000));
  }
  return null;
}

const oyuncular = (await havuz([...Array(OYUNCU).keys()], kaydol)).filter(Boolean);

console.log(
  `  ${oyuncular.length}/${OYUNCU} kayıt oldu — ${((performance.now() - baslangic) / 1000).toFixed(1)} sn\n`,
);

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
/** Üstel dağılımlı bekleme: insanların tıklaması düzenli aralıklı değil. */
const dusun = (ortSn) => bekle(-Math.log(1 - Math.random()) * ortSn * 1000);

/** Bir oyuncunun istek kısayolları. */
function oyuncuUclari(o) {
  const g = (yol, uc = yol.replace(/\?.*/, '')) => istek(`GET ${uc}`, yol, { headers: o.h });
  const y = (uc, yol, govde) =>
    istek(`POST ${uc}`, yol, { method: 'POST', headers: o.h, body: JSON.stringify(govde ?? {}) });
  return { g, y };
}

/** Önerilen hedefe eldeki orduyla saldırır; ordu yoksa eksiği eğitir. */
async function saldir(o) {
  const { g, y } = oyuncuUclari(o);
  const oneri = (await g('/map'))?.oneri;
  if (!oneri) return false;
  if (!oneri.kazanir) {
    if (oneri.eksik) {
      await y('/army/train', '/army/train', {
        unitType: oneri.eksik.birim,
        count: oneri.eksik.adet,
      });
    }
    return false;
  }
  const ordu = (await g('/army'))?.home ?? {};
  const gonder = Object.fromEntries(Object.entries(ordu).filter(([, n]) => (n ?? 0) > 0));
  if (Object.keys(gonder).length === 0) return false;
  const r = await y('/march', '/march', {
    toRegionId: oneri.regionId,
    army: gonder,
    generalIds: [],
  });
  return Boolean(r && !r._durum);
}

/*
 * Eylem karışımı: oyuncu çoğunlukla BAKIYOR. Ağırlıklar bir akşamın
 * kabaca dökümü — haritaya ve şehre bakmak, orduyu kontrol, arada bir
 * eğitim, üretim, sohbet ve saldırı.
 */
const EYLEMLER = [
  [14, (o, u) => u.g('/map')],
  [10, (o, u) => u.g('/sehir')],
  [10, (o, u) => u.g('/army')],
  [6, (o, u) => u.g('/marches')],
  [5, (o, u) => u.g('/rankings/fame?page=0')],
  [4, (o, u) => u.g('/generals')],
  [4, (o, u) => u.g('/gunluk')],
  [3, (o, u) => u.g('/ittifak')],
  [3, (o, u) => u.g('/akin')],
  [6, (o, u) => u.g('/sohbet/genel')],
  [2, (o, u) => u.y('/sohbet/genel', '/sohbet/genel', { metin: `Selam, ben ${o.i}. lord.` })],
  [6, (o, u) => u.y('/army/train', '/army/train', { unitType: 'mizrakci', count: 3 })],
  [3, (o, u) => u.y('/items/craft', '/items/craft', { tier: 1, slot: 'silah' })],
  [3, (o) => saldir(o)],
];
const AGIRLIK = EYLEMLER.reduce((t, [a]) => t + a, 0);
function eylemSec() {
  let r = Math.random() * AGIRLIK;
  for (const [a, f] of EYLEMLER) if ((r -= a) < 0) return f;
  return EYLEMLER[0][1];
}

/** Portu dinleyen API süreci (bulunamazsa null): bellek ve CPU için. */
function sunucuSureci() {
  try {
    const port = new URL(API).port || '80';
    const cikti = execFileSync('fuser', ['-n', 'tcp', port], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pid = Number(String(cikti).trim().split(/\s+/)[0]);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}
function surecOrnegi(pid) {
  try {
    const rss = Number(/VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1]);
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
    // utime + stime (13., 14. alan; ')' sonrasından sayınca 11 ve 12).
    return { rssMb: rss / 1024, cpuTik: Number(stat[11]) + Number(stat[12]), an: Date.now() };
  } catch {
    return null;
  }
}

const surec = { pid: SURE > 0 ? sunucuSureci() : null, ornekler: [] };
const nabiz = []; // /health gecikmeleri
const savasSureleri = [];
let savasCozulen = 0;
let dalgadaKalan = 0;

if (SURE > 0) {
  // --- OTURUM: her oyuncu kendi döngüsünde ---
  const bas = Date.now();
  const bitis = bas + (RAMPA + SURE) * 1000;
  let calisiyor = true;

  // Olay döngüsünün nabzı ve sürecin belleği.
  const izleyici = (async () => {
    while (calisiyor) {
      const t = performance.now();
      try {
        await fetch(`${API}/health`);
        nabiz.push(performance.now() - t);
      } catch {
        nabiz.push(10_000);
      }
      if (surec.pid) {
        const o = surecOrnegi(surec.pid);
        if (o) surec.ornekler.push(o);
      }
      await bekle(2000);
    }
  })();

  // İlerleme: her 30 sn'de bir satır.
  const ilerleme = setInterval(() => {
    const toplam = [...olcum.values()].reduce((t, o) => t + o.sureler.length, 0);
    const son = surec.ornekler.at(-1);
    console.log(
      `  ${Math.round((Date.now() - bas) / 1000)} sn — ${toplam} istek, ${toplamHata} hata` +
        (son ? `, API ${son.rssMb.toFixed(0)} MB` : ''),
    );
  }, 30_000);

  console.log(
    `Oturum: ${RAMPA} sn içinde ${oyuncular.length} oyuncu giriyor, ${SURE} sn oynanıyor...`,
  );
  await Promise.all(
    oyuncular.map(async (o) => {
      await bekle(Math.random() * RAMPA * 1000);
      const u = oyuncuUclari(o);
      // İstemcinin kendi yoklamaları — oyuncu hiçbir şeye dokunmasa da gelir.
      const yoklama = async (yol, aralikSn) => {
        await bekle(Math.random() * aralikSn * 1000);
        while (Date.now() < bitis) {
          await u.g(yol);
          await bekle(aralikSn * 1000);
        }
      };
      const eylemler = async () => {
        while (Date.now() < bitis) {
          await dusun(DUSUNME);
          if (Date.now() >= bitis) break;
          await eylemSec()(o, u);
        }
      };
      await u.g('/me'); // uygulamanın açılışı
      await Promise.all([
        yoklama('/me', 30),
        yoklama('/sohbet/genel/son', 30),
        yoklama('/dunya', 60),
        eylemler(),
      ]);
    }),
  );
  clearInterval(ilerleme);

  /*
   * SAVAŞ DALGASI: herkes aynı anda saldırıyor. Eğitim kuyruğu önce
   * bitiriliyor (oturumda eğitilen asker henüz hazır değil), sonra
   * önerilen hedefe yürüyüş, sonra çözüm. Ölçülen, çözümün kendisi.
   */
  console.log('\nSavaş dalgası: her oyuncu aynı anda saldırıyor...');
  asama = 'dalga';
  surec.dalgaBasi = surec.ornekler.length;
  await Promise.all(
    oyuncular.map(async (o) => {
      const { y } = oyuncuUclari(o);
      await y('/test/kuyruklari-bitir', '/test/kuyruklari-bitir');
      const saldirdi = await saldir(o);
      // Saldırmayan da bitiriyor: oturumda yola çıkmış yürüyüşleri var.
      const t = performance.now();
      const r = await y('/test/yuruyusleri-bitir', '/test/yuruyusleri-bitir');
      if (saldirdi) savasSureleri.push(performance.now() - t);
      savasCozulen += r?.cozulen ?? 0;
    }),
  );
  // Çözülmeden kalan saldırı var mı: kayıp ya da takılmış yürüyüş.
  const kalanlar = await havuz(oyuncular, async (o) => {
    const liste = await oyuncuUclari(o).g('/marches');
    return Array.isArray(liste) ? liste.filter((m) => m.kind === 'attack').length : 0;
  });
  dalgadaKalan = kalanlar.reduce((t, n) => t + n, 0);
  asama = '';
  calisiyor = false;
  await izleyici;
} else {
  // --- Oyun döngüsü ---
  for (let tur = 1; tur <= TUR; tur++) {
    const t = performance.now();
    await havuz(oyuncular, async (o) => {
      const g = (yol) => istek(`GET ${yol}`, yol, { headers: o.h });
      const y = (uc, yol, govde) =>
        istek(`POST ${uc}`, yol, {
          method: 'POST',
          headers: o.h,
          body: JSON.stringify(govde ?? {}),
        });

      // Okuma ağırlıklı karışım: oyuncu çoğunlukla bakar.
      await g('/me');
      await g('/map');
      await g('/army');
      if (tur % 2 === 0) await g('/rankings/fame?page=0');
      if (tur % 3 === 0) await g('/generals');

      // Yazma: asıl yük burada.
      await y('/army/train', '/army/train', { unitType: 'mizrakci', count: 5 });
      if (tur % 2 === 1) await y('/items/craft', '/items/craft', { tier: 1, slot: 'silah' });
    });
    console.log(`  Tur ${tur} bitti — ${((performance.now() - t) / 1000).toFixed(1)} sn`);
  }
}

// --- Dünya ataması yük altında da doğru mu ---
// "Hepsi tek dünyada" diye bir iddia bu testte kanıtlanamaz: geliştirme
// veritabanında önceki koşulardan kalan lordlar var ve dünya çoktan dolmuş
// olabilir. Shard'ın dolunca yenisini açması zaten tools/shard-testi.mjs'in
// işi. Burada ölçülebilecek olan şu: yük altında her oyuncu bir dünyaya
// atanmış ve kendi dünyasının sıralamasında kendini görebiliyor.
let siralamadaGorunen = 0;
const dunyaBoylari = new Set();
await havuz(oyuncular.slice(0, 30), async (o) => {
  const s = await istek('GET /rankings/fame', '/rankings/fame?page=0', { headers: o.h });
  if (s?.benim) siralamadaGorunen++;
  if (s?.toplam) dunyaBoylari.add(s.toplam);
});

// --- Rapor ---
console.log('\n' + '='.repeat(74));
console.log('UÇ BAŞINA GECİKME (ms)');
console.log('='.repeat(74));
console.log(
  '  uç'.padEnd(34) +
    'istek'.padStart(7) +
    'p50'.padStart(8) +
    'p95'.padStart(8) +
    'p99'.padStart(8) +
    'max'.padStart(9),
);
let enKotuP95 = 0;
let enKotuUc = '';
const dalgaMi = (uc) => uc.startsWith('dalga');
for (const [uc, o] of [...olcum].sort(
  (a, b) =>
    Number(dalgaMi(a[0])) - Number(dalgaMi(b[0])) ||
    yuzdelik(b[1].sureler, 95) - yuzdelik(a[1].sureler, 95),
)) {
  const p95 = yuzdelik(o.sureler, 95);
  // Eşik oyuncunun gördüğü uçlara: dalga ve geliştirme uçları dışarıda.
  if (!dalgaMi(uc) && !uc.includes('/test/') && p95 > enKotuP95) {
    enKotuP95 = p95;
    enKotuUc = uc;
  }
  console.log(
    `  ${uc}`.padEnd(34) +
      String(o.sureler.length).padStart(7) +
      yuzdelik(o.sureler, 50).toFixed(0).padStart(8) +
      p95.toFixed(0).padStart(8) +
      yuzdelik(o.sureler, 99).toFixed(0).padStart(8) +
      Math.max(...o.sureler)
        .toFixed(0)
        .padStart(9),
  );
}

if (SURE > 0) {
  const toplamIstek = [...olcum.values()].reduce((t, o) => t + o.sureler.length, 0);
  console.log('\n' + '='.repeat(74));
  console.log('OTURUM');
  console.log('='.repeat(74));
  console.log(
    `  Debi: ${(toplamIstek / (RAMPA + SURE)).toFixed(1)} istek/sn (${toplamIstek} istek)`,
  );
  console.log(
    `  Olay döngüsü (/health): p50 ${yuzdelik(nabiz, 50).toFixed(0)} ms, ` +
      `p95 ${yuzdelik(nabiz, 95).toFixed(0)} ms, en kötü ${Math.max(0, ...nabiz).toFixed(0)} ms`,
  );
  const ornek = surec.ornekler;
  if (ornek.length >= 2) {
    const ilk = ornek[0];
    const son = ornek.at(-1);
    // Saniyedeki saat tikleri genelde 100 (Linux USER_HZ).
    const cpu = (son.cpuTik - ilk.cpuTik) / 100 / ((son.an - ilk.an) / 1000);
    const tepe = (dilim) => Math.max(0, ...dilim.map((o) => o.rssMb)).toFixed(0);
    const oturum = ornek.slice(0, surec.dalgaBasi ?? ornek.length);
    // Oturumun CPU'su ayrı: dalga kasten aşırı, "kaç çekirdek gerekir"
    // sorusunun cevabı oturumda.
    const oSon = oturum.at(-1) ?? son;
    const oturumCpu = (oSon.cpuTik - ilk.cpuTik) / 100 / Math.max(1, (oSon.an - ilk.an) / 1000);
    console.log(
      `  API süreci (pid ${surec.pid}): bellek ${ilk.rssMb.toFixed(0)} MB başta, oturumda en çok ` +
        `${tepe(oturum)}, dalgada en çok ${tepe(ornek)}, sonda ${son.rssMb.toFixed(0)} MB`,
    );
    console.log(
      `  CPU (tek çekirdek = %100): oturumda ortalama %${(oturumCpu * 100).toFixed(0)}, ` +
        `dalga dahil %${(cpu * 100).toFixed(0)}`,
    );
  } else {
    console.log(
      '  API süreci bulunamadı (fuser yok ya da sunucu başka makinede) — bellek ölçülmedi.',
    );
  }
  console.log(
    `  Savaş dalgası: ${savasSureleri.length} yürüyüş, ${savasCozulen} savaş çözüldü — ` +
      `p50 ${yuzdelik(savasSureleri, 50).toFixed(0)} ms, p95 ${yuzdelik(savasSureleri, 95).toFixed(0)} ms`,
  );
}

console.log('\n' + '='.repeat(74));
let hata = 0;
function kontrol(ad, kosul, detay = '') {
  console.log(`  ${kosul ? '[GEÇTİ]' : '[KALDI]'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!kosul) hata++;
}
kontrol('Tüm oyuncular kayıt oldu', oyuncular.length === OYUNCU, `${oyuncular.length}/${OYUNCU}`);
kontrol('Sunucu hatası (5xx) yok', toplamHata === 0, hataOrnekleri.join(' | '));
if (toplamKisitlama > 0) {
  console.log(
    `  [NOT]   ${toplamKisitlama} istek hız sınırına takıldı, beklenip tekrarlandı.` +
      ' AUTH_RATE_LIMIT_MAX=1000 ile başlatırsan test hızlanır.',
  );
}
kontrol(
  'Her oyuncu kendi dünyasının sıralamasında görünüyor',
  siralamadaGorunen === 30,
  `30 örnekten ${siralamadaGorunen}'i · dünya boyu ${[...dunyaBoylari].join('/')}`,
);
// 1 sn: oyuncunun "takıldı" demeye başladığı eşik. Bu bir mobil oyun, anlık
// tepki beklentisi yok, ama saniyeyi aşan p95 kabul edilemez.
kontrol(
  'En yavaş ucun p95 değeri 1 sn altında',
  enKotuP95 < 1000,
  `${enKotuUc} ${enKotuP95.toFixed(0)} ms`,
);
if (SURE > 0) {
  // Hiçbir iş yapmayan bir uç 250 ms'yi aşıyorsa olay döngüsü bir hesapla
  // kilitleniyor demektir: o an GELEN HER istek bekliyor.
  const nabizP95 = yuzdelik(nabiz, 95);
  kontrol(
    'Olay döngüsü tıkanmıyor (/health p95 < 250 ms)',
    nabizP95 < 250,
    `${nabizP95.toFixed(0)} ms`,
  );
  kontrol(
    'Savaş dalgası: her saldırı çözüldü, yolda kalan yok',
    savasSureleri.length > 0 && savasCozulen > 0 && dalgadaKalan === 0,
    `${savasCozulen}/${savasSureleri.length} çözüldü, ${dalgadaKalan} kaldı`,
  );
  /*
   * Dalganın gecikmesi bir EMNİYET sınırıyla ölçülüyor, oyuncu eşiğiyle
   * değil: 500 oyuncu AYNI SANİYEDE eğitimi bitirip haritayı açıp saldırıyor
   * ve aynı köye düşen onlarca savaş bilerek sıraya giriyor (bölge kilidi,
   * services/march.ts). Ölçülen değerler docs/05 §8'de: 4 çekirdekte p95
   * ~8 sn, 2 çekirdekte ~11 sn. 30 sn test ucunun yürüyüş başına bekleme
   * payı; onu aşmak sıranın değil bir tıkanmanın işaretidir.
   */
  const savasP95 = yuzdelik(savasSureleri, 95);
  kontrol(
    'Savaş dalgası tıkanmıyor (p95 30 sn altında)',
    savasP95 < 30_000,
    `${savasP95.toFixed(0)} ms`,
  );
}

console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
