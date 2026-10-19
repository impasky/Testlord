/**
 * Haritanın oyuncuya göre DEĞİŞEN hâli — `/map` ve `/harita` aynı hesabı
 * kullanıyor.
 *
 * Bölgenin değişmeyen bilgisi (ad, tür, konum, komşular) bellekte
 * (`dunyaBolgeleri.ts`). Burada yalnız değişenler: seviye, sahip, kalkan,
 * pay, sınır, mesafe, tahkimat — dünyanın bütün bölgeleri için, bellekteki
 * listenin SIRASIYLA. İki uç bunu iki biçimde yazıyor:
 *
 *   /map      Eski, tam biçim: her bölge bütün alanlarıyla (~900 KB). Eski
 *             uygulamalar ve test araçları bunu okuyor.
 *   /harita   Yeni, kısa biçim (~28 KB): değişen alanlar dizi olarak; değişmeyen
 *             liste ayrı bir adreste, tarayıcı onu bir kez indirip saklıyor.
 *
 * İkisinin hesabı tek olsun diye burada: bir alanın biri için doğru öbürü
 * için yanlış olması, bu projenin tekrar eden hatası.
 */
import { ayniIttifaktaMi, maxRegions } from '@lordlar/shared';
import { prisma } from '../db.js';
import { dunyaBolgeleri, dunyaBolgeleriniUnut, type DunyaBolgeleri } from './dunyaBolgeleri.js';
import { gecikmisleriKapat } from './gecikmis.js';
import { garnizonPayGirdileri } from './gelir.js';
import { onerilenHedef, type HedefOnerisi } from './hedef.js';
import { mesafeOlcerHazir, sinirOlcerHazir } from './mesafe.js';
import { paktliIttifaklar } from './pakt.js';
import { bolgeTahkimati } from './region.js';

/** Bölgenin sahibine ya da kalkanına bağlı alanları — çoğu bölgede yok. */
export interface OzelBolge {
  owner: { id: string; name: string; level: number } | null;
  isMine: boolean;
  /** Bu bölgenin gelirinden bana düşen pay — garnizonum yoksa null. */
  pay: { oran: number; yer: number; toplamYer: number } | null;
  shielded: boolean;
  /** Pakt: saldırılamaz ama müttefik de değil. */
  paktli: boolean;
  /** İttifak arkadaşı: saldırılamaz, takviye gönderilebilir (docs/23). */
  muttefik: boolean;
}

export interface HaritaDurumu {
  /** Bölge listesi dışındaki alanlar — iki biçimde de aynı. */
  govde: {
    homeBolgeId: number;
    ulke: string | null;
    maxRegions: number;
    ittifakHedefi: { regionId: number; not: string | null; etiket: string } | null;
    oneri: HedefOnerisi | null;
  };
  dunya: DunyaBolgeleri;
  /** Aşağıdaki diziler `dunya.liste` sırasıyla. */
  level: number[];
  /** Sınır kuralı izin veriyor mu (docs/27): kendi ülkem ya da komşum. */
  sinirda: boolean[];
  /** En yakın toprağımdan uzaklık (docs/11 §1.2 H1). */
  distance: number[];
  fortressBonus: number[];
  /** Listedeki sırasıyla; yalnız sahipli, kalkanlı ya da payım olan bölgeler. */
  ozel: Map<number, OzelBolge>;
}

