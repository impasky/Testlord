/**
 * Arka plan işçisi. Ayrı süreç olarak da (pnpm worker), API sürecinin içinde de
 * (RUN_WORKER=true) çalışabilir. İkincisi tek servisli dağıtımlar içindir:
 * Render'ın ücretsiz katmanında ayrı bir worker süreci yok.
 *
 * Her 10 saniyede bir:
 *   1. Biten yürüyüşleri çözer (savaş, dönüş)
 *   2. Biten kuyrukları çözer (eğitim, üretim, yükseltme)
 *   3. Bölge depolarını biriktirir
 *
 * Her adım tek transaction içinde ve idempotenttir: `resolved` bayrağı
 * koşullu updateMany ile alındığı için worker iki kez çalışsa bile iş
 * iki kez yapılmaz.
 */
import { validateBalance } from '@lordlar/shared';
import { prisma } from './db.js';
import { resolveQueueItem } from './services/queue.js';
import { resolveMarch } from './services/march.js';
import { sevkiyatCoz } from './services/ticaret.js';
import { accrueRegionStores } from './services/region.js';

const ARALIK_MS = 10_000;
let calisiyor = false;

export async function tur(): Promise<void> {
  if (calisiyor) return; // önceki tur bitmediyse üst üste binme
  calisiyor = true;
  const now = new Date();

  try {
    const marches = await prisma.march.findMany({
      where: { resolved: false, arriveAt: { lte: now } },
      orderBy: { arriveAt: 'asc' },
      take: 50,
    });
    for (const m of marches) {
      try {
        await resolveMarch(m.id);
      } catch (e) {
        console.error(`Yürüyüş çözülemedi (${m.id}):`, e);
      }
    }

    const queues = await prisma.queue.findMany({
      where: { resolved: false, finishAt: { lte: now } },
      orderBy: { finishAt: 'asc' },
      take: 200,
    });
    for (const q of queues) {
      try {
        await resolveQueueItem(q);
      } catch (e) {
        console.error(`Kuyruk çözülemedi (${q.id}):`, e);
      }
    }

    // Sevkiyatlar: yürüyüşlerle aynı desen, aynı idempotentlik.
    const sevkiyatlar = await prisma.shipment.findMany({
      where: { resolved: false, arriveAt: { lte: now } },
      orderBy: { arriveAt: 'asc' },
      take: 100,
    });
    for (const sv of sevkiyatlar) {
      try {
        await sevkiyatCoz(sv.id);
      } catch (e) {
        console.error(`Sevkiyat çözülemedi (${sv.id}):`, e);
      }
    }

    await accrueRegionStores(now);

    if (marches.length || queues.length || sevkiyatlar.length) {
      console.log(
        `[worker] ${new Date().toISOString()} — ${marches.length} yürüyüş, ${queues.length} kuyruk, ${sevkiyatlar.length} sevkiyat çözüldü`,
      );
    }
  } catch (e) {
    console.error('[worker] tur hatası:', e);
  } finally {
    calisiyor = false;
  }
}

/**
 * Worker döngüsünü başlatır. Döndürdüğü fonksiyon döngüyü durdurur.
 * Aynı süreçte iki kez çağrılmamalı.
 */
export function startWorker(): () => void {
  console.log(`Lordlar Çağı worker çalışıyor (${ARALIK_MS / 1000} sn aralık)`);
  void tur();
  const zamanlayici = setInterval(() => void tur(), ARALIK_MS);
  return () => clearInterval(zamanlayici);
}

// Ayrı süreç olarak çalıştırıldığında (pnpm worker) kendi kendine başlar.
const ayriSurec =
  process.argv[1]?.endsWith('worker.ts') || process.argv[1]?.endsWith('worker.js');

if (ayriSurec) {
  validateBalance();
  const durdur = startWorker();

  const kapat = async (): Promise<void> => {
    durdur();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void kapat());
  process.on('SIGTERM', () => void kapat());
}
