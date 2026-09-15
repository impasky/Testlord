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
  for (const [i, ham] of metin.split('\n').entries()) {
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
    const ceviri = ok ? ok[3] : kalan;
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
     * Yer tutucu denetimi. `{0}` çeviride kaybolursa oyun o sayıyı
     * HİÇ göstermez ve cümle sessizce eksik kalır: "Günde en fazla
     * saldırı yapabilirsin." Sırası değişebilir, kendisi değişemez.
     */
    const bekle = (kayit.tr.match(/\{\d+\}/g) ?? []).sort();
    const var_ = (t.match(/\{\d+\}/g) ?? []).sort();
    if (bekle.join() !== var_.join()) {
      sorun.push(
        `${yer} — ${no} yer tutucu uyuşmuyor: beklenen ${bekle.join(' ') || '(yok)'}, ` +
          `bulunan ${var_.join(' ') || '(yok)'}`,
      );
      continue;
    }

    /*
     * "=" — BİLEREK AYNI KALSIN.
     *
     * Bazı dizgeler hiçbir dilde değişmiyor: özel adlar ("Kara Yusuf"),
     * marka ve alan adları, birim kısaltmaları. Çevirmen bunları Türkçe
     * bırakınca araç "çevrilmemiş" diye reddediyordu ve satır sonsuza
     * kadar kalanlar listesinde kalıyordu. "=" o satırı BİTTİ sayıyor.
     */
    if (t === '=' || t === '=' + kayit.tr) {
      kabul.set(anahtar, kayit.tr);
      continue;
    }

    // Türkçe kalmışsa çeviri yapılmamış demektir. Kesin bir ölçüt yok;
    // birebir aynı olması yeterince kesin. Bilerek aynı bırakılacaksa
    // yukarıdaki "=" var.
    if (t === kayit.tr) {
      sorun.push(`${yer} — ${no} çevrilmemiş (Türkçesiyle aynı). Bilerekse "=" yaz.`);
      continue;
    }

    kabul.set(anahtar, t);
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
