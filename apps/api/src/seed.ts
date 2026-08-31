/**
 * world-map.json'daki 61 bölgeyi veritabanına yazar ve ilk dünyayı açar.
 *
 * Tekrar çalıştırılabilir. world-map.json bölgelerin STATİK alanları için tek
 * doğruluk kaynağıdır (ad, tip, vilayet, koordinat, halka, gelir çarpanı), bu
 * yüzden mevcut bölgelerde bu alanlar tazelenir. Oyunun ürettiği durum —
 * sahiplik, seviye, depo, kalkan, yıpranmış NPC garnizonu — korunur.
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
  let refreshed = 0;
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
    const existing = await prisma.region.findUnique({ where: { id: r.id } });

    if (!existing) {
      await prisma.region.create({
        data: {
          id: r.id,
          worldId: world.id,
          level: r.level,
          npcGarrison: r.npc_garrison,
          ...statik,
        },
      });
      created++;
      continue;
    }

    const degisti = (Object.keys(statik) as (keyof typeof statik)[]).some(
      (k) => existing[k] !== statik[k],
    );
    if (degisti) {
      await prisma.region.update({ where: { id: r.id }, data: statik });
      refreshed++;
    }
  }

  const total = await prisma.region.count({ where: { worldId: world.id } });
  console.log(
    `${created} yeni bölge eklendi, ${refreshed} bölgenin statik alanları tazelendi. ` +
      `Dünyada toplam ${total} bölge var.`,
  );
}

main()
  .catch((e) => {
    console.error('Seed başarısız:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
