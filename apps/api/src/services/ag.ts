/**
 * Ağ adresi hesapları — SAF (ortam ayarı okumuyor, test edilebilir).
 *
 * İki iş: isteğin hangi adresten geldiğini SEÇMEK (`ipSec`, kapısı
 * istemciIp.ts) ve adresin geri çevrilemez ÖZETİNİ çıkarmak (`agOzeti`,
 * çoklu hesap izi için — services/agIzi.ts).
 */
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export type Basliklar = Record<string, string | string[] | undefined>;

/** Başlığın tek değeri; dizi gelirse ilki. */
export function tekDeger(b: Basliklar, ad: string): string | undefined {
  const v = b[ad];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

export interface IpAyari {
  uretim: boolean;
  baslik?: string;
}

/**
 * Hangi adres. `baglanti` Fastify'ın `req.ip`si (VEKIL_SAYISI orada
 * uygulanmış). Geçerli IP olmayan başlık değeri — virgüllü liste, boş,
 * uydurma — yok sayılıyor ve bağlantıya düşülüyor.
 */
export function ipSec(
  basliklar: Basliklar,
  baglanti: string,
  ayar: IpAyari,
): { ip: string; baslikEksik: boolean } {
  if (!ayar.uretim) {
    const t = tekDeger(basliklar, 'x-test-ip');
    if (t && isIP(t)) return { ip: t, baslikEksik: false };
  }
  if (ayar.baslik) {
    const d = tekDeger(basliklar, ayar.baslik);
    if (d && isIP(d)) return { ip: d, baslikEksik: false };
    return { ip: baglanti, baslikEksik: true };
  }
  return { ip: baglanti, baslikEksik: false };
}

/**
 * Adresin "ağ" kısmı: aynı evden gelenler aynı anahtarda buluşsun.
 *
 * IPv4'te adresin TAMAMI: ev bir genel adresin arkasında (NAT) ve
 * içerideki bütün cihazlar dışarıya o adresle çıkıyor. IPv6'da ise her
 * cihazın kendi adresi var ve gizlilik eklentisi onu saatte bir
 * değiştiriyor; evin ortak kısmı ilk 64 bit. `::ffff:1.2.3.4` biçimi
 * IPv4 sayılıyor — yoksa aynı ev iki ayrı ağ görünürdü.
 *
 * Geçersiz adres `null`: iz yazılmıyor.
 */
export function agAnahtari(ip: string): string | null {
  const a = ip.trim().toLowerCase();
  const eslenik = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (eslenik) return agAnahtari(eslenik[1]!);
  const tur = isIP(a);
  if (tur === 4) return `4:${a}`;
  if (tur !== 6) return null;
  const tam = ipv6Ac(a);
  return tam ? `6:${tam.slice(0, 4).join(':')}` : null;
}

/** IPv6'yı sekiz tam gruba açar ("2001:db8::1" → 8 grup). */
function ipv6Ac(a: string): string[] | null {
  const yuzde = a.indexOf('%'); // bölge eki: fe80::1%eth0
  const s = yuzde >= 0 ? a.slice(0, yuzde) : a;
  const [bas, son] = s.split('::') as [string, string | undefined];
  const parca = (x: string) => (x ? x.split(':') : []);
  const b = parca(bas);
  const e = son === undefined ? [] : parca(son);
  // Sonda gömülü IPv4 (::1.2.3.4) iki grup sayılıyor; ağ kısmını
  // etkilemiyor ama sayım tutsun.
  const grup = (x: string[]) =>
    x.flatMap((g) => (g.includes('.') ? ['0', '0'] : [g])).map((g) => g.padStart(4, '0'));
  const bb = grup(b);
  const ee = grup(e);
  const eksik = 8 - bb.length - ee.length;
  if (son === undefined ? eksik !== 0 : eksik < 0) return null;
  return [...bb, ...Array(Math.max(0, eksik)).fill('0000'), ...ee];
}

/**
 * Ağın geri çevrilemez özeti: HMAC-SHA256, 16 onaltılık hane (64 bit).
 *
 * Düz SHA olmaz: IPv4'te yalnız dört milyar adres var ve hepsinin
 * özeti bir öğleden sonrada çıkarılır — tablo ele geçerse özet adresi
 * geri verirdi. Gizli anahtarla bu mümkün değil. 64 bit, diyar başına
 * birkaç bin ağda çakışmayı yok sayılacak kadar küçük tutuyor.
 */
export function agOzeti(ip: string, anahtar: string): string | null {
  const ag = agAnahtari(ip);
  if (!ag) return null;
  return createHmac('sha256', anahtar).update(ag).digest('hex').slice(0, 16);
}
