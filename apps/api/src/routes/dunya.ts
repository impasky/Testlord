/**
 * Dünya (shard) özeti.
 *
 * Oyunun ilk gerçek testinde oyuncu iki şey sordu: "harita niye bu kadar
 * küçük, tek oyunculu bir oyun mu bu" ve — oyunu kapatırken — "ne saçma
 * oyun". İkisinin de kaynağı aynı: oyun kaç kişilik olduğunu, kazanmanın ne
 * demek olduğunu ve oyuncunun nerede durduğunu hiçbir yerde söylemiyordu.
 * Taht Kalesi kodda vardı, oyuncuya hiç tanıtılmıyordu.
 *
 * Bu uç o üç cümlenin verisini veriyor. (docs/08 İ5, İ6)
 */
import { B, WORLD_MAP, liderAviGecerliMi, liderAviYagmaBonusu } from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { findLordByUser } from '../services/lord.js';
import { AKTIF_GUN, acikDiyarlar } from '../services/world.js';

export async function dunyaRoutes(app: FastifyInstance): Promise<void> {
  /*
   * Katılınabilir diyarların listesi — KİMLİK GEREKTİRMEZ.
   *
   * Kayıt ekranı bunu okuyor. Eskiden oyuncu hangi diyara düştüğünü
   * seçemiyordu: sistem onu en eski açık diyara koyuyordu ve arkadaşıyla
   * birlikte oynamak isteyen iki kişi bunu yapamıyordu. Bir strateji
   * oyununda insanların oyuna girme sebeplerinden biri bu.
   *
   * Sızdırdığı tek şey diyar adları ve kaç kişi oldukları — kayıt
   * ekranında zaten gösterilecek olan bilgi. Hız sınırı IP'ye düşüyor
   * (bkz. index.ts: token yoksa anahtar `ip:`).
   */
  app.get('/diyarlar', async () => {
    const diyarlar = await acikDiyarlar();
    return {
      // Öneri, seçim yapılmazsa kaydın gideceği yerin AYNISI: ikisi de
      // `acikDiyarlar()` sırasının başını alıyor. Ayrı bir kural yazmak,
      // "önerilen" ile "varsayılan"ın sessizce ayrılması demekti.
      onerilen: diyarlar[0]?.id ?? null,
      aktifGun: AKTIF_GUN,
      diyarlar: diyarlar.map((d) => ({
        id: d.id,
        ad: d.ad,
        lordSayisi: d.lordSayisi,
        kapasite: d.kapasite,
        aktifLord: d.aktifLord,
      })),
    };
  });

  app.get('/dunya', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const ben = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, fame: true, name: true },
    });

    const aktifSinir = new Date(Date.now() - AKTIF_GUN * 86_400_000);

    const birlesmeKaydi = await prisma.worldMerge.findFirst({
      where: {
        uygulandiAt: null,
        OR: [{ hostId: ben.worldId }, { guestId: ben.worldId }],
      },
      orderBy: { birlesmeAt: 'asc' },
      select: {
        hostId: true,
        guestId: true,
        birlesmeAt: true,
        host: { select: { name: true } },
        guest: { select: { name: true } },
      },
    });
    const birlesme = birlesmeKaydi
      ? {
          guestId: birlesmeKaydi.guestId,
          birlesmeAt: birlesmeKaydi.birlesmeAt,
          // Oyuncuya KARŞI diyarın adı gösteriliyor, kendi diyarının değil.
          karsiAd:
            birlesmeKaydi.guestId === ben.worldId
              ? birlesmeKaydi.host.name
              : birlesmeKaydi.guest.name,
        }
      : null;

    const [dunya, lordSayisi, aktif, ustumde, taht, lider, sonSavaslar] = await Promise.all([
      prisma.world.findUniqueOrThrow({
        where: { id: ben.worldId },
        select: { name: true, playerCap: true },
      }),
      prisma.lord.count({ where: { worldId: ben.worldId } }),
      prisma.lord.count({ where: { worldId: ben.worldId, lastSeenAt: { gte: aktifSinir } } }),
      prisma.lord.count({
        where: { worldId: ben.worldId, id: { not: lordId }, fame: { gt: ben.fame } },
      }),
      prisma.region.findFirst({
        where: { worldId: ben.worldId, type: 'taht' },
        select: { id: true, name: true, owner: { select: { id: true, name: true } } },
      }),
      // Lider avı: diyarın en yüksek şöhretli lordu. Kartopu freni buna
      // bağlı ve oyuncunun kimin peşine düşeceğini bilmesi gerekiyor.
      prisma.lord.findFirst({
        where: { worldId: ben.worldId },
        orderBy: { fame: 'desc' },
        select: { id: true, name: true, fame: true },
      }),
      // Haritanın "yaşayan yer" hissi için son savaşlar. Veri zaten Battle
      // tablosunda; yeni model gerekmiyor. Sahte veri üretilmiyor — savaş
      // yoksa liste boş döner ve arayüz şeridi hiç göstermez.
      prisma.battle.findMany({
        where: { worldId: ben.worldId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          createdAt: true,
          captured: true,
          result: true,
          regionId: true,
          attacker: { select: { id: true, name: true } },
          defender: { select: { id: true, name: true } },
          log: true,
        },
      }),
    ]);

    return {
      ad: dunya.name,
      kapasite: dunya.playerCap,
      lordSayisi,
      aktifLord: aktif,
      aktifGun: AKTIF_GUN,
      // Sayı HARİTADAN, dengeden değil. `balance.json` içinde elle yazılmış
      // bir `bolgeler.toplam` vardı ve 61'de kalmıştı: harita 121 bölgeye
      // çıkınca kopya sayı onunla birlikte büyümedi, diyar tanıtımı yeni
      // oyuncuya dünyayı yarısı kadar gösteriyordu. Kopya silindi.
      bolgeSayisi: WORLD_MAP.region_count,
      /*
       * İLAN EDİLMİŞ birleşme. Haritası bir sabah değişmiş oyuncu, oyunu
       * bırakan oyuncudur; bu yüzden birleşme önce duyuruluyor ve duyuru
       * dünya ekranında, yani "diyarım nasıl" sorusunun sorulduğu yerde
       * duruyor.
       */
      birlesme: birlesme
        ? {
            karsiDiyar: birlesme.karsiAd,
            konukMuyum: birlesme.guestId === ben.worldId,
            birlesmeAt: birlesme.birlesmeAt.toISOString(),
          }
        : null,
      benimSiram: ustumde + 1,
      benimSohretim: ben.fame,
      taht: taht
        ? {
            regionId: taht.id,
            name: taht.name,
            sahip: taht.owner ? { id: taht.owner.id, name: taht.owner.name } : null,
            sohretBonusu: B.taht_kalesi.unvan_sohret_bonusu,
          }
        : null,
      // Lider tek başınaysa (ya da dünya çok küçükse) av yok: iki kişilik
      // bir dünyada "lider" anlamsız ve işaret sadece kafa karıştırır.
      liderAvi:
        lider && liderAviGecerliMi(lordSayisi)
          ? {
              lordId: lider.id,
              ad: lider.name,
              sohret: lider.fame,
              yagmaBonusu: liderAviYagmaBonusu(),
              benMiyim: lider.id === lordId,
            }
          : null,
      olaylar: sonSavaslar.map((b) => {
        const log = b.log as { regionName?: string } | null;
        return {
          id: b.id,
          zaman: b.createdAt,
          bolgeId: b.regionId,
          bolge: log?.regionName ?? 'bilinmeyen bölge',
          saldiran: b.attacker.name,
          savunan: b.defender?.name ?? null,
          saldiranKazandi: b.result === 'attacker_win',
          eleGecti: b.captured,
        };
      }),
    };
  });
}
