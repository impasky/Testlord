import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * BAĞLANTI HAVUZU varsayılan 10 (docs/05 §8).
 *
 * Prisma'nın varsayılanı `2 × çekirdek + 1`: tek çekirdekli bir
 * sunucuda ÜÇ bağlantı. 500 oyunculu yük testinde dört çekirdeğin dokuz
 * bağlantısı bile tükendi — iş CPU'da değil sorgu beklemesindeydi (JS
 * iş parçacığı zamanın %79'unda boştu) ve sıra bekleyen işlemler 2 sn'yi
 * aşıp "işlem başlatılamadı" diye 500 dönüyordu. API ve ayrı worker
 * birlikte 20 bağlantı tutuyor; Postgres'in varsayılan tavanı 100.
 *
 * `DATABASE_URL` kendi `connection_limit`ini taşıyorsa ona dokunulmuyor:
 * barındırıcının önerdiği değer bilinçli bir seçimdir.
 */
export function havuzluAdres(adres: string, havuz = env.DB_HAVUZU ?? 10): string {
  try {
    const u = new URL(adres);
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', String(havuz));
    }
    return u.toString();
  } catch {
    return adres; // çözülemeyen adres: Prisma kendi hatasını versin
  }
}

/**
 * İŞLEM SÜRESİ 15 sn (Prisma'nın varsayılanı 5 sn). Her `/me` isteği lordun
 * satırını kilitleyip tick'i bir işlemin içinde koşuyor (`tickLord`);
 * makine ağır yük altındayken bu 5 sn'yi aşıp "süresi dolmuş işlem"
 * hatasıyla 500 dönüyordu. Normalde işlem milisaniyeler sürüyor, sınır
 * yalnız tıkanmada devreye giriyor. Kendi süresini veren işlemler
 * (NPC, akın, birleşme) onunla kalıyor.
 *
 * BAŞLAMA BEKLEMESİ 5 sn (varsayılan 2 sn): bir anlık yoğunlukta
 * (yüzlerce savaş aynı saniyede) havuzdan bağlantı beklemek normal;
 * 2 sn'de vazgeçmek oyuncuya sunucu hatası olarak dönüyordu.
 */
export const prisma = new PrismaClient({
  datasourceUrl: havuzluAdres(env.DATABASE_URL),
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  transactionOptions: { timeout: 15_000, maxWait: 5_000 },
});

export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
