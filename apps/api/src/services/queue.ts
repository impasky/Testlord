/**
 * Kuyruk altyapısı: eğitim, üretim, yükseltme.
 *
 * Maliyet kuyruğa girerken peşin ödenir. Çözüm worker'da yapılır ve
 * idempotenttir: `resolved` bayrağı koşullu updateMany ile yazıldığı için
 * worker iki kez çalışsa da aynı kuyruk iki kez işlenmez.
 */
import {
  BINALAR,
  arastirmaDugumu,
  kafileTedaviSuresiSn,
  UNIT_TYPES,
  craftPrice,
  createRng,
  esZamanliLimit,
  kesifGecerlilikSn,
  rollCraftRarity,
  rollUpgrade,
  upgradeCost,
  yakalanmaIhtimali,
  type Army,
  type EquipSlot,
  type Resources,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { GameError, hata } from '../errors.js';
import { binalariOku, grantXp, okuArastirmalar, pushEvent, tickLord } from './lord.js';
import { bolgeTahkimati } from './region.js';

export type QueueKind =
  | 'train'
  | 'craft'
  | 'upgrade_item'
  | 'upgrade_gear'
  | 'upgrade_region'
  | 'kesif'
  | 'research'
  | 'iyilestir'
  | 'bina';

/**
 * Yaralı kafilesini hastaneye yatırır ve kuyruk kaydının kimliğini döner.
 *
 * Askerlerin kendisi çağıran tarafından `armyUnit` tablosuna
 * `locationType: 'hastane'` ile yazılıyor; burada yalnız sayaç kuruluyor.
 *
 * Eş zamanlılık sınırı YOK: tedavi bir tercih değil, savaşın sonucu.
 * Sınır koymak, ikinci kez yenilen oyuncunun yaralılarını sessizce yok
 * etmek demekti.
 */
export async function hastaneyeYatir(lordId: string, yarali: Army, tx: Tx): Promise<string> {
  // Hastane binası tedavinin TAVANINI indiriyor (docs/12 §4). Süre yatış
  // anında donduruluyor: sonradan hastane yükseltmek yatanın süresini
  // kısaltmıyor, çünkü kuyruk kaydı bitiş zamanını tutuyor.
  const lord = await tx.lord.findUnique({ where: { id: lordId }, select: { binalar: true } });
  const sn = kafileTedaviSuresiSn(yarali, binalariOku(lord ?? {}));
  const kayit = await enqueue(lordId, 'iyilestir', {}, Math.max(1, sn), tx);
  return kayit.id;
}

/** Tick uygular, kaynağın yeter mi diye bakar, yetiyorsa düşer. */
export async function spendResources(lordId: string, cost: Resources, tx: Tx): Promise<void> {
  const state = await tickLord(lordId, new Date(), tx);
  const r = state.resources;
  if (r.altin < cost.altin || r.demir < cost.demir || r.erzak < cost.erzak) {
    const eksik: string[] = [];
    if (r.altin < cost.altin) eksik.push(`${Math.ceil(cost.altin - r.altin)} altın`);
    if (r.demir < cost.demir) eksik.push(`${Math.ceil(cost.demir - r.demir)} demir`);
    if (r.erzak < cost.erzak) eksik.push(`${Math.ceil(cost.erzak - r.erzak)} erzak`);
    throw new GameError(
      `Yeterli kaynağın yok. Eksik: ${eksik.join(', ')}.`,
      400,
      'YETERSIZ_KAYNAK',
    );
  }
  await tx.lord.update({
    where: { id: lordId },
    data: {
      altin: { decrement: Math.round(cost.altin) },
      demir: { decrement: Math.round(cost.demir) },
      erzak: { decrement: Math.round(cost.erzak) },
    },
  });
}

/** Evdeki orduya birim ekler (veya çıkarır). */
export async function addUnitsHome(
  lordId: string,
  unitType: UnitType,
  delta: number,
  tx: Tx,
): Promise<void> {
  const existing = await tx.armyUnit.findFirst({
    where: { lordId, unitType, locationType: 'home', locationId: null },
  });
  if (existing) {
    const next = existing.count + delta;
    if (next <= 0) await tx.armyUnit.delete({ where: { id: existing.id } });
    else await tx.armyUnit.update({ where: { id: existing.id }, data: { count: next } });
  } else if (delta > 0) {
    await tx.armyUnit.create({
      data: { lordId, unitType, count: delta, locationType: 'home', locationId: null },
    });
  }
}

/**
 * Bir bölgedeki garnizona birim ekler.
 *
 * addUnitsHome ile aynı desen, farklı konum. Takviye için gerekli: asker
 * bölgeye yerleşiyor ama GÖNDERENİN kalıyor, yani satır gönderenin adına
 * ve konumu bölge oluyor. Aynı lordun aynı bölgede aynı tipten ikinci
 * satırı olmamalı — benzersiz kısıt zaten bunu zorunlu kılıyor, burada
 * da varsa üstüne ekliyoruz.
 */
export async function addUnitsRegion(
  lordId: string,
  regionId: number,
  unitType: UnitType,
  delta: number,
  tx: Tx,
): Promise<void> {
  const existing = await tx.armyUnit.findFirst({
    where: { lordId, unitType, locationType: 'region', locationId: String(regionId) },
  });
  if (existing) {
    const next = existing.count + delta;
    if (next <= 0) await tx.armyUnit.delete({ where: { id: existing.id } });
    else await tx.armyUnit.update({ where: { id: existing.id }, data: { count: next } });
  } else if (delta > 0) {
    await tx.armyUnit.create({
      data: {
        lordId,
        unitType,
        count: delta,
        locationType: 'region',
        locationId: String(regionId),
      },
    });
  }
}

export async function enqueue(
  lordId: string,
  kind: QueueKind,
  payload: Record<string, unknown>,
  durationSec: number,
  tx: Tx,
): Promise<{ id: string; finishAt: Date }> {
  const now = new Date();
  const finishAt = new Date(now.getTime() + Math.max(1, Math.round(durationSec)) * 1000);
  const row = await tx.queue.create({
    data: { lordId, kind, payload: payload as object, startedAt: now, finishAt },
  });
  return { id: row.id, finishAt };
}

/**
 * Aynı türden aynı anda kaç kuyruk olabilir.
 *
 * Sayı `esZamanliLimit` içinde; arayüz de aynı fonksiyonu çağırıp dolu
 * kuyrukta düğmeyi kapatıyor. Burada ayrı bir sabit tutmak, ikisinin
 * sapması demekti. Y4'ten beri kışla eğitim, kütüphane araştırma
 * kuyruğunu büyütüyor — bu yüzden lordun bina seviyeleri okunuyor.
 */
export async function assertQueueSlot(lordId: string, kind: QueueKind, tx: Tx): Promise<void> {
  const [aktif, lord] = await Promise.all([
    tx.queue.count({ where: { lordId, kind, resolved: false } }),
    tx.lord.findUnique({ where: { id: lordId }, select: { binalar: true } }),
  ]);
  const limit = esZamanliLimit(kind, binalariOku(lord ?? {}));
  if (aktif >= limit) {
    throw hata.limitAsildi(`Aynı anda en fazla ${limit} ${kind} kuyruğu`);
  }
}

interface QueueRow {
  id: string;
  lordId: string;
  kind: string;
  payload: unknown;
  finishAt: Date;
}

/**
 * Bir kuyruğu çözer. Koşullu updateMany sayesinde idempotenttir:
 * satırı ilk alan işler, ikinci çağrı hiçbir şey yapmaz.
 */
export async function resolveQueueItem(row: QueueRow): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.queue.updateMany({
      where: { id: row.id, resolved: false },
      data: { resolved: true },
    });
    if (claimed.count === 0) return false; // başka bir worker aldı

    const p = (row.payload ?? {}) as Record<string, unknown>;

    switch (row.kind) {
      case 'train': {
        const unitType = String(p.unitType) as UnitType;
        const count = Number(p.count);
        if (!UNIT_TYPES.includes(unitType) || !Number.isFinite(count) || count <= 0) break;
        await addUnitsHome(row.lordId, unitType, count, tx);
        await pushEvent(
          row.lordId,
          'kuyruk_bitti',
          { mesaj: `${count} ${unitType} eğitimi tamamlandı.` },
          tx,
        );
        break;
      }

      case 'craft': {
        const tier = Number(p.tier);
        const slot = String(p.slot) as EquipSlot;
        const rng = createRng(`craft-${row.id}`);
        const rarity = rollCraftRarity(tier, rng);
        await tx.item.create({
          data: { lordId: row.lordId, slot, tier, rarity, upgradeLevel: 0, equipped: false },
        });
        await pushEvent(
          row.lordId,
          'kuyruk_bitti',
          { mesaj: `T${tier} ${slot} üretildi: ${rarity}.` },
          tx,
        );
        break;
      }

      case 'upgrade_item': {
        const itemId = String(p.itemId);
        const item = await tx.item.findUnique({ where: { id: itemId } });
        if (!item || item.lordId !== row.lordId) break;
        const rng = createRng(`upgrade-${row.id}`);
        const { success, chance } = rollUpgrade(item.upgradeLevel, rng);
        if (success) {
          await tx.item.update({
            where: { id: itemId },
            data: { upgradeLevel: item.upgradeLevel + 1 },
          });
        }
        await pushEvent(
          row.lordId,
          'kuyruk_bitti',
          {
            mesaj: success
              ? `Yükseltme başarılı: +${item.upgradeLevel + 1}`
              : `Yükseltme başarısız (şans %${Math.round(chance * 100)}). Malzeme kayboldu, eşya sağlam.`,
          },
          tx,
        );
        break;
      }

      case 'upgrade_gear': {
        const line = String(p.line);
        const gl = await tx.gearLine.findUnique({
          where: { lordId_line: { lordId: row.lordId, line } },
        });
        if (!gl) break;
        await tx.gearLine.update({
          where: { lordId_line: { lordId: row.lordId, line } },
          data: { level: gl.level + 1 },
        });
        await pushEvent(
          row.lordId,
          'kuyruk_bitti',
          { mesaj: `Ordu donanımı yükseldi: ${line} seviye ${gl.level + 1}.` },
          tx,
        );
        break;
      }

      case 'upgrade_region': {
        const regionId = Number(p.regionId);
        const region = await tx.region.findUnique({ where: { id: regionId } });
        if (!region || region.ownerLordId !== row.lordId) break;
        await tx.region.update({ where: { id: regionId }, data: { level: region.level + 1 } });
        await grantXp(row.lordId, 500 * (region.level + 1), tx);
        await pushEvent(
          row.lordId,
          'kuyruk_bitti',
          { mesaj: `${region.name} seviye ${region.level + 1} oldu.` },
          tx,
        );
        break;
      }

      case 'kesif': {
        await kesfiCoz(row, p, tx);
        break;
      }

      case 'bina': {
        /*
         * Binalar LORDA bağlı, bölgeye değil: başkent taşınınca binalar
         * da taşınıyor (docs/12 §2.2). O yüzden burada yapılacak tek iş
         * lordun bina tablosundaki sayacı bir artırmak.
         *
         * Hedef seviye payload'da DEĞİL, mevcut seviyeden türetiliyor.
         * Payload'a yazsaydım iki kuyruk üst üste binebilir ve ikisi de
         * "3. seviyeye çıkar" diyerek bir seviyeyi kaybettirebilirdi;
         * artırma her zaman o anki değerin üstüne biniyor.
         */
        const key = String(p.key ?? '');
        const lord = await tx.lord.findUnique({
          where: { id: row.lordId },
          select: { binalar: true },
        });
        if (!lord || !key) break;
        const mevcut = (lord.binalar ?? {}) as Record<string, number>;
        const yeni = (mevcut[key] ?? 0) + 1;
        await tx.lord.update({
          where: { id: row.lordId },
          data: { binalar: { ...mevcut, [key]: yeni } },
        });
        const bina = BINALAR.find((b) => b.key === key);
        await pushEvent(
          row.lordId,
          'kuyruk_bitti',
          {
            mesaj:
              yeni === 1
                ? `${bina?.ad ?? key} dikildi.`
                : `${bina?.ad ?? key} seviye ${yeni} oldu.`,
          },
          tx,
        );
        break;
      }

      case 'iyilestir': {
        // Tedavi bitti: hastanedeki askerler eve katılıyor.
        //
        // Askerler kuyruk satırının PAYLOAD'ında değil, `armyUnit`
        // tablosunda `locationType: 'hastane'` olarak duruyor. Sebep:
        // ordu tek bir yerden sayılabilsin — payload'a yazsaydım
        // "kaç askerim var" sorusunun iki ayrı cevabı olurdu.
        const yaralilar = await tx.armyUnit.findMany({
          where: { lordId: row.lordId, locationType: 'hastane', locationId: row.id },
        });
        let toplam = 0;
        for (const y of yaralilar) {
          if (y.count > 0) {
            await addUnitsHome(row.lordId, y.unitType as UnitType, y.count, tx);
            toplam += y.count;
          }
        }
        await tx.armyUnit.deleteMany({
          where: { lordId: row.lordId, locationType: 'hastane', locationId: row.id },
        });
        if (toplam > 0) {
          await pushEvent(
            row.lordId,
            'kuyruk_bitti',
            { mesaj: `${toplam} yaralı asker iyileşti, orduna katıldı.` },
            tx,
          );
        }
        break;
      }

      case 'research': {
        const key = String(p.key ?? '');
        const dugum = arastirmaDugumu(key);
        if (!dugum) break; // veri dosyasından kaldırılmış düğüm
        const lord = await tx.lord.findUnique({
          where: { id: row.lordId },
          select: { arastirmalar: true },
        });
        const mevcut = okuArastirmalar(lord?.arastirmalar);
        // Aynı araştırma iki kez yazılmasın: bonus toplamalı, ikinci
        // kayıt etkiyi sessizce ikiye katlardı.
        if (!mevcut.includes(key)) {
          await tx.lord.update({
            where: { id: row.lordId },
            data: { arastirmalar: [...mevcut, key] },
          });
        }
        await pushEvent(
          row.lordId,
          'kuyruk_bitti',
          { mesaj: `${dugum.ad} araştırması tamamlandı.` },
          tx,
        );
        break;
      }
    }
    return true;
  });
}

