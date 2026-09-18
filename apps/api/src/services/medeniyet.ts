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
import { MEDENIYETLER, atanacakMedeniyet, yurtBolgeleri, type MedeniyetId } from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';

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
