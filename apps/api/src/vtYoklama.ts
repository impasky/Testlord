/**
 * VERİTABANI YOKLAMASI — "neden ulaşılamıyor" sorusunun cevabı.
 *
 * Prisma'nın P1001'i ("Can't reach database server") dört ayrı durumu tek
 * cümleye indiriyor ve açılışta her denemede aynı uzun hatayı basıyordu:
 * günlük yüzlerce satır tekrar, sebep hiçbirinde yok. Burada adım adım
 * bakılıyor: adres çözülüyor mu (DNS), bağlantı açılıyor mu (TCP). İkisi
 * de geçerse sorun ağda değil, kimlik bilgisinde ya da SSL'de.
 *
 * Saf değil ama yan etkisiz: yalnız okuyor. Günlüğe sunucu adı ve kapı
 * çıkıyor; kullanıcı adı ve parola ASLA.
 */
import { lookup } from 'node:dns/promises';
import { Socket } from 'node:net';

export interface VtYoklama {
  host: string;
  port: number;
  dns: 'tamam' | 'cozulemedi';
  tcp: 'acik' | 'reddedildi' | 'zaman_asimi' | 'hata' | 'denenmedi';
  /** Sistemin hata kodu (ENOTFOUND, ECONNREFUSED…), varsa. */
  kod?: string;
}

/** Adres çözülemiyorsa `null`: Prisma kendi hatasını versin. */
export function vtHedefi(adres: string): { host: string; port: number } | null {
  try {
    const u = new URL(adres);
    if (!u.hostname) return null;
    return { host: u.hostname, port: Number(u.port || 5432) };
  } catch {
    return null;
  }
}

export async function veritabaniniYokla(
  adres: string,
  zamanAsimiMs = 3000,
): Promise<VtYoklama | null> {
  const hedef = vtHedefi(adres);
  if (!hedef) return null;
  const { host, port } = hedef;
  try {
    await lookup(host);
  } catch (e) {
    return {
      host,
      port,
      dns: 'cozulemedi',
      tcp: 'denenmedi',
      kod: (e as NodeJS.ErrnoException).code,
    };
  }
  return new Promise<VtYoklama>((coz) => {
    const s = new Socket();
    const bitir = (tcp: VtYoklama['tcp'], kod?: string) => {
      s.destroy();
      coz({ host, port, dns: 'tamam', tcp, ...(kod ? { kod } : {}) });
    };
    s.setTimeout(zamanAsimiMs);
    s.once('connect', () => bitir('acik'));
    s.once('timeout', () => bitir('zaman_asimi'));
    s.once('error', (e: NodeJS.ErrnoException) =>
      bitir(e.code === 'ECONNREFUSED' ? 'reddedildi' : 'hata', e.code),
    );
    s.connect(port, host);
  });
}

/** Render'ın iç veritabanı adı: `dpg-<kimlik>-a`, alan adı yok. */
const RENDER_IC = /^dpg-[a-z0-9]+-a$/;

/** Tek satır: bekleme sırasında durum değiştikçe yazılıyor. */
export function yoklamaOzeti(y: VtYoklama): string {
  const yer = `${y.host}:${y.port}`;
  if (y.dns === 'cozulemedi') return `${yer} adı çözülmüyor (${y.kod ?? 'DNS'})`;
  if (y.tcp === 'reddedildi') return `${yer} bağlantıyı reddediyor`;
  if (y.tcp === 'zaman_asimi') return `${yer} cevap vermiyor (zaman aşımı)`;
  if (y.tcp === 'hata') return `${yer} bağlantı hatası (${y.kod ?? '?'})`;
  return `${yer} açık`;
}

/** Vazgeçerken: sebep ve ne yapılacağı. */
export function yoklamaAciklamasi(y: VtYoklama | null, saniye: number): string {
  const bas = `Veritabanına ${saniye} saniyedir ulaşılamıyor.`;
  if (!y) return `${bas} DATABASE_URL okunamıyor: boş ya da biçimi bozuk.`;
  const ozet = yoklamaOzeti(y);
  if (y.dns === 'cozulemedi' && RENDER_IC.test(y.host)) {
    return [
      `${bas} ${ozet}.`,
      "Bu Render'ın İÇ adresi; yalnız AYNI bölgedeki ve AYNI çalışma alanındaki",
      'servislerden çözülür. Render panelinde veritabanı sayfasına bak:',
      '  - Durumu "Available" değilse (Suspended / Expired: ücretsiz veritabanı',
      '    30 gün sonra kapanır) veritabanı yok demektir; yenisini aç.',
      '  - Bölgesi servisle aynı değilse (ikisi de Frankfurt olmalı) iç adres hiç',
      '    çözülmez. Bölge sonradan değişmez: veritabanını aynı bölgede yeniden aç',
      '    (içinde oyuncu varsa önce yedek al, docs/05 §4).',
    ].join('\n');
  }
  if (y.dns === 'cozulemedi') {
    return `${bas} ${ozet}: DATABASE_URL'deki sunucu adı yanlış ya da veritabanı silinmiş.`;
  }
  if (y.tcp === 'reddedildi') {
    return `${bas} ${ozet}: veritabanı açılıyor, durdurulmuş ya da kapı yanlış.`;
  }
  if (y.tcp === 'zaman_asimi' || y.tcp === 'hata') {
    return [
      `${bas} ${ozet}.`,
      'Ağ yolu kapalı: DigitalOcean\'da uygulama veritabanının "güvenilir',
      'kaynakları"nda değil ya da veritabanı başka bölgede (ikisi de FRA olmalı).',
    ].join('\n');
  }
  return `${bas} ${ozet}, yani ağ yolu sağlam: sorun kullanıcı adı, parola, veritabanı adı ya da SSL. DATABASE_URL'i panelden yeniden kopyala.`;
}
