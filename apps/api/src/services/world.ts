/**
 * Dünya (shard) yönetimi.
 *
 * Her dünya kendi bölgelerine (kanonik haritanın tamamına) sahiptir ve diğerlerinden tamamen bağımsızdır.
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

/**
 * BOŞ sıra numarası — kullanılmayan en küçüğü.
 *
 * Eskiden sıra `world.count()` idi ve bu, sayının tekrar etmesi demekti:
 * bir diyar silinince sayım geriliyor ve bir sonraki diyar var olan bir
 * adı alıyordu. Geliştirme veritabanında 23 tane "168. Diyar" böyle
 * birikti. Kimse fark etmemişti çünkü adlar hiçbir yerde yan yana
 * gelmiyordu — ta ki kayıt ekranına diyar seçimi gelene kadar. Orada ad
 * diyarın KİMLİĞİ ve iki satırın aynı adı taşıması özelliği bozar.
 */
async function bosSira(client: Tx): Promise<number> {
  const adlar = new Set(
    (await client.world.findMany({ select: { name: true } })).map((w) => w.name),
  );
  for (let i = 0; ; i++) if (!adlar.has(dunyaAdi(i))) return i;
}

/**
 * Yeni bir dünya açar ve kanonik haritanın bölgelerini yazar.
 *
 * Ad benzersiz (bkz. şema). İki kayıt aynı anda gelirse ikisi de aynı boş
 * sırayı bulabiliyor ve biri kısıta çarpıyor — o yarışı kod değil ancak
 * veritabanı kapatabilir. Çarpan taraf sırayı yeniden okuyup tekrar
 * deniyor: bu arada öteki diyar yazılmış oluyor, yani ikinci deneme bir
 * sonraki boş sırayı buluyor.
 */
