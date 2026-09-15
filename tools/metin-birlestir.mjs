/**
 * CÜMLEYİ TEK PARÇAYA İNDİRİR — `'A ' + 'B'` yerine `'A B'`.
 *
 * ── Neden gerekli ───────────────────────────────────────────────────
 *
 * Kodda cümleler satır genişliği için `+` ile bölünmüştü:
 *
 *     metin:
 *       'Akın toprak vermez, toprak da almaz. Kaybetsen bile bölgen ' +
 *       'elinde kalır — ordunu denemenin en ucuz yeri burası.',
 *
 * Bu, ÇALIŞMA ZAMANINDA tek bir cümle ama KAYNAKTA iki dizge. Çeviri
 * çıkarıcısı iki satır görüyor ve çevirmene iki yarım cümle veriyor.
 * Yarım cümle çevrilemez: hangisinin nereye bağlandığı belli değil ve
 * İngilizcede sözcük sırası değişince parça yanlış yere düşer.
 *
 * Bu yüzden 281 satır çeviri listesinin DIŞINDA bırakılmıştı ve
 * ekranda Türkçe kalıyordu. Çözümü çeviri değil KOD: bölünmüş cümleyi
 * geri birleştirmek.
 *
 * ── Ne yapıyor ──────────────────────────────────────────────────────
 *
 * Yalnız HER PARÇASI sabit metin olan `+` zincirlerini birleştiriyor.
 * Bir parçası değişkense zincire dokunulmuyor — `'Sayı: ' + n` bir
 * cümle değil, bir hesap.
 *
 * Şablon karışmışsa sonuç da şablon oluyor:
 *   `%${x} artırır ` + '(en çok).'   ->   `%${x} artırır (en çok).`
 *
 * ÇALIŞMA ZAMANI DEĞERİ DEĞİŞMİYOR. Birleştirme, derleyicinin zaten
 * yaptığı şeyi kaynağa yazmaktan ibaret.
 *
 *   node tools/metin-birlestir.mjs           # kuru koşu
 *   node tools/metin-birlestir.mjs --uygula
 */
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const KOK = fileURLToPath(new URL('..', import.meta.url));
const uygula = process.argv.includes('--uygula');
const KAYNAKLAR = ['apps/web/src', 'packages/shared/src', 'apps/api/src'];

function* dosyalar(kok) {
  for (const ad of readdirSync(kok)) {
    const y = join(kok, ad);
    if (statSync(y).isDirectory()) yield* dosyalar(y);
    else if (/\.(ts|tsx)$/.test(ad) && !ad.includes('.test.')) yield y;
  }
}

const metinMi = (n) =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n);

/** `+` ile bağlı ve her yaprağı sabit metin olan zincir mi. */
function zincirMi(n) {
  if (metinMi(n)) return true;
  return (
    ts.isBinaryExpression(n) &&
    n.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    zincirMi(n.left) &&
    zincirMi(n.right)
  );
}

function yapraklar(n, cikti = []) {
  if (ts.isBinaryExpression(n)) {
    yapraklar(n.left, cikti);
    yapraklar(n.right, cikti);
  } else cikti.push(n);
  return cikti;
}

/** Düz metni ŞABLON içine güvenle koyar. */
const sablonaKacir = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/** Şablonun iki ters tırnağı arasındaki HAM kaynak — kaçışlar korunur. */
const sablonIcerigi = (n, sf) => n.getText(sf).slice(1, -1);

function birlestir(zincir, sf) {
  const parcalar = yapraklar(zincir);
  const sablonVar = parcalar.some((p) => ts.isTemplateExpression(p));

  if (!sablonVar) {
    /*
     * Hepsi düz metin: değeri doğrudan birleştirip tek dizge yazıyoruz.
     * `JSON.stringify` geçerli bir TS dizgesi üretiyor; tırnak biçimini
     * `pnpm format` projenin kuralına çeviriyor.
     */
    return JSON.stringify(parcalar.map((p) => p.text).join(''));
  }
  const ic = parcalar
    .map((p) => (ts.isTemplateExpression(p) ? sablonIcerigi(p, sf) : sablonaKacir(p.text)))
    .join('');
  return '`' + ic + '`';
}

