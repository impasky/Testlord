/**
 * Pakt sorguları — "bu iki ittifak arasında yürürlükte bir pakt var mı".
 *
 * Tek yerde duruyor çünkü aynı soru üç yerde soruluyor: saldırı kilidi,
 * bölge listesi ve takviye. Kopyalasaydık biri bir gün unutulur ve
 * haritada "pakt var" yazan bölgeye saldırı geçerdi.
 */
import { paktKoruyorMu, paktTaraflari } from '@lordlar/shared';
import { prisma } from '../db.js';

type Istemci = Pick<typeof prisma, 'pakt'>;

/** İki ittifak arasında ŞU AN koruyan bir pakt var mı? */
export async function paktVarMi(
  a: string | null,
  b: string | null,
  tx: Istemci = prisma,
): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const [x, y] = paktTaraflari(a, b);
  const p = await tx.pakt.findUnique({
    where: { aId_bId: { aId: x, bId: y } },
    select: { durum: true, biterAt: true },
  });
  return p ? paktKoruyorMu({ durum: p.durum as never, biterAt: p.biterAt }) : false;
}

/**
 * Bir ittifakın ŞU AN korunan pakt yaptığı ittifakların kimlikleri.
 *
 * Harita listesi 61 bölgeyi tek seferde döndürüyor; bölge başına ayrı bir
 * pakt sorgusu 61 sorgu demekti. Küme bir kez kuruluyor.
 */
export async function paktliIttifaklar(
  ittifakId: string | null,
  tx: Istemci = prisma,
): Promise<Set<string>> {
  if (!ittifakId) return new Set();
  const satirlar = await tx.pakt.findMany({
    where: { OR: [{ aId: ittifakId }, { bId: ittifakId }] },
    select: { aId: true, bId: true, durum: true, biterAt: true },
  });
  const kume = new Set<string>();
  for (const p of satirlar) {
    if (!paktKoruyorMu({ durum: p.durum as never, biterAt: p.biterAt })) continue;
    kume.add(p.aId === ittifakId ? p.bId : p.aId);
  }
  return kume;
}

/** Kotayı dolduran pakt sayısı: yürürlükte olanlar (teklifler sayılmaz). */
export async function yururlukteMi(ittifakId: string, tx: Istemci = prisma): Promise<number> {
  return (await paktliIttifaklar(ittifakId, tx)).size;
}
