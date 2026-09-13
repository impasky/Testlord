/**
 * RAKİP LORDLAR HAREKET EDİYOR.
 *
 * ── Sorun ────────────────────────────────────────────────────────────
 *
 * Diyar kalabalıktı ama ölüydü. `seedDemoLords` altı rakip lord açıyor,
 * onlara bölge, ordu ve seviye veriyordu; sonra hiçbiri hiçbir şey
 * yapmıyordu. Sıralamada bir isim, haritada duran bir bayrak. Oyuncu
 * girmediği sürece dünyada tek bir şey değişmiyordu — harita oyuncunun
 * en son bıraktığı gibi duruyordu, bu da oyunu çok oyunculu bir diyar
 * değil bekleyen bir kayıt dosyası gibi gösteriyordu.
 *
 * ── Yaklaşım: ayrı uç değil, AYNI MOTOR ──────────────────────────────
 *
 * NPC'ye özel bir savaş çözümü yazmak kolaydı ve yanlış olurdu: iki
 * motor er ya da geç ayrışır, ve NPC'nin kazandığı savaş oyuncunun
 * gördüğü rapordan başka bir hikâye anlatırdı. Burada NPC, oyuncunun
 * yaptığının aynısını yapıyor — evden ordusunu çıkarıp gerçek bir
 * `March` kaydı açıyor. Worker onu oyuncunun yürüyüşüyle aynı kodla
 * çözüyor: aynı savaş, aynı kayıp, aynı yağma, aynı rapor, aynı olay
 * akışı.
 *
 * ── Oyuncuyu ezmemek için dört kural ─────────────────────────────────
 *
 * NPC saldırısı oyunun BÜTÜN koruma kurallarından geçiyor (yeni oyuncu
 * kalkanı, bölge kalkanı, seviye farkı, 12 saat tekrar sınırı). Üstüne
 * dört tanesi daha var ve hepsi tek bir soruyu cevaplıyor: "bu, oyunu
 * bırakma sebebi olur mu?"
 *
 *   1. Uzaktan gelinmiyor. Hedef en çok birkaç adım ötede olmalı;
 *      haritanın öbür ucundan gelen saldırının anlatısı yok.
 *   2. Son bölge alınmıyor. Tek bölgesi olan oyuncuya dokunulmuyor —
 *      birini oyundan silmek NPC'nin işi değil.
 *   3. Kaybedecek savaşa girilmiyor. NPC ancak savunanın gücünün belli
 *      bir katı kadar ordusu varsa yürüyor; yoksa oyuncuya bedava zafer
 *      ve bedava şöhret dağıtan bir NPC olurdu.
 *   4. Harita yutulmuyor. Bütün NPC'ler birlikte dünyanın bölgelerinin
 *      ancak küçük bir payını tutabiliyor — oyuncunun genişleyecek yeri
 *      kalmalı.
 *
 * Sayıların hepsi `data/balance.json` → `npc_lordlar`.
 */
