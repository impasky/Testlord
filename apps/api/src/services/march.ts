/**
 * Yürüyüş çözümü: saldırı savaşı ve dönüş.
 *
 * Savaşın kendisi packages/shared/combat.ts'te SAF bir fonksiyondur; burası
 * sadece veritabanı tarafını yapar: tarafları kurar, sonucu yazar, XP/ELO
 * dağıtır, bölgeyi devreder.
 */
import {
  B,
  UNIT_TYPES,
  abilityValue,
  aggregateGeneralBonus,
  armyCount,
  battleXp,
  bosGeneralBonus,
  captureXp,
  createRng,
  generalKatkilari,
  generalLevelFromXp,
  lordContribution,
  marchDurationSec,
  npcClearXp,
  simulateBattle,
  updateElo,
  type Army,
  type EquipSlot,
  type GeneralKatkisi,
  type Rarity,
  type Side,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { equippedGenerals, gearBonusFrom, grantXp, pushEvent, tickLord } from './lord.js';
import { addUnitsHome } from './queue.js';
import { regionFortressBonus, transferRegion } from './region.js';

function toArmy(value: unknown): Army {
  const raw = (value ?? {}) as Record<string, unknown>;
  const army: Army = {};
  for (const t of UNIT_TYPES) {
    const n = Number(raw[t] ?? 0);
    if (Number.isFinite(n) && n > 0) army[t] = Math.floor(n);
  }
  return army;
}

/**
 * Bir lordun savaş tarafını kurar (ekipman, donanım, generaller dahil).
 *
 * Sahadaki generallerin katkısı da dönüyor: savaş kaydına yazılacak ve
 * raporda oyuncuya hangi generalin ne kattığı gösterilecek.
 */
async function buildSide(
  lordId: string,
  units: Army,
  isDefender: boolean,
  fortress: number,
  generalKeys: string[] | null,
  tx: Tx,
): Promise<{ side: Side; generaller: GeneralKatkisi[] }> {
  const lord = await tx.lord.findUnique({
    where: { id: lordId },
    include: { items: true, gearLines: true, generals: true },
  });
  if (!lord) throw new Error(`Lord bulunamadı: ${lordId}`);

  const now = new Date();
  const sahada = equippedGenerals(lord.generals, now).filter(
    (g) => !generalKeys || generalKeys.includes(g.key),
  );
  const bonus = sahada.length ? aggregateGeneralBonus(sahada) : bosGeneralBonus();

  const items = lord.items
    .filter((i) => i.equipped)
    .map((i) => ({
      slot: i.slot as EquipSlot,
      tier: i.tier,
      rarity: i.rarity as Rarity,
      upgradeLevel: i.upgradeLevel,
    }));

  // Yaralı lord savunmada yarım katkı verir
  const yarali = lord.woundedUntil && lord.woundedUntil > now;
  const katki = lordContribution(lord.guc, items) * (yarali ? 0.5 : 1);

  return {
    side: {
      units,
      gearBonus: gearBonusFrom(lord.gearLines),
      generalBonus: bonus,
      lordContribution: katki,
      leadership: lord.liderlik,
      fortressBonus: fortress,
      isDefender,
      abilities: {
        on_hasar_orani: abilityValue(sahada, 'on_hasar_orani'),
        ilk_tur_saldiri: abilityValue(sahada, 'ilk_tur_saldiri'),
        ilk_tur_hasar_azaltma: abilityValue(sahada, 'ilk_tur_hasar_azaltma'),
      },
    },
    generaller: generalKatkilari(sahada),
  };
}

/** NPC garnizonu için taraf: lordu yok, sadece birimler ve tahkimat. */
function npcSide(units: Army, fortress: number): Side {
  return {
    units,
    gearBonus: { saldiri: 0, savunma: 0, can: 0 },
    generalBonus: bosGeneralBonus(),
    lordContribution: 0,
    leadership: 0,
    fortressBonus: fortress,
    isDefender: true,
  };
}

/** Bölgedeki garnizonu okur. */
async function readGarrison(regionId: number, ownerId: string, tx: Tx): Promise<Army> {
  const rows = await tx.armyUnit.findMany({
    where: { lordId: ownerId, locationType: 'region', locationId: String(regionId) },
  });
  const army: Army = {};
  for (const r of rows) army[r.unitType as UnitType] = r.count;
  return army;
}

/** Garnizonu verilen orduya eşitler; fazlası silinir. */
async function writeGarrison(
  regionId: number,
  ownerId: string,
  army: Army,
  tx: Tx,
): Promise<void> {
  const rows = await tx.armyUnit.findMany({
    where: { lordId: ownerId, locationType: 'region', locationId: String(regionId) },
  });
  for (const r of rows) {
    const kalan = army[r.unitType as UnitType] ?? 0;
    if (kalan <= 0) await tx.armyUnit.delete({ where: { id: r.id } });
    else await tx.armyUnit.update({ where: { id: r.id }, data: { count: kalan } });
  }
}

/**
 * Savaşa katılan generallere XP verir ve kaybeden tarafta dinlenmeye gönderir.
 * General XP'si lordun kazandığı XP'nin %40'ıdır (generals.json).
 */
async function generalleriOdullendir(
  lordId: string,
  lordXp: number,
  kaybettiMi: boolean,
  seed: string,
  tx: Tx,
): Promise<void> {
  const sahada = await tx.lordGeneral.findMany({
    where: { lordId, slotIndex: { not: null } },
  });
  if (sahada.length === 0) return;

  const rng = createRng(`general-${seed}`);
  const kazanilan = Math.round(lordXp * 0.4);

  for (const g of sahada) {
    const { level, xpIntoLevel } = generalLevelFromXp(
      toplamGeneralXp(g.level, g.xp) + kazanilan,
    );
    // Kaybedilen savaşta %25 ihtimalle general 6 saat dinlenmeye girer
    const dinlenir = kaybettiMi && rng.next() < 0.25;
    await tx.lordGeneral.update({
      where: { id: g.id },
      data: {
        level,
        xp: xpIntoLevel,
        ...(dinlenir ? { restUntil: new Date(Date.now() + 6 * 3_600_000) } : {}),
      },
    });
    if (dinlenir) {
      await pushEvent(
        lordId,
        'general_dinleniyor',
        { mesaj: `${g.generalKey} savaşta yaralandı, 6 saat dinlenecek.` },
        tx,
      );
    }
  }
}

/** generalLevelFromXp toplam XP bekler; kayıtta seviye + seviyedeki ilerleme tutulur. */
function toplamGeneralXp(level: number, xpIntoLevel: number): number {
  let toplam = xpIntoLevel;
  for (let n = 1; n < level; n++) toplam += Math.round(200 * Math.pow(n, 1.4));
  return toplam;
}

/**
 * Bir yürüyüşü çözer. İdempotent: satırı koşullu updateMany ile alır.
 * Dönüş: işlendi mi.
 */
export async function resolveMarch(marchId: string): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const claimed = await tx.march.updateMany({
        where: { id: marchId, resolved: false },
        data: { resolved: true },
      });
      if (claimed.count === 0) return false;

      const march = await tx.march.findUniqueOrThrow({ where: { id: marchId } });
      const army = toArmy(march.army);

      // Yürüyüşteki birim satırlarını temizle
      await tx.armyUnit.deleteMany({ where: { locationType: 'march', locationId: marchId } });

      if (march.kind === 'return') {
        for (const t of UNIT_TYPES) {
          const c = army[t] ?? 0;
          if (c > 0) await addUnitsHome(march.lordId, t, c, tx);
        }
        const loot = march.loot as { altin?: number; demir?: number; erzak?: number } | null;
        if (loot) {
          await tickLord(march.lordId, new Date(), tx);
          await tx.lord.update({
            where: { id: march.lordId },
            data: {
              altin: { increment: Math.round(loot.altin ?? 0) },
              demir: { increment: Math.round(loot.demir ?? 0) },
              erzak: { increment: Math.round(loot.erzak ?? 0) },
            },
          });
        }
        await pushEvent(
          march.lordId,
          'ordu_dondu',
          {
            mesaj: `Ordun eve döndü (${armyCount(army)} birim)${
              loot ? `, yağma: ${Math.round(loot.altin ?? 0)} altın` : ''
            }.`,
          },
          tx,
        );
        return true;
      }

      // --- Saldırı ---
      const region = await tx.region.findUniqueOrThrow({ where: { id: march.toRegionId } });
      const fortress = regionFortressBonus(region.type, region.level);
      const generalKeys = (march.generalIds as string[]) ?? [];

      const { side: attacker, generaller: saldiranGeneraller } = await buildSide(
        march.lordId, army, false, 0, generalKeys, tx,
      );

      const npcGarrison = toArmy(region.npcGarrison);
      const defenderLordId = region.ownerLordId;
      const defenderArmy = defenderLordId
        ? await readGarrison(region.id, defenderLordId, tx)
        : npcGarrison;

      // NPC garnizonunun generali yok; boş liste dönüyor ki rapor iki
      // tarafı da aynı şekilde okuyabilsin.
      const savunanKurulum = defenderLordId
        ? await buildSide(defenderLordId, defenderArmy, true, fortress, null, tx)
        : { side: npcSide(defenderArmy, fortress), generaller: [] as GeneralKatkisi[] };
      const defender = savunanKurulum.side;
      const savunanGeneraller = savunanKurulum.generaller;

      const seed = `battle-${marchId}`;
      const result = simulateBattle(attacker, defender, seed, {
        defenderStore: {
          altin: region.storeAltin,
          demir: region.storeDemir,
          erzak: region.storeErzak,
        },
        attackerCunning: (
          await tx.lord.findUniqueOrThrow({
            where: { id: march.lordId },
            select: { kurnazlik: true },
          })
        ).kurnazlik,
        canCapture: true,
      });

      const attackerWon = result.winner === 'attacker';

      // Savunanın kalanını yaz
      if (defenderLordId) {
        await writeGarrison(region.id, defenderLordId, result.defenderSurvivors, tx);
      } else {
        await tx.region.update({
          where: { id: region.id },
          data: { npcGarrison: result.defenderSurvivors as object },
        });
      }

      // Bölge el değiştirdiyse: sağ kalan garnizon sahibinin evine çekilir
      if (result.captured) {
        if (defenderLordId) {
          for (const t of UNIT_TYPES) {
            const c = result.defenderSurvivors[t] ?? 0;
            if (c > 0) await addUnitsHome(defenderLordId, t, c, tx);
          }
          await tx.armyUnit.deleteMany({
            where: {
              lordId: defenderLordId,
              locationType: 'region',
              locationId: String(region.id),
            },
          });
        }
        await transferRegion(region.id, march.lordId, tx);
        await tx.region.update({
          where: { id: region.id },
          data: {
            storeAltin: Math.max(0, region.storeAltin - result.loot.altin),
            storeDemir: Math.max(0, region.storeDemir - result.loot.demir),
            storeErzak: Math.max(0, region.storeErzak - result.loot.erzak),
          },
        });
      } else {
        await tx.region.update({
          where: { id: region.id },
          data: {
            storeAltin: Math.max(0, region.storeAltin - result.loot.altin),
            storeDemir: Math.max(0, region.storeDemir - result.loot.demir),
            storeErzak: Math.max(0, region.storeErzak - result.loot.erzak),
          },
        });
      }

      // XP, ELO, yaralanma
      const attackerLord = await tx.lord.findUniqueOrThrow({
        where: { id: march.lordId },
        select: { level: true, elo: true, dayaniklilik: true },
      });

      if (defenderLordId) {
        const defenderLord = await tx.lord.findUniqueOrThrow({
          where: { id: defenderLordId },
          select: { level: true, elo: true, dayaniklilik: true },
        });
        await grantXp(march.lordId, battleXp(defenderLord.level, attackerWon), tx);
        await grantXp(defenderLordId, battleXp(attackerLord.level, !attackerWon), tx);

        await tx.lord.update({
          where: { id: march.lordId },
          data: {
            elo: updateElo(attackerLord.elo, defenderLord.elo, attackerWon),
            ...(attackerWon ? { pvpWins: { increment: 1 } } : { pvpLosses: { increment: 1 } }),
          },
        });
        await tx.lord.update({
          where: { id: defenderLordId },
          data: {
            elo: updateElo(defenderLord.elo, attackerLord.elo, !attackerWon),
            ...(attackerWon ? { pvpLosses: { increment: 1 } } : { pvpWins: { increment: 1 } }),
          },
        });

        // Kaybeden lord yaralanır (Dayanıklılık süreyi kısaltır)
        const kaybedenId = attackerWon ? defenderLordId : march.lordId;
        const kaybedenDay = attackerWon ? defenderLord.dayaniklilik : attackerLord.dayaniklilik;
        const azalt = Math.min(0.5, kaybedenDay * 0.01);
        const saat = B.lord.yaralanma.kaybedilen_savasta_saat * (1 - azalt);
        await tx.lord.update({
          where: { id: kaybedenId },
          data: { woundedUntil: new Date(Date.now() + saat * 3_600_000) },
        });

        await generalleriOdullendir(
          march.lordId,
          battleXp(defenderLord.level, attackerWon),
          !attackerWon,
          `${seed}-atk`,
          tx,
        );
        await generalleriOdullendir(
          defenderLordId,
          battleXp(attackerLord.level, !attackerWon),
          attackerWon,
          `${seed}-def`,
          tx,
        );

      } else {
        // NPC garnizonu
        const npcXp = npcClearXp(armyCount(defenderArmy));
        await grantXp(march.lordId, npcXp, tx);
        await generalleriOdullendir(march.lordId, npcXp, !attackerWon, `${seed}-npc`, tx);
      }

      if (result.captured) {
        await grantXp(march.lordId, captureXp(region.incomeMult), tx);
        await pushEvent(
          march.lordId,
          'bolge_aldin',
          { mesaj: `${region.name} ele geçirildi!`, regionId: region.id },
          tx,
        );
      }

      const battle = await tx.battle.create({
        data: {
          worldId: march.worldId,
          regionId: region.id,
          attackerLordId: march.lordId,
          defenderLordId,
          seed,
          result: attackerWon ? 'attacker_win' : 'defender_win',
          captured: result.captured,
          log: {
            rounds: result.rounds,
            attackerLosses: result.attackerLosses,
            defenderLosses: result.defenderLosses,
            attackerSurvivors: result.attackerSurvivors,
            defenderSurvivors: result.defenderSurvivors,
            loot: result.loot,
            regionName: region.name,
            attackerGenerals: saldiranGeneraller,
            defenderGenerals: savunanGeneraller,
          } as object,
        },
      });

      // Savunanın olayı bilerek burada: battle.create'ten önce basılırsa
      // battleId olmaz ve savunan kendi savaş raporunu açamaz. Saldıranın
      // olayı zaten aşağıda, aynı sebeple.
      if (defenderLordId) {
        await pushEvent(
          defenderLordId,
          attackerWon ? 'bolge_kaybettin' : 'saldiriya_ugradin',
          {
            mesaj: attackerWon
              ? `${region.name} saldırıya uğradı ve ${result.captured ? 'kaybedildi' : 'yağmalandı'}.`
              : `${region.name} savunuldu. Saldırı püskürtüldü.`,
            regionId: region.id,
            battleId: battle.id,
          },
          tx,
        );
      }

      // Sağ kalanlar eve döner
      const survivors = result.attackerSurvivors;
      if (armyCount(survivors) > 0) {
        const home = await tx.region.findFirst({
          where: { worldId: march.worldId, ownerLordId: march.lordId },
          select: { q: true, r: true },
        });
        void home;
        const donusSn = marchDurationSec(
          Math.max(1, Math.round((march.arriveAt.getTime() - march.departAt.getTime()) / 60000 / 12)),
          survivors,
          attacker.generalBonus,
        );
        const now = new Date();
        const ret = await tx.march.create({
          data: {
            worldId: march.worldId,
            lordId: march.lordId,
            fromRegionId: region.id,
            toRegionId: region.id,
            kind: 'return',
            army: survivors as object,
            generalIds: generalKeys as object,
            loot: result.loot as object,
            departAt: now,
            arriveAt: new Date(now.getTime() + donusSn * 1000),
          },
        });
        for (const t of UNIT_TYPES) {
          const c = survivors[t] ?? 0;
          if (c > 0) {
            await tx.armyUnit.create({
              data: {
                lordId: march.lordId,
                unitType: t,
                count: c,
                locationType: 'march',
                locationId: ret.id,
              },
            });
          }
        }
      }

      await pushEvent(
        march.lordId,
        attackerWon ? 'savas_kazandin' : 'savas_kaybettin',
        {
          mesaj: `${region.name}: ${attackerWon ? 'zafer' : 'yenilgi'}. ${
            result.captured ? 'Bölge senin.' : ''
          }`,
          battleId: battle.id,
        },
        tx,
      );

      return true;
    },
    { timeout: 20_000 },
  );
}