export async function createWorld(client: Tx = prisma): Promise<string> {
  let world: { id: string } | null = null;
  for (let deneme = 0; deneme < 4 && !world; deneme++) {
    try {
      world = await client.world.create({
        data: {
          name: dunyaAdi(await bosSira(client)),
          playerCap: B.dunya.oyuncu_kapasitesi,
          // Dünya, açıldığı haritayı üstünde taşıyor. Kanonik harita sonra
          // değişirse bu dünya kendi sürümünde kalıyor (bkz. tazelemeKarari).
          mapVersion: HARITA_SURUMU,
        },
        select: { id: true },
      });
    } catch (e) {
      // P2002: benzersizlik kısıtı. Başka her hata yukarı gitmeli.
      if ((e as { code?: string }).code !== 'P2002' || deneme === 3) throw e;
    }
  }
  if (!world) throw new Error('Yeni diyar açılamadı.');

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
 * Bu diyar DOLU mu — tek kural, iki çağıran.
 *
 * Kayıt ekranındaki liste (`acikDiyarlar`) ile kaydın kendisi
 * (`routes/auth.ts`) bunu aynı yerden okuyor. İki ayrı koşul yazsaydı er
 * ya da geç ayrışırlardı ve ayrıştıkları an oyuncuya listede duran ama
 * kaydederken "dolu" diye reddedilen bir diyar gösterilirdi.
 *
 * Ölçüt AKTİF lord. Kayıtlıyı saymak, bir yıl önce bırakmış oyuncular
 * yüzünden diyarı yeni gelene kapatıyordu. Kayıtlı sayısının tavanı yine
 * de var ve emniyet supabı: aktife bakan bir kapasite tek başına
 * sınırsız büyümeye açık olurdu.
 */
export function diyarDoluMu(lordSayisi: number, aktifLord: number, kapasite: number): boolean {
  const carpan = (B.dunya as { azami_kayit_carpani: number }).azami_kayit_carpani;
  return aktifLord >= kapasite || lordSayisi >= kapasite * carpan;
}

/** Katılmaya AÇIK bir diyar ve kaç kişi olduğu. */
export interface AcikDiyar {
  id: string;
  ad: string;
  lordSayisi: number;
  kapasite: number;
  aktifLord: number;
  openedAt: Date;
}

/** "Aktif" sayılmak için son bu kadar gün içinde girmiş olmak gerekir. */
export const AKTIF_GUN = 7;

/**
 * Katılınabilir diyarlar — yer olanlar, eskiden yeniye.
 *
 * Kayıt ekranındaki liste ile kaydın kendisi bu TEK işlevden okuyor.
 * İkisi ayrı sorgu yazsaydı er ya da geç ayrışırlardı ve ayrıştıkları an
 * oyuncuya seçemeyeceği bir diyar gösterilirdi: listede duran ama
 * kaydederken "dolu" diye reddedilen bir satır.
 *
 * `full` İKİ YÖNLÜ bir damga. Eskiden tek yönlüydü: dolan diyar
 * işaretleniyor ve bir daha hiç açılmıyordu. Bu, diyar seçimini anlamsız
 * kılardı — yeni diyar ancak öncekiler dolunca açıldığı için her an
 * YALNIZCA BİR diyar katılınabilir olurdu ve seçecek bir şey kalmazdı.
 * Oysa dolmuş bir diyar oyuncu kaybedince gerçekten yer açıyor, üstelik
 * oturmuş ve kalabalık: yeni gelen için en iyi diyar o.
 *
 * `closed` dışarıda kalıyor — o, bilerek kapatılmış diyar demek ve
 * doluluktan bağımsız.
 */
export async function acikDiyarlar(): Promise<AcikDiyar[]> {
  const dunyalar = await prisma.world.findMany({
    where: { status: { in: ['open', 'full'] } },
    orderBy: { openedAt: 'asc' },
  });
  if (dunyalar.length === 0) return [];

  /*
   * Sayımlar TEK sorguda. Diyar başına ayrı `count` atan ilk hâl, 245
   * diyarlı geliştirme veritabanında 490 sorgu koşuyordu; üretimde de
   * diyar sayısı arttıkça kayıt ekranı yavaşlardı.
   */
  const aktifSinir = new Date(Date.now() - AKTIF_GUN * 86_400_000);
  const [hepsi, aktifler] = await Promise.all([
    prisma.lord.groupBy({ by: ['worldId'], _count: { _all: true } }),
    prisma.lord.groupBy({
      by: ['worldId'],
      _count: { _all: true },
      where: { lastSeenAt: { gte: aktifSinir } },
    }),
  ]);
  const toplam = new Map(hepsi.map((g) => [g.worldId, g._count._all]));
  const aktif = new Map(aktifler.map((g) => [g.worldId, g._count._all]));

  const sonuc: AcikDiyar[] = [];
  const doldu: string[] = [];
  const bosaldi: string[] = [];

  /*
   * DOLULUK AKTİF LORDA BAKIYOR, kayıtlıya değil.
   *
   * Kayıtlıyı saymak, bir yıl önce bırakmış oyuncular yüzünden diyarı
   * yeni gelene kapatıyordu. Geliştirme veritabanı bunun ne demek
   * olduğunu gösterdi: 142 kayıtlı / 6 aktif bir diyar "dolu", 125
   * kayıtlı / 0 aktif bir başkası yine "dolu". Oyun kırk hayalet şehre
   * bölünüyor ve her yeni oyuncu bomboş bir kırk birincisine düşüyordu.
   *
   * Bölge kıtlığı bundan etkilenmiyor: kıtlığı belirleyen şey lord
   * SAYISI değil, lord başına bölge tavanı (Lv60'ta 5) ve haritanın 121
   * bölgesi. Uyuyan bir lordun toprağı da alınabiliyor — kalıcı kalkanı
   * yok.
   *
   * Tavan yine de var ve emniyet supabı: aktife bakan bir kapasite tek
   * başına sınırsız büyümeye açık olurdu.
   */
  for (const w of dunyalar) {
    const lordSayisi = toplam.get(w.id) ?? 0;
    const aktifLord = aktif.get(w.id) ?? 0;
    if (diyarDoluMu(lordSayisi, aktifLord, w.playerCap)) {
      if (w.status === 'open') doldu.push(w.id);
      continue;
    }
    if (w.status === 'full') bosaldi.push(w.id);
    sonuc.push({
      id: w.id,
      ad: w.name,
      lordSayisi,
      kapasite: w.playerCap,
      aktifLord,
      openedAt: w.openedAt,
    });
  }

  // Damgayı düzeltmek listeyi beklemiyor: liste zaten doğru, damga
  // yalnızca başka kodun ucuza okuyabilmesi için tutuluyor.
  if (doldu.length) {
    await prisma.world.updateMany({ where: { id: { in: doldu } }, data: { status: 'full' } });
  }
  if (bosaldi.length) {
    await prisma.world.updateMany({ where: { id: { in: bosaldi } }, data: { status: 'open' } });
  }

  return sonuc;
}

/**
 * Kayıt için bir dünya bulur. Açık dünya doluysa 'full' işaretler ve yenisini açar.
 * Bu yüzden hiçbir zaman "dünya yok" hatası dönmez.
 *
 * EN ESKİ açık diyarı seçiyor, yani genelde en KALABALIK olanı. Boş bir
 * diyara koymak nazik görünürdü ama oyunu bozardı: kıtlık ve rakip bu
 * oyunun gerilim kaynağı, kimsenin olmadığı bir haritada ikisi de yok.
 */
export async function findOrOpenWorld(): Promise<string> {
  const acik = await acikDiyarlar();
  return acik[0]?.id ?? createWorld();
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
