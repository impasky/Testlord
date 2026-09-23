import {
  ARASTIRMALAR,
  B,
  CAGLAR,
  GRUPLAR,
  arastirmaBonusu,
  arastirmaDugumu,
  arastirmaDurumlari,
  arastirmaIlerlemesi,
  arastirmaMaliyeti,
  arastirmaSuresiSn,
  esZamanliLimit,
  grupSecenekleri,
  grupSecimi,
  yolBirakmaPlani,
  yolDugumleri,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma, type Tx } from '../db.js';
import { GameError } from '../errors.js';
import { binalariOku, findLordByUser, okuArastirmalar, tickLord } from '../services/lord.js';
import { lordIslemi } from '../services/kilit.js';
import { gecikmisleriKapat } from '../services/gecikmis.js';
import { assertQueueSlot, enqueue, spendResources } from '../services/queue.js';

const baslatSchema = z.object({ key: z.string().min(1) });
const birakSchema = z.object({ grup: z.string().min(1) });

/** `Lord.arastirmaDegisim`: grup → son yol bırakma anı (ISO). */
function degisimOku(json: unknown): Record<string, string> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json as Record<string, unknown>))
    if (typeof v === 'string') out[k] = v;
  return out;
}

/** Grubun yeniden değiştirilebileceği an; bekleme yoksa null. */
function sonrakiDegisim(degisim: Record<string, string>, grup: string, simdi: Date): Date | null {
  const son = degisim[grup];
  if (!son) return null;
  const acilis = new Date(
    new Date(son).getTime() + B.arastirma.yol_degisim_bekleme_saat * 3_600_000,
  );
  return acilis > simdi ? acilis : null;
}

function kalanMetni(ms: number): string {
  const sa = Math.ceil(ms / 3_600_000);
  return sa >= 24 ? `${Math.floor(sa / 24)} gün ${sa % 24} saat` : `${sa} saat`;
}

async function surenArastirmalar(lordId: string, db: Tx | typeof prisma) {
  const satirlar = await db.queue.findMany({
    where: { lordId, kind: 'research', resolved: false },
    orderBy: { finishAt: 'asc' },
  });
  return satirlar.map((q) => {
    const key = String((q.payload as { key?: string }).key ?? '');
    return {
      id: q.id,
      key: key || null,
      ad: key ? (arastirmaDugumu(key)?.ad ?? key) : '',
      startedAt: q.startedAt,
      finishAt: q.finishAt,
    };
  });
}