import {
  B,
  UNIT_TYPES,
  armyCount,
  armyPower,
  armySlots,
  bosGeneralBonus,
  commandCapacity,
  egitimSuresiSn,
  marchDurationSec,
  maxRegions,
  unit,
  varsayilanDizilim,
  type Army,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { dunyaGrafigi } from './mesafe.js';
import { enqueue, evdenCikar, spendResources } from './queue.js';
import { bolgeTahkimati, regionFortressBonus } from './region.js';

const N = B.npc_lordlar;

/** Bir NPC'nin bu turda yaptığı iş — günlüğe ve teste açık. */
export type NpcIsi = 'egitim' | 'sahipsiz-fetih' | 'oyuncuya-saldiri' | 'bekledi';

export interface NpcTurSonucu {
  oynayan: number;
  isler: Record<NpcIsi, number>;
}

/**
 * Sıradaki turun ne zaman olacağı.
 *
 * Saçılma OLMADAN bütün NPC'ler aynı anda kalkardı: dünya kırk beş
 * dakika boyunca ölü, sonra bir anda altı savaş. Rastgele kayma o
 * yığılmayı dağıtıyor ve diyarın kendi ritmi oluyor.
 */
function sonrakiTur(now: Date): Date {
  const dakika = N.tur_araligi_dakika + Math.random() * N.tur_sacilmasi_dakika;
  return new Date(now.getTime() + dakika * 60_000);
}

/** NPC'nin evdeki ordusu. */
async function evOrdusu(lordId: string, tx: Tx): Promise<Army> {
  const rows = await tx.armyUnit.findMany({
    where: { lordId, locationType: 'home', locationId: null },
  });
  const ordu: Army = {};
  for (const r of rows) ordu[r.unitType as UnitType] = r.count;
  return ordu;
}

/**
 * NPC ordusunu büyütür: kapasitenin boş kalan yerine mızrakçı ve okçu.
 *
 * Süvari bilerek yok — NPC'nin ordusu okunabilir olmalı. Oyuncu bir
 * rakibe saldırmadan önce "ne var karşımda" diye düşünebilmeli ve
 * karışık bir ordu o düşünceyi bulanıklaştırır. Mızrakçı-okçu karışımı
 * taş-kâğıt-makasın her iki ucuna da cevap veriyor.
 */
async function egitimVer(lordId: string, bosYer: number, butce: number, tx: Tx): Promise<boolean> {
  const karisim: [UnitType, number][] = [
    ['mizrakci', 0.6],
    ['okcu', 0.4],
  ];
  let birSeyYapildi = false;

  for (const [tur, pay] of karisim) {
    const u = unit(tur);
    const yerden = Math.floor((bosYer * pay) / u.yer);
    const paradan = Math.floor((butce * pay) / Math.max(1, u.maliyet.altin));
    const adet = Math.min(yerden, paradan);
    if (adet <= 0) continue;

    try {
      await spendResources(
        lordId,
        {
          altin: u.maliyet.altin * adet,
          demir: u.maliyet.demir * adet,
          erzak: u.maliyet.erzak * adet,
        },
        tx,
      );
    } catch {
      // Kaynak yetmedi: NPC'nin de bütçesi var, bu bir hata değil.
      continue;
    }
    await enqueue(
      lordId,
      'train',
      { unitType: tur, count: adet },
      egitimSuresiSn(u.egitim_sn, adet),
      tx,
    );
    birSeyYapildi = true;
  }
  return birSeyYapildi;
}

/** NPC'nin yürüyüşü — oyuncununkiyle aynı kayıt, aynı çözüm. */
async function yuruyuseCikar(
  lord: { id: string; worldId: string },
  hedefRegionId: number,
  ordu: Army,
  mesafe: number,
  tx: Tx,
): Promise<boolean> {
  if (!(await evdenCikar(lord.id, ordu, tx))) return false;

  // İlk saldırı kısayolu NPC'ye kapalı: o kısayol yeni oyuncunun ilk
  // oturumunda sonuç görmesi için var, NPC'nin hızlanması için değil.
  const sn = marchDurationSec(mesafe, ordu, bosGeneralBonus(), { ilkSaldiri: false });
  const now = new Date();
  const march = await tx.march.create({
    data: {
      worldId: lord.worldId,
      lordId: lord.id,
      fromRegionId: null,
      toRegionId: hedefRegionId,
      kind: 'attack',
      army: ordu as object,
      generalIds: [] as object,
      duzen: { dizilim: varsayilanDizilim(ordu), taktik: null } as object,
      distance: mesafe,
      departAt: now,
      arriveAt: new Date(now.getTime() + sn * 1000),
    },
  });
  for (const t of UNIT_TYPES) {
    const c = ordu[t] ?? 0;
    if (c > 0) {
      await tx.armyUnit.create({
        data: {
          lordId: lord.id,
          unitType: t,
          count: c,
          locationType: 'march',
          locationId: march.id,
        },
      });
    }
  }
  return true;
}

/**
 * Bu bölgeye saldırmaya değer mi — güç karşılaştırması.
 *
 * Kaybedecek savaşa girmemenin tek ölçüsü bu. Simülasyon çalıştırmıyoruz:
 * NPC turu worker'ın sıcak yolunda ve `savasOrneklemesi` bölge başına
 * dokuz savaş demek. Kaba bir güç oranı NPC'nin kararı için yeterli —
 * yanlış tarafa düşerse en kötü ihtimalle NPC bir tur bekler.
 */
function yeterMi(saldiran: Army, savunan: Army, tahkimat: number): boolean {
  const savunmaGucu = armyPower(savunan) * (1 + tahkimat);
  if (savunmaGucu <= 0) return armyCount(saldiran) > 0;
  return armyPower(saldiran) >= savunmaGucu * N.guvenli_fetih_payi;
}

/** Tek bir NPC lorda sıra verir. */
async function lordOynasin(lordId: string, now: Date): Promise<NpcIsi> {
  return prisma.$transaction(
    async (tx) => {
      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: {
          id: true,
          worldId: true,
          level: true,
          liderlik: true,
          altin: true,
          homeBolgeId: true,
        },
      });

      // Sıra damgası EN BAŞTA yazılıyor: iş yapılmasa da tur harcanmış
      // sayılır. Yoksa yapacak işi olmayan bir NPC her worker turunda
      // yeniden seçilir ve öteki NPC'lere hiç sıra gelmezdi.
      await tx.lord.update({ where: { id: lordId }, data: { npcSonTur: sonrakiTur(now) } });

      const ev = await evOrdusu(lord.id, tx);
      const kapasite = commandCapacity(lord.liderlik, bosGeneralBonus());
      const kullanilan = armySlots(ev);

      // ── 1. Ordu zayıfsa önce asker ──────────────────────────────────
      if (kullanilan < kapasite * N.ordu_esigi) {
        const kuyrukta = await tx.queue.count({
          where: { lordId: lord.id, kind: 'train', resolved: false },
        });
        if (kuyrukta === 0) {
          const yapildi = await egitimVer(
            lord.id,
            kapasite - kullanilan,
            lord.altin * N.egitim_harcama_orani,
            tx,
          );
          if (yapildi) return 'egitim';
        }
      }
      if (armyCount(ev) === 0) return 'bekledi';

      // ── 2. Aynı anda bir yürüyüş ────────────────────────────────────
      // NPC'nin bütün ordusu tek yürüyüşe biniyor; ikinci bir yürüyüş
      // açmak "NPC evini boş bıraktı" demek olurdu.
      const yolda = await tx.march.count({ where: { lordId: lord.id, resolved: false } });
      if (yolda > 0) return 'bekledi';

      const graf = await dunyaGrafigi(lord.worldId, tx);
      const topraklar = await tx.region.findMany({
        where: { worldId: lord.worldId, ownerLordId: lord.id },
        select: { mapId: true },
      });
      const olc = (hedef: number): number => {
        let enAz = graf.mesafe(lord.homeBolgeId, hedef);
        for (const t of topraklar) enAz = Math.min(enAz, graf.mesafe(t.mapId, hedef));
        return enAz;
      };

      // Bölge tavanı: NPC de oyuncuyla aynı seviye kuralına tabi.
      const bolgeTavani = topraklar.length >= maxRegions(lord.level);

      // ── 3. Oyuncuya saldırı (şansa bağlı) ───────────────────────────
      const oyuncuyaGit = Math.random() < N.oyuncuya_saldiri_olasiligi;
      if (oyuncuyaGit) {
        const hedef = await oyuncuHedefiSec(lord, ev, olc, tx, now);
        if (hedef && (await yuruyuseCikar(lord, hedef.id, ev, hedef.mesafe, tx))) {
          return 'oyuncuya-saldiri';
        }
      }

      // ── 4. Sahipsiz bölge ───────────────────────────────────────────
      if (bolgeTavani) return 'bekledi';
      const payDolu = await npcPayiDolu(lord.worldId, tx);
      if (payDolu) return 'bekledi';

      const hedef = await sahipsizHedefSec(lord, ev, olc, tx, now);
      if (hedef && (await yuruyuseCikar(lord, hedef.id, ev, hedef.mesafe, tx))) {
        return 'sahipsiz-fetih';
      }
      return 'bekledi';
    },
    { timeout: 20_000 },
  );
}

