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

/** Metin OLMADIĞI kesin olanlar: sınıf adları, yollar, renkler, anahtarlar. */
const KOD_KOKUSU = [
  /<(path|svg|g|circle|rect)\b|\bd="M[\d.-]/, // SVG geometrisi (ikon-verisi.ts)
  /\b(linear-gradient|radial-gradient|color-mix|calc|translate|cubic-bezier)\(/, // CSS değeri
  /^[a-z0-9]+([-:/][a-z0-9[\]().,%#-]+)+$/i, // tailwind: "text-[12px]", "hover:bg-panel"
  /^(var\(|#[0-9a-f]{3,8}$|rgba?\()/i, // renk
  /^[./]|^https?:|^mailto:/, // yol ve adres
  /^[a-z][a-zA-Z0-9]*$/, // camelCase tek sözcük -> anahtar
  /^[a-z0-9]+(_[a-z0-9]+)+$/, // snake_case -> anahtar
  /^[A-Z0-9_]+$/, // SABIT_ADI
  /^\s*$/,
];

/** Sınıf/biçim taşıdığı için içeriği hiç okunmayan JSX nitelikleri. */
const ATLANAN_NITELIK = new Set([
  'className',
  'class',
  'style',
  'key',
  'src',
  'href',
  'id',
  'type',
  'role',
  'htmlFor',
  'name',
  'value',
  'renk',
  'vurgu',
  'tur',
  'anahtar',
  'data-rehber',
  'data-harita-tuval',
  'data-bolge',
  'data-akin-harita',
  'viewBox',
  'fill',
  'stroke',
  'd',
  'preserveAspectRatio',
  'strokeLinecap',
  'xmlns',
]);

/** Okunması GEREKEN nitelikler — geri kalanı da okunuyor, bu liste belge. */
const METIN_NITELIGI = new Set([
  'baslik',
  'altyazi',
  'mesaj',
  'etiket',
  'aria-label',
  'title',
  'placeholder',
  'alt',
  'ad',
  'ozet',
  'aciklama',
  'kaybetBaslik',
  'kazanBaslik',
  'bos',
  'ipucu',
]);

/**
 * Boşlukla ayrılmış her parçası CSS belirteci mi.
 *
 * `'bg-yuzey text-parsomen border-kenar'` bir değişkene atanmış sınıf
 * listesi, yani biçim; `className` niteliğinde olmadığı için nitelik
 * denetimine takılmıyor ve boşluk taşıdığı için "cümle" sanılıyordu.
 */
function bicimListesiMi(s) {
  const parcalar = s.trim().split(/\s+/);
  return parcalar.length > 1 && parcalar.every((p) => /^[a-z0-9]+[-:/[][\S]*$/i.test(p));
}

/** Ekrana çizildiği kesin olanın tek şartı: içinde harf olsun, biçim olmasın. */
function metinKirintisi(s, jsx = false) {
  if (!s || !/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(s)) return false;
  if (bicimListesiMi(s)) return false;
  // `jsx` kipinde yol denetimi YOK: JSX gövdesi hiçbir zaman bir yol değil
  // ve `{sayi}/10 grup hazır` gibi metinler `/` ile başladığı için
  // eleniyordu.
  return jsx || !/^[./]|^https?:/.test(s);
}

/**
 * Metin mi — ŞEKLE bakan süzgeç. Yalnız bağlamı belirsiz dizgeler için.
 *
 * Tek başına yetmiyor ve yetmemeli: `surlu` ile `kisla` aynı şekilde ama
 * biri harita göstergesinde yazan bir sözcük, öteki bir anahtar. Ayrımı
 * şekil değil KONUM veriyor (bkz. `kesinMetin`).
 */
function metinMi(s) {
  if (s.length < 2) return false;
  if (bicimListesiMi(s)) return false;
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(s)) return false;
  if (KOD_KOKUSU.some((r) => r.test(s))) return false;
  // Boşluk içeren ya da büyük harfle başlayan ya da Türkçe harf taşıyan:
  // "Kapat", "3 bölge alındı", "Şehir" geçiyor; "kisla", "altin" geçmiyor.
  return /\s/.test(s) || /^[A-ZÇĞİÖŞÜ]/.test(s) || /[çğıöşüÇĞİÖŞÜ]/.test(s);
}

/**
 * EKRANA ÇIZILDIĞI kesin olan dizgeler — şekil süzgecinden muaf.
 *
 * Şekil süzgeci tek başına iki şeyi kaçırıyordu ve ikisi de gerçek metin:
 *
 *   `{sahipVar ? 'sahibi ...' : 'sahipsiz'}`  — küçük harfli tek sözcük,
 *   anahtar sanılıp eleniyordu.
 *   `<Rozet>{benim ? 'SALDIRAN' : 'SAVUNAN'}</Rozet>` — BÜYÜK HARF,
 *   sabit adı sanılıp eleniyordu.
 *
 * Her ikisi de JSX'in GÖVDESİNDE duruyor, yani ekrana yazılıyor. Konum
 * bunu kesin söylüyor; şekil asla söyleyemez.
 */
function kesinMetin(node) {
  // Üçlü işleç, parantez ve `??` zinciri içinden yukarı yürü.
  let n = node;
  while (
    n.parent &&
    (ts.isConditionalExpression(n.parent) ||
      ts.isParenthesizedExpression(n.parent) ||
      ts.isBinaryExpression(n.parent))
  )
    n = n.parent;
  const p = n.parent;
  if (!p) return false;
  // JSX gövdesindeki ifade: <span>{...}</span>
  if (ts.isJsxExpression(p) && p.parent && !ts.isJsxAttribute(p.parent)) return true;
  // Metin taşıdığı bilinen nitelik: baslik="...", aria-label={...}
  // Yukarı yürünmüş düğüme bakılıyor: `title={a ? 'x' : 'sahipsiz'}` içinde
  // dizgenin kendi ebeveyni üçlü işleç, nitelik değil.
  const nit = nitelikAdi(n) ?? nitelikAdi(node);
  return Boolean(nit && METIN_NITELIGI.has(nit));
}

/* ── Çıkarma ───────────────────────────────────────────────────────── */

/** Şablon dizgesini `{0}`, `{1}` yer tutuculu tek metne çevirir. */
function sablonMetni(node) {
  let s = node.head.text;
  node.templateSpans.forEach((span, i) => {
    s += `{${i}}` + span.literal.text;
  });
  return s;
}

function nitelikAdi(node) {
  const p = node.parent;
  if (p && ts.isJsxAttribute(p) && p.name) return p.name.getText();
  if (p && ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent))
    return p.parent.name.getText();
  return null;
}

function atlanirMi(node) {
  const p = node.parent;
  if (!p) return false;
  // import/export yolu
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
  // nesne anahtarı: { 'bir-anahtar': ... }
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  // dizi erişimi: obj['anahtar']
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
  const nit = nitelikAdi(node);
  if (nit && ATLANAN_NITELIK.has(nit)) return true;
  return false;
}

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
    sozluk[k] = { grup, tr: metin, en: '', nerede: [...konumlar].sort() };
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
  csv.push([k, v.grup, kacir(v.tr), '""', kacir(v.nerede.join(' | '))].join(','));
}
writeFileSync(join(CIKTI, 'metinler.csv'), csv.join('\n') + '\n');

for (const [g, n] of Object.entries(sayim))
  console.log(`${g.padEnd(8)} ${String(n).padStart(5)}  ${GRUP_ADI[g]}`);
console.log(`${'TOPLAM'.padEnd(8)} ${String(toplam).padStart(5)}`);
console.log(`\nceviri/metinler.json ve ceviri/metinler.csv yazıldı.`);
