/**
 * Yayın kontrolünün sunucu yanı: girdiyi toplar (bkz. shared `yayin.ts`).
 *
 * Buradan çıkan her şey evet/hayır ya da sayı. Ayarların DEĞERİ — imza,
 * anahtarlar, adresler — bu dosyanın dışına çıkmıyor; pano, günlük ve
 * komut satırı yalnız adı ve durumu görüyor.
 */
import {
  HIZ_SINIRI_TAVANI,
  YAYIN_ELLE,
  YAYIN_METNI,
  adresSinifi,
  jwtGucluMu,
  yayinDenetimi,
  yayinOzeti,
  type YayinBulgusu,
} from '@lordlar/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { izlemeAcikMi } from '../izleme.js';
import { ipKaynagi } from '../istemciIp.js';
import { playHesabiBozukMu } from './play.js';

const YEREL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i;

/**
 * `istek`: panoyu açan yöneticinin isteğinde görülen (`istekIzi`).
 * Açılışta ve komut satırında yok; IP kaynağı o zaman yalnız ayardan.
 */
export async function yayinKontrolu(
  istek: { vekilIzi: boolean; baslikEksik: boolean } | null = null,
): Promise<YayinBulgusu[]> {
  const yoneticiSayisi = await prisma.user.count({ where: { yonetici: true } });
  return yayinDenetimi({
    uretim: env.NODE_ENV === 'production',
    jwtGuclu: jwtGucluMu(env.JWT_SECRET),
    demoLordlar: env.seedDemoLords,
    yoneticiSayisi,
    sentryDsn: Boolean(env.SENTRY_DSN),
    izlemeAcik: izlemeAcikMi(),
    epostaTasiyici: env.EPOSTA_TASIYICI,
    epostaAnahtar: Boolean(env.EPOSTA_ANAHTAR),
    epostaGonderenYerel: /@localhost\b/i.test(env.EPOSTA_GONDEREN),
    vapidAcik: Boolean(env.VAPID_ACIK_ANAHTAR),
    vapidGizli: Boolean(env.VAPID_GIZLI_ANAHTAR),
    uygulamaUrl: adresSinifi(env.UYGULAMA_URL ?? env.RENDER_EXTERNAL_URL),
    arayuzAyni: env.serveWeb,
    webOriginYerel: env.webOrigins.every((o) => YEREL.test(o)),
    destekEposta: Boolean(env.DESTEK_EPOSTA),
    hizSiniriYuksek:
      env.RATE_LIMIT_MAX > HIZ_SINIRI_TAVANI.genel ||
      env.AUTH_RATE_LIMIT_MAX > HIZ_SINIRI_TAVANI.giris,
    logAyrintili: env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace',
    resimSiniflandirici: env.RESIM_SINIFLANDIRICI === 'acik',
    ipKaynagi: ipKaynagi(),
    renderda: Boolean(env.RENDER_EXTERNAL_URL),
    istek,
    play:
      env.PLAY_PAKET_ADI && env.PLAY_SERVIS_HESABI
        ? playHesabiBozukMu()
          ? 'bozuk'
          : 'tamam'
        : env.PLAY_PAKET_ADI || env.PLAY_SERVIS_HESABI
          ? 'yarim'
          : 'yok',
    reklam: {
      birim: Boolean(env.ADMOB_ODUL_BIRIMI),
      yayinci: Boolean(env.ADMOB_YAYINCI_KIMLIGI),
      // ca-app-pub-<yayıncı>/<birim> ile pub-<yayıncı> aynı rakamlar mı.
      uyusuyor:
        /^ca-app-pub-(\d+)\//.exec(env.ADMOB_ODUL_BIRIMI ?? '')?.[1] ===
        /^pub-(\d+)$/.exec(env.ADMOB_YAYINCI_KIMLIGI ?? '')?.[1],
    },
  });
}

/**
 * Sunucu bir yere kurulmuş mu: üretim kipi, Render ya da arayüzü kendisi
 * sunuyor. Geliştirmede her açılışta on satır "eksik" yazmak gürültü;
 * kurulmuş bir sunucuda ise tam okunması gereken yer açılış günlüğü.
 */
export function kurulumMu(): boolean {
  return env.NODE_ENV === 'production' || Boolean(env.RENDER_EXTERNAL_URL) || env.serveWeb;
}

const ISARET = { tamam: '✓', eksik: '✗', uyari: '!' } as const;

/** Düz metin rapor: açılış günlüğü ve `pnpm yayin-kontrolu`. */
export function yayinRaporu(bulgular: readonly YayinBulgusu[]): string {
  const o = yayinOzeti(bulgular);
  const sira = { eksik: 0, uyari: 1, tamam: 2 } as const;
  return [
    `Yayın kontrolü: ${o.eksik} eksik, ${o.uyari} uyarı (docs/05 §6)`,
    ...[...bulgular]
      .sort((a, b) => sira[a.durum] - sira[b.durum])
      .map((b) => `  ${ISARET[b.durum]} ${b.ad}: ${YAYIN_METNI[b.neden]}`),
    'Sunucunun bilemediği, elle denenecek:',
    ...YAYIN_ELLE.map((m) => `  ? ${m}`),
  ].join('\n');
}
