/**
 * YÖNETİCİ PANELİ — şikâyet beklemeden oyuncuya bakmak.
 *
 * Moderasyon kuyruğu (routes/moderasyon.ts) ŞİKÂYET EDİLENİ gösteriyor ve
 * o kadarı uzun süre yetti. Yetmediği yer şurası: bot hesabı, hile, aynı
 * kişinin açtığı yirmi hesap — bunları kimse şikâyet etmiyor. Kuyruk
 * beklemeye yarıyor, panel aramaya.
 *
 * Panelin yaptığı dört iş:
 *
 *   1. ARA — lord adına göre oyuncu bul.
 *   2. BAK — hesabın bütün lordları, moderasyon geçmişi, son mesajları.
 *   3. SUSTUR / YASAKLA — sohbete ya da oyuna, süreli ya da kalıcı.
 *   4. GERİ AL — her ikisi de kaldırılabiliyor.
 *
 * Yanında üç okuma ucu: yayın kontrolü (eksik ayar), ölçüm panosu
 * (günlük aktif, tutundurma) ve çoklu hesap şüpheleri.
 *
 * TASARIM KURALLARI, kuyruktakiyle aynı:
 *
 * - Her işlem KAYDA geçiyor (`ModerasyonKaydi`). Yöneticinin de
 *   denetlenebilir olması gerekiyor.
 * - Hiçbir şey SİLİNMİYOR: mesajın metni duruyor, süresi geçmiş yasak
 *   kaydı duruyor. "Bu kaçıncı" sorusunun cevabı geçmişte.
 * - Sebep zorunlu ve oyuncuya gösteriliyor. Neden giremediğini bilmeyen
 *   oyuncu davranışını değiştiremez.
 * - Yetkisiz için uçlar HİÇ YOKMUŞ gibi davranıyor (404): panelin
 *   varlığı da bir bilgidir.
 *
 * E-POSTA MASKELİ dönüyor. Yöneticinin hesapları eşleştirmesi için bir
 * tutamak gerekiyor ama adresin tamamı gerekmiyor; panel bir kimlik
 * defteri değil. Tam adres yalnız sunucudaki `pnpm yonetici` aracında.
 */
