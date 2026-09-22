/**
 * Eşya pazarının veritabanı tarafı (docs/19).
 *
 * Kural motorda (`packages/shared/src/esyaPazari.ts`): bant, eşleşme,
 * taban hareketi, vergi, engel metinleri. Burada kilit, emanet, kasa ve
 * olay kaydı var.
 *
 * ── KİLİT SIRASI — bu dosyanın en önemli kuralı ───────────────────
 *
 * Bir pazar işlemi İKİ lorda dokunuyor: satıcının kasası artıyor,
 * eşyanın sahibi değişiyor. Tek lordu kilitleyen `lordIslemi` burada
 * yetmiyor, ve iki lordu "önce ben, sonra karşı taraf" sırasıyla
 * kilitlemek kilitlenmeye (deadlock) açık: A ilan açarken B sipariş
 * verirse A kendini tutup B'yi, B kendini tutup A'yı bekler.
 *
 * Sıra her yerde aynı:
 *
 *   1. Grubun fiyat satırı (`grupKilitle`). Aynı gruptaki bütün defter
 *      değişiklikleri — ilan, sipariş, iptal, eşleşme, taban — bunun
 *      arkasında sıraya giriyor. Defter bu kilit altında okunuyor ve
 *      okunduğu gibi kalıyor.
 *   2. İşleme girecek lordlar, KİMLİK SIRASIYLA (`lordlariKilitle`).
 *      Önce plan (kim kiminle), sonra kilit, sonra doğrulama ve yazma.
 *
 * Lord kilidi ASLA grup kilidinden önce alınmıyor. Bir işlemin içinde
 * ikinci bir grup da kilitlenmiyor — defter süpürmesi ayrı bir işlem.
 */
import { randomInt, randomUUID } from 'node:crypto';
import {
  bantHesapla,
  bantta,
  basamakFiyati,
  baskiAdimi,
  capaAdimi,
  fiyatSinirlari,
  ilanaSiparisSec,
  kenarAdimi,
  kuyrukKurasi,
  tabanUygula,
  urunAdi,
  vergiHesapla,
  B,
  type Bant,
  type DefterEmri,
  type EquipSlot,
  type EsyaGrubu,
  type Rarity,
  type Urun,
} from '@lordlar/shared';
import type { EsyaIlani, OnSiparis } from '@prisma/client';
import { prisma, type Tx } from '../db.js';
import { GameError } from '../errors.js';
import { lordKilitle } from './kilit.js';
import { pushEvent } from './lord.js';

const P = B.esya_pazari;

export interface FiyatSatiri {
  id: string;
  worldId: string;
  tier: number;
  rarity: string;
  upgradeLevel: number;
  taban: number;
  sonIslemAt: Date | null;
  sonBaskiAt: Date;
  sonCapaAt: Date | null;
  createdAt: Date;
}

export function grubu(x: { tier: number; rarity: string; upgradeLevel: number }): EsyaGrubu {
  return { tier: x.tier, rarity: x.rarity as Rarity, upgradeLevel: x.upgradeLevel };
}

export function urunu(x: {
  slot: string;
  tier: number;
  rarity: string;
  upgradeLevel: number;
}): Urun {
  return { slot: x.slot as EquipSlot, ...grubu(x) };
}

function grupSarti(worldId: string, g: EsyaGrubu) {
  return { worldId, tier: g.tier, rarity: g.rarity, upgradeLevel: g.upgradeLevel };
}

/**
 * Kura zarı. `Math.random` değil: kuranın sonucunu tahmin edebilen biri
 * değerli eşyayı her seferinde alırdı.
 */
export function zar(): number {
  return randomInt(0, 2 ** 31) / 2 ** 31;
}

export function tl(n: number): string {
  return n.toLocaleString('tr-TR');
}

/**
 * Grubun fiyat satırını açar (yoksa tabanı formül değerinden) ve KİLİTLER.
 *
 * `INSERT … ON CONFLICT DO NOTHING`: iki oyuncu aynı ürüne ilk emri aynı
 * anda verirse ikinci satır açılmıyor, ikisi de aynı satırı bekliyor.
 */
