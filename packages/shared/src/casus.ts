/**
 * Casusluk: saldırmadan önce bilgi almak.
 *
 * docs/01 §1'de Kurnazlık statı "yağma miktarı, **casusluk**" diye tarif
 * ediliyordu. Yağma vardı, casusluk yoktu — yani stat açıklaması oyuna
 * verilmiş ama tutulmamış bir sözdü. Bu dosya o sözü tutuyor ve Kurnazlık'a
 * ikinci bir iş veriyor.
 *
 * Tasarımın çekirdeği: **bilgi bedava değil.** Keşif altın ve zaman yiyor,
 * üstelik yakalanma riski taşıyor. Bedava olsaydı her oyuncu her saldırıdan
 * önce casus gönderirdi ve "göndereyim mi" diye bir karar kalmazdı. Risk,
 * kararı karar yapan şey.
 *
 * Buradaki her şey SAF: rastgelelik dışarıdan tohumla geliyor, saat
 * dışarıda. Sunucu bunları çağırıp sonucu yazıyor.
 */
import { B } from './balance.js';

/** Keşfin süresi: mesafeye bağlı ama yürüyüşten çok daha hızlı. */
export function kesifSuresiSn(mesafeHex: number): number {
  const k = B.casusluk;
  const dakika = k.taban_dakika + k.hex_basina_dakika * Math.max(0, mesafeHex);
  return Math.round(dakika * 60);
}

export function kesifMaliyetiAltin(): number {
  return B.casusluk.maliyet_altin;
}

/** Raporun tazelik süresi. */
export function kesifGecerlilikSn(): number {
  return B.casusluk.gecerlilik_saat * 3600;
}

/**
 * Yakalanma ihtimali: Kurnazlık düşürür ama sıfırlamaz.
 *
 * Taban bir yerde durmalı. "Artık hiç yakalanmam" noktası olsaydı
 * yüksek Kurnazlıklı oyuncu için casusluk yine bedava bilgiye dönerdi ve
 * kararın gerilimi kaybolurdu.
 */
export function yakalanmaIhtimali(kurnazlik: number): number {
  const k = B.casusluk;
  const dusus = k.kurnazlik_basina_azaltma * Math.max(0, kurnazlik);
  return Math.max(k.en_dusuk_yakalanma, k.yakalanma_tabani - dusus);
}

/** Bir keşif raporunun anlık görüntüsü. */
export interface KesifFotografi {
  garrison: Record<string, number>;
  store: { altin: number; demir: number; erzak: number };
  tahkimatBonusu: number;
  bolgeSeviyesi: number;
  sahipAdi: string | null;
}

export interface KesifDurumu {
  /** Rapor var mı. */
  var: boolean;
  /** Geçerlilik süresi dolmuş mu — bilgi hâlâ gösteriliyor ama "eski". */
  eski: boolean;
  /** Kaç saniye önce alındı. */
  yasSn: number;
}

/**
 * Bir raporun durumu.
 *
 * Süresi geçen rapor SİLİNMİYOR, eskimiş sayılıyor. Eski istihbarat da
 * bilgidir; ona güvenip güvenmemek oyuncunun kararı olmalı. Silmek,
 * oyuncuyu bilmediği bir noktaya geri atardı.
 */
export function kesifDurumu(alindi: Date | null, simdi: Date): KesifDurumu {
  if (alindi === null) return { var: false, eski: false, yasSn: 0 };
  const yasSn = Math.max(0, Math.floor((simdi.getTime() - alindi.getTime()) / 1000));
  return { var: true, eski: yasSn > kesifGecerlilikSn(), yasSn };
}
