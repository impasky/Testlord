/**
 * GÖÇ — eski kuşak haritadaki dünyayı gerçek dünyaya taşır (docs/27).
 *
 * Kural "üzerinde oyuncu olan dünyanın haritası değişmez" (docs/12 §14)
 * küçük düzenlemeler için; harita TÜRÜ değişince (121 bölgelik hayalî
 * diyardan gerçek dünyaya) oyunun sahibi herkesin yeni haritaya geçmesini
 * seçti. Göç oyuncudan hiçbir şey ALMIYOR:
 *
 *   - Şehir, binalar, ordu, eşya, generaller, araştırma: olduğu gibi.
 *   - Yoldaki yürüyüşler ve bölgelerdeki garnizonlar: eve döner, yağma cebe.
 *   - Kaybedilen her toprak: o toprağın bir günlük geliri tazminat
 *     (diyar birleşmesindeki kuralın aynısı, shared `bolgeKarari`).
 *   - Topraklar sıfırdan: yeni haritanın bütün şehirleri NPC garnizonunda.
 *   - Ülke: oyuncu seçiyor (`ulke` null, oyun ilk açılışta soruyor). NPC
 *     lordlar en az kalabalık ülkeye kendiliğinden yerleşiyor.
 *
 * Tek işlemde: yarım kalmış bir göç — bölgeleri silinmiş ama yenisi
 * yazılmamış bir diyar — her ihtimalden kötü.
 */
import {
  B,
  HARITA_KUSAGI,
  ULKELER,
  UNIT_TYPES,
  bolgeKarari,
  type Army,
  type UnitType,
} from '@lordlar/shared';
import { HARITA_SURUMU, WORLD_MAP } from '@lordlar/shared/kanonik';
import { prisma, type Tx } from '../db.js';
import { pushEvent } from './lord.js';
import { grafigiUnut } from './mesafe.js';
import { addUnitsHome } from './queue.js';
import { kampYeri } from './ulke.js';
import { haritaSatirlari } from './world.js';

export interface GocOzeti {
  lord: number;
  iadeEdilenYuruyus: number;
  eveDonenGarnizon: number;
  tazminatliBolge: number;
}

async function orduyuEveIade(lordId: string, army: Army, tx: Tx): Promise<void> {
  for (const t of UNIT_TYPES) {
    const n = army[t] ?? 0;
    if (n > 0) await addUnitsHome(lordId, t as UnitType, n, tx);
  }
}

/** NPC lord için ülke: diyarda en az lordun başladığı ülke (eşitlikte koda göre). */
async function npcUlkesi(worldId: string, tx: Tx): Promise<string> {
  const sayim = await tx.lord.groupBy({
    by: ['ulke'],
    where: { worldId, ulke: { not: null } },
    _count: { _all: true },
  });
  const n = new Map(sayim.map((s) => [s.ulke, s._count._all]));
  return [...ULKELER.keys()].sort(
    (a, b) => (n.get(a) ?? 0) - (n.get(b) ?? 0) || a.localeCompare(b),
  )[0]!;
}

