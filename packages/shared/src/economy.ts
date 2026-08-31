/**
 * Kaynak üretimi, depo, ordu bakımı.
 *
 * Merkezî teknik karar: "lazy accrual". Sunucu periyodik gelir tick'i
 * ÇALIŞTIRMAZ. Her kayıtta lastTickAt tutulur ve kayda dokunulduğunda geçen
 * süre kadar üretim eklenir. 120 oyuncu için de 120.000 için de maliyet aynıdır.
 */
import { B, regionBaseIncome, unit } from './balance.js';
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
export function malikaneIncome(lordLevel: number): Resources {
  const t = B.kaynaklar.malikane_saatlik;
  const b = B.kaynaklar.malikane_seviye_bonusu_saatlik;
  return {
    altin: t.altin + b.altin * lordLevel,
    demir: t.demir + b.demir * lordLevel,
    erzak: t.erzak + b.erzak * lordLevel,
  };
}

/** Bir bölgenin saatlik üretimi. */
export function regionIncome(
  type: string,
  level: number,
  incomeMult: number,
  generalBonus?: GeneralBonus,
): Resources & { sohret: number } {
  const base = regionBaseIncome(type);
  const levelMult = 1 + B.bolgeler.seviye_basina_gelir * (level - 1);
  const bonus = 1 + (generalBonus?.bolgeGeliri ?? 0);
  const f = incomeMult * levelMult * bonus;
  return {
    altin: (base.altin ?? 0) * f,
    demir: (base.demir ?? 0) * f,
    erzak: (base.erzak ?? 0) * f,
    sohret: (base.sohret_saat ?? 0) * levelMult,
  };
}

export function storageCapacity(lordLevel: number): number {
  return B.kaynaklar.depo_kapasitesi.taban + B.kaynaklar.depo_kapasitesi.lord_seviye_basina * lordLevel;
}

/** Ordunun saatlik erzak gideri. */
export function upkeepPerHour(army: Army, generalBonus?: GeneralBonus): number {
  const raw = UNIT_TYPES.reduce((s, t) => s + (army[t] ?? 0) * unit(t).bakim_erzak_saat, 0);
  return raw * (1 + (generalBonus?.bakimMaliyeti ?? 0));
}

export interface AccrualInput {
  current: Resources;
  lordLevel: number;
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
  const cap = storageCapacity(input.lordLevel);

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
