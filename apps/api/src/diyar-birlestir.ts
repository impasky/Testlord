/**
 * Diyar birleşmesi — elle koşturma ve KURU KOŞU.
 *
 * Worker birleşmeyi kendiliğinden planlayıp uyguluyor (services/worker).
 * Bu araç aynı işi görülebilir hâle getiriyor: hangi diyar kiminle
 * eşleşecek, kaç lord taşınacak, kaç bölge yeri dolu olduğu için düşecek.
 *
 * Geri alınamayan bir işlemin önce KURU KOŞUSU olmalı. `dunya-temizle`
 * de aynı sebeple böyle yazılmıştı.
 *
 *   pnpm diyar-birlestir              # yalnız ilan planını göster
 *   pnpm diyar-birlestir --planla     # birleşmeleri İLAN ET (ihbar başlar)
 *   pnpm diyar-birlestir --uygula     # vakti gelmişleri uygula
 */
import { BIRLESME, birlesmeEsleri, diyarYasiGun } from '@lordlar/shared';
import { prisma } from './db.js';
import {
  bekleyenBirlesmeleriUygula,
  birlesmeyiPlanla,
  vaktiGelenBirlesmeler,
} from './services/birlesme.js';
import { AKTIF_GUN } from './services/world.js';

const PLANLA = process.argv.includes('--planla');
const UYGULA = process.argv.includes('--uygula');
const simdi = new Date();

const dunyalar = await prisma.world.findMany({
  select: { id: true, name: true, openedAt: true, status: true },
});
const aktifSinir = new Date(simdi.getTime() - AKTIF_GUN * 86_400_000);
const [hepsi, aktifler, planlilar] = await Promise.all([
  prisma.lord.groupBy({ by: ['worldId'], _count: { _all: true } }),
  prisma.lord.groupBy({
    by: ['worldId'],
    _count: { _all: true },
    where: { lastSeenAt: { gte: aktifSinir } },
  }),
  prisma.worldMerge.findMany({ where: { uygulandiAt: null } }),
]);
const toplam = new Map(hepsi.map((g) => [g.worldId, g._count._all]));
const aktif = new Map(aktifler.map((g) => [g.worldId, g._count._all]));
const planliDiyar = new Set(planlilar.flatMap((m) => [m.hostId, m.guestId]));

const adaylar = dunyalar.map((d) => ({
  id: d.id,
  ad: d.name,
  openedAt: d.openedAt,
  durum: d.status,
  lordSayisi: toplam.get(d.id) ?? 0,
  aktifLord: aktif.get(d.id) ?? 0,
  planliMi: planliDiyar.has(d.id),
}));

console.log(`Lordlar Çağı — diyar birleşmesi\n`);
console.log(
  `Kural: ${BIRLESME.yas_gun} günü dolan diyar, açılış tarihi en fazla ` +
    `${BIRLESME.azami_yas_farki_gun} gün farklı bir yaşıtıyla birleşiyor. ` +
    `İhbar ${BIRLESME.ihbar_gun} gün.\n`,
);

if (planlilar.length) {
  console.log('İLAN EDİLMİŞ BİRLEŞMELER');
  const ad = new Map(dunyalar.map((d) => [d.id, d.name]));
  for (const m of planlilar) {
    const kalan = Math.ceil((m.birlesmeAt.getTime() - simdi.getTime()) / 3_600_000);
    console.log(
      `  ${ad.get(m.guestId) ?? m.guestId} -> ${ad.get(m.hostId) ?? m.hostId}` +
        (kalan > 0 ? `  (${kalan} saat sonra)` : '  (VAKTİ GELDİ)'),
    );
  }
  console.log('');
}

const esler = birlesmeEsleri(adaylar, simdi);
if (esler.length === 0) {
  console.log('Eşleşecek diyar yok.');
} else {
  console.log('YENİ EŞLER');
  for (const e of esler) {
    console.log(
      `  ${e.konuk.ad} (${e.konuk.aktifLord} aktif, ${diyarYasiGun(e.konuk.openedAt, simdi)} günlük)` +
        `  ->  ${e.evSahibi.ad} (${e.evSahibi.aktifLord} aktif, ${diyarYasiGun(e.evSahibi.openedAt, simdi)} günlük)` +
        `   · yaş farkı ${e.yasFarkiGun} gün`,
    );
  }
}

if (PLANLA) {
  const kurulan = await birlesmeyiPlanla(simdi);
  console.log(`\n${kurulan.length} birleşme ilan edildi.`);
} else if (!UYGULA) {
  console.log('\nBu bir KURU KOŞU. İlan etmek için: --planla');
}

if (UYGULA) {
  const bekleyen = await vaktiGelenBirlesmeler(simdi);
  console.log(`\nVakti gelen: ${bekleyen.length}`);
  const sayi = await bekleyenBirlesmeleriUygula(simdi);
  console.log(`${sayi} birleşme uygulandı.`);
}

await prisma.$disconnect();
