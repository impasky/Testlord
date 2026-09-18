/**
 * TEMİZ KESME — çok diyarlı dünyadan tek medeniyet dünyasına (docs/16).
 *
 * NEDEN ŞİMDİ: `docs/16` §12'nin son cümlesi. Medeniyet sistemi bölgenin
 * SAHİPLİĞİNİ değiştiriyor — toprak artık lordun değil medeniyetin.
 * Bugün bu bir silme işi; gerçek oyuncu geldikten sonra aynı iş bir göç
 * ameliyatı olurdu. Geliştirme veritabanındaki her şey test verisi:
 * yük testinin bıraktığı yüzlerce diyar ve on binlerce lord.
 *
 * NE YAPIYOR:
 *   1. BÜTÜN diyarları siler (cascade: lord, bölge, ordu, yürüyüş, savaş).
 *   2. Lordu kalmamış hesapları siler — YÖNETİCİ hesapları hariç.
 *   3. Tek bir diyar açar; o diyar dört medeniyetiyle birlikte doğar.
 *
 * YÖNETİCİ NEDEN VARSAYILAN OLARAK KALIYOR: yetki oyundaki karaktere
 * değil arkasındaki insana verilmiş (bkz. `User.yonetici` şema notu).
 * Oyun verisini silmek bir erişim hakkını silmeyi gerektirmiyor. Ama
 * geliştirme veritabanındaki yönetici satırlarının hepsi
 * `moderasyon-testi`nin ürettiği hesaplar; gerçekten temiz bir slayt
 * isteniyorsa `--yoneticileri-de` onları da alır. Bayrak var çünkü
 * KARAR operatörün: güvenli olan varsayılan, geniş olan istenerek
 * seçilir. Korunan ya da silinen her yönetici adresi ekrana basılıyor —
 * hiçbir hesap sessizce kaybolmuyor.
 *
 * KULLANIM:
 *   pnpm temiz-kesme                            # yalnız raporlar, silmez
 *   pnpm temiz-kesme --uygula                   # siler, yöneticileri korur
 *   pnpm temiz-kesme --uygula --yoneticileri-de # lordsuz yöneticileri de siler
 *
 * ÜRETİMDE ÇALIŞMAZ. `dunya-temizle` yalnız yorumda "sadece geliştirme"
 * diyor; bu betik geri alınamaz olanı yaptığı için kuralı koda bağlıyor.
 */
import { MEDENIYETLER } from '@lordlar/shared';
import { prisma } from './db.js';
import { env } from './env.js';
import { createWorld } from './services/world.js';

const UYGULA = process.argv.includes('--uygula');
const YONETICILERI_DE = process.argv.includes('--yoneticileri-de');

if (env.NODE_ENV === 'production') {
  console.error('Bu betik üretimde çalışmaz: geri alınamaz ve bütün oyun verisini siler.');
  process.exit(1);
}

const [dunya, lord, bolge, kullanici, yoneticiler] = await Promise.all([
  prisma.world.count(),
  prisma.lord.count(),
  prisma.region.count(),
  prisma.user.count(),
  prisma.user.findMany({ where: { yonetici: true }, select: { email: true } }),
]);

console.log('\nTEMİZ KESME — silinecekler:\n');
console.log(`  ${dunya} diyar`);
console.log(`  ${lord} lord`);
console.log(`  ${bolge} bölge`);
console.log(
  `  ${YONETICILERI_DE ? kullanici : kullanici - yoneticiler.length} hesap` +
    (YONETICILERI_DE ? ' (yöneticiler dahil)' : ''),
);
if (yoneticiler.length > 0) {
  console.log(
    `\n${yoneticiler.length} yönetici hesabı ${YONETICILERI_DE ? 'SİLİNECEK' : 'korunacak'}:`,
  );
  for (const y of yoneticiler) console.log(`  ${y.email}`);
  if (!YONETICILERI_DE) {
    console.log('  (bunları da silmek için: --yoneticileri-de)');
  }
}
console.log(`\nYerine: 1 diyar, ${MEDENIYETLER.length} medeniyet, sahipsiz çekişmeli orta.\n`);

if (!UYGULA) {
  console.log('Bu bir PROVA. Gerçekten yapmak için: pnpm temiz-kesme --uygula\n');
  await prisma.$disconnect();
  process.exit(0);
}

/*
 * Diyarlar TEK ifadeyle siliniyor, tek tek değil.
 *
 * `dunya-temizle` tek tek siliyor çünkü orada AYIKLAMA var: canlı
 * diyarlar arasından ölüleri seçiyor ve yarıda kalan bir işlem bütün
 * seçimi geri alırdı. Burada ayıklama yok — hepsi gidiyor. Cascade'i
 * veritabanına tek seferde yaptırmak hem hızlı hem de yarım kalmıyor.
 */
console.log('Diyarlar siliniyor…');
const silinenDunya = await prisma.world.deleteMany({});

/*
 * Lordu kalmamış hesaplar: oyun verisi gitti, geriye yalnız e-posta ve
 * parola özeti kaldı. Bunları bırakmak, girince "lordun yok" diyen
 * on beş bin hesap demekti.
 */
console.log('Lordsuz hesaplar siliniyor…');
const silinenKullanici = await prisma.user.deleteMany({
  where: { lords: { none: {} }, ...(YONETICILERI_DE ? {} : { yonetici: false }) },
});

console.log('Yeni diyar açılıyor…');
const worldId = await createWorld();

const [w, bolgeSayisi, medeniyetler, yatirim] = await Promise.all([
  prisma.world.findUniqueOrThrow({ where: { id: worldId }, select: { name: true } }),
  prisma.region.count({ where: { worldId } }),
  prisma.medeniyet.findMany({ where: { worldId }, select: { key: true } }),
  prisma.cekirdekYatirim.count({ where: { medeniyet: { worldId } } }),
]);
const sahipli = await prisma.region.count({
  where: { worldId, ownerMedeniyetId: { not: null } },
});

console.log(
  `\n${silinenDunya.count} diyar ve ${silinenKullanici.count} hesap silindi.\n` +
    `${w.name} açıldı: ${bolgeSayisi} bölge, ${medeniyetler.length} medeniyet ` +
    `(${medeniyetler.map((m) => m.key).join(', ')}), ` +
    `${sahipli} bölge yurt sahipli, ${bolgeSayisi - sahipli} çekişmeli, ` +
    `${yatirim} çekirdek yatırım satırı.\n`,
);

await prisma.$disconnect();
