import { hash, verify } from '@node-rs/argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
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

/** Korunan uçlarda preHandler olarak kullanılır. */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    throw new GameError('Giriş yapman gerekiyor.', 401, 'YETKISIZ');
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
