/**
 * Moderasyon yardımcıları: yetki, susturma kontrolü, karar kaydı.
 *
 * Saf mantık `@lordlar/shared/moderasyon` içinde; burada yalnız
 * veritabanına dokunan kısım var.
 */
import { kararMetni, susturmaDurumu, type ModerasyonKarari } from '@lordlar/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';

/**
 * Yönetici koruması.
 *
 * `requireAuth`den SONRA çalışır ve yetkiyi her istekte VERİTABANINDAN
 * okur, jetondan değil: yetki alınan bir hesabın elindeki jeton yedi gün
 * daha geçerli kalırdı.
 */
export async function requireYonetici(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { yonetici: true },
  });
  if (!u?.yonetici) {
    // Kuyruğun VARLIĞINI de sızdırmıyor: yetkisiz için bu uç yok.
    throw new GameError('Bulunamadı.', 404, 'BULUNAMADI');
  }
}

/**
 * Susturulmuş bir lord yazamaz.
 *
 * Sessizce yutmak yerine sebebi ve kalan süreyi söylüyor: neden
 * konuşamadığını bilmeyen oyuncu davranışını değiştiremez.
 */
export async function susturmaKontrol(lordId: string, simdi = new Date()): Promise<void> {
  const l = await prisma.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: { susturmaBitis: true, susturmaSebebi: true },
  });
  const d = susturmaDurumu(l.susturmaBitis, l.susturmaSebebi, simdi);
  if (d.susturulmus) {
    throw new GameError(d.metin ?? 'Sohbette susturuldun.', 403, 'SUSTURULDUN');
  }
}

/** Kararı kalıcı kayda geçirir. Şikâyet silinse bile bu kayıt kalır. */
export async function kararKaydet(opts: {
  lordId: string;
  yoneticiId: string;
  raporId: string | null;
  karar: ModerasyonKarari;
  saat: number | null;
}): Promise<void> {
  await prisma.moderasyonKaydi.create({
    data: {
      lordId: opts.lordId,
      yoneticiId: opts.yoneticiId,
      raporId: opts.raporId,
      karar: opts.karar,
      ozet: kararMetni(opts.karar, opts.saat),
      saat: opts.saat,
    },
  });
}
