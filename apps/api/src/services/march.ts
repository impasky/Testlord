/**
 * Yürüyüş çözümü: saldırı savaşı ve dönüş.
 *
 * Savaşın kendisi packages/shared/combat.ts'te SAF bir fonksiyondur; burası
 * sadece veritabanı tarafını yapar: tarafları kurar, sonucu yazar, XP/ELO
 * dağıtır, bölgeyi devreder.
 */
import {
  liderAviGecerliMi,
  B,
  UNIT_TYPES,
  abilityValue,
  aggregateGeneralBonus,
  armyCount,
  battleXp,
  bosGeneralBonus,
  captureXp,
  createRng,
  generalDef,
  generalKatkilari,
  generalLevelMultiplier,
  generalSavasSonrasi,
  ayniIttifaktaMi,
  garnizonToplami,
  generalYaralanma,
  kayipPaylastir,
  lordContribution,
  orduDus,
  marchDurationSec,
  npcClearXp,
  simulateBattle,
  updateElo,
  type Army,
  type EquipSlot,
  type GarnizonPayi,
  type GeneralKatkisi,
  type GeneralYukselisi,
  type Rarity,
  type Side,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { env } from '../env.js';
import { postaGonder } from './eposta.js';
import {
  calcHourlyIncome,
  equippedGenerals,
  gearBonusFrom,
  grantXp,
  pushEvent,
  tickLord,
} from './lord.js';
import { addUnitsHome, addUnitsRegion } from './queue.js';
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

/**
 * Bölgedeki BÜTÜN orduları sahipleriyle birlikte okur.
 *
 * Takviyeden sonra bir garnizon birden çok lorda ait olabiliyor
 * (docs/01 §7d). Savaşa giren şey toplamı; kayıp da sahiplerine
 * katkıları oranında dağıtılıyor.
 *
 * Sıralama lordId'ye göre sabit: kayıp dağıtımı kararlı olmak zorunda,
 * yoksa aynı savaş yeniden oynatıldığında farklı sonuç verir ve seed'li
 * RNG'nin bütün amacı boşa gider.
 */
async function readGarrisonPaylari(regionId: number, tx: Tx): Promise<GarnizonPayi[]> {
  const rows = await tx.armyUnit.findMany({
    where: { locationType: 'region', locationId: String(regionId) },
    orderBy: [{ lordId: 'asc' }, { unitType: 'asc' }],
  });
  const map = new Map<string, Army>();
  for (const r of rows) {
    const ordu = map.get(r.lordId) ?? {};
    ordu[r.unitType as UnitType] = (ordu[r.unitType as UnitType] ?? 0) + r.count;
    map.set(r.lordId, ordu);
  }
  return [...map.entries()].map(([lordId, ordu]) => ({ lordId, ordu }));
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
 *
 * XP payı ve yaralanma sayıları generals.json'da; buradaki iş sadece
 * veritabanı tarafı. Dönüş, bu savaşta SEVİYE ATLAYAN generaller: motor
 * seviyeyi zaten hesaplıyordu ama kimseye söylemiyordu, oyuncu güçlendiği
 * anı hiç görmüyordu (docs/09 §2.3).
 */
async function generalleriOdullendir(
  lordId: string,
  lordXp: number,
  kaybettiMi: boolean,
  seed: string,
  tx: Tx,
): Promise<GeneralYukselisi[]> {
  const sahada = await tx.lordGeneral.findMany({
    where: { lordId, slotIndex: { not: null } },
  });
  if (sahada.length === 0) return [];

  const rng = createRng(`general-${seed}`);
  const yaralanma = generalYaralanma();
  const yukselenler: GeneralYukselisi[] = [];

  for (const g of sahada) {
    const sonuc = generalSavasSonrasi(g.level, g.xp, lordXp);
    const dinlenir = kaybettiMi && rng.next() < yaralanma.ihtimal;
    await tx.lordGeneral.update({
      where: { id: g.id },
      data: {
        level: sonuc.level,
        xp: sonuc.xpIntoLevel,
        ...(dinlenir
          ? { restUntil: new Date(Date.now() + yaralanma.saat * 3_600_000) }
          : {}),
      },
    });

    // Oyuncu generali adıyla tanıyor; olay akışında `casus_leyla` değil
    // "Casus Leyla" yazmalı.
    const ad = generalDef(g.generalKey)?.ad ?? g.generalKey;

    if (sonuc.atlanan > 0) {
      yukselenler.push({
        key: g.generalKey,
        ad,
        onceki: g.level,
        sonraki: sonuc.level,
        kazanilanXp: sonuc.kazanilanXp,
      });
      await pushEvent(
        lordId,
        'general_seviye',
        {
          mesaj: `${ad} seviye atladı: Sv ${g.level} → Sv ${sonuc.level}. Pasifi artık %${Math.round(
            (generalLevelMultiplier(sonuc.level) - 1) * 100,
          )} daha güçlü.`,
          generalKey: g.generalKey,
        },
        tx,
      );
    }

    if (dinlenir) {
      await pushEvent(
        lordId,
        'general_dinleniyor',
        { mesaj: `${ad} savaşta yaralandı, ${yaralanma.saat} saat dinlenecek.` },
        tx,
      );
    }
  }

  return yukselenler;
}

/**
 * Savaşın oyuncuda ne değiştirdiğini ölçmek için anlık görüntü.
 *
 * Savaş raporu eskiden "ne oldu"yu (tur tur güç, kayıp/kalan) anlatıyordu
 * ama "bu bana ne kazandırdı"yı anlatmıyordu. Oyuncu bölgeyi alıyor,
 * sayıların değiştiğini görmüyor ve "eee ne oldu şimdi" diye soruyordu.
 * Rapor artık öncesi/sonrası gösteriyor; bu fonksiyon iki ucu da ölçer.
 * (docs/08 İ2)
 */
async function lordOzeti(lordId: string, tx: Tx) {
  const lord = await tx.lord.findUniqueOrThrow({
    where: { id: lordId },
    include: { regions: true, generals: true },
  });
  const sahada = equippedGenerals(lord.generals, new Date());
  const bonus = sahada.length ? aggregateGeneralBonus(sahada) : bosGeneralBonus();
  const { income } = calcHourlyIncome(
    lord.level,
    lord.regions.map((r) => ({
      type: r.type,
      level: r.level,
      incomeMult: r.incomeMult,
      province: r.province,
    })),
    bonus,
  );
  // Sıra: kendisinden yüksek şöhretli kaç lord var. Dünya başına 120 satır,
  // [worldId, fame] indeksli — savaş işleminin içinde taşınabilir bir maliyet.
  const ustunde = await tx.lord.count({
    where: { worldId: lord.worldId, id: { not: lordId }, fame: { gt: lord.fame } },
  });
  return {
    sohret: lord.fame,
    sira: ustunde + 1,
    seviye: lord.level,
    gelir: {
      altin: Math.round(income.altin),
      demir: Math.round(income.demir),
      erzak: Math.round(income.erzak),
    },
    bolgeSayisi: lord.regions.filter((r) => r.type !== 'taht').length,
  };
}

/**
 * Yağma sonrası kalkan: saldıran kazandı ama bölgeyi ELE GEÇİRMEDİ.
 *
 * Kapatılan boşluk şuydu: aynı saldırgan aynı bölgeye 12 saat tekrar
 * gelemiyor (B.korumalar.ayni_saldirgan_tekrar_saldiri_saat) ama FARKLI
 * saldırganlar sınırsız zincirleyebiliyordu. Ele geçirme kalkanı da
 * (bolge_ele_gecirme_sonrasi_saat) sadece bölge el değiştirdiğinde
 * kuruluyordu. Sonuç: garnizonu kırılan oyuncu bölgeyi hâlâ elinde
 * tutuyor, sırayla gelen üç dört akınla sabaha ordusu silinmiş halde
 * kalkıyordu — oyuncunun geri dönmemesinin en büyük sebeplerinden biri
 * (docs/09 §3.6).
 *
 * Yalnızca OYUNCU bölgelerinde: NPC garnizonuna kalkan koymak erken
 * genişlemeyi yavaşlatır ve orada korunacak kimse yok.
 *
 * Var olan kalkan daha uzunsa ona dokunulmaz: uçuşta olan bir yürüyüş
 * kalkan kurulduktan sonra da inebilir, o iniş kalkanı kısaltmasın.
 *
 * Prisma update data'sına yayılmak üzere parça döner; koşul tutmazsa boş
 * nesne, yani alan hiç yazılmaz.
 */
function yagmaKalkani(
  saldiranKazandi: boolean,
  savunanLordId: string | null,
  mevcut: Date | null,
): { shieldUntil?: Date } {
  if (!saldiranKazandi || savunanLordId === null) return {};
  const bitis = new Date(Date.now() + B.korumalar.yagma_sonrasi_saat * 3_600_000);
  if (mevcut && mevcut.getTime() > bitis.getTime()) return {};
  return { shieldUntil: bitis };
}

/**
 * Bir yürüyüşü çözer. İdempotent: satırı koşullu updateMany ile alır.
 * Dönüş: işlendi mi.
 */
/**
 * Hedef, diyarın liderine mi ait?
 *
 * Lider = bu dünyada en yüksek şöhretli lord. Kendi kendine saldırılamaz,
 * ama saldıran zaten lider olsa da bonus yine geçerli: kimse kendi
 * bölgesine saldırmıyor, hedef başka birinin.
 *
 * Sorgu savaş çözümünde bir kez çalışıyor. Şöhreti sıralamak zaten
 * indeksli ve tek satır dönüyor.
 */
async function liderAviGecerli(
  worldId: string,
  defenderLordId: string | null,
  attackerLordId: string,
  tx: Tx,
): Promise<boolean> {
  if (!defenderLordId || defenderLordId === attackerLordId) return false;

  const lordSayisi = await tx.lord.count({ where: { worldId } });
  if (!liderAviGecerliMi(lordSayisi)) return false;

  const lider = await tx.lord.findFirst({
    where: { worldId },
    orderBy: { fame: 'desc' },
    select: { id: true },
  });
  return lider?.id === defenderLordId;
}

export async function resolveMarch(marchId: string): Promise<boolean> {
  const sonuc = await prisma.$transaction(
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

      // --- Takviye varışı ---
      //
      // Asker bölgeye YERLEŞİYOR ama GÖNDERENİN kalıyor: ArmyUnit satırı
      // gönderenin adına, konumu bölge. Savaşta garnizonun toplamına
      // katılıyor, kayıp katkı oranında bölünüyor, bölge el değiştirirse
      // sahibinin evine dönüyor.
      if (march.kind === 'takviye') {
        const bolge = await tx.region.findUnique({ where: { id: march.toRegionId } });
        // Yol boyunca bölge el değiştirmiş ya da müttefiklik bitmiş
        // olabilir. Asker yabancının garnizonuna KATILMAMALI: böyle bir
        // durumda ordu eve döner, kaybolmaz.
        let gecerli = false;
        if (bolge?.ownerLordId) {
          const [ben, sahip] = await Promise.all([
            tx.lord.findUnique({ where: { id: march.lordId }, select: { allianceId: true } }),
            tx.lord.findUnique({
              where: { id: bolge.ownerLordId },
              select: { allianceId: true, name: true },
            }),
          ]);
          gecerli =
            bolge.ownerLordId !== march.lordId &&
            ayniIttifaktaMi(ben?.allianceId ?? null, sahip?.allianceId ?? null);
          if (gecerli) {
            for (const t of UNIT_TYPES) {
              const c = army[t] ?? 0;
              if (c > 0) await addUnitsRegion(march.lordId, march.toRegionId, t, c, tx);
            }
            await pushEvent(
              march.lordId,
              'takviye_vardi',
              {
                mesaj: `${armyCount(army)} birim ${bolge.name} savunmasına katıldı.`,
                regionId: bolge.id,
              },
              tx,
            );
            await pushEvent(
              bolge.ownerLordId,
              'takviye_geldi',
              {
                mesaj: `${sahip?.name ? '' : ''}${bolge.name} bölgene ${armyCount(
                  army,
                )} birim takviye geldi.`,
                regionId: bolge.id,
              },
              tx,
            );
          }
        }

        if (!gecerli) {
          // Dönüş yürüyüşü: asker yolda kaybolmamalı.
          const donusSn = marchDurationSec(march.distance, army, bosGeneralBonus());
          const simdi = new Date();
          const donus = await tx.march.create({
            data: {
              worldId: march.worldId,
              lordId: march.lordId,
              fromRegionId: march.toRegionId,
              toRegionId: march.toRegionId,
              kind: 'return',
              army: army as object,
              generalIds: [] as object,
              distance: march.distance,
              departAt: simdi,
              arriveAt: new Date(simdi.getTime() + donusSn * 1000),
            },
          });
          for (const t of UNIT_TYPES) {
            const c = army[t] ?? 0;
            if (c > 0) {
              await tx.armyUnit.create({
                data: {
                  lordId: march.lordId,
                  unitType: t,
                  count: c,
                  locationType: 'march',
                  locationId: donus.id,
                },
              });
            }
          }
          await pushEvent(
            march.lordId,
            'takviye_donuyor',
            { mesaj: 'Takviyen kabul edilmedi (bölge el değiştirmiş olabilir); ordun dönüyor.' },
            tx,
          );
        }
        return true;
      }

      // --- Saldırı ---
      const region = await tx.region.findUniqueOrThrow({ where: { id: march.toRegionId } });
      // Savaştan önceki hâl; rapordaki "öncesi/sonrası" bunun üstüne kurulur.
      const saldiranOnce = await lordOzeti(march.lordId, tx);
      const savunanOnce = region.ownerLordId ? await lordOzeti(region.ownerLordId, tx) : null;
      const fortress = regionFortressBonus(region.type, region.level);
      const generalKeys = (march.generalIds as string[]) ?? [];

      const { side: attacker, generaller: saldiranGeneraller } = await buildSide(
        march.lordId, army, false, 0, generalKeys, tx,
      );

      const npcGarrison = toArmy(region.npcGarrison);
      const defenderLordId = region.ownerLordId;
      // Takviyeden sonra garnizon birden çok lorda ait olabiliyor: savaşa
      // giren şey toplamı, kayıp sahiplerine katkıları oranında dağıtılıyor.
      const garnizonPaylari = defenderLordId ? await readGarrisonPaylari(region.id, tx) : [];
      const defenderArmy = defenderLordId ? garnizonToplami(garnizonPaylari) : npcGarrison;

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
        liderAvi: await liderAviGecerli(march.worldId, defenderLordId, march.lordId, tx),
        // Yaralı dönüş yalnız oyuncu savunmasında (docs/09 §3.6).
        savunanOyuncu: defenderLordId !== null,
      });

      const attackerWon = result.winner === 'attacker';

      // Savaş kaydından ÖNCE dolduruluyor: seviye atlayışları rapora
      // girecek, rapor da aşağıda yazılıyor.
      let saldiranYukselisleri: GeneralYukselisi[];
      let savunanYukselisleri: GeneralYukselisi[] = [];

      // Savunanın kalanını yaz. Tek sahipli garnizonda bu eskisi gibi
      // çalışıyor (tek pay, kaybın tamamı ona); takviyeli garnizonda kayıp
      // katkı oranında bölünüyor ve her lordun satırı ayrı güncelleniyor.
      const savunanKalanlari = new Map<string, Army>();
      if (defenderLordId) {
        const dagitim = kayipPaylastir(result.defenderLosses, garnizonPaylari);
        for (const pay of garnizonPaylari) {
          const kalan = orduDus(pay.ordu, dagitim.get(pay.lordId) ?? {});
          savunanKalanlari.set(pay.lordId, kalan);
          await writeGarrison(region.id, pay.lordId, kalan, tx);
        }
      } else {
        await tx.region.update({
          where: { id: region.id },
          data: { npcGarrison: result.defenderSurvivors as object },
        });
      }

      // Bölge el değiştirdiyse: sağ kalan HER savunanın askeri kendi evine
      // çekilir. Takviye gönderen müttefikin askeri bölgeyle birlikte el
      // değiştirseydi, yardım etmek yardım edene ceza olurdu.
      if (result.captured) {
        if (defenderLordId) {
          for (const [lordId, kalan] of savunanKalanlari) {
            for (const t of UNIT_TYPES) {
              const c = kalan[t] ?? 0;
              if (c > 0) await addUnitsHome(lordId, t, c, tx);
            }
            await tx.armyUnit.deleteMany({
              where: { lordId, locationType: 'region', locationId: String(region.id) },
            });
          }
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
            ...yagmaKalkani(attackerWon, defenderLordId, region.shieldUntil),
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

        saldiranYukselisleri = await generalleriOdullendir(
          march.lordId,
          battleXp(defenderLord.level, attackerWon),
          !attackerWon,
          `${seed}-atk`,
          tx,
        );
        savunanYukselisleri = await generalleriOdullendir(
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
        saldiranYukselisleri = await generalleriOdullendir(
          march.lordId, npcXp, !attackerWon, `${seed}-npc`, tx,
        );
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

      // Şöhret bölge değişiminden sonra yeniden hesaplanmalı; tickLord bunu
      // yapıp lord satırına yazar, sonra özet güncel değeri okur.
      await tickLord(march.lordId, new Date(), tx);
      if (defenderLordId) await tickLord(defenderLordId, new Date(), tx);
      const saldiranSonra = await lordOzeti(march.lordId, tx);
      const savunanSonra = defenderLordId ? await lordOzeti(defenderLordId, tx) : null;

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
            // Savaş anındaki tahkimat. Bölge sonradan gelişebilir ya da
            // el değiştirebilir, o yüzden rapordan geriye dönük
            // hesaplanamaz — savaşla birlikte saklanması gerekiyor.
            // Raporun "neden" bölümü bunu kullanıyor (docs/09 K2).
            tahkimatBonusu: fortress,
            attackerGenerals: saldiranGeneraller,
            defenderGenerals: savunanGeneraller,
            // Bu savaşta seviye atlayanlar. Raporun "generalim büyüdü"
            // satırı buradan geliyor; savaştan sonra generals'e bakmak
            // hangi savaşın atlattığını söylemez.
            attackerGeneralYukselisleri: saldiranYukselisleri,
            defenderGeneralYukselisleri: savunanYukselisleri,
            // Ölü sayılıp yaralı dönenler. Kayıp sayısı zaten düşülmüş
            // hâlde yazılıyor; bu alan olmasa oyuncu daha az kayıp
            // verdiğini görür ama nedenini bilmezdi.
            yaraliDonen: result.yaraliDonen,
            sonuc: {
              saldiran: { oncesi: saldiranOnce, sonrasi: saldiranSonra },
              savunan:
                savunanOnce && savunanSonra
                  ? { oncesi: savunanOnce, sonrasi: savunanSonra }
                  : null,
            },
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
              ? result.captured
                ? `${region.name} saldırıya uğradı ve kaybedildi.`
                : `${region.name} yağmalandı ama elinde kaldı. Bölge ${B.korumalar.yagma_sonrasi_saat} saat koruma altında — garnizonu bu arada tazele.`
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
        // Mesafe yürüyüş kaydından okunur. Eskiden gidiş süresinden geri
        // türetiliyordu; ilk saldırının süresi kısaltılabilir olunca o
        // türetme yanlış mesafe veriyor (2 dakikalık gidiş "0 hex" gibi
        // okunurdu). Dönüş kısayoldan yararlanmaz: oyuncu sonucu çoktan
        // gördü, kısaltmanın anlatacağı bir şey kalmadı.
        const donusSn = marchDurationSec(
          Math.max(1, march.distance),
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
            distance: march.distance,
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

      // Savunan bir oyuncuysa posta için gereken bilgiyi dışarı taşı;
      // NPC garnizonunda bildirilecek kimse yok.
      return defenderLordId
        ? {
            defenderLordId,
            bolgeAdi: region.name,
            attackerLordId: march.lordId,
            kaybedildi: result.captured,
          }
        : true;
    },
    { timeout: 20_000 },
  );

  // Posta işlemin DIŞINDA: yavaş ve dışarıya bağımlı bir işi veritabanı
  // kilitlerinin içinde beklemek, savaşı e-posta sağlayıcısının hızına
  // bağlamak demekti.
  if (sonuc !== false && sonuc !== true) {
    await saldiriBildirimi(sonuc.defenderLordId, sonuc, console);
  }
  return sonuc !== false;
}

/**
 * Savunana "bölgen saldırıya uğradı" postası atar.
 *
 * İşlemin DIŞINDA çağrılıyor: e-posta yavaş ve dışarıya bağımlı bir iş,
 * savaş işlemini onun hızına bağlamak veritabanı kilitlerini gereksiz yere
 * uzun tutardı. Gönderim başarısız olsa da savaş çoktan kaydedilmiştir.
 *
 * Neden yalnızca savunana: saldıran zaten ne yaptığını biliyor. Bildirimin
 * değeri, oyuncunun OLMADIĞI anda olan bir şeyi haber vermesinde.
 */
export async function saldiriBildirimi(
  defenderLordId: string,
  bilgi: { bolgeAdi: string; attackerLordId: string; kaybedildi: boolean },
  log: { info: (o: object, m: string) => void; error: (o: object, m: string) => void },
): Promise<void> {
  const [lord, saldiran] = await Promise.all([
    prisma.lord.findUnique({
      where: { id: defenderLordId },
      select: { name: true, user: { select: { email: true } } },
    }),
    prisma.lord.findUnique({ where: { id: bilgi.attackerLordId }, select: { name: true } }),
  ]);
  if (!lord?.user?.email) return;
  const saldiranAdi = saldiran?.name ?? 'Bilinmeyen bir lord';

  const baslik = bilgi.kaybedildi
    ? `${bilgi.bolgeAdi} elinden alındı`
    : `${bilgi.bolgeAdi} saldırıya uğradı`;

  await postaGonder(
    {
      kime: lord.user.email,
      konu: `Lordlar Çağı — ${baslik}`,
      metin:
        `${lord.name},\n\n` +
        `${saldiranAdi} ${bilgi.bolgeAdi} bölgene saldırdı. ` +
        (bilgi.kaybedildi
          ? 'Bölge el değiştirdi.'
          : 'Saldırı püskürtüldü ama bölgen yağmalandı.') +
        `\n\nSavaş raporunu oyunda görebilirsin: ${env.uygulamaUrl}\n`,
    },
    log,
  );
}