/** NPC'ler birlikte dünyanın ne kadarını tutuyor — tavana geldi mi. */
async function npcPayiDolu(worldId: string, tx: Tx): Promise<boolean> {
  const [toplam, npcler] = await Promise.all([
    tx.region.count({ where: { worldId } }),
    tx.region.count({ where: { worldId, owner: { isNpc: true } } }),
  ]);
  return toplam > 0 && npcler / toplam >= N.en_cok_bolge_payi;
}

interface Hedef {
  id: number;
  mesafe: number;
}

/** Alınabilecek en yakın sahipsiz bölge. */
async function sahipsizHedefSec(
  lord: { id: string; worldId: string },
  ordu: Army,
  olc: (mapId: number) => number,
  tx: Tx,
  now: Date,
): Promise<Hedef | null> {
  const adaylar = await tx.region.findMany({
    where: {
      worldId: lord.worldId,
      ownerLordId: null,
      // Taht Kalesi NPC'nin işi değil: oyunun bitiş hedefi, bir NPC'nin
      // sabah uyanıp aldığı bir yer olmamalı.
      type: { not: 'taht' },
      OR: [{ shieldUntil: null }, { shieldUntil: { lte: now } }],
    },
  });

  let enIyi: Hedef | null = null;
  for (const r of adaylar) {
    if (!yeterMi(ordu, r.npcGarrison as Army, regionFortressBonus(r.type, r.level))) continue;
    const mesafe = olc(r.mapId);
    if (!enIyi || mesafe < enIyi.mesafe) enIyi = { id: r.id, mesafe };
  }
  return enIyi;
}

