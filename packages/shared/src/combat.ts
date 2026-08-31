/**
 * Savaş simülatörü.
 *
 * KESİN KURALLAR (docs/03 §5):
 *   1. SAF fonksiyon: aynı girdi + aynı seed -> her zaman aynı sonuç.
 *   2. Date.now(), Math.random(), veritabanı YASAK.
 *   3. Seed savaş kaydında saklanır; her savaş sonsuza dek yeniden üretilebilir.
 *   4. İstemci önizleme için aynı fonksiyonu çağırır; sunucunun sonucu otoritedir.
 */
import { B, carryCapacityPerUnit, counterMultiplier, unit } from './balance.js';
import { createRng } from './rng.js';
import type { Army, BattleResult, Resources, RoundLog, Side, UnitType } from './types.js';
import { UNIT_TYPES } from './types.js';

export interface BattleContext {
  /** Savunanın yağmalanabilir deposu. */
  defenderStore: Resources;
  /** Saldıran lordun Kurnazlık statı (yağmayı artırır). */
  attackerCunning: number;
  /** Bölge ele geçirilebilir mi (ör. Taht Kalesi hep evet, yağma akını hayır). */
  canCapture: boolean;
}

export function armyCount(army: Army): number {
  return UNIT_TYPES.reduce((s, t) => s + (army[t] ?? 0), 0);
}

export function cloneArmy(army: Army): Army {
  const out: Army = {};
  for (const t of UNIT_TYPES) if ((army[t] ?? 0) > 0) out[t] = army[t];
  return out;
}

/**
 * Bir tarafın ham saldırı gücü.
 * Mancınık canlı birime karşı zayıf, kaleye karşı güçlüdür; bu yüzden kale
 * bonusuna göre ölçeklenir (0 tahkimat -> ×0.5, Taht Kalesi -> ×2.0).
 */
function attackPower(side: Side, enemy: Side): number {
  let total = 0;
  for (const t of UNIT_TYPES) {
    const count = side.units[t] ?? 0;
    if (count <= 0) continue;
    const u = unit(t);

    let mult = 1;
    if (t === 'kusatma') {
      const maxFort = B.bolgeler.kale_savunma_bonusu.taht;
      const norm = maxFort > 0 ? Math.min(1, enemy.fortressBonus / maxFort) : 0;
      const vsUnit = B.birim_kars_carpanlari.kusatma.birim;
      const vsFort = B.birim_kars_carpanlari.kusatma.kale_savunmasi;
      mult = vsUnit + (vsFort - vsUnit) * norm;
    } else {
      // Karşı üçgeni: düşman bileşimine göre ağırlıklı ortalama
      const enemyTotal = armyCount(enemy.units);
      if (enemyTotal > 0) {
        let weighted = 0;
        for (const e of UNIT_TYPES) {
          const ec = enemy.units[e] ?? 0;
          if (ec > 0) weighted += (ec / enemyTotal) * counterMultiplier(t, e);
        }
        mult = weighted;
      }
    }

    const unitBonus = 1 + (side.generalBonus.birimSaldiri[t] ?? 0);
    total += count * u.saldiri * mult * unitBonus;
  }

  total *= 1 + side.gearBonus.saldiri;
  total *= 1 + side.generalBonus.orduSaldiri;
  total *= 1 + side.leadership * B.savas.liderlik_savas_carpani;
  total += side.lordContribution * (1 + side.generalBonus.lordSavasKatkisi);
  return total;
}

/** Bir tarafın ham savunma gücü. Kale bonusu sadece savunanda geçerlidir. */
function defensePower(side: Side, enemy: Side): number {
  let total = 0;
  for (const t of UNIT_TYPES) {
    const count = side.units[t] ?? 0;
    if (count <= 0) continue;
    const u = unit(t);

    // Savunmada karşı çarpanı: düşmanın hangi birimine karşı duruyoruz
    let mult = 1;
    const enemyTotal = armyCount(enemy.units);
    if (enemyTotal > 0) {
      let weighted = 0;
      for (const e of UNIT_TYPES) {
        const ec = enemy.units[e] ?? 0;
        if (ec > 0) weighted += (ec / enemyTotal) * counterMultiplier(t, e);
      }
      mult = weighted;
    }

    const unitBonus = 1 + (side.generalBonus.birimSavunma[t] ?? 0);
    total += count * u.savunma * mult * unitBonus;
  }

  total *= 1 + side.gearBonus.savunma;
  total *= 1 + side.generalBonus.orduSavunma;
  if (side.isDefender) {
    total *= 1 + side.generalBonus.savunmadaOrduSavunma;
    // Kuşatma Ustası Tarık savunanın tahkimatını deler
    const fort = side.fortressBonus * (1 - Math.min(0.9, enemy.generalBonus.kaleDelme));
    total *= 1 + fort;
  }
  return total;
}

