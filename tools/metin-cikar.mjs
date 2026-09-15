/**
 * OYUN METİNLERİ — çeviri için tek dosyaya çıkarır.
 *
 * ── Neden AST, neden regex değil ─────────────────────────────────────
 *
 * Oyunun metni beş ayrı yerde duruyor ve dördü kod: JSX gövdesi, dizge
 * sabitleri, şablon dizgeleri, hata mesajları. Regex ile taramak iki
 * yönden de yanılıyor — `className="text-solgun"` metin sanılıyor,
 * `{`${n} bölge`}` ise hiç görülmüyor. TypeScript'in kendi çözümleyicisi
 * depoda zaten var (tsc onunla koşuyor); metni ondan sormak hem kesin
 * hem de kodun biçimi değişince bozulmuyor.
 *
 * ── Anahtar neden metnin kendisinden türüyor ─────────────────────────
 *
 * `dosya:satır` anahtarı ilk düzenlemede kayıyor: bir satır eklersin,
 * bütün çeviriler bir aşağı kayar. Anahtar metnin FNV-1a özeti: aynı
 * metin nerede geçerse geçsin tek satır oluyor (çevirmen "Kapat"ı bir kez
 * çeviriyor) ve kod taşınınca anahtar değişmiyor. Türkçe metin
 * değiştiğinde anahtar da değişiyor — bu kusur değil, doğru davranış:
 * değişen cümlenin çevirisi de yenilenmeli.
 *
 * ── Değişkenler yer tutucuya dönüyor ─────────────────────────────────
 *
 * `${sayi} bölge` metni çeviriye `{0} bölge` olarak giriyor. Çevirmene
 * ham kod göstermek, çevirinin içine kod yazmasını istemek demek.
 *
 * Kullanım:
 *   node tools/metin-cikar.mjs              # ceviri/ altına yazar
 *   node tools/metin-cikar.mjs --denetle    # yalnız sayar, dosya yazmaz
 */
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const KOK = fileURLToPath(new URL('..', import.meta.url));
const CIKTI = join(KOK, 'ceviri');

/* ── Hangi dosyalar ────────────────────────────────────────────────── */
const KAYNAKLAR = [
  { grup: 'arayuz', kok: 'apps/web/src', uzanti: ['.tsx', '.ts'] },
  { grup: 'motor', kok: 'packages/shared/src', uzanti: ['.ts'] },
  { grup: 'sunucu', kok: 'apps/api/src', uzanti: ['.ts'] },
];

/**
 * Oyuncunun HİÇ görmediği dosyalar.
 *
 * Sunucu günlüğü ("Veritabanı 3 denemede hazır oldu"), izleme kancaları ve
 * tohumlama çıktısı geliştirici metni. Çeviri listesine girerlerse çevirmen
 * hiç görünmeyecek 40 satırı çevirir ve asıl metin aralarında kaybolur.
 */
const OPERASYON = [
  'apps/api/src/index.ts',
  'apps/api/src/izleme.ts',
  'apps/api/src/env.ts',
  'apps/api/src/db.ts',
  'apps/api/src/seed.ts',
  'apps/api/src/worker.ts',
  'apps/api/src/push-anahtari.ts',
  'apps/api/src/dunya-temizle.ts',
  'apps/api/src/yonetici.ts',
  /*
   * Denge doğrulayıcısı. Mesajları ("world-map.json: harita kopuk",
   * "Taht Kalesi tam 1 olmalı") yalnız `pnpm balance` koşan GELİŞTİRİCİYE
   * çıkıyor ve ancak veri dosyaları bozuksa. Oyuncu bunları hiçbir
   * koşulda görmüyor; çeviri listesinde on yedi satır yer kaplıyorlardı.
   */
  'packages/shared/src/balance.ts',
  /*
   * Demo lordların adları ("Sungur Bey", "Aybüke Hatun") ve test
   * dağıtımı çıktısı. Adlar ÖZEL AD — bölge adları gibi hiçbir dilde
   * değişmiyor; dosyanın geri kalanı zaten geliştirici metni.
   */
  'apps/api/src/services/demoWorld.ts',
  /*
   * Geliştirme rotaları. `index.ts` bunları yalnız NODE_ENV !== 'production'
   * iken bağlıyor — üretimde kayıtlı bile değiller. Hata metinleri
   * ("key gerekli.") testlere ve geliştiriciye çıkıyor.
   */
  'apps/api/src/routes/dev.ts',
];

