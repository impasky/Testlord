/**
 * ÇEVİRİ EKLENTİSİ — derlerken metinleri `__t()` ile sarar.
 *
 * ── Neden kaynak koda elle `t(...)` yazmadım ─────────────────────────
 *
 * Oyunda ekrana çizilen bin altı yüz dizge var. Hepsini elle sarmak üç
 * bedel getiriyordu:
 *
 *   1. Bin altı yüz elle düzenleme = bin altı yüz hata fırsatı, ve
 *      çoğu ancak o ekran açıldığında görülür.
 *   2. Kod okunaksızlaşıyor: `<p>{t('Ordun yetiyor.')}</p>` satırı,
 *      `<p>Ordun yetiyor.</p>` satırından gürültülü.
 *   3. Kurallar ayrışıyor: çıkarıcı bir dizgeyi metin sayarken elle
 *      sarılmamış olabilir; sessizce Türkçe kalır.
 *
 * Eklenti üçünü birden çözüyor. Kaynak kod hiç değişmiyor, sarma
 * derleme anında oluyor ve KARARI ÇIKARICININ KENDİ KURALLARI veriyor
 * (`tools/lib/metin-kurallari.mjs` ikisinde de aynı dosya). Çevirmene
 * sorulan her dizge sarılıyor, sorulmayan hiçbiri sarılmıyor —
 * ayrışma yapısal olarak imkânsız.
 *
 * ── Ne yapıyor ──────────────────────────────────────────────────────
 *
 *   <p>Ordun yetiyor.</p>        ->  <p>{__t("Ordun yetiyor.")}</p>
 *   baslik="Şehir"               ->  baslik={__t("Şehir")}
 *   `${n} bölge`                 ->  __t("{0} bölge", n)
 *
 * `__t` çeviri yoksa Türkçeyi döndürüyor, yani eklenti kapalıyken de
 * kapalıyken de oyun aynı çalışıyor — yalnız dil seçimi çalışmıyor.
 */
import ts from 'typescript';
import { metinKabul, metinKirintisi, sablonMetni } from '../../tools/lib/metin-kurallari.mjs';

/** Sarma işlevinin çağrıldığı ad; kaynak kodda geçmiyor, eklenti koyuyor. */
const AD = '__t';
const ICE_AKTAR = `import { t as ${AD} } from '@lordlar/shared';\n`;

/**
 * Sarılmayacak dosyalar.
 *
 * `lib/dil.tsx` çeviri işlevinin KENDİSİ — kendi kendini içe aktarması
 * döngü olurdu. `ceviri/` altı üretilmiş sözlük.
 */
function atlanan(id) {
  return (
    // Çeviri işlevinin KENDİSİ — kendini içe aktarması döngü olurdu.
    id.endsWith('/packages/shared/src/dil.ts') ||
    id.includes('/src/lib/dil.') ||
    id.includes('/src/ceviri/') ||
    id.includes('/node_modules/') ||
    id.includes('.test.')
  );
}

function kacir(s) {
  return JSON.stringify(s);
}

export function ceviriEklentisi() {
  return {
    name: 'lordlar-ceviri',
    enforce: 'pre',
    transform(kod, id) {
      const temiz = id.split('?')[0];
      if (!/\.(tsx|ts)$/.test(temiz) || atlanan(temiz)) return null;
      if (!/[çğıöşüÇĞİÖŞÜ]/.test(kod)) return null; // Türkçe harf yoksa iş yok

      const bicim = temiz.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sf = ts.createSourceFile(temiz, kod, ts.ScriptTarget.Latest, true, bicim);
      /** {bas, son, yeni} — sonra SONDAN BAŞA uygulanıyor ki konumlar kaymasın. */
      const duzenlemeler = [];

      (function gez(node) {
        if (ts.isJsxText(node)) {
          const ham = node.text;
          const metin = ham.replace(/\s+/g, ' ').trim();
          if (metinKirintisi(metin, true)) {
            /*
             * Çevredeki boşluk JSX kurallarına göre korunuyor: satır
             * sonu içeren boşluk çizimde YOK olur, yalnız boşluktan
             * oluşan ise tek boşluğa iner. `<b>x</b> ve <b>y</b>`
             * satırındaki boşlukları yutarsak sözcükler birbirine
             * yapışır.
             */
            const onBosluk = /^\s+/.exec(ham)?.[0] ?? '';
            const sonBosluk = /\s+$/.exec(ham)?.[0] ?? '';
            const bosluk = (b) => (b && !b.includes('\n') ? "{' '}" : '');
            /*
             * `pos`, `getStart()` DEĞİL.
             *
             * `getStart()` önceki boşluğu "trivia" sayıp atlıyor —
             * ama JSX metninde o boşluk metnin KENDİSİ ve ekranda
             * görünüyor. `getStart()` ile değiştirince baştaki boşluk
             * yerinde kalıyor, üstüne bir de kendi koyduğumuz ekleniyor
             * ve `3/9 adım` yazması gereken satır `3/9  adım` oluyordu.
             */
            duzenlemeler.push({
              bas: node.pos,
              son: node.getEnd(),
              yeni: `${bosluk(onBosluk)}{${AD}(${kacir(metin)})}${bosluk(sonBosluk)}`,
            });
          }
        } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          const metin = node.text;
          if (metinKabul(node, metin)) {
            // JSX niteliğinde dizge doğrudan duruyorsa süslü parantez
            // gerekiyor: baslik="X" -> baslik={__t("X")}
            const nitelikte = node.parent && ts.isJsxAttribute(node.parent);
            const cagri = `${AD}(${kacir(metin)})`;
            duzenlemeler.push({
              bas: node.getStart(sf),
              son: node.getEnd(),
              yeni: nitelikte ? `{${cagri}}` : cagri,
            });
          }
        } else if (ts.isTemplateExpression(node)) {
          const kalip = sablonMetni(node);
          if (metinKabul(node, kalip)) {
            const args = node.templateSpans.map((s) => s.expression.getText(sf));
            const nitelikte = node.parent && ts.isJsxAttribute(node.parent);
            const cagri = `${AD}(${[kacir(kalip), ...args].join(', ')})`;
            duzenlemeler.push({
              bas: node.getStart(sf),
              son: node.getEnd(),
              yeni: nitelikte ? `{${cagri}}` : cagri,
            });
            // Sarılan şablonun İÇİNE inmiyoruz: ifadeler olduğu gibi
            // argümana taşındı, ikinci kez sarmak onları bozardı.
            return;
          }
          node.templateSpans.forEach((s) => gez(s.expression));
          return;
        }
        ts.forEachChild(node, gez);
      })(sf);

      if (duzenlemeler.length === 0) return null;

      let cikti = kod;
      duzenlemeler
        .sort((a, b) => b.bas - a.bas)
        .forEach((d) => {
          cikti = cikti.slice(0, d.bas) + d.yeni + cikti.slice(d.son);
        });
      return { code: ICE_AKTAR + cikti, map: null };
    },
  };
}
