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
  'Birinci',
  'İkinci',
  'Üçüncü',
  'Dördüncü',
  'Beşinci',
  'Altıncı',
  'Yedinci',
  'Sekizinci',
  'Dokuzuncu',
  'Onuncu',
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
      x: r.x,
      y: r.y,
      komsular: r.komsular,
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
      x: r.x,
      y: r.y,
      incomeMult: r.income_mult,
    };
    const mevcut = await prisma.region.findUnique({
      where: { worldId_mapId: { worldId, mapId: r.id } },
    });
    if (!mevcut) {
      await prisma.region.create({
        data: {
          mapId: r.id,
          worldId,
          level: r.level,
          npcGarrison: r.npc_garrison,
          komsular: r.komsular,
          ...statik,
        },
      });
      tazelenen++;
      continue;
    }
    const degisti = (Object.keys(statik) as (keyof typeof statik)[]).some(
      (k) => mevcut[k] !== statik[k],
    );
    /*
     * TÜR DEĞİŞTİYSE garnizon da kanonik hâline döner.
     *
     * Normalde garnizona dokunmuyoruz: yıpranmış bir NPC garnizonu oyunun
     * ÜRETTİĞİ durum ve tazeleme onu silmemeli. Ama bir tarla köye
     * dönüştüyse orası artık başka bir yer; eski tarlanın 37 savunucusuyla
     * duran bir "köy", ilk fethi imkânsız kılardı.
     */
    const turDegisti = mevcut.type !== statik.type;
    // Komşuluk bir DİZİ: düz eşitlik her seferinde "değişti" derdi.
    // Sıra kanonik dosyada sabit olduğu için metne çevirip karşılaştırmak
    // yeterli ve ucuz.
    const komsuDegisti = JSON.stringify(mevcut.komsular) !== JSON.stringify(r.komsular);
    if (degisti || komsuDegisti || turDegisti) {
      await prisma.region.update({
        where: { id: mevcut.id },
        data: {
          ...statik,
          komsular: r.komsular,
          ...(turDegisti ? { npcGarrison: r.npc_garrison, level: r.level } : {}),
        },
      });
      tazelenen++;
    }
  }
  return tazelenen;
}
