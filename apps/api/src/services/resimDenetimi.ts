/**
 * Profil resmi: hazırlama ve otomatik denetim.
 *
 * Oyuncunun isteği: "profil resimleri bir denetimden geçmeli, +18 veya
 * benzeri içerikler engellenmeli."
 *
 * İKİ İŞ:
 *
 * 1. HAZIRLAMA (`resmiHazirla`). Oyuncunun gönderdiği dosya OLDUĞU GİBİ
 *    saklanmıyor ve gösterilmiyor. Biçimi içeriğine bakılarak doğrulanıyor
 *    (uzantı ya da istemcinin söylediği tür değil), 256 piksele
 *    kırpılıyor, şeffaflık düzleştiriliyor ve webp olarak YENİDEN
 *    kodlanıyor. Yan etkileri de amaç: EXIF'teki konum, cihaz ve tarih
 *    bilgisi siliniyor; dosyaya gizlenmiş her şey (çok kareli animasyon,
 *    ek veri, şeffaf katmana saklanmış görüntü) atılıyor. Sınıflandırılan
 *    görüntü ile gösterilen görüntü BİREBİR aynı.
 *
 * 2. SINIFLANDIRMA (`resmiSiniflandir`). Açık kaynaklı bir görüntü
 *    sınıflandırıcısı (nsfwjs, MobileNetV2) sunucuda çalışıyor — resim
 *    hiçbir dış hizmete gönderilmiyor. Ayrı bir iş parçacığında
 *    (`resim-iscisi.mjs`): saf JS arka uçta sınıflandırma ~2 saniye ve ana
 *    iş parçacığında o süre bütün oyuncuları dondururdu. Kararın kendisi
 *    shared `resimKarari`'nda.
 *
 * Sınıflandırıcı açılamaz, zaman aşımına uğrar ya da çöker ise `null`
 * dönüyor ve resim yönetici onayına gidiyor: denetlenemeyen resim
 * denetlenmiş sayılmıyor.
 */
import { PROFIL_RESMI, RESIM_BICIMLERI, type ResimTahmini } from '@lordlar/shared';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import sharp from 'sharp';
import { env } from '../env.js';
import { GameError } from '../errors.js';

/** Şeffaf alanın düzleştirildiği renk — oyunun koyu zemini. */
const ZEMIN = '#1a120c';

export interface HazirResim {
  /** Saklanacak ve gösterilecek webp. */
  veri: Buffer;
  /** Sınıflandırıcıya giden 224x224 RGB — `veri`nin kendisinden üretildi. */
  rgb: Buffer;
}

/** Gelen metni (data URL ya da düz base64) resme çevirir ve hazırlar. */
export async function resmiHazirla(gelen: string): Promise<HazirResim> {
  const base64 = gelen.startsWith('data:') ? gelen.slice(gelen.indexOf(',') + 1) : gelen;
  const ham = Buffer.from(base64, 'base64');
  if (ham.length === 0) throw new GameError('Resim boş.', 400, 'RESIM_GECERSIZ');
  if (ham.length > PROFIL_RESMI.enFazlaKb * 1024) {
    throw new GameError(
      `Resim çok büyük (en fazla ${Math.round(PROFIL_RESMI.enFazlaKb / 1024)} MB).`,
      400,
      'RESIM_BUYUK',
    );
  }

  // Piksel sınırı: 1 KB'lık bir dosya 100.000 x 100.000 piksellik bir
  // tuval tanımlayıp açılırken belleği bitirebilir ("sıkıştırma bombası").
  const girdi = { limitInputPixels: 40_000_000, failOn: 'error' as const };
  let bicim: string | undefined;
  try {
    bicim = (await sharp(ham, girdi).metadata()).format;
  } catch {
    throw new GameError('Bu dosya okunabilen bir resim değil.', 400, 'RESIM_GECERSIZ');
  }
  if (!bicim || !(RESIM_BICIMLERI as readonly string[]).includes(bicim)) {
    throw new GameError('Yalnız JPEG, PNG ya da WebP yükleyebilirsin.', 400, 'RESIM_GECERSIZ');
  }

  const boyut = PROFIL_RESMI.boyutPx;
  let veri: Buffer;
  try {
    veri = await sharp(ham, girdi)
      // Telefon fotoğrafı yan yatık kaydediliyor ve yönü EXIF'te; üstveri
      // silinmeden ÖNCE uygulanmazsa resim yan dönerdi.
      .rotate()
      .resize(boyut, boyut, { fit: 'cover', position: 'attention' })
      .flatten({ background: ZEMIN })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new GameError('Resim işlenemedi. Başka bir resim dene.', 400, 'RESIM_GECERSIZ');
  }
  const rgb = await sharp(veri).resize(224, 224).removeAlpha().raw().toBuffer();
  return { veri, rgb };
}