/**
 * Saldırılabilecek bir OYUNCU bölgesi.
 *
 * Buradaki her `continue` bir koruma kuralı ve hepsi oyunun kendi
 * kurallarıyla aynı: bunları NPC'ye ayrıca yazmak zorundayız çünkü NPC
 * uçlardan değil doğrudan motordan geçiyor. Kural kopyası değil, aynı
 * `balance.json` değerlerinin okunması — sayı tek kaynakta.
 */
async function oyuncuHedefiSec(
  lord: { id: string; level: number; worldId: string },
  ordu: Army,
  olc: (mapId: number) => number,
  tx: Tx,
  now: Date,
): Promise<Hedef | null> {
  const adaylar = await tx.region.findMany({
    where: {
      worldId: lord.worldId,
      ownerLordId: { not: null },
      type: { not: 'taht' },
      OR: [{ shieldUntil: null }, { shieldUntil: { lte: now } }],
      owner: {
        // NPC, NPC'ye saldırmıyor: kendi aralarındaki savaş oyuncunun
        // göremediği bir gürültü ve haritayı oyuncu için değiştirmiyor.
        isNpc: false,
        // Yeni oyuncu kalkanı.
        OR: [{ protectionUntil: null }, { protectionUntil: { lte: now } }],
      },
    },
    include: {
      owner: {
        select: { id: true, level: true, binalar: true, baskentBolgeId: true },
      },
    },
  });

  const tekrarEsigi = new Date(
    now.getTime() - B.korumalar.ayni_saldirgan_tekrar_saldiri_saat * 3_600_000,
  );

  let enIyi: Hedef | null = null;
  for (const r of adaylar) {
    const sahip = r.owner;
    if (!sahip) continue;

    // Seviye farkı kilidi: çok altındakine saldırılmaz.
    if (lord.level - sahip.level >= B.korumalar.seviye_farki_kilidi) continue;

    const mesafe = olc(r.mapId);
    if (mesafe > N.oyuncuya_saldiri_en_cok_adim) continue;

    // Oyuncunun TEK bölgesini almak yok.
    const sahipBolgeSayisi = await tx.region.count({ where: { ownerLordId: sahip.id } });
    if (sahipBolgeSayisi < N.oyuncuya_saldiri_en_az_bolge) continue;

    // Aynı saldırgan aynı bölgeye 12 saatte bir.
    const sonSaldiri = await tx.battle.findFirst({
      where: { attackerLordId: lord.id, regionId: r.id, createdAt: { gte: tekrarEsigi } },
      select: { id: true },
    });
    if (sonSaldiri) continue;

    // Garnizon + surlar: kaybedecek savaşa girilmiyor.
    const garnizonRows = await tx.armyUnit.findMany({
      where: { locationType: 'region', locationId: String(r.id) },
    });
    const garnizon: Army = {};
    for (const g of garnizonRows) {
      garnizon[g.unitType as UnitType] = (garnizon[g.unitType as UnitType] ?? 0) + g.count;
    }
    if (!yeterMi(ordu, garnizon, bolgeTahkimati(r, sahip))) continue;

    if (!enIyi || mesafe < enIyi.mesafe) enIyi = { id: r.id, mesafe };
  }
  return enIyi;
}

