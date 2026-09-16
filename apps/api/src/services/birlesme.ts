/**
 * Diyar birleşmesi — planlama ve uygulama.
 *
 * Kuralı `packages/shared/src/birlesme.ts` veriyor (kim kiminle, ne zaman);
 * burası onu veritabanına işliyor.
 *
 * ── Birleşme neden "taşınma", "harita birleştirme" değil ──────────────
 *
 * Her diyar AYNI 121 bölgelik haritayı kullanıyor. "Akçakavak Köyü" iki
 * diyarda da var ve ikisinde de başka bir lordun olabilir. İki haritayı
 * üst üste koymak mümkün değil. Taşınabilen şey LORD: seviyesi, statları,
 * generalleri, ekipmanı, araştırması, binaları, ordusu — hepsi geliyor.
 * Toprağı ise ancak ev sahibinde o bölge BOŞSA geliyor; doluysa bir
 * günlük geliriyle tazmin ediliyor.
 *
 * ── Taht neden sıfırlanıyor ───────────────────────────────────────────
 *
 * İki diyarın iki "Diyarın Lordu" var ve birleşen diyarda taht tek.
 * Birinin unvanını alıp ötekine vermek, kazanılmış bir şeyi kavga
 * olmadan elinden almak olurdu. Taht sahipsiz kalıyor ve garnizonu geri
 * geliyor: birleşen diyarın ilk savaşı taht için oluyor. Kayıp değil,
 * sebep.
 */
