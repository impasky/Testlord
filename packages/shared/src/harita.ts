/**
 * Harita topolojisi — mesafe ve komşuluk.
 *
 * ── Neden altıgen ızgara kalktı ───────────────────────────────────────
 *
 * Oyuncunun cümlesi kısaydı: "hex sistemi olmasın." Altıgenler oyunu bir
 * diyar değil bir tablo gibi gösteriyordu. Ama ızgaranın MEKANİK olarak
 * yaptığı üç iş vardı — yürüyüş mesafesi, komşuluk kuralı, vilayet
 * gruplaması — ve üçü de aslında koordinat aritmetiğine değil tek bir
 * soruya bağlıydı: HANGİ BÖLGE HANGİSİNE BİTİŞİK.
 *
 * O soruyu doğrudan veriye yazınca altıgene hiç ihtiyaç kalmıyor. Artık
 * her bölge komşularını `world-map.json` içinde açıkça taşıyor ve mesafe
 * bu grafikte en kısa yol.
 *
 * Geçiş sırasında komşuluklar eski altıgen komşuluklarından türetildi ve
 * ölçüldü: 61 bölgenin 3721 çiftinin HEPSİNDE grafik mesafesi eski hex
 * mesafesiyle birebir aynı çıktı. Yani bu değişiklik dengeyi, yürüyüş
 * sürelerini ve mevcut hedef önerilerini hiç kaydırmadı — yalnız altıgeni
 * söktü (docs/12 §1).
 *
 * ── x/y'yi motor OKUMAZ ───────────────────────────────────────────────
 *
 * Bölgelerin `x`/`y` alanı yalnızca çizim içindir: haritanın resmi
 * üzerinde işaretçinin duracağı yer. Mesafe ve komşuluk buradan
 * hesaplanmaz. Bu kasıtlı — harita resmini yeniden ürettiğimizde
 * işaretçileri yeniden yerleştirmek gerekecek ve o iş oyunun kurallarını
 * kaydırmamalı.
 */
import { WORLD_MAP } from './balance.js';

/** Bölge kimliği → komşularının kimlikleri. */
export const KOMSULUK: ReadonlyMap<number, readonly number[]> = new Map(
  WORLD_MAP.regions.map((r) => [r.id, Object.freeze([...r.komsular])]),
);

/** Haritadaki bütün bölge kimlikleri, dosyadaki sırayla. */
export const BOLGE_IDLERI: readonly number[] = WORLD_MAP.regions.map((r) => r.id);

/**
 * Bütün çiftler için mesafe, modül yüklenirken bir kez hesaplanır.
 *
 * 61 bölge için 61 kez genişlik-öncelikli arama; toplam birkaç bin adım,
 * yani ölçülemeyecek kadar ucuz. Her çağrıda yeniden aramak yerine
 * hazır tablo tutmak, sunucunun sıcak yolundaki (hedef önerisi, saldırı
 * önizlemesi) yüzlerce mesafe sorgusunu tek bir tablo okumasına indiriyor.
 */
const MESAFE: ReadonlyMap<number, ReadonlyMap<number, number>> = (() => {
  const tablo = new Map<number, Map<number, number>>();
  for (const bas of BOLGE_IDLERI) {
    const uzaklik = new Map<number, number>([[bas, 0]]);
    // Dizi + okuma imleci: shift() büyük kuyrukta O(n), burada gereksiz.
    const kuyruk: number[] = [bas];
    for (let i = 0; i < kuyruk.length; i++) {
      const su = kuyruk[i]!;
      const d = uzaklik.get(su)!;
      for (const komsu of KOMSULUK.get(su) ?? []) {
        if (uzaklik.has(komsu)) continue;
        uzaklik.set(komsu, d + 1);
        kuyruk.push(komsu);
      }
    }
    tablo.set(bas, uzaklik);
  }
  return tablo;
})();

/** Haritanın çapı: birbirine en uzak iki bölge arasındaki adım sayısı. */
export const EN_UZAK_MESAFE: number = (() => {
  let en = 0;
  for (const satir of MESAFE.values()) for (const d of satir.values()) en = Math.max(en, d);
  return en;
})();

/**
 * İki bölge arasındaki mesafe: komşuluk grafiğinde en kısa yol.
 *
 * Bilinmeyen ya da ulaşılamayan bölge için `EN_UZAK_MESAFE` döner —
 * sonsuz değil. Sonsuz dönseydi çağıran taraftaki her süre hesabı NaN'a
 * düşerdi; en uzak mesafe hem sonlu hem de "çok uzak" anlamını taşıyor.
 */
export function bolgeMesafesi(a: number, b: number): number {
  if (a === b) return 0;
  return MESAFE.get(a)?.get(b) ?? EN_UZAK_MESAFE;
}

/** İki bölge bitişik mi. */
export function komsuMu(a: number, b: number): boolean {
  return (KOMSULUK.get(a) ?? []).includes(b);
}

/**
 * Ordunun bir hedefe GERÇEK mesafesi: en yakın toprağından ölçülür.
 *
 * Eskiden mesafe yalnız malikâneden ölçülüyordu ve ızgara bu yüzden boş
 * bir süstü: bölgenin senin bölgene bitişik olmasıyla haritanın öbür
 * ucunda olması arasında fark yoktu. Şimdi aldığın her bölge bir çıkış
 * noktası — toprak sahibi olmak haritayı AÇIYOR.
 *
 * Kartopu riski yok: tutulabilecek bölge sayısı seviyeye bağlı. Ev her
 * zaman listede, yani toprağı olmayan lord eskisi gibi oynamaya devam
 * eder.
 */
export function yakinlikMesafesi(
  evBolgeId: number,
  topraklarim: readonly number[],
  hedefBolgeId: number,
): number {
  let enAz = bolgeMesafesi(evBolgeId, hedefBolgeId);
  for (const t of topraklarim) {
    const d = bolgeMesafesi(t, hedefBolgeId);
    if (d < enAz) enAz = d;
  }
  return enAz;
}
