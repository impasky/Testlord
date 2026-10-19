/**
 * Dünyanın DEĞİŞMEYEN bölge bilgisi — bellekte, dünya başına bir kez.
 *
 * Gerçek dünyada (docs/27) bir diyar 3.047 bölge. `/map` her istekte hepsini
 * bütün sütunlarıyla okuyordu, öneri motoru da sahipsizlerin hepsini bir kez
 * daha: Prisma'da istek başına ~240 ms CPU. Ücretsiz sunucunun 0,1 CPU'sunda
 * bu 2,4 saniye ve sunucu tek iş parçacıklı — o sırada gelen `/me` de
 * `/sehir` de arkasında bekliyordu. Oyuncunun "sayfalar 2–4 saniyede
 * açılıyor" dediği şey buydu.
 *
 * Oysa bölgenin adı, türü, ülkesi, konumu, komşuları ve gelir çarpanı oyun
 * sırasında değişmiyor: yalnız dünya açılırken ya da tazelenirken
 * (`world.ts`, `goc.ts`) yazılıyor. Onlar burada bir kez okunuyor; istek
 * başına yalnız DEĞİŞEN sütunlar (seviye, sahip, kalkan) okunuyor.
 *
 * Komşuluk grafiği de aynı satırlardan kuruluyor (eskiden `mesafe.ts`
 * kendi sorgusuyla kuruyordu): bir sorgu, bir kayıt, bir unutma noktası.
 */
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, constants as zlibSabitleri, gzip } from 'node:zlib';
import { haritaGrafi, type HaritaGrafi } from '@lordlar/shared';
import { prisma } from '../db.js';

export interface SabitBolge {
  id: number;
  mapId: number;
  name: string;
  type: string;
  province: string;
  /**
   * `/map` satırının değişmeyen başı, hazır JSON: `{"id":…,…,"incomeMult":…`
   * (kapanış yok). 3.047 nesneyi her istekte kurup serileştirmek yerine
   * değişen alanlar bunun arkasına ekleniyor.
   */
  json: string;
}

export interface DunyaBolgeleri {
  /** Kimlik (`id`) sırasıyla — `/map`in sırası. */
  liste: readonly SabitBolge[];
  /** Kanonik numaradan (`mapId`) satıra. */
  mapIdIle: ReadonlyMap<number, SabitBolge>;
  /** Satır kimliğinden (`id`) satıra. */
  idIle: ReadonlyMap<number, SabitBolge>;
  /** Komşuluk grafiği; düğümler `mapId`. */
  graf: HaritaGrafi;
  /**
   * Listenin tamamı, hazır JSON — `/harita/bolgeler`in gövdesi. Tarayıcı
   * bunu bir kez indirip saklıyor; her istekte yalnız değişenler gidiyor.
   */
  statikJson: string;
  /** `statikJson`un özeti: adres bununla değişiyor, tarayıcı eskiyi tutmuyor. */
  surum: string;
}

type Istemci = Pick<typeof prisma, 'region'>;

/** Söz saklanıyor: aynı anda gelen iki istek sorguyu iki kez açmasın. */
const bellek = new Map<string, { soz: Promise<DunyaBolgeleri>; kuruldu: number }>();
/** Seed ayrı bir süreçte harita değiştirebilir; kayıt sonsuza kadar yaşamasın. */
const TAZELIK_MS = 5 * 60_000;

