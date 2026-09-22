/**
 * Arka plan işçisi. Ayrı süreç olarak da (pnpm worker), API sürecinin içinde de
 * (RUN_WORKER=true) çalışabilir. İkincisi tek servisli dağıtımlar içindir:
 * Render'ın ücretsiz katmanında ayrı bir worker süreci yok.
 *
 * Her 10 saniyede bir:
 *   1. Biten yürüyüşleri çözer (savaş, dönüş)
 *   2. Biten akınları çözer (NPC savaşı, ganimet, hastane)
 *   3. Biten kuyrukları çözer (eğitim, üretim, yükseltme)
 *   4. Bölge depolarını biriktirir
 *   5. Sırası gelen RAKİP LORDLARA sıra verir (services/npc.ts)
 *   6. Eşya pazarı: kayıt kuyruklarının kurası, saatlik taban (docs/19)
 *
 * Her adım tek transaction içinde ve idempotenttir: `resolved` bayrağı
 * koşullu updateMany ile alındığı için worker iki kez çalışsa bile iş
 * iki kez yapılmaz.
 */
import { validateBalance } from '@lordlar/shared';
import { prisma } from './db.js';
import { resolveQueueItem } from './services/queue.js';
import { resolveMarch } from './services/march.js';
import { resolveAkin } from './services/akin.js';
import { sevkiyatCoz } from './services/ticaret.js';
import { accrueRegionStores } from './services/region.js';
import { npcTuru } from './services/npc.js';
import { bekleyenBirlesmeleriUygula, birlesmeyiPlanla } from './services/birlesme.js';
import { kuyruklariCek, tabanlariGuncelle } from './services/esyaPazari.js';

const ARALIK_MS = 10_000;
let calisiyor = false;

/**
 * Birleşme SAATTE BİR bakılıyor, her turda değil.
 *
 * Gün ölçeğinde bir karar: bir diyarın altmışıncı gününü on saniye
 * içinde yakalamanın kimseye faydası yok, ama her on saniyede bütün
 * diyarları taramanın maliyeti var. Saatlik bakış, en kötü ihtimalle
 * bir saatlik gecikme demek ve ihbar süresi zaten üç gün.
 */
const BIRLESME_ARALIK_MS = 3_600_000;
let sonBirlesmeBakisi = 0;

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

    // Akınlar: yürüyüşlerle aynı desen, ayrı tablo. Tek döngüde
    // birleştirmek, bir tarafın hatasının ötekini de durdurması demekti.
    const akinlar = await prisma.akin.findMany({
      where: { resolved: false, arriveAt: { lte: now } },
      orderBy: { arriveAt: 'asc' },
      take: 50,
    });
    for (const a of akinlar) {
      try {
        await resolveAkin(a.id);
      } catch (e) {
        console.error(`Akın çözülemedi (${a.id}):`, e);
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

    // Eşya pazarı (docs/19). Kendi hatasını kendi yutuyor: pazardaki bir
    // grubun takılması savaşların çözülmesini durdurmasın.
    let kura = 0;
    let taban = 0;
    try {
      kura = await kuyruklariCek(now);
      taban = await tabanlariGuncelle(now);
    } catch (e) {
      console.error('Eşya pazarı turu başarısız:', e);
    }

    if (now.getTime() - sonBirlesmeBakisi >= BIRLESME_ARALIK_MS) {
      sonBirlesmeBakisi = now.getTime();
      try {
        const ilan = await birlesmeyiPlanla(now);
        const uygulanan = await bekleyenBirlesmeleriUygula(now);
        if (ilan.length || uygulanan) {
          console.log(`[worker] birleşme: ${ilan.length} ilan, ${uygulanan} uygulandı`);
        }
      } catch (e) {
        // Birleşme patlarsa oyunun geri kalanı dönmeye devam etsin.
        console.error('Birleşme turu başarısız:', e);
      }
    }

    // Rakip lordlar. Çoğu turda hiç kimsenin sırası gelmiyor ve tek bir
    // indeksli sorguya iniyor; sırası gelen olursa yürüyüşünü oyuncununkiyle
    // AYNI boru hattından başlatıyor ve bir sonraki turda aynı kod çözüyor.
    const npc = await npcTuru(now);

    if (
      marches.length ||
      akinlar.length ||
      queues.length ||
      sevkiyatlar.length ||
      npc.oynayan ||
      kura ||
      taban
    ) {
      const npcOzet = npc.oynayan
        ? `, ${npc.oynayan} NPC oynadı (${npc.isler['sahipsiz-fetih']} fetih, ${npc.isler['oyuncuya-saldiri']} saldırı, ${npc.isler.egitim} eğitim)`
        : '';
      const pazarOzet = kura || taban ? `, pazar: ${kura} kura, ${taban} taban` : '';
      console.log(
        `[worker] ${new Date().toISOString()} — ${marches.length} yürüyüş, ${akinlar.length} akın, ${queues.length} kuyruk, ${sevkiyatlar.length} sevkiyat çözüldü${npcOzet}${pazarOzet}`,
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
const ayriSurec = process.argv[1]?.endsWith('worker.ts') || process.argv[1]?.endsWith('worker.js');

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
