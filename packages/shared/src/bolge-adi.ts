/**
 * Bölge türünün OKUNUR adı.
 *
 * `ETKI_ADI` ile birebir aynı hikâye, aynı sonuç. Bu eşleme üç ekranda
 * gerekiyordu — Harita, Malikâne, hedef şeridi — ve üçü de kendi
 * kopyasını taşıyordu. Kopyalar ayrıştı ve ayrışma OYUNCUYA ÇIKTI:
 *
 *   Köy `koy` anahtarı yalnız Malikâne'nin kopyasına eklendi. Diğer iki
 *   kopyada hiç yoktu ve ikisi de `TIP_ADI[x] ?? x` ile HAM ANAHTARA
 *   düşüyordu. Kışla'daki hedef şeridi yeni oyuncunun ilk hedefinde
 *   birebir şunu yazıyordu:
 *
 *       koy · 2dk 0sn yürüyüş
 *
 *   Köy haritanın 121 bölgesinin 24'ü ve oyuncunun İLK fethi. Yani
 *   oyunun ilk dakikasında, en çok bakılan satırda, veritabanı anahtarı.
 *   Malikâne'deki kopyanın yorumu bu hatayı bir kez tarif edip
 *   düzeltmişti; düzeltme üç kopyanın yalnız birine gitti.
 *
 * Bu yüzden tek kaynak: `world-map.json`daki her bölge türünün burada
 * bir karşılığı olduğunu `bolge-adi.test.ts` doğruluyor. Haritaya yeni
 * bir tür girerse test kalır — ekranda ham anahtar değil.
 *
 * Adlar BÜYÜK harfle başlıyor (`ETKI_ADI`nın tersine): burada metin
 * cümle ortası değil, bir başlık ya da rozet. Üç kullanım yerinin
 * üçünde de tek başına duruyor.
 */
import type { RegionType } from './types.js';

export const BOLGE_ADI: Record<RegionType, string> = {
  koy: 'Köy',
  tarla: 'Tarla',
  maden: 'Maden',
  sehir: 'Şehir',
  kale: 'Kale',
  taht: 'Taht Kalesi',
};

/**
 * Tür adı — tanınmayan anahtarda ham anahtara düşer.
 *
 * Düşmek İSTENEN davranış değil, son çare: testler ham anahtarın
 * ekrana çıkmasını engelliyor, bu yalnızca sunucudan beklenmedik bir
 * tür gelirse ekranın boş kalmamasını sağlıyor.
 */
export function bolgeAdi(tur: string): string {
  return BOLGE_ADI[tur as RegionType] ?? tur;
}
