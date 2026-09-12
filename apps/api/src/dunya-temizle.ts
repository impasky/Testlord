/**
 * Geliştirme veritabanındaki ÖLÜ dünyaları siler.
 *
 * NEDEN VAR: yük testi her koşuşta 120 oyuncu kaydediyor ve kapasite
 * dolunca yeni dünya açılıyor. Aylar içinde biriken sonuç ölçüldü —
 * 197 dünya, 9.661 lord, 23.837 bölge. Hiçbiri oynanmıyor ama hepsi
 * her seed'de, her sıralamada, her dünya taramasında hesaba katılıyor.
 *
 * ÖLÜ DÜNYA tanımı dar tutuldu, çünkü yanlışlıkla silinen bir dünya geri
 * gelmez:
 *   - hiç lordu olmayan dünya, ya da
 *   - bütün lordları GÜN sayısı kadar süredir girmemiş VE hiçbiri bölge
 *     almamış dünya (yani kimse gerçekten oynamamış).
 * En son açılan dünya her hâlükârda korunuyor: oyunun kapısı hep açık
 * kalsın.
 *
 * Silme CASCADE: bölge, lord, ordu, yürüyüş, savaş hepsi dünyaya bağlı.
 *
 * KULLANIM:
 *   pnpm dunya-temizle            # yalnız raporlar, silmez
 *   pnpm dunya-temizle --uygula   # gerçekten siler
 *   GUN=14 pnpm dunya-temizle --uygula
 *
 * GUN=0 "giriş tazeliğine bakma" demek: geriye yalnız "kimse bölge
 * almamış" ölçütü kalır. Yük testi artığını süpürmenin yolu bu ve tam da
 * bu yüzden YALNIZ geliştirmede kullanılır — üretimde yeni kaydolmuş,
 * henüz ilk fethini yapmamış bir oyuncunun dünyasını da siler.
 *
 * SADECE GELİŞTİRME. Üretim veritabanında çalıştırma.
 */
import { prisma } from './db.js';
const UYGULA = process.argv.includes('--uygula');
const GUN = Number(process.env.GUN ?? 7);

const esik = new Date(Date.now() - GUN * 86_400_000);

const dunyalar = await prisma.world.findMany({
  orderBy: { openedAt: 'asc' },
  select: { id: true, name: true, openedAt: true, status: true, mapVersion: true },
});

if (dunyalar.length === 0) {
  console.log('Dünya yok.');
  await prisma.$disconnect();
  process.exit(0);
}

// En son açılan dünya dokunulmaz: kapı hep açık kalsın.
const korunan = dunyalar[dunyalar.length - 1]!.id;

const olu: { id: string; name: string; openedAt: Date; lordSayisi: number; sebep: string }[] = [];
let canli = 0;

for (const d of dunyalar) {
  if (d.id === korunan) {
    canli++;
    continue;
  }
  const lordSayisi = await prisma.lord.count({ where: { worldId: d.id } });
  if (lordSayisi === 0) {
    olu.push({ ...d, lordSayisi, sebep: 'hiç lord yok' });
    continue;
  }
  // Gerçekten oynanmış mı: birinin bölgesi var mı, biri yakında girmiş mi.
  const [sahipli, taze] = await Promise.all([
    prisma.region.count({ where: { worldId: d.id, ownerLordId: { not: null } } }),
    prisma.lord.count({ where: { worldId: d.id, lastSeenAt: { gte: esik } } }),
  ]);
  if (sahipli === 0 && taze === 0) {
    olu.push({
      ...d,
      lordSayisi,
      sebep: `${lordSayisi} lord, bölge alınmamış, ${GUN} gündür giriş yok`,
    });
  } else {
    canli++;
  }
}

console.log(`\nToplam ${dunyalar.length} dünya — ${canli} canlı, ${olu.length} ölü.\n`);
for (const d of olu.slice(0, 10)) {
  console.log(`  ${d.name.padEnd(16)} ${d.openedAt.toISOString().slice(0, 10)}  ${d.sebep}`);
}
if (olu.length > 10) console.log(`  … ve ${olu.length - 10} tane daha`);

if (olu.length === 0) {
  console.log('\nSilinecek bir şey yok.');
  await prisma.$disconnect();
  process.exit(0);
}

if (!UYGULA) {
  console.log('\nBu bir PROVA. Gerçekten silmek için: pnpm dunya-temizle --uygula\n');
  await prisma.$disconnect();
  process.exit(0);
}

// Tek tek siliniyor: yüzlerce dünyayı tek işlemde silmek kilit süresini
// gereksiz uzatır ve yarıda kalan bir silme her şeyi geri alır.
let silinen = 0;
for (const d of olu) {
  await prisma.world.delete({ where: { id: d.id } });
  silinen++;
  if (silinen % 25 === 0) console.log(`  ${silinen}/${olu.length}`);
}

const kalanDunya = await prisma.world.count();
const kalanLord = await prisma.lord.count();
const kalanBolge = await prisma.region.count();
console.log(
  `\n${silinen} dünya silindi. Kalan: ${kalanDunya} dünya, ${kalanLord} lord, ${kalanBolge} bölge.\n`,
);

await prisma.$disconnect();
