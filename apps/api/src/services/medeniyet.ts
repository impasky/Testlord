/**
 * MEDENİYET — dünyaya yerleşmiş hâli (docs/16 §12 adım 2).
 *
 * Saf katman (`packages/shared/src/medeniyet.ts`) hangi bölgenin kimin
 * olduğunu ve kimin nereye kaydolacağını biliyor; burası o kararı bir
 * diyara YAZIYOR. İkisi arasındaki sınır bilerek keskin: bu dosyada tek
 * bir kural bile yok, yalnız saf katmanın söylediğini veritabanına
 * geçirme işi var. Kural buraya sızarsa er ya da geç saf katmandan
 * ayrışır ve sunucu ile istemci farklı sayı üretmeye başlar.
 */
import {
  BOS_MEDENIYET_BONUSU,
  CEKIRDEK_AZAMI_SEVIYE,
  CEKIRDEK_BONUSU,
  MEDENIYETLER,
  WORLD_MAP,
  atanacakMedeniyet,
  cekirdekBonusu,
  cekirdekMaliyeti,
  medeniyetBonusu,
  yurtBolgeleri,
  DEGISIMDE_FAYDA_SIFIRLANIR,
  KARTOPU_FRENI,
  degisimDurumu,
  kartopuLideri,
  kartopuPayi,
  type CekirdekBonus,
  type MedeniyetBonusu,
  type MedeniyetId,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { GameError } from '../errors.js';
import { AKTIF_GUN } from './world.js';

/**
 * Bir diyarın medeniyetlerini kurar. TEKRAR ÇALIŞTIRILABİLİR.
 *
 * Üç iş yapıyor ve üçü de "eksikse ekle" biçiminde:
 *   1. Dört medeniyet satırı (yoksa).
 *   2. Yurt bölgelerinin sahipliği — YALNIZ sahipsiz olanlara.
 *   3. Çekirdek yatırım satırları, seviye 0 (yoksa).
 *
 * İKİNCİ MADDE NEDEN "YALNIZ SAHİPSİZ": bu işlev `seed`ten de
 * çağrılıyor ve seed her açılışta koşuyor. Sahipliği koşulsuz yazsaydı,
 * fethedilmiş bir bölge her sunucu açılışında eski sahibine dönerdi —
 * oyunun ÜRETTİĞİ durumu silen bir bakım işi. Aynı sebeple `createWorld`
 * ile seed aynı işlevi çağırıyor: yeni dünya ile eski dünyanın
 * medeniyetleri iki ayrı kodda kurulsaydı ikisi ayrışırdı.
 */
export async function medeniyetleriKur(
  worldId: string,
  client: Tx = prisma,
): Promise<{ eklenenMedeniyet: number; sahiplenenBolge: number; eklenenCekirdek: number }> {
  const mevcut = await client.medeniyet.findMany({ where: { worldId }, select: { key: true } });
  const varOlan = new Set(mevcut.map((m) => m.key));
  const eksik = MEDENIYETLER.filter((m) => !varOlan.has(m.id));
  if (eksik.length > 0) {
    await client.medeniyet.createMany({
      data: eksik.map((m) => ({ worldId, key: m.id })),
    });
  }

  // Anahtardan satır kimliğine: `Region.ownerMedeniyetId` ve
  // `CekirdekYatirim.medeniyetId` bunu istiyor.
  const satirlar = await client.medeniyet.findMany({
    where: { worldId },
    select: { id: true, key: true },
  });
  const kimlik = new Map(satirlar.map((m) => [m.key, m.id]));

  let sahiplenenBolge = 0;
  for (const m of MEDENIYETLER) {
    const medeniyetId = kimlik.get(m.id);
    if (!medeniyetId) continue;
    const sonuc = await client.region.updateMany({
      // Sahipsiz: ne bir lordun ne bir medeniyetin. İkisine de bakmak
      // şart — eski bir diyarda lordun tuttuğu bölge medeniyet
      // sütununda boş görünür ve koşul tek taraflı olsaydı oyuncunun
      // toprağı üstüne yazılırdı.
      where: {
        worldId,
        mapId: { in: yurtBolgeleri(m.id) },
        ownerMedeniyetId: null,
        ownerLordId: null,
      },
      data: { ownerMedeniyetId: medeniyetId },
    });
    sahiplenenBolge += sonuc.count;
  }

  const yatirimlar = MEDENIYETLER.flatMap((m) => {
    const medeniyetId = kimlik.get(m.id);
    if (!medeniyetId) return [];
    return m.cekirdekBolgeler.map((mapId) => ({ medeniyetId, mapId }));
  });
  const eklenen = await client.cekirdekYatirim.createMany({
    data: yatirimlar,
    skipDuplicates: true,
  });

  return {
    eklenenMedeniyet: eksik.length,
    sahiplenenBolge,
    eklenenCekirdek: eklenen.count,
  };
}

/**
 * Bu diyarda yeni oyuncuya hangi medeniyet düşüyor — ve hangi satır.
 *
 * Sayım AKTİF değil TOPLAM üye üzerinden. Aktife bakmak, uzun süredir
 * girmeyen üyelerin yerini boş sayardı ve terk edilmiş bir medeniyet
 * sürekli yeni oyuncu emerdi — dengelemesi gereken şey tam da bu.
 *
 * Medeniyet satırı eksikse (sürümden önce açılmış diyar) kuruluyor:
 * kayıt hiçbir koşulda "medeniyet yok" diye çökmemeli.
 */
export async function medeniyetAta(
  worldId: string,
  client: Tx = prisma,
): Promise<{ id: string; key: MedeniyetId }> {
  let satirlar = await client.medeniyet.findMany({
    where: { worldId },
    select: { id: true, key: true },
  });
  if (satirlar.length < MEDENIYETLER.length) {
    await medeniyetleriKur(worldId, client);
    satirlar = await client.medeniyet.findMany({
      where: { worldId },
      select: { id: true, key: true },
    });
  }

  const sayim = await client.lord.groupBy({
    by: ['medeniyetId'],
    where: { worldId, medeniyetId: { not: null } },
    _count: { _all: true },
  });
  const satirBasina = new Map(sayim.map((s) => [s.medeniyetId!, s._count._all]));

  const nufus: Record<MedeniyetId, number> = {};
  for (const m of MEDENIYETLER) {
    const satir = satirlar.find((s) => s.key === m.id);
    nufus[m.id] = satir ? (satirBasina.get(satir.id) ?? 0) : 0;
  }

  const secilen = atanacakMedeniyet(nufus);
  const satir = satirlar.find((s) => s.key === secilen);
  if (!satir) throw new Error(`Medeniyet satırı bulunamadı: ${secilen}`);
  return { id: satir.id, key: secilen };
}

/** Bir medeniyetin arayüze giden hâli: kimlik, ad, renk. */
export interface MedeniyetBilgisi {
  id: MedeniyetId;
  ad: string;
  renk: string;
}

/**
 * Diyardaki medeniyet SATIRLARININ kimliğinden tanımına.
 *
 * Veritabanı yalnız hangi medeniyet olduğunu saklıyor (`key`); ad ve
 * renk `balance.json`da. İkinci bir kopya olsaydı bir medeniyetin rengi
 * iki yerde yaşar ve biri diğerinden habersiz değişirdi.
 */
export async function medeniyetBilgileri(
  worldId: string,
  client: Tx = prisma,
): Promise<Map<string, MedeniyetBilgisi>> {
  const satirlar = await client.medeniyet.findMany({
    where: { worldId },
    select: { id: true, key: true },
  });
  const harita = new Map<string, MedeniyetBilgisi>();
  for (const s of satirlar) {
    const m = MEDENIYETLER.find((x) => x.id === s.key);
    if (m) harita.set(s.id, { id: m.id, ad: m.ad, renk: m.renk });
  }
  return harita;
}

/* ------------------------------------------------------------------ */
/* Çekirdek yatırımı (docs/16 §7)                                      */
/* ------------------------------------------------------------------ */

/** Bir çekirdeğin oyuncuya gösterilen hâli. */
export interface CekirdekDurumu {
  mapId: number;
  ad: string;
  /** Taşıdığı bonus — başkent çekirdeğinde null. */
  bonus: CekirdekBonus | null;
  bonusAdi: string | null;
  seviye: number;
  azamiSeviye: number;
  /** Bir sonraki seviyenin bedeli — tavandaysa null. */
  maliyet: { altin: number; demir: number; erzak: number } | null;
  biriken: { altin: number; demir: number; erzak: number };
}

/** Bu medeniyetin AKTİF üye sayısı — maliyet bununla ölçekleniyor. */
async function aktifUyeSayisi(medeniyetId: string, client: Tx): Promise<number> {
  const sinir = new Date(Date.now() - AKTIF_GUN * 86_400_000);
  return client.lord.count({ where: { medeniyetId, lastSeenAt: { gte: sinir } } });
}

/**
 * Bir medeniyetin beş çekirdeğinin durumu.
 *
 * Ad kanonik haritadan, bonus `cekirdekBonusu`den geliyor: ikisi de
 * veritabanında saklanmıyor. Saklansaydı harita değiştiğinde satırlar
 * eski adı taşımaya devam ederdi.
 */
export async function cekirdekDurumlari(
  medeniyetId: string,
  client: Tx = prisma,
): Promise<CekirdekDurumu[]> {
  const [satirlar, uye] = await Promise.all([
    client.cekirdekYatirim.findMany({ where: { medeniyetId }, orderBy: { mapId: 'asc' } }),
    aktifUyeSayisi(medeniyetId, client),
  ]);
  return satirlar.map((y) => {
    const bonus = cekirdekBonusu(y.mapId);
    return {
      mapId: y.mapId,
      ad: WORLD_MAP.regions.find((r) => r.id === y.mapId)?.name ?? `Bölge ${y.mapId}`,
      bonus,
      bonusAdi: bonus ? CEKIRDEK_BONUSU[bonus] : null,
      seviye: y.seviye,
      azamiSeviye: CEKIRDEK_AZAMI_SEVIYE,
      maliyet: cekirdekMaliyeti(y.seviye, uye),
      biriken: { altin: y.birikenAltin, demir: y.birikenDemir, erzak: y.birikenErzak },
    };
  });
}

/**
 * Bu lordun medeniyetinden gelen bonus oranları.
 *
 * Medeniyeti olmayan lord (sistemden önceki kayıtlar) boş bonus alıyor —
 * hata değil, geçiş hâli.
 */
export async function lordunMedeniyetBonusu(
  lordId: string,
  client: Tx = prisma,
): Promise<MedeniyetBonusu> {
  const lord = await client.lord.findUnique({
    where: { id: lordId },
    select: { medeniyetId: true },
  });
  if (!lord?.medeniyetId) return BOS_MEDENIYET_BONUSU;
  const satirlar = await client.cekirdekYatirim.findMany({
    where: { medeniyetId: lord.medeniyetId },
    select: { mapId: true, seviye: true },
  });
  return medeniyetBonusu(Object.fromEntries(satirlar.map((y) => [y.mapId, y.seviye])));
}

/**
 * Diyardaki BÜTÜN medeniyetlerin bonus oranları — tek sorguda.
 *
 * Savunma bonusu (`sur`) altı ayrı yerde okunuyor: harita listesi, bölge
 * kartı, savaş önizlemesi, akın çözümü, savaşın kendisi ve NPC'nin hedef
 * değerlendirmesi. Her biri kendi sorgusunu atsaydı hem pahalı olurdu
 * hem de er ya da geç biri unutulur, önizleme ile savaş AYRI sayı
 * gösterirdi — bu projenin en çok tekrarlayan hatası.
 */
export async function medeniyetBonuslari(
  worldId: string,
  client: Tx = prisma,
): Promise<Map<string, MedeniyetBonusu>> {
  const satirlar = await client.cekirdekYatirim.findMany({
    where: { medeniyet: { worldId } },
    select: { medeniyetId: true, mapId: true, seviye: true },
  });
  const seviyeler = new Map<string, Record<number, number>>();
  for (const y of satirlar) {
    const m = seviyeler.get(y.medeniyetId) ?? {};
    m[y.mapId] = y.seviye;
    seviyeler.set(y.medeniyetId, m);
  }
  const cikti = new Map<string, MedeniyetBonusu>();
  for (const [id, m] of seviyeler) cikti.set(id, medeniyetBonusu(m));
  return cikti;
}

/**
 * KARTOPU FRENİ — bu diyarda önde giden medeniyet hangisi (docs/16 §10).
 *
 * Tek `groupBy` ile bölge sayımı yapıyor; kararı saf katman veriyor
 * (`kartopuLideri`). Eşik ve bonus `balance.json`da, burada bir kopyası
 * yok.
 *
 * TEK YERDEN OKUNUYOR ve bu bilinçli: savaş çözümü, savaş önizlemesi ve
 * dünya şeridi aynı cevabı vermek zorunda. Üçü ayrı sayım yapsaydı er ya
 * da geç biri unutulur ve önizleme ile savaş farklı yağma gösterirdi —
 * bu projenin en çok tekrarlayan hatası (docs/16 §18).
 */
export interface KartopuDurumu {
  /** Önde giden medeniyetin satır kimliği. */
  medeniyetId: string;
  /** O medeniyetin tutulan topraktaki payı (0-1). */
  pay: number;
  /** Bölgelerinden yağmaya eklenen oran. */
  yagmaBonusu: number;
}

export async function kartopuDurumu(
  worldId: string,
  client: Tx = prisma,
): Promise<KartopuDurumu | null> {
  const sayimlar = await client.region.groupBy({
    by: ['ownerMedeniyetId'],
    where: { worldId, ownerMedeniyetId: { not: null } },
    _count: { _all: true },
  });
  const sayilar: Record<string, number> = {};
  for (const s of sayimlar) {
    if (s.ownerMedeniyetId) sayilar[s.ownerMedeniyetId] = s._count._all;
  }
  const ondeki = kartopuLideri(sayilar);
  if (!ondeki) return null;
  return {
    medeniyetId: ondeki,
    pay: kartopuPayi(sayilar) ?? 0,
    yagmaBonusu: KARTOPU_FRENI.yagmaBonusu,
  };
}

/**
 * Diyardaki medeniyet NÜFUSLARI — anahtara göre.
 *
 * Hem atama hem değişim aynı sayıyı okumak zorunda: kayıt en az
 * kalabalığa yazıyor, değişim de yalnız ortalamanın altındakine izin
 * veriyor. İkisi ayrı sayardı ve biri diğerinden habersiz değişirdi.
 */
export async function medeniyetNufuslari(
  worldId: string,
  client: Tx = prisma,
): Promise<{ nufus: Record<MedeniyetId, number>; satirlar: { id: string; key: string }[] }> {
  const satirlar = await client.medeniyet.findMany({
    where: { worldId },
    select: { id: true, key: true },
  });
  const sayim = await client.lord.groupBy({
    by: ['medeniyetId'],
    where: { worldId, medeniyetId: { not: null } },
    _count: { _all: true },
  });
  const satirBasina = new Map(sayim.map((x) => [x.medeniyetId!, x._count._all]));
  const nufus: Record<MedeniyetId, number> = {};
  for (const m of MEDENIYETLER) {
    const satir = satirlar.find((x) => x.key === m.id);
    nufus[m.id] = satir ? (satirBasina.get(satir.id) ?? 0) : 0;
  }
  return { nufus, satirlar };
}

/**
 * MEDENİYET DEĞİŞTİR (docs/16 §13 soru 3).
 *
 * Kararı saf katman veriyor (`degisimDurumu`); burası yalnız yazıyor.
 * Dört şey aynı işlemde oluyor ve dördü de bilerek:
 *
 *  1. Lordun medeniyeti değişiyor, damga atılıyor (bekleme buradan).
 *  2. FAYDA PUANI SIFIRLANIYOR — puan eski tarafa verilen hizmetin
 *     kaydı; taşınsaydı hiç katkı vermemiş biri üstüne rütbe giyerek
 *     gelirdi.
 *  3. TUTTUĞU TOPRAKLAR da yeni medeniyete yazılıyor. Yazılmasaydı lord
 *     kendi bölgesinden pay alamaz (`payAlabilir` bölgenin medeniyetine
 *     bakıyor) ve kendi toprağına saldıramazdı: düzeltmesi olmayan bir
 *     hâl. Kartopu riski yok, çünkü yalnız NÜFUSU AZ tarafa geçilebiliyor
 *     — toprak da büyükten küçüğe akıyor.
 *  4. KAMP yeni yurda taşınıyor: §8 "başkent kendi medeniyetinin
 *     yurdunda" diyor ve kamp çıpası mesafe hesabının başlangıcı.
 *
 * Yürüyüşü havadayken değiştirmek yasak: kamp taşınınca mesafeler
 * değişiyor ve yoldaki ordunun dönüşü anlamsızlaşırdı.
 */
export async function medeniyetDegistir(
  lordId: string,
  hedefKey: MedeniyetId,
): Promise<{ medeniyet: MedeniyetBilgisi; faydaPuani: number; tasinanBolge: number }> {
  return prisma.$transaction(async (tx) => {
    const lord = await tx.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: {
        worldId: true,
        medeniyetId: true,
        medeniyetDegisimAt: true,
        faydaPuani: true,
      },
    });

    const yoldaki = await tx.march.count({ where: { lordId, resolved: false } });
    if (yoldaki > 0) {
      throw new GameError(
        'Yoldaki ordun varken taraf değiştiremezsin. Önce dönmesini bekle.',
        400,
        'ORDU_YOLDA',
      );
    }

    const { nufus, satirlar } = await medeniyetNufuslari(lord.worldId, tx);
    const simdikiKey = satirlar.find((x) => x.id === lord.medeniyetId)?.key ?? null;
    const durum = degisimDurumu(simdikiKey, hedefKey, nufus, lord.medeniyetDegisimAt, new Date());
    if (!durum.olur) {
      throw new GameError(durum.sebep ?? 'Şimdi taraf değiştiremezsin.', 400, 'DEGISIM_OLMAZ');
    }

    const hedefSatir = satirlar.find((x) => x.key === hedefKey);
    if (!hedefSatir) throw new GameError('Medeniyet bulunamadı.', 400, 'MEDENIYET_YOK');

    // Toprak da taşınıyor (yukarıdaki 3. madde).
    const tasinan = await tx.region.updateMany({
      where: { worldId: lord.worldId, ownerLordId: lordId },
      data: { ownerMedeniyetId: hedefSatir.id },
    });

    // Kamp yeni yurda (4. madde): kayıttaki çıpa seçimiyle aynı ölçüt —
    // yurdun en az kalabalık köyü.
    const yurt = yurtBolgeleri(hedefKey);
    const koyler = await tx.region.findMany({
      where: { worldId: lord.worldId, type: 'koy', mapId: { in: yurt } },
      select: { mapId: true },
      orderBy: { mapId: 'asc' },
    });
    const yeniKamp = koyler[0]?.mapId;

    await tx.lord.update({
      where: { id: lordId },
      data: {
        medeniyetId: hedefSatir.id,
        medeniyetDegisimAt: new Date(),
        ...(DEGISIMDE_FAYDA_SIFIRLANIR ? { faydaPuani: 0 } : {}),
        ...(yeniKamp !== undefined ? { homeBolgeId: yeniKamp } : {}),
      },
    });

    const m = MEDENIYETLER.find((x) => x.id === hedefKey)!;
    return {
      medeniyet: { id: m.id, ad: m.ad, renk: m.renk },
      faydaPuani: DEGISIMDE_FAYDA_SIFIRLANIR ? 0 : lord.faydaPuani,
      tasinanBolge: tasinan.count,
    };
  });
}

