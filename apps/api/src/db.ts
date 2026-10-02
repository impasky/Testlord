import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * İŞLEM SÜRESİ 15 sn (Prisma'nın varsayılanı 5 sn). Her `/me` isteği lordun
 * satırını kilitleyip tick'i bir işlemin içinde koşuyor (`tickLord`);
 * makine ağır yük altındayken bu 5 sn'yi aşıp "süresi dolmuş işlem"
 * hatasıyla 500 dönüyordu. Normalde işlem milisaniyeler sürüyor, sınır
 * yalnız tıkanmada devreye giriyor. Kendi süresini veren işlemler
 * (NPC, akın, birleşme) onunla kalıyor.
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  transactionOptions: { timeout: 15_000 },
});

export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
