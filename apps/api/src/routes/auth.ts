import { B, GEAR_LINES, WORLD_MAP } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { findOrOpenWorld } from '../services/world.js';

const registerSchema = z.object({
  email: z.string().email('Geçerli bir e-posta gir.'),
  password: z.string().min(8, 'Parola en az 8 karakter olmalı.'),
  lordName: z
    .string()
    .min(3, 'Lord adı en az 3 karakter olmalı.')
    .max(20, 'Lord adı en fazla 20 karakter olabilir.')
    .regex(/^[\p{L}\p{N} _-]+$/u, 'Lord adında geçersiz karakter var.'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Yeni lorda malikâne çıpası verir: ring 4'te (haritanın kenarı) en az lord
 * barındıran hex. Böylece oyuncular başlangıçta haritaya yayılır ve kimse
 * doğar doğmaz güçlü bir komşunun dibinde uyanmaz.
 */
async function pickHomeAnchor(worldId: string): Promise<{ q: number; r: number }> {
  const kenar = WORLD_MAP.regions.filter((r) => r.ring === 4);
  const mevcut = await prisma.lord.groupBy({
    by: ['homeQ', 'homeR'],
    where: { worldId },
    _count: { _all: true },
  });
  const yuk = new Map(mevcut.map((m) => [`${m.homeQ},${m.homeR}`, m._count._all]));
  let enIyi = kenar[0]!;
  let enAz = Infinity;
  for (const hex of kenar) {
    const n = yuk.get(`${hex.q},${hex.r}`) ?? 0;
    if (n < enAz) {
      enAz = n;
      enIyi = hex;
    }
  }
  return { q: enIyi.q, r: enIyi.r };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    if (await prisma.user.findUnique({ where: { email } })) {
      throw new GameError('Bu e-posta zaten kayıtlı.', 409, 'EPOSTA_KAYITLI');
    }
    if (await prisma.lord.findFirst({ where: { name: body.lordName } })) {
      throw new GameError('Bu lord adı alınmış.', 409, 'AD_ALINMIS');
    }

    const worldId = await findOrOpenWorld();
    const home = await pickHomeAnchor(worldId);
    const now = new Date();
    const start = B.lord.baslangic_kaynaklari;
    const stats = B.lord.baslangic_statlari;

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash: await hashPassword(body.password) },
      });
      await tx.lord.create({
        data: {
          userId: u.id,
          worldId,
          name: body.lordName,
          guc: stats.guc,
          dayaniklilik: stats.dayaniklilik,
          liderlik: stats.liderlik,
          kurnazlik: stats.kurnazlik,
          altin: start.altin,
          demir: start.demir,
          erzak: start.erzak,
          homeQ: home.q,
          homeR: home.r,
          lastTickAt: now,
          dailyResetAt: now,
          // Yeni oyuncu kalkanı: ilk saldırısını yapana kadar veya 72 saat
          protectionUntil: new Date(now.getTime() + B.korumalar.yeni_oyuncu_saat * 3_600_000),
          gearLines: { create: GEAR_LINES.map((line) => ({ line, level: 0 })) },
        },
      });
      return u;
    });

    const token = app.jwt.sign({ userId: user.id, email });
    return reply.code(201).send({ token });
  });

  app.post('/auth/login', async (req) => {
    const body = loginSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      throw new GameError('E-posta veya parola hatalı.', 401, 'GIRIS_BASARISIZ');
    }
    return { token: app.jwt.sign({ userId: user.id, email }) };
  });
}
