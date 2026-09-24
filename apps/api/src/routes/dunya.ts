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
import { env } from '../env.js';
import { findLordByUser } from '../services/lord.js';
import { AKTIF_GUN, acikDiyarlar } from '../services/world.js';
import { kartopuDurumu, medeniyetBilgileri } from '../services/medeniyet.js';

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
  /**
   * Destek adresi — herkese açık, giriş istemiyor.
   *
   * Kullanım Koşulları ve Aydınlatma Metni giriş ekranından da açılıyor;
   * oradaki oyuncunun jetonu yok. Adres ortam değişkeninden
   * (`DESTEK_EPOSTA`) geliyor, koda gömülü değil.
   */
  app.get('/destek', async () => ({ eposta: env.DESTEK_EPOSTA ?? null }));

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
      select: { worldId: true, fame: true, name: true, medeniyetId: true },
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

    const [kartopu, medeniyetler] = await Promise.all([
      kartopuDurumu(ben.worldId),
      medeniyetBilgileri(ben.worldId),
    ]);

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
        select: {
          id: true,
          name: true,
          ownerMedeniyetId: true,
          owner: { select: { id: true, name: true } },
        },
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
            /*
             * TAHTI TUTAN MEDENİYET (docs/16 §13 soru 5).
             *
             * Taht artık yalnız bir lordun unvanı değil, bir TARAFIN
             * kazancı: tutan medeniyetin her üyesi küçük bir şöhret
             * çarpanı alıyor. Kim tuttuğu görünmezse kolektif hedef de
             * görünmez — "bizim tarafın tahtı" cümlesinin ekranda bir
             * karşılığı olmalı.
             */
            medeniyet: taht.ownerMedeniyetId
              ? (medeniyetler.get(taht.ownerMedeniyetId) ?? null)
              : null,
            medeniyetSohretBonusu: B.taht_kalesi.medeniyet_sohret_bonusu,
            benimMedeniyetimde:
              taht.ownerMedeniyetId !== null && taht.ownerMedeniyetId === ben.medeniyetId,
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
      /*
       * FRAKSİYON LİDER AVI (docs/16 §10).
       *
       * Bireysel lider avının yanında duruyor ve ikisi ayrı satır:
       * biri bir LORDU, öbürü bir TARAFI işaret ediyor. Aynı kutuya
       * koysaydık oyuncu hangisine saldırdığında hangi bonusu
       * alacağını bilemezdi — ikisi üst üste binebiliyor.
       */
      medeniyetAvi: kartopu
        ? {
            /*
             * DENGE ANAHTARI, satır kimliği DEĞİL ("demirocagi").
             *
             * Bölge kartı da medeniyeti anahtarla taşıyor
             * (`medeniyetBilgileri`), ve harita "bu bölge önde gidenin
             * mi" sorusunu ikisini karşılaştırarak cevaplıyor. Satır
             * kimliğini gönderseydik karşılaştırma HİÇBİR ZAMAN
             * tutmaz, hap hiç görünmez, hiçbir hata da çıkmazdı.
             */
            medeniyetId: medeniyetler.get(kartopu.medeniyetId)?.id ?? kartopu.medeniyetId,
            ad: medeniyetler.get(kartopu.medeniyetId)?.ad ?? null,
            renk: medeniyetler.get(kartopu.medeniyetId)?.renk ?? null,
            pay: kartopu.pay,
            yagmaBonusu: kartopu.yagmaBonusu,
            benimMi: kartopu.medeniyetId === ben.medeniyetId,
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
