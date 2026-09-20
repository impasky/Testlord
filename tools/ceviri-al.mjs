/**
 * ÇEVİRİYİ GERİ AL — numaralı düz dosyadan sözlüğe.
 *
 * `ceviri-liste.mjs`in tersi. Çevirmen dosyayı düz metin olarak
 * doldurup geri veriyor; bu araç numaraları anahtarlara bağlayıp
 * `metinler.json`ın `en` alanlarını dolduruyor.
 *
 *   node tools/ceviri-al.mjs ceviri/1-once-bunlar.txt
 *   node tools/ceviri-al.mjs ceviri/*.txt
 *
 * DENETİM ASIL İŞ. Bir çeviri dosyası elle doldurulur ve elle
 * doldurulan her şey bozulur: numara silinir, yer tutucu kaybolur,
 * satır Türkçe kalır. Bunlar sessizce kabul edilirse oyun yayına
 * yarım çevrilmiş çıkar ve kimse fark etmez. Bu yüzden araç önce
 * denetliyor, sorunları sayıyla söylüyor, ve `--uygula` demeden
 * HİÇBİR ŞEY YAZMIYOR.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KOK = new URL('../ceviri/', import.meta.url);
const uygula = process.argv.includes('--uygula');
const dosyalar = process.argv.slice(2).filter((a) => !a.startsWith('--'));

if (dosyalar.length === 0) {
  console.error('Kullanım: node tools/ceviri-al.mjs <dosya...> [--uygula]');
  process.exit(1);
}

const numaraYolu = new URL('numaralar.json', KOK);
if (!existsSync(numaraYolu)) {
  console.error('ceviri/numaralar.json yok. Önce: node tools/ceviri-liste.mjs');
  process.exit(1);
}
const numaralar = JSON.parse(readFileSync(numaraYolu, 'utf8'));
const sozlukYolu = new URL('metinler.json', KOK);
const sozluk = JSON.parse(readFileSync(sozlukYolu, 'utf8'));

const sorun = [];
const kabul = new Map();
let okunan = 0;

for (const dosya of dosyalar) {
  const metin = readFileSync(dosya, 'utf8');
  /*
   * BAŞLIK BLOĞU ATLANIYOR — `===` ayracına kadar olan her şey.
   *
   * Başlıktaki "nasıl çevrilir" açıklaması ÖRNEK bir satır taşıyor:
   *
   *     12. Ordun yetiyor.        ->   12. Your army is enough.
   *
   * Bu satır biçim olarak gerçek bir çeviri satırından ayırt edilemiyor
   * ve dosyayı olduğu gibi geri veren çevirmen — ki talimat tam olarak
   * bunu söylüyor — 12 numaralı metnin çevirisini "Your army is
   * enough." yapıyordu. Burada yakalandı çünkü 12 numaralı metnin altı
   * yer tutucusu var ve denetim uyuşmazlığı gördü; yer tutucusuz bir
   * metne denk gelseydi SESSİZCE yanlış çeviri yazılacaktı.
   */
  const ayrac = metin.indexOf('\n====');
  const govde = ayrac === -1 ? metin : metin.slice(ayrac + 1);
  const kayma = ayrac === -1 ? 0 : metin.slice(0, ayrac + 1).split('\n').length - 1;
  for (const [n, ham] of govde.split('\n').entries()) {
    const i = n + kayma;
    // Başlık, açıklama ve ayraç satırları atlanıyor: yalnız
    // "123. ..." biçimindekiler çeviri satırı.
    const m = /^\s*(\d+)\s*[.|\t]\s*(.*)$/.exec(ham);
    if (!m) continue;
    okunan++;
    const [, no, kalan] = m;
    const yer = `${dosya}:${i + 1}`;

    /*
     * İki biçim de kabul ediliyor:
     *
     *   142. Your army is enough.                         (yerine yazma)
     *   142. Ordun yetiyor. -> 142. Your army is enough.  (ok biçimi)
     *
     * İkincisi çevirmenin kendiliğinden ürettiği biçim ve aslında daha
     * iyisi: kaynak çevirinin yanında duruyor, gözden geçirmek kolay.
     * Okun sağındaki NUMARA da denetleniyor — tutmuyorsa satır
     * karışmış demektir ve sessizce yanlış metne yazmak, hiç
     * yazmamaktan kötü.
     */
    const ok = /^(.*?)\s*->\s*(\d+)\s*[.|\t]\s*(.+)$/.exec(kalan);
    if (ok && ok[2] !== no) {
      sorun.push(`${yer} — satır ${no} ile başlıyor ama okun sağı ${ok[2]}; satırlar karışmış`);
      continue;
    }
    /*
     * `\n` GERÇEK SATIR SONUNA çevriliyor.
     *
     * Dosya satır tabanlı: bir çeviri birden çok satır süremez. Ama
     * kaynak metinlerin bir kısmında gerçek satır sonu var (parola
     * sıfırlama e-postası gibi). Çevirmen `\n` yazıyor, araç onu
     * yerine koyuyor. Arayüz metninde ters bölü + n dizisi başka
     * hiçbir anlama gelmiyor, o yüzden karışma riski yok.
     */
    const ceviri = (ok ? ok[3] : kalan).replace(/\\n/g, '\n');
    const anahtar = numaralar[no];

    if (!anahtar) {
      sorun.push(`${yer} — ${no} numarası sözlükte yok (numara değiştirilmiş olabilir)`);
      continue;
    }
    const kayit = sozluk[anahtar];
    if (!kayit) {
      sorun.push(`${yer} — ${no} numaralı metin artık oyunda yok, atlandı`);
      continue;
    }
    const t = ceviri.trim();
    if (!t) {
      sorun.push(`${yer} — ${no} boş bırakılmış`);
      continue;
    }

    /*
     * "=" — BİLEREK AYNI KALSIN.
     *
     * Bazı dizgeler hiçbir dilde değişmiyor: özel adlar ("Kara Yusuf"),
     * marka ve alan adları, birim kısaltmaları. Çevirmen bunları Türkçe
     * bırakınca araç "çevrilmemiş" diye reddediyordu ve satır sonsuza
     * kadar kalanlar listesinde kalıyordu. "=" o satırı BİTTİ sayıyor.
     *
     * Denetimlerin ÖNÜNDE duruyor: aşağıdaki yer tutucu denetimi "="
     * işaretini boş bir çeviri sanıp reddediyordu — oysa "=" Türkçeyi
     * olduğu gibi alıyor ve Türkçenin yer tutucuları zaten yerinde.
     */
    if (t === '=' || t === '=' + kayit.tr) {
      kabul.set(anahtar, kayit.tr);
      continue;
    }

    /*
     * ÇOĞUL BİÇİMLERİ: `{0} battle|{0} battles` — solda tekil, sağda
     * çoğul. Türkçe kaynak tek biçim taşıyor (sayıdan sonra çoğul eki
     * yok), İngilizcede iki biçim gerekiyor.
     *
     * Her biçim AYRI AYRI denetleniyor: yer tutucu birinde varken
     * ötekinde yoksa oyuncu sayıyı bazen görüp bazen görmezdi.
     */
    /*
     * İki yazım da geçerli:
     *
     *   {0} battle|{0} battles                       (cümlenin tamamı)
     *   {0} [lord|lords] played in {1} [day|days]    (sözcük sözcük)
     *
     * İkincisi iki sayılı cümleler için: biri 1 iken öteki 5 olabiliyor
     * ve tek bir tekil/çoğul seçimi ikisine birden yetmiyor.
     */
    const KOSELI = /\[([^[\]|]*)\|([^[\]|]*)\]/g;
    const koseliVar = KOSELI.test(t);
    KOSELI.lastIndex = 0;
    // Köşeli gruplar çözülünce iki OKUMA kalıyor: hep tekil, hep çoğul.
    // İkisi de ayrı ayrı denetleniyor.
    const okumalar = koseliVar ? [t.replace(KOSELI, '$1'), t.replace(KOSELI, '$2')] : [t];
    const formlar = okumalar.flatMap((o) => o.split('|'));
    if (okumalar.some((o) => o.split('|').length > 2)) {
      sorun.push(`${yer} — ${no} en çok iki çoğul biçimi olabilir (tekil|çoğul)`);
      continue;
    }
    if ((koseliVar || formlar.length > 1) && !/\{\d+\}/.test(kayit.tr)) {
      sorun.push(`${yer} — ${no} sayı taşımıyor; çoğul biçimi seçilemez`);
      continue;
    }
    if (formlar.some((f) => !f.trim())) {
      sorun.push(`${yer} — ${no} çoğul biçimlerinden biri boş`);
      continue;
    }
    if ((t.match(/\[/g) ?? []).length !== (t.match(/\]/g) ?? []).length) {
      sorun.push(`${yer} — ${no} köşeli parantezler eşleşmiyor`);
      continue;
    }

    /*
     * Yer tutucu denetimi. `{0}` çeviride kaybolursa oyun o sayıyı
     * HİÇ göstermez ve cümle sessizce eksik kalır: "Günde en fazla
     * saldırı yapabilirsin." Sırası değişebilir, kendisi değişemez.
     */
    const bekle = (kayit.tr.match(/\{\d+\}/g) ?? []).sort();
    const bozuk = formlar.find((f) => (f.match(/\{\d+\}/g) ?? []).sort().join() !== bekle.join());
    if (bozuk !== undefined) {
      sorun.push(
        `${yer} — ${no} yer tutucu uyuşmuyor: beklenen ${bekle.join(' ') || '(yok)'}, ` +
          `bulunan ${(bozuk.match(/\{\d+\}/g) ?? []).join(' ') || '(yok)'}`,
      );
      continue;
    }

    // Türkçe kalmışsa çeviri yapılmamış demektir. Kesin bir ölçüt yok;
    // birebir aynı olması yeterince kesin. Bilerek aynı bırakılacaksa
    // yukarıdaki "=" var.
    if (t === kayit.tr.trim()) {
      sorun.push(`${yer} — ${no} çevrilmemiş (Türkçesiyle aynı). Bilerekse "=" yaz.`);
      continue;
    }

    /*
     * Baştaki ve sondaki BOŞLUK kaynaktan geri konuyor.
     *
     * `" birim"`, `" kırıyor: "`, `"{0} sana kaynak yolladı: "` — bu
     * boşluklar metnin parçası; kodda yanlarına başka bir dizge
     * yapışıyor ve boşluk düşerse ekranda "5units" yazıyor. Ama düz
     * metin dosyasında görünmüyorlar: çevirmen sondaki boşluğu ne
     * görebiliyor ne de güvenilir biçimde yazabiliyor, çoğu düzenleyici
     * kaydederken siliyor. O yüzden sorulmuyor — kaynaktakinin aynısı
     * konuyor.
     */
    const bas = /^\s*/.exec(kayit.tr)[0];
    const son = /\s*$/.exec(kayit.tr.slice(bas.length))[0];
    // Boşluk HER BİÇİME ayrı konuyor: çoğul seçildikten sonra ekrana
    // çıkan tek bir biçim ve o da kendi boşluğunu taşımalı.
    // Boşluk HER BİÇİME ayrı konuyor: çoğul seçildikten sonra ekrana
    // çıkan tek bir biçim ve o da kendi boşluğunu taşımalı. Köşeli
    // gruplar cümlenin İÇİNDE kaldığı için onlara dokunulmuyor.
    kabul.set(
      anahtar,
      t
        .split('|')
        .map((f) => bas + f.trim() + son)
        .join('|'),
    );
  }
}

console.log(`Okunan satır: ${okunan}`);
console.log(`Kabul edilen çeviri: ${kabul.size}`);
console.log(`Sorunlu satır: ${sorun.length}`);
if (sorun.length) {
  console.log('');
  for (const s of sorun.slice(0, 40)) console.log(`  ${s}`);
  if (sorun.length > 40) console.log(`  … ve ${sorun.length - 40} tane daha`);
}

const toplam = Object.values(sozluk).filter((v) => v.grup !== 'harita').length;
console.log(`\nÇeviri durumu: ${kabul.size}/${toplam}`);

if (!uygula) {
  console.log('\nBu bir KURU KOŞU. Yazmak için: --uygula');
  process.exit(sorun.length ? 1 : 0);
}

for (const [anahtar, en] of kabul) sozluk[anahtar].en = en;
writeFileSync(sozlukYolu, JSON.stringify(sozluk, null, 2) + '\n');
console.log(`\nceviri/metinler.json güncellendi (${kabul.size} çeviri).`);
console.log('CSV için: node tools/metin-cikar.mjs');