/**
 * Kayıpları birim tiplerine dağıtır.
 * Ağırlık = adet / (can + savunma): ucuz ve kırılgan birimler önce ölür.
 * Köylü Milis'in "et kalkanı" rolü bu tek satırdan doğar.
 */
function distributeLosses(army: Army, lossFraction: number): Army {
  const total = armyCount(army);
  if (total <= 0 || lossFraction <= 0) return {};

  let targetLosses = Math.round(total * lossFraction);
  if (targetLosses <= 0) return {};
  if (targetLosses > total) targetLosses = total;

  const weights: { type: UnitType; w: number; count: number }[] = [];
  let wSum = 0;
  for (const t of UNIT_TYPES) {
    const c = army[t] ?? 0;
    if (c <= 0) continue;
    const u = unit(t);
    const w = c / (u.can + u.savunma);
    weights.push({ type: t, w, count: c });
    wSum += w;
  }
  if (wSum <= 0) return {};

  const losses: Army = {};
  let assigned = 0;
  for (const { type, w, count } of weights) {
    const share = Math.min(count, Math.floor((targetLosses * w) / wSum));
    if (share > 0) {
      losses[type] = share;
      assigned += share;
    }
  }

  // Yuvarlama artığını en kalabalık tipten tamamla (deterministik sıra)
  let leftover = targetLosses - assigned;
  for (const { type, count } of [...weights].sort((a, b) => b.count - a.count)) {
    if (leftover <= 0) break;
    const already = losses[type] ?? 0;
    const room = count - already;
    const take = Math.min(room, leftover);
    if (take > 0) {
      losses[type] = already + take;
      leftover -= take;
    }
  }
  return losses;
}

function subtractArmy(army: Army, losses: Army): Army {
  const out: Army = {};
  for (const t of UNIT_TYPES) {
    const remaining = (army[t] ?? 0) - (losses[t] ?? 0);
    if (remaining > 0) out[t] = remaining;
  }
  return out;
}

function scaleArmy(army: Army, factor: number): Army {
  const out: Army = {};
  for (const t of UNIT_TYPES) {
    const v = Math.round((army[t] ?? 0) * factor);
    if (v > 0) out[t] = v;
  }
  return out;
}

function carryCapacity(army: Army): number {
  return UNIT_TYPES.reduce((s, t) => s + (army[t] ?? 0) * carryCapacityPerUnit(t), 0);
}

/**
 * Yağma: savunanın deposunun %25'i, taşıma kapasitesiyle sınırlı.
 *
 * Yağma bonusu (Kurnazlık + Casus Leyla) hem alınan oranı hem TAŞIMA
 * kapasitesini artırır. Sadece oranı artırsaydı, zengin bir hedefe yapılan
 * büyük akında kapasite tavana vurur ve bonus tamamen etkisiz kalırdı.
 */
export function calculateLoot(
  store: Resources,
  survivors: Army,
  cunning: number,
  lootBonus: number,
): Resources {
  const plunderBonus = 1 + cunning * 0.01 + lootBonus;
  const rate = B.savas.yagma_orani * plunderBonus;
  const wanted: Resources = {
    altin: store.altin * rate,
    demir: store.demir * rate,
    erzak: store.erzak * rate,
  };
  const wantedTotal = wanted.altin + wanted.demir + wanted.erzak;
  if (wantedTotal <= 0) return { altin: 0, demir: 0, erzak: 0 };

  const capacity = carryCapacity(survivors) * plunderBonus;
  const scale = Math.min(1, capacity / wantedTotal);
  return {
    altin: Math.floor(wanted.altin * scale),
    demir: Math.floor(wanted.demir * scale),
    erzak: Math.floor(wanted.erzak * scale),
  };
}