/**
 * Bir worker turu: sırası gelmiş NPC lordlara sıra verir.
 *
 * Dünya başına tavan var (`dunya_basina_tur_basi_lord`): worker on
 * saniyede bir dönüyor ve yüz dünyalık bir sunucuda tavansız bir tur
 * uzayıp öteki işleri geciktirirdi.
 *
 * OYUNCUSUZ DÜNYADA NPC OYNAMAZ. Yalnız bir kaynak tasarrufu değil,
 * doğrusu da bu: NPC'lerin işi diyarı oyuncu için canlı tutmak; kimsenin
 * bakmadığı bir haritada savaşmaları yalnız veritabanını büyütür.
 */
export async function npcTuru(now = new Date()): Promise<NpcTurSonucu> {
  const sonuc: NpcTurSonucu = {
    oynayan: 0,
    isler: { egitim: 0, 'sahipsiz-fetih': 0, 'oyuncuya-saldiri': 0, bekledi: 0 },
  };
  if (!N.etkin) return sonuc;

  const sirasiGelenler = await prisma.lord.findMany({
    where: {
      isNpc: true,
      OR: [{ npcSonTur: null }, { npcSonTur: { lte: now } }],
      // Dünyada gerçek bir oyuncu olmalı.
      world: { lords: { some: { isNpc: false } } },
    },
    select: { id: true, worldId: true },
    orderBy: { npcSonTur: { sort: 'asc', nulls: 'first' } },
    take: 100,
  });

  const dunyaSayaci = new Map<string, number>();
  for (const l of sirasiGelenler) {
    const kac = dunyaSayaci.get(l.worldId) ?? 0;
    if (kac >= N.dunya_basina_tur_basi_lord) continue;
    dunyaSayaci.set(l.worldId, kac + 1);

    try {
      const is = await lordOynasin(l.id, now);
      sonuc.isler[is]++;
      sonuc.oynayan++;
    } catch (e) {
      // Bir NPC'nin turu patlarsa diğerleri devam etsin; NPC'ler oyunun
      // süsü, worker'ın omurgası değil.
      console.error(`NPC turu başarısız (${l.id}):`, e);
    }
  }
  return sonuc;
}

/** Test ve araçlar için: bir lordu NPC yapar ve sırasını hemen açar. */
export async function npcYap(lordId: string): Promise<void> {
  await prisma.lord.update({
    where: { id: lordId },
    data: { isNpc: true, npcSonTur: null },
  });
}

/** Araçların okuyabilmesi için NPC ayarları. */
export const npcAyarlari = N;
