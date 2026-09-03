/**
 * Karşı-birim ipuçları — motorda duran stratejiyi görünür kılar.
 *
 * `balance.json` → `birim_kars_carpanlari` baştan beri var ve savaş
 * hesabında gerçekten kullanılıyor: mızrakçı süvariye ×1.5, okçu mızrakçıya
 * ×1.5, süvari okçuya ×1.5, mancınık kaleye ×2.0 ama canlı birime ×0.5.
 *
 * Ama oyuncu bunu HİÇBİR YERDE görmüyordu. Türe yapılan en yaygın eleştiri
 * "pek de strateji değil" (docs/09 §3.3) ve bizde strateji vardı — sadece
 * görünmüyordu. Görünmeyen bir strateji, olmayan bir stratejidir.
 *
 * Bu dosya metin üretmiyor, YAPI üretiyor: hangi eşleşme, hangi yön, ne
 * kadar önemli. Cümleyi arayüz kuruyor. Sebep, aynı veriyi önizlemede,
 * raporda ve kışlada farklı cümlelerle göstermek isteyebilmemiz.
 */
import { counterMultiplier, siegeVsFortress, siegeVsUnit } from './balance.js';
import { armyCount } from './combat.js';
import { UNIT_TYPES, type Army, type UnitType } from './types.js';

export type KarsiYon = 'guclu' | 'zayif';

export interface KarsiIpucu {
  /** 'guclu': benim birimim onun birimini kırıyor. 'zayif': tersi. */
  yon: KarsiYon;
  benim: UnitType;
  onun: UnitType;
  carpan: number;
  /**
   * Eşleşmenin savaşta ne kadar yer tuttuğu (0–1).
   *
   * İki ordudaki payların çarpımı. Sebep: 200 milis + 1 süvariye karşı
   * 1 mızrakçım varsa "mızrakçın süvarisini kırıyor" doğru ama ALAKASIZ
   * bir bilgi. Ağırlık, oyuncuya söylenecek üç şeyi seçmek için.
   */
  agirlik: number;
}

/**
 * İki ordu arasındaki karşı-birim eşleşmeleri, önemliden önemsize.
 *
 * Hem lehte hem aleyhte olanları döndürür; arayüz ikisini de gösteriyor
 * çünkü oyuncunun öğrenmesi gereken şey simetrik: neyi göndermeli VE
 * neyi göndermemeli.
 */
export function karsiIpuclari(benim: Army, onun: Army, enFazla = 3): KarsiIpucu[] {
  const benimToplam = armyCount(benim);
  const onunToplam = armyCount(onun);
  if (benimToplam === 0 || onunToplam === 0) return [];

  const ipuclari: KarsiIpucu[] = [];
  for (const b of UNIT_TYPES) {
    const bSayi = benim[b] ?? 0;
    if (bSayi === 0) continue;
    for (const o of UNIT_TYPES) {
      const oSayi = onun[o] ?? 0;
      if (oSayi === 0) continue;
      const agirlik = (bSayi / benimToplam) * (oSayi / onunToplam);

      const lehte = counterMultiplier(b, o);
      if (lehte > 1) ipuclari.push({ yon: 'guclu', benim: b, onun: o, carpan: lehte, agirlik });

      const aleyhte = counterMultiplier(o, b);
      if (aleyhte > 1) ipuclari.push({ yon: 'zayif', benim: b, onun: o, carpan: aleyhte, agirlik });
    }
  }

  // Önce ağırlık, eşitlikte çarpanı büyük olan. Sıralama kararlı olmalı:
  // aynı ordu ikilisi her çağrıda aynı sırayı vermeli, yoksa arayüz
  // yenilendikçe ipuçları yer değiştirir ve oyuncu okuyamaz.
  return ipuclari
    .sort(
      (a, b) =>
        b.agirlik - a.agirlik ||
        b.carpan - a.carpan ||
        a.benim.localeCompare(b.benim) ||
        a.onun.localeCompare(b.onun),
    )
    .slice(0, enFazla);
}

export type KusatmaDurumu =
  /** Tahkimatlı hedef: mancınık burada iki katı iş yapıyor. */
  | 'kaleye_iyi'
  /** Tahkimat yok ve karşıda canlı ordu var: mancınık yarım vuruyor. */
  | 'bosa_gidiyor'
  | null;

/**
 * Mancınık tuzağı.
 *
 * Mancınık kâğıt üstünde en yüksek saldırıya sahip birim (90) ve oyuncu
 * doğal olarak "en güçlüsü" sanıp alıyor. Oysa canlı birime karşı çarpanı
 * 0.5: yani sahada bir okçudan zayıf. Değerli olduğu tek yer tahkimatlı
 * hedef (×2.0).
 *
 * Bu, oyuncunun kendi başına asla çıkaramayacağı ve öğrenene kadar
 * kaynak yakacağı bir kural. Söylenmesi gerekiyor.
 */
export function kusatmaDurumu(benim: Army, onun: Army, tahkimatBonusu: number): KusatmaDurumu {
  if ((benim.kusatma ?? 0) === 0) return null;
  if (tahkimatBonusu > 0) return 'kaleye_iyi';
  return armyCount(onun) > 0 ? 'bosa_gidiyor' : null;
}

/** Mancınığın çarpanları — arayüz sayıyı kendisi yazmasın diye. */
export function kusatmaCarpanlari(): { kale: number; birim: number } {
  return { kale: siegeVsFortress(), birim: siegeVsUnit() };
}
