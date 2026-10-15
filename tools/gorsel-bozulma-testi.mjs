/**
 * Görsel bozulma testi — GPU yolu, piksel piksel (docs/24 "Görsel bozulma
 * testi").
 *
 * Birim testindeki parmak izi (`apps/web/src/cizim/parmakizi.test.ts`)
 * MODELİ denetliyor: parça kayboldu mu, renk değişti mi. Bu araç RESMİ
 * denetliyor: GPU çizicisi (ışık, gölge haritası, kenar çizgisi, odak
 * bulanıklığı) aynı resmi mi çıkarıyor. `glCizici.ts`te bir gölge yanlılığı
 * ya da kenar kalınlığı değişince modelin izi aynı kalıyor ama resim
 * değişiyor; onu yalnız bu görür.
 *
 * Galeriden seçilmiş bir avuç çizim, boş bir tarayıcı profilinde (kalıcı
 * kayıt yok, her şey yeniden çiziliyor) yazılım GPU'suyla çiziliyor ve
 * `tools/fiksturler/gorsel/` altındaki kayıtlı resimlerle karşılaştırılıyor.
 * Pay: kanal farkı 12'yi aşan piksellerin oranı %0,5'i geçmesin (yazılım
 * GPU'sunun sürümden sürüme oynayan son bitleri kalmasın diye).
 *
 * Kayıtlı resimler BU KABIN tarayıcısıyla çıkarıldı. CI'nın tarayıcısı
 * başka bir sürüm olabildiği için araç CI zincirinde değil; çizici
 * değiştiğinde elle koşuluyor.
 *
 *   node tools/gorsel-bozulma-testi.mjs           karşılaştır
 *   node tools/gorsel-bozulma-testi.mjs --yaz     kayıtlı resimleri yenile
 *
 * Arayüz (5173) ayakta olmalı; API gerekmiyor.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tarayiciAc } from './lib/tarayici.mjs';

// sharp API paketinin bağımlılığı; kök node_modules'ta yok.
const sharp = createRequire(new URL('../apps/api/package.json', import.meta.url))('sharp');

const WEB = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const KAYIT = new URL('./fiksturler/gorsel/', import.meta.url);
const CIKTI = process.env.CIKTI ?? 'ekran-goruntuleri';
const YAZ = process.argv.includes('--yaz');

/** Denetlenen çizimler: her ailenin bir temsilcisi (galeri bölümü/adı). */
const HEDEFLER = [
  'Binalar/kisla_5',
  'Birlikler/suvari',
  'Ekipman/zirh_t5',
  'Kuşam/giy-340254',
  'Bölgeler/koy_3',
  'Bölge varyantları/koy_3_b',
  'Ekran zeminleri/demirhane',
];
/** Kanal farkı bundan büyükse piksel "farklı". */
const ESIK = 12;
/** Farklı piksellerin en çok oranı (yüzde). */
const PAY = 0.5;

const dosyaAdi = (h) =>
  h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^A-Za-z0-9_-]+/g, '_') + '.png';

let hata = 0;
const b = await tarayiciAc();
const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(WEB + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.setItem('gl-yazilim', '1'));
await page.goto(WEB + '/#/cizim-galerisi', { waitUntil: 'domcontentloaded' });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-galeri-oge]', { timeout: 30000 });
if (YAZ) mkdirSync(KAYIT, { recursive: true });
mkdirSync(CIKTI, { recursive: true });

console.log(`Görsel bozulma testi — GPU yolu (${YAZ ? 'yazılıyor' : 'karşılaştırılıyor'})\n`);
for (const h of HEDEFLER) {
  const oge = page.locator(`[data-galeri-oge="${h}"]`);
  if (!(await oge.count())) {
    console.log(`  [KALDI] ${h}: galeride yok`);
    hata++;
    continue;
  }
  await oge.scrollIntoViewIfNeeded();
  // Resim GPU'dan gelene ve OTURANA kadar: galeride her çizim önce kaba
  // bir taslakla geliyor (`OnceKaba`), ikisi de `data-gl` taşıyor. Resmin
  // adresi 2,5 sn değişmeyince son hâli sayılıyor. Yazılım GPU'su yavaş:
  // büyük sahne 40 sn sürebiliyor.
  const geldi = await page
    .waitForFunction(
      (sec) => {
        const img = document.querySelector(`[data-galeri-oge="${sec}"] svg[data-gl] image`);
        const w = window;
        w.__iz ??= {};
        const adres = img?.getAttribute('href') ?? '';
        const once = w.__iz[sec];
        if (!adres) return false;
        if (!once || once.adres !== adres) {
          w.__iz[sec] = { adres, an: performance.now() };
          return false;
        }
        return performance.now() - once.an > 2500;
      },
      h,
      { timeout: 120_000, polling: 250 },
    )
    .then(() => true)
    .catch(() => false);
  if (!geldi) {
    console.log(`  [KALDI] ${h}: GPU resmi gelmedi`);
    hata++;
    continue;
  }
  const kutu = oge.locator('> div').first();
  const png = await kutu.screenshot({ animations: 'disabled' });
  const yol = new URL(dosyaAdi(h), KAYIT);
  if (YAZ) {
    writeFileSync(yol, png);
    console.log(`  [YAZILDI] ${h}`);
    continue;
  }
  if (!existsSync(yol)) {
    console.log(`  [KALDI] ${h}: kayıtlı resim yok (--yaz)`);
    hata++;
    continue;
  }
  const [a, c] = await Promise.all(
    [yol, png].map((x) =>
      sharp(x instanceof URL ? fileURLToPath(x) : x)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ),
  );
  if (a.info.width !== c.info.width || a.info.height !== c.info.height) {
    console.log(
      `  [KALDI] ${h}: boyut ${a.info.width}×${a.info.height} → ${c.info.width}×${c.info.height}`,
    );
    hata++;
    continue;
  }
  let farkli = 0;
  const fark = Buffer.alloc(a.data.length);
  for (let i = 0; i < a.data.length; i += 4) {
    const d = Math.max(
      Math.abs(a.data[i] - c.data[i]),
      Math.abs(a.data[i + 1] - c.data[i + 1]),
      Math.abs(a.data[i + 2] - c.data[i + 2]),
    );
    const f = d > ESIK;
    if (f) farkli++;
    fark[i] = f ? 255 : c.data[i] >> 2;
    fark[i + 1] = f ? 0 : c.data[i + 1] >> 2;
    fark[i + 2] = f ? 0 : c.data[i + 2] >> 2;
    fark[i + 3] = 255;
  }
  const oran = (farkli / (a.data.length / 4)) * 100;
  const gecti = oran <= PAY;
  console.log(`  [${gecti ? 'GEÇTİ' : 'KALDI'}] ${h} — %${oran.toFixed(2)} farklı piksel`);
  if (!gecti) {
    hata++;
    // Fark resmi: kırmızı farklı piksel, gerisi karartılmış yeni resim.
    await sharp(fark, { raw: { width: c.info.width, height: c.info.height, channels: 4 } })
      .png()
      .toFile(`${CIKTI}/bozulma-${dosyaAdi(h)}`);
  }
}
await b.close();
console.log(hata === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${hata} KONTROL KALDI`);
process.exit(hata === 0 ? 0 : 1);