function dosyalar(kok, uzantilar) {
  const sonuc = [];
  (function gez(d) {
    for (const ad of readdirSync(d)) {
      const yol = join(d, ad);
      if (statSync(yol).isDirectory()) gez(yol);
      else if (
        uzantilar.some((u) => ad.endsWith(u)) &&
        !ad.includes('.test.') &&
        !OPERASYON.includes(relative(KOK, yol))
      )
        sonuc.push(yol);
    }
  })(join(KOK, kok));
  return sonuc.sort();
}

/* ── Metin mi, kod mu ──────────────────────────────────────────────── */
import {
  ATLANAN_NITELIK,
  ATLANAN_OZELLIK,
  KOD_KOKUSU,
  METIN_NITELIGI,
  OGEYE_OZGU_ATLANAN,
  atlanirMi,
  bicimListesiMi,
  kapsayanNitelik,
  kesinMetin,
  metinKirintisi,
  metinMi,
  nitelikAdi,
  ogeAdi,
  sablonMetni,
} from './lib/metin-kurallari.mjs';

function dosyayiTara(yol, ekle) {
  const kaynak = readFileSync(yol, 'utf8');
  /*
   * BİÇİM UZANTIYA GÖRE. `.ts` dosyasını TSX olarak ayrıştırmak,
   * `post<{ id: string; ad: string }>(...)` gibi jenerikleri JSX sanmak
   * demek: `<{ ... }>` bir etiket olarak okunuyor ve içindeki KOD, JSX
   * gövdesi diye metin listesine giriyordu. `client.ts` çıktının en
   * gürültülü dosyasıydı, sebebi buydu.
   */
  const bicim = yol.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(yol, kaynak, ts.ScriptTarget.Latest, true, bicim);
  const kisa = relative(KOK, yol);

  const satir = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  (function gez(node) {
    if (ts.isJsxText(node)) {
      // JSX gövdesi: satır sonları ve girinti metnin parçası değil.
      // JSX gövdesi tanımı gereği ekrana çiziliyor; `surlu` gibi küçük
      // harfli tek sözcükleri şekil süzgecine sokmak onları anahtar sanıp
      // elemek demekti.
      const t = node.text.replace(/\s+/g, ' ').trim();
      if (metinKirintisi(t, true)) ekle(t, `${kisa}:${satir(node)}`);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const t = node.text;
      if (!atlanirMi(node) && (kesinMetin(node) ? metinKirintisi(t) : metinMi(t)))
        ekle(t, `${kisa}:${satir(node)}`);
    } else if (ts.isTemplateExpression(node)) {
      // Nitelik denetimi ŞABLONA da uygulanıyor: `className={`baslik ${x}`}`
      // metin değil biçim; dizge sabitinde eleniyordu, şablonda elenmiyordu.
      const t = sablonMetni(node);
      const ic = t.replace(/\{\d+\}/g, '').trim();
      if (!atlanirMi(node) && (kesinMetin(node) ? metinKirintisi(ic) : metinMi(ic)))
        ekle(t, `${kisa}:${satir(node)}`);
      // Şablonun içindeki ifadeler ayrıca geziliyor (iç içe dizgeler için).
      node.templateSpans.forEach((s) => gez(s.expression));
      return;
    }
    ts.forEachChild(node, gez);
  })(sf);
}

/* ── data/*.json: oyuncunun gördüğü alanlar ────────────────────────── */