export async function grupKilitle(tx: Tx, worldId: string, g: EsyaGrubu): Promise<FiyatSatiri> {
  const s = fiyatSinirlari(g);
  await tx.$executeRaw`
    INSERT INTO "EsyaFiyati" ("id", "worldId", "tier", "rarity", "upgradeLevel", "taban")
    VALUES (${randomUUID()}, ${worldId}, ${g.tier}, ${g.rarity}, ${g.upgradeLevel}, ${s.formulBasamak})
    ON CONFLICT ("worldId", "tier", "rarity", "upgradeLevel") DO NOTHING`;
  const [satir] = await tx.$queryRaw<FiyatSatiri[]>`
    SELECT * FROM "EsyaFiyati"
    WHERE "worldId" = ${worldId} AND "tier" = ${g.tier}
      AND "rarity" = ${g.rarity} AND "upgradeLevel" = ${g.upgradeLevel}
    FOR UPDATE`;
  if (!satir) throw new Error('Eşya pazarı: fiyat satırı açılamadı.');
  return satir;
}

/** Okuma için taban: satır yoksa formül değeri (satır AÇILMIYOR). */
export async function tabanOku(worldId: string, g: EsyaGrubu): Promise<number> {
  const satir = await prisma.esyaFiyati.findUnique({
    where: { worldId_tier_rarity_upgradeLevel: grupSarti(worldId, g) },
    select: { taban: true },
  });
  return satir?.taban ?? fiyatSinirlari(g).formulBasamak;
}

export function grubunBandi(grup: {
  taban: number;
  tier: number;
  rarity: string;
  upgradeLevel: number;
}): Bant {
  return bantHesapla(grup.taban, fiyatSinirlari(grubu(grup)));
}

/** Lordları KİMLİK SIRASIYLA kilitler — bkz. dosya başı. */
export async function lordlariKilitle(tx: Tx, idler: (string | null | undefined)[]): Promise<void> {
  const sirali = [...new Set(idler.filter((x): x is string => !!x))].sort();
  for (const id of sirali) await lordKilitle(tx, id);
}

/**
 * Grup kilitliyken, lord kilitlerinden sonra: planlanan emir hâlâ duruyor mu?
 *
 * Defter grup kilidi altında değişmiyor, ama hesap silme lordu (ve
 * emirlerini) kilide bakmadan siliyor. Silinmiş bir siparişle eşleşmek
 * eşyayı parasız teslim etmek olurdu.
 */
export function pazarDegisti(): GameError {
  return new GameError('Pazar bu arada değişti. Yeniden dene.', 409, 'PAZAR_DEGISTI');
}

export async function defterOku(
  tx: Tx,
  worldId: string,
  g: EsyaGrubu,
): Promise<{ ilanlar: EsyaIlani[]; siparisler: OnSiparis[] }> {
  const where = grupSarti(worldId, g);
  const ilanlar = await tx.esyaIlani.findMany({ where });
  const siparisler = await tx.onSiparis.findMany({ where });
  return { ilanlar, siparisler };
}

export function emir<T extends { id: string; lordId: string; basamak: number; sira: Date }>(
  x: T,
): DefterEmri & { kayit: T } {
  return { id: x.id, lordId: x.lordId, basamak: x.basamak, sira: x.sira.getTime(), kayit: x };
}

/** Eşleşmeye açık ilanlar: kayıt kuyruğundakiler kuraya kalıyor. */
export function eslesebilirIlanlar(ilanlar: EsyaIlani[], slot: string): EsyaIlani[] {
  return ilanlar.filter((i) => i.slot === slot && i.kuyrukBitis === null);
}

/* ── Takas ───────────────────────────────────────────────────────── */

export interface Takas {
  worldId: string;
  urun: Urun;
  itemId: string;
  saticiId: string;
  aliciId: string;
  basamak: number;
  kura: boolean;
  /**
   * Alıcının bu eşya için emanette tuttuğu altın. İşlem fiyatından
   * fazlaysa fark kasasına dönüyor (defter süpürmesinde ilanın fiyatından
   * yapılan işlem). Alıcı parayı zaten ödemişse = fiyat.
   */
  emanet: number;
  /** Olayı YAPAN lord: ona bildirim gitmiyor, ekranda sonucu görüyor. */
  aktorId: string | null;
}

