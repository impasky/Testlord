/**
 * ÇEVİRİ KURALLARI — "bu dizge ekrana çiziliyor mu".
 *
 * İki araç bu soruyu soruyor ve İKİSİ DE AYNI CEVABI VERMEK ZORUNDA:
 *
 *   tools/metin-cikar.mjs   Çevirmenin listesini kuruyor.
 *   apps/web/vite-ceviri.js Aynı dizgeleri derlerken `t()` ile sarıyor.
 *
 * Kurallar iki yerde ayrı ayrı yazılsaydı er ya da geç ayrışırlardı ve
 * ayrışma sessiz olurdu: çevirmene sorulan bir cümle ekranda Türkçe
 * kalır, ya da tersi — hiç sorulmamış bir kod dizgesi çevrilmeye
 * çalışılırdı. Bu yüzden karar TEK dosyada.
 */
import ts from 'typescript';

/** Metin OLMADIĞI kesin olanlar: sınıf adları, yollar, renkler, anahtarlar. */
export const KOD_KOKUSU = [
  /<(path|svg|g|circle|rect)\b|\bd="M[\d.-]/, // SVG geometrisi (ikon-verisi.ts)
  /\b(linear-gradient|radial-gradient|color-mix|calc|translate|cubic-bezier)\(/, // CSS değeri
  /^[a-z0-9]+([-:/][a-z0-9[\]().,%#-]+)+$/i, // tailwind: "text-[12px]", "hover:bg-panel"
  /^(var\(|#[0-9a-f]{3,8}$|rgba?\()/i, // renk
  /^[./]|^https?:|^mailto:/, // yol ve adres
  /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,6}$/i, // çıplak alan adı: game-icons.net
  /*
   * SVG yolu: "M50 4 L94 18 V52 Z".
   *
   * İki şart birden: M'den HEMEN SONRA bir sayı gelmeli VE dizgede
   * yol komutlarıyla sayılardan başka hiçbir şey olmamalı. İlk hâli
   * yalnız "M ile başla, sonra harf gelebilir" diyordu ve `Metropol`
   * ile `Melik`i de eledi — iki gerçek çeviri böyle düştü. Bir süzgeç
   * engellediğinden fazlasını engelliyorsa süzgeç değil hasardır.
   */
  /^[Mm]\s*-?[\d.][MmLlHhVvCcSsQqTtAaZz\d\s.,-]*$/,
  /^\([^)]*:[^)]*\)$/, // CSS medya sorgusu: "(prefers-reduced-motion: reduce)"
  /^[a-z][a-zA-Z0-9]*$/, // camelCase tek sözcük -> anahtar
  /^[a-z0-9]+(_[a-z0-9]+)+$/, // snake_case -> anahtar
  /^[A-Z0-9_]+$/, // SABIT_ADI
  /^\s*$/,
];

/**
 * Değeri AYAR ya da PROTOKOL olan nesne özellikleri.
 *
 * JSX niteliklerinin nesne karşılığı. `Authorization: \`Bearer ${x}\``
 * bir HTTP başlığı, `timeWindow: '1 minute'` bir hız-sınırı ayarı;
 * ikisi de çeviri listesine düşmüştü ve çevrilselerdi biri kimlik
 * doğrulamayı, öteki sınırlamayı bozardı.
 */
export const ATLANAN_OZELLIK = new Set([
  'Authorization',
  'timeWindow',
  'method',
  'rel',
  'href',
  'src',
  'className',
  'contentType',
  'Content-Type',
]);

/** Sınıf/biçim taşıdığı için içeriği hiç okunmayan JSX nitelikleri. */
export const ATLANAN_NITELIK = new Set([
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
  /* `rel="noreferrer noopener"` bir tarayıcı yönergesi. Çeviri
     listesine düşmüştü ve çevrilseydi bağlantı güvenliği bozulurdu. */
  'rel',
  'target',
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
export const METIN_NITELIGI = new Set([
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
export function bicimListesiMi(s) {
  const parcalar = s.trim().split(/\s+/);
  return parcalar.length > 1 && parcalar.every((p) => /^[a-z0-9]+[-:/[][\S]*$/i.test(p));
}

/** Ekrana çizildiği kesin olanın tek şartı: içinde harf olsun, biçim olmasın. */
export function metinKirintisi(s, jsx = false) {
  if (!s || !/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(s)) return false;
  if (bicimListesiMi(s)) return false;
  /*
   * Çıplak alan adı JSX GÖVDESİNDE de eleniyor. `<a>game-icons.net</a>`
   * bir bağlantı etiketi: ekranda görünüyor ama hiçbir dilde
   * değişmiyor. jsx kipi şekil denetimini atladığı için buraya ayrıca
   * yazmak gerekti.
   */
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,6}$/i.test(s.trim())) return false;
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
export function metinMi(s) {
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
export function kesinMetin(node) {
  /*
   * Üçlü işleç, parantez ve `??`/`||`/`&&` zinciri içinden yukarı yürü.
   *
   * KARŞILAŞTIRMADAN YÜRÜNMÜYOR ve sebebi somut bir hataydı: her ikili
   * ifadeden yukarı yürünüyordu, bu yüzden `{m.kind === 'attack' ? …}`
   * içindeki `'attack'` JSX gövdesine kadar tırmanıp METİN sayılıyordu.
   * Çeviri listesine `attack`, `acik`, `akin`, `basvuru` gibi KOD
   * DEĞERLERİ böyle giriyordu — çevrilirlerse oyun bozulurdu.
   *
   * `??`/`||`/`&&` bir DEĞER seçiyor (`ad ?? 'Bilinmiyor'`), `===` ise
   * bir soru soruyor. İlkinin sonucu ekrana çıkabilir, ikincisinin
   * işlenenleri asla.
   */
  const DEGER_ISLECI = new Set([
    ts.SyntaxKind.QuestionQuestionToken,
    ts.SyntaxKind.BarBarToken,
    ts.SyntaxKind.AmpersandAmpersandToken,
  ]);
  let n = node;
  while (
    n.parent &&
    (ts.isConditionalExpression(n.parent) ||
      ts.isParenthesizedExpression(n.parent) ||
      (ts.isBinaryExpression(n.parent) && DEGER_ISLECI.has(n.parent.operatorToken.kind)))
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
export function sablonMetni(node) {
  let s = node.head.text;
  node.templateSpans.forEach((span, i) => {
    s += `{${i}}` + span.literal.text;
  });
  return s;
}

export function nitelikAdi(node) {
  const p = node.parent;
  if (p && ts.isJsxAttribute(p) && p.name) return p.name.getText();
  if (p && ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent))
    return p.parent.name.getText();
  return null;
}

export function atlanirMi(node) {
  const p = node.parent;
  if (!p) return false;
  // import/export yolu
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
  // nesne anahtarı: { 'bir-anahtar': ... }
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  // dizi erişimi: obj['anahtar']
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
  // Karşılaştırma işleneni: `tur === 'acik'`. Bir soru soruluyor, metin
  // gösterilmiyor. Sağdaki dizge bir KOD DEĞERİ; çevrilirse karşılaştırma
  // hiçbir zaman tutmaz ve özellik sessizce ölür.
  if (
    ts.isBinaryExpression(p) &&
    [
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
      // `'PushManager' in window` — tarayıcı yeteneği sorgusu. Soldaki
      // dizge bir API adı; çevrilirse denetim hep başarısız olur ve
      // bildirimler sessizce kapanır.
      ts.SyntaxKind.InKeyword,
    ].includes(p.operatorToken.kind)
  )
    return true;

  // `case 'acik':` — yine kod değeri.
  if (ts.isCaseClause(p)) return true;

  // Ayar ya da protokol taşıyan nesne özelliği: `timeWindow: '1 minute'`.
  if (ts.isPropertyAssignment(p) && p.initializer === node) {
    const ad = p.name.getText().replace(/['"]/g, '');
    if (ATLANAN_OZELLIK.has(ad)) return true;
  }

  // `this.name = 'GameError'` — hata sınıfının kimliği, oyuncuya
  // gösterilen bir metin değil.
  if (
    ts.isBinaryExpression(p) &&
    p.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(p.left) &&
    p.left.name.getText() === 'name'
  )
    return true;

  // Metot çağrısının ALICISI: `'aı'.includes(v)`. Dilbilgisi makinesi
  // (ekler.ts) sesli harf tablolarını böyle tutuyor; bunlar metin değil.
  if (ts.isPropertyAccessExpression(p) && p.expression === node) return true;

  // BÜYÜK_HARFLİ sabitin değeri: `const KALIN = 'aıouâî'`. Projede bu
  // yazım makine sabiti demek; ekrana çıkan metin böyle adlandırılmıyor.
  if (
    ts.isVariableDeclaration(p) &&
    p.initializer === node &&
    ts.isIdentifier(p.name) &&
    /^[A-Z][A-Z0-9_]*$/.test(p.name.text)
  )
    return true;

  // Biçim niteliği — dizgenin KENDİ ebeveyni olmasa da. `className={`a
  // ${x ? 'bas w-full' : ''}`}` içindeki dizgenin ebeveyni üçlü işleç,
  // nitelik değil; sınıf adları çeviri listesine böyle sızıyordu.
  const nit = nitelikAdi(node) ?? kapsayanNitelik(node);
  if (nit && ATLANAN_NITELIK.has(nit)) return true;

  // Öğeye özgü: `<Zemin ad="arastirma">` görsel anahtarı, metin değil.
  const nitelikDugumu = ts.isJsxAttribute(p)
    ? p
    : ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent)
      ? p.parent
      : null;
  if (nitelikDugumu) {
    const oge = ogeAdi(nitelikDugumu);
    if (oge && OGEYE_OZGU_ATLANAN.get(oge)?.has(nitelikDugumu.name.getText())) return true;
  }
  return false;
}

/**
 * Öğeye ÖZGÜ atlanan nitelikler.
 *
 * `ad` genel olarak atlanamaz — `<Kaynak ad="Altın">` gerçek metin. Ama
 * `<Zemin ad="arastirma">` bir GÖRSEL ANAHTARI: hangi zemin resminin
 * yükleneceğini söylüyor. Aynı nitelik adı iki farklı iş yapıyorsa karar
 * öğeye bakılarak verilmeli; listeyi nitelik adıyla budamak "Altın"ı da
 * götürürdü.
 */
export const OGEYE_OZGU_ATLANAN = new Map([
  ['Zemin', new Set(['ad'])],
  ['TamZemin', new Set(['ad'])],
  ['Gorsel', new Set(['ad'])],
]);

/** Niteliğin üstündeki JSX öğesinin etiket adı. */
export function ogeAdi(nitelik) {
  const p = nitelik.parent;
  if (!p || !ts.isJsxAttributes(p)) return null;
  const oge = p.parent;
  if (!oge) return null;
  const etiket = ts.isJsxSelfClosingElement(oge) ? oge.tagName : oge.tagName;
  return etiket ? etiket.getText() : null;
}

/**
 * Düğümü çevreleyen EN YAKIN JSX niteliğinin adı.
 *
 * Bir JSX öğesine girildiğinde duruyor: `title={<b>{'x'}</b>}` içindeki
 * `'x'` başlığın değil, iç öğenin gövdesi.
 */
export function kapsayanNitelik(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isJsxAttribute(n)) return n.name.getText();
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isFunctionLike(n)) return null;
  }
  return null;
}