/**
 * TAHTI TUTAN MEDENİYET — docs/16 §13 soru 5'in cevabı.
 *
 * Tahtı tutan lordun medeniyeti, o diyardaki BÜTÜN üyelerine küçük bir
 * şöhret çarpanı kazandırıyor (`balance.json` → `taht_kalesi`). Şöhret,
 * güç değil: tahtın üstüne bir de güç vermek önde gideni daha da
 * hızlandırırdı (§10 dördüncü risk).
 *
 * Bölgenin KENDİ `ownerMedeniyetId`'sine bakıyor, tutan lordun
 * medeniyetine değil: fetih toprağı zaten medeniyete yazıyor (§17) ve
 * iki alan ayrışırsa haritanın söylediğiyle sıralamanın söylediği
 * farklı olurdu.
 */
export async function tahtiTutanMedeniyet(
  worldId: string,
  client: Tx = prisma,
): Promise<string | null> {
  const taht = await client.region.findFirst({
    where: { worldId, type: 'taht' },
    select: { ownerMedeniyetId: true, ownerLordId: true },
  });
  // Sahipsiz taht kimseye yazmıyor: NPC garnizonu tutuyorsa ortada
  // kazanılmış bir şey yok.
  if (!taht?.ownerLordId) return null;
  return taht.ownerMedeniyetId;
}

/** Bir bölgeyi tutan medeniyetin SUR oranı — tutan yoksa 0. */
export function surOrani(
  bonuslar: Map<string, MedeniyetBonusu>,
  ownerMedeniyetId: string | null,
): number {
  return ownerMedeniyetId ? (bonuslar.get(ownerMedeniyetId)?.sur ?? 0) : 0;
}
