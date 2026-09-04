/**
 * Sevkiyat servisi: gönderilen kaynağın yolda geçen süresi ve varışı.
 *
 * Yürüyüşlerle aynı desen: kayıt `resolved` bayrağıyla korunuyor, worker
 * varış saati gelenleri çözüyor ve çözüm idempotent — koşullu updateMany
 * satırı alıyor, iki worker aynı yükü iki kez teslim edemiyor.
 */
import { gunlukTavan, yukAgirligi } from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { pushEvent, tickLord } from './lord.js';

/** Bugün gönderilen toplam ağırlık (altın karşılığı). */
export async function bugunGonderilen(lordId: string, tx: Tx = prisma): Promise<number> {
  const gunBasi = new Date(Math.floor(Date.now() / 86_400_000) * 86_400_000);
  const satirlar = await tx.shipment.findMany({
    where: { fromLordId: lordId, departAt: { gte: gunBasi } },
    select: { altin: true, demir: true, erzak: true },
  });
  return satirlar.reduce((t, s) => t + yukAgirligi(s), 0);
}

export async function sevkiyatOzeti(lordId: string) {
  const [giden, gelen, gonderilen] = await Promise.all([
    prisma.shipment.findMany({
      where: { fromLordId: lordId, resolved: false },
      orderBy: { arriveAt: 'asc' },
      include: { to: { select: { name: true } } },
    }),
    prisma.shipment.findMany({
      where: { toLordId: lordId, resolved: false },
      orderBy: { arriveAt: 'asc' },
      include: { from: { select: { name: true } } },
    }),
    bugunGonderilen(lordId),
  ]);

  const bicim = (s: {
    id: string;
    altin: number;
    demir: number;
    erzak: number;
    arriveAt: Date;
  }) => ({
    id: s.id,
    yuk: { altin: s.altin, demir: s.demir, erzak: s.erzak },
    arriveAt: s.arriveAt,
  });

  return {
    giden: giden.map((s) => ({ ...bicim(s), kime: s.to.name })),
    gelen: gelen.map((s) => ({ ...bicim(s), kimden: s.from.name })),
    gunlukTavan: gunlukTavan(),
    bugunGonderilen: gonderilen,
    kalanTavan: Math.max(0, gunlukTavan() - gonderilen),
  };
}

/**
 * Varmış bir sevkiyatı teslim eder. İdempotent.
 *
 * Depo tavanı burada da işliyor: sığmayan kısım kayboluyor ve alıcıya
 * SÖYLENİYOR. Sessizce kırpmak, gönderenin "100 bin yolladım" deyip
 * alıcının 20 bin görmesi demekti.
 */
export async function sevkiyatCoz(id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const alindi = await tx.shipment.updateMany({
      where: { id, resolved: false },
      data: { resolved: true },
    });
    if (alindi.count === 0) return false;

    const s = await tx.shipment.findUniqueOrThrow({
      where: { id },
      include: { from: { select: { name: true } } },
    });
    const once = await tickLord(s.toLordId, new Date(), tx);
    const tavan = once.storageCapacity;
    const sigan = (istenen: number, mevcut: number) =>
      Math.max(0, Math.min(istenen, tavan - mevcut));
    const verilen = {
      altin: sigan(s.altin, once.resources.altin),
      demir: sigan(s.demir, once.resources.demir),
      erzak: sigan(s.erzak, once.resources.erzak),
    };

    await tx.lord.update({
      where: { id: s.toLordId },
      data: {
        altin: { increment: verilen.altin },
        demir: { increment: verilen.demir },
        erzak: { increment: verilen.erzak },
      },
    });

    const kirpildi =
      verilen.altin < s.altin || verilen.demir < s.demir || verilen.erzak < s.erzak;
    await pushEvent(
      s.toLordId,
      'sevkiyat_geldi',
      {
        mesaj:
          `${s.from.name} sana kaynak yolladı: ` +
          `${verilen.altin} altın, ${verilen.demir} demir, ${verilen.erzak} erzak.` +
          (kirpildi ? ' Deponun bir kısmı doluydu; sığan kadarı alındı.' : ''),
      },
      tx,
    );
    return true;
  });
}
