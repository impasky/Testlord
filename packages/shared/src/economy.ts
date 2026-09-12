/**
 * Kaynak üretimi, depo, ordu bakımı.
 *
 * Merkezî teknik karar: "lazy accrual". Sunucu periyodik gelir tick'i
 * ÇALIŞTIRMAZ. Her kayıtta lastTickAt tutulur ve kayda dokunulduğunda geçen
 * süre kadar üretim eklenir. 120 oyuncu için de 120.000 için de maliyet aynıdır.
 */
import { B, regionBaseIncome, unit } from './balance.js';
import { depoEki } from './bina.js';
import type { ArastirmaBonusu } from './arastirma.js';
import type { Army, GeneralBonus, Resources } from './types.js';
import { UNIT_TYPES } from './types.js';

export function bosKaynak(): Resources {
  return { altin: 0, demir: 0, erzak: 0 };
}

export function kaynakTopla(a: Resources, b: Resources): Resources {
  return { altin: a.altin + b.altin, demir: a.demir + b.demir, erzak: a.erzak + b.erzak };
}

export function kaynakCikar(a: Resources, b: Resources): Resources {
  return { altin: a.altin - b.altin, demir: a.demir - b.demir, erzak: a.erzak - b.erzak };
}

export function kaynakYeterli(mevcut: Resources, gereken: Resources): boolean {
  return (
    mevcut.altin >= gereken.altin && mevcut.demir >= gereken.demir && mevcut.erzak >= gereken.erzak
  );
}

export function kaynakCarp(a: Resources, k: number): Resources {
  return { altin: a.altin * k, demir: a.demir * k, erzak: a.erzak * k };
}

/** Malikânenin saatlik üretimi. Kaybedilemez taban gelir, seviyeyle büyür. */
export function malikaneIncome(lordLevel: number, arastirma?: ArastirmaBonusu): Resources {
  const t = B.kaynaklar.malikane_saatlik;
  const b = B.kaynaklar.malikane_seviye_bonusu_saatlik;
  const k = 1 + (arastirma?.malikaneGeliri ?? 0);
  return {
    altin: Math.round((t.altin + b.altin * lordLevel) * k),
    demir: Math.round((t.demir + b.demir * lordLevel) * k),
    erzak: Math.round((t.erzak + b.erzak * lordLevel) * k),
  };
}

/** Bir bölgenin saatlik üretimi. */
export function regionIncome(
  type: string,
  level: number,
  incomeMult: number,
  generalBonus?: GeneralBonus,
  arastirma?: ArastirmaBonusu,
): Resources & { sohret: number } {
  const base = regionBaseIncome(type);
  const levelMult = 1 + B.bolgeler.seviye_basina_gelir * (level - 1);
  // General ve araştırma bonusları TOPLANIYOR, çarpılmıyor: iki kaynak
  // üst üste çarpıldığında yüzdeler sessizce birbirini büyütüyor ve
  // oyuncuya gösterilen "+%20" gerçekte +%38 oluyordu.
  const bonus = 1 + (generalBonus?.bolgeGeliri ?? 0) + (arastirma?.bolgeGeliri ?? 0);
  const f = incomeMult * levelMult * bonus;
  return {
    altin: (base.altin ?? 0) * f,
    demir: (base.demir ?? 0) * f,
    erzak: (base.erzak ?? 0) * f,
    sohret: (base.sohret_saat ?? 0) * levelMult,
  };
}

/**
 * Vilayet birliği çarpanı: aynı vilayette kaç bölge tutuyorsan o kadar
 * verimli oluyorsun.
 *
 * Diyar yedi vilayete bölünmüştü (`world-map.json` → provinces) ve bu
 * bölünme HİÇBİR yerde iş görmüyordu — ne haritada görünüyordu ne
 * mekanikte. Bonus, "hangi bölgeyi alayım" sorusunun yanına "**nerede**"
 * sorusunu koyuyor: dağınık üç bölge ile bitişik üç bölge artık aynı şey
 * değil (docs/11 §1.2 H2).
 *
 * Tavan var, çünkü tavansız bir birlik bonusu "hepsini tek vilayete yığ"
 * diye tek bir doğru oyun yaratırdı.
 */
export function vilayetCarpani(ayniVilayettekiBolgeSayisi: number): number {
  const v = B.bolgeler.vilayet_birligi;
  if (ayniVilayettekiBolgeSayisi <= 1) return 1;
  return 1 + Math.min(v.azami, (ayniVilayettekiBolgeSayisi - 1) * v.bolge_basina);
}

/**
 * Bölge listesinden vilayet → bölge sayısı tablosu.
 *
 * Taht Kalesi kendi vilayetinde tek: birlik bonusu ona hiçbir şey katmıyor
 * ve katmamalı — tahtın değeri zaten kendi çarpanında.
 */
export function vilayetSayilari(bolgeler: readonly { province: string }[]): Record<string, number> {
  const sayac: Record<string, number> = {};
  for (const b of bolgeler) sayac[b.province] = (sayac[b.province] ?? 0) + 1;
  return sayac;
}

/**
 * Depo tavanı: lord seviyesi + MALİKÂNE + araştırma çarpanı.
 *
 * Depo tavanı eskiden YALNIZ lord seviyesiyle büyüyordu: ekranda üç
 * kırmızı "depo dolu" uyarısı yanıyor ve hiçbirinin altında oyuncunun
 * basabileceği bir düğme yoktu. Önce Ambarlar araştırması, sonra
 * malikâne o uyarıya birer cevap verdi — biri ORAN, öteki SAYI
 * (docs/12 §4). Malikânesiz lord Y4 öncesiyle aynı tavanı görüyor.
 */
