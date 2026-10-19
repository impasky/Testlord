/**
 * GARNİZON PAYI — bölge geliri orada DURANLARIN, bıraktıkları YER oranında
 * (docs/16 §6, docs/27).
 *
 * Toprak kâğıt üstünde tutulan bir şey değil, üstünde asker bulundurmayı
 * gerektiren bir şey: ordusunu eve çeken lord bölgeyi kaybetmiyor ama
 * gelirini kaybediyor. Pay alabilen kim — sahibi ve sahibin ittifak
 * üyeleri (takviye) — sunucunun sorusu (`services/gelir.ts`); burası
 * yalnız bölüşüm.
 *
 * BU DOSYA SAF. Sayılar `balance.json` → `garnizon_payi`.
 */
import { B, unit } from './balance.js';
import type { Army } from './types.js';

const G = (B as unknown as { garnizon_payi: { asgari_yer: number } }).garnizon_payi;

/** Bir ordunun kapladığı komuta YERİ — pay bunun oranında bölünüyor. */
export function orduYeri(ordu: Army): number {
  let toplam = 0;
  for (const [tur, adet] of Object.entries(ordu)) {
    if (!adet || adet <= 0) continue;
    toplam += unit(tur as Parameters<typeof unit>[0]).yer * adet;
  }
  return toplam;
}

/**
 * Bir lordun bu bölgedeki GELİR payı.
 *
 * Adı `GarnizonPayi` DEĞİL: o ad `takviye.ts`te zaten var ve başka bir
 * şeyi anlatıyor (bölgedeki bir lordun ORDUSU, savaşa giren yığın).
 * Burada ölçülen şey ordu değil, o ordunun HAK ETTİĞİ pay.
 */
export interface GelirPayi {
  lordId: string;
  yer: number;
  /** Gelirin bu lorda düşen oranı (0-1). */
  oran: number;
}

/**
 * Bölge gelirini garnizonlar arasında YER oranında böler.
 *
 * TAVAN YOK ve bilerek yok. Tavan "kim önce doldurursa" yarışı yaratır;
 * oransal bölüşüm kendi kendini dengeliyor: kalabalık bölgede yer başına
 * kazanç düşüyor.
 */
export function garnizonPaylari(garnizonlar: { lordId: string; ordu: Army }[]): GelirPayi[] {
  const yerler = garnizonlar
    .map((g) => ({ lordId: g.lordId, yer: orduYeri(g.ordu) }))
    .filter((g) => g.yer >= G.asgari_yer);
  const toplam = yerler.reduce((s, g) => s + g.yer, 0);
  if (toplam <= 0) return [];
  return yerler.map((g) => ({ ...g, oran: g.yer / toplam }));
}

/**
 * Bir lordun bu bölgeden saatlik payı.
 *
 * Yuvarlama AŞAĞI: paylar toplandığında bölgenin ürettiğinden fazlası
 * dağıtılmamalı. Yukarı yuvarlamak, on kişilik bir bölgede her saat
 * yoktan dokuz altın üretirdi.
 */
export function payMiktari(gelir: number, oran: number): number {
  return Math.floor(gelir * oran);
}
