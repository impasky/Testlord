/**
 * Ağ izi — çoklu hesap şüphesi için IP'nin gizli anahtarlı özeti.
 *
 * Neden: besleme hesabı çoğu zaman aynı evden açılıyor ve davranış izleri
 * (sevkiyat, takviye, pazar) tek başına bunu göremiyordu. Neden böyle:
 *
 *   - DÜZ ADRES YOK. Tabloda yalnız HMAC özeti (services/ag.ts). Anahtar
 *     sunucunun imzasından alan ayrımıyla türetiliyor; tablo sızsa bile
 *     anahtar olmadan dört milyar IPv4'ü denemek işe yaramıyor.
 *   - KISA ÖMÜR. `ag_izi_saklama_gun`den eskisi worker'da siliniyor.
 *     İmza değişirse eski özetler yenileriyle buluşmuyor; zararı yok,
 *     onlar da birkaç gün içinde siliniyor.
 *   - TEK OKUYUCU. Yalnız yöneticinin çoklu hesap listesi; orada da ağ
 *     tek başına kimseyi işaretlemiyor (shared `cokluHesap.ts`).
 *
 * Yazım `/me`de: lord günde birkaç kez açıyor ve evden mobile geçince
 * ağı değişiyor. Aynı (lord, ağ, gün) üçlüsü süreç belleğinde bir kez
 * görülünce bir daha veritabanına gitmiyor — en sık çağrılan uçta her
 * seferinde bir INSERT olmasın.
 */
import { createHmac } from 'node:crypto';
import { COKLU_HESAP, gunNumarasi } from '@lordlar/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { agOzeti } from './ag.js';

/** Özet anahtarı: imzanın kendisi değil, ondan bu işe ayrılmış bir türev. */
const ANAHTAR = createHmac('sha256', env.JWT_SECRET).update('lordlar/ag-izi/v1').digest('hex');

/** Süreç belleğinde görülen üçlüler. Sınırsız büyümesin: dolunca sıfırla. */
const GORULEN_TAVAN = 50_000;
const gorulen = new Set<string>();

export async function agIziYaz(lordId: string, ip: string, simdi = new Date()): Promise<void> {
  const ozet = agOzeti(ip, ANAHTAR);
  if (!ozet) return;
  const gun = gunNumarasi(simdi);
  const k = `${lordId}|${ozet}|${gun}`;
  if (gorulen.has(k)) return;
  if (gorulen.size >= GORULEN_TAVAN) gorulen.clear();
  await prisma.agIzi.createMany({ data: [{ lordId, ozet, gun }], skipDuplicates: true });
  // Yazım başarılıysa işaretle: hata olursa sonraki istek yeniden denesin.
  gorulen.add(k);
}

/** Saklama süresini aşan izleri siler; silinen satır sayısını döndürür. */
export async function eskiAgIzleriniSil(simdi = new Date()): Promise<number> {
  const sinir = gunNumarasi(simdi) - COKLU_HESAP.agIziSaklamaGun;
  const { count } = await prisma.agIzi.deleteMany({ where: { gun: { lt: sinir } } });
  return count;
}
