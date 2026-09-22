import {
  B,
  BASLANGIC_ELMASI,
  GEAR_LINES,
  WORLD_MAP,
  dogrulamaDurumu,
  gonderilebilirMi,
  jetonGecerli,
  yasakDurumu,
  yurtBolgeleri,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, requireAuth, verifyPassword } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { adiDenetle } from '../services/adDenetimi.js';
import { postaGonder } from '../services/eposta.js';
import { girisFreni } from '../services/girisFreni.js';
import { dogrulamaGonder, ozet as dogrulamaOzeti } from '../services/epostaDogrulama.js';
import { medeniyetAta } from '../services/medeniyet.js';
import { AKTIF_GUN, diyarDoluMu, findOrOpenWorld } from '../services/world.js';

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
  /*
   * Hangi diyara girileceği. İSTEĞE BAĞLI: verilmezse eskisi gibi sistem
   * seçiyor, yani seçim yapmayan oyuncu için hiçbir şey değişmiyor.
   * Verilirse oyuncunun arkadaşıyla aynı haritada oynaması için tek yol
   * bu, o yüzden sessizce başka bir diyara yönlendirme YOK: dolmuşsa
   * hata dönüyor ve oyuncu bilerek başka bir diyar seçiyor.
   */
  worldId: z.string().min(1).optional(),
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
 * Yeni lordun kampına çıpa verir: KENDİ YURDUNDA, en az lord barındıran KÖY.
 *
 * Köyler haritanın kenarına dağılmış (world-map.json) ve oyunun ilk fethi
 * hep bir köy. Kampı bir köyün yanına kurmak, o köyü ilk hedef hâline
 * getiriyor: oyuncu doğar doğmaz "şurası alınabilir" diyebileceği bir yer
 * görüyor ve kimse güçlü bir komşunun dibinde uyanmıyor.
 *
 * Eskiden ölçüt haritanın dış halkasıydı; halka kavramı altıgenle birlikte
 * kalktı ve yerini bölge TÜRÜ aldı — daha okunur bir ölçüt, çünkü "kenar"
 * geometrik bir tesadüftü, "köy" ise tasarımın kendisi.
 *
 * `yurt` medeniyetle geldi (docs/16 §8): oyuncunun kampı kendi
 * medeniyetinin toprağında kurulur. Yoksa dört medeniyete bölünmüş bir
 * haritada oyuncu rastgele birinin yurdunda doğar ve daha ilk gün
 * "buranın neresi benim" diye sorar. Boş dizi "sınırlama yok" demek ve
 * medeniyetsiz eski diyarlarda eski davranışı aynen koruyor.
 */
async function pickHomeAnchor(worldId: string, yurt: number[]): Promise<number> {
  /*
   * Adaylar DÜNYANIN KENDİ bölgelerinden okunuyor, kanonik dosyadan değil.
   *
   * Bir dünya kendi harita sürümünü taşıyor (docs/12 §14): kanonik dosyada
   * köy olan numara, eski haritalı bir dünyada bambaşka bir yer olabilir.
   * Kanonik dosyaya bakmak, oyuncuyu var olmayan bir köyün yanına
   * kurdururdu. Bugün böyle bir dünyaya kayıt açılmıyor (eski haritalı
   * dünyalar kapatılıyor) ama kuralı veriye bağlamak, o korumayı
   * unutulabilir olmaktan çıkarıyor.
   */
  const koyler = await prisma.region.findMany({
    where: { worldId, type: 'koy', ...(yurt.length > 0 ? { mapId: { in: yurt } } : {}) },
    select: { mapId: true },
    orderBy: { mapId: 'asc' },
  });
  /*
   * Köy yoksa geri çekiliyoruz: önce yurdun tamamına, sonra diyarın
   * tamamına. Kayıt hiçbir koşulda çökmemeli — ne henüz tazelenmemiş
   * eski bir dünyada, ne de yurdunda köy kalmamış bir medeniyette.
   * (Bugünkü haritada her yurtta köy var ve `medeniyet.test.ts` bunu
   * sınıyor; bu dallar o sınama bir gün kalırsa diye duruyor.)
   */
  const adaylar =
    koyler.length > 0
      ? koyler
      : await prisma.region.findMany({
          where: { worldId, ...(yurt.length > 0 ? { mapId: { in: yurt } } : {}) },
          select: { mapId: true },
          orderBy: { mapId: 'asc' },
        });
  if (adaylar.length === 0) {
    const hepsi = await prisma.region.findMany({
      where: { worldId },
      select: { mapId: true },
      orderBy: { mapId: 'asc' },
    });
    return hepsi[0]?.mapId ?? WORLD_MAP.regions[0]!.id;
  }

  const mevcut = await prisma.lord.groupBy({
    by: ['homeBolgeId'],
    where: { worldId },
    _count: { _all: true },
  });
  const yuk = new Map(mevcut.map((m) => [m.homeBolgeId, m._count?._all ?? 0]));
  let enIyi = adaylar[0]!;
  let enAz = Infinity;
  for (const koy of adaylar) {
    const n = yuk.get(koy.mapId) ?? 0;
    if (n < enAz) {
      enAz = n;
      enIyi = koy;
    }
  }
  return enIyi.mapId;
}

