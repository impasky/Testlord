/**
 * PUSH BİLDİRİMİ — oyuncuyu geri çağıran tek kanal (docs/07 M14).
 *
 * ── Neden gerekli ────────────────────────────────────────────────────
 *
 * Lordlar Çağı bekleme üzerine kurulu: ordu yürür, kuyruk dolar, saldırı
 * gelir. Oyuncu bunların hiçbirini uygulama kapalıyken göremiyordu, yani
 * "ordum ne zaman döner" sorusunun tek cevabı tahminen dönüp bakmaktı.
 * Daha kötüsü savunma tarafındaydı: gece uğranan bir baskını oyuncu
 * sabah, olan bitmiş hâlde öğreniyordu.
 *
 * ── Neden dış servis yok ─────────────────────────────────────────────
 *
 * Web Push standardı ve VAPID sayesinde araya kimse girmiyor: anahtar
 * çifti YEREL üretiliyor (`pnpm push-anahtari`), sunucu bildirimi
 * tarayıcının kendi push servisine imzalayıp gönderiyor. Kaydolunacak
 * bir hesap, ödenecek bir ücret, paylaşılacak bir oyuncu listesi yok.
 *
 * ── Kapalıyken sessiz DEĞİL ──────────────────────────────────────────
 *
 * Anahtar yoksa push kapalı ve uçlar bunu açıkça söylüyor. Yarı
 * yapılandırılmış bir push — açık görünüp sessizce hiçbir şey
 * göndermeyen — hata ayıklanamayan bir özelliktir.
 *
 * ── Ölü abonelik kendini siliyor ─────────────────────────────────────
 *
 * Oyuncu uygulamayı kaldırınca ya da izni geri alınca push servisi 404
 * ya da 410 dönüyor. O abonelik anında siliniyor: ölü adrese göndermeye
 * devam etmek push servislerinin kötüye kullanım saydığı şey ve bir
 * gün bütün bildirimlerin engellenmesiyle biter.
 */
import webpush from 'web-push';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { gonderimKarari } from './pushPolitika.js';

let kuruldu = false;

/** VAPID kurulumu bir kez. Anahtar yoksa hiç kurulmuyor. */
function kur(): boolean {
  if (!env.pushAcik) return false;
  if (!kuruldu) {
    webpush.setVapidDetails(env.VAPID_ILETISIM, env.VAPID_ACIK_ANAHTAR, env.VAPID_GIZLI_ANAHTAR);
    kuruldu = true;
  }
  return true;
}

/** İstemcinin abone olmak için ihtiyaç duyduğu açık anahtar. */
export function acikAnahtar(): string | null {
  return env.pushAcik ? env.VAPID_ACIK_ANAHTAR : null;
}

export interface Abonelik {
  endpoint: string;
  p256dh: string;
  auth: string;
  cihaz?: string | null;
}

/**
 * Cihazı kaydeder. Aynı adres yeniden gelirse GÜNCELLENİYOR.
 *
 * Tarayıcı izni yenileyince aynı `endpoint`i veriyor ama anahtarları
 * değişebiliyor. Yeni satır açsaydık aynı cihaza iki bildirim giderdi ve
 * eskisi zaten çalışmazdı.
 */
export async function aboneOl(lordId: string, a: Abonelik): Promise<void> {
  await prisma.pushAbonesi.upsert({
    where: { endpoint: a.endpoint },
    create: {
      lordId,
      endpoint: a.endpoint,
      p256dh: a.p256dh,
      auth: a.auth,
      cihaz: a.cihaz ?? null,
    },
    // lordId de güncelleniyor: aynı cihazdan başka bir hesapla girilirse
    // bildirim ESKİ lorda gitmeye devam etmemeli.
    update: { lordId, p256dh: a.p256dh, auth: a.auth, cihaz: a.cihaz ?? null },
  });
}

export async function abonelikBirak(lordId: string, endpoint: string): Promise<number> {
  const { count } = await prisma.pushAbonesi.deleteMany({ where: { lordId, endpoint } });
  return count;
}

export interface Bildirim {
  baslik: string;
  govde: string;
  /** Tıklanınca açılacak arayüz yolu, örn. `/dunya`. */
  yol?: string;
  /**
   * Aynı etiketli bildirim ÜSTÜNE YAZIYOR.
   *
   * Kuyruk bildirimlerinde şart: üç eğitim üst üste bitince oyuncunun
   * bildirim merkezinde üç satır değil bir satır olmalı.
   */
  etiket?: string;
}

/**
 * Bir lorda bildirim gönderir. Kaç cihaza ulaştığını döndürür.
 *
 * HATA YUTULUYOR ve bu kasıtlı: bildirim bir yan etki. Push servisine
 * ulaşamamak, savaşın çözülmesini ya da kuyruğun bitmesini
 * engellememeli — worker'ın turu bir bildirim yüzünden düşmemeli.
 */
export async function bildirimGonder(lordId: string, b: Bildirim): Promise<number> {
  if (!kur()) return 0;

  const aboneler = await prisma.pushAbonesi.findMany({ where: { lordId } });
  if (aboneler.length === 0) return 0;

  const yuk = JSON.stringify({
    baslik: b.baslik,
    govde: b.govde,
    yol: b.yol ?? '/',
    etiket: b.etiket ?? 'lordlar',
  });

  let ulasan = 0;
  for (const a of aboneler) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        yuk,
      );
      ulasan++;
      await prisma.pushAbonesi.update({
        where: { id: a.id },
        data: { sonGonderim: new Date() },
      });
    } catch (e) {
      const durum = (e as { statusCode?: number }).statusCode;
      // Kararı `pushPolitika` veriyor: ölü aboneliği silmek ile geçici
      // hatada silmemek arasındaki ayrım, ayrı ve test edilebilir bir
      // yerde duruyor (ikisi de sessiz kusur, bkz. o dosyanın notu).
      if (gonderimKarari(durum) === 'sil') {
        await prisma.pushAbonesi.delete({ where: { id: a.id } }).catch(() => undefined);
      } else {
        // worker'ın kendi günlüğüyle aynı kanal: bildirim bir yan etki,
        // ayrı bir günlük altyapısı hak etmiyor. Sebep de yazılıyor:
        // durum kodu olmayan hatalar (ağ, yapılandırma) yalnız kodla
        // teşhis edilemiyor ve "durum ?" tek başına hiçbir şey söylemez.
        const sebep = e instanceof Error ? e.message : String(e);
        console.warn(
          `Push gönderilemedi (lord ${lordId}, durum ${durum ?? '?'}): ${sebep.slice(0, 200)}`,
        );
      }
    }
  }
  return ulasan;
}

/** Bu lordun kaç cihazı bildirim alıyor. */
export async function cihazSayisi(lordId: string): Promise<number> {
  return prisma.pushAbonesi.count({ where: { lordId } });
}
