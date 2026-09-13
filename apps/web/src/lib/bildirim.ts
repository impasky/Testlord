/**
 * BİLDİRİM İZNİ — tarayıcı tarafı.
 *
 * ── Neden ayrı bir dosya ─────────────────────────────────────────────
 *
 * Push'un tarayıcı tarafı üç ayrı API'nin (Notification, ServiceWorker,
 * PushManager) el sıkışması ve her birinin kendi "desteklenmiyor" hâli
 * var. Bunu bir bileşenin içine yazmak, o bileşeni okunmaz yapardı.
 *
 * ── Sessiz başarısızlık YOK ──────────────────────────────────────────
 *
 * Her yol ya açık bir durum ya da açık bir sebep döndürüyor. "Düğmeye
 * bastım, hiçbir şey olmadı" en kötü hâl: oyuncu bildirimlerin açık
 * olduğunu sanıp beklerse, hiç açmamış olmasından kötü durumda kalır.
 *
 * ── iOS'un kuralı ────────────────────────────────────────────────────
 *
 * iOS'ta web push YALNIZCA ana ekrana eklenmiş uygulamada çalışıyor.
 * Safari sekmesinde `PushManager` var ama izin isteği sessizce
 * reddediliyor. Bu yüzden ayrı bir durum döndürüyoruz: oyuncuya "önce
 * ana ekrana ekle" demek, "bildirimler açılamadı" demekten çok daha
 * işe yarar.
 */
import { api } from '../api/client';

export type BildirimDurumu =
  | 'acik' // abone, bildirim geliyor
  | 'kapali' // desteklenip açılmamış
  | 'reddedildi' // oyuncu izni reddetmiş, tarayıcı ayarından açması gerek
  | 'sunucu-kapali' // sunucuda VAPID anahtarı yok
  | 'ios-ana-ekran' // iOS'ta ana ekrana eklenmesi gerekiyor
  | 'desteklenmiyor';

export interface BildirimHali {
  durum: BildirimDurumu;
  cihazSayisi: number;
}

/** iOS mu — ve ana ekrandan mı açılmış. */
function iosSafariSekmesi(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!ios) return false;
  const anaEkran =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return !anaEkran;
}

function destekVar(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Service worker'ı kaydeder (varsa hazır olanı döndürür). */
async function kayit(): Promise<ServiceWorkerRegistration> {
  const mevcut = await navigator.serviceWorker.getRegistration('/');
  if (mevcut) return mevcut;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/**
 * Sunucunun base64url anahtarını tarayıcının beklediği baytlara çevirir.
 *
 * `ArrayBuffer` döndürüyor, `Uint8Array` değil: TypeScript'in DOM
 * tipleri `applicationServerKey` için `ArrayBuffer` isterken
 * `Uint8Array`in tabanı `ArrayBufferLike` (paylaşılan bellek de
 * olabilir) ve ikisi uyuşmuyor.
 */
function anahtariBaytaCevir(base64url: string): ArrayBuffer {
  const dolgu = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + dolgu).replace(/-/g, '+').replace(/_/g, '/');
  const ham = atob(base64);
  const tampon = new ArrayBuffer(ham.length);
  const bayt = new Uint8Array(tampon);
  for (let i = 0; i < ham.length; i++) bayt[i] = ham.charCodeAt(i);
  return tampon;
}

/** Şu anki hâl — düğmenin ne göstereceğini bu belirliyor. */
export async function bildirimHali(): Promise<BildirimHali> {
  if (!destekVar()) {
    return { durum: iosSafariSekmesi() ? 'ios-ana-ekran' : 'desteklenmiyor', cihazSayisi: 0 };
  }

  // Sunucuda anahtar yoksa düğme hiç çıkmamalı: çalışmayacak bir düğme,
  // bozuk bir düğmeden beterdir.
  const sunucu = await api.pushAnahtar().catch(() => null);
  if (!sunucu?.acik || !sunucu.anahtar) return { durum: 'sunucu-kapali', cihazSayisi: 0 };

  if (Notification.permission === 'denied') {
    return { durum: 'reddedildi', cihazSayisi: sunucu.cihazSayisi };
  }

  const reg = await navigator.serviceWorker.getRegistration('/');
  const abone = await reg?.pushManager.getSubscription();
  return {
    durum: abone ? 'acik' : 'kapali',
    cihazSayisi: sunucu.cihazSayisi,
  };
}

/**
 * İzni ister ve bu cihazı kaydeder.
 *
 * İzin isteği KULLANICI HAREKETİNDEN çağrılmalı — tarayıcılar sayfa
 * açılışında sorulan izni sessizce reddediyor. Bu yüzden burada
 * kendiliğinden çağrılan bir şey yok; düğmeye basılınca çalışıyor.
 */
export async function bildirimAc(): Promise<BildirimHali> {
  if (!destekVar()) {
    return { durum: iosSafariSekmesi() ? 'ios-ana-ekran' : 'desteklenmiyor', cihazSayisi: 0 };
  }

  const sunucu = await api.pushAnahtar();
  if (!sunucu.acik || !sunucu.anahtar) return { durum: 'sunucu-kapali', cihazSayisi: 0 };

  const izin = await Notification.requestPermission();
  if (izin !== 'granted') {
    return { durum: izin === 'denied' ? 'reddedildi' : 'kapali', cihazSayisi: sunucu.cihazSayisi };
  }

  const reg = await kayit();
  await navigator.serviceWorker.ready;

  // Zaten abone olabilir (izin yeniden verildi): mevcut aboneliği
  // kullanıyoruz. Yenisini istemek eskisini geçersiz kılardı.
  const abone =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      // Sessiz push'a izin yok: gösterimsiz bildirim gönderen siteler
      // tarayıcı tarafından cezalandırılıyor ve zaten bizim de her
      // bildirimimizin gösterilecek bir sebebi var.
      userVisibleOnly: true,
      applicationServerKey: anahtariBaytaCevir(sunucu.anahtar),
    }));

  const sonuc = await api.pushAbone(abone.toJSON(), navigator.userAgent.slice(0, 200));
  return { durum: 'acik', cihazSayisi: sonuc.cihazSayisi };
}

/** Bu cihazın aboneliğini bitirir. */
export async function bildirimKapat(): Promise<BildirimHali> {
  if (!destekVar()) return { durum: 'desteklenmiyor', cihazSayisi: 0 };

  const reg = await navigator.serviceWorker.getRegistration('/');
  const abone = await reg?.pushManager.getSubscription();
  if (!abone) return { durum: 'kapali', cihazSayisi: 0 };

  // Önce SUNUCUDAN siliniyor: tarayıcı aboneliğini önce iptal edersek ve
  // sunucu isteği düşerse, sunucuda ölü bir adres kalır ve oyuncunun onu
  // temizlemesinin bir yolu kalmaz.
  const sonuc = await api.pushCik(abone.endpoint).catch(() => ({ cihazSayisi: 0 }));
  await abone.unsubscribe().catch(() => undefined);
  return { durum: 'kapali', cihazSayisi: sonuc.cihazSayisi };
}
