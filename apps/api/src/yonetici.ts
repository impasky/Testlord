/**
 * Yönetici yetkisi ver / al.
 *
 *   pnpm yonetici liste
 *   pnpm yonetici ver  ornek@site.com
 *   pnpm yonetici al   ornek@site.com
 *
 * Neden bir araç, neden elle SQL değil: yetki vermek nadir ama KRİTİK bir
 * iş ve elle yazılan bir UPDATE'in WHERE'ini unutmak bütün hesapları
 * yönetici yapar. Araç tek hesaba dokunuyor, hesabın var olduğunu
 * doğruluyor ve ne yaptığını yazıyor.
 */
import { prisma } from './db.js';

function kullanim(): never {
  console.error(
    [
      'Kullanım:',
      '  pnpm yonetici liste            — yetkili hesapları listeler',
      '  pnpm yonetici ver <eposta>     — yetki verir',
      '  pnpm yonetici al  <eposta>     — yetkiyi geri alır',
    ].join('\n'),
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const [komut, eposta] = process.argv.slice(2);

  if (komut === 'liste') {
    const liste = await prisma.user.findMany({
      where: { yonetici: true },
      select: { email: true, createdAt: true },
      orderBy: { email: 'asc' },
    });
    if (liste.length === 0) {
      console.log('Hiç yönetici yok. "pnpm yonetici ver <eposta>" ile ekle.');
      return;
    }
    console.log(`${liste.length} yönetici:`);
    for (const u of liste) console.log(`  ${u.email}`);
    return;
  }

  if ((komut !== 'ver' && komut !== 'al') || !eposta) kullanim();

  const u = await prisma.user.findUnique({
    where: { email: eposta.toLowerCase() },
    select: { id: true, email: true, yonetici: true },
  });
  if (!u) {
    console.error(`Böyle bir hesap yok: ${eposta}`);
    process.exit(1);
  }

  const hedef = komut === 'ver';
  if (u.yonetici === hedef) {
    console.log(`${u.email} zaten ${hedef ? 'yönetici' : 'yönetici değil'}. Bir şey yapılmadı.`);
    return;
  }

  await prisma.user.update({ where: { id: u.id }, data: { yonetici: hedef } });
  console.log(`${u.email} artık ${hedef ? 'YÖNETİCİ' : 'yönetici değil'}.`);
  if (hedef) {
    console.log('Şikâyet kuyruğu: Hesap ekranından "Şikâyet kuyruğu" ile açılır.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