import {
  UNIT_TYPES,
  birlesmeAni,
  birlesmeEsleri,
  bolgeKarari,
  gelisKalkani,
  type Army,
  type BirlesmeAdayi,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { pushEvent } from './lord.js';
import { addUnitsHome } from './queue.js';
import { AKTIF_GUN } from './world.js';

export interface BirlesmeOzeti {
  gocenLord: number;
  tasinanBolge: number;
  dusenBolge: number;
  tasinanIttifak: number;
  iadeEdilenYuruyus: number;
}

/** Planlama için diyarların hâli. */
async function adaylar(): Promise<BirlesmeAdayi[]> {
  const dunyalar = await prisma.world.findMany({
    select: { id: true, name: true, openedAt: true, status: true, playerCap: true },
  });
  if (dunyalar.length === 0) return [];

  const aktifSinir = new Date(Date.now() - AKTIF_GUN * 86_400_000);
  const [hepsi, aktifler, planlilar] = await Promise.all([
    prisma.lord.groupBy({ by: ['worldId'], _count: { _all: true } }),
    prisma.lord.groupBy({
      by: ['worldId'],
      _count: { _all: true },
      where: { lastSeenAt: { gte: aktifSinir } },
    }),
    prisma.worldMerge.findMany({
      where: { uygulandiAt: null },
      select: { hostId: true, guestId: true },
    }),
  ]);
  const toplam = new Map(hepsi.map((g) => [g.worldId, g._count._all]));
  const aktif = new Map(aktifler.map((g) => [g.worldId, g._count._all]));
  const planli = new Set(planlilar.flatMap((m) => [m.hostId, m.guestId]));

  return dunyalar.map((d) => ({
    id: d.id,
    ad: d.name,
    openedAt: d.openedAt,
    durum: d.status,
    kapasite: d.playerCap,
    lordSayisi: toplam.get(d.id) ?? 0,
    aktifLord: aktif.get(d.id) ?? 0,
    planliMi: planli.has(d.id),
  }));
}

/**
 * Yaşı dolan diyarları eşleyip birleşmeyi İLAN EDER.
 *
 * İlan ile uygulama arasında `ihbar_gun` var: haritası bir sabah
 * değişmiş oyuncu, oyunu bırakan oyuncudur.
 */
export async function birlesmeyiPlanla(
  simdi = new Date(),
): Promise<
  { hostId: string; hostAd: string; guestId: string; guestAd: string; birlesmeAt: Date }[]
> {
  const esler = birlesmeEsleri(await adaylar(), simdi);
  const kurulan: {
    hostId: string;
    hostAd: string;
    guestId: string;
    guestAd: string;
    birlesmeAt: Date;
  }[] = [];

  for (const es of esler) {
    const birlesmeAt = birlesmeAni(simdi);
    await prisma.worldMerge.create({
      data: { hostId: es.evSahibi.id, guestId: es.konuk.id, ilanAt: simdi, birlesmeAt },
    });
    // İKİ diyara da duyuruluyor. Konuk taşınıyor, ev sahibi kalabalıklaşıyor;
    // ikisi için de haritanın yarın başka olacağı haber değeri taşıyor.
    const lordlar = await prisma.lord.findMany({
      where: { worldId: { in: [es.evSahibi.id, es.konuk.id] }, isNpc: false },
      select: { id: true, worldId: true },
    });
    for (const l of lordlar) {
      const konukMu = l.worldId === es.konuk.id;
      await pushEvent(l.id, 'diyar_birlesiyor', {
        mesaj: konukMu
          ? `${es.konuk.ad} ${es.evSahibi.ad} ile birleşiyor. Lordun, ordun ve araştırman taşınıyor; bölgelerin ancak orada boşsa geliyor.`
          : `${es.konuk.ad} diyarının lordları ${es.evSahibi.ad} diyarına geliyor. Taht sahipsiz kalacak.`,
        hostId: es.evSahibi.id,
        guestId: es.konuk.id,
        birlesmeAt: birlesmeAt.toISOString(),
      });
    }
    kurulan.push({
      hostId: es.evSahibi.id,
      hostAd: es.evSahibi.ad,
      guestId: es.konuk.id,
      guestAd: es.konuk.ad,
      birlesmeAt,
    });
  }
  return kurulan;
}

/** Vakti gelmiş, henüz uygulanmamış birleşmeler. */
export async function vaktiGelenBirlesmeler(simdi = new Date()) {
  return prisma.worldMerge.findMany({
    where: { uygulandiAt: null, birlesmeAt: { lte: simdi } },
    orderBy: { birlesmeAt: 'asc' },
  });
}

/** Bir orduyu (JSON) lordun evine geri koyar. */
async function orduyuEveIade(lordId: string, army: Army, tx: Tx): Promise<void> {
  for (const t of UNIT_TYPES) {
    const n = army[t] ?? 0;
    if (n > 0) await addUnitsHome(lordId, t as UnitType, n, tx);
  }
}

/**
 * Konuk diyarda YOLDA olan ne varsa eve döndürür.
 *
 * Yürüyüş, akın ve sevkiyat hep bir bölgeye ya da bir lorda işaret
 * ediyor; o hedefler birleşmeden sonra başka bir diyarda kalıyor. Yarıda
 * bırakılan bir yürüyüş, ordusu sonsuza kadar yolda görünen bir oyuncu
 * demek — oyuncunun oyunu bırakmasının en kısa yolu.
 *
 * İade her zaman OYUNCUNUN LEHİNE: ordu eve, yağma cebe, sevkiyat
 * gönderene geri. Birleşme kimsenin ordusunu yemiyor.
 */
async function yoldakileriIadeEt(guestId: string, tx: Tx): Promise<number> {
  let sayi = 0;

  const yuruyusler = await tx.march.findMany({ where: { worldId: guestId, resolved: false } });
  for (const m of yuruyusler) {
    await orduyuEveIade(m.lordId, (m.army ?? {}) as Army, tx);
    const yagma = (m.loot ?? null) as { altin?: number; demir?: number; erzak?: number } | null;
    if (yagma) {
      await tx.lord.update({
        where: { id: m.lordId },
        data: {
          altin: { increment: Math.max(0, Math.round(yagma.altin ?? 0)) },
          demir: { increment: Math.max(0, Math.round(yagma.demir ?? 0)) },
          erzak: { increment: Math.max(0, Math.round(yagma.erzak ?? 0)) },
        },
      });
    }
    sayi++;
  }
  await tx.march.deleteMany({ where: { worldId: guestId, resolved: false } });

  const akinlar = await tx.akin.findMany({ where: { worldId: guestId, resolved: false } });
  for (const a of akinlar) {
    await orduyuEveIade(a.lordId, (a.army ?? {}) as Army, tx);
    sayi++;
  }
  await tx.akin.deleteMany({ where: { worldId: guestId, resolved: false } });

  const sevkiyatlar = await tx.shipment.findMany({ where: { worldId: guestId, resolved: false } });
  for (const s of sevkiyatlar) {
    await tx.lord.update({
      where: { id: s.fromLordId },
      data: {
        altin: { increment: s.altin },
        demir: { increment: s.demir },
        erzak: { increment: s.erzak },
      },
    });
    sayi++;
  }
  await tx.shipment.deleteMany({ where: { worldId: guestId, resolved: false } });

  return sayi;
}

/**
 * Birleşmeyi uygular. Geri alınamaz.
 *
 * Tek işlemde: yoldakiler iade, toprak taşıma, garnizon taşıma, lord
 * göçü, ittifak ve pakt göçü, taht sıfırlama, konuk diyarın kapanışı.
 * Yarım kalmış bir birleşme — lordu taşınmış ama toprağı taşınmamış bir
 * diyar — her ihtimalden kötü, o yüzden hepsi ya olur ya olmaz.
 */
export async function birlesmeyiUygula(
  mergeId: string,
  simdi = new Date(),
): Promise<BirlesmeOzeti> {
  /*
   * ÖNCE SAHİPLEN, sonra uygula.
   *
   * "Uygulandı mı diye bak, sonra uygula" yarışa açık ve bu yarış
   * gerçek: Render'ın tek servisli dağıtımında worker API sürecinin
   * İÇİNDE dönüyor (RUN_WORKER) ve yanına `pnpm worker` ile ikinci bir
   * süreç de açılabiliyor. İkisi aynı anda aynı birleşmeyi okursa ikisi
   * de "uygulanmamış" görür: lordlar iki kez taşınır, taht iki kez
   * sıfırlanır.
   *
   * Koşullu `updateMany` damgayı ATOMİK alıyor — yalnız bir taraf 1
   * satır güncelleyebiliyor, öteki 0 alıp çekiliyor.
   */
  const sahiplenme = await prisma.worldMerge.updateMany({
    where: { id: mergeId, uygulandiAt: null },
    data: { uygulandiAt: simdi },
  });
  if (sahiplenme.count === 0) throw new Error('Bu birleşme zaten uygulanmış.');
  const merge = await prisma.worldMerge.findUniqueOrThrow({ where: { id: mergeId } });

  try {
    return await birlesmeyiIsle(merge, simdi);
  } catch (e) {
    // Damgayı geri al: uygulanmamış bir birleşme "uygulandı" kalırsa bir
    // sonraki tur onu hiç denemez ve iki diyar yarım kalır.
    await prisma.worldMerge.updateMany({ where: { id: mergeId }, data: { uygulandiAt: null } });
    throw e;
  }
}

async function birlesmeyiIsle(
  merge: { id: string; hostId: string; guestId: string },
  simdi: Date,
): Promise<BirlesmeOzeti> {
  return prisma.$transaction(
    async (tx) => {
      const ozet: BirlesmeOzeti = {
        gocenLord: 0,
        tasinanBolge: 0,
        dusenBolge: 0,
        tasinanIttifak: 0,
        iadeEdilenYuruyus: 0,
      };

      ozet.iadeEdilenYuruyus = await yoldakileriIadeEt(merge.guestId, tx);

      /* ── Toprak ──────────────────────────────────────────────────── */
      const konukBolgeler = await tx.region.findMany({
        where: { worldId: merge.guestId, ownerLordId: { not: null } },
      });
      const evBolgeler = await tx.region.findMany({ where: { worldId: merge.hostId } });
      const evMapIle = new Map(evBolgeler.map((r) => [r.mapId, r]));
      /** konuk bölge DB kimliği -> ev sahibindeki karşılığı (taşındıysa) */
      const tasinan = new Map<number, number>();

      for (const kb of konukBolgeler) {
        const ev = evMapIle.get(kb.mapId);
        const doluMu = !ev || ev.ownerLordId !== null;
        const karar = bolgeKarari(
          { mapId: kb.mapId, type: kb.type, level: kb.level, incomeMult: kb.incomeMult },
          doluMu,
        );
        if (karar.tasindi && ev) {
          await tx.region.update({
            where: { id: ev.id },
            data: {
              ownerLordId: kb.ownerLordId,
              level: kb.level,
              storeAltin: kb.storeAltin,
              storeDemir: kb.storeDemir,
              storeErzak: kb.storeErzak,
              npcGarrison: kb.npcGarrison as object,
              lastTickAt: simdi,
              // Gelen toprak da kalkan altında: birleşme günü kimse
              // tanımadığı bir haritada yağmalanmasın.
              shieldUntil: gelisKalkani(simdi),
            },
          });
          tasinan.set(kb.id, ev.id);
          ozet.tasinanBolge++;
        } else {
          await tx.lord.update({
            where: { id: kb.ownerLordId! },
            data: {
              altin: { increment: karar.tazminat.altin },
              demir: { increment: karar.tazminat.demir },
              erzak: { increment: karar.tazminat.erzak },
            },
          });
          ozet.dusenBolge++;
        }
      }
      // Konuk harita boşaltılıyor: diyar kapanıyor, sahiplik kaydı kalmasın.
      await tx.region.updateMany({
        where: { worldId: merge.guestId },
        data: { ownerLordId: null },
      });

      /* ── Garnizonlar ─────────────────────────────────────────────── */
      // Garnizon satırı BÖLGEYE bağlı (locationId = Region.id) ve bölge
      // kimliği diyara özel. Taşınan bölgenin garnizonu yeni kimliğe
      // geçiyor; taşınamayanınki eve dönüyor — asker kaybolmuyor.
      // `locationId` METİN tutuluyor (ArmyUnit her konum türü için aynı
      // alanı kullanıyor), bölge kimliği ise sayı. Dönüşüm burada tek
      // yerde yapılıyor.
      const konukBolgeKimlikleri = konukBolgeler.map((r) => String(r.id));
      const garnizonlar = konukBolgeKimlikleri.length
        ? await tx.armyUnit.findMany({
            where: { locationType: 'region', locationId: { in: konukBolgeKimlikleri } },
          })
        : [];
      for (const g of garnizonlar) {
        const yeni = tasinan.get(Number(g.locationId));
        if (yeni !== undefined) {
          await tx.armyUnit.update({ where: { id: g.id }, data: { locationId: String(yeni) } });
        } else {
          await tx.armyUnit.delete({ where: { id: g.id } });
          await addUnitsHome(g.lordId, g.unitType as UnitType, g.count, tx);
        }
      }

      /* ── Lordlar ─────────────────────────────────────────────────── */
      const konukLordlar = await tx.lord.findMany({
        where: { worldId: merge.guestId },
        select: { id: true, baskentBolgeId: true, isNpc: true },
      });
      for (const l of konukLordlar) {
        const yeniBaskent =
          l.baskentBolgeId !== null ? (tasinan.get(l.baskentBolgeId) ?? null) : null;
        await tx.lord.update({
          where: { id: l.id },
          data: {
            worldId: merge.hostId,
            baskentBolgeId: yeniBaskent,
            protectionUntil: gelisKalkani(simdi),
            lastTickAt: simdi,
          },
        });
        ozet.gocenLord++;
      }

      /* ── İttifaklar ve paktlar ───────────────────────────────────── */
      const evIttifaklar = await tx.alliance.findMany({
        where: { worldId: merge.hostId },
        select: { name: true, tag: true },
      });
      const adlar = new Set(evIttifaklar.map((a) => a.name));
      const etiketler = new Set(evIttifaklar.map((a) => a.tag));
      const konukIttifaklar = await tx.alliance.findMany({ where: { worldId: merge.guestId } });
      for (const it of konukIttifaklar) {
        // Ad ve etiket diyar içinde benzersiz. Çakışanı yeniden
        // adlandırmak, ittifakı dağıtmaktan iyi.
        let ad = it.name;
        for (let i = 2; adlar.has(ad); i++) ad = `${it.name} ${i}`;
        let etiket = it.tag;
        for (let i = 2; etiketler.has(etiket); i++) etiket = `${it.tag.slice(0, 3)}${i}`;
        adlar.add(ad);
        etiketler.add(etiket);
        await tx.alliance.update({
          where: { id: it.id },
          data: {
            worldId: merge.hostId,
            name: ad,
            tag: etiket,
            // Ortak hedef başka bir diyarın bölgesini gösteriyordu.
            targetRegionId:
              it.targetRegionId !== null ? (tasinan.get(it.targetRegionId) ?? null) : null,
            targetNote: it.targetRegionId !== null ? it.targetNote : null,
          },
        });
        ozet.tasinanIttifak++;
      }
      await tx.pakt.updateMany({
        where: { worldId: merge.guestId },
        data: { worldId: merge.hostId },
      });
      // Savaş geçmişi lordla birlikte geliyor: raporlar açık kalsın.
      await tx.battle.updateMany({
        where: { worldId: merge.guestId },
        data: { worldId: merge.hostId },
      });

      /* ── Taht ────────────────────────────────────────────────────── */
      const taht = evBolgeler.find((r) => r.type === 'taht');
      if (taht) {
        await tx.region.update({
          where: { id: taht.id },
          data: {
            ownerLordId: null,
            npcGarrison: (taht.npcTaban ?? taht.npcGarrison) as object,
            storeAltin: 0,
            storeDemir: 0,
            storeErzak: 0,
            level: 1,
            shieldUntil: null,
            lastTickAt: simdi,
          },
        });
        await tx.armyUnit.deleteMany({
          where: { locationType: 'region', locationId: String(taht.id) },
        });
      }

      /* ── Kapanış ─────────────────────────────────────────────────── */
      await tx.world.update({ where: { id: merge.guestId }, data: { status: 'closed' } });
      // `uygulandiAt` yukarıda, sahiplenmede kondu. Burada yalnız özet.
      await tx.worldMerge.update({
        where: { id: merge.id },
        data: { ozet: ozet as unknown as object },
      });

      return ozet;
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}

/** Vakti gelmiş bütün birleşmeleri uygular (worker çağırıyor). */
export async function bekleyenBirlesmeleriUygula(simdi = new Date()): Promise<number> {
  const bekleyen = await vaktiGelenBirlesmeler(simdi);
  let sayi = 0;
  for (const m of bekleyen) {
    try {
      const ozet = await birlesmeyiUygula(m.id, simdi);
      sayi++;
      const lordlar = await prisma.lord.findMany({
        where: { worldId: m.hostId, isNpc: false },
        select: { id: true },
      });
      for (const l of lordlar) {
        await pushEvent(l.id, 'diyar_birlesti', {
          mesaj: `Diyarlar birleşti: ${ozet.gocenLord} lord geldi. Taht sahipsiz — ilk alan Diyarın Lordu olur.`,
        });
      }
    } catch (e) {
      // Tek bir birleşme patlarsa worker durmasın.
      console.error(`Birleşme uygulanamadı (${m.id}):`, e);
    }
  }
  return sayi;
}
