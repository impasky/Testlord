/**
 * İttifak seviyesi ve ayrıcalıkları — tek okuma noktası.
 *
 * Seviye dört ayrı yerde okunuyor: ticaret tavanı, takviye süresi, keşif
 * maliyeti ve pakt kotası. Her birinde "ittifakı bul, xp'sini oku,
 * seviyeye çevir" yazsaydık, bir gün birinde ittifaksız oyuncunun
 * unutulması ve orada çökmesi demekti.
 *
 * İttifaksız oyuncu HER ZAMAN Sv1 ayrıcalıklarını alıyor: ittifak bir
 * avantaj, yokluğu bir ceza değil.
 */
import { ittifakAyricaliklari, ittifakSeviyesi, type IttifakAyricaliklari } from '@lordlar/shared';
import { prisma } from '../db.js';

type Istemci = Pick<typeof prisma, 'alliance'>;

export async function ittifakAyricaligi(
  allianceId: string | null,
  tx: Istemci = prisma,
): Promise<IttifakAyricaliklari> {
  if (!allianceId) return ittifakAyricaliklari(1);
  const a = await tx.alliance.findUnique({ where: { id: allianceId }, select: { xp: true } });
  return ittifakAyricaliklari(a ? ittifakSeviyesi(a.xp).seviye : 1);
}

/** Lorddan doğrudan: çağıranın ittifakı elinde olmadığında. */
export async function lordunAyricaligi(
  lordId: string,
  tx: Pick<typeof prisma, 'lord' | 'alliance'> = prisma,
): Promise<IttifakAyricaliklari> {
  const l = await tx.lord.findUnique({ where: { id: lordId }, select: { allianceId: true } });
  return ittifakAyricaligi(l?.allianceId ?? null, tx);
}
