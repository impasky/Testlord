import { yasakDurumu } from '@lordlar/shared';
import { hash, verify } from '@node-rs/argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './db.js';
import { GameError } from './errors.js';

export interface JwtPayload {
  userId: string;
  email: string;
}

/** argon2id — docs/03 §7 */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  return verify(hashed, plain).catch(() => false);
}

/**
 * Korunan uçlarda preHandler olarak kullanılır.
 *
 * YASAK HER İSTEKTE VERİTABANINDAN okunuyor, jetondan değil — `yonetici`
 * ile aynı gerekçe: yasaklanan hesabın elindeki jeton yedi gün daha
 * geçerli kalırdı ve yasak ancak jeton ölünce işlemeye başlardı. Bedeli
 * birincil anahtarla tek satır okumak; istek başına zaten onlarca sorgu
 * var, yasağın gecikmesinin bedeli ise oyuncunun yedi gün daha oynaması.
 */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    throw new GameError('Giriş yapman gerekiyor.', 401, 'YETKISIZ');
  }
  const u = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { yasakli: true, yasakBitis: true, yasakSebebi: true },
  });
  if (!u) throw new GameError('Giriş yapman gerekiyor.', 401, 'YETKISIZ');
  const y = yasakDurumu(u.yasakli, u.yasakBitis, u.yasakSebebi, new Date());
  if (y.yasakli) throw new GameError(y.metin ?? 'Hesabın yasaklı.', 403, 'YASAKLI');
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