export async function dunyayiGocur(worldId: string): Promise<GocOzeti> {
  const ozet = await prisma.$transaction(
    async (tx) => {
      const o: GocOzeti = {
        lord: 0,
        iadeEdilenYuruyus: 0,
        eveDonenGarnizon: 0,
        tazminatliBolge: 0,
      };

      /* ── Yoldakiler eve ─────────────────────────────────────────── */
      const yuruyusler = await tx.march.findMany({ where: { worldId, resolved: false } });
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
        // Yoldaki birimin sayaç satırı: ordu JSON'dan iade edildi, satır kalırsa iki kez sayılır.
        await tx.armyUnit.deleteMany({ where: { locationType: 'march', locationId: m.id } });
        o.iadeEdilenYuruyus++;
      }
      await tx.march.deleteMany({ where: { worldId, resolved: false } });

      /* ── Garnizonlar eve, topraklar tazminatla ──────────────────── */
      const eskiBolgeler = await tx.region.findMany({ where: { worldId } });
      const kimlikler = eskiBolgeler.map((r) => String(r.id));
      const garnizonlar = kimlikler.length
        ? await tx.armyUnit.findMany({
            where: { locationType: 'region', locationId: { in: kimlikler } },
          })
        : [];
      for (const g of garnizonlar) {
        await tx.armyUnit.delete({ where: { id: g.id } });
        await addUnitsHome(g.lordId, g.unitType as UnitType, g.count, tx);
        o.eveDonenGarnizon++;
      }
      for (const b of eskiBolgeler) {
        if (!b.ownerLordId) continue;
        const { tazminat } = bolgeKarari(
          { mapId: b.mapId, type: b.type, level: b.level, incomeMult: b.incomeMult },
          true,
        );
        await tx.lord.update({
          where: { id: b.ownerLordId },
          data: {
            altin: { increment: tazminat.altin + b.storeAltin },
            demir: { increment: tazminat.demir + b.storeDemir },
            erzak: { increment: tazminat.erzak + b.storeErzak },
          },
        });
        o.tazminatliBolge++;
      }

      // Bölgeye bağlı bekleyen işler eski haritayla gidiyor.
      const lordlar = await tx.lord.findMany({
        where: { worldId },
        select: { id: true, isNpc: true },
      });
      const lordIdleri = lordlar.map((l) => l.id);
      await tx.queue.deleteMany({
        where: {
          lordId: { in: lordIdleri },
          resolved: false,
          kind: { in: ['upgrade_region', 'kesif'] },
        },
      });
      await tx.alliance.updateMany({
        where: { worldId },
        data: { targetRegionId: null, targetNote: null },
      });

      /* ── Harita ─────────────────────────────────────────────────── */
      await tx.region.deleteMany({ where: { worldId } });
      await tx.region.createMany({ data: haritaSatirlari(worldId) });
      const ilk = WORLD_MAP.regions.reduce((a, r) => Math.min(a, r.id), Infinity);

      /* ── Lordlar ────────────────────────────────────────────────── */
      await tx.lord.updateMany({
        where: { worldId },
        data: { ulke: null, homeBolgeId: ilk, baskentBolgeId: null },
      });
      for (const l of lordlar) {
        if (l.isNpc) {
          const ulke = await npcUlkesi(worldId, tx);
          await tx.lord.update({
            where: { id: l.id },
            data: { ulke, homeBolgeId: await kampYeri(worldId, ulke, tx) },
          });
        } else {
          await pushEvent(
            l.id,
            'dunya_degisti',
            {
              mesaj:
                'Dünya değişti: artık gerçek dünya haritasındasın. Şehrin, ordun ve eşyaların yerinde; topraklarının karşılığı hazinene eklendi. Bir ülke seç, kampın orada kurulsun.',
            },
            tx,
          );
        }
        o.lord++;
      }

      await tx.world.update({
        where: { id: worldId },
        data: {
          mapVersion: HARITA_SURUMU,
          haritaKusagi: HARITA_KUSAGI,
          playerCap: B.dunya.oyuncu_kapasitesi,
        },
      });
      // Eski haritada kaldığı için kayda kapatılmış diyar yeniden açık.
      await tx.world.updateMany({
        where: { id: worldId, status: 'closed' },
        data: { status: 'open' },
      });
      return o;
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
  grafigiUnut(worldId);
  return ozet;
}

/**
 * Kuşağı eski her dünyayı gerçek dünyaya taşır; açılışta (`index.ts`) ve
 * `seed`te aynı işlev. Üretim sunucusu `seed` koşmuyor: göç burada
 * olmasaydı yayından sonra diyarlar eski haritada kalır, sunucu yeni
 * haritayı bekler ve ülke seçimi `ULKE_YOK` ile düşerdi.
 *
 * Kapanmış ve boş diyar (birleşmenin konuğu) göçmüyor: haritası siliniyor.
 * Her dünya kendi işleminde; biri düşerse sunucu açılmıyor ve hiçbir
 * dünya yarım kalmıyor.
 *
 * @returns göçen ya da temizlenen dünya sayısı
 */
export async function eskiDunyalariGocur(yaz: (s: string) => void = console.log): Promise<number> {
  const eskiler = await prisma.world.findMany({
    where: { haritaKusagi: { lt: HARITA_KUSAGI } },
    orderBy: { openedAt: 'asc' },
  });
  for (const w of eskiler) {
    const lordSayisi = await prisma.lord.count({ where: { worldId: w.id } });
    if (w.status === 'closed' && lordSayisi === 0) {
      await prisma.$transaction([
        prisma.region.deleteMany({ where: { worldId: w.id } }),
        prisma.world.update({ where: { id: w.id }, data: { haritaKusagi: HARITA_KUSAGI } }),
      ]);
      yaz(`${w.name}: kapalı ve boş — eski haritası silindi.`);
      continue;
    }
    const g = await dunyayiGocur(w.id);
    yaz(
      `${w.name}: GERÇEK DÜNYAYA GÖÇTÜ — ${g.lord} lord, ${g.iadeEdilenYuruyus} yürüyüş ve ` +
        `${g.eveDonenGarnizon} garnizon satırı eve döndü, ${g.tazminatliBolge} toprak tazmin edildi.`,
    );
  }
  return eskiler.length;
}
