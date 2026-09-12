/**
 * Dünya (shard) yönetimi.
 *
 * Her dünya kendi 61 bölgesine sahiptir ve diğerlerinden tamamen bağımsızdır.
 * Kapasite dolduğunda yenisi AÇILIR — oyuncu asla "yer yok" duvarına çarpmaz.
 * (docs/00: "Shard başına 120 oyuncu. Dolunca yeni shard açılır.")
 */
import { B, HARITA_SURUMU, WORLD_MAP } from '@lordlar/shared';
import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { grafigiUnut } from './mesafe.js';

const ROMEN = [
  'Birinci',
  'İkinci',
  'Üçüncü',
  'Dördüncü',
  'Beşinci',
  'Altıncı',
  'Yedinci',
  'Sekizinci',
  'Dokuzuncu',
  'Onuncu',
];

function dunyaAdi(sira: number): string {
  return `${ROMEN[sira] ?? `${sira + 1}.`} Diyar`;
}

/** Yeni bir dünya açar ve kanonik haritanın bölgelerini yazar. */
export async function createWorld(client: Tx = prisma): Promise<string> {
  const mevcut = await client.world.count();
  const world = await client.world.create({
    data: {
      name: dunyaAdi(mevcut),
      playerCap: B.dunya.oyuncu_kapasitesi,
      // Dünya, açıldığı haritayı üstünde taşıyor. Kanonik harita sonra
      // değişirse bu dünya kendi sürümünde kalıyor (bkz. tazelemeKarari).
      mapVersion: HARITA_SURUMU,
    },
  });

  await client.region.createMany({
    data: WORLD_MAP.regions.map((r) => ({
      mapId: r.id,
      worldId: world.id,
      name: r.name,
      type: r.type,
      province: r.province,
      x: r.x,
      y: r.y,
      komsular: r.komsular,
      level: r.level,
      incomeMult: r.income_mult,
      npcGarrison: r.npc_garrison,
      npcTaban: r.npc_garrison,
    })),
  });

  return world.id;
}

/**
 * Kayıt için bir dünya bulur. Açık dünya doluysa 'full' işaretler ve yenisini açar.
 * Bu yüzden hiçbir zaman "dünya yok" hatası dönmez.
 */
export async function findOrOpenWorld(): Promise<string> {
  const acik = await prisma.world.findMany({
    where: { status: 'open' },
    orderBy: { openedAt: 'asc' },
  });

  for (const w of acik) {
    const sayi = await prisma.lord.count({ where: { worldId: w.id } });
    if (sayi < w.playerCap) return w.id;
    await prisma.world.update({ where: { id: w.id }, data: { status: 'full' } });
  }

  return createWorld();
}

/**
 * Bu dünyaya kanonik harita uygulanabilir mi — ve neden.
 *
 * KURAL: bir dünyanın haritası, üzerinde OYUNCU varken değişmez.
 *
 * Eskiden `seed.ts` açılışta bütün dünyaları kanonik haritaya eşitliyordu.
 * Geliştirmede doğru davranış, yayında felaket: oyuncunun aylardır tuttuğu
 * "Gölcük Köyü" bir gecede başka bir yer olabilir, komşuları değişir,
 * yürüyüş süreleri kayar (docs/12 §14).
 *
 * Üç hâl var:
 *   'ilk-damga'  Sürümlemeden önce açılmış dünya. O günkü davranış zaten
 *                hepsini kanonik haritaya eşitliyordu, yani bu dünyalar
 *                bugünkü haritada. Damgalanır, tazelenir.
 *   'tazele'     Dünya zaten bu sürümde. Statik alanlar tazelenebilir;
 *                zaten aynı haritadan geldikleri için fark çıkmaz, ama
 *                eksik bölge varsa tamamlanır.
 *   'bos-dunya'  Sürüm farklı ama dünyada hiç lord yok. Kimsenin toprağı
 *                yok demektir; yeni haritaya taşınır ve damgası yenilenir.
 *   'dokunma'    Sürüm farklı VE oyuncu var. Harita olduğu gibi kalır;
 *                dünya yeni kayıtlara da kapatılır ki yeni oyuncular
 *                eski haritaya düşmesin.
 */
export type TazelemeKarari = 'ilk-damga' | 'tazele' | 'bos-dunya' | 'dokunma';

export async function tazelemeKarari(worldId: string): Promise<TazelemeKarari> {
  const w = await prisma.world.findUniqueOrThrow({
    where: { id: worldId },
    select: { mapVersion: true },
  });
  if (w.mapVersion === null) return 'ilk-damga';
  if (w.mapVersion === HARITA_SURUMU) return 'tazele';
  const lordSayisi = await prisma.lord.count({ where: { worldId } });
  return lordSayisi === 0 ? 'bos-dunya' : 'dokunma';
}

