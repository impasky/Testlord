/**
 * Ödüllü reklam — oturum ve ödül (docs/25).
 *
 *   oturumAc   istemci reklamı İSTEMEDEN önce: tavan ve bekleme burada
 *              denetleniyor, oturum kimliği reklama `custom_data` oluyor.
 *   ssvIsle    Google'ın imzalı çağrısı (admob.ts doğruladıktan sonra):
 *              ödül YALNIZ burada veriliyor.
 *
 * Ödül elmas değil SÜRE: seçilen kuyruktan `odul_dakika` siliniyor;
 * kuyruk o arada bittiyse ya da ödül kalandan büyükse artanı bankaya.
 * Aynı Google çağrısının tekrarı (`transaction_id`) ve aynı oturumun
 * ikinci ödülü koşullu yazımla engelleniyor.
 */
import { REKLAM, gunNumarasi, reklamHakki, reklamOdulunuDagit } from '@lordlar/shared';
import { prisma } from '../db.js';
import { GameError } from '../errors.js';
import { birimBizimMi, type SsvAlanlari } from './admob.js';
import { hizlandirilacakKuyruk, kuyruguKisalt } from './hizlandirma.js';
import { lordIslemi } from './kilit.js';
import { hesapEtiketi } from './play.js';
import { gecikmisIsleriCoz } from './queue.js';

const gunBasi = (simdi: Date) => new Date(gunNumarasi(simdi) * 86_400_000);

/** Bugünün (UTC) oturum sayısı ve son oturum — tavan ve bekleme için. */
export async function reklamGecmisi(lordId: string, simdi: Date) {
  const [bugun, son] = await Promise.all([
    prisma.reklamOturumu.count({ where: { lordId, createdAt: { gte: gunBasi(simdi) } } }),
    prisma.reklamOturumu.findFirst({
      where: { lordId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  return reklamHakki(bugun, son?.createdAt ?? null, simdi);
}

export async function oturumAc(lordId: string, hedefKuyrukId: string | null, simdi = new Date()) {
  return lordIslemi(lordId, async (tx) => {
    const hak = await reklamGecmisi(lordId, simdi);
    if (hak.engel === 'tavan') {
      throw new GameError(
        `Bugünlük reklam hakkın bitti (${REKLAM.gunlukTavan}). Yarın yenilenir.`,
        429,
        'REKLAM_TAVAN',
      );
    }
    if (hak.engel === 'bekleme') {
      throw new GameError(
        `Bir sonraki reklam için ${hak.beklemeSn} sn bekle.`,
        429,
        'REKLAM_BEKLE',
      );
    }
    // Hedef verildiyse ŞİMDİ geçerli olmalı; reklam bitene kadar biterse
    // ödül bankaya gider (ssvIsle).
    if (hedefKuyrukId) await hizlandirilacakKuyruk(tx, lordId, hedefKuyrukId, simdi);
    const o = await tx.reklamOturumu.create({
      data: { lordId, hedefKuyrukId },
      select: { id: true },
    });
    return { oturumId: o.id, kullanici: hesapEtiketi(lordId), kalan: hak.kalan - 1 };
  });
}

/** Saklama süresi (`reklam.saklama_gun`) dolan oturumları siler; gizlilik metni bu süreyi söylüyor. */
export async function eskiReklamOturumlariniSil(simdi = new Date()): Promise<number> {
  const sinir = new Date(simdi.getTime() - REKLAM.saklamaGun * 86_400_000);
  const { count } = await prisma.reklamOturumu.deleteMany({ where: { createdAt: { lt: sinir } } });
  return count;
}

export type SsvSonucu = 'odullendi' | 'tekrar' | 'yok_sayildi';

/**
 * İmzası doğrulanmış SSV çağrısını işler. Google'a her durumda 200
 * dönülüyor (tekrar ya da yok sayılan dahil): 200 dışı cevap Google'ı
 * aynı çağrıyı yeniden denemeye iter ve hiçbir yeniden deneme yok
 * sayılan bir çağrıyı geçerli kılmaz.
 */
export async function ssvIsle(a: SsvAlanlari, simdi = new Date()): Promise<SsvSonucu> {
  if (!a.transactionId || !a.customData || !birimBizimMi(a.adUnit)) return 'yok_sayildi';
  const o = await prisma.reklamOturumu.findUnique({
    where: { id: a.customData },
    select: { id: true, lordId: true, hedefKuyrukId: true, durum: true, createdAt: true },
  });
  if (!o) return 'yok_sayildi';
  if (o.durum !== 'bekliyor') return 'tekrar';
  if (simdi.getTime() - o.createdAt.getTime() > REKLAM.oturumOmruDk * 60_000) return 'yok_sayildi';
  // Uygulama reklama lordun etiketini de veriyor; başka bir lordun
  // oturum kimliğini kendi reklamına yazmak işe yaramasın.
  if (a.userId && a.userId !== hesapEtiketi(o.lordId)) return 'yok_sayildi';

  const sonuc = await lordIslemi(o.lordId, async (tx) => {
    // Koşullu: aynı oturum ya da aynı Google işlemi ikinci kez ödül vermez.
    let alindi;
    try {
      alindi = await tx.reklamOturumu.updateMany({
        where: { id: o.id, durum: 'bekliyor' },
        data: { durum: 'odullendi', islemNo: a.transactionId, odulAt: simdi },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return 'tekrar' as const;
      throw e;
    }
    if (alindi.count === 0) return 'tekrar' as const;

    const lord = await tx.lord.findUniqueOrThrow({
      where: { id: o.lordId },
      select: { reklamDakikasi: true },
    });
    let kalanSn = 0;
    let kuyruk = null;
    if (o.hedefKuyrukId) {
      try {
        kuyruk = await hizlandirilacakKuyruk(tx, o.lordId, o.hedefKuyrukId, simdi);
        kalanSn = kuyruk.kalanSaniye;
      } catch {
        kuyruk = null; // bitmiş ya da silinmiş: ödül bankaya
      }
    }
    const d = reklamOdulunuDagit(kalanSn, lord.reklamDakikasi);
    if (kuyruk && d.kuyrukSaniye > 0) await kuyruguKisalt(tx, kuyruk, d.kuyrukSaniye, simdi);
    if (d.bankayaDakika > 0) {
      await tx.lord.update({
        where: { id: o.lordId },
        data: { reklamDakikasi: { increment: d.bankayaDakika } },
      });
    }
    await tx.reklamOturumu.update({
      where: { id: o.id },
      data: { kuyrukSaniye: d.kuyrukSaniye, bankaDakika: d.bankayaDakika },
    });
    return 'odullendi' as const;
  });
  if (sonuc === 'odullendi') await gecikmisIsleriCoz(o.lordId, simdi);
  return sonuc;
}