/**
 * İçeriği oyuncuya gösterilen alan adları.
 *
 * Liste TAHMİNLE değil taramayla kuruldu: `data/*.json` içindeki Türkçe
 * metin taşıyan bütün alan adları sayılıp tek tek karara bağlandı. İlk
 * hâli tahminle yazılmıştı ve üç alanı kaçırıyordu — `dusman` (akın
 * diyarının düşman adı), `birim` ("10 saldırı" içindeki sözcük) ve
 * `taht_unvani` ("Diyarın Lordu").
 *
 * Bilerek DIŞARIDA: `formul`, `xp_formulu`, `xp_kaynagi`, `seviye_etkisi`
 * — `generals.json` içindeki geliştirici notları. `_` ile başlamadıkları
 * için otomatik elenmiyorlar; oyuncu onları hiç görmüyor.
 */
const VERI_ALANI = new Set([
  'ad',
  'name',
  'ozet',
  'aciklama',
  'etki_metni',
  'metin',
  'baslik',
  'altyazi',
  'unvan',
  'taht_unvani',
  'dusman',
  'birim',
  'sart_metni',
  'odul_metni',
  'ipucu',
  'kisa',
]);

function jsonTara(yol, ekle) {
  const kisa = relative(KOK, yol);
  const veri = JSON.parse(readFileSync(yol, 'utf8'));
  (function gez(dugum, iz) {
    if (Array.isArray(dugum)) return dugum.forEach((d, i) => gez(d, `${iz}[${i}]`));
    if (dugum && typeof dugum === 'object') {
      for (const [k, v] of Object.entries(dugum)) {
        if (k.startsWith('_')) continue; // geliştirici notu, oyuncu görmüyor
        if (typeof v === 'string' && VERI_ALANI.has(k)) {
          if (metinMi(v)) ekle(v, `${kisa}:${iz ? iz + '.' : ''}${k}`);
        } else gez(v, iz ? `${iz}.${k}` : k);
      }
    }
  })(veri, '');
}

/* ── Anahtar: metnin FNV-1a özeti ──────────────────────────────────── */
function anahtar(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 't' + h.toString(16).padStart(8, '0');
}

/* ── Topla ─────────────────────────────────────────────────────────── */
const gruplar = new Map(); // grup -> Map(metin -> Set(konum))
const ekleyici = (grup) => {
  if (!gruplar.has(grup)) gruplar.set(grup, new Map());
  const m = gruplar.get(grup);
  return (metin, konum) => {
    if (!m.has(metin)) m.set(metin, new Set());
    m.get(metin).add(konum);
  };
};

for (const { grup, kok, uzanti } of KAYNAKLAR) {
  const ekle = ekleyici(grup);
  for (const yol of dosyalar(kok, uzanti)) dosyayiTara(yol, ekle);
}

/*
 * balance.json DIŞARIDA: sayı ayarları dosyası ve içindeki `aciklama`
 * alanları oyuncuya değil bize yazılmış ("Sahipsiz bolgelerin NPC
 * garnizonu ... saatte tabana dogru toparlanir"). Oyuncunun gördüğü her
 * metin öteki dosyalarda.
 */
const VERI_DOSYALARI = readdirSync(join(KOK, 'data'))
  .filter((f) => f.endsWith('.json') && f !== 'balance.json')
  .sort();
for (const f of VERI_DOSYALARI) {
  const grup = f === 'world-map.json' ? 'harita' : 'veri';
  jsonTara(join(KOK, 'data', f), ekleyici(grup));
}

/* ── Yaz ───────────────────────────────────────────────────────────── */
const GRUP_ADI = {
  arayuz: 'Arayüz — ekranlar, kartlar, düğmeler',
  motor: 'Motor — birim/bölge adları, rütbeler, ipuçları',
  sunucu: 'Sunucu — hata mesajları, bildirimler, e-postalar',
  veri: 'Veri — binalar, generaller, araştırma, başarımlar, akınlar',
  harita: 'Harita — bölge ve vilayet adları',
};

let toplam = 0;
/**
 * Var olan çeviriler — yeniden çıkarım onları silmesin diye.
 *
 * Anahtar, METNİN KENDİSİNDEN türeyen bir özet. Yani aynı anahtar aynı
 * Türkçe demek ve o Türkçenin çevirisi hâlâ geçerli. Türkçe değişirse
 * anahtar da değişiyor ve çeviri kendiliğinden düşüyor — istenen de bu:
 * değişmiş bir cümlenin eski çevirisi yanlış çeviridir.
 */
