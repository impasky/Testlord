/**
 * ÇEVİRİ PAKETİ — sözlüğü arayüzün yükleyeceği hâle getirir.
 *
 * `ceviri/metinler.json` çevirmen için: Türkçesi, nerede geçtiği,
 * grubu. Arayüzün bunların hiçbirine ihtiyacı yok; yalnız
 * `anahtar -> çeviri` lazım ve o dosya her açılışta indiriliyor.
 * Tam sözlük 600 KB, buradan çıkan 100 KB'ın altında.
 *
 * ÇEVRİLMEMİŞ KAYIT PAKETE HİÇ GİRMİYOR. Boş dize yazmak yerine
 * kaydı hiç koymamak, `cevir()`in Türkçeye düşmesini kendiliğinden
 * doğru kılıyor: "anahtar yok" ile "çevirisi boş" aynı şey oluyor.
 *
 *   node tools/ceviri-paket.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const KOK = new URL('../', import.meta.url);
const sozluk = JSON.parse(readFileSync(new URL('ceviri/metinler.json', KOK), 'utf8'));

/** Hangi diller paketleniyor. Türkçe kaynak dil, paketi yok. */
const DILLER = ['en'];

const cikti = new URL('apps/web/src/ceviri/', KOK);
mkdirSync(cikti, { recursive: true });

for (const dil of DILLER) {
  const paket = {};
  /** Sunucu mesajlarını eşleştirmek için kaynak kalıpları da lazım. */
  const kaliplar = {};
  let sayi = 0;
  for (const [anahtar, v] of Object.entries(sozluk)) {
    if (!v.en) continue;
    paket[anahtar] = v.en;
    sayi++;
    // Yalnız YER TUTUCULU kayıtların Türkçesi taşınıyor: sunucudan
    // yerleştirilmiş gelen mesajı kalıba uydurmak için gerekiyor.
    // Yer tutucusuz olanlar doğrudan özetle bulunuyor, kaynak gerekmiyor.
    if (/\{\d+\}/.test(v.tr)) kaliplar[anahtar] = v.tr;
  }
  writeFileSync(new URL(`${dil}.json`, cikti), JSON.stringify(paket) + '\n');
  writeFileSync(new URL(`${dil}-kaliplar.json`, cikti), JSON.stringify(kaliplar) + '\n');
  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log(
    `${dil}.json          ${String(sayi).padStart(5)} çeviri  ${kb(JSON.stringify(paket).length)}`,
  );
  console.log(
    `${dil}-kaliplar.json ${String(Object.keys(kaliplar).length).padStart(5)} kalıp   ` +
      kb(JSON.stringify(kaliplar).length),
  );
}