/**
 * Savaşı çözer.
 *
 * 5 tur boyunca her iki tarafın gücü seed'li ±%7 varyansla hesaplanır; turların
 * ortalaması sonucu belirler. Böylece sonuç ne saf zar ne de hesap makinesidir:
 * güçlü taraf ~%95 kazanır ama hiçbir savaş garantili değildir.
 */
export function simulateBattle(
  attacker: Side,
  defender: Side,
  seed: string,
  ctx: BattleContext,
): BattleResult {
  const rng = createRng(seed);
  const rounds: RoundLog[] = [];
  const roundCount = B.savas.tur_sayisi;
  const band = 0.07;

  const baseAtk = attackPower(attacker, defender);
  const baseDef = defensePower(defender, attacker);

  let rSum = 0;
  for (let i = 0; i < roundCount; i++) {
    let a = baseAtk * rng.variance(band);
    let d = baseDef * rng.variance(band);

    // İlk tur yetenekleri
    if (i === 0) {
      a *= 1 + (attacker.abilities?.on_hasar_orani ?? 0);
      a *= 1 + (attacker.abilities?.ilk_tur_saldiri ?? 0);
      d *= 1 + (defender.abilities?.ilk_tur_hasar_azaltma ?? 0);
    }

    const r = a + d > 0 ? a / (a + d) : 0.5;
    rSum += r;
    rounds.push({
      tur: i + 1,
      saldiranGuc: Math.round(a),
      savunanGuc: Math.round(d),
      saldiranKayip: {},
      savunanKayip: {},
    });
  }

  const R = rSum / roundCount;
  const attackerWins = R > 0.5;
  const Rw = Math.max(R, 1 - R);

  const winnerLoss = Math.min((1 - Rw) * 0.7, B.savas.kayip.kazanan_max);
  const loserLoss = Math.min(0.6 + (Rw - 0.5) * 0.6, B.savas.kayip.kaybeden_max);

  const attackerFraction = attackerWins ? winnerLoss : loserLoss;
  const defenderFraction = attackerWins ? loserLoss : winnerLoss;

  let attackerLosses = distributeLosses(attacker.units, attackerFraction);
  let defenderLosses = distributeLosses(defender.units, defenderFraction);

  // Vaiz Bertan: kazananın kayıplarının bir kısmı yaralı olarak geri döner
  const winnerSide = attackerWins ? attacker : defender;
  const recovery = winnerSide.generalBonus.kayipGeriDonus;
  if (recovery > 0) {
    if (attackerWins) attackerLosses = scaleArmy(attackerLosses, 1 - recovery);
    else defenderLosses = scaleArmy(defenderLosses, 1 - recovery);
  }

  const attackerSurvivors = subtractArmy(attacker.units, attackerLosses);
  const defenderSurvivors = subtractArmy(defender.units, defenderLosses);

  // Kayıpları tur tur dağıt (yalnızca log görünümü için)
  for (let i = 0; i < rounds.length; i++) {
    const share = (i + 1) / rounds.length;
    rounds[i]!.saldiranKayip = scaleArmy(attackerLosses, share);
    rounds[i]!.savunanKayip = scaleArmy(defenderLosses, share);
  }

  const captureThreshold = B.savas.bolge_ele_gecirme.ele_gecirme_esigi;
  const captured =
    ctx.canCapture && attackerWins && R >= captureThreshold && armyCount(attackerSurvivors) > 0;

  const loot =
    attackerWins && armyCount(attackerSurvivors) > 0
      ? calculateLoot(
          ctx.defenderStore,
          attackerSurvivors,
          ctx.attackerCunning,
          attacker.generalBonus.yagma,
        )
      : { altin: 0, demir: 0, erzak: 0 };

  return {
    winner: attackerWins ? 'attacker' : 'defender',
    rounds,
    attackerLosses,
    defenderLosses,
    attackerSurvivors,
    defenderSurvivors,
    captured,
    loot,
    seed,
  };
}
