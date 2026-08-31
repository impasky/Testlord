/**
 * world-map.json'daki 61 bölgeyi veritabanına yazar ve ilk dünyayı açar.
 * Tekrar çalıştırılabilir: mevcut dünyayı bulur, eksik bölgeleri tamamlar.
 */
import { WORLD_MAP, validateBalance } from '@lordlar/shared';
import { prisma } from './db.js';

async function main(): Promise<void> {
  validateBalance();

  let world = await prisma.world.findFirst({ where: { status: 'open' } });
  if (!world) {
    world = await prisma.world.create({ data: { name: 'Birinci Diyar' } });
    console.log(`Dünya açıldı: ${world.name} (${world.id})`);
  } else {
    console.log(`Mevcut dünya kullanılıyor: ${world.name}`);
  }

  let created = 0;
  for (const r of WORLD_MAP.regions) {
    const existing = await prisma.region.findUnique({ where: { id: r.id } });
    if (existing) continue;
    await prisma.region.create({
      data: {
        id: r.id,
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
      },
    });
    created++;
  }

  const total = await prisma.region.count({ where: { worldId: world.id } });
  console.log(`${created} yeni bölge eklendi. Dünyada toplam ${total} bölge var.`);
}

main()
  .catch((e) => {
    console.error('Seed başarısız:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
