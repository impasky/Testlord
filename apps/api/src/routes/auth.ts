import { B, GEAR_LINES, WORLD_MAP } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { adiDenetle } from '../services/adDenetimi.js';
import { postaGonder } from '../services/eposta.js';
import { findOrOpenWorld } from '../services/world.js';

/** Jetonun özeti saklanır; ham jeton yalnızca e-postada gider. */
function ozet(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

const JETON_OMRU_DK = 30;

/**
 * Kayıt ve giriş IP başına sınırlanır, oturum başına değil: token'ı olmayan
 * isteklerde sayılacak başka bir şey yok ve asıl korunmak istenen şey kaba
 * kuvvet denemesi. Genel sınır (bkz. index.ts) oturuma bağlı olduğu için
 * buradaki ayrı yapılandırma gerekiyor.
 */
const kimlikSiniri = {
  config: {
    rateLimit: {
      max: env.AUTH_RATE_LIMIT_MAX,
      timeWindow: '1 minute',
      keyGenerator: (req: { ip: string }) => `ip:${req.ip}`,
    },
  },
};

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

const sifirlamaIsteSchema = z.object({ email: z.string().email() });
const sifirlamaYapSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8, 'Parola en az 8 karakter olmalı.'),
});

/**
 * Yeni lordun kampına çıpa verir: en az lord barındıran KÖY.
 *
 * Köyler haritanın kenarına dağılmış (world-map.json) ve oyunun ilk fethi
 * hep bir köy. Kampı bir köyün yanına kurmak, o köyü ilk hedef hâline
 * getiriyor: oyuncu doğar doğmaz "şurası alınabilir" diyebileceği bir yer
 * görüyor ve kimse güçlü bir komşunun dibinde uyanmıyor.
 *
 * Eskiden ölçüt haritanın dış halkasıydı; halka kavramı altıgenle birlikte
 * kalktı ve yerini bölge TÜRÜ aldı — daha okunur bir ölçüt, çünkü "kenar"
 * geometrik bir tesadüftü, "köy" ise tasarımın kendisi.
 */
async function pickHomeAnchor(worldId: string): Promise<number> {
  // Köy yoksa (henüz tazelenmemiş eski bir dünya) haritanın tamamına
  // düşüyoruz: kayıt hiçbir koşulda çökmemeli.
  const koyler = WORLD_MAP.regions.filter((r) => r.type === 'koy');
  const adaylar = koyler.length > 0 ? koyler : WORLD_MAP.regions;
  const mevcut = await prisma.lord.groupBy({
    by: ['homeBolgeId'],
    where: { worldId },
    _count: { _all: true },
  });
  const yuk = new Map(mevcut.map((m) => [m.homeBolgeId, m._count?._all ?? 0]));
  let enIyi = adaylar[0]!;
  let enAz = Infinity;
  for (const koy of adaylar) {
    const n = yuk.get(koy.id) ?? 0;
    if (n < enAz) {
      enAz = n;
      enIyi = koy;
    }
  }
  return enIyi.id;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', kimlikSiniri, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    // Ad denetimi benzersizlik kontrolünden ÖNCE: uygunsuz bir adın
    // "alınmış" mı diye sorgulanması bile gereksiz.
    const adSonuc = adiDenetle(body.lordName);
    if (!adSonuc.uygun) {
      throw new GameError(adSonuc.sebep ?? 'Bu ad kullanılamaz.', 400, 'AD_UYGUNSUZ');
    }

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
          homeBolgeId: home,
          // Kamp bir yokluk değil, küçük bir başlangıç: bir çadır ve bir
          // talimgah. Sıfırdan başlasaydı öğreticinin ilk cümlesi ("asker
          // eğit") boş bir arsaya çarpardı.
          binalar: B.binalar.baslangic,
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

  app.post('/auth/login', kimlikSiniri, async (req) => {
    const body = loginSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      throw new GameError('E-posta veya parola hatalı.', 401, 'GIRIS_BASARISIZ');
    }
    return { token: app.jwt.sign({ userId: user.id, email }) };
  });

  /**
   * Parola sıfırlama isteği.
   *
   * Adres kayıtlı olsa da olmasa da AYNI cevabı döner. Farklı cevap vermek,
   * hangi e-postaların kayıtlı olduğunu sızdıran bir sorgu aracına dönerdi.
   */
  app.post('/auth/sifirlama-iste', kimlikSiniri, async (req) => {
    const { email } = sifirlamaIsteSchema.parse(req.body);
    const adres = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: adres } });

    if (user) {
      // Eski jetonları geçersiz kıl: aynı anda birden fazla açık jeton,
      // saldırganın deneyeceği yüzeyi büyütür.
      await prisma.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const jeton = randomBytes(32).toString('base64url');
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: ozet(jeton),
          expiresAt: new Date(Date.now() + JETON_OMRU_DK * 60_000),
        },
      });

      const bag = `${env.uygulamaUrl}/#/parola-sifirla?jeton=${jeton}`;
      await postaGonder(
        {
          kime: adres,
          konu: 'Lordlar Çağı — parola sıfırlama',
          metin:
            `Parolanı sıfırlamak için ${JETON_OMRU_DK} dakika içinde bu bağlantıyı aç:\n\n${bag}\n\n` +
            'Bu isteği sen yapmadıysan hiçbir şey yapmana gerek yok; parolan değişmedi.',
        },
        app.log,
      );

      // Geliştirmede jetonu cevaba koyuyoruz ki akış uçtan uca test
      // edilebilsin. Üretimde ASLA: jeton yalnızca e-postayla gitmeli.
      // Aynı koruma /api/test/* uçlarını da kapatan koşul.
      if (env.NODE_ENV !== 'production') {
        return { gonderildi: true, jeton };
      }
    }

    return { gonderildi: true };
  });

  /** Jetonla yeni parola belirler. Jeton tek kullanımlık. */
  app.post('/auth/sifirlama-yap', kimlikSiniri, async (req) => {
    const { token, password } = sifirlamaYapSchema.parse(req.body);
    const kayit = await prisma.passwordReset.findUnique({ where: { tokenHash: ozet(token) } });

    if (!kayit || kayit.usedAt || kayit.expiresAt < new Date()) {
      throw new GameError(
        'Bağlantı geçersiz ya da süresi dolmuş. Yeniden sıfırlama iste.',
        400,
        'JETON_GECERSIZ',
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: kayit.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.passwordReset.update({ where: { id: kayit.id }, data: { usedAt: new Date() } }),
    ]);

    return { degistirildi: true };
  });
}
