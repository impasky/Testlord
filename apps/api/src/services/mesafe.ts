/**
 * "Bu bölge bana ne kadar uzak?" — tek yerden.
 *
 * Mesafe malikâneden değil, oyuncunun EN YAKIN TOPRAĞINDAN ölçülüyor
 * (docs/11 §1.2 H1). Sekiz ayrı uç aynı soruyu soruyor; hesabı sekiz yere
 * kopyalamak, bir gün birinin unutulup haritanın kendi içinde tutarsız
 * olması demekti — bölge listesinde "2 adım" yazan yerin saldırı ekranında
 * "5 adım" çıkması.
 *
 * ── Grafik artık DÜNYANIN KENDİ grafiği ──────────────────────────────
 *
 * Mesafe eskiden kanonik `world-map.json`dan okunuyordu. İki sorunu vardı
 * ve ikincisi sinsiydi:
 *
 *   1. Kanonik harita değişince canlı dünyalar da değişiyordu (docs/12 §14).
 *   2. Daha kötüsü, motorla veri AYRIŞABİLİYORDU: bölgenin komşuları
 *      veritabanı satırında yazılı ve harita onları çiziyor, ama mesafe
 *      kanonik dosyadan geliyordu. İkisi ayrılırsa oyun yalan söyler —
 *      haritada çizilmeyen bir yoldan yürüyüş "1 adım" sürer.
 *
 * Artık grafik dünyanın kendi bölge satırlarından kuruluyor. Kanonik dosya
 * yalnız YENİ dünya açarken okunuyor; açılmış dünya kendi haritasını
 * taşıyor ve motor da o haritayı okuyor.
 *
 * Grafik BELLEKTE tutuluyor: bölge başına bir genişlik-öncelikli arama,
 * 121 bölgede birkaç milisaniye — istek başına ödenirse pahalı, bir kez
 * ödenirse bedava. Bir dünyanın komşulukları oyun sırasında değişmiyor;
 * yalnız `seed` değiştirebiliyor, o da ayrı bir süreçte çalıştığı için
 * kaydın tazeliği süreyle de sınırlanıyor.
 */
import { haritaGrafi, type HaritaGrafi, yakinlikMesafesiGraf } from '@lordlar/shared';
import { prisma } from '../db.js';

/** Ölçer bölge KİMLİĞİ alıyor: kanonik haritadaki `mapId`, satır no değil. */
export type Mesafeci = (hedefMapId: number) => number;

type Istemci = Pick<typeof prisma, 'lord' | 'region' | 'world'>;

interface Kayit {
  graf: HaritaGrafi;
  kuruldu: number;
}

const bellek = new Map<string, Kayit>();
/** Seed ayrı bir süreçte harita değiştirebilir; kayıt sonsuza kadar yaşamasın. */
const TAZELIK_MS = 5 * 60_000;

/** Bu dünyanın komşuluk grafiği — kendi bölge satırlarından. */
export async function dunyaGrafigi(worldId: string, tx: Istemci = prisma): Promise<HaritaGrafi> {
  const kayit = bellek.get(worldId);
  if (kayit && Date.now() - kayit.kuruldu < TAZELIK_MS) return kayit.graf;

  const satirlar = await tx.region.findMany({
    where: { worldId },
    select: { mapId: true, komsular: true },
  });
  const komsuluk = new Map<number, readonly number[]>(
    satirlar.map((r) => [r.mapId, (Array.isArray(r.komsular) ? r.komsular : []).map(Number)]),
  );
  const graf = haritaGrafi(komsuluk);
  bellek.set(worldId, { graf, kuruldu: Date.now() });
  return graf;
}

/** Dünyanın bölgeleri değiştiyse kaydı at (aynı süreçteyse anında etki eder). */
export function grafigiUnut(worldId?: string): void {
  if (worldId) bellek.delete(worldId);
  else bellek.clear();
}

export async function mesafeOlcer(lordId: string, tx: Istemci = prisma): Promise<Mesafeci> {
  const lord = await tx.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: { homeBolgeId: true, worldId: true },
  });
  const [topraklar, graf] = await Promise.all([
    tx.region.findMany({ where: { ownerLordId: lordId }, select: { mapId: true } }),
    dunyaGrafigi(lord.worldId, tx),
  ]);
  const topraklarim = topraklar.map((t) => t.mapId);
  return (hedef) => yakinlikMesafesiGraf(graf, lord.homeBolgeId, topraklarim, hedef);
}

/**
 * Ev ve topraklar zaten elde olduğunda sorgusuz kurulan ölçer.
 *
 * Harita listesi zaten TÜM bölgeleri çekiyor; oradan sahiplerine bakıp
 * ikinci bir sorgu açmak boşuna.
 */
export function mesafeOlcerHazir(
  graf: HaritaGrafi,
  evMapId: number,
  topraklar: readonly number[],
): Mesafeci {
  return (hedef) => yakinlikMesafesiGraf(graf, evMapId, topraklar, hedef);
}

/** İki lordun evi arasındaki mesafe (ticaret sevkiyatı için). */
export async function lordlarArasiMesafe(
  worldId: string,
  evA: number,
  evB: number,
  tx: Istemci = prisma,
): Promise<number> {
  return (await dunyaGrafigi(worldId, tx)).mesafe(evA, evB);
}
