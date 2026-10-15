/**
 * Yönetici ölçüm panosu — veritabanı tarafı. Hesap `olcumHesabi.ts`de
 * (saf, testli); burada yalnız pencerenin satırları okunuyor.
 */
import { gunNumarasi } from '@lordlar/shared';
import { prisma } from '../db.js';
import { PANO_GUN, panoHesapla, type OlcumPanosu } from './olcumHesabi.js';

export type { OlcumPanosu } from './olcumHesabi.js';

export async function olcumPanosu(simdi = new Date()): Promise<OlcumPanosu> {
  const bugun = gunNumarasi(simdi);
  const ilk = bugun - (PANO_GUN - 1);
  const [lordlar, aktiflik] = await Promise.all([
    prisma.lord.findMany({
      where: { isNpc: false, createdAt: { gte: new Date(ilk * 86_400_000) } },
      select: { id: true, createdAt: true },
    }),
    prisma.gunlukAktiflik.findMany({
      // Yedinci gün tutundurması için pencerenin ilk kohortu ilk+7'ye
      // bakıyor; o da pencerenin içinde. Pencereden önceki satır gerekmiyor.
      where: { gun: { gte: ilk }, lord: { isNpc: false } },
      select: { gun: true, lordId: true },
    }),
  ]);
  return panoHesapla({
    lordlar: lordlar.map((l) => ({ id: l.id, kayitGunu: gunNumarasi(l.createdAt) })),
    aktiflik,
    bugun,
  });
}

/**
 * Günün ilk açılışını yazar. Çağıran "bugün daha önce görülmedi" dediğinde
 * çağırıyor (`/me`, son görülme başka bir günse); yine de çakışma sessizce
 * geçiyor — aynı anda gelen iki istek ikinci satırı yazamaz.
 */
export async function aktiflikYaz(lordId: string, simdi = new Date()): Promise<void> {
  await prisma.gunlukAktiflik.createMany({
    data: [{ gun: gunNumarasi(simdi), lordId }],
    skipDuplicates: true,
  });
}
