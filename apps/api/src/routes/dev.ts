/**
 * Geliştirme yardımcıları — zamanı ileri sarar.
 * ÜRETİMDE KAYITLI DEĞİL: index.ts bu rotaları sadece NODE_ENV !== 'production'
 * iken bağlar. Oyuncuya avantaj sağlayan hiçbir şey yapmaz, sadece bekleme
 * sürelerini atlar; testlerin dakikalarca beklememesi için.
 */
import { WORLD_MAP, jetonBitisi } from '@lordlar/shared';
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { GameError, hata } from '../errors.js';
import { findLordByUser, grantXp, tickLord } from '../services/lord.js';
import { resolveMarch } from '../services/march.js';
import { resolveAkin } from '../services/akin.js';
import { transferRegion } from '../services/region.js';
import { medeniyetleriKur } from '../services/medeniyet.js';
import { resolveQueueItem } from '../services/queue.js';
import { sevkiyatCoz } from '../services/ticaret.js';
import { npcTuru, npcYap } from '../services/npc.js';
import { kuyruklariCek, tabanlariGuncelle } from '../services/esyaPazari.js';
import { testTahminiKoy } from '../services/resimDenetimi.js';

export async function devRoutes(app: FastifyInstance): Promise<void> {
  /** Bekleyen tüm kuyrukları hemen bitirir. */
  app.post('/test/kuyruklari-bitir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const queues = await prisma.queue.findMany({ where: { lordId, resolved: false } });
    await prisma.queue.updateMany({
      where: { lordId, resolved: false },
      data: { finishAt: new Date() },
    });
    let n = 0;
    for (const q of queues) if (await resolveQueueItem({ ...q, finishAt: new Date() })) n++;
    return { cozulen: n };
  });

  /**
   * Kuyrukların vadesini geçmişe alır ama ÇÖZMEZ.
   *
   * "Worker uyuyakalmış" hâlini canlandırıyor. Bir oyuncu bunu gerçek
   * dağıtımda yakaladı: ekranda "EĞİTİMDE 26 — bitti" yazıyor ama "Evde
   * 0". Eğitim bitmiş, askerler orduya katılmamış; omurga da haklı olarak
   * "hâlâ asker eğit" diyor ve altın harcandığı için düğme kapalı.
   * Oyuncu basacak düğme bulamadığı bir ekranda kalıyor.
   *
   * `kuyruklari-bitir` bu hâli üretemez, çünkü o çözerek bitiriyor.
   */
  app.post('/test/kuyruklari-vadesinde-birak', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const sonuc = await prisma.queue.updateMany({
      where: { lordId, resolved: false },
      data: { finishAt: new Date(Date.now() - 1000) },
    });
    return { vadesiGecen: sonuc.count };
  });

  /** Bekleyen tüm yürüyüşleri hemen vardırır ve çözer. */
  app.post('/test/yuruyusleri-bitir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const marches = await prisma.march.findMany({ where: { lordId, resolved: false } });
    await prisma.march.updateMany({
      where: { lordId, resolved: false },
      data: { arriveAt: new Date() },
    });
    let n = 0;
    for (const m of marches) if (await resolveMarch(m.id)) n++;
    return { cozulen: n };
  });

  /**
   * Bekleyen akınları anında çözer.
   *
   * `yuruyusleri-bitir`in eşi ve aynı gerekçe: ölçülen şey akının kaç
   * dakika sürdüğü değil, SONUCU. Beklemek testi yavaşlatmaktan başka
   * bir şey yapmıyor. Hile değil — ürünün kendi çözüm yolu çağrılıyor,
   * yalnız varış saati öne alınıyor.
   */
  app.post('/test/akinlari-bitir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const akinlar = await prisma.akin.findMany({ where: { lordId, resolved: false } });
    await prisma.akin.updateMany({
      where: { lordId, resolved: false },
      data: { arriveAt: new Date() },
    });
    let n = 0;
    for (const a of akinlar) if (await resolveAkin(a.id)) n++;
    return { cozulen: n };
  });

  /**
   * Çağıranın dünyasındaki tüm kalkanları kaldırır: bölge fetih korumaları ve
   * lordların yeni oyuncu korumaları. Demo dünyası kurulduktan sonra her şeyin
   * hemen saldırılabilir olması için.
   */
  app.post('/test/kalkanlari-kaldir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const { worldId } = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true },
    });
    const b = await prisma.region.updateMany({ where: { worldId }, data: { shieldUntil: null } });
    const l = await prisma.lord.updateMany({
      where: { worldId, id: { not: lordId } },
      data: { protectionUntil: null },
    });
    return { bolgeKalkani: b.count, lordKalkani: l.count };
  });

  /** Saati geriye alır: gelir birikimini test etmek için. */
  app.post('/test/saat-ilerlet', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const saat = Number((req.body as { saat?: number })?.saat ?? 1);
    const geri = new Date(Date.now() - saat * 3_600_000);
    await prisma.lord.update({ where: { id: lordId }, data: { lastTickAt: geri } });
    await prisma.region.updateMany({ where: { ownerLordId: lordId }, data: { lastTickAt: geri } });
    return tickLord(lordId);
  });

  /**
   * Bu lordu RAKİP (NPC) yapar ve sırasını hemen açar.
   *
   * Testin NPC davranışını ölçebilmesinin tek yolu bu: gerçek NPC'ler
   * `seedDemoLords` ile açılıyor ve kırk beş dakikada bir oynuyor. Test
   * kırk beş dakika bekleyemez, ama bekleme dışında her şeyin aynı
   * olmasını da istiyoruz — bu uç yalnız BAYRAĞI koyuyor, davranışı
   * değiştirmiyor.
   */
  app.post('/test/npc-yap', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    await npcYap(lordId);
    return { npc: true };
  });

  /**
   * Çağıran hesabı yönetici yapar — yalnız şikâyet kuyruğunu test etmek
   * için. Bu dosyanın tamamı gibi ÜRETİMDE HİÇ YÜKLENMİYOR (index.ts);
   * yükleniyor olsaydı bu uç herkesi yönetici yapabilirdi.
   */
  app.post('/test/yonetici-yap', { preHandler: requireAuth }, async (req) => {
    await prisma.user.update({ where: { id: req.user.userId }, data: { yonetici: true } });
    return { yonetici: true };
  });

  /**
   * Doğrulama jetonunu HAM hâliyle verir — yalnız test için.
   *
   * Gerçek akışta ham jeton yalnız e-postada var; veritabanında özeti
   * duruyor ve geri çevrilemiyor. Test postayı okuyamadığı için jetonu
   * buradan alıyor. Bu dosyanın tamamı gibi ÜRETİMDE HİÇ YÜKLENMİYOR.
   */
  app.post('/test/dogrulama-jetonu', { preHandler: requireAuth }, async (req) => {
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.userId },
      select: { email: true, epostaDogrulandi: true },
    });
    // Kayıtta bir jeton çoktan üretildi mi — akışın ilk halkası.
    const oncekiVar =
      (await prisma.epostaDogrulama.count({ where: { userId: req.user.userId } })) > 0;

    const jeton = randomBytes(32).toString('base64url');
    await prisma.epostaDogrulama.updateMany({
      where: { userId: req.user.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.epostaDogrulama.create({
      data: {
        userId: req.user.userId,
        tokenHash: createHash('sha256').update(jeton).digest('hex'),
        expiresAt: jetonBitisi(new Date()),
      },
    });
    return { jeton, oncekiVar, dogrulandi: u.epostaDogrulandi !== null, eposta: u.email };
  });

  /**
   * Hesabı doğrulanmış yapar — test kurulumu için.
   *
   * Testlerin çoğu doğrulamayı ÖLÇMÜYOR; sohbeti, ticareti, ittifakı
   * ölçüyor ve o kapılar doğrulanmış hesap istiyor. Her aracın kendi
   * jetonunu üretip doğrulaması, ölçtüğü şeyle ilgisi olmayan on satır
   * demekti. `kayit.mjs` bunu kayıttan hemen sonra çağırıyor.
   */
  app.post('/test/dogrulanmis-yap', { preHandler: requireAuth }, async (req) => {
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { epostaDogrulandi: new Date() },
    });
    return { dogrulandi: true };
  });

  /**
   * Bir sonraki profil resmi yüklemesinde sınıflandırıcının cevabını
   * taklit eder. Depoya uygunsuz bir resim koyamayız; reddin ve
   * incelemenin yolunu sınamanın dürüst yolu cevabı taklit etmek.
   */
  app.post('/test/resim-tahmini', { preHandler: requireAuth }, async (req) => {
    const t = z
      .object({
        Porn: z.number(),
        Hentai: z.number(),
        Sexy: z.number(),
        Neutral: z.number(),
        Drawing: z.number(),
      })
      .parse(req.body);
    testTahminiKoy(await findLordByUser(req.user.userId), t);
    return { tamam: true };
  });

  /** Yükleme günlük sınırını sıfırlar: testler aynı lordla birkaç kez yükleyebilsin. */
  app.post('/test/yuklemeleri-eskit', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    await prisma.profilResmi.updateMany({
      where: { lordId },
      data: { createdAt: new Date(Date.now() - 2 * 24 * 3600_000) },
    });
    return { tamam: true };
  });

  /** Hesabın açılışını geriye alır: serbest sürenin dolmasını taklit eder. */
  app.post('/test/hesabi-eskit', { preHandler: requireAuth }, async (req) => {
    const { gun } = z.object({ gun: z.coerce.number().int().positive() }).parse(req.body);
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { createdAt: new Date(Date.now() - gun * 86_400_000) },
    });
    return { eskitildi: gun };
  });

  /** Bir NPC turu koşturur ve ne yapıldığını söyler. */
  app.post('/test/npc-turu', { preHandler: requireAuth }, async () => {
    return npcTuru(new Date());
  });

  /**
   * Eşya pazarının işçi turunu HEMEN koşturur: kayıt kuyruğu kurası ve
   * saatlik taban (docs/19). Test on saniyelik işçiyi beklemesin; işçi de
   * aynı anda koşarsa kilitler ikisini sıraya diziyor, sonuç değişmiyor.
   */
  app.post('/test/pazar-turu', { preHandler: requireAuth }, async () => {
    const simdi = new Date();
    return { kura: await kuyruklariCek(simdi), taban: await tabanlariGuncelle(simdi) };
  });

  /** XP verir: seviye bağımlı sistemleri test etmek için. */
  app.post('/test/xp-ver', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const miktar = Number((req.body as { miktar?: number })?.miktar ?? 1000);
    return grantXp(lordId, miktar);
  });

  /** Bekleyen sevkiyatları hemen vardırır. */
  app.post('/test/sevkiyatlari-bitir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const sevk = await prisma.shipment.findMany({
      where: { resolved: false, OR: [{ fromLordId: lordId }, { toLordId: lordId }] },
    });
    await prisma.shipment.updateMany({
      where: { resolved: false, OR: [{ fromLordId: lordId }, { toLordId: lordId }] },
      data: { arriveAt: new Date() },
    });
    let n = 0;
    for (const s of sevk) if (await sevkiyatCoz(s.id)) n++;
    return { cozulen: n };
  });

  /**
   * Fesih ihbarı süren paktların bitiş anını geçmişe alır.
   *
   * İhbar süresi 24 saat: testin gerçekten beklemesi mümkün değil. Zamanı
   * ileri almak yerine BİTİŞİ geriye alıyoruz — böylece test paktın
   * gerçekten sona erdiğini, yani üretimde çalışan aynı `paktKoruyorMu`
   * kararını ölçüyor; ayrı bir "test modu" dalı açmıyoruz.
   */
  app.post('/test/paktlari-bitir', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { allianceId: true },
    });
    if (!lord.allianceId) return { bitirilen: 0 };
    const sonuc = await prisma.pakt.updateMany({
      where: {
        durum: 'feshediliyor',
        OR: [{ aId: lord.allianceId }, { bId: lord.allianceId }],
      },
      data: { biterAt: new Date(Date.now() - 1000), durum: 'bitti' },
    });
    return { bitirilen: sonuc.count };
  });

  /**
   * İttifaka doğrudan XP verir: seviye atlama ANINI test etmek için.
   *
   * Neden gerekli: bir seviye ~25.000 XP, bir bağış ~420. Testin 60 bağış
   * yapması hem yavaş hem imkânsız (günlük hak 5). XP'yi iteliyoruz ama
   * SEVİYE yine gerçek fonksiyondan türüyor — ayrı bir "test modu" dalı
   * açmıyoruz.
   */
  app.post('/test/ittifak-xp', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { allianceId: true },
    });
    if (!lord.allianceId) return { verildi: 0 };
    const miktar = Number((req.body as { miktar?: number })?.miktar ?? 100000);
    const a = await prisma.alliance.update({
      where: { id: lord.allianceId },
      data: { xp: { increment: miktar } },
      select: { xp: true },
    });
    return { verildi: miktar, xp: a.xp };
  });

  /**
   * Bir generalin seviyesini/XP'sini kurar: seviye atlama ANINI test etmek için.
   *
   * Neden gerekli: bir general tek savaşta seviye atlamaya çoğu zaman yetmez
   * (bir PvP savaşı ~176 XP, Sv1→Sv2 için 200 gerekiyor). Testin savaşı
   * defalarca tekrarlaması hem yavaş hem kırılgan olurdu; bunun yerine
   * general eşiğin hemen altına kurulup TEK savaşla atlaması sağlanıyor —
   * ölçülen yol yine gerçek savaş yolu.
   */
  app.post('/test/general-xp', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const b = (req.body ?? {}) as { key?: string; level?: number; xp?: number };
    if (!b.key) throw new GameError('key gerekli.', 400, 'EKSIK_ALAN');
    const kayit = await prisma.lordGeneral.findUnique({
      where: { lordId_generalKey: { lordId, generalKey: b.key } },
    });
    if (!kayit) throw hata.bulunamadi('General');
    return prisma.lordGeneral.update({
      where: { id: kayit.id },
      data: { level: Math.max(1, b.level ?? kayit.level), xp: Math.max(0, b.xp ?? kayit.xp) },
      select: { generalKey: true, level: true, xp: true },
    });
  });

  /**
   * Çağıran lordun dünyasındaki TÜM bölgeleri başlangıç durumuna döndürür:
   * sahiplik bırakılır, garnizonlar silinir, NPC garnizonu tabana çekilir,
   * seviye ve kalkan sıfırlanır.
   *
   * Testler arası izolasyon için şart: sıfırlama olmadan her koşu haritadan
   * bir bölge daha kapatır ve bir süre sonra saldırılacak boş hedef kalmaz.
   */
  /**
   * Çağıranın bir bölgesini SAHİPSİZ bırakır — kaybetmiş gibi.
   *
   * Başkent düşmesini (docs/12 §2.3) ölçmenin tek yolu bir bölgeyi
   * gerçekten elden çıkarmak. İkinci bir oyuncu kurup savaştırmak da
   * olurdu ama ölçülen şey savaş değil, savaştan SONRAKİ hâl; ürünün
   * kendi devretme yolu (`transferRegion`) çağrılıyor, kısayol değil.
   */
  app.post('/test/bolge-sahipsizlestir', { preHandler: requireAuth }, async (req) => {
    const { bolgeId } = z.object({ bolgeId: z.number().int() }).parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const bolge = await prisma.region.findUnique({ where: { id: bolgeId } });
    if (!bolge || bolge.ownerLordId !== lordId) {
      throw new GameError('Bu bölge senin değil.', 400, 'BOLGE_SENIN_DEGIL');
    }
    await prisma.$transaction(async (tx) => {
      await tx.armyUnit.deleteMany({
        where: { locationType: 'region', locationId: String(bolgeId) },
      });
      await transferRegion(bolgeId, null, tx);
    });
    return { bosaltildi: true };
  });

  app.post('/test/bolgeleri-sifirla', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const { worldId } = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true },
    });

    const bolgeler = await prisma.region.findMany({ where: { worldId } });
    const taban = new Map(WORLD_MAP.regions.map((r) => [r.id, r]));

    for (const b of bolgeler) {
      const t = taban.get(b.mapId);
      if (!t) continue;
      // Bölgeye yerleştirilmiş garnizonları sil
      await prisma.armyUnit.deleteMany({
        where: { locationType: 'region', locationId: String(b.id) },
      });
      await prisma.region.update({
        where: { id: b.id },
        data: {
          ownerLordId: null,
          npcGarrison: t.npc_garrison as object,
          level: t.level,
          shieldUntil: null,
          storeAltin: 0,
          storeDemir: 0,
          storeErzak: 0,
        },
      });
    }
    return { sifirlanan: bolgeler.length };
  });

  /** Kaynak verir: pahalı sistemleri test etmek için. */
  app.post('/test/kaynak-ver', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const b = (req.body ?? {}) as {
      altin?: number;
      demir?: number;
      erzak?: number;
      elmas?: number;
    };
    await tickLord(lordId);
    return prisma.lord.update({
      where: { id: lordId },
      data: {
        altin: { increment: Math.round(b.altin ?? 0) },
        demir: { increment: Math.round(b.demir ?? 0) },
        erzak: { increment: Math.round(b.erzak ?? 0) },
        // Elmasla kısaltmanın iki yolu da (yeter / yetmez) sınanabilsin.
        elmas: { increment: Math.round(b.elmas ?? 0) },
      },
      select: { altin: true, demir: true, erzak: true, elmas: true },
    });
  });

  /**
   * Bu lordun diyarındaki medeniyet tablosu (docs/16 §12 adım 2).
   *
   * Nüfus dengesi, yurt sahipliği ve çekirdek satırları HTTP üzerinden
   * başka türlü görünmüyor: `/me` yalnız bir lordu anlatıyor, `/api/map`
   * ise medeniyet sütununu henüz taşımıyor (o, arayüz adımının işi).
   * Sınamanın veritabanına doğrudan bakması ise onu API'nin değil şemanın
   * sınaması hâline getirirdi — şema değişince sınama de değişirdi ve
   * korumaya çalıştığı şey kaçardı.
   *
   * Yalnız OKUYOR. Geliştirme ucu olmasının tek sebebi, oyuncuya bu kadar
   * ayrıntılı bir sayımın gerekmemesi.
   */
  /**
   * Bir medeniyete TOPRAK ve DEPO verir — kartopu frenini sınamak için.
   *
   * Fren ancak bir medeniyet toprağın belli bir payını geçince açılıyor
   * (docs/16 §10) ve oraya oynayarak gelmek yüzlerce fetih demek. Uç
   * yalnız KURULUMU yapıyor, kuralı değil: hangi payın freni açtığına
   * `balance.json` karar veriyor, buraya bir eşik kopyası girmiyor.
   *
   * `depo` o medeniyetin bölgelerine yağmalanabilir kaynak koyuyor;
   * yağma bonusunun ölçülebilmesi için depoda kaynak olması şart, yoksa
   * bonus sıfırın üstüne biniyor ve hiçbir şey görünmüyor.
   */
  app.post('/test/medeniyet-toprak-ver', { preHandler: requireAuth }, async (req) => {
    const { key, adet, depo, sifirla } = z
      .object({
        key: z.string(),
        adet: z.number().int().min(0).max(200).default(0),
        depo: z.number().int().min(0).max(1_000_000).default(0),
        /** Önce haritayı DOĞDUĞU güne döndür (yurtlar sahibinde, orta boş). */
        sifirla: z.boolean().default(false),
      })
      .parse(req.body ?? {});

    const lordId = await findLordByUser(req.user.userId);
    const { worldId } = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true },
    });
    const medeniyet = await prisma.medeniyet.findFirst({
      where: { worldId, key },
      select: { id: true },
    });
    if (!medeniyet) throw new GameError('Medeniyet yok.', 400, 'MEDENIYET_YOK');

    /*
     * SIFIRLA: haritayı doğduğu güne döndürür.
     *
     * Uçtan uca sınamalar aynı diyarı paylaşıyor ve toprak veren bir
     * sınama kendinden sonrakini bozar: bir sonraki lord kendi
     * medeniyetinin yuttuğu bir haritaya doğar ve "yoldaşına saldıramazsın"
     * kuralı onun ilk hedefini kapatır. Sınama açarken de kapatırken de
     * burayı çağırıyor.
     *
     * Lordun tuttuğu bölgeye dokunulmuyor: orada oyunun ürettiği bir
     * durum var.
     */
    let sifirlanan = 0;
    if (sifirla) {
      const sonuc = await prisma.region.updateMany({
        where: { worldId, ownerLordId: null },
        data: { ownerMedeniyetId: null },
      });
      sifirlanan = sonuc.count;
      // Yurtlar yeniden sahibine yazılıyor — açılış dağılımı bu.
      await medeniyetleriKur(worldId);
    }

    // Yalnız GERÇEKTEN sahipsiz bölgeler: bir lordun toprağını elinden
    // almak testin ölçtüğü şeyi değiştirirdi.
    let verilen = 0;
    if (adet > 0) {
      const adaylar = await prisma.region.findMany({
        where: { worldId, ownerMedeniyetId: null, ownerLordId: null, type: { not: 'taht' } },
        select: { id: true },
        take: adet,
      });
      const sonuc = await prisma.region.updateMany({
        where: { id: { in: adaylar.map((a) => a.id) } },
        data: { ownerMedeniyetId: medeniyet.id },
      });
      verilen = sonuc.count;
    }

    let depolanan = 0;
    if (depo > 0) {
      const sonuc = await prisma.region.updateMany({
        where: { worldId, ownerMedeniyetId: medeniyet.id },
        data: { storeAltin: depo, storeDemir: depo, storeErzak: depo },
      });
      depolanan = sonuc.count;
    }

    const bolge = await prisma.region.count({ where: { ownerMedeniyetId: medeniyet.id } });
    return { sifirlanan, verilen, depolanan, bolge };
  });

  app.post('/test/medeniyet-durumu', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const { worldId } = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true },
    });
    const satirlar = await prisma.medeniyet.findMany({
      where: { worldId },
      select: {
        id: true,
        key: true,
        _count: { select: { lordlar: true, bolgeler: true, yatirimlar: true } },
      },
      orderBy: { key: 'asc' },
    });
    const sahipsiz = await prisma.region.count({
      where: { worldId, ownerMedeniyetId: null },
    });
    return {
      medeniyetler: satirlar.map((m) => ({
        key: m.key,
        lord: m._count.lordlar,
        bolge: m._count.bolgeler,
        cekirdek: m._count.yatirimlar,
      })),
      sahipsizBolge: sahipsiz,
    };
  });
}