const oncekiCeviri = new Map();
try {
  const eskisi = JSON.parse(readFileSync(join(CIKTI, 'metinler.json'), 'utf8'));
  for (const [k, v] of Object.entries(eskisi)) if (v.en) oncekiCeviri.set(k, v.en);
} catch {
  // İlk koşuş: dosya yok. Sorun değil.
}

const sozluk = {};
for (const grup of ['arayuz', 'motor', 'sunucu', 'veri', 'harita']) {
  const m = gruplar.get(grup);
  if (!m) continue;
  for (const [metin, konumlar] of [...m].sort((a, b) => a[0].localeCompare(b[0], 'tr'))) {
    const k = anahtar(metin);
    if (sozluk[k]) {
      // Aynı metin başka grupta da geçiyor: konumları birleştir.
      sozluk[k].nerede = [...new Set([...sozluk[k].nerede, ...konumlar])].sort();
      continue;
    }
    // Var olan çeviri KORUNUYOR. Bu satır bir kez `en: ''` yazıyordu ve
    // araç her koşuşunda bütün çevirileri sessizce siliyordu: oyun metni
    // değişti diye çıkarımı yeniden koşmak, o güne kadar yapılmış her
    // çeviriyi çöpe atmak demekti. Anahtar içerik özetinden türüyor, yani
    // aynı anahtar aynı Türkçe demek — çeviri hâlâ geçerli.
    sozluk[k] = { grup, tr: metin, en: oncekiCeviri.get(k) ?? '', nerede: [...konumlar].sort() };
    toplam++;
  }
}

const sayim = {};
for (const v of Object.values(sozluk)) sayim[v.grup] = (sayim[v.grup] ?? 0) + 1;

if (process.argv.includes('--denetle')) {
  for (const [g, n] of Object.entries(sayim)) console.log(`${g.padEnd(8)} ${n}`);
  console.log(`TOPLAM   ${toplam}`);
  process.exit(0);
}

mkdirSync(CIKTI, { recursive: true });
writeFileSync(join(CIKTI, 'metinler.json'), JSON.stringify(sozluk, null, 2) + '\n');

// CSV: çevirmen elektronik tabloda çalışmak isterse.
const kacir = (s) => `"${String(s).replace(/"/g, '""')}"`;
const csv = ['anahtar,grup,turkce,ingilizce,nerede'];
for (const [k, v] of Object.entries(sozluk)) {
  csv.push([k, v.grup, kacir(v.tr), kacir(v.en), kacir(v.nerede.join(' | '))].join(','));
}
writeFileSync(join(CIKTI, 'metinler.csv'), csv.join('\n') + '\n');

for (const [g, n] of Object.entries(sayim))
  console.log(`${g.padEnd(8)} ${String(n).padStart(5)}  ${GRUP_ADI[g]}`);
console.log(`${'TOPLAM'.padEnd(8)} ${String(toplam).padStart(5)}`);
console.log(`\nceviri/metinler.json ve ceviri/metinler.csv yazıldı.`);

/*
 * Çeviri sayısını HER KOŞUŞTA yaz.
 *
 * Bu araç bir kez bütün çevirileri sessizce silmişti ve fark edilmesi
 * iki teslim sürdü: çıktı yalnız metin sayılarını yazıyordu, çeviri
 * sayısını değil. Sessiz veri kaybı, gürültülü bir hatadan çok daha
 * pahalı. Artık sayı her seferinde görünüyor ve azalırsa uyarı çıkıyor.
 */
const korunan = Object.values(sozluk).filter((v) => v.en).length;
const kaybolan = oncekiCeviri.size - korunan;
console.log(`Çeviri: ${korunan} korundu${kaybolan > 0 ? `, ${kaybolan} DÜŞTÜ` : ''}.`);
if (kaybolan > 0) {
  console.log(
    'Düşenler, Türkçesi değişmiş metinlerdir: anahtar içerikten türüyor,\n' +
      'cümle değişince eski çeviri de geçersiz oluyor. Beklemiyorsan\n' +
      'ceviri/metinler.json dosyasını sürüm geçmişinden kontrol et.',
  );
}
