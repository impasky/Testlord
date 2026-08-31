/**
 * Dünya (shard) yönetimi.
 *
 * Her dünya kendi 61 bölgesine sahiptir ve diğerlerinden tamamen bağımsızdır.
 * Kapasite dolduğunda yenisi AÇILIR — oyuncu asla "yer yok" duvarına çarpmaz.
 * (docs/00: "Shard başına 120 oyuncu. Dolunca yeni shard açılır.")
 */
import { B, WORLD_MAP } from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';

const ROMEN = [
  'Birinci', 'İkinci', 'Üçüncü', 'Dördüncü', 'Beşinci',
  'Altıncı', 'Yedinci', 'Sekizinci', 'Dokuzuncu', 'Onuncu',
];

function dunyaAdi(sira: number): string {
  return `${ROMEN[sira] ?? `${sira + 1}.`} Diyar`;
}

/** Yeni bir dünya açar ve 61 bölgesini yazar. */
export async function createWorld(client: Tx = prisma): Promise<string> {
  const mevcut = await client.world.count();
  const world = await client.world.create({
    data: { name: dunyaAdi(mevcut), playerCap: B.dunya.oyuncu_kapasitesi },
  });

  await client.region.createMany({
    data: WORLD_MAP.regions.map((r) => ({
      mapId: r.id,
      worldId: world.id,
      name: r.name,
      type: r.type,
      province: r.province,
      q: r.q,
      r: r.r,
      ring: r.ring,
      level: r.level,
      incomeMult: r.income_mult,
      npcGarrison: r.npc_garrison,
    })),
  });

  return world.id;
}

/**
 * Kayıt için bir dünya bulur. Açık dünya doluysa 'full' işaretler ve yenisini açar.
 * Bu yüzden hiçbir zaman "dünya yok" hatası dönmez.
 */
export async function findOrOpenWorld(): Promise<string> {
  const acik = await prisma.world.findMany({
    where: { status: 'open' },
    orderBy: { openedAt: 'asc' },
  });

  for (const w of acik) {
    const sayi = await prisma.lord.count({ where: { worldId: w.id } });
    if (sayi < w.playerCap) return w.id;
    await prisma.world.update({ where: { id: w.id }, data: { status: 'full' } });
  }

  return createWorld();
}

/** Bölgelerin statik alanlarını kanonik haritadan tazeler (oyun durumuna dokunmaz). */
export async function refreshWorldRegions(worldId: string): Promise<number> {
  let tazelenen = 0;
  for (const r of WORLD_MAP.regions) {
    const statik = {
      name: r.name,
      type: r.type,
      province: r.province,
      q: r.q,
      r: r.r,
      ring: r.ring,
      incomeMult: r.income_mult,
    };
    const mevcut = await prisma.region.findUnique({
      where: { worldId_mapId: { worldId, mapId: r.id } },
    });
    if (!mevcut) {
      await prisma.region.create({
        data: { mapId: r.id, worldId, level: r.level, npcGarrison: r.npc_garrison, ...statik },
      });
      tazelenen++;
      continue;
    }
    const degisti = (Object.keys(statik) as (keyof typeof statik)[]).some(
      (k) => mevcut[k] !== statik[k],
    );
    if (degisti) {
      await prisma.region.update({ where: { id: mevcut.id }, data: statik });
      tazelenen++;
    }
  }
  return tazelenen;
}