let dosyaSayisi = 0;
let zincirSayisi = 0;
let parcaSayisi = 0;

for (const kok of KAYNAKLAR) {
  for (const yol of dosyalar(join(KOK, kok))) {
    const kaynak = readFileSync(yol, 'utf8');
    const bicim = yol.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(yol, kaynak, ts.ScriptTarget.Latest, true, bicim);
    const duzenlemeler = [];

    (function gez(n) {
      // Kök düğümün ebeveyni yok; `n.parent` orada undefined.
      const ustZincir =
        n.parent !== undefined &&
        ts.isBinaryExpression(n.parent) &&
        n.parent.operatorToken.kind === ts.SyntaxKind.PlusToken;
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        !ustZincir &&
        zincirMi(n)
      ) {
        const parca = yapraklar(n).length;
        // Tek parçalı "zincir" olmaz; iki ve üstü birleşir.
        if (parca >= 2) {
          duzenlemeler.push({ bas: n.getStart(sf), son: n.getEnd(), yeni: birlestir(n, sf) });
          zincirSayisi++;
          parcaSayisi += parca;
        }
        return;
      }
      ts.forEachChild(n, gez);
    })(sf);

    if (duzenlemeler.length === 0) continue;
    dosyaSayisi++;
    let cikti = kaynak;
    duzenlemeler
      .sort((a, b) => b.bas - a.bas)
      .forEach((d) => {
        cikti = cikti.slice(0, d.bas) + d.yeni + cikti.slice(d.son);
      });

    /*
     * GÜVENLİK AĞI: birleştirilmiş dosya hâlâ ayrıştırılabiliyor mu.
     * Kaçış hatası yapmış olsaydık sessizce bozuk kod yazardık.
     */
    const denetim = ts.createSourceFile(yol, cikti, ts.ScriptTarget.Latest, true, bicim);
    const hatali = denetim.parseDiagnostics?.length ?? 0;
    if (hatali > 0) {
      console.error(`  ATLANDI (ayrıştırılamadı): ${relative(KOK, yol)}`);
      zincirSayisi -= duzenlemeler.length;
      continue;
    }
    if (uygula) writeFileSync(yol, cikti);
    console.log(`  ${relative(KOK, yol).padEnd(52)} ${duzenlemeler.length} zincir`);
  }
}

console.log(
  `\n${dosyaSayisi} dosya, ${zincirSayisi} zincir, ${parcaSayisi} parça -> ${zincirSayisi} tam cümle`,
);
if (!uygula) console.log('\nBu bir KURU KOŞU. Yazmak için: --uygula');

/* ================================================================== */
/* JSX çocuklarını tek şablona indirir                                 */
/* ================================================================== */

/**
 * `<Hap>{n} lord</Hap>` -> `<Hap>{`${n} lord`}</Hap>`
 *
 * Neden: JSX'te ifade ile metin yan yana durduğunda çıkarıcı METNİ
 * ayrı bir dizge olarak görüyor ("lord") ve çevirmene bağlamsız bir
 * sözcük veriyor. Üstelik İngilizcede sıra değişebiliyor — "3 lord"
 * bir yerde "3 lords", başka yerde "lords: 3" olabilir ve JSX'teki
 * sabit sıra buna izin vermiyor.
 *
 * Tek şablona indirince cümle bütün oluyor: `{0} lord` çevrilebilir ve
 * çevirmen yer tutucuyu istediği yere koyabiliyor.
 *
 * Kaynağa `t()` YAZMIYORUZ, şablon yazıyoruz: derleme eklentisi
 * şablonları zaten sarıyor (apps/web/vite-ceviri.mjs). Tek iş,
 * parçalanmış cümleyi tek parça hâline getirmek.
 *
 * ── Dokunulmayanlar ────────────────────────────────────────────────
 *
 * İçinde BAŞKA BİR ÖĞE olan çocuk dizisi birleştirilmiyor:
 * `<b>{a}</b> ve <b>{b}</b>` bir dizge değil, üç düğüm. Şablona
 * çevirmek `<b>` etiketlerini metne çevirirdi.
 */
