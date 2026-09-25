/**
 * Moderasyon yardımcıları: yetki, susturma kontrolü, karar kaydı.
 *
 * Saf mantık `@lordlar/shared/moderasyon` içinde; burada yalnız
 * veritabanına dokunan kısım var.
 */
import {
  SIKAYET_ARASI_SN,
  kararMetni,
  sikayetSatiri,
  sikayetiDenetle,
  susturmaDurumu,
  type ModerasyonKarari,
  type SikayetTuru,
} from '@lordlar/shared';
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

/**
 * Bir şikâyeti kaydeder ve aynı içeriği şikâyet eden FARKLI oyuncu
 * sayısını döner (otomatik gizleme eşiği için).
 *
 * İttifak mesajı, genel sohbet mesajı ve profil resmi aynı yoldan
 * geçiyor: sebep denetimi, şikâyet freni, tekil kayıt. Üç ayrı kopya üç
 * ayrı fren demekti ve biri er geç unutulurdu.
 *
 * `icerikId`: şikâyet edilen şeyin kimliği (mesaj ya da resim). Aynı
 * oyuncunun aynı içeriği tekrar şikâyet etmesi sayıyı şişirmiyor —
 * kayıt güncelleniyor.
 */
export async function sikayetKaydet(o: {
  benim: string;
  hedefId: string;
  icerikId: string;
  tur: SikayetTuru;
  sebep: string;
  aciklama: string;
}): Promise<number> {
  const denetim = sikayetiDenetle(o.sebep, o.aciklama);
  if (!denetim.uygun) {
    throw new GameError(denetim.sebep ?? 'Şikâyet gönderilemedi.', 400, 'GECERSIZ_ISTEK');
  }

  // Şikâyet de spam edilebilir. Fren, kuyruğu bir kişinin tek başına
  // doldurmasını engelliyor; gerçek bir şikâyeti hiç engellemiyor.
  const sonuncu = await prisma.report.findFirst({
    where: { reporterId: o.benim },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (sonuncu) {
    const gecen = (Date.now() - sonuncu.createdAt.getTime()) / 1000;
    if (gecen < SIKAYET_ARASI_SN) {
      throw new GameError(
        `Çok hızlı şikâyet ediyorsun. ${Math.ceil(SIKAYET_ARASI_SN - gecen)} saniye bekle.`,
        400,
        'COK_HIZLI',
      );
    }
  }

  const satir = sikayetSatiri(o.sebep, o.aciklama);
  await prisma.report.upsert({
    where: {
      reporterId_targetId_mesajId: {
        reporterId: o.benim,
        targetId: o.hedefId,
        mesajId: o.icerikId,
      },
    },
    create: {
      reporterId: o.benim,
      targetId: o.hedefId,
      mesajId: o.icerikId,
      tur: o.tur,
      reason: satir,
    },
    update: { reason: satir, durum: 'acik', createdAt: new Date() },
  });

  // Eşiği FARKLI şikâyetçi sayısı belirliyor: aynı kişinin beş kez
  // basması bir içeriği gizlemeye yetmemeli.
  return prisma.report.count({ where: { mesajId: o.icerikId } });
}