/**
 * Oyuncunun SEÇTİĞİ diyarı doğrular.
 *
 * Kapalı, dolu ya da olmayan bir diyar için hata dönüyor — sessizce başka
 * bir diyara koymuyor. Oyuncu bu alanı doldurduysa sebebi vardır
 * (arkadaşı orada) ve "seni başka yere koydum" onun için kayıt hatasından
 * daha kötü bir sonuç.
 *
 * Kapasite denetimi kılpayı yarışa açık: iki kayıt aynı anda son yeri
 * alabilir. Kabul edilebilir — kapasite bölge/oyuncu oranını KABACA tutmak
 * için var (0.50, `balance.test.ts` 0.75 tavanıyla koruyor) ve bir iki
 * kişilik taşma o oranı kımıldatmıyor. Yanlış diyara düşmek ise kabul
 * edilebilir değil; o yüzden yarışı burada değil, yönlendirmede kapattık.
 */
async function secilenDiyar(worldId: string): Promise<string> {
  const w = await prisma.world.findUnique({
    where: { id: worldId },
    select: { id: true, status: true, playerCap: true },
  });
  if (!w || w.status === 'closed') {
    throw new GameError('Böyle bir diyar yok.', 404, 'DIYAR_YOK');
  }
  /*
   * Doluluk ölçütü `diyarDoluMu` — listeyi üreten kodla AYNI işlev.
   * `status` damgasına bakmıyoruz: damga ucuz okuma için tutulan bir
   * önbellek ve listeden bir tur geride kalabiliyor. Oyuncuyu, listede
   * gördüğü bir diyara girerken eski bir damga yüzünden reddetmek en
   * kötüsü olurdu.
   */
  const aktifSinir = new Date(Date.now() - AKTIF_GUN * 86_400_000);
  const [sayi, aktif] = await Promise.all([
    prisma.lord.count({ where: { worldId: w.id } }),
    prisma.lord.count({ where: { worldId: w.id, lastSeenAt: { gte: aktifSinir } } }),
  ]);
  if (diyarDoluMu(sayi, aktif, w.playerCap)) {
    throw new GameError('O diyar doldu. Başka bir diyar seç.', 409, 'DIYAR_DOLU');
  }
  return w.id;
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

    const worldId = body.worldId ? await secilenDiyar(body.worldId) : await findOrOpenWorld();
    /*
     * MEDENİYET KAYITTA ATANIYOR, SEÇİLMİYOR (docs/16 §10).
     *
     * Serbest seçim, dört fraksiyonlu bir oyunun en bilinen çöküş yolu:
     * öne geçen medeniyet yeni oyuncu çeker, daha da öne geçer ve harita
     * üç ay sonra tek renge boyanır. Sayım bunu kendiliğinden kapatıyor —
     * aktif nüfusu ortalamanın üstünde olan medeniyet kayda kapalı.
     *
     * Kural saf katmanda (`atanacakMedeniyet`), burada yalnız uygulaması
     * var. İki kayıt aynı anda gelip aynı medeniyeti alabilir; denge
     * yaklaşık tutulduğu için bu kabul edilebilir bir yarış.
     */
    const med = await medeniyetAta(worldId);
    const home = await pickHomeAnchor(worldId, yurtBolgeleri(med.key));
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
          medeniyetId: med.id,
          name: body.lordName,
          guc: stats.guc,
          dayaniklilik: stats.dayaniklilik,
          liderlik: stats.liderlik,
          kurnazlik: stats.kurnazlik,
          altin: start.altin,
          demir: start.demir,
          erzak: start.erzak,
          // Küçük bir elmas kesesi. Para biriminin ne işe yaradığını
          // ANLATMAK yerine bir kez KULLANDIRMAK, onu öğretmenin tek
          // işe yarayan yolu; cüzdanı boş oyuncu düğmeye hiç basmaz.
          elmas: BASLANGIC_ELMASI,
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

    /*
     * DOĞRULAMA POSTASI KAYITTA ÇIKIYOR ama hiçbir kapı kapatmıyor.
     *
     * Oyuncu jetonu beklemeden oynamaya başlıyor: "ilk saldırı
     * dakikalarda bitsin" (docs/08) kuralı, yeni oyuncuyu posta
     * kutusuna göndermeyi yasaklıyor. Posta çıkmazsa kayıt yine de
     * tamamlanıyor — `postaGonder` hata fırlatmıyor ve fren de
     * atlanıyor: ilk gönderim oyuncunun eylemi değil, bizim borcumuz.
     */
    await dogrulamaGonder(user.id, email, req.log, false);

    const token = app.jwt.sign({ userId: user.id, email, sv: user.oturumSurumu });
    return reply.code(201).send({ token });
  });

  /* ---------------------------------------------------------------- */
  /* E-posta doğrulama                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Yeniden gönder.
   *
   * Girişli bir uç: adres gövdeden DEĞİL jetondan okunuyor. Adresi
   * gövdeden alsaydı, herkesin adresine doğrulama postası yollayan bir
   * araç olurdu.
   */
  app.post('/auth/dogrulama-gonder', { preHandler: requireAuth }, async (req) => {
    const u = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, epostaDogrulandi: true },
    });
    if (!u) throw new GameError('Bulunamadı.', 404, 'BULUNAMADI');
    if (u.epostaDogrulandi) return { gonderildi: false, zatenDogrulandi: true };

    await dogrulamaGonder(u.id, u.email, req.log);
    return { gonderildi: true, zatenDogrulandi: false };
  });

  /**
   * Jetonu damgaya çevirir.
   *
   * GİRİŞ GEREKTİRMİYOR: posta başka bir cihazda açılabilir ve oradaki
   * tarayıcıda oturum olmayabilir. Jetonun kendisi zaten kimliğin
   * kanıtı; üstüne giriş istemek, doğrulamayı en çok ihtiyaç duyulan
   * durumda (parolasını unutmuş oyuncu) imkânsız kılardı.
   */
  app.post('/auth/dogrula', kimlikSiniri, async (req) => {
    const { jeton } = z.object({ jeton: z.string().min(10) }).parse(req.body);
    const kayit = await prisma.epostaDogrulama.findUnique({
      where: { tokenHash: dogrulamaOzeti(jeton) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    const simdi = new Date();
    if (!kayit || !jetonGecerli(kayit.expiresAt, kayit.usedAt, simdi)) {
      throw new GameError(
        'Bağlantı geçersiz ya da süresi dolmuş. Yeni bir tane iste.',
        400,
        'JETON_GECERSIZ',
      );
    }

    await prisma.$transaction([
      prisma.epostaDogrulama.update({ where: { id: kayit.id }, data: { usedAt: simdi } }),
      prisma.user.update({ where: { id: kayit.userId }, data: { epostaDogrulandi: simdi } }),
    ]);
    return { dogrulandi: true };
  });

  app.post('/auth/login', kimlikSiniri, async (req) => {
    const body = loginSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    // Hesap başına fren (services/girisFreni.ts): IP freni tek başına
    // tek hesaba günde on binlerce tahmine izin veriyordu.
    const fren = girisFreni.durum(email);
    if (fren.kilitli) {
      throw new GameError(
        `Çok fazla hatalı deneme. ${fren.kalanDk} dakika sonra yeniden dene ya da parolanı sıfırla.`,
        429,
        'GIRIS_KILITLI',
      );
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      girisFreni.hata(email);
      throw new GameError('E-posta veya parola hatalı.', 401, 'GIRIS_BASARISIZ');
    }
    girisFreni.temizle(email);
    /*
     * Yasak GİRİŞTE de söyleniyor.
     *
     * `requireAuth` zaten her isteği kesiyor; buradaki denetim jetonu hiç
     * vermemek için. Jeton verip her istekte reddetmek, oyuncuya "giriş
     * yaptın ama hiçbir şey çalışmıyor" gibi görünürdü — sebebini
     * söylemeyen bir ceza davranışı değiştirmiyor.
     */
    const simdi = new Date();
    const y = yasakDurumu(user.yasakli, user.yasakBitis, user.yasakSebebi, simdi);
    if (y.yasakli) throw new GameError(y.metin ?? 'Hesabın yasaklı.', 403, 'YASAKLI');

    /*
     * Serbest süre dolduysa giriş doğrulama istiyor.
     *
     * Kapanmasaydı doğrulama bir temenni olurdu: kimse doğrulamaz,
     * parolasını unutan da hesabını yine kaybederdi. Kapı burada
     * kapanıyor ama oyuncu ilk yedi günü hiç görmeden oynadı.
     */
    const d = dogrulamaDurumu(user.epostaDogrulandi, user.createdAt, simdi);
    if (d.girisKapali) {
      throw new GameError(d.metin ?? 'E-postanı doğrula.', 403, 'DOGRULANMADI');
    }
    return { token: app.jwt.sign({ userId: user.id, email, sv: user.oturumSurumu }) };
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

    /*
     * GÖNDERİM FRENİ — doğrulama postasıyla aynı kural (`gonderilebilirMi`).
     *
     * Frensiz bu uç, herhangi birinin adresine dakikada onlarca posta
     * yağdıran bir araçtı: adresi bilmek yetiyordu, giriş gerekmiyordu.
     * Tek fren IP başınaydı ve IP değiştirmek ucuz. Ayrıca her posta
     * sağlayıcının kotasından ve alan adının itibarından yiyor.
     *
     * Frene takılınca cevap DEĞİŞMİYOR: "çok hızlı" demek, o adresin
     * kayıtlı olduğunu söylemek olurdu.
     */
    const frenli = user
      ? await (async () => {
          const simdi = new Date();
          const [son, bugunku] = await Promise.all([
            prisma.passwordReset.findFirst({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' },
              select: { createdAt: true },
            }),
            prisma.passwordReset.count({
              where: {
                userId: user.id,
                createdAt: { gte: new Date(simdi.getTime() - 86_400_000) },
              },
            }),
          ]);
          return !gonderilebilirMi(son?.createdAt ?? null, bugunku, simdi).uygun;
        })()
      : false;

    if (user && !frenli) {
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
          metin: `Parolanı sıfırlamak için ${JETON_OMRU_DK} dakika içinde bu bağlantıyı aç:\n\n${bag}\n\nBu isteği sen yapmadıysan hiçbir şey yapmana gerek yok; parolan değişmedi.`,
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

    /*
     * Jeton TEK KULLANIMLIK ve bu koşullu yazmayla gerçekten öyle: aynı
     * bağlantıya iki kez aynı anda basılınca yukarıdaki okuma ikisinde de
     * "kullanılmamış" diyordu. `usedAt: null` şartı yalnız birine izin
     * veriyor.
     */
    // Özet işlemden ÖNCE: argon2 bilerek yavaş, işlemi o kadar açık tutmayalım.
    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      const yakalandi = await tx.passwordReset.updateMany({
        where: { id: kayit.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (yakalandi.count === 0) {
        throw new GameError(
          'Bağlantı geçersiz ya da süresi dolmuş. Yeniden sıfırlama iste.',
          400,
          'JETON_GECERSIZ',
        );
      }
      // Oturum sürümü artıyor: parolayı sıfırlamanın sebebi çoğu zaman
      // birinin hesaba girmiş olması, ve onun jetonu da burada ölüyor.
      await tx.user.update({
        where: { id: kayit.userId },
        data: { passwordHash, oturumSurumu: { increment: 1 } },
      });
    });

    return { degistirildi: true };
  });
}