/**
 * Keşif varışı: ya rapor gelir ya casus yakalanır.
 *
 * Zar kuyruk satırının kimliğinden tohumlanıyor. Aynı satır iki kez
 * çözülse bile (worker yarışı) sonuç aynı olurdu — ama `resolved` zaten
 * ikinciyi engelliyor; tohum burada tekrarlanabilirlik için: bir oyuncu
 * "casusum niye yakalandı" diye sorduğunda cevap kayıttan üretilebiliyor.
 *
 * Yakalanınca SAVUNAN haber alıyor, üstelik saldırganın adıyla. Casusluk
 * tek yönlü bedava bilgi olsaydı herkes her seferinde casus gönderirdi;
 * risk hem kararı anlamlı kılıyor hem savunana bir uyarı ve bir husumet
 * veriyor.
 */
async function kesfiCoz(row: QueueRow, p: Record<string, unknown>, tx: Tx): Promise<void> {
  const regionId = Number(p.regionId);
  const region = await tx.region.findUnique({ where: { id: regionId } });
  if (!region) return;

  const casus = await tx.lord.findUnique({
    where: { id: row.lordId },
    select: { kurnazlik: true, name: true },
  });
  if (!casus) return;

  const rng = createRng(`kesif-${row.id}`);
  const yakalandi = rng.next() < yakalanmaIhtimali(casus.kurnazlik);

  if (yakalandi) {
    await pushEvent(
      row.lordId,
      'casus_yakalandi',
      { mesaj: `${region.name} bölgesine gönderdiğin casus yakalandı. Rapor gelmedi.`, regionId },
      tx,
    );
    // Savunan yalnızca OYUNCUYSA haber alır: NPC garnizonunun kimseye
    // anlatacağı bir şey yok.
    if (region.ownerLordId && region.ownerLordId !== row.lordId) {
      await pushEvent(
        region.ownerLordId,
        'casus_yakaladin',
        {
          mesaj: `${region.name} bölgende ${casus.name} adına çalışan bir casus yakalandı.`,
          regionId,
        },
        tx,
      );
    }
    return;
  }

  // Garnizon: oyuncu bölgesiyse yerleştirilmiş birimler, değilse NPC garnizonu.
  let garrison: Army = {};
  if (region.ownerLordId) {
    const rows = await tx.armyUnit.findMany({
      where: {
        lordId: region.ownerLordId,
        locationType: 'region',
        locationId: String(regionId),
      },
    });
    for (const r of rows) garrison[r.unitType as UnitType] = r.count;
  } else {
    garrison = (region.npcGarrison ?? {}) as Army;
  }

  const sahip = region.ownerLordId
    ? await tx.lord.findUnique({
        where: { id: region.ownerLordId },
        // binalar + baskentBolgeId: keşif raporu SURLARI da göstermeli.
        // Göstermeseydi oyuncu casusun verdiği tahkimatla hesap yapar,
        // savaşta başka bir sayıyla karşılaşırdı.
        select: { name: true, binalar: true, baskentBolgeId: true },
      })
    : null;

  const simdi = new Date();
  const snapshot = {
    garrison,
    store: { altin: region.storeAltin, demir: region.storeDemir, erzak: region.storeErzak },
    tahkimatBonusu: bolgeTahkimati(region, sahip),
    bolgeSeviyesi: region.level,
    sahipAdi: sahip?.name ?? null,
  };

  // Yeni rapor eskisini eziyor: aynı bölgenin iki fotoğrafını saklamanın
  // oyun içinde bir karşılığı yok.
  await tx.scout.upsert({
    where: { lordId_regionId: { lordId: row.lordId, regionId } },
    create: {
      lordId: row.lordId,
      regionId,
      createdAt: simdi,
      expiresAt: new Date(simdi.getTime() + kesifGecerlilikSn() * 1000),
      snapshot,
    },
    update: {
      createdAt: simdi,
      expiresAt: new Date(simdi.getTime() + kesifGecerlilikSn() * 1000),
      snapshot,
    },
  });

  await pushEvent(
    row.lordId,
    'kesif_raporu',
    { mesaj: `${region.name} keşfedildi. Garnizonu ve deposu artık görünüyor.`, regionId },
    tx,
  );
}

