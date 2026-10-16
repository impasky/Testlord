/**
 * İSTEMCİNİN IP'Sİ — tek kapı.
 *
 * Sunucu barındırmada bir vekilin arkasında çalışıyor ve Fastify'a vekile
 * güvenmesi söylenmemişti: `req.ip` her istekte VEKİLİN adresiydi. Kayıt
 * ve giriş sınırı (IP başına dakikada 60) bu yüzden bütün oyunculara TEK
 * kovaydı — açılış günü dakikada 60 kayıttan sonra herkes 429 alırdı,
 * parola deneyen tek bir saldırgan da herkesin girişini kilitlerdi.
 *
 * Adres üç yoldan biriyle okunuyor (env.ts):
 *
 *   1. `ISTEMCI_IP_BASLIGI` — vekilin yazdığı ve istemcinin EZEMEDİĞİ bir
 *      başlık. DigitalOcean App Platform'da `do-connecting-ip`; orada
 *      `X-Forwarded-For` DigitalOcean'ın kendi giriş sunucusunu gösteriyor.
 *      Render'da `cf-connecting-ip` (önündeki Cloudflare yazıyor);
 *      `X-Forwarded-For` orada da yerine geçmiyor: Render ona istemcinin
 *      yolladığını silmeden EKLİYOR, baştaki adres uydurulabilir.
 *   2. `VEKIL_SAYISI` — kendi Caddy/nginx'in için: Fastify
 *      X-Forwarded-For'un sondan o kadar adımına güveniyor (`trustProxy`).
 *   3. İkisi de yoksa bağlantının kendisi (geliştirme, vekilsiz kurulum).
 *
 * Başlık ayarlı ama istekte yoksa (vekil değişmiş, ad yanlış) bağlantıya
 * düşülüyor. İstek bir vekilden geçmişse (başka vekil başlığı var) bu bir
 * ayar hatası ve günlüğe BİR KEZ yazılıyor; hiç vekil izi yoksa istek
 * içeriden geliyor — Render'ın sağlık denetimi böyle — ve susuluyor.
 * Yayın kontrolü de yöneticinin kendi isteğine bakıp panoda söylüyor
 * (`istekIzi`).
 *
 * Geliştirmede `x-test-ip` başlığı adresi seçiyor: çoklu hesap testi iki
 * lordu "aynı ağdan" gösterebilsin diye. Üretimde yok sayılıyor.
 */
import { isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';
import { env } from './env.js';
import { ipSec, tekDeger } from './services/ag.js';

let eksikYazildi = false;

export function istemciIp(req: FastifyRequest): string {
  const { ip, baslikEksik } = ipSec(req.headers, req.ip, {
    uretim: env.NODE_ENV === 'production',
    baslik: env.ISTEMCI_IP_BASLIGI,
  });
  if (baslikEksik && !eksikYazildi && vekilIziVar(req)) {
    eksikYazildi = true;
    req.log.warn(
      `ISTEMCI_IP_BASLIGI=${env.ISTEMCI_IP_BASLIGI} ayarlı ama istekte yok; IP bağlantıdan okunuyor ` +
        '(vekilin adresi olabilir). Yönetici panosundaki yayın kontrolüne bak.',
    );
  }
  return ip;
}

/** Hangi yoldan okunuyor — yayın kontrolü için, değer değil. */
export function ipKaynagi(): 'baslik' | 'vekil' | 'baglanti' {
  if (env.ISTEMCI_IP_BASLIGI) return 'baslik';
  if (env.VEKIL_SAYISI > 0) return 'vekil';
  return 'baglanti';
}

/** Vekil izi taşıyan başlıklar: varsa istek bir vekilden geçmiş. */
const VEKIL_BASLIKLARI = [
  'x-forwarded-for',
  'forwarded',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'do-connecting-ip',
];

function vekilIziVar(req: FastifyRequest): boolean {
  return VEKIL_BASLIKLARI.some((b) => tekDeger(req.headers, b) !== undefined);
}

/**
 * Bu istekte ne görülüyor — adreslerin kendisi değil, yalnız evet/hayır.
 * Yayın kontrolü yöneticinin kendi isteğiyle ayarın gerçekten tuttuğunu
 * ölçüyor; açılışta istek olmadığı için orada bu bilgi yok.
 */
export function istekIzi(req: FastifyRequest): { vekilIzi: boolean; baslikEksik: boolean } {
  const vekilIzi = vekilIziVar(req);
  const baslikEksik = env.ISTEMCI_IP_BASLIGI
    ? !isIP(tekDeger(req.headers, env.ISTEMCI_IP_BASLIGI) ?? '')
    : false;
  return { vekilIzi, baslikEksik };
}
