/**
 * Akın çözümü: NPC grubuna gidilir, savaşılır, dönülür — tek adımda.
 *
 * PvP yürüyüşü iki aşamalı (`march.ts`): önce saldırı çözülür, sonra bir
 * dönüş yürüyüşü yaratılır. Sebebi bölgenin el değiştirmesi — arada
 * gerçekten bir şey oluyor ve oyuncu onu görmeli. Akında bölge el
 * değiştirmiyor; iki aşama yapmak oyuncuya iki bekleyiş, iki bildirim
 * verip hiçbir karar kazandırmazdı.
 *
 * SAVAŞ AYNI MOTOR. `simulateBattle`, aynı dizilim, aynı taktik, aynı
 * kayıp formülü, aynı hastane. "Kolay mod" ayrı bir hesap değil: akın,
 * oyuncunun ordusunu öğrendiği yer ve öğrendiği şey PvP'de geçerli
 * olmalı.
 */
import {
  UNIT_TYPES,
  akinEkipmanSansi,
  akinGarnizonu,
  akinOdulu,
  akinXp,
  createRng,
  rollCraftRarity,
  simulateBattle,
  yaraliVarMi,
  type Army,
  type Rarity,
  type Side,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { buildSide, npcSide } from './march.js';
import { grantXp, pushEvent, tickLord } from './lord.js';
import { addUnitsHome, hastaneyeYatir } from './queue.js';

/** Json alanından ordu okur; bozuk değer birimi düşürür, patlamaz. */
function toArmy(value: unknown): Army {
  const raw = (value ?? {}) as Record<string, unknown>;
  const army: Army = {};
  for (const t of UNIT_TYPES) {
    const n = Number(raw[t] ?? 0);
    if (Number.isFinite(n) && n > 0) army[t] = Math.floor(n);
  }
  return army;
}

/** Kayıtlı düzen; yoksa savaş motoru varsayılanı kullanıyor. */
function akinDuzeni(value: unknown): Side['duzen'] | undefined {
  const d = value as Side['duzen'] | null;
  return d && typeof d === 'object' ? d : undefined;
}

/** Ekipman düşürülürken hangi slotlar çekilebilir. */
const SLOTLAR = ['silah', 'kalkan', 'zirh', 'miğfer', 'yüzük', 'sancak'] as const;

/**
 * Bir akını çözer. `true` = bu çağrı çözdü, `false` = başkası aldı.
 *
 * Koşullu `updateMany` sayesinde idempotent: iki worker aynı akını iki
 * kez ödüllendiremiyor. `march.ts`teki desenin aynısı; orada bu koruma
 * olmasaydı yavaş bir işlemde ganimet iki kez yazılırdı.
 */
export async function resolveAkin(akinId: string): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const claimed = await tx.akin.updateMany({
        where: { id: akinId, resolved: false },
        data: { resolved: true },
      });
      if (claimed.count === 0) return false;

      const akin = await tx.akin.findUniqueOrThrow({ where: { id: akinId } });
      const ordu = toArmy(akin.army);

      // Akındaki birim satırları temizleniyor: asker artık ya evde ya
      // hastanede olacak.
      await tx.armyUnit.deleteMany({ where: { locationType: 'akin', locationId: akinId } });

      const generalKeys = (akin.generalIds as string[]) ?? [];
      const { side: saldiran } = await buildSide(
        akin.lordId,
        ordu,
        false,
        0,
        generalKeys,
        tx,
        akinDuzeni(akin.duzen),
      );

      /*
       * Garnizon KAYITTAN DEĞİL tablodan türetiliyor.
       *
       * Akın başlarken garnizonu satıra yazsaydık, denge değişikliği
       * yoldaki akınları eski sayılarla bırakırdı ve iki oyuncu aynı
       * gruba farklı garnizonla çarpardı. Formül tek yerde
       * (`shared/akin.ts`) ve herkes aynı anda aynı düşmanı görüyor.
       *
       * Tahkimat 0: akın kampı bir kale değil, çadır ve barikat.
       */
      const garnizon = akinGarnizonu(akin.haritaKey, akin.grupNo);
      const savunan = npcSide(garnizon, 0);

      const lord = await tx.lord.findUniqueOrThrow({
        where: { id: akin.lordId },
        select: { kurnazlik: true },
      });

      const sonuc = simulateBattle(saldiran, savunan, akin.seed, {
        defenderStore: { altin: 0, demir: 0, erzak: 0 },
        attackerCunning: lord.kurnazlik,
        // Akın TOPRAK VERMEZ (docs/12 §6): burası kaynak ve ekipman
        // kapısı. Fetih açık olsaydı PvP'nin tek sebebi kalmazdı.
        canCapture: false,
      });

      const kazanildi = sonuc.winner === 'attacker';
      const kalanlar = sonuc.attackerSurvivors;
      const yarali = sonuc.yaraliDonen.saldiran ?? {};

      // --- Ordu eve dönüyor: sağlam eve, yaralı hastaneye ---
      const kuyrukId = yaraliVarMi(yarali) ? await hastaneyeYatir(akin.lordId, yarali, tx) : null;
      for (const t of UNIT_TYPES) {
        const gelen = kalanlar[t] ?? 0;
        const yaraliAdet = Math.min(gelen, yarali[t] ?? 0);
        const saglam = gelen - yaraliAdet;
        if (saglam > 0) await addUnitsHome(akin.lordId, t, saglam, tx);
        if (yaraliAdet > 0 && kuyrukId) {
          await tx.armyUnit.create({
            data: {
              lordId: akin.lordId,
              unitType: t,
              count: yaraliAdet,
              locationType: 'hastane',
              locationId: kuyrukId,
            },
          });
        }
      }

      /*
       * Ödül YALNIZ kazanınca.
       *
       * Kaybedene de kaynak vermek akını risksiz bir sağmal hâline
       * getirirdi: oyuncu en zor gruba boş orduyla gidip ganimeti
       * toplardı. Kaybın karşılığı zaten var — asker gitti, kalanı
       * hastanede.
       */
      let odul = { altin: 0, demir: 0, erzak: 0 };
      let dusenItemId: string | null = null;
      if (kazanildi) {
        odul = akinOdulu(akin.haritaKey, akin.grupNo);
        await tickLord(akin.lordId, new Date(), tx);
        await tx.lord.update({
          where: { id: akin.lordId },
          data: {
            altin: { increment: odul.altin },
            demir: { increment: odul.demir },
            erzak: { increment: odul.erzak },
          },
        });
        await grantXp(akin.lordId, akinXp(akin.grupNo), tx);

        /*
         * İlk KAZANILAN akının damgası.
         *
         * Rehberin "ilk akınına çık" aşaması buna bakıyor. Bir kez
         * konuyor ve bir daha dönmüyor: kıdemli bir lord ordusunu
         * kaybedip sıfıra dönse bile kendini o aşamada bulmasın
         * (`rehberBittiAt` ile aynı gerekçe).
         */
        await tx.lord.updateMany({
          where: { id: akin.lordId, ilkAkinAt: null },
          data: { ilkAkinAt: new Date() },
        });

        /*
         * Ekipman ŞANSA bağlı ve zar AKININ TOHUMUNDAN atılıyor.
         *
         * Aynı akın iki kez çözülürse (worker çakışması, elle yeniden
         * çalıştırma) aynı sonucu vermeli. `Math.random()` kullansaydık
         * rapor ile envanter bir gün ayrışırdı ve hangisinin doğru
         * olduğu belli olmazdı.
         */
        const sans = akinEkipmanSansi(akin.haritaKey, akin.grupNo);
        const rng = createRng(`akin-odul-${akin.id}`);
        if (rng.next() < sans.ihtimal) {
          const slot = SLOTLAR[Math.floor(rng.next() * SLOTLAR.length)] ?? 'silah';
          const item = await tx.item.create({
            data: {
              lordId: akin.lordId,
              slot,
              tier: sans.tier,
              rarity: rollCraftRarity(sans.tier, rng) as Rarity,
              upgradeLevel: 0,
              equipped: false,
            },
          });
          dusenItemId = item.id;
        }
      }

      await tx.akin.update({
        where: { id: akinId },
        data: {
          kazanildi,
          yarali: yarali as object,
          odul: odul as object,
          dusenItemId,
          /*
           * Tur turu kayıt SAKLANIYOR: rapor bunun üzerine kuruluyor.
           * `duzenRaporu` de içeride, çünkü "neden kaybettim" sorusunun
           * cevabı çoğu zaman dizilimde (docs/09 K2).
           */
          log: {
            rounds: sonuc.rounds,
            duzenRaporu: sonuc.duzenRaporu,
            attackerLosses: sonuc.attackerLosses,
            defenderLosses: sonuc.defenderLosses,
            defenderSurvivors: sonuc.defenderSurvivors,
            garnizon,
          } as object,
        },
      });

      await pushEvent(
        akin.lordId,
        kazanildi ? 'akin_kazandin' : 'akin_kaybettin',
        {
          mesaj: kazanildi
            ? `Akın başarılı: ${odul.altin} altın, ${odul.demir} demir${
                dusenItemId ? ' ve bir ekipman' : ''
              } getirdin.`
            : 'Akın başarısız: grubu düşüremedin, kalan askerin döndü.',
          akinId,
        },
        tx,
      );

      return true;
    },
    { timeout: 20_000 },
  );
}

