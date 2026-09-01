/**
 * Hata izleme ve yapılandırılmış log.
 *
 * Sentry isteğe bağlı: SENTRY_DSN yoksa SDK hiç başlatılmaz ve hatalar
 * yalnızca log'a yazılır. Böylece geliştirme ve yerel koşular dışarıya
 * hiçbir şey göndermez, üretimde ise tek bir ortam değişkeniyle açılır.
 *
 * Neden Sentry'ye "her hata" gönderilmiyor: 4xx'ler oyunun normal işleyişi.
 * "Altının yetmiyor", "kalkan var", "kapasite dolu" — bunlar hata değil kural.
 * Hepsini gönderirsek gerçek çökmeler gürültüde kaybolur. Sadece 5xx ve
 * yakalanmamış istisnalar bildirilir.
 */
import * as Sentry from '@sentry/node';
import { env } from './env.js';

let acik = false;

export function izlemeBaslat(): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Örnekleme oranı: ücretsiz katmanda kota var, her isteği izlemek
    // birkaç günde kotayı bitirir. Hata bildirimleri bundan etkilenmez.
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    // Parola, token ve e-posta gönderilmez.
    sendDefaultPii: false,
  });
  acik = true;
}

export function izlemeAcikMi(): boolean {
  return acik;
}

/** Sunucu hatasını bildirir. Bağlam, olayı tekrar üretmeye yetecek kadar. */
export function hataBildir(
  err: unknown,
  baglam: { yol?: string; yontem?: string; istekId?: string; lordId?: string } = {},
): void {
  if (!acik) return;
  Sentry.withScope((scope) => {
    scope.setContext('istek', baglam);
    if (baglam.istekId) scope.setTag('istek_id', baglam.istekId);
    if (baglam.yol) scope.setTag('yol', baglam.yol);
    Sentry.captureException(err);
  });
}

/**
 * Süreci düşüren hatalar. Fastify'ın hata yöneticisi bunları görmez:
 * istek döngüsünün dışında, zamanlayıcıda ya da worker'da patlarlar.
 */
export function surecHatalariniYakala(log: {
  fatal: (o: object, m: string) => void;
}): void {
  process.on('unhandledRejection', (sebep) => {
    log.fatal({ err: sebep }, 'Yakalanmamış promise reddi');
    hataBildir(sebep, { yol: 'unhandledRejection' });
  });
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'Yakalanmamış istisna');
    hataBildir(err, { yol: 'uncaughtException' });
    // Bilinmeyen durumda çalışmaya devam etmek veriyi bozabilir. Sentry'nin
    // olayı göndermesine kısa bir süre tanıyıp kapanıyoruz; Render/systemd
    // süreci yeniden başlatır.
    void Sentry.close(2000).then(() => process.exit(1));
  });
}
