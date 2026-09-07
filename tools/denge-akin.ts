/**
 * Akın denge tablosu — sayıları DEĞİŞTİRMEZ, gösterir.
 *
 * Neden var: `data/balance.json → akin` ve `data/akinlar.json` birbirine
 * bağlı ve bağ görünmüyor. Bir haritanın `odul_agirligi`ni değiştirmek,
 * o haritanın saatlik verimini de değiştiriyor — çünkü erzağın altın
 * karşılığı demirin karşılığından küçük. İlk turda tam bu oldu: düz bir
 * çarpan dizisi (1, 1.8, 2.7, 4, 5.6) yazdım ve erzak ağırlıklı Kuzey
 * Buzulu, demir ağırlıklı Solgun Bataklık'tan DAHA AZ verdi.
 *
 * Bu araç o bağı görünür kılıyor. Ağırlıkları ya da süreleri değiştiren
 * biri buradaki tabloya bakıp `odul_carpani` değerlerini yeniden
 * çözmeli; `akin.test.ts` de sıralamanın bozulmadığını sınıyor.
 *
 *   pnpm denge:akin
 *
 * `tsx` ile çalışıyor ve motoru KAYNAKTAN (`packages/shared/src`) alıyor:
 * kök `package.json` bir çalışma alanı üyesi değil, o yüzden
 * `@lordlar/shared` adı burada çözülmüyor. Doğrudan yol, aynı sayıları
 * okumanın tek yolu — ikinci bir kopya çıkarmak dengeyi iki yerde
 * tutmak olurdu.
 */
import {
  AKIN_ANAHTARLARI,
  B,
  akinGarnizonSayisi,
  akinHaritasi,
  akinOdulu,
  akinSuresiSn,
  altinKarsiligi,
  regionBaseIncome,
} from '../packages/shared/src/index.js';

const deger = (o) => altinKarsiligi(o);
const saatlik = (h, g) => Math.round((deger(akinOdulu(h, g)) / akinSuresiSn(h, g)) * 3600);

console.log('AKIN DENGE TABLOSU\n');
console.log('Saatlik TOPLAM DEĞER (altın karşılığı) — sonraki harita hep daha çok vermeli\n');
console.log('harita'.padEnd(22), 'g1'.padStart(8), 'g5'.padStart(8), 'g10'.padStart(8), '  çarpan');
let once = 0;
let bozuk = false;
for (const h of AKIN_ANAHTARLARI) {
  const d = akinHaritasi(h);
  const v = saatlik(h, 1);
  const isaret = once && v <= once ? '  ← SIRA BOZUK' : '';
  if (once && v <= once) bozuk = true;
  once = v;
  console.log(
    h.padEnd(22),
    String(v).padStart(8),
    String(saatlik(h, 5)).padStart(8),
    String(saatlik(h, 10)).padStart(8),
    ` ${d.odul_carpani}${isaret}`,
  );
}

console.log('\nGarnizon büyüklüğü\n');
for (const h of AKIN_ANAHTARLARI) {
  console.log(
    h.padEnd(22),
    [1, 5, 10].map((g) => String(akinGarnizonSayisi(h, g)).padStart(5)).join(''),
  );
}

console.log('\nKuramsal günlük tavan (bütün gruplar her yenilenmede vurulursa)\n');
let toplam = 0;
for (const h of AKIN_ANAHTARLARI) {
  for (let g = 1; g <= 10; g++) {
    const kez = g === 10 ? 24 / B.akin.sef_yenilenme_saat : 24 / B.akin.yenilenme_saat;
    toplam += deger(akinOdulu(h, g)) * kez;
  }
}
const koyGunluk = 5 * (regionBaseIncome('koy').altin ?? 0) * 24;
console.log(`akın tavanı        : ${Math.round(toplam)} altın değeri/gün`);
console.log(`5 köyün geliri     : ${koyGunluk} altın/gün`);
console.log(`oran               : ${(toplam / koyGunluk).toFixed(1)} kat`);
console.log(
  '\nBu oran akının bir GELİR KAYNAĞI değil MASRAF KARŞILAMA yeri olduğunu\n' +
    'söylemeli: tavan 12 saatlik kesintisiz elle oynamayı gerektiriyor ve\n' +
    'her akın asker kaybettiriyor. Yüzlerce kata çıkarsa toprak tutmanın\n' +
    'kaynak tarafındaki anlamı kalmaz.',
);

console.log('\nBir saat AKTİF akın (3 eş zamanlı slot, ilk harita 3. grup)\n');
const sn = akinSuresiSn('kirik_sahil', 3);
console.log(
  `${B.akin.es_zamanli} slot × ${Math.round(3600 / sn)} akın × ${Math.round(
    deger(akinOdulu('kirik_sahil', 3)),
  )} = ${Math.round(B.akin.es_zamanli * (3600 / sn) * deger(akinOdulu('kirik_sahil', 3)))} altın değeri`,
);

process.exit(bozuk ? 1 : 0);