/**
 * Bu LORDUN vadesi gelmiş akınlarını okuma anında kapatır.
 *
 * `gecikmisYuruyusleriCoz`in eşi ve aynı gerekçe (services/gecikmis.ts):
 * tek servisli dağıtımda API uykuya dalınca worker da uyuyor ve varmış
 * bir akını kimse çözmüyor. Oyuncu ekranı açtığında ordusunu sonsuza
 * kadar sahada görürdü.
 */
export async function gecikmisAkinlariCoz(lordId: string, now = new Date()): Promise<number> {
  const AZAMI = 20;
  const bekleyen = await prisma.akin.findMany({
    where: { lordId, resolved: false, arriveAt: { lte: now } },
    orderBy: { arriveAt: 'asc' },
    take: AZAMI,
    select: { id: true },
  });

  let sayi = 0;
  for (const a of bekleyen) {
    try {
      if (await resolveAkin(a.id)) sayi++;
    } catch (e) {
      // Tek bir akın çözülemezse /akin çökmemeli.
      console.error(`Akın çözülemedi (${a.id}):`, e);
    }
  }
  return sayi;
}

/**
 * Lordun akın vuruşları: `harita:grup` → son düşürme zamanı.
 *
 * Yenilenme AYRI BİR SÜTUN DEĞİL, bundan türüyor (docs/12 §6). Ayrı
 * sütun tutmak onu güncelleyecek bir zamanlayıcı gerektirirdi ve
 * zamanlayıcı uyuduğunda harita yanlış görünürdü.
 */
