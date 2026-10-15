/**
 * Dünya haritasının LİSTE görünümü — süzme ve sıralama (docs/23 Faz 3).
 *
 * Harita gözle tarandığında iyi; ama "bana en yakın saldırılabilir köy
 * hangisi" sorusunun cevabı yüz yirmi bir toprağı tek tek dokunarak
 * aranıyordu. Ekran okuyucu kullanan oyuncu için harita bir düğme
 * yığınıydı. Liste aynı veriyi (`/map`) sıralı satırlar olarak veriyor.
 *
 * Hedefler süzgeci Hedefler merceğiyle BİREBİR aynı kuralı okuyor
 * (shared `hedefDurumu`): listede görünen her hedefe sunucu da saldırı
 * izni veriyor.
 */
import { hedefDurumu } from '@lordlar/shared';
import type { RegionDto } from '../../api/client';

export type ListeSuzgeci = 'hedef' | 'benim' | 'hepsi';

/** Bir satırın rozeti: neden saldırılamıyor ya da ne özelliği var. */
export type Rozet = 'kalkan' | 'pakt' | 'muttefik' | 'cekirdek' | 'yoldas' | 'taht' | 'garnizon';

export interface ListeSatiri {
  r: RegionDto;
  rozetler: Rozet[];
}

export function bolgeListesi(
  regions: readonly RegionDto[],
  suzgec: ListeSuzgeci,
  benimMedeniyetId: string | null,
): ListeSatiri[] {
  const satirlar: ListeSatiri[] = [];
  for (const r of regions) {
    const d = hedefDurumu(r, benimMedeniyetId);
    // "Toprağım": sahibi olduğun bölge ve garnizonunun durduğu bölge —
    // ikisinden de gelir alıyorsun, ikisini de korumak senin işin.
    const garnizon = !r.isMine && r.pay != null;
    if (suzgec === 'hedef' && d.tur !== 'acik') continue;
    if (suzgec === 'benim' && d.tur !== 'benim' && !garnizon) continue;
    const rozetler: Rozet[] = [];
    if (d.tur === 'yasak') rozetler.push(d.sebep);
    if (garnizon) rozetler.push('garnizon');
    if (r.type === 'taht') rozetler.push('taht');
    satirlar.push({ r, rozetler });
  }
  // Yakın önce; eşitse yüksek seviye (daha değerli), sonra ad (kararlı sıra).
  return satirlar.sort(
    (a, b) =>
      a.r.distance - b.r.distance ||
      b.r.level - a.r.level ||
      a.r.name.localeCompare(b.r.name, 'tr'),
  );
}

/** Süzgeç düğmelerindeki sayılar — üçü birden, tek geçişte. */
export function suzgecSayilari(
  regions: readonly RegionDto[],
  benimMedeniyetId: string | null,
): Record<ListeSuzgeci, number> {
  const n = { hedef: 0, benim: 0, hepsi: regions.length };
  for (const r of regions) {
    const d = hedefDurumu(r, benimMedeniyetId);
    if (d.tur === 'acik') n.hedef++;
    if (d.tur === 'benim' || r.pay != null) n.benim++;
  }
  return n;
}