export interface TakasSonucu {
  fiyat: number;
  vergi: number;
  net: number;
  tabanDegisti: boolean;
}

/**
 * Eşya el değiştirir. Çağıran: grup ve İKİ lord kilitli, alıcının parası
 * alınmış (emanet), sipariş kaydı çağıranın işi.
 */
export async function takasYap(
  tx: Tx,
  t: Takas,
  grup: FiyatSatiri,
  simdi: Date,
): Promise<TakasSonucu> {
  const fiyat = basamakFiyati(t.basamak);
  const { vergi, net } = vergiHesapla(fiyat);

  await tx.esyaIlani.deleteMany({ where: { itemId: t.itemId } });
  await tx.item.update({ where: { id: t.itemId }, data: { lordId: t.aliciId, equipped: false } });
  await tx.lord.update({ where: { id: t.saticiId }, data: { pazarKasasi: { increment: net } } });
  if (t.emanet > fiyat) {
    await tx.lord.update({
      where: { id: t.aliciId },
      data: { pazarKasasi: { increment: t.emanet - fiyat } },
    });
  }
  await tx.esyaIslemi.create({
    data: {
      worldId: t.worldId,
      slot: t.urun.slot,
      tier: t.urun.tier,
      rarity: t.urun.rarity,
      upgradeLevel: t.urun.upgradeLevel,
      basamak: t.basamak,
      fiyat,
      vergi,
      saticiId: t.saticiId,
      aliciId: t.aliciId,
      kura: t.kura,
      createdAt: simdi,
    },
  });

  const s = fiyatSinirlari(t.urun);
  const yeni = tabanUygula(grup.taban, kenarAdimi(t.basamak, bantHesapla(grup.taban, s)), s);
  const tabanDegisti = yeni !== grup.taban;
  await tx.esyaFiyati.update({
    where: { id: grup.id },
    data: { taban: yeni, sonIslemAt: simdi },
  });
  grup.taban = yeni;
  grup.sonIslemAt = simdi;

  const ad = urunAdi(t.urun);
  await olay(
    tx,
    t.saticiId,
    'esya_satildi',
    {
      mesaj: `${ad} satıldı: ${tl(fiyat)} altın. Vergi ${tl(vergi)}, kasana ${tl(net)} altın girdi.`,
      fiyat,
      vergi,
      net,
    },
    t.aktorId !== t.saticiId,
  );
  await olay(
    tx,
    t.aliciId,
    'esya_alindi',
    {
      mesaj: t.kura
        ? `Kurayı kazandın: ${ad} senin. ${tl(fiyat)} altın ödendi.`
        : `${ad} senin. ${tl(fiyat)} altın ödendi.`,
      fiyat,
    },
    t.aktorId !== t.aliciId,
  );
  return { fiyat, vergi, net, tabanDegisti };
}

/**
 * Olay kaydı. Bildirim yalnız işlemi YAPMAYAN tarafa: sonucu zaten
 * ekranında gören oyuncunun telefonu ayrıca titremesin.
 */
async function olay(
  tx: Tx,
  lordId: string,
  kind: string,
  payload: Record<string, unknown>,
  bildir: boolean,
): Promise<void> {
  if (bildir) await pushEvent(lordId, kind, payload, tx);
  else await tx.event.create({ data: { lordId, kind, payload: payload as object } });
}

/**
 * Taban kaydıktan sonra: bant dışında kalan emrin sahibine BİR KEZ haber.
 *
 * Emir silinmiyor — oyuncu fiyatını tek dokunuşla güncelleyebilsin ve
 * emanetteki altını sessizce geri almak zorunda kalmasın. Banda geri
 * dönen emrin bayrağı iniyor: bir sonraki kaymada yine haber alsın.
 */