export async function akinVuruslari(
  lordId: string,
  tx: Tx = prisma,
): Promise<Record<string, Date>> {
  const satirlar = await tx.akin.findMany({
    where: { lordId, resolved: true, kazanildi: true },
    select: { haritaKey: true, grupNo: true, arriveAt: true },
    orderBy: { arriveAt: 'desc' },
  });
  const cikti: Record<string, Date> = {};
  for (const s of satirlar) {
    const anahtar = `${s.haritaKey}:${s.grupNo}`;
    // `orderBy desc` sayesinde ilk gördüğümüz EN SON vuruş.
    if (!cikti[anahtar]) cikti[anahtar] = s.arriveAt;
  }
  return cikti;
}

/** Sahadaki (henüz dönmemiş) akınlar. */
export async function sahadakiAkinlar(lordId: string, tx: Tx = prisma) {
  return tx.akin.findMany({
    where: { lordId, resolved: false },
    orderBy: { arriveAt: 'asc' },
  });
}

/** Bir birimin akında olup olmadığını sayan yardımcı — komuta yeri için. */
export function akindakiOrdu(satirlar: { unitType: string; count: number }[]): Army {
  const ordu: Army = {};
  for (const s of satirlar) ordu[s.unitType as UnitType] = (ordu[s.unitType as UnitType] ?? 0) + s.count;
  return ordu;
}