/* ------------------------------------------------------------------ */
/* Sınıflandırıcı iş parçacığı                                         */
/* ------------------------------------------------------------------ */

const ZAMAN_ASIMI_MS = 30_000;
/** Boşta kalan iş parçacığı bu süre sonra kapanıyor — modeli bellekte tutmak ~100 MB. */
const BOSTA_KAPAN_MS = 10 * 60_000;

let isci: Worker | null = null;
let sayac = 0;
let bostaZamanlayici: NodeJS.Timeout | null = null;
const bekleyenler = new Map<number, (t: ResimTahmini | null) => void>();

/**
 * İş parçacığı dosyasını bulur: geliştirmede `src/services/`, üretimde
 * `dist/` altından çalışıyoruz; dosya ikisinde de paket kökünde.
 */
function isciYolu(): string | null {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 4; i++) {
    const aday = join(d, 'resim-iscisi.mjs');
    if (existsSync(aday)) return aday;
    d = dirname(d);
  }
  return null;
}

function isciyiKapat(): void {
  const w = isci;
  isci = null;
  for (const [, coz] of bekleyenler) coz(null);
  bekleyenler.clear();
  void w?.terminate();
}

function isciAl(): Worker | null {
  if (isci) return isci;
  const yol = isciYolu();
  if (!yol) return null;
  const w = new Worker(yol);
  w.on('message', (m: { id: number; tahmin?: ResimTahmini; hata?: string }) => {
    const coz = bekleyenler.get(m.id);
    bekleyenler.delete(m.id);
    coz?.(m.tahmin ?? null);
  });
  // Çöken iş parçacığı bekleyen herkesi incelemeye düşürüyor; bir
  // sonraki yükleme yenisini açıyor.
  w.on('error', () => isciyiKapat());
  w.on('exit', () => {
    if (isci === w) isciyiKapat();
  });
  w.unref();
  isci = w;
  return w;
}

/**
 * 224x224 RGB'yi sınıflandırır. Sınıflandırıcı kapalıysa, açılamıyorsa
 * ya da zaman aşımına uğrarsa null.
 */
export async function resmiSiniflandir(rgb: Buffer): Promise<ResimTahmini | null> {
  if (env.RESIM_SINIFLANDIRICI === 'kapali') return null;
  const w = isciAl();
  if (!w) return null;
  if (bostaZamanlayici) clearTimeout(bostaZamanlayici);
  const id = ++sayac;
  const sonuc = await new Promise<ResimTahmini | null>((coz) => {
    const zaman = setTimeout(() => {
      bekleyenler.delete(id);
      coz(null);
    }, ZAMAN_ASIMI_MS);
    bekleyenler.set(id, (t) => {
      clearTimeout(zaman);
      coz(t);
    });
    w.postMessage({ id, rgb: new Uint8Array(rgb) });
  });
  bostaZamanlayici = setTimeout(() => {
    if (bekleyenler.size === 0) isciyiKapat();
  }, BOSTA_KAPAN_MS);
  bostaZamanlayici.unref();
  return sonuc;
}

/* ------------------------------------------------------------------ */
/* Test kancası — yalnız geliştirmede                                   */
/* ------------------------------------------------------------------ */

/**
 * Uçtan uca testin "uygunsuz resim" yolunu sınayabilmesi için.
 *
 * Depoya uygunsuz bir resim koyamayız; reddin yolunu sınamanın dürüst
 * yolu sınıflandırıcının CEVABINI taklit etmek. Yalnız `/api/test/*`
 * (üretimde yüklenmiyor) yazabiliyor ve üretimde hiç okunmuyor.
 */
const testTahminleri = new Map<string, ResimTahmini>();

export function testTahminiKoy(lordId: string, t: ResimTahmini | null): void {
  if (env.NODE_ENV === 'production') return;
  if (t) testTahminleri.set(lordId, t);
  else testTahminleri.delete(lordId);
}

export function testTahmini(lordId: string): ResimTahmini | undefined {
  if (env.NODE_ENV === 'production') return undefined;
  const t = testTahminleri.get(lordId);
  testTahminleri.delete(lordId);
  return t;
}