function jsxCocukBirlestir(kaynak, yol) {
  const sf = ts.createSourceFile(yol, kaynak, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const duzenlemeler = [];

  /** İfadenin içinde JSX var mı — varsa metne çevrilemez. */
  const jsxIceriyor = (n) => {
    let var_ = false;
    (function bak(x) {
      if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) var_ = true;
      if (!var_) ts.forEachChild(x, bak);
    })(n);
    return var_;
  };

  (function gez(n) {
    if (ts.isJsxElement(n)) {
      const cocuk = n.children;
      const dolu = cocuk.filter((c) => !(ts.isJsxText(c) && c.text.trim() === ''));
      const hepsiMetinYaDaIfade = dolu.every((c) => ts.isJsxText(c) || ts.isJsxExpression(c));
      const metinli = dolu.some((c) => ts.isJsxText(c) && /\p{L}/u.test(c.text));
      const ifadeli = dolu.some((c) => ts.isJsxExpression(c) && c.expression);
      const guvenli =
        hepsiMetinYaDaIfade &&
        metinli &&
        ifadeli &&
        dolu.every((c) => !ts.isJsxExpression(c) || !c.expression || !jsxIceriyor(c.expression));

      if (guvenli) {
        let ic = '';
        for (const c of cocuk) {
          if (ts.isJsxText(c)) {
            // JSX boşluk kuralı: satır sonu içeren boşluk çizimde yok
            // olur, yalnız boşluktan oluşan tek boşluğa iner.
            const ham = c.text;
            if (ham.trim() === '') {
              ic += ham.includes('\n') ? '' : ' ';
              continue;
            }
            const on = /^\s+/.exec(ham)?.[0] ?? '';
            const son = /\s+$/.exec(ham)?.[0] ?? '';
            ic +=
              (on && !on.includes('\n') ? ' ' : '') +
              sablonaKacir(ham.replace(/\s+/g, ' ').trim()) +
              (son && !son.includes('\n') ? ' ' : '');
          } else if (ts.isJsxExpression(c) && c.expression) {
            ic += '${' + c.expression.getText(sf) + '}';
          }
        }
        const acilis = n.openingElement.getEnd();
        const kapanis = n.closingElement.getStart(sf);
        duzenlemeler.push({ bas: acilis, son: kapanis, yeni: '{`' + ic + '`}' });
        return;
      }
    }
    ts.forEachChild(n, gez);
  })(sf);

  if (duzenlemeler.length === 0) return null;
  let cikti = kaynak;
  duzenlemeler
    .sort((a, b) => b.bas - a.bas)
    .forEach((d) => {
      cikti = cikti.slice(0, d.bas) + d.yeni + cikti.slice(d.son);
    });
  const denetim = ts.createSourceFile(yol, cikti, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if ((denetim.parseDiagnostics?.length ?? 0) > 0) return null;
  return { cikti, sayi: duzenlemeler.length };
}

if (process.argv.includes('--jsx')) {
  let d = 0;
  let s = 0;
  for (const yol of dosyalar(join(KOK, 'apps/web/src'))) {
    if (!yol.endsWith('.tsx')) continue;
    const sonuc = jsxCocukBirlestir(readFileSync(yol, 'utf8'), yol);
    if (!sonuc) continue;
    d++;
    s += sonuc.sayi;
    if (uygula) writeFileSync(yol, sonuc.cikti);
    console.log(`  ${relative(KOK, yol).padEnd(52)} ${sonuc.sayi} öğe`);
  }
  console.log(`\nJSX: ${d} dosya, ${s} öğe tek şablona indi`);
  if (!uygula) console.log('\nBu bir KURU KOŞU. Yazmak için: --uygula');
}