export function storageCapacity(
  lordLevel: number,
  arastirma?: ArastirmaBonusu,
  binalar?: Record<string, number>,
): number {
  const taban =
    B.kaynaklar.depo_kapasitesi.taban +
    B.kaynaklar.depo_kapasitesi.lord_seviye_basina * lordLevel +
    depoEki(binalar ?? {});
  return Math.round(taban * (1 + (arastirma?.depoCarpani ?? 0)));
}

/** Ordunun saatlik erzak gideri. */
export function upkeepPerHour(
  army: Army,
  generalBonus?: GeneralBonus,
  arastirma?: ArastirmaBonusu,
): number {
  const raw = UNIT_TYPES.reduce((s, t) => s + (army[t] ?? 0) * unit(t).bakim_erzak_saat, 0);
  // İndirimler toplanıyor; bakım hiçbir zaman eksiye düşmüyor.
  const indirim = (generalBonus?.bakimMaliyeti ?? 0) - (arastirma?.bakimIndirimi ?? 0);
  return raw * Math.max(0, 1 + indirim);
}

export interface AccrualInput {
  current: Resources;
  lordLevel: number;
  /** Lordun bina seviyeleri; malikâne depo tavanını büyütüyor. */
  binalar?: Record<string, number>;
  /**
   * Araştırma bonusu — depo çarpanı için.
   *
   * Eskiden verilmiyordu ve `accrue` tavanı ÇARPANSIZ hesaplıyordu:
   * Ambarlar araştırmasını bitiren oyuncu ekranda 45.000 kapasite
   * görüyor ama kaynağı 32.000'de duruyordu. Aynı tavanın iki farklı
   * yerde iki farklı çıkması, tam da bu dosyanın kaçındığı şey.
   */
  arastirma?: ArastirmaBonusu;
  hourlyIncome: Resources;
  upkeepPerHour: number;
  lastTickAt: Date;
  now: Date;
}

export interface AccrualResult {
  resources: Resources;
  hoursElapsed: number;
  starving: boolean;
  /** Açlık yüzünden firar eden birim oranı (0 = firar yok). */
  desertionRate: number;
}

/**
 * lastTickAt'ten şimdiye kadar geçen sürenin üretimini uygular.
 * Depo kapasitesini aşmaz; erzak negatife düşerse açlık bayrağı kalkar.
 */
export function accrue(input: AccrualInput): AccrualResult {
  const ms = input.now.getTime() - input.lastTickAt.getTime();
  const hours = Math.max(0, ms / 3_600_000);
  const cap = storageCapacity(input.lordLevel, input.arastirma, input.binalar);

  const gained: Resources = {
    altin: input.hourlyIncome.altin * hours,
    demir: input.hourlyIncome.demir * hours,
    erzak: (input.hourlyIncome.erzak - input.upkeepPerHour) * hours,
  };

  const next: Resources = {
    altin: Math.min(cap, input.current.altin + gained.altin),
    demir: Math.min(cap, input.current.demir + gained.demir),
    erzak: Math.min(cap, input.current.erzak + gained.erzak),
  };

  const starving = next.erzak < 0;
  if (starving) next.erzak = 0;

  // Erzak biterse ordu saatte %5 firar eder.
  const rate = B.erzak_acligi.saatlik_firar_orani;
  const desertionRate = starving ? 1 - Math.pow(1 - rate, Math.min(hours, 24)) : 0;

  return {
    resources: {
      altin: Math.floor(next.altin),
      demir: Math.floor(next.demir),
      erzak: Math.floor(next.erzak),
    },
    hoursElapsed: hours,
    starving,
    desertionRate,
  };
}

/**
 * Erzak tükenmesine kaç SAAT kaldığı. Akış artıdaysa ya da zaten bittiyse null.
 *
 * Neden var: kaynak çubuğu "azalıyor" diyordu ve bu bir uyarı değil bir
 * gözlemdi. Oyuncu ne zaman biteceğini ve bitince ne olacağını bilmeden
 * karar veremez — "altı saat sonra biter, sonra saatte %5 firar" ise bir
 * plan. Mekanik zaten vardı (`accrue` → `starving` → `applyDesertion`),
 * yalnız söylenmiyordu.
 *
 * Sayı MOTORDAN geliyor, arayüzde yeniden hesaplanmıyor: aynı bölmeyi iki
 * yere yazmak er ya da geç ikisini ayırır.
 */
export function erzakTukenmesiSaat(stok: number, saatlikNet: number): number | null {
  if (saatlikNet >= 0) return null;
  if (stok <= 0) return null; // zaten bitti; orası açlık hâli, uyarı değil
  return stok / -saatlikNet;
}

/** Aç ordunun saatlik firar oranı (0–1). Uyarı metni bunu söylüyor. */
export const ERZAK_FIRAR_ORANI: number = B.erzak_acligi.saatlik_firar_orani;

/** Açlık firarını orduya uygular. Her birim tipinden en az 1 kalır. */
export function applyDesertion(army: Army, rate: number): Army {
  if (rate <= 0) return army;
  const next: Army = {};
  for (const t of UNIT_TYPES) {
    const c = army[t] ?? 0;
    if (c <= 0) continue;
    next[t] = Math.max(1, Math.floor(c * (1 - rate)));
  }
  return next;
}

/** Bölgenin yağmalanabilir deposunun saatlik birikimi (bölgede tutulur). */
export function regionStoreGrowth(income: Resources, hours: number): Resources {
  return kaynakCarp(income, hours);
}