export async function bantDisiniBildir(tx: Tx, grup: FiyatSatiri): Promise<void> {
  const g = grubu(grup);
  const bant = grubunBandi(grup);
  const { ilanlar, siparisler } = await defterOku(tx, grup.worldId, g);
  const kayitlar = [
    ...ilanlar.map((e) => ({ e, tur: 'ilan' as const })),
    ...siparisler.map((e) => ({ e, tur: 'siparis' as const })),
  ];
  for (const { e, tur } of kayitlar) {
    const icinde = bantta(e.basamak, bant);
    if (icinde === !e.bantDisiBildirildi) continue;
    const data = { bantDisiBildirildi: !icinde };
    if (tur === 'ilan') await tx.esyaIlani.update({ where: { id: e.id }, data });
    else await tx.onSiparis.update({ where: { id: e.id }, data });
    if (!icinde) {
      await pushEvent(
        e.lordId,
        'pazar_bant_disi',
        {
          // İki tam cümle, "ilanın/ön siparişin" diye tek kelime değil:
          // çevirmen parçayı bağlamsız görürse cümle kurulamıyor.
          mesaj:
            tur === 'ilan'
              ? `${urunAdi(urunu(e))} ilanın fiyat bandının dışında kaldı; bu hâliyle satılmaz. Pazardan fiyatını güncelleyebilirsin.`
              : `${urunAdi(urunu(e))} ön siparişin fiyat bandının dışında kaldı; bu hâliyle eşleşmez. Pazardan fiyatını güncelleyebilirsin.`,
        },
        tx,
      );
    }
  }
}

/* ── Defter süpürmesi ────────────────────────────────────────────── */

/**
 * Taban kaydıktan sonra birbirine yetişen emirleri eşleştirir.
 *
 * Neden gerekiyor: bant dışına düşen emir eşleşmiyor. Taban geri
 * döndüğünde o emir ile bu arada verilmiş bir karşı emir birbirine
 * yetişmiş olarak defterde durabiliyor — ikisi de beklerken kimse
 * alışveriş etmiyordu.
 *
 * AYRI işlem: süpürme başka lordları da kilitliyor ve çağıranın zaten
 * tuttuğu kilitlerin üstüne almak sırayı bozardı (dosya başı). Fiyat,
 * iki emirden ÖNCE verilmişinki — defterde ilk bekleyen fiyatı koymuştu.
 */
export async function defteriSupur(worldId: string, g: EsyaGrubu): Promise<number> {
  let toplam = 0;
  for (let tur = 0; tur < 5; tur++) {
    const n = await prisma.$transaction(async (tx) => {
      const simdi = new Date();
      const grup = await grupKilitle(tx, worldId, g);
      const s = fiyatSinirlari(g);
      const { ilanlar, siparisler } = await defterOku(tx, worldId, g);
      const bekleyenIlan = ilanlar.filter((i) => i.kuyrukBitis === null);
      const bekleyenSiparis = [...siparisler];
      const plan: { ilan: EsyaIlani; siparis: OnSiparis; basamak: number }[] = [];
      let taban = grup.taban;

      for (;;) {
        const bant = bantHesapla(taban, s);
        let bulunan: { ilan: EsyaIlani; siparis: OnSiparis } | null = null;
        const sirali = bekleyenIlan
          .filter((i) => bantta(i.basamak, bant))
          .sort((a, b) => a.sira.getTime() - b.sira.getTime());
        for (const ilan of sirali) {
          const aday = ilanaSiparisSec(
            bekleyenSiparis.filter((x) => x.slot === ilan.slot).map(emir),
            ilan.basamak,
            bant,
            zar,
            ilan.lordId,
          );
          if (aday) {
            bulunan = { ilan, siparis: aday.kayit };
            break;
          }
        }
        if (!bulunan) break;
        const { ilan, siparis } = bulunan;
        const basamak = ilan.sira <= siparis.sira ? ilan.basamak : siparis.basamak;
        plan.push({ ilan, siparis, basamak });
        bekleyenIlan.splice(bekleyenIlan.indexOf(ilan), 1);
        bekleyenSiparis.splice(bekleyenSiparis.indexOf(siparis), 1);
        taban = tabanUygula(taban, kenarAdimi(basamak, bant), s);
      }
      if (plan.length === 0) return 0;

      await lordlariKilitle(
        tx,
        plan.flatMap((p) => [p.ilan.lordId, p.siparis.lordId]),
      );
      let yapilan = 0;
      for (const p of plan) {
        const hala = await tx.onSiparis.findUnique({ where: { id: p.siparis.id } });
        const ilanHala = await tx.esyaIlani.findUnique({ where: { id: p.ilan.id } });
        if (!hala || !ilanHala) continue;
        await tx.onSiparis.delete({ where: { id: p.siparis.id } });
        await takasYap(
          tx,
          {
            worldId,
            urun: urunu(p.ilan),
            itemId: p.ilan.itemId,
            saticiId: p.ilan.lordId,
            aliciId: p.siparis.lordId,
            basamak: p.basamak,
            kura: false,
            emanet: p.siparis.fiyat,
            aktorId: null,
          },
          grup,
          simdi,
        );
        yapilan++;
      }
      await bantDisiniBildir(tx, grup);
      return yapilan;
    });
    toplam += n;
    if (n === 0) break;
  }
  return toplam;
}