export async function haritaDurumu(lordId: string): Promise<HaritaDurumu> {
  // Öneri ORDUYA bakarak hesaplanıyor: biten eğitim henüz orduya
  // katılmamışsa "ordun yetmiyor" der ve omurga oyuncuyu olmayan bir
  // işe yollar. Aynı yarış `/me` ve `/army`'de de vardı.
  await gecikmisleriKapat(lordId);
  const me = await prisma.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: { worldId: true, homeBolgeId: true, level: true, allianceId: true, ulke: true },
  });
  const simdi = new Date();

  /*
   * Değişen sütunlar yalnız gerektiği kadar: seviye bütün dünya için tek
   * satırlık bir dizi, sahip ve kalkan yalnız sahipli ya da kalkanlı
   * bölgeler için. 3.047 satırı bütün sütunlarıyla okumak istek başına
   * ~130 ms CPU'ydu; bu ikisi ~2 ms.
   */
  const [dunyaIlk, seviyeSatiri, ozelSatirlar, oneri, ittifak, paktlilar, payGirdileri] =
    await Promise.all([
      dunyaBolgeleri(me.worldId),
      prisma.$queryRaw<{ n: number; s: string | null }[]>`
        SELECT count(*)::int AS n, string_agg(level::text, ',' ORDER BY id) AS s
        FROM "Region" WHERE "worldId" = ${me.worldId}`,
      prisma.region.findMany({
        where: {
          worldId: me.worldId,
          OR: [{ ownerLordId: { not: null } }, { shieldUntil: { gt: simdi } }],
        },
        select: {
          id: true,
          ownerLordId: true,
          shieldUntil: true,
          owner: {
            // binalar + baskentBolgeId: surların tahkimata kattığı ek
            // haritada da görünmeli, yoksa önizleme ile savaş ayrışır.
            select: {
              id: true,
              name: true,
              level: true,
              binalar: true,
              baskentBolgeId: true,
              allianceId: true,
            },
          },
        },
      }),
      onerilenHedef(lordId),
      // Ortak hedef HARİTADA görünmeli: ittifak ekranında duran bir hedef,
      // oyuncunun saldırıya karar verdiği yerde yok demektir.
      me.allianceId
        ? prisma.alliance.findUnique({
            where: { id: me.allianceId },
            select: { targetRegionId: true, targetNote: true, tag: true },
          })
        : Promise.resolve(null),
      // Paktlı ittifaklar bir kez okunuyor: bölge başına ayrı sorgu
      // yüzlerce sorgu demekti.
      paktliIttifaklar(me.allianceId),
      /*
       * GARNİZON PAYLARI: gelir sahipliğe değil garnizona bağlı
       * (docs/16 §6). Arayüz bölge kartındaki geliri kendisi hesaplıyor;
       * payı göndermezsek oyuncuya ALMADIĞI bir sayı yazardı.
       */
      garnizonPayGirdileri(lordId),
    ]);

  // Bölge sayısı ancak dünya tazelenince değişir; o zaman bellekteki
  // kayıt da eskimiştir: bir kez yeniden kur, sıra yine eşleşsin.
  let dunya = dunyaIlk;
  if (seviyeSatiri[0]?.n !== dunya.liste.length) {
    dunyaBolgeleriniUnut(me.worldId);
    dunya = await dunyaBolgeleri(me.worldId);
  }
  const { liste, graf } = dunya;
  const level = (seviyeSatiri[0]?.s ?? '').split(',').map(Number);
  const satirIle = new Map(ozelSatirlar.map((r) => [r.id, r]));
  const paylar = new Map(
    payGirdileri.map((p) => [p.regionId, { oran: p.oran, yer: p.yer, toplamYer: p.toplamYer }]),
  );

  const topraklarim = ozelSatirlar
    .filter((r) => r.ownerLordId === lordId)
    .map((r) => dunya.idIle.get(r.id)?.mapId)
    .filter((x): x is number => x !== undefined);
  const olc = mesafeOlcerHazir(graf, me.homeBolgeId, topraklarim);
  // Sınır kuralı (docs/27) — saldırı ucuyla aynı işlev.
  const sinir = sinirOlcerHazir(graf, me.ulke, me.homeBolgeId, topraklarim);

  const ozel = new Map<number, OzelBolge>();
  const fortressBonus = liste.map((b, i) => {
    const o = satirIle.get(b.id);
    const sahip = o?.owner ?? null;
    const pay = paylar.get(b.id) ?? null;
    if (o || pay) {
      const ittifaki = sahip?.allianceId ?? null;
      ozel.set(i, {
        owner: sahip ? { id: sahip.id, name: sahip.name, level: sahip.level } : null,
        isMine: o?.ownerLordId === lordId,
        pay,
        shielded: o?.shieldUntil ? o.shieldUntil > simdi : false,
        paktli: sahip ? paktlilar.has(ittifaki ?? '') : false,
        muttefik: sahip ? ayniIttifaktaMi(me.allianceId, ittifaki) : false,
      });
    }
    return bolgeTahkimati({ type: b.type, level: level[i] ?? 1, mapId: b.mapId }, sahip);
  });

  return {
    govde: {
      // Kampın çıpası: hangi bölgenin yanında durduğu. Harita bunu
      // "burası senin kampın" işaretini koymak için kullanıyor.
      homeBolgeId: dunya.mapIdIle.get(me.homeBolgeId)?.id ?? liste[0]?.id ?? 0,
      /** Lordun seçtiği ülke (docs/27); null: henüz seçmedi. */
      ulke: me.ulke,
      maxRegions: maxRegions(me.level),
      ittifakHedefi: ittifak?.targetRegionId
        ? { regionId: ittifak.targetRegionId, not: ittifak.targetNote, etiket: ittifak.tag }
        : null,
      // Oyuncu haritaya baktığında "neye saldırayım" sorusunun cevabı
      // hazır olsun; hedef seçmek bir bulmaca olmamalı.
      oneri,
    },
    dunya,
    level,
    sinirda: liste.map((b) => sinir(b)),
    distance: liste.map((b) => olc(b.mapId)),
    fortressBonus,
    ozel,
  };
}