export { craftPrice, upgradeCost };

/**
 * Bu lordun VADESİ GELMİŞ işlerini şimdi çöz.
 *
 * Neden okuma yolunda: worker her 10 saniyede bir dönüyor ama tek servisli
 * dağıtımda (Render ücretsiz katmanı) API uykuya dalınca worker da
 * uyuyor. Gerçek bir oyuncu ekran görüntüsünde şu hâli yakaladı:
 *
 *   "EĞİTİMDE 26 — bitti"   ama   "Evde 0", "0/90 komuta"
 *
 * Eğitim bitmişti, askerler orduya hiç katılmamıştı. Omurga da haklı
 * olarak "hâlâ ordun yok, asker eğit" diyordu — oysa altın o eğitime
 * gitmişti. Oyuncu ne basacak bir düğme ne de bir açıklama bulabildiği
 * bir ekranda kaldı ve "öğretici bu şekilde ekranda kalıyor" dedi.
 *
 * Artık her /me okuması, o lordun gecikmiş işlerini kapatıyor. Oyun
 * worker'ın ayakta olmasına bağlı olmaktan çıkıyor: oyuncu ekranı açtığı
 * an sonuçlar hazır.
 *
 * İş idempotent (`resolved` koşullu updateMany) ve LORDA ÖZEL, sayısı da
 * sınırlı — okuma yolunu ağırlaştırmıyor. Worker yine duruyor: çevrimdışı
 * oyuncunun bölgesine gelen saldırı onu bekleyemez.
 */
export async function gecikmisIsleriCoz(lordId: string, now = new Date()): Promise<number> {
  const AZAMI = 20;
  const bekleyen = await prisma.queue.findMany({
    where: { lordId, resolved: false, finishAt: { lte: now } },
    orderBy: { finishAt: 'asc' },
    take: AZAMI,
  });

  let sayi = 0;
  for (const row of bekleyen) {
    try {
      if (await resolveQueueItem(row)) sayi++;
    } catch (e) {
      // Tek bir kuyruk çözülemezse /me çökmemeli: oyuncu ekranını
      // görebilsin, worker bir sonraki turda yeniden dener.
      console.error(`Kuyruk çözülemedi (${row.id}):`, e);
    }
  }
  return sayi;
}