/* ── İşçi işleri ─────────────────────────────────────────────────── */

/**
 * Süresi dolan kayıt kuyruklarının kurası.
 *
 * En yüksek fiyatlı uygun siparişler arasından biri; kimse yoksa ilan
 * sıradan bir ilana dönüşüyor ve ilk uygun siparişe satılıyor.
 */
export async function kuyruklariCek(simdi = new Date()): Promise<number> {
  const dolanlar = await prisma.esyaIlani.findMany({
    where: { kuyrukBitis: { lte: simdi } },
    select: { id: true },
    take: 50,
  });
  let satilan = 0;
  for (const { id } of dolanlar) {
    try {
      satilan += await kuyrukCek(id, simdi);
    } catch (e) {
      console.error(`Kayıt kuyruğu çekilemedi (${id}):`, e);
    }
  }
  return satilan;
}

async function kuyrukCek(id: string, simdi: Date): Promise<number> {
  const sonuc = await prisma.$transaction(async (tx) => {
    const ilk = await tx.esyaIlani.findUnique({ where: { id } });
    if (!ilk) return null;
    const g = grubu(ilk);
    const grup = await grupKilitle(tx, ilk.worldId, g);
    const ilan = await tx.esyaIlani.findUnique({ where: { id } });
    if (!ilan || !ilan.kuyrukBitis || ilan.kuyrukBitis > simdi) return null;

    const bant = grubunBandi(grup);
    const siparisler = await tx.onSiparis.findMany({
      where: { ...grupSarti(ilan.worldId, g), slot: ilan.slot },
    });
    const kazanan = kuyrukKurasi(siparisler.map(emir), ilan.basamak, bant, zar, ilan.lordId);
    await lordlariKilitle(tx, [ilan.lordId, kazanan?.lordId]);
    if (!kazanan) {
      await tx.esyaIlani.update({ where: { id }, data: { kuyrukBitis: null } });
      return { g, worldId: ilan.worldId, satildi: false, tabanDegisti: false };
    }
    const siparis = await tx.onSiparis.findUnique({ where: { id: kazanan.id } });
    if (!siparis) throw pazarDegisti();
    await tx.onSiparis.delete({ where: { id: siparis.id } });
    const t = await takasYap(
      tx,
      {
        worldId: ilan.worldId,
        urun: urunu(ilan),
        itemId: ilan.itemId,
        saticiId: ilan.lordId,
        aliciId: siparis.lordId,
        basamak: siparis.basamak,
        kura: true,
        emanet: siparis.fiyat,
        aktorId: null,
      },
      grup,
      simdi,
    );
    if (t.tabanDegisti) await bantDisiniBildir(tx, grup);
    return { g, worldId: ilan.worldId, satildi: true, tabanDegisti: t.tabanDegisti };
  });
  if (!sonuc) return 0;
  // Kuyruktan çıkan ilan artık sıradan: bekleyen bir siparişe yetişiyorsa
  // hemen eşleşsin. Taban kaydıysa zaten süpürülmeli.
  await defteriSupur(sonuc.worldId, sonuc.g);
  return sonuc.satildi ? 1 : 0;
}

