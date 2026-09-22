/**
 * Eşya pazarı uçları (docs/19).
 *
 * Kural motorda (`packages/shared/src/esyaPazari.ts`), kilit ve takas
 * `services/esyaPazari.ts`te. Buradaki her yazan uç aynı sırayı izliyor:
 *
 *   grup kilidi → defteri oku → karşı emri PLANLA → lordları sırayla
 *   kilitle → doğrula → yaz
 *
 * Doğrulama kilitten SONRA: altın, sayaçlar ve eşyanın hâli ancak lord
 * kilitliyken doğru okunuyor (docs/18 §1). Plan kilitten ÖNCE: kimin
 * kilitleneceğini ancak plan söylüyor.
 */
import {
  B,
  bantEngeli,
  bantHesapla,
  bantta,
  basamakFiyati,
  defterSatirlari,
  fiyatSinirlari,
  ilanEngeli,
  ilanaSiparisSec,
  itemPower,
  kayitKuyruguGerekir,
  odemeEngeli,
  sellValue,
  sipariseIlanSec,
  siparisEngeli,
  tierUnlockLevel,
  urunAdi,
  urunAnahtari,
  urunGecerli,
  type Urun,
} from '@lordlar/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma, type Tx } from '../db.js';
import { GameError, hata } from '../errors.js';
import { dogrulamaKontrol } from '../services/epostaDogrulama.js';
import {
  bantDisiniBildir,
  defterOku,
  defteriSupur,
  emir,
  eslesebilirIlanlar,
  grubu,
  grubunBandi,
  grupKilitle,
  lordlariKilitle,
  pazarDegisti,
  takasYap,
  tabanOku,
  urunu,
  zar,
} from '../services/esyaPazari.js';
import { lordIslemi } from '../services/kilit.js';
import { findLordByUser, tickLord } from '../services/lord.js';

const P = B.esya_pazari;

const basamakSemasi = z.number({
  required_error: 'Fiyat seçilmedi.',
  invalid_type_error: 'Fiyat sayı olmalı.',
});

const urunSemasi = z.object({
  slot: z.string(),
  tier: z.coerce.number(),
  rarity: z.string(),
  upgradeLevel: z.coerce.number(),
});

function urunDenetle(x: z.infer<typeof urunSemasi>): Urun {
  if (!urunGecerli(x)) throw new GameError('Böyle bir ürün yok.', 400, 'URUN_YOK');
  return x;
}

/** Gün değiştiyse sayaç sıfır sayılır (pazar takasıyla aynı desen). */
function bugunku(sayi: number, gun: Date | null, simdi: Date): number {
  if (!gun) return 0;
  return gun.toISOString().slice(0, 10) === simdi.toISOString().slice(0, 10) ? sayi : 0;
}

async function yukseltiliyor(tx: Tx, itemId: string): Promise<boolean> {
  const q = await tx.queue.findFirst({
    where: { kind: 'upgrade_item', resolved: false, payload: { path: ['itemId'], equals: itemId } },
    select: { id: true },
  });
  return q !== null;
}

/** Lordun pazardaki hâli. Lord kilitliyken çağrılmalı: sayaçlar buna dayanıyor. */
async function lordPazari(tx: Tx, lordId: string, simdi: Date) {
  const lord = await tx.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: { pazarKasasi: true, pazarEmirSayisi: true, pazarEmirGunu: true },
  });
  const ilanlar = await tx.esyaIlani.findMany({ where: { lordId } });
  const siparisler = await tx.onSiparis.findMany({ where: { lordId } });
  return {
    kasa: lord.pazarKasasi,
    bugunYeniEmir: bugunku(lord.pazarEmirSayisi, lord.pazarEmirGunu, simdi),
    acikIlan: ilanlar.length,
    acikSiparis: siparisler.length,
    emanette: siparisler.reduce((t, s) => t + s.fiyat, 0),
    ilanAnahtarlari: new Set(ilanlar.map((i) => urunAnahtari(urunu(i)))),
    siparisAnahtarlari: new Set(siparisler.map((s) => urunAnahtari(urunu(s)))),
  };
}

