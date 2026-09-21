import { dogrulamaDurumu, yasakDurumu } from '@lordlar/shared';
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
 * Doğrulama kapısından MUAF uçlar.
 *
 * Doğrulanmamış oyuncunun yapabilmesi gereken tek şey doğrulamak ve
 * çıkmak. Bu liste olmasaydı "e-postanı doğrula" diyen bir ekranda
 * doğrulama düğmesi de 403 alırdı.
 */
const DOGRULAMA_MUAF = new Set([
  '/api/auth/dogrulama-gonder',
  '/api/auth/dogrula',
  '/api/moderasyon/durum',
]);

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
    select: {
      yasakli: true,
      yasakBitis: true,
      yasakSebebi: true,
      epostaDogrulandi: true,
      createdAt: true,
    },
  });
  if (!u) throw new GameError('Giriş yapman gerekiyor.', 401, 'YETKISIZ');
  const simdi = new Date();
  const y = yasakDurumu(u.yasakli, u.yasakBitis, u.yasakSebebi, simdi);
  if (y.yasakli) throw new GameError(y.metin ?? 'Hesabın yasaklı.', 403, 'YASAKLI');

  /*
   * Serbest süre dolduysa ELİNDEKİ JETON da çalışmıyor.
   *
   * Yalnız girişi kapatmak yetmezdi: açık bir oturumu olan oyuncu yedi
   * gün daha oynamaya devam ederdi ve kapı ancak jeton ölünce kapanırdı.
   * Doğrulama ucunun kendisi bu denetimin dışında (aşağıdaki muafiyet),
   * yoksa oyuncu doğrulamak için giremediği bir kapıya çarpardı.
   */
  if (!DOGRULAMA_MUAF.has(req.url.split('?')[0] ?? '')) {
    const d = dogrulamaDurumu(u.epostaDogrulandi, u.createdAt, simdi);
    if (d.girisKapali) throw new GameError(d.metin ?? 'E-postanı doğrula.', 403, 'DOGRULANMADI');
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