import {
  ARAMA_SONUC_SAYISI,
  COKLU_HESAP,
  KALICI_YASAK_ACIK,
  OYUNCU_MESAJ_SAYISI,
  SUSTURMA_GECMIS_SAYISI,
  SUSTURMA_SURELERI,
  YASAK_SURELERI,
  islemMetni,
  saatMetni,
  susturmaBitisi,
  susturmaDurumu,
  susturmaSuresiGecerli,
  yasagiDenetle,
  yasakBitisi,
  yasakDurumu,
  yayinOzeti,
  yukAgirligi,
  cokluHesapBaglari,
  gunNumarasi,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { requireYonetici } from '../services/moderasyon.js';
import { olcumPanosu } from '../services/olcumPanosu.js';
import { yayinKontrolu } from '../services/yayin.js';
import { istekIzi } from '../istemciIp.js';

/** `yunus@site.com` -> `yun***@site.com`. Eşleştirmeye yeter, kimliğe yetmez. */
function maskeli(eposta: string): string {
  const [ad, alan] = eposta.split('@');
  if (!alan) return '***';
  const bas = (ad ?? '').slice(0, 3);
  return `${bas}***@${alan}`;
}

export async function yoneticiRoutes(app: FastifyInstance): Promise<void> {
  const koruma = { preHandler: [requireAuth, requireYonetici] };

  /**
   * Panelin sabitleri: süre seçenekleri.
   *
   * Arayüz kendi listesini yazsaydı balance.json'dan sapardı ve
   * yöneticinin gördüğü süre ile sunucunun kabul ettiği süre ayrışırdı.
   */
  app.get('/yonetici/ayarlar', koruma, async () => ({
    susturmaSureleri: SUSTURMA_SURELERI.map((s) => ({ saat: s, metin: saatMetni(s) })),
    yasakSureleri: YASAK_SURELERI.map((s) => ({ saat: s, metin: saatMetni(s) })),
    kaliciYasak: KALICI_YASAK_ACIK,
  }));

  /**
   * Yayın kontrolü (docs/05 §6): hangi ayar eksik. Yalnız ad, durum ve
   * sebep kodu dönüyor — hiçbir ayarın değeri yok; açıklamaları arayüz
   * shared `YAYIN_METNI`nden yazıyor (çevrilebilsin diye).
   */
  app.get('/yonetici/yayin-kontrolu', koruma, async (req) => {
    // Yöneticinin kendi isteği, IP ayarının gerçekten tutup tutmadığını
    // gösteren tek kanıt: açılışta istek yok.
    const bulgular = await yayinKontrolu(istekIzi(req));
    return { bulgular, ...yayinOzeti(bulgular) };
  });

  /**
   * Ölçüm panosu (docs/05 §7): günlük aktif oyuncu, 1./7. gün
   * tutundurma, kohortlar. Yalnız toplamlar — hiçbir oyuncu adı yok.
   */
  app.get('/yonetici/olcum', koruma, async () => olcumPanosu());

  /**
   * Çoklu hesap şüpheleri (docs/14 "Çoklu hesap"): tek yönlü sevkiyat, aynı lorda
   * tekrarlanan takviye, aynı çiftin pazar işlemleri. Ağ izi yok, ceza
   * yok — kural shared `cokluHesapBaglari`da, eşikler balance.json'da.
   */
  app.get('/yonetici/coklu-hesap', koruma, async () => {
    const simdi = Date.now();
    const pencere = new Date(simdi - COKLU_HESAP.pencereGun * 86_400_000);
    const [sevkiyatlar, takviyeler, islemler] = await Promise.all([
      prisma.shipment.findMany({
        where: { departAt: { gte: pencere } },
        select: { fromLordId: true, toLordId: true, altin: true, demir: true, erzak: true },
      }),
      prisma.march.findMany({
        where: { kind: 'takviye', departAt: { gte: pencere } },
        select: { lordId: true, toRegionId: true },
      }),
      prisma.esyaIslemi.findMany({
        where: { createdAt: { gte: pencere } },
        select: { saticiId: true, aliciId: true },
      }),
    ]);
    // Takviyenin gittiği lord: bölgenin ŞİMDİKİ sahibi. Yürüyüş anındaki
    // sahip saklanmıyor; arada el değiştiren bölge yanlış çifte yazılabilir
    // — liste bir insanın bakması için, bu payı taşıyabilir.
    const bolgeler = await prisma.region.findMany({
      where: { id: { in: [...new Set(takviyeler.map((t) => t.toRegionId))] } },
      select: { id: true, ownerLordId: true },
    });
    const sahibi = new Map(bolgeler.map((b) => [b.id, b.ownerLordId]));

    /*
     * Ağ izi: önce etkileşimi olan lordların ağları, sonra o ağlara
     * pencerede giren HERKES — "kalabalık ağ" kararı (mobil operatörün
     * ortak adresi) ağdaki toplam lord sayısına bakıyor. Etkileşimsiz
     * çift zaten değerlendirilmiyor (shared cokluHesap.ts).
     */
    const ilgili = [
      ...new Set([
        ...sevkiyatlar.flatMap((s) => [s.fromLordId, s.toLordId]),
        ...takviyeler.map((t) => t.lordId),
        ...islemler.flatMap((i) => [i.saticiId, i.aliciId]),
        ...[...sahibi.values()].filter((x): x is string => Boolean(x)),
      ]),
    ];
    const ilkGun = gunNumarasi(pencere);
    const agTablosu = ilgili.length
      ? await prisma.agIzi.findMany({
          where: { lordId: { in: ilgili }, gun: { gte: ilkGun } },
          select: { ozet: true },
          distinct: ['ozet'],
        })
      : [];
    const agIzleri = agTablosu.length
      ? await prisma.agIzi.findMany({
          where: { ozet: { in: agTablosu.map((a) => a.ozet) }, gun: { gte: ilkGun } },
          select: { lordId: true, ozet: true, gun: true },
        })
      : [];

    const baglar = cokluHesapBaglari({
      agIzleri,
      sevkiyatlar: sevkiyatlar.map((s) => ({
        from: s.fromLordId,
        to: s.toLordId,
        agirlik: yukAgirligi({ altin: s.altin, demir: s.demir, erzak: s.erzak }),
      })),
      takviyeler: takviyeler.flatMap((t) => {
        const to = sahibi.get(t.toRegionId);
        return to ? [{ from: t.lordId, to }] : [];
      }),
      pazar: islemler.map((i) => ({ satici: i.saticiId, alici: i.aliciId })),
    });

    const lordlar = await prisma.lord.findMany({
      where: { id: { in: [...new Set(baglar.flatMap((b) => [b.besleyen, b.alan]))] } },
      select: {
        id: true,
        name: true,
        level: true,
        createdAt: true,
        lastSeenAt: true,
        alliance: { select: { tag: true } },
      },
    });
    const ozet = new Map(
      lordlar.map((l) => {
        const yasGun = Math.floor((simdi - l.createdAt.getTime()) / 86_400_000);
        return [
          l.id,
          {
            lordId: l.id,
            ad: l.name,
            seviye: l.level,
            hesapYasiGun: yasGun,
            genc: yasGun < COKLU_HESAP.gencHesapGun,
            sonGorulme: l.lastSeenAt,
            ittifak: l.alliance?.tag ?? null,
          },
        ];
      }),
    );
    return {
      pencereGun: COKLU_HESAP.pencereGun,
      // Silinmiş hesabın bağı düşüyor: bakılacak bir dosyası yok.
      baglar: baglar.flatMap((b) => {
        const besleyen = ozet.get(b.besleyen);
        const alan = ozet.get(b.alan);
        return besleyen && alan ? [{ ...b, besleyen, alan }] : [];
      }),
    };
  });

  /**
   * Lord adına göre arama.
   *
   * Yalnız ADA bakıyor: e-postayla arama, panelin bir adres defterine
   * dönmesi demekti. Yönetici bir oyuncuyu adıyla tanıyor — şikâyet de,
   * sohbet de, harita da adı gösteriyor.
   */
  app.get('/yonetici/ara', koruma, async (req) => {
    const { q } = z.object({ q: z.string().trim().min(2).max(40) }).parse(req.query);
    const lordlar = await prisma.lord.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { lastSeenAt: 'desc' },
      take: ARAMA_SONUC_SAYISI,
      select: {
        id: true,
        name: true,
        level: true,
        lastSeenAt: true,
        susturmaBitis: true,
        susturmaSebebi: true,
        world: { select: { name: true } },
        user: { select: { id: true, yasakli: true, yasakBitis: true, yasakSebebi: true } },
      },
    });
    const simdi = new Date();
    return {
      sonuclar: lordlar.map((l) => ({
        lordId: l.id,
        ad: l.name,
        seviye: l.level,
        diyar: l.world.name,
        sonGorulme: l.lastSeenAt,
        susturulmus: susturmaDurumu(l.susturmaBitis, l.susturmaSebebi, simdi).susturulmus,
        yasakli: yasakDurumu(l.user.yasakli, l.user.yasakBitis, l.user.yasakSebebi, simdi).yasakli,
      })),
    };
  });

  /**
   * Bir oyuncunun tam dosyası.
   *
   * Karar vermek için gereken her şey TEK yanıtta: hesabın öteki lordları
   * (aynı kişi mi), moderasyon geçmişi (bu kaçıncı), son mesajlar (bağlam).
   * Üçünü ayrı uçlara bölmek, yöneticinin karar anında üç kez beklemesi
   * demekti.
   */
  app.get('/yonetici/oyuncu/:lordId', koruma, async (req) => {
    const { lordId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const lord = await prisma.lord.findUnique({
      where: { id: lordId },
      select: {
        id: true,
        name: true,
        level: true,
        fame: true,
        lastSeenAt: true,
        createdAt: true,
        susturmaBitis: true,
        susturmaSebebi: true,
        world: { select: { name: true } },
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            epostaDogrulandi: true,
            yasakli: true,
            yasakBitis: true,
            yasakSebebi: true,
            yonetici: true,
            lords: {
              select: { id: true, name: true, level: true, world: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!lord) throw new GameError('Bulunamadı.', 404, 'BULUNAMADI');

    const [gecmis, ittifakMesajlari, genelMesajlar] = await Promise.all([
      prisma.moderasyonKaydi.findMany({
        where: { lordId: { in: lord.user.lords.map((l) => l.id) } },
        orderBy: { createdAt: 'desc' },
        take: SUSTURMA_GECMIS_SAYISI,
        select: { ozet: true, createdAt: true, lordId: true },
      }),
      prisma.allianceMessage.findMany({
        where: { lordId: lord.id },
        orderBy: { createdAt: 'desc' },
        take: OYUNCU_MESAJ_SAYISI,
        select: { id: true, text: true, createdAt: true, silindiAn: true, gizli: true },
      }),
      prisma.genelMesaj.findMany({
        where: { lordId: lord.id },
        orderBy: { createdAt: 'desc' },
        take: OYUNCU_MESAJ_SAYISI,
        select: { id: true, text: true, createdAt: true, silindiAn: true, gizli: true },
      }),
    ]);
    // İki kanal TEK akışta: karar için konuşmanın akışı gerekiyor, hangi
    // kanalda yazıldığı ise yanında yazıyor.
    const mesajlar = [
      ...ittifakMesajlari.map((m) => ({ ...m, kanal: 'ittifak' as const })),
      ...genelMesajlar.map((m) => ({ ...m, kanal: 'genel' as const })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, OYUNCU_MESAJ_SAYISI);

    const simdi = new Date();
    const s = susturmaDurumu(lord.susturmaBitis, lord.susturmaSebebi, simdi);
    const y = yasakDurumu(lord.user.yasakli, lord.user.yasakBitis, lord.user.yasakSebebi, simdi);
    return {
      lordId: lord.id,
      ad: lord.name,
      seviye: lord.level,
      sohret: lord.fame,
      diyar: lord.world.name,
      katildi: lord.createdAt,
      sonGorulme: lord.lastSeenAt,
      hesap: {
        id: lord.user.id,
        eposta: maskeli(lord.user.email),
        katildi: lord.user.createdAt,
        yonetici: lord.user.yonetici,
        // Doğrulanmamış hesap, bot avında ilk bakılacak yer (docs/17).
        epostaDogrulandi: lord.user.epostaDogrulandi !== null,
        lordlar: lord.user.lords.map((l) => ({
          id: l.id,
          ad: l.name,
          seviye: l.level,
          diyar: l.world.name,
        })),
      },
      susturma: { aktif: s.susturulmus, bitis: s.bitis, sebep: lord.susturmaSebebi },
      yasak: { aktif: y.yasakli, kalici: y.kalici, bitis: y.bitis, sebep: lord.user.yasakSebebi },
      gecmis: gecmis.map((g) => ({ ozet: g.ozet, an: g.createdAt })),
      mesajlar: mesajlar.map((m) => ({
        id: m.id,
        metin: m.text,
        an: m.createdAt,
        silinmis: m.silindiAn !== null,
        gizli: m.gizli,
        kanal: m.kanal,
      })),
    };
  });

  /* ---------------------------------------------------------------- */
  /* İşlemler                                                          */
  /* ---------------------------------------------------------------- */

  /** İşlemi kayda geçirir. Kuyruktaki karar kaydıyla aynı tablo. */
  async function kaydet(
    lordId: string,
    yoneticiId: string,
    islem: Parameters<typeof islemMetni>[0],
    saat: number | null,
  ): Promise<void> {
    await prisma.moderasyonKaydi.create({
      data: {
        lordId,
        yoneticiId,
        raporId: null,
        karar: islem,
        ozet: islemMetni(islem, saat),
        saat,
      },
    });
  }

  app.post('/yonetici/oyuncu/:lordId/sustur', koruma, async (req) => {
    const { lordId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const { saat, sebep } = z
      .object({ saat: z.coerce.number().int().positive(), sebep: z.string().trim().max(300) })
      .parse(req.body);
    if (!susturmaSuresiGecerli(saat)) throw new GameError('Geçersiz susturma süresi.', 400, 'SURE');

    const lord = await prisma.lord.findUnique({ where: { id: lordId }, select: { id: true } });
    if (!lord) throw new GameError('Bulunamadı.', 404, 'BULUNAMADI');

    await prisma.lord.update({
      where: { id: lordId },
      data: { susturmaBitis: susturmaBitisi(saat, new Date()), susturmaSebebi: sebep || null },
    });
    await kaydet(lordId, req.user.userId, 'sustur', saat);
    return { tamam: true, ozet: islemMetni('sustur', saat) };
  });

  app.post('/yonetici/oyuncu/:lordId/susturma-kaldir', koruma, async (req) => {
    const { lordId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const lord = await prisma.lord.findUnique({ where: { id: lordId }, select: { id: true } });
    if (!lord) throw new GameError('Bulunamadı.', 404, 'BULUNAMADI');

    await prisma.lord.update({
      where: { id: lordId },
      data: { susturmaBitis: null, susturmaSebebi: null },
    });
    await kaydet(lordId, req.user.userId, 'susturma_kaldir', null);
    return { tamam: true, ozet: islemMetni('susturma_kaldir') };
  });

  /**
   * Hesap yasağı.
   *
   * LORDA değil HESABA yazılıyor: yeni bir lord açarak yasaktan kaçmak
   * mümkün olmamalı. Kayıt yine lorda düşüyor — geçmiş oyuncunun adıyla
   * okunuyor.
   *
   * KENDİNİ YASAKLAYAMAZ: panelin tek yöneticili bir oyunda kendini
   * kilitlemesi, kurtarılması sunucuya girmeyi gerektiren bir hata olurdu.
   */
  app.post('/yonetici/oyuncu/:lordId/yasakla', koruma, async (req) => {
    const { lordId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const { saat, sebep } = z
      .object({
        saat: z.coerce.number().int().positive().nullable().default(null),
        sebep: z.string().trim().max(300),
      })
      .parse(req.body);

    const d = yasagiDenetle(saat, sebep);
    if (!d.uygun) throw new GameError(d.sebep ?? 'Geçersiz yasak.', 400, 'YASAK');

    const lord = await prisma.lord.findUnique({
      where: { id: lordId },
      select: { id: true, userId: true },
    });
    if (!lord) throw new GameError('Bulunamadı.', 404, 'BULUNAMADI');
    if (lord.userId === req.user.userId) {
      throw new GameError('Kendi hesabını yasaklayamazsın.', 400, 'KENDINI_YASAK');
    }

    await prisma.user.update({
      where: { id: lord.userId },
      data: {
        yasakli: saat === null,
        yasakBitis: saat === null ? null : yasakBitisi(saat, new Date()),
        yasakSebebi: sebep.trim(),
      },
    });
    await kaydet(lordId, req.user.userId, 'yasakla', saat);
    return { tamam: true, ozet: islemMetni('yasakla', saat) };
  });

  app.post('/yonetici/oyuncu/:lordId/yasak-kaldir', koruma, async (req) => {
    const { lordId } = z.object({ lordId: z.string().min(1) }).parse(req.params);
    const lord = await prisma.lord.findUnique({
      where: { id: lordId },
      select: { id: true, userId: true },
    });
    if (!lord) throw new GameError('Bulunamadı.', 404, 'BULUNAMADI');

    await prisma.user.update({
      where: { id: lord.userId },
      data: { yasakli: false, yasakBitis: null, yasakSebebi: null },
    });
    await kaydet(lordId, req.user.userId, 'yasak_kaldir', null);
    return { tamam: true, ozet: islemMetni('yasak_kaldir') };
  });

  /**
   * Mesajı kaldırma — şikâyet beklemeden.
   *
   * Metin yine SİLİNMİYOR, görünürlüğü gidiyor: kaldırma kararını
   * sonradan denetleyecek olanın tek kanıtı o metin.
   */
  app.post('/yonetici/mesaj/:mesajId/kaldir', koruma, async (req) => {
    const { mesajId } = z.object({ mesajId: z.string().min(1) }).parse(req.params);
    // Kimlikler iki tabloda da cuid, çakışmıyor: önce ittifak, sonra genel.
    const sec = { id: true, lordId: true, silindiAn: true } as const;
    const ittifakta = await prisma.allianceMessage.findUnique({
      where: { id: mesajId },
      select: sec,
    });
    const mesaj =
      ittifakta ?? (await prisma.genelMesaj.findUnique({ where: { id: mesajId }, select: sec }));
    if (!mesaj) throw new GameError('Bulunamadı.', 404, 'BULUNAMADI');
    if (mesaj.silindiAn) return { tamam: true, ozet: islemMetni('mesaj_sil') };

    const veri = { silindiAn: new Date(), silenId: req.user.userId, gizli: false };
    if (ittifakta) await prisma.allianceMessage.update({ where: { id: mesajId }, data: veri });
    else await prisma.genelMesaj.update({ where: { id: mesajId }, data: veri });
    await kaydet(mesaj.lordId, req.user.userId, 'mesaj_sil', null);
    return { tamam: true, ozet: islemMetni('mesaj_sil') };
  });
}