/**
 * Saatlik taban güncellemesi: defter baskısı, yoksa çapa.
 *
 * Her grup saatte en fazla bir kez değerlendiriliyor (`sonBaskiAt`).
 * Tur başına sınırlı sayıda grup: binlerce grup tek turda işlenirken
 * işçinin öteki işleri (savaş, kuyruk) beklemesin.
 */
export async function tabanlariGuncelle(simdi = new Date(), tavan = 100): Promise<number> {
  const esik = new Date(simdi.getTime() - P.baski_araligi_dk * 60_000);
  const vadesi = await prisma.esyaFiyati.findMany({
    where: { sonBaskiAt: { lte: esik } },
    orderBy: { sonBaskiAt: 'asc' },
    take: tavan,
  });
  let degisen = 0;
  for (const v of vadesi) {
    try {
      degisen += await tabaniGuncelle(v, esik, simdi);
    } catch (e) {
      console.error(`Taban güncellenemedi (${v.id}):`, e);
    }
  }
  return degisen;
}

async function tabaniGuncelle(
  v: { worldId: string; tier: number; rarity: string; upgradeLevel: number },
  esik: Date,
  simdi: Date,
): Promise<number> {
  const g = grubu(v);
  const degisti = await prisma.$transaction(async (tx) => {
    const grup = await grupKilitle(tx, v.worldId, g);
    if (grup.sonBaskiAt > esik) return false;
    const s = fiyatSinirlari(g);
    const bant = bantHesapla(grup.taban, s);
    const { ilanlar, siparisler } = await defterOku(tx, v.worldId, g);
    const sira = (x: { basamak: number; sira: Date }) => ({
      basamak: x.basamak,
      sira: x.sira.getTime(),
    });
    const baski = baskiAdimi({
      ilanlar: ilanlar.map(sira),
      siparisler: siparisler.map(sira),
      bant,
      simdi: simdi.getTime(),
    });
    const capa =
      baski === 0
        ? capaAdimi({
            taban: grup.taban,
            formulBasamak: s.formulBasamak,
            sonIslem: (grup.sonIslemAt ?? grup.createdAt).getTime(),
            sonCapa: grup.sonCapaAt?.getTime() ?? null,
            simdi: simdi.getTime(),
          })
        : 0;
    const yeni = tabanUygula(grup.taban, baski || capa, s);
    await tx.esyaFiyati.update({
      where: { id: grup.id },
      data: {
        taban: yeni,
        sonBaskiAt: simdi,
        ...(capa !== 0 ? { sonCapaAt: simdi } : {}),
      },
    });
    if (yeni === grup.taban) return false;
    grup.taban = yeni;
    await bantDisiniBildir(tx, grup);
    return true;
  });
  if (!degisti) return 0;
  await defteriSupur(v.worldId, g);
  return 1;
}

/**
 * Diyar birleşmesi: konuk diyarın pazarı kapanıyor.
 *
 * İki diyarın fiyatları ayrı yaşadı; birini ötekine eklemek hiçbir
 * işlemin görmediği bir taban uydurmak olurdu. Emirler oyuncunun LEHİNE
 * geri veriliyor (birleşmenin genel kuralı): ilandaki eşya envantere,
 * siparişteki altın kasaya. İşlem geçmişi ev sahibine taşınıyor.
 */
export async function konukPazariniKapat(tx: Tx, guestId: string, hostId: string): Promise<number> {
  const siparisler = await tx.onSiparis.findMany({ where: { worldId: guestId } });
  for (const s of siparisler) {
    await tx.lord.update({
      where: { id: s.lordId },
      data: { pazarKasasi: { increment: s.fiyat } },
    });
  }
  await tx.onSiparis.deleteMany({ where: { worldId: guestId } });
  const ilan = await tx.esyaIlani.deleteMany({ where: { worldId: guestId } });
  await tx.esyaFiyati.deleteMany({ where: { worldId: guestId } });
  await tx.esyaIslemi.updateMany({ where: { worldId: guestId }, data: { worldId: hostId } });
  return siparisler.length + ilan.count;
}