async function sayaciArtir(tx: Tx, lordId: string, bugun: number, simdi: Date): Promise<void> {
  await tx.lord.update({
    where: { id: lordId },
    data: { pazarEmirSayisi: bugun + 1, pazarEmirGunu: simdi },
  });
}

/**
 * Öde: önce kasadan, sonra depodan.
 *
 * Kasa önce, çünkü satıştan gelen altın çoğu zaman depo dolu olduğu için
 * orada bekliyor; satıcı onu yeni bir alıma doğrudan harcayabilsin.
 */
async function ode(tx: Tx, lordId: string, tutar: number, kasa: number): Promise<void> {
  const kasadan = Math.min(kasa, tutar);
  await tx.lord.update({
    where: { id: lordId },
    data: { pazarKasasi: { decrement: kasadan }, altin: { decrement: tutar - kasadan } },
  });
}

function engelAt(e: { kod: string; mesaj: string } | null): void {
  if (e) throw new GameError(e.mesaj, 400, e.kod);
}

async function lordunDiyari(lordId: string): Promise<string> {
  const l = await prisma.lord.findUniqueOrThrow({
    where: { id: lordId },
    select: { worldId: true },
  });
  return l.worldId;
}

export async function esyaPazariRoutes(app: FastifyInstance): Promise<void> {
  /* ── Okuma ─────────────────────────────────────────────────────── */

  /** Pazarın ana ekranı: kasa, emirlerim, satılabilir eşyalar, vitrin. */
  app.get('/esya-pazari', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    const simdi = new Date();
    const durum = await tickLord(lordId, simdi);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, pazarKasasi: true, pazarEmirSayisi: true, pazarEmirGunu: true },
    });
    const worldId = lord.worldId;
    const [fiyatlar, ilanlar, siparisler, esyalar, yukseltmeler] = await Promise.all([
      prisma.esyaFiyati.findMany({ where: { worldId } }),
      prisma.esyaIlani.findMany({ where: { worldId } }),
      prisma.onSiparis.findMany({ where: { worldId } }),
      prisma.item.findMany({
        where: { lordId, equipped: false, ilan: { is: null } },
        orderBy: [{ tier: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.queue.findMany({
        where: { lordId, kind: 'upgrade_item', resolved: false },
        select: { payload: true },
      }),
    ]);

    const tabanlar = new Map(
      fiyatlar.map((f) => [`${f.tier}:${f.rarity}:${f.upgradeLevel}`, f.taban]),
    );
    const bandi = (x: { tier: number; rarity: string; upgradeLevel: number }) => {
      const g = grubu(x);
      const taban =
        tabanlar.get(`${g.tier}:${g.rarity}:${g.upgradeLevel}`) ?? fiyatSinirlari(g).formulBasamak;
      return bantHesapla(taban, fiyatSinirlari(g));
    };
    const emirOzeti = (x: {
      id: string;
      slot: string;
      tier: number;
      rarity: string;
      upgradeLevel: number;
      basamak: number;
      fiyat: number;
    }) => {
      const b = bandi(x);
      return {
        id: x.id,
        urun: urunu(x),
        ad: urunAdi(urunu(x)),
        basamak: x.basamak,
        fiyat: x.fiyat,
        bantta: bantta(x.basamak, b),
        bant: {
          alt: b.alt,
          ust: b.ust,
          altFiyat: basamakFiyati(b.alt),
          ustFiyat: basamakFiyati(b.ust),
        },
      };
    };

    /*
     * Vitrin ve aranan: yalnız EŞLEŞEBİLİR emirler (bantta). Bant dışında
     * duran bir ilanı "satışta" göstermek, alınamayan bir şeyi göstermek
     * olurdu. Kendi emirlerin de yok — kendinden alamazsın.
     */
    const vitrin = new Map<
      string,
      { urun: Urun; enUcuz: number; adet: number; kuyrukta: number }
    >();
    for (const i of ilanlar) {
      if (i.lordId === lordId || !bantta(i.basamak, bandi(i))) continue;
      const k = urunAnahtari(urunu(i));
      const v = vitrin.get(k) ?? { urun: urunu(i), enUcuz: Infinity, adet: 0, kuyrukta: 0 };
      if (i.kuyrukBitis) v.kuyrukta++;
      else {
        v.adet++;
        v.enUcuz = Math.min(v.enUcuz, i.basamak);
      }
      vitrin.set(k, v);
    }
    const aranan = new Map<string, { urun: Urun; enYuksek: number; adet: number }>();
    for (const s of siparisler) {
      if (s.lordId === lordId || !bantta(s.basamak, bandi(s))) continue;
      const k = urunAnahtari(urunu(s));
      const a = aranan.get(k) ?? { urun: urunu(s), enYuksek: -Infinity, adet: 0 };
      a.adet++;
      a.enYuksek = Math.max(a.enYuksek, s.basamak);
      aranan.set(k, a);
    }
    const yukseltilen = new Set(
      yukseltmeler.map((q) => String((q.payload as { itemId?: unknown }).itemId)),
    );
    const guc = (i: { tier: number; rarity: string; upgradeLevel: number }) =>
      Math.round(itemPower(grubu(i)));

    return {
      kasa: lord.pazarKasasi,
      altin: durum.resources.altin,
      depoTavani: durum.storageCapacity,
      depoBos: Math.max(0, durum.storageCapacity - durum.resources.altin),
      vergi: P.vergi,
      tavan: {
        ilan: P.azami_ilan,
        siparis: P.azami_siparis,
        gunluk: P.gunluk_yeni_emir,
        bugun: bugunku(lord.pazarEmirSayisi, lord.pazarEmirGunu, simdi),
      },
      ilanlarim: ilanlar
        .filter((i) => i.lordId === lordId)
        .map((i) => ({ ...emirOzeti(i), kuyrukBitis: i.kuyrukBitis })),
      siparislerim: siparisler.filter((s) => s.lordId === lordId).map(emirOzeti),
      emanette: siparisler.filter((s) => s.lordId === lordId).reduce((t, s) => t + s.fiyat, 0),
      esyalarim: esyalar.map((i) => ({
        id: i.id,
        urun: urunu(i),
        ad: urunAdi(urunu(i)),
        guc: guc(i),
        npcDegeri: sellValue({ ...urunu(i) }),
        yukseltiliyor: yukseltilen.has(i.id),
      })),
      vitrin: [...vitrin.values()]
        .map((v) => ({
          urun: v.urun,
          ad: urunAdi(v.urun),
          adet: v.adet,
          kuyrukta: v.kuyrukta,
          enUcuz: Number.isFinite(v.enUcuz) ? basamakFiyati(v.enUcuz) : null,
          guc: guc(v.urun),
        }))
        .sort((a, b) => b.guc - a.guc)
        .slice(0, 40),
      aranan: [...aranan.values()]
        .map((a) => ({
          urun: a.urun,
          ad: urunAdi(a.urun),
          adet: a.adet,
          enYuksek: basamakFiyati(a.enYuksek),
          guc: guc(a.urun),
        }))
        .sort((a, b) => b.guc - a.guc)
        .slice(0, 40),
    };
  });

  /** Bir ürünün defteri: bant, basamaklar, son işlemler, benim emirlerim. */
  app.get('/esya-pazari/urun', { preHandler: requireAuth }, async (req) => {
    const urun = urunDenetle(urunSemasi.parse(req.query));
    const lordId = await findLordByUser(req.user.userId);
    const lord = await prisma.lord.findUniqueOrThrow({
      where: { id: lordId },
      select: { worldId: true, level: true },
    });
    const worldId = lord.worldId;
    const g = grubu(urun);
    const s = fiyatSinirlari(g);
    const bant = bantHesapla(await tabanOku(worldId, g), s);
    const kosul = { worldId, ...g };
    const [ilanlar, siparisler, sonIslemler] = await Promise.all([
      prisma.esyaIlani.findMany({ where: { ...kosul, slot: urun.slot } }),
      prisma.onSiparis.findMany({ where: { ...kosul, slot: urun.slot } }),
      prisma.esyaIslemi.findMany({
        where: kosul,
        orderBy: { createdAt: 'desc' },
        take: P.son_islem_sayisi,
        select: { fiyat: true, createdAt: true, slot: true, kura: true },
      }),
    ]);
    const acik = ilanlar.filter((i) => i.kuyrukBitis === null && bantta(i.basamak, bant));
    const kuyrukta = ilanlar.filter((i) => i.kuyrukBitis !== null);
    const bekleyen = siparisler.filter((x) => bantta(x.basamak, bant));
    const baskasi = <T extends { lordId: string }>(x: T) => x.lordId !== lordId;
    const enUcuz = acik
      .filter(baskasi)
      .reduce<number | null>((m, i) => (m === null || i.basamak < m ? i.basamak : m), null);
    const enYuksek = bekleyen
      .filter(baskasi)
      .reduce<number | null>((m, x) => (m === null || x.basamak > m ? x.basamak : m), null);
    const benimIlan = ilanlar.find((i) => i.lordId === lordId) ?? null;
    const benimSiparis = siparisler.find((x) => x.lordId === lordId) ?? null;
    const gerekenSeviye = tierUnlockLevel(urun.tier);

    return {
      urun,
      ad: urunAdi(urun),
      guc: Math.round(itemPower(g)),
      formul: s.formul,
      npcDegeri: sellValue({ ...urun }),
      taban: { basamak: bant.taban, fiyat: basamakFiyati(bant.taban) },
      bant: {
        alt: bant.alt,
        ust: bant.ust,
        altFiyat: basamakFiyati(bant.alt),
        ustFiyat: basamakFiyati(bant.ust),
      },
      defter: defterSatirlari(bant, acik, bekleyen),
      kuyrukta: {
        adet: kuyrukta.length,
        enErken: kuyrukta.reduce<Date | null>(
          (m, i) => (m === null || i.kuyrukBitis! < m ? i.kuyrukBitis : m),
          null,
        ),
      },
      kayitKuyrugu: kayitKuyruguGerekir(g),
      kuyrukSuresiDk: P.kuyruk_suresi_dk,
      enUcuzIlan: enUcuz === null ? null : { basamak: enUcuz, fiyat: basamakFiyati(enUcuz) },
      enYuksekSiparis:
        enYuksek === null ? null : { basamak: enYuksek, fiyat: basamakFiyati(enYuksek) },
      sonIslemler,
      benimIlan: benimIlan && {
        id: benimIlan.id,
        basamak: benimIlan.basamak,
        fiyat: benimIlan.fiyat,
        kuyrukBitis: benimIlan.kuyrukBitis,
        bantta: bantta(benimIlan.basamak, bant),
      },
      benimSiparis: benimSiparis && {
        id: benimSiparis.id,
        basamak: benimSiparis.basamak,
        fiyat: benimSiparis.fiyat,
        bantta: bantta(benimSiparis.basamak, bant),
      },
      kilit: lord.level < gerekenSeviye ? { gerekenSeviye } : null,
      vergi: P.vergi,
    };
  });

  /* ── İlan ──────────────────────────────────────────────────────── */

  app.post('/esya-pazari/ilan', { preHandler: requireAuth }, async (req) => {
    const govde = z.object({ itemId: z.string().min(1), basamak: basamakSemasi }).parse(req.body);
    await dogrulamaKontrol(req.user.userId, 'esya_pazari');
    const lordId = await findLordByUser(req.user.userId);
    const ilk = await prisma.item.findUnique({ where: { id: govde.itemId } });
    if (!ilk || ilk.lordId !== lordId) throw hata.bulunamadi('Eşya');
    const worldId = await lordunDiyari(lordId);
    const g = grubu(ilk);
    const simdi = new Date();

    const sonuc = await prisma.$transaction(async (tx) => {
      const grup = await grupKilitle(tx, worldId, g);
      const bant = grubunBandi(grup);
      const { siparisler } = await defterOku(tx, worldId, g);
      const kuyruk = kayitKuyruguGerekir(g);
      // Değerli eşya hiçbir siparişe HEMEN gitmiyor: kayıt kuyruğunda
      // bekleyip kurayla satılıyor (docs/19 §6).
      const hedef = kuyruk
        ? null
        : ilanaSiparisSec(
            siparisler.filter((x) => x.slot === ilk.slot).map(emir),
            govde.basamak,
            bant,
            zar,
            lordId,
          );
      await lordlariKilitle(tx, [lordId, hedef?.lordId]);

      const esya = await tx.item.findUnique({
        where: { id: govde.itemId },
        include: { ilan: { select: { id: true } } },
      });
      if (!esya || esya.lordId !== lordId) throw hata.bulunamadi('Eşya');
      // Kilitten önce okunan grupla aynı mı: yükseltme arada bitmiş olabilir.
      if (
        esya.tier !== g.tier ||
        esya.rarity !== g.rarity ||
        esya.upgradeLevel !== g.upgradeLevel
      ) {
        throw pazarDegisti();
      }
      const urun = urunu(esya);
      const pz = await lordPazari(tx, lordId, simdi);
      engelAt(
        ilanEngeli({
          esya: {
            equipped: esya.equipped,
            pazarda: esya.ilan !== null,
            yukseltiliyor: await yukseltiliyor(tx, esya.id),
          },
          basamak: govde.basamak,
          bant,
          acikIlan: pz.acikIlan,
          bugunYeniEmir: pz.bugunYeniEmir,
          ayniUrundeIlan: pz.ilanAnahtarlari.has(urunAnahtari(urun)),
          ayniUrundeSiparis: pz.siparisAnahtarlari.has(urunAnahtari(urun)),
        }),
      );
      await sayaciArtir(tx, lordId, pz.bugunYeniEmir, simdi);

      if (hedef) {
        const siparis = await tx.onSiparis.findUnique({ where: { id: hedef.id } });
        if (!siparis) throw pazarDegisti();
        await tx.onSiparis.delete({ where: { id: siparis.id } });
        const t = await takasYap(
          tx,
          {
            worldId,
            urun,
            itemId: esya.id,
            saticiId: lordId,
            aliciId: siparis.lordId,
            basamak: siparis.basamak,
            kura: false,
            emanet: siparis.fiyat,
            aktorId: lordId,
          },
          grup,
          simdi,
        );
        if (t.tabanDegisti) await bantDisiniBildir(tx, grup);
        return {
          durum: 'satildi' as const,
          fiyat: t.fiyat,
          vergi: t.vergi,
          net: t.net,
          tabanDegisti: t.tabanDegisti,
        };
      }

      const fiyat = basamakFiyati(govde.basamak);
      const kuyrukBitis = kuyruk ? new Date(simdi.getTime() + P.kuyruk_suresi_dk * 60_000) : null;
      await tx.esyaIlani.create({
        data: {
          worldId,
          lordId,
          itemId: esya.id,
          ...urun,
          basamak: govde.basamak,
          fiyat,
          sira: simdi,
          kuyrukBitis,
        },
      });
      return {
        durum: kuyruk ? ('kuyrukta' as const) : ('listede' as const),
        fiyat,
        kuyrukBitis,
        tabanDegisti: false,
      };
    });
    if (sonuc.tabanDegisti) await defteriSupur(worldId, g);
    return sonuc;
  });

  /**
   * İlanın fiyatını güncelle. Ücretsiz; sıra yenileniyor — fiyatını
   * değiştiren, eşit fiyatta bekleyenin önüne geçemesin.
   */
  app.post('/esya-pazari/ilan/:id/fiyat', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { basamak } = z.object({ basamak: basamakSemasi }).parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const ilk = await prisma.esyaIlani.findUnique({ where: { id } });
    if (!ilk || ilk.lordId !== lordId) throw hata.bulunamadi('İlan');
    const g = grubu(ilk);
    const simdi = new Date();

    const sonuc = await prisma.$transaction(async (tx) => {
      const grup = await grupKilitle(tx, ilk.worldId, g);
      const ilan = await tx.esyaIlani.findUnique({ where: { id } });
      if (!ilan || ilan.lordId !== lordId) throw hata.bulunamadi('İlan');
      if (ilan.kuyrukBitis) {
        throw new GameError(
          'Kayıt kuyruğundaki ilanın fiyatı değişmez. Kura bitince güncelleyebilirsin.',
          400,
          'KUYRUKTA',
        );
      }
      const bant = grubunBandi(grup);
      engelAt(bantEngeli(basamak, bant));
      if (basamak === ilan.basamak) throw new GameError('Fiyat zaten bu.', 400, 'AYNI_FIYAT');
      const { siparisler } = await defterOku(tx, ilan.worldId, g);
      const hedef = ilanaSiparisSec(
        siparisler.filter((x) => x.slot === ilan.slot).map(emir),
        basamak,
        bant,
        zar,
        lordId,
      );
      await lordlariKilitle(tx, [lordId, hedef?.lordId]);

      if (hedef) {
        const siparis = await tx.onSiparis.findUnique({ where: { id: hedef.id } });
        if (!siparis) throw pazarDegisti();
        await tx.onSiparis.delete({ where: { id: siparis.id } });
        const t = await takasYap(
          tx,
          {
            worldId: ilan.worldId,
            urun: urunu(ilan),
            itemId: ilan.itemId,
            saticiId: lordId,
            aliciId: siparis.lordId,
            basamak: siparis.basamak,
            kura: false,
            emanet: siparis.fiyat,
            aktorId: lordId,
          },
          grup,
          simdi,
        );
        if (t.tabanDegisti) await bantDisiniBildir(tx, grup);
        return { durum: 'satildi' as const, ...t };
      }
      const fiyat = basamakFiyati(basamak);
      await tx.esyaIlani.update({
        where: { id },
        data: { basamak, fiyat, sira: simdi, bantDisiBildirildi: false },
      });
      return { durum: 'listede' as const, fiyat, tabanDegisti: false };
    });
    if (sonuc.tabanDegisti) await defteriSupur(ilk.worldId, g);
    return sonuc;
  });

  /** İlanı geri çek: eşya envantere döner. Kayıt kuyruğundayken çekilemez. */
  app.post('/esya-pazari/ilan/:id/geri-cek', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);
    const ilk = await prisma.esyaIlani.findUnique({ where: { id } });
    if (!ilk || ilk.lordId !== lordId) throw hata.bulunamadi('İlan');

    return prisma.$transaction(async (tx) => {
      await grupKilitle(tx, ilk.worldId, grubu(ilk));
      const ilan = await tx.esyaIlani.findUnique({ where: { id } });
      if (!ilan || ilan.lordId !== lordId) throw hata.bulunamadi('İlan');
      /*
       * Kuyruktayken geri çekmek yasak: satıcı kuyruğun sonunda kaç
       * alıcının beklediğini görüp ilanı çekebilseydi, kura bir pazarlık
       * aracına dönerdi.
       */
      if (ilan.kuyrukBitis) {
        throw new GameError(
          'Kayıt kuyruğundaki ilan kura bitene kadar geri çekilemez.',
          400,
          'KUYRUKTA',
        );
      }
      await lordlariKilitle(tx, [lordId]);
      await tx.esyaIlani.delete({ where: { id } });
      return { geriCekildi: true, itemId: ilan.itemId };
    });
  });

  /* ── Ön sipariş ────────────────────────────────────────────────── */

  app.post('/esya-pazari/siparis', { preHandler: requireAuth }, async (req) => {
    const govde = urunSemasi.extend({ basamak: basamakSemasi }).parse(req.body);
    const urun = urunDenetle(govde);
    await dogrulamaKontrol(req.user.userId, 'esya_pazari');
    const lordId = await findLordByUser(req.user.userId);
    const worldId = await lordunDiyari(lordId);
    const g = grubu(urun);
    const simdi = new Date();

    const sonuc = await prisma.$transaction(async (tx) => {
      const grup = await grupKilitle(tx, worldId, g);
      const bant = grubunBandi(grup);
      const { ilanlar } = await defterOku(tx, worldId, g);
      const hedef = sipariseIlanSec(
        eslesebilirIlanlar(ilanlar, urun.slot).map(emir),
        govde.basamak,
        bant,
        lordId,
      );
      await lordlariKilitle(tx, [lordId, hedef?.lordId]);

      const durum = await tickLord(lordId, simdi, tx);
      const pz = await lordPazari(tx, lordId, simdi);
      // Hemen eşleşiyorsa İLANIN fiyatı ödeniyor, yazdığın değil.
      const odenecek = basamakFiyati(hedef ? hedef.basamak : govde.basamak);
      engelAt(
        siparisEngeli({
          urun,
          lordSeviyesi: durum.level,
          basamak: govde.basamak,
          bant,
          acikSiparis: pz.acikSiparis,
          bugunYeniEmir: pz.bugunYeniEmir,
          ayniUrundeIlan: pz.ilanAnahtarlari.has(urunAnahtari(urun)),
          ayniUrundeSiparis: pz.siparisAnahtarlari.has(urunAnahtari(urun)),
          odenecek,
          bekleyecek: !hedef,
          eldeki: pz.kasa + durum.resources.altin,
          emanette: pz.emanette,
          depoTavani: durum.storageCapacity,
        }),
      );
      await sayaciArtir(tx, lordId, pz.bugunYeniEmir, simdi);
      await ode(tx, lordId, odenecek, pz.kasa);

      if (hedef) {
        const ilan = await tx.esyaIlani.findUnique({ where: { id: hedef.id } });
        if (!ilan) throw pazarDegisti();
        const t = await takasYap(
          tx,
          {
            worldId,
            urun,
            itemId: ilan.itemId,
            saticiId: ilan.lordId,
            aliciId: lordId,
            basamak: ilan.basamak,
            kura: false,
            emanet: odenecek,
            aktorId: lordId,
          },
          grup,
          simdi,
        );
        if (t.tabanDegisti) await bantDisiniBildir(tx, grup);
        return {
          durum: 'alindi' as const,
          fiyat: t.fiyat,
          itemId: ilan.itemId,
          tabanDegisti: t.tabanDegisti,
        };
      }
      await tx.onSiparis.create({
        data: { worldId, lordId, ...urun, basamak: govde.basamak, fiyat: odenecek, sira: simdi },
      });
      return { durum: 'bekliyor' as const, fiyat: odenecek, tabanDegisti: false };
    });
    if (sonuc.tabanDegisti) await defteriSupur(worldId, g);
    return sonuc;
  });

  /**
   * Ön siparişin fiyatını güncelle. Fark ödeniyor ya da kasaya dönüyor;
   * eski emanet bu hesapta "elde" sayılıyor.
   */
  app.post('/esya-pazari/siparis/:id/fiyat', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { basamak } = z.object({ basamak: basamakSemasi }).parse(req.body);
    const lordId = await findLordByUser(req.user.userId);
    const ilk = await prisma.onSiparis.findUnique({ where: { id } });
    if (!ilk || ilk.lordId !== lordId) throw hata.bulunamadi('Ön sipariş');
    const g = grubu(ilk);
    const simdi = new Date();

    const sonuc = await prisma.$transaction(async (tx) => {
      const grup = await grupKilitle(tx, ilk.worldId, g);
      const siparis = await tx.onSiparis.findUnique({ where: { id } });
      if (!siparis || siparis.lordId !== lordId) throw hata.bulunamadi('Ön sipariş');
      const bant = grubunBandi(grup);
      engelAt(bantEngeli(basamak, bant));
      if (basamak === siparis.basamak) {
        throw new GameError('Fiyat zaten bu.', 400, 'AYNI_FIYAT');
      }
      const { ilanlar } = await defterOku(tx, siparis.worldId, g);
      const hedef = sipariseIlanSec(
        eslesebilirIlanlar(ilanlar, siparis.slot).map(emir),
        basamak,
        bant,
        lordId,
      );
      await lordlariKilitle(tx, [lordId, hedef?.lordId]);

      const durum = await tickLord(lordId, simdi, tx);
      const pz = await lordPazari(tx, lordId, simdi);
      const odenecek = basamakFiyati(hedef ? hedef.basamak : basamak);
      engelAt(
        odemeEngeli({
          odenecek,
          bekleyecek: !hedef,
          eldeki: pz.kasa + durum.resources.altin + siparis.fiyat,
          emanette: pz.emanette - siparis.fiyat,
          depoTavani: durum.storageCapacity,
        }),
      );
      const fark = odenecek - siparis.fiyat;
      if (fark > 0) await ode(tx, lordId, fark, pz.kasa);
      if (fark < 0) {
        await tx.lord.update({
          where: { id: lordId },
          data: { pazarKasasi: { increment: -fark } },
        });
      }

      if (hedef) {
        const ilan = await tx.esyaIlani.findUnique({ where: { id: hedef.id } });
        if (!ilan) throw pazarDegisti();
        await tx.onSiparis.delete({ where: { id } });
        const t = await takasYap(
          tx,
          {
            worldId: siparis.worldId,
            urun: urunu(siparis),
            itemId: ilan.itemId,
            saticiId: ilan.lordId,
            aliciId: lordId,
            basamak: ilan.basamak,
            kura: false,
            emanet: odenecek,
            aktorId: lordId,
          },
          grup,
          simdi,
        );
        if (t.tabanDegisti) await bantDisiniBildir(tx, grup);
        return { durum: 'alindi' as const, itemId: ilan.itemId, ...t };
      }
      await tx.onSiparis.update({
        where: { id },
        data: { basamak, fiyat: odenecek, sira: simdi, bantDisiBildirildi: false },
      });
      return { durum: 'bekliyor' as const, fiyat: odenecek, tabanDegisti: false };
    });
    if (sonuc.tabanDegisti) await defteriSupur(ilk.worldId, g);
    return sonuc;
  });

  /** Ön siparişi iptal et: emanetteki altın kasaya döner, kesintisiz. */
  app.post('/esya-pazari/siparis/:id/iptal', { preHandler: requireAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lordId = await findLordByUser(req.user.userId);
    const ilk = await prisma.onSiparis.findUnique({ where: { id } });
    if (!ilk || ilk.lordId !== lordId) throw hata.bulunamadi('Ön sipariş');

    return prisma.$transaction(async (tx) => {
      await grupKilitle(tx, ilk.worldId, grubu(ilk));
      const siparis = await tx.onSiparis.findUnique({ where: { id } });
      if (!siparis || siparis.lordId !== lordId) throw hata.bulunamadi('Ön sipariş');
      await lordlariKilitle(tx, [lordId]);
      await tx.onSiparis.delete({ where: { id } });
      await tx.lord.update({
        where: { id: lordId },
        data: { pazarKasasi: { increment: siparis.fiyat } },
      });
      return { iptal: true, iade: siparis.fiyat };
    });
  });

  /* ── Kasa ──────────────────────────────────────────────────────── */

  /**
   * Kasadaki altını depoya al — depoda yer olduğu kadarını.
   *
   * Taşan kısım kasada kalıyor. Depoya yazıp taşanı silmek, pazar
   * takasının düzeltilen hatasının aynısı olurdu (docs/18).
   */
  app.post('/esya-pazari/kasa/al', { preHandler: requireAuth }, async (req) => {
    const lordId = await findLordByUser(req.user.userId);
    return lordIslemi(lordId, async (tx) => {
      const durum = await tickLord(lordId, new Date(), tx);
      const { pazarKasasi } = await tx.lord.findUniqueOrThrow({
        where: { id: lordId },
        select: { pazarKasasi: true },
      });
      if (pazarKasasi <= 0) throw new GameError('Kasan boş.', 400, 'KASA_BOS');
      const bos = Math.max(0, Math.floor(durum.storageCapacity - durum.resources.altin));
      const alinan = Math.min(pazarKasasi, bos);
      if (alinan === 0) {
        throw new GameError(
          "Deponda altın için yer yok. Önce biraz harca ya da Malikâne'yi yükselt.",
          400,
          'DEPO_DOLU',
        );
      }
      await tx.lord.update({
        where: { id: lordId },
        data: { pazarKasasi: { decrement: alinan }, altin: { increment: alinan } },
      });
      return { alinan, kalan: pazarKasasi - alinan };
    });
  });
}