/**
 * Bölgelerin statik alanlarını kanonik haritadan tazeler (oyun durumuna
 * dokunmaz) ve dünyayı bu harita sürümüyle damgalar.
 *
 * Bölgeler TEK sorguda okunuyor. Eskiden bölge başına ayrı bir
 * `findUnique` vardı: 61 bölgede fark edilmiyordu, 121 bölge ve yüzlerce
 * dünya olunca seed dakikalarca sürüyordu.
 */
export async function refreshWorldRegions(worldId: string): Promise<number> {
  const mevcutlar = await prisma.region.findMany({ where: { worldId } });
  const mapIdIle = new Map(mevcutlar.map((r) => [r.mapId, r]));

  const eklenecek: Prisma.RegionCreateManyInput[] = [];
  let tazelenen = 0;

  for (const r of WORLD_MAP.regions) {
    const statik = {
      name: r.name,
      type: r.type,
      province: r.province,
      x: r.x,
      y: r.y,
      incomeMult: r.income_mult,
    };
    const mevcut = mapIdIle.get(r.id);
    if (!mevcut) {
      eklenecek.push({
        mapId: r.id,
        worldId,
        level: r.level,
        npcGarrison: r.npc_garrison,
        npcTaban: r.npc_garrison,
        komsular: r.komsular,
        ...statik,
      });
      tazelenen++;
      continue;
    }

    const degisti = (Object.keys(statik) as (keyof typeof statik)[]).some(
      (k) => mevcut[k] !== statik[k],
    );
    /*
     * TÜR DEĞİŞTİYSE garnizon da kanonik hâline döner.
     *
     * Normalde garnizona dokunmuyoruz: yıpranmış bir NPC garnizonu oyunun
     * ÜRETTİĞİ durum ve tazeleme onu silmemeli. Ama bir tarla köye
     * dönüştüyse orası artık başka bir yer; eski tarlanın 37 savunucusuyla
     * duran bir "köy", ilk fethi imkânsız kılardı.
     */
    const turDegisti = mevcut.type !== statik.type;
    // Komşuluk bir DİZİ: düz eşitlik her seferinde "değişti" derdi.
    // Sıra kanonik dosyada sabit olduğu için metne çevirip karşılaştırmak
    // yeterli ve ucuz.
    const komsuDegisti = JSON.stringify(mevcut.komsular) !== JSON.stringify(r.komsular);
    // Sürümlemeden önce yazılmış satırların tabanı boş; bu tazeleme onu
    // dolduruyor. Taban bölgenin KENDİ satırında durmalı (docs/12 §14).
    const tabanBos = mevcut.npcTaban === null;

    if (degisti || komsuDegisti || turDegisti || tabanBos) {
      await prisma.region.update({
        where: { id: mevcut.id },
        data: {
          ...statik,
          komsular: r.komsular,
          // Dünya bu haritaya eşitleniyor: tabanı da bu haritanın tabanı.
          // MEVCUT garnizona dokunulmuyor — yıpranmışlık oyunun ürettiği
          // durum ve tazeleme onu silmemeli.
          npcTaban: r.npc_garrison,
          ...(turDegisti ? { npcGarrison: r.npc_garrison, level: r.level } : {}),
        },
      });
      tazelenen++;
    }
  }

  if (eklenecek.length > 0) await prisma.region.createMany({ data: eklenecek });

  // Tazeleme bittiğinde dünya artık bu haritada; damgası da öyle desin.
  await prisma.world.update({ where: { id: worldId }, data: { mapVersion: HARITA_SURUMU } });
  // Komşuluk değişmiş olabilir: bellekteki grafik bayatladı.
  grafigiUnut(worldId);
  return tazelenen;
}

/**
 * Eski haritada kalan dünyayı yeni KAYITLARA kapatır.
 *
 * Oyuncuları oynamaya devam eder — lordun `worldId`si duruyor. Kapanan
 * tek şey kapı: `findOrOpenWorld` yalnız 'open' dünyalara bakıyor, yani
 * yeni oyuncular bugünkü haritanın olduğu dünyalara düşüyor. Yoksa aynı
 * anda iki farklı diyar "birinci diyar" olurdu.
 */
export async function eskiHaritaliDunyayiKapat(worldId: string): Promise<void> {
  await prisma.world.updateMany({
    where: { id: worldId, status: 'open' },
    data: { status: 'closed' },
  });
}
