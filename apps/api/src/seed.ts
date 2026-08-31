/**
 * İlk dünyayı açar ve 61 bölgesini yazar. Tekrar çalıştırılabilir.
 *
 * Mevcut dünyalarda bölgelerin STATİK alanlarını (ad, tip, vilayet, koordinat,
 * halka, gelir çarpanı) world-map.json'dan tazeler; oyunun ürettiği durumu
 * (sahiplik, seviye, depo, kalkan, yıpranmış NPC garnizonu) korur.
 */
import { validateBalance } from '@lordlar/shared';
import { prisma } from './db.js';
import { createWorld, refreshWorldRegions } from './services/world.js';

async function main(): Promise<void> {
  validateBalance();

  const dunyalar = await prisma.world.findMany({ orderBy: { openedAt: 'asc' } });

  if (dunyalar.length === 0) {
    const id = await createWorld();
    const w = await prisma.world.findUniqueOrThrow({ where: { id } });
    console.log(`Dünya açıldı: ${w.name} — 61 bölge yazıldı.`);
    return;
  }

  for (const w of dunyalar) {
    const n = await refreshWorldRegions(w.id);
    const toplam = await prisma.region.count({ where: { worldId: w.id } });
    console.log(
      `${w.name}: ${toplam} bölge` + (n > 0 ? `, ${n} tanesinin statik alanları tazelendi.` : '.'),
    );
  }
}

main()
  .catch((e) => {
    console.error('Seed başarısız:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