async function kur(worldId: string, tx: Istemci): Promise<DunyaBolgeleri> {
  const satirlar = await tx.region.findMany({
    where: { worldId },
    select: {
      id: true,
      mapId: true,
      name: true,
      type: true,
      province: true,
      x: true,
      y: true,
      komsular: true,
      incomeMult: true,
    },
    orderBy: { id: 'asc' },
  });
  const komsuluk = new Map<number, readonly number[]>(
    satirlar.map((r) => [r.mapId, (Array.isArray(r.komsular) ? r.komsular : []).map(Number)]),
  );
  // Komşular istemciye satır kimliğiyle gidiyor (bkz. routes/map.ts).
  const mapIdToId = new Map(satirlar.map((r) => [r.mapId, r.id]));
  const liste = satirlar.map((r): SabitBolge => {
    const komsular = (komsuluk.get(r.mapId) ?? [])
      .map((k) => mapIdToId.get(k))
      .filter((x): x is number => x !== undefined);
    return {
      id: r.id,
      mapId: r.mapId,
      name: r.name,
      type: r.type,
      province: r.province,
      json:
        `{"id":${r.id},"mapId":${r.mapId},"name":${JSON.stringify(r.name)}` +
        `,"type":${JSON.stringify(r.type)},"province":${JSON.stringify(r.province)}` +
        `,"x":${JSON.stringify(r.x)},"y":${JSON.stringify(r.y)}` +
        `,"komsular":${JSON.stringify(komsular)},"incomeMult":${JSON.stringify(r.incomeMult)}`,
    };
  });
  const statikJson = `[${liste.map((b) => `${b.json}}`).join(',')}]`;
  return {
    liste,
    statikJson,
    surum: createHash('sha1').update(statikJson).digest('base64url').slice(0, 16),
    mapIdIle: new Map(liste.map((b) => [b.mapId, b])),
    idIle: new Map(liste.map((b) => [b.id, b])),
    graf: haritaGrafi(komsuluk),
  };
}

/** Bu dünyanın değişmeyen bölge bilgisi ve komşuluk grafiği. */
export function dunyaBolgeleri(worldId: string, tx: Istemci = prisma): Promise<DunyaBolgeleri> {
  const kayit = bellek.get(worldId);
  if (kayit && Date.now() - kayit.kuruldu < TAZELIK_MS) return kayit.soz;
  const soz = kur(worldId, tx);
  bellek.set(worldId, { soz, kuruldu: Date.now() });
  // Düşen sorgu saklanmasın: bir sonraki istek yeniden denesin.
  soz.catch(() => {
    if (bellek.get(worldId)?.soz === soz) bellek.delete(worldId);
  });
  return soz;
}

/** Dünyanın bölgeleri değiştiyse kaydı at (aynı süreçteyse anında etki eder). */
export function dunyaBolgeleriniUnut(worldId?: string): void {
  if (worldId) bellek.delete(worldId);
  else bellek.clear();
}

const brotli = promisify(brotliCompress);
const gzipla = promisify(gzip);
const sikistirilmis = new WeakMap<
  DunyaBolgeleri,
  Partial<Record<'br' | 'gzip', Promise<Buffer>>>
>();

/**
 * `statikJson`un sıkıştırılmış hâli — dünya başına bir kez.
 *
 * Kalite 6: 455 KB → 95 KB, ~20 ms. Kalite 11 yalnız %20 daha küçük ama
 * ~800 ms sürüyor; 0,1 CPU'da sekiz saniye, ilk açılışta oyuncunun
 * beklediği yerde. Tarayıcı dosyayı bir kez indirip sakladığı için
 * aradaki 20 KB bir kez ödeniyor.
 */
export function statikSikistirilmis(
  dunya: DunyaBolgeleri,
  kodlama: 'br' | 'gzip',
): Promise<Buffer> {
  let kayit = sikistirilmis.get(dunya);
  if (!kayit) sikistirilmis.set(dunya, (kayit = {}));
  kayit[kodlama] ??=
    kodlama === 'br'
      ? brotli(dunya.statikJson, {
          params: {
            [zlibSabitleri.BROTLI_PARAM_QUALITY]: 6,
            [zlibSabitleri.BROTLI_PARAM_MODE]: zlibSabitleri.BROTLI_MODE_TEXT,
          },
        })
      : gzipla(dunya.statikJson, { level: 6 });
  return kayit[kodlama];
}
