/**
 * E-posta doğrulama — veritabanına ve postaya dokunan kısım.
 *
 * Saf mantık (`@lordlar/shared/epostaDogrulama`) süreleri ve frenleri
 * biliyor; burada jeton üretiliyor, özeti saklanıyor ve posta çıkıyor.
 *
 * Ham jeton yalnızca üretildiği anda var: veritabanına SHA-256 özeti
 * yazılıyor. Veritabanı sızarsa elindeki özetle kimse hesap
 * doğrulayamaz — `PasswordReset` ile aynı gerekçe.
 */
import { JETON_OMRU_SAAT, KISITLI_EYLEM_ADI, gonderilebilirMi, jetonBitisi } from '@lordlar/shared';
import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { GameError } from '../errors.js';
import { postaGonder } from './eposta.js';

export function ozet(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

type Log = { info: (o: object, m: string) => void; error: (o: object, m: string) => void };

/**
 * Yeni jeton üretip postayı yollar.
 *
 * `frenliMi` false iken fren atlanıyor: kayıt anındaki ilk gönderim
 * oyuncunun bir eylemi değil, bizim borcumuz. Fren "yeniden gönder"
 * düğmesi için var.
 */
export async function dogrulamaGonder(
  userId: string,
  eposta: string,
  log: Log,
  frenliMi = true,
): Promise<void> {
  const simdi = new Date();

  if (frenliMi) {
    const gunBasi = new Date(simdi.getTime() - 86_400_000);
    const [son, bugunku] = await Promise.all([
      prisma.epostaDogrulama.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.epostaDogrulama.count({ where: { userId, createdAt: { gte: gunBasi } } }),
    ]);
    const d = gonderilebilirMi(son?.createdAt ?? null, bugunku, simdi);
    if (!d.uygun) throw new GameError(d.sebep ?? 'Şimdi gönderilemez.', 429, 'COK_HIZLI');
  }

  /*
   * ESKİ JETONLAR GEÇERSİZ KILINIYOR.
   *
   * Aynı anda birden çok açık jeton, saldırganın deneyeceği yüzeyi
   * büyütüyor ve oyuncunun hangi postadaki bağlantıya basacağını
   * belirsiz kılıyor. Parola sıfırlamada da aynı karar.
   */
  await prisma.epostaDogrulama.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: simdi },
  });

  const jeton = randomBytes(32).toString('base64url');
  await prisma.epostaDogrulama.create({
    data: { userId, tokenHash: ozet(jeton), expiresAt: jetonBitisi(simdi) },
  });

  const bag = `${env.uygulamaUrl}/#/eposta-dogrula?jeton=${jeton}`;
  await postaGonder(
    {
      kime: eposta,
      konu: 'Lordlar Çağı — e-postanı doğrula',
      metin: `Hesabını doğrulamak için ${JETON_OMRU_SAAT} saat içinde bu bağlantıyı aç:\n\n${bag}\n\nBu hesabı sen açmadıysan hiçbir şey yapmana gerek yok.`,
    },
    log,
  );
}

/**
 * Doğrulanmadan yapılamayan eylemler için kapı.
 *
 * Üç yerde çağrılıyor: ittifak sohbeti, kaynak gönderme ve eşya pazarı
 * (ilan ve ön sipariş). Üçü de BAŞKA OYUNCUYA dokunuyor — kötüye
 * kullanımın geçtiği yer burası.
 * Oyunun kendisine (fetih, inşa, araştırma) dokunulmuyor: oynamayı
 * engellemek doğrulama değil, ceza olurdu.
 */
export async function dogrulamaKontrol(userId: string, eylem: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { epostaDogrulandi: true },
  });
  if (u?.epostaDogrulandi) return;
  const ad = KISITLI_EYLEM_ADI[eylem] ?? 'Bu eylem';
  throw new GameError(
    `${ad} için e-postanı doğrulaman gerekiyor. Hesap ekranından yeni bağlantı isteyebilirsin.`,
    403,
    'DOGRULANMADI',
  );
}