export async function arastirmaRoutes(app: FastifyInstance) {
  app.get('/arastirma', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    await gecikmisleriKapat(lordId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { level: true, arastirmalar: true, arastirmaDegisim: true, binalar: true },
    });
    const tamamlanan = okuArastirmalar(lord.arastirmalar);
    const bonus = arastirmaBonusu(tamamlanan);
    const binalar = binalariOku(lord);
    /*
     * Süren araştırmaların HEPSİ, en erken biteni önce. Eskiden yalnız
     * ilki (`suren`) dönüyordu: kütüphane ikinci bir yuva açınca ikinci
     * araştırma ekranda görünmüyordu. `suren` geriye dönük uyum için
     * duruyor. `startedAt` yuva çubuğunun ilerlemesi için.
     */
    const surenler = await surenArastirmalar(lordId, prisma);
    const surenKeys = surenler.map((s) => s.key).filter((k): k is string => !!k);
    const degisim = degisimOku(lord.arastirmaDegisim);
    const simdi = new Date();

    const gruplar = GRUPLAR.map((g) => {
      const secili = grupSecimi(tamamlanan, g.key);
      const plan = yolBirakmaPlani(tamamlanan, g.key);
      const acilis = sonrakiDegisim(degisim, g.key, simdi);
      const yolda = plan
        ? surenler.find((s) => s.key && yolDugumleri(plan.yol).some((d) => d.key === s.key))
        : undefined;
      return {
        key: g.key,
        ad: g.ad,
        aciklama: g.aciklama,
        secenekler: grupSecenekleri(g.key).map((d) => ({ key: d.key, ad: d.ad, yol: d.yol! })),
        secili,
        seciliAd: grupSecenekleri(g.key).find((d) => d.yol === secili)?.ad ?? null,
        birakma: plan
          ? {
              acik: !acilis && !yolda,
              engel: acilis
                ? `Bu seçimi ${kalanMetni(acilis.getTime() - simdi.getTime())} sonra değiştirebilirsin.`
                : yolda
                  ? `Önce süren ${yolda.ad} araştırmasını bitir ya da iptal et.`
                  : null,
              sonrakiDegisim: acilis,
              silinecek: plan.silinecek.map((k) => ({ key: k, ad: arastirmaDugumu(k)?.ad ?? k })),
              iade: plan.iade,
            }
          : null,
      };
    });

    return {
      dallar: arastirmaDurumlari(tamamlanan, lord.level, { suren: surenKeys, bonus }),
      sekmeler: ARASTIRMALAR.map((d) => ({
        key: d.key,
        ad: d.ad,
        ozet: d.ozet,
        sutunlar: d.sutunlar,
      })),
      caglar: CAGLAR,
      gruplar,
      tamamlanan,
      ilerleme: arastirmaIlerlemesi(tamamlanan),
      lordSeviyesi: lord.level,
      esZamanli: esZamanliLimit('research', binalar, bonus),
      // Yuvaların nereden geldiği: oyuncu "bir yuva daha nasıl açılır"
      // sorusunun cevabını ekranda görsün.
      yuva: {
        kutuphane: esZamanliLimit('research', binalar),
        arastirma: bonus.arastirmaYuvasi,
      },
      surenler,
      suren: surenler[0] ?? null,
    };
  });

  app.post('/arastirma', { preHandler: requireAuth }, async (req) => {
    const { key } = baslatSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    await gecikmisleriKapat(lordId);

    return lordIslemi(lordId, async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { level: true, arastirmalar: true },
      });
      const tamamlanan = okuArastirmalar(lord.arastirmalar);
      const bonus = arastirmaBonusu(tamamlanan);
      // Süren araştırmalar İŞLEMİN İÇİNDE okunuyor: lord satırı kilitli,
      // yani aynı anda gelen iki istek sırayla görüyor. Dışarıda okunsa
      // iki öğretinin seçeneği aynı anda başlatılıp ikisi birden bitebilirdi.
      const suren = (await surenArastirmalar(lordId, tx))
        .map((s) => s.key)
        .filter((k): k is string => !!k);
      const durum = arastirmaDurumlari(tamamlanan, lord.level, { suren, bonus }).find(
        (d) => d.key === key,
      );
      if (!durum) throw new GameError('Böyle bir araştırma yok.', 404, 'ARASTIRMA_YOK');
      if (durum.tamamlandi)
        throw new GameError('Bu araştırma zaten tamamlandı.', 400, 'ARASTIRMA_BITTI');
      if (!durum.acik)
        throw new GameError(durum.engel ?? 'Henüz açılmadı.', 400, 'ARASTIRMA_KAPALI');

      await assertQueueSlot(lordId, 'research', tx);
      await spendResources(lordId, arastirmaMaliyeti(durum.kademe), tx);
      // Süre ön izlemedekiyle AYNI hesap: erken/geride çarpanı ve hız dahil.
      const kayit = await enqueue(
        lordId,
        'research',
        { key },
        arastirmaSuresiSn(durum, lord.level, bonus),
        tx,
      );
      return { id: kayit.id, finishAt: kayit.finishAt, ad: durum.ad, erken: durum.erken };
    });
  });

  app.delete('/arastirma/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);

    return lordIslemi(lordId, async (tx) => {
      const satir = await tx.queue.findUnique({ where: { id } });
      if (!satir || satir.lordId !== lordId || satir.kind !== 'research' || satir.resolved)
        throw new GameError('Böyle bir araştırma yok.', 404, 'ARASTIRMA_YOK');

      const key = String((satir.payload as { key?: string }).key ?? '');
      const dugum = arastirmaDugumu(key);
      const maliyet = dugum ? arastirmaMaliyeti(dugum.kademe) : { altin: 0, demir: 0, erzak: 0 };
      const oran = B.arastirma.iptal_iadesi;

      await tx.queue.delete({ where: { id } });
      await tickLord(lordId, new Date(), tx);
      await tx.lord.update({
        where: { id: lordId },
        data: {
          altin: { increment: Math.floor(maliyet.altin * oran) },
          demir: { increment: Math.floor(maliyet.demir * oran) },
          erzak: { increment: Math.floor(maliyet.erzak * oran) },
        },
      });
      return { iptal: true, iade: oran };
    });
  });

  /**
   * Dışlayan bir seçimi bırakır (docs/20 §5): o yolun tamamlanmış
   * düğümleri silinir, bedellerinin yarısı geri gelir, grup
   * `yol_degisim_bekleme_saat` boyunca yeniden değiştirilemez.
   *
   * Bırakmak ile yeni yolu seçmek AYRI adımlar: bıraktıktan sonra aynı
   * grubun istenen seçeneği normal bir araştırma gibi başlatılıyor. Tek
   * uçta "değiştir" deseydik yeni yolun ilk düğümünü de bu işlemin içinde
   * başlatmak, kuyruk ve kaynak kurallarını ikinci kez yazmak gerekirdi.
   */
  app.post('/arastirma/yol-birak', { preHandler: requireAuth }, async (req) => {
    const { grup } = birakSchema.parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    await gecikmisleriKapat(lordId);
    if (!GRUPLAR.some((g) => g.key === grup))
      throw new GameError('Böyle bir seçim yok.', 404, 'GRUP_YOK');

    return lordIslemi(lordId, async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { arastirmalar: true, arastirmaDegisim: true },
      });
      const tamamlanan = okuArastirmalar(lord.arastirmalar);
      const plan = yolBirakmaPlani(tamamlanan, grup);
      if (!plan) throw new GameError('Bu seçimde bıraktığın bir yol yok.', 400, 'YOL_SECILMEDI');

      const simdi = new Date();
      const degisim = degisimOku(lord.arastirmaDegisim);
      const acilis = sonrakiDegisim(degisim, grup, simdi);
      if (acilis)
        throw new GameError(
          `Bu seçimi ${kalanMetni(acilis.getTime() - simdi.getTime())} sonra değiştirebilirsin.`,
          400,
          'YOL_BEKLEMEDE',
        );

      // Yolun bir düğümü araştırılırken bırakmak, bitince silinmiş bir
      // yola düğüm yazmak olurdu. Oyuncu önce iptal ediyor — iptal zaten
      // yarısını iade ediyor, yani kayıp aynı.
      const yolKeys = new Set(yolDugumleri(plan.yol).map((d) => d.key));
      const yolda = (await surenArastirmalar(lordId, tx)).find((s) => s.key && yolKeys.has(s.key));
      if (yolda)
        throw new GameError(
          `Önce süren ${yolda.ad} araştırmasını bitir ya da iptal et.`,
          400,
          'YOL_ARASTIRILIYOR',
        );

      // Önce birikmiş geliri yaz: iade tavana karşı bugünkü kesenin
      // üstüne eklensin, dünkü değil (iptalle aynı sıra).
      await tickLord(lordId, simdi, tx);
      await tx.lord.update({
        where: { id: lordId },
        data: {
          arastirmalar: tamamlanan.filter((k) => !plan.silinecek.includes(k)),
          arastirmaDegisim: { ...degisim, [grup]: simdi.toISOString() },
          altin: { increment: plan.iade.altin },
          demir: { increment: plan.iade.demir },
          erzak: { increment: plan.iade.erzak },
        },
      });
      return {
        grup,
        yol: plan.yol,
        silinen: plan.silinecek,
        iade: plan.iade,
        sonrakiDegisim: new Date(
          simdi.getTime() + B.arastirma.yol_degisim_bekleme_saat * 3_600_000,
        ),
      };
    });
  });
}
