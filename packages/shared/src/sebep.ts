/**
 * Savaş sebepleri — raporun "neden" sorusuna cevabı.
 *
 * Rapor baştan beri NE olduğunu söylüyordu: kim öldü, ne yağmalandı,
 * şöhret ne oldu (docs/08 İ2). Söylemediği şey NEDEN olduğuydu.
 *
 * Bu bir öğrenme sorunu: oyuncu neden kaybettiğini bilmiyorsa
 * öğrenemiyor, öğrenemiyorsa oyun stratejiden kumara dönüyor
 * (docs/09 §3.7).
 *
 * Yeni veri gerekmedi. Rapor zaten tur tur güçleri, iki tarafın
 * kayıplarını ve kurtulanlarını taşıyor — kayıp + kurtulan = savaşa
 * giren ordu. Yani sebepler ELDEKİ veriden türetiliyor, sunucudan
 * ek bir alan istenmedi.
 */
import { B } from './balance.js';
import { armyCount } from './combat.js';
import { karsiIpuclari, kusatmaDurumu } from './karsi.js';
import type { Army, UnitType } from './types.js';

export type SebepTuru =
  /** Güç oranı belirgin şekilde lehine/aleyhineydi. */
  | 'guc'
  /** Kazandı ama ele geçirme eşiğini aşamadı. */
  | 'dar_zafer'
  /** Birim eşleşmesi. */
  | 'karsi'
  /** Mancınık canlı orduya yarım vurdu. */
  | 'kusatma_bosa'
  /** Mancınık tahkimata iki katı vurdu. */
  | 'kusatma_iyi'
  /** Savunanın tahkimatı. */
  | 'tahkimat';

export interface SavasSebebi {
  tur: SebepTuru;
  /** Bakan oyuncunun lehine mi? Arayüz rengi buradan geliyor. */
  lehte: boolean;
  /** Eşleşme sebeplerinde dolu — bakan oyuncunun birimi. */
  benim?: UnitType;
  /** Eşleşme sebeplerinde dolu — karşı tarafın birimi. */
  onun?: UnitType;
  /** Oran, çarpan ya da yüzde. Arayüz biçimlendiriyor. */
  deger?: number;
}

export interface SebepGirdisi {
  /** Raporu kim okuyor. Sebepler ona göre yönlendirilir. */
  bakis: 'saldiran' | 'savunan';
  saldiranOrdu: Army;
  savunanOrdu: Army;
  /** Tur tur güçler. Ortalama güç payı buradan hesaplanır. */
  turlar: { saldiranGuc: number; savunanGuc: number }[];
  saldiranKazandi: boolean;
  eleGecirdi: boolean;
  /** 0 ise tahkimat yok. */
  tahkimatBonusu: number;
}

/**
 * Güç oranının "belirgin" sayılacağı eşik.
 *
 * Savaşta tur başına ±%7 rastgelelik var; 1.15'in altındaki bir fark
 * sonucu açıklamıyor, sadece şans oluyor. O yüzden "gücün üstündü"
 * demek için bu kadarı gerekiyor.
 */
const BELIRGIN_ORAN = 1.15;

/** Ele geçirme eşiği — tek kaynak balance.json. */
export function eleGecirmeEsigi(): number {
  return B.savas.bolge_ele_gecirme.ele_gecirme_esigi;
}

/**
 * Ortalama güç payı: R = saldıran / (saldıran + savunan).
 *
 * Tur tur değil ortalama, çünkü oyuncuya söylenecek şey tek bir cümle.
 * Turların ortalaması alınıyor, toplamların oranı değil: uzun savaşta
 * son turlar ordular eridiği için uç değerler veriyor ve toplam oranı
 * çarpıtıyor.
 */
export function ortalamaGucPayi(turlar: { saldiranGuc: number; savunanGuc: number }[]): number {
  const gecerli = turlar.filter((t) => t.saldiranGuc + t.savunanGuc > 0);
  if (gecerli.length === 0) return 0.5;
  const toplam = gecerli.reduce((s, t) => s + t.saldiranGuc / (t.saldiranGuc + t.savunanGuc), 0);
  return toplam / gecerli.length;
}

/**
 * Savaşın sebepleri, önemliden önemsize.
 *
 * En fazla dört sebep: beşinci cümle okunmuyor ve raporun asıl işi
 * (ne oldu) gölgede kalıyor.
 */
export function savasSebepleri(g: SebepGirdisi, enFazla = 4): SavasSebebi[] {
  const sebepler: SavasSebebi[] = [];
  const R = ortalamaGucPayi(g.turlar);
  const saldiranBakiyor = g.bakis === 'saldiran';

  // --- Güç oranı ---
  // R saldıranın payı. Bakan savunansa payı 1-R.
  const benimPay = saldiranBakiyor ? R : 1 - R;
  const oran = benimPay / Math.max(1e-6, 1 - benimPay);
  if (oran >= BELIRGIN_ORAN || oran <= 1 / BELIRGIN_ORAN) {
    sebepler.push({ tur: 'guc', lehte: oran >= BELIRGIN_ORAN, deger: oran });
  }

  // --- Dar zafer ---
  // Saldıran kazandı ama eşiği aşamadı: oyuncunun en çok şaşırdığı yer.
  // "Kazandım ama bölge neden benim olmadı?" sorusu burada cevaplanıyor.
  if (g.saldiranKazandi && !g.eleGecirdi) {
    sebepler.push({ tur: 'dar_zafer', lehte: !saldiranBakiyor, deger: eleGecirmeEsigi() });
  }

  // --- Tahkimat ---
  if (g.tahkimatBonusu > 0) {
    sebepler.push({ tur: 'tahkimat', lehte: !saldiranBakiyor, deger: g.tahkimatBonusu });
  }

  // --- Birim eşleşmeleri ---
  const benim = saldiranBakiyor ? g.saldiranOrdu : g.savunanOrdu;
  const onun = saldiranBakiyor ? g.savunanOrdu : g.saldiranOrdu;
  for (const i of karsiIpuclari(benim, onun, 2)) {
    sebepler.push({
      tur: 'karsi',
      lehte: i.yon === 'guclu',
      benim: i.benim,
      onun: i.onun,
      deger: i.carpan,
    });
  }

  // --- Mancınık ---
  // Yalnızca saldıran mancınık kullanır; savunanın mancınığı da
  // garnizonda durur ama tahkimat kendi lehine, o yüzden uyarı saldıranın.
  const kusatma = kusatmaDurumu(g.saldiranOrdu, g.savunanOrdu, g.tahkimatBonusu);
  if (kusatma === 'bosa_gidiyor' && armyCount(g.savunanOrdu) > 0) {
    sebepler.push({ tur: 'kusatma_bosa', lehte: !saldiranBakiyor });
  } else if (kusatma === 'kaleye_iyi') {
    sebepler.push({ tur: 'kusatma_iyi', lehte: saldiranBakiyor });
  }

  return sebepler.slice(0, enFazla);
}
