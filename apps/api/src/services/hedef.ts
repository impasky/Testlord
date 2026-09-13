/**
 * "Şimdi neye saldırmalıyım?"
 *
 * Oyunun ilk gerçek testinde oyuncu ordusunu kurdu, rastgele bir bölgeye
 * yolladı ve "eee ne oldu şimdi" deyip çıktı. Sorunun yarısı hedefin
 * seçilebilir olmasıydı ama seçilmesi gerektiğinin hiçbir yerde
 * söylenmemesiydi. Burası, oyunun oyuncuya somut bir hedef gösterebilmesi
 * için gereken hesabı yapar.
 *
 * Hesap tamamen motorun kendi fonksiyonlarıyla yapılır — "şu kadar askerin
 * varsa şuraya saldır" gibi ikinci bir sezgisel kural yazılmaz; gerçek savaş
 * simülasyonu çalıştırılır. Böylece öneri, oyunun kendi kurallarıyla
 * tutarlı olmak zorunda kalır.
 */
import {
  B,
  UNIT_TYPES,
  aggregateGeneralBonus,
  altinKarsiligi,
  armyCount,
  bosGeneralBonus,
  fetihKazanci,
  lordContribution,
  marchDurationSec,
  maxRegions,
  calculateFame,
  regionIncome,
  vilayetCarpani,
  vilayetSayilari,
  armyPower,
  armySlots,
  commandCapacity,
  onizlemeTohumu,
  savasOrneklemesi,
  simulateBattle,
  taramaSonucu,
  varsayilanDizilim,
  siraTahmini,
  unit,
  totalEquipmentPower,
  type Army,
  type EquipSlot,
  type Rarity,
  type Resources,
  type Side,
  type SavasOrneklemesi,
  type TaramaSonucu,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { arastirmaBonusuOku, equippedGenerals, gearBonusFrom } from './lord.js';
import { regionFortressBonus } from './region.js';
import { dunyaGrafigi, mesafeOlcerHazir } from './mesafe.js';

/** Lordun savaş tarafını kurar (ekipman, donanım, generaller dahil). */
export async function lordSide(
  lordId: string,
  army: Army,
  generalKeys: string[],
  client: Tx = prisma,
  duzen?: Side['duzen'],
): Promise<Side> {
  const lord = await client.lord.findUniqueOrThrow({
    where: { id: lordId },
    include: { items: true, gearLines: true, generals: true },
  });
  const sahada = equippedGenerals(lord.generals, new Date()).filter(
    (g) => generalKeys.length === 0 || generalKeys.includes(g.key),
  );
  const items = lord.items
    .filter((i) => i.equipped)
    .map((i) => ({
      slot: i.slot as EquipSlot,
      tier: i.tier,
      rarity: i.rarity as Rarity,
      upgradeLevel: i.upgradeLevel,
    }));
  const ar = arastirmaBonusuOku(lord);
  return {
    units: army,
    arastirma: {
      orduSaldiri: ar.orduSaldiri,
      orduSavunma: ar.orduSavunma,
      kaleSavunmasi: ar.kaleSavunmasi,
      yagma: ar.yagma,
    },
    // Önizleme ile gerçek savaşın AYNI düzeni kullanması şart: oyuncuya
    // gösterilen kazanma ihtimali, dizilimi hesaba katmayan bir sayı
    // olsaydı dizilim ekranı oyuncuya yalan söylemiş olurdu.
    duzen: duzen ?? { dizilim: varsayilanDizilim(army), taktik: null },
    gearBonus: gearBonusFrom(lord.gearLines),
    generalBonus: sahada.length ? aggregateGeneralBonus(sahada) : bosGeneralBonus(),
    lordContribution: lordContribution(lord.guc, items),
    leadership: lord.liderlik,
    fortressBonus: 0,
    isDefender: false,
  };
}

/** Bir bölgenin NPC garnizonuna karşı savunma tarafı. */
function npcDefender(garrison: Army, type: string, level: number): Side {
  return {
    units: garrison,
    // march.ts'teki npcSide ile aynı gerekçe: NPC'yi nötr bırakmak
    // oyuncuya her bölgede bedava dizilim avantajı verirdi.
    duzen: { dizilim: varsayilanDizilim(garrison), taktik: null },
    gearBonus: { saldiri: 0, savunma: 0, can: 0 },
    generalBonus: bosGeneralBonus(),
    lordContribution: 0,
    leadership: 0,
    fortressBonus: regionFortressBonus(type, level),
    isDefender: true,
  };
}

export interface HedefOnerisi {
  regionId: number;
  name: string;
  type: string;
  level: number;
  distance: number;
  marchSec: number;
  /** İlk saldırı kısayolu bu hedefte geçerli mi. */
  ilkSaldiri: boolean;
  /** Oyuncunun evde hiç ordusu var mı — "yetmiyor" ile "yok" farklı şeyler. */
  orduVar: boolean;
  /**
   * Mevcut ev ordusuyla bölge ele GEÇİRİLİR mi.
   *
   * Savaşı kazanmak yetmiyor: bölge ancak açık ara zaferde el değiştiriyor
   * (balance.json savas.bolge_ele_gecirme.ele_gecirme_esigi). Öneri, savaşı
   * değil bölgeyi kazanacağın hedefi göstermeli — yoksa "ordun yetiyor"
   * deyip bölgeyi vermemek olur.
   */
  kazanir: boolean;
  /** Savaşı kazanır ama bölgeyi alamaz — dar zafer. */
  darZafer: boolean;
  /**
   * Bölgeyi almak için kaç birim daha gerekiyor.
   *
   * "Daha fazla asker eğit" bir tavsiye değil, bir bilmece: oyuncu ne kadar
   * daha lazım olduğunu bilmiyor ve deneyerek öğrenmek bir yürüyüş + bir
   * savaş kaybı demek. Bu alan somut sayıyı veriyor. Ordu yeterliyse null.
   */
  eksik: EksikOrdu | null;
  /** Kazanırsa geriye kaç birim kalır — "kıl payı" ile "rahat" farkı. */
  kalanBirim: number;
  garrison: Army;
  saatlikGelir: { altin: number; demir: number; erzak: number; sohret: number };
  sohretFarki: number;
  /** Bölge limiti dolu mu — kazansa bile alamaz. */
  limitDolu: boolean;
}

/**
 * Kazanılabilen bir hedefin sıralama puanı.
 *
 * Tek yerde duruyor çünkü iki kez okunuyor: bir kez savaşa girmeden ÜST
 * SINIR olarak (`kalan` yerine evdeki toplam birikle), bir kez de tarama
 * sonrası gerçek `kalan` ile. İki kopya olsaydı tavan gerçeğin altına
 * düşebilir ve dal budama yanlış adayı elerdi.
 *
 * 1e9 tabanı kazananı kaybedenin önüne koyuyor, 1e6 ise ilk saldırı
 * kısayolunu; geri kalan "saat başına kaç altın eder" ve eşitlik bozan
 * kalan birik.
 */
function kazananPuani(
  gelir: ReturnType<typeof regionIncome>,
  marchSec: number,
  ilkSaldiri: boolean,
  kalan: number,
): number {
  const saat = Math.max(marchSec, 60) / 3600;
  return 1e9 + (ilkSaldiri ? 1e6 : 0) + altinKarsiligi(gelir) / saat + kalan;
}

/**
 * Lorda saldırması gereken bölgeyi önerir.
 *
 * Yalnızca SAHİPSİZ bölgeler önerilir. Bir oyuncunun bölgesini önermek,
 * koruma kurallarına (yeni oyuncu kalkanı, seviye farkı, tekrar saldırı)
 * takılabilecek bir eylemi tavsiye etmek olurdu; öneri her zaman
 * yapılabilir olmalı.
 *
 * Taht Kalesi de dışarıda: 890 birimlik garnizonu oyunun bitiş hedefi,
 * yol gösterici bir ilk adım değil.
 */
export async function onerilenHedef(lordId: string): Promise<HedefOnerisi | null> {
  const lord = await prisma.lord.findUniqueOrThrow({
    where: { id: lordId },
    include: { regions: true, items: true },
  });

  const evRows = await prisma.armyUnit.findMany({
    where: { lordId, locationType: 'home', locationId: null },
  });
  const evOrdusu: Army = {};
  for (const r of evRows) evOrdusu[r.unitType as UnitType] = r.count;

  // Ordusu olmayan oyuncuya da hedef gösterilir. Öneriyi burada kesmek,
  // "ne için asker eğitiyorum" sorusunu tam da sorulduğu anda cevapsız
  // bırakıyordu: yeni oyuncunun ordusu hep boştur.
  const orduVar = armyCount(evOrdusu) > 0;
  const onerAr = arastirmaBonusuOku(lord);

  const [saldiran, yuruyusSayisi, bolgeSayisi, adaylar, graf] = await Promise.all([
    lordSide(lordId, evOrdusu, []),
    prisma.march.count({ where: { lordId } }),
    prisma.region.count({ where: { ownerLordId: lordId, type: { not: 'taht' } } }),
    prisma.region.findMany({
      where: {
        worldId: lord.worldId,
        ownerLordId: null,
        type: { not: 'taht' },
        OR: [{ shieldUntil: null }, { shieldUntil: { lte: new Date() } }],
      },
    }),
    dunyaGrafigi(lord.worldId),
  ]);

  const limitDolu = bolgeSayisi >= maxRegions(lord.level);
  const ilkYuruyus = yuruyusSayisi === 0;
  // Toprakları zaten yüklü (include: { regions: true }); ölçeri buradan
  // kuruyoruz, ikinci bir sorgu açmadan.
  const olc = mesafeOlcerHazir(
    graf,
    lord.homeBolgeId,
    lord.regions.map((r) => r.mapId),
  );

  /*
   * ADAY TARAMASI — neden iki geçiş.
   *
   * Bir adayın puanı iki parçadan geliyor: SİMÜLASYONSUZ olanlar (mesafe,
   * yürüyüş süresi, gelir, savunma gücü) ve savaşın kendisi (alınır mı,
   * kazanırsan geriye ne kalır). İkincisi pahalı: bölge başına dokuz savaş.
   * Diyar 61 bölgeyken kimsenin dikkatini çekmedi, 121'e çıkınca ölçüldü —
   * istek başına ~19 ms ve bu süre boyunca sunucu başka kimseye bakamıyor.
   * Otuz eşzamanlı oyuncuda sona kalan yarım saniyeden fazla sırada
   * bekliyordu; yük testinde p95 eşiğini geçen şey buydu.
   *
   * Çözüm sıralamayı değil, GEREKSİZ SAVAŞI atmak. Kazanan adayın puanı
   *
   *     1e9 + (ilk saldırı ? 1e6 : 0) + saatlik değer + kalan birim
   *
   * ve buradaki tek bilinmeyen `kalan`; onun da tavanı belli: evdeki
   * toplam birikten fazlası geri dönemez. Yani her aday için savaşa hiç
   * girmeden bir ÜST SINIR yazılabiliyor. Adaylar bu üst sınıra göre
   * sıralanıp sırayla taranıyor ve sıradaki adayın üst sınırı eldeki en
   * iyi GERÇEK puanı geçemez olunca durulabiliyor: geri kalanların cevabı
   * sıralamayı değiştiremez.
   *
   * Kaybeden adayın puanı zaten simülasyonsuz (-mesafe, -savunma gücü),
   * yani ordusu yetmeyen oyuncuda da fazladan iş yok: orada erken çıkış
   * `taramaSonucu`nun içinde çalışıyor.
   *
   * Sonuç aynı, sıralama aynı; yalnız cevabı değiştiremeyecek savaşlar
   * çalışmıyor.
   */
  interface Aday {
    r: (typeof adaylar)[number];
    garrison: Army;
    distance: number;
    ilkSaldiri: boolean;
    marchSec: number;
    gelir: ReturnType<typeof regionIncome>;
    savunmaGucu: number;
    /** Savaşa girmeden yazılabilen tavan; azalan sırada taranıyor. */
    puanUst: number;
    /** Tarandıysa gerçek puan, taranmadıysa -Infinity. */
    puan: number;
    kazanir: boolean;
    darZafer: boolean;
    kalan: number;
  }

  // Kazanan bir savaştan evdeki ordudan fazlası dönemez: `kalan`ın tavanı.
  const enCokKalan = armyCount(evOrdusu);

  const liste: Aday[] = adaylar.map((r) => {
    const garrison: Army = {};
    const ham = (r.npcGarrison ?? {}) as Record<string, number>;
    for (const t of UNIT_TYPES) if ((ham[t] ?? 0) > 0) garrison[t] = ham[t]!;

    // Mesafe en yakın toprağından (docs/11 §1.2 H1): öneri motoru da
    // haritayla aynı sayıyı görmeli, yoksa "2 adım" diyen öneri saldırı
    // ekranında 5 adım çıkar.
    const distance = olc(r.mapId);
    const ilkSaldiri = ilkYuruyus && distance <= B.yuruyus.ilk_saldiri_max_adim;
    // Ordu boşken hız referansı kullanılır (marchDurationSec'in kendi
    // davranışı); gösterilen süre "bu mesafe kabaca ne kadar" demektir.
    // Önizlemedeki süre gerçek yürüyüşle aynı formülü kullanmalı;
    // araştırmayı atlarsak oyuncuya "48dk" deyip 40dk sürer ve
    // ekranlar birbiriyle çelişir.
    const marchSec = marchDurationSec(
      distance,
      evOrdusu,
      saldiran.generalBonus,
      { ilkSaldiri },
      onerAr,
    );
    const gelir = regionIncome(r.type, r.level, r.incomeMult);
    // Zorluk ölçüsü birim SAYISI değil savunma GÜCÜ: aynı 37 birimlik
    // garnizon bir kalede tahkimat bonusuyla çok daha zor. Sayıya bakmak,
    // oyuncuya hiçbir ordunun alamayacağı bir kaleyi hedef gösteriyordu.
    const savunmaGucu = armyPower(garrison) * (1 + regionFortressBonus(r.type, r.level));

    return {
      r,
      garrison,
      distance,
      ilkSaldiri,
      marchSec,
      gelir,
      savunmaGucu,
      puanUst: kazananPuani(gelir, marchSec, ilkSaldiri, enCokKalan),
      puan: Number.NEGATIVE_INFINITY,
      kazanir: false,
      darZafer: false,
      kalan: 0,
    };
  });

  liste.sort((a, b) => b.puanUst - a.puanUst);

  let enIyiPuan = Number.NEGATIVE_INFINITY;
  for (const a of liste) {
    // Sıradakinin tavanı eldekini geçemiyorsa geri kalanı taramak boşuna.
    if (a.puanUst <= enIyiPuan) break;

    if (orduVar) {
      const s = taramaSonucu(
        saldiran,
        npcDefender(a.garrison, a.r.type, a.r.level),
        onizlemeTohumu(lordId, a.r.id),
        { defenderStore: { altin: 0, demir: 0, erzak: 0 }, attackerCunning: 0, canCapture: true },
      );
      a.kazanir = s.kazanir;
      a.darZafer = s.darZafer;
      a.kalan = s.kalan;
    }

    /*
     * İki ayrı sıralama, çünkü iki ayrı soru soruluyor:
     *
     *  - Kazanılabilen hedefler arasında soru "hangisi en kârlı": saat
     *    başına düşen değer kazanır, yakın ve verimli hedef uzak ve zengin
     *    hedefi yener.
     *  - Kazanılamıyorsa soru "hangisi ulaşabileceğim ilk basamak":
     *    önce YAKINLIK, sonra en ZAYIF savunma. Değere göre sıralamak
     *    ordusu olmayan oyuncuya 160 birimlik şehri gösteriyordu; zayıf
     *    garnizonu öne almak ise 6 adım uzaktaki bir bölgeyi — yani tam
     *    da düzeltmeye çalıştığımız "ordumu yolladım, bir saat sonra
     *    dönerim" deneyimini. Yeni oyuncunun ilk hedefi yürüme mesafesinde
     *    olmalı.
     *  - Oyuncunun İLK saldırısında yakınlık her şeyin önüne geçer. Değer
     *    sıralaması, ordusunu yeni kurmuş bir oyuncuyu 4 adım öteye, 57
     *    dakikalık bir yürüyüşe yollayabiliyordu — yani "saldırıya
     *    gönderdim, eee ne oldu şimdi" duygusunun ta kendisine. İlk
     *    saldırı kısayolunun geçerli olduğu hedef öne alınıyor.
     */
    a.puan = a.kazanir
      ? kazananPuani(a.gelir, a.marchSec, a.ilkSaldiri, a.kalan)
      : -a.distance * 1000 - a.savunmaGucu / 1000;
    if (a.puan > enIyiPuan) enIyiPuan = a.puan;
  }

  liste.sort((a, b) => b.puan - a.puan);

  /** Aday satırından arayüzün beklediği öneri nesnesi. */
  const hedefKur = (a: Aday): HedefOnerisi => ({
    regionId: a.r.id,
    name: a.r.name,
    type: a.r.type,
    level: a.r.level,
    distance: a.distance,
    marchSec: a.marchSec,
    ilkSaldiri: a.ilkSaldiri,
    orduVar,
    kazanir: a.kazanir,
    darZafer: a.darZafer,
    eksik: null,
    kalanBirim: a.kalan,
    garrison: a.garrison,
    saatlikGelir: {
      altin: Math.round(a.gelir.altin),
      demir: Math.round(a.gelir.demir),
      erzak: Math.round(a.gelir.erzak),
      sohret: Math.round(a.gelir.sohret),
    },
    sohretFarki: fetihKazanci({
      lordLevel: lord.level,
      regions: lord.regions.map((x) => ({ type: x.type, level: x.level })),
      hedef: { type: a.r.type, level: a.r.level, incomeMult: a.r.incomeMult },
      totalEquipmentPower: 0,
      army: {},
      pvpWins: lord.pvpWins,
      fortressFameAccrued: lord.fortressFameAccrued,
      ownsThrone: lord.regions.some((x) => x.type === 'taht'),
    }).sohretFarki,
    limitDolu,
  });

  let enIyi = liste[0] ? hedefKur(liste[0]) : null;

  // Seçilen hedefin "alınır mı" cevabı ÖRNEKLEMEYLE veriliyor ve
  // önizlemeyle AYNI tohum tabanını kullanıyor — böylece öneri şeridi ile
  // saldırı önizlemesi aynı ekranda birbirine ters düşemiyor.
  // --- Ulaşılabilirlik denetimi ---
  //
  // En yakın hedef, alınabilir hedef olmak zorunda değil. Ring 4'teki bir
  // KALE ile bir TARLA aynı 37 birimi barındırıyor ama kalenin tahkimatı
  // onu 1. seviye bir lord için imkânsız kılıyor. Mesafe sıralamada baskın
  // olduğu için, kalenin dibinde doğan oyuncuya hiçbir orduyla alamayacağı
  // bir hedef gösteriliyordu.
  //
  // Bu yüzden en iyi birkaç aday için "komuta kapasiten dolsa alır mıydın"
  // sorusu gerçekten soruluyor ve ilk ALINABİLİR olan seçiliyor. Arama
  // yalnızca ilk birkaç adayda çalışır; 60 bölgenin hepsinde ikili arama
  // yapmak gereksiz olurdu.
  // Ordusu HİÇ olmayan oyuncu için de çalışır: "ne kadar asker lazım"
  // sorusunun en çok sorulduğu an, henüz tek askeri olmayan andır.
  if (enIyi && !enIyi.kazanir) {
    const tumOrdu = await prisma.armyUnit.findMany({ where: { lordId } });
    const kullanilan = armySlots(
      tumOrdu.reduce<Army>((a, u) => {
        const t = u.unitType as UnitType;
        if (UNIT_TYPES.includes(t)) a[t] = (a[t] ?? 0) + u.count;
        return a;
      }, {}),
    );
    // Eğitim kuyruğu hem YER hem PARA tutuyor. İkisi de sayılmazsa öneri
    // oyuncunun gerçekte yapamayacağı bir plan tarif ediyor:
    //  - Yer: army.ts eğitim verirken kuyruktakileri kapasiteye sayıyor
    //    (orada yıllardır öyle), burası saymıyordu; öneri "40 okçu daha"
    //    diyebiliyordu, kışla ise kapasite yok diye reddediyordu.
    //  - Para: asker eğitimine başlayan oyuncunun kesesi tanım gereği boş.
    //    Harcanmış parayı yok sayınca oyuncu TAM DA söyleneni yaptığı için
    //    hedefi "karşılanamaz" oluyor ve altından kayıyordu (omurga
    //    testinin yakaladığı hâl). Kuyruktaki para hâlâ o planın parası.
    const kuyruktakiler = await prisma.queue.findMany({
      where: { lordId, kind: 'train', resolved: false },
    });
    let kuyrukYeri = 0;
    const kuyrukMaliyeti: Resources = { altin: 0, demir: 0, erzak: 0 };
    for (const q of kuyruktakiler) {
      const p = q.payload as { unitType?: string; count?: number };
      const t = p.unitType as UnitType | undefined;
      if (!t || !UNIT_TYPES.includes(t)) continue;
      const adet = p.count ?? 0;
      const u = unit(t);
      kuyrukYeri += u.yer * adet;
      kuyrukMaliyeti.altin += u.maliyet.altin * adet;
      kuyrukMaliyeti.demir += u.maliyet.demir * adet;
      kuyrukMaliyeti.erzak += u.maliyet.erzak * adet;
    }

    const bosYer = Math.max(
      0,
      commandCapacity(lord.liderlik, saldiran.generalBonus) - kullanilan - kuyrukYeri,
    );

    const kaynak = {
      altin: lord.altin + kuyrukMaliyeti.altin,
      demir: lord.demir + kuyrukMaliyeti.demir,
      erzak: lord.erzak + kuyrukMaliyeti.erzak,
    };

    let ilkUlasilabilir: HedefOnerisi | null = null;
    let ilkKarsilanabilir: HedefOnerisi | null = null;

    for (const aday of liste.slice(0, B.oneri.ulasilabilirlik_denetimi)) {
      const hedef = hedefKur(aday);
      const eksik = eksikOrdu(
        (ordu) => ({ ...saldiran, units: ordu }),
        evOrdusu,
        npcDefender(hedef.garrison, hedef.type, hedef.level),
        onizlemeTohumu(lordId, hedef.regionId),
        bosYer,
        kaynak,
      );
      if (!eksik) continue;
      if (!ilkUlasilabilir) ilkUlasilabilir = { ...hedef, eksik };
      if (eksik.karsilanabilir) {
        ilkKarsilanabilir = { ...hedef, eksik };
        break;
      }
    }

    // Karşılanabilen varsa o, yoksa ilk ulaşılabilir.
    //
    // eksikOrdu bu tercihi bir hedefin İÇİNDE zaten yapıyordu (birim tipleri
    // arasında); HEDEFLER arasında yapmıyordu. Doğum yerlerinin hepsi
    // tarandığında (ring 4'te 24 çapa var, pickHomeAnchor sırayla dolaşıyor)
    // 6'sında — tam olarak KALE çapalarında — oyuncuya kuramayacağı bir ordu
    // tarif ediliyordu: 35 okçu = 5250 altın, başlangıç altını 5000. Yani
    // her dört yeni oyuncudan birinin gördüğü İLK talimat duvara çarpıyordu.
    // "Gelir birikince yaparsın" ise docs/09'un "hiçbir ekran bekle demesin"
    // kuralının tam tersi.
    //
    // Eski not hedefin oyuncunun altından kaymasından korkuyordu: oyun bir
    // hedef gösterir, oyuncu asker eğitir, altını azalır, oyun başka bir
    // hedef gösterir. Korku HAKLIYDI — ama sebebi tercih kuralı değil,
    // kuyruğun görünmemesiydi. Kuyruktaki para ve yer yukarıda hesaba
    // katıldıktan sonra oyuncu söyleneni yaparken hedefi sabit kalıyor;
    // tools/ilk-hedef-testi.mjs "eğitim sürerken hedef DEĞİŞMİYOR" diye
    // ayrıca ölçüyor.
    //
    // Denenip ELENEN yol: "eğitim varsa tercihi kapat" freni. İşe
    // yaramadı, çünkü frenin kendisi kural değiştiriyordu — plan
    // karşılanabilirlik kuralıyla kurulup ulaşılabilirlik kuralıyla
    // sürdürülünce hedef yine kayıyordu (24 oyuncunun 6'sında).
    //
    // Ölçüm not düşülmeye değer: "ulasilabilirlik_denetimi'yi büyüt" de
    // denendi, hiçbir şeyi düzeltmedi — döngü ilk ULAŞILABİLİR adayda
    // kırılıyor, listeye kuyruktan aday eklemek ilki değiştirmiyor. Sorun
    // aday sayısı değil, sıralamadaki tercih kuralıydı.
    const secilen = ilkKarsilanabilir ?? ilkUlasilabilir;
    if (secilen) enIyi = secilen;
  }

  return enIyi;
}

/*
 * Örnekleme (`savasOrneklemesi`, `taramaSonucu`, `onizlemeTohumu`) artık
 * `@lordlar/shared` içinde: hepsi saf ve veritabanına hiç dokunmuyor.
 * Burada duruyorken birim testleri `prisma`yı da yüklüyor, yani
 * DATABASE_URL istiyordu (CI'nın veritabanısız hızlı işi bunun üstünde
 * kaldı). Yeniden dışa aktarılıyorlar: çağıran hiçbir yer değişmedi.
 */
export { onizlemeTohumu, savasOrneklemesi, taramaSonucu };
export type { SavasOrneklemesi, TaramaSonucu };

export interface EksikOrdu {
  birim: UnitType;
  adet: number;
  maliyet: Resources;
  /** Mevcut kaynakla bu ordu kurulabilir mi. */
  karsilanabilir: boolean;
}

/**
 * "Bölgeyi almak için ne kadar asker daha lazım?"
 *
 * Cevabı tahmin etmiyor, arıyor: her birim tipinden kaç tane eklenirse savaş
 * FETİHLE biter — ikili aramayla bulunuyor, sonra en UCUZ seçenek dönüyor.
 * Böylece cevap oyunun kendi savaş motorundan çıkıyor ve denge değişince
 * kendiliğinden güncelleniyor.
 *
 * İki kısıt birden gözetiliyor:
 *  - Komuta kapasitesi: oyuncunun taşıyamayacağı orduyu tarif etmenin anlamı
 *    yok.
 *  - Kaynak: yalnızca en ucuz birime bakıp kapasiteye göre saymak, oyuncunun
 *    parasının yetmediği bir tavsiye üretiyordu ("57 milis daha" derken
 *    kesesinde 56'lık altın vardı). Karşılanamayan tavsiye, tavsiye yokluğundan
 *    kötüdür: oyuncuya yapamayacağı bir şeyi yaptırmaya çalışır.
 *
 * En ucuz birim her zaman en verimli birim değil — okçu altın başına milisten
 * daha çok saldırı gücü verir — bu yüzden bütün tipler deneniyor.
 */
function eksikOrdu(
  taraf: (ordu: Army) => Side,
  mevcut: Army,
  savunan: Side,
  seed: string,
  bosYer: number,
  kaynak: Resources,
): EksikOrdu | null {
  const baglam = {
    defenderStore: { altin: 0, demir: 0, erzak: 0 },
    attackerCunning: 0,
    canCapture: true,
  };

  const adaylar: EksikOrdu[] = [];

  for (const t of UNIT_TYPES) {
    const u = unit(t);
    const tavan = Math.floor(bosYer / Math.max(1, u.yer));
    if (tavan <= 0) continue;

    const alirMi = (ek: number) =>
      savasOrneklemesi(taraf({ ...mevcut, [t]: (mevcut[t] ?? 0) + ek }), savunan, seed, baglam)
        .fetihOrani >= B.oneri.guvenli_fetih_orani;

    if (!alirMi(tavan)) continue; // kapasite dolsa bile bu birimle olmuyor

    let alt = 1;
    let ust = tavan;
    while (alt < ust) {
      const orta = Math.floor((alt + ust) / 2);
      if (alirMi(orta)) ust = orta;
      else alt = orta + 1;
    }

    // Güvenlik payı: dokuz örneğin hepsi fetihle bitse bile onuncu tohum
    // farklı düşebilir. Oyuncu oyunun dediğini yapıp bölgeyi alamazsa,
    // düzeltmeye çalıştığımız hayal kırıklığını oyunun kendisi üretmiş olur.
    // Güvenlik payı kapasiteye sığmıyorsa bu seçenek TAVSİYE EDİLEMEZ.
    // Payı sessizce kırpmak, payın tam da gerektiği yerde — kapasitenin
    // sınırında — ortadan kalkması demekti: oyuncuya "tam 90 milis yeter"
    // denip savaşın kıl payı kaybedilmesi.
    const adet = Math.ceil(alt * (1 + B.oneri.guvenlik_payi));
    if (adet > tavan) continue;
    const maliyet: Resources = {
      altin: u.maliyet.altin * adet,
      demir: u.maliyet.demir * adet,
      erzak: u.maliyet.erzak * adet,
    };
    adaylar.push({
      birim: t,
      adet,
      maliyet,
      karsilanabilir:
        maliyet.altin <= kaynak.altin &&
        maliyet.demir <= kaynak.demir &&
        maliyet.erzak <= kaynak.erzak,
    });
  }

  if (adaylar.length === 0) return null;

  // Önce karşılanabilenler, sonra en ucuz. Karşılanabilir hiçbiri yoksa en
  // ucuzu dönüyor ve arayüz eksik kaynağı söylüyor — sessizce vazgeçmiyor.
  adaylar.sort((a, b) => {
    if (a.karsilanabilir !== b.karsilanabilir) return a.karsilanabilir ? -1 : 1;
    return altinKarsiligi(a.maliyet) - altinKarsiligi(b.maliyet);
  });
  return adaylar[0]!;
}

export interface FetihOdulu {
  /** Bölgenin saatlik üretimi. */
  saatlikGelir: { altin: number; demir: number; erzak: number; sohret: number };
  /** Bu bölgeyle lordun toplam saatlik geliri ne olur. */
  toplamGelirOncesi: { altin: number; demir: number; erzak: number };
  toplamGelirSonrasi: { altin: number; demir: number; erzak: number };
  sohretOncesi: number;
  sohretSonrasi: number;
  siraOncesi: number;
  siraSonrasi: number;
  xp: number;
  bolgeOncesi: number;
  bolgeSonrasi: number;
  bolgeLimiti: number;
  /** Limit dolu: kazansa bile bölgeyi alamaz, sadece yağmalar. */
  limitDolu: boolean;
}

/**
 * "Bu bölgeyi alırsan ne olur?"
 *
 * Şöhret ve sıra tahmin edilmez, hesaplanır: şöhret formülü hedef bölge
 * listeye eklenmiş hâliyle ikinci kez çalıştırılır, sıra da dünyadaki
 * gerçek şöhret listesine bakılarak bulunur.
 */
export async function fetihOdulu(
  lordId: string,
  region: { type: string; level: number; incomeMult: number; province: string },
): Promise<FetihOdulu> {
  const lord = await prisma.lord.findUniqueOrThrow({
    where: { id: lordId },
    include: { regions: true, items: true, units: true },
  });

  const ordu: Army = {};
  for (const u of lord.units) {
    const t = u.unitType as UnitType;
    if (UNIT_TYPES.includes(t)) ordu[t] = (ordu[t] ?? 0) + u.count;
  }
  const ekipman = totalEquipmentPower(
    lord.items
      .filter((i) => i.equipped)
      .map((i) => ({
        slot: i.slot as EquipSlot,
        tier: i.tier,
        rarity: i.rarity as Rarity,
        upgradeLevel: i.upgradeLevel,
      })),
  );

  const kazanc = fetihKazanci({
    lordLevel: lord.level,
    regions: lord.regions.map((r) => ({ type: r.type, level: r.level })),
    hedef: region,
    totalEquipmentPower: ekipman,
    army: ordu,
    pvpWins: lord.pvpWins,
    fortressFameAccrued: lord.fortressFameAccrued,
    ownsThrone: lord.regions.some((r) => r.type === 'taht'),
  });

  // Sıra tahmini: kendi satırım listeden çıkarılır, yoksa yeni şöhretim
  // eski şöhretimle kıyaslanıp bir sıra fazla sayılır.
  const rakipler = await prisma.lord.findMany({
    where: { worldId: lord.worldId, id: { not: lordId } },
    select: { fame: true },
    orderBy: { fame: 'desc' },
  });
  const puanlar = rakipler.map((r) => r.fame);

  /**
   * Gelir, VİLAYET BİRLİĞİ dahil hesaplanıyor (docs/11 §1.2 H2).
   *
   * Naif hesap "eski gelir + hedefin geliri"dir ve bonusu tam da oyuncunun
   * karar verdiği yerde gizler: aynı vilayetten ikinci bölgeyi almak
   * yalnız o bölgeyi değil, oradaki ÖNCEKİ bölgeni de büyütüyor. Söylenmezse
   * oyuncu kararını eksik bilgiyle veriyor ve "her eylem karşılığını
   * önceden söylesin" kuralı (docs/08 İ1) delinmiş oluyor.
   */
  function gelirToplami(
    bolgeler: { type: string; level: number; incomeMult: number; province: string }[],
  ) {
    const vilayet = vilayetSayilari(bolgeler);
    return topla(
      bolgeler.map((r) =>
        regionIncome(r.type, r.level, r.incomeMult * vilayetCarpani(vilayet[r.province] ?? 1)),
      ),
    );
  }

  const oncekiler = lord.regions.map((r) => ({
    type: r.type,
    level: r.level,
    incomeMult: r.incomeMult,
    province: r.province,
  }));
  const gelirOncesi = topla(oncekiler.map((r) => regionIncome(r.type, r.level, r.incomeMult)));
  const hedefGelir = regionIncome(region.type, region.level, region.incomeMult);
  const bolgeSayisi = lord.regions.filter((r) => r.type !== 'taht').length;
  const limit = maxRegions(lord.level);
  const limitDolu = bolgeSayisi >= limit && region.type !== 'taht';

  return {
    saatlikGelir: yuvarla4(hedefGelir),
    toplamGelirOncesi: yuvarla3(gelirOncesi),
    toplamGelirSonrasi: yuvarla3(
      limitDolu
        ? gelirOncesi
        : gelirToplami([
            ...oncekiler,
            {
              type: region.type,
              level: region.level,
              incomeMult: region.incomeMult,
              province: region.province,
            },
          ]),
    ),
    sohretOncesi: kazanc.sohretOncesi,
    sohretSonrasi: kazanc.sohretSonrasi,
    siraOncesi: siraTahmini(puanlar, kazanc.sohretOncesi),
    siraSonrasi: siraTahmini(puanlar, kazanc.sohretSonrasi),
    xp: kazanc.xp,
    bolgeOncesi: bolgeSayisi,
    bolgeSonrasi: limitDolu ? bolgeSayisi : bolgeSayisi + (region.type === 'taht' ? 0 : 1),
    bolgeLimiti: limit,
    limitDolu,
  };
}

function topla(list: { altin: number; demir: number; erzak: number }[]) {
  return list.reduce(
    (a, r) => ({ altin: a.altin + r.altin, demir: a.demir + r.demir, erzak: a.erzak + r.erzak }),
    { altin: 0, demir: 0, erzak: 0 },
  );
}

function yuvarla3(r: { altin: number; demir: number; erzak: number }) {
  return { altin: Math.round(r.altin), demir: Math.round(r.demir), erzak: Math.round(r.erzak) };
}

function yuvarla4(r: { altin: number; demir: number; erzak: number; sohret: number }) {
  return { ...yuvarla3(r), sohret: Math.round(r.sohret) };
}

export interface EkipmanEtkisi {
  /** Lordun savaşa kattığı güç — ekipmanın gerçekte etkilediği sayı. */
  katkiOncesi: number;
  katkiSonrasi: number;
  sohretOncesi: number;
  sohretSonrasi: number;
  /** Karşılaştırmanın yapıldığı gerçek hedef; ordu ya da hedef yoksa null. */
  hedef: { regionId: number; name: string } | null;
  /**
   * Savaş karşılaştırması neden yapılamadı. "Ordu kur" ile "ordun yolda"
   * aynı şey değil; ikisine aynı cümleyi söylemek oyuncuya sahip olduğu
   * orduyu yokmuş gibi göstermek olurdu.
   */
  neden: 'ordu_yok' | 'ordu_yolda' | 'hedef_yok' | null;
  kayipOncesi: number;
  kayipSonrasi: number;
  kazanirOncesi: boolean;
  kazanirSonrasi: boolean;
}

type EsyaKaydi = {
  slot: string;
  tier: number;
  rarity: string;
  upgradeLevel: number;
  equipped: boolean;
};

function kusanik(items: EsyaKaydi[]) {
  return items
    .filter((i) => i.equipped)
    .map((i) => ({
      slot: i.slot as EquipSlot,
      tier: i.tier,
      rarity: i.rarity as Rarity,
      upgradeLevel: i.upgradeLevel,
    }));
}

/**
 * "Bu eşyayı kuşanınca ne değişti?"
 *
 * Demirhane eskiden "+172 güç" diyordu ve o sayının neye yaradığı hiçbir
 * ekranda yazmıyordu — oyuncunun "gücüm arttı, eee ne oldu şimdi" dediği
 * yer tam olarak burasıydı. Ekipman gücü tek başına soyut; anlam kazandığı
 * yer savaş. Bu yüzden fark, haritadaki GERÇEK bir hedefe karşı beklenen
 * kayıpla birlikte hesaplanıyor. (docs/08 İ2)
 */
export async function ekipmanEtkisi(
  lordId: string,
  oncekiEsyalar: EsyaKaydi[],
  sonrakiEsyalar: EsyaKaydi[],
): Promise<EkipmanEtkisi> {
  const lord = await prisma.lord.findUniqueOrThrow({
    where: { id: lordId },
    include: { regions: true, units: true, gearLines: true, generals: true },
  });

  const onceki = kusanik(oncekiEsyalar);
  const sonraki = kusanik(sonrakiEsyalar);

  const tumOrdu: Army = {};
  const evOrdusu: Army = {};
  for (const u of lord.units) {
    const t = u.unitType as UnitType;
    if (!UNIT_TYPES.includes(t)) continue;
    tumOrdu[t] = (tumOrdu[t] ?? 0) + u.count;
    if (u.locationType === 'home') evOrdusu[t] = (evOrdusu[t] ?? 0) + u.count;
  }

  const sohret = (esyalar: typeof onceki) =>
    calculateFame({
      lordLevel: lord.level,
      regions: lord.regions.map((r) => ({ type: r.type, level: r.level })),
      totalEquipmentPower: totalEquipmentPower(esyalar),
      army: tumOrdu,
      pvpWins: lord.pvpWins,
      fortressFameAccrued: lord.fortressFameAccrued,
      ownsThrone: lord.regions.some((r) => r.type === 'taht'),
    });

  const temel: EkipmanEtkisi = {
    katkiOncesi: Math.round(lordContribution(lord.guc, onceki)),
    katkiSonrasi: Math.round(lordContribution(lord.guc, sonraki)),
    sohretOncesi: sohret(onceki),
    sohretSonrasi: sohret(sonraki),
    hedef: null,
    neden: null,
    kayipOncesi: 0,
    kayipSonrasi: 0,
    kazanirOncesi: false,
    kazanirSonrasi: false,
  };

  // Evde ordu yoksa karşılaştırma yapılamaz; ama sebebi ayırt ediliyor.
  if (armyCount(evOrdusu) === 0) {
    return { ...temel, neden: armyCount(tumOrdu) > 0 ? 'ordu_yolda' : 'ordu_yok' };
  }

  const oneri = await onerilenHedef(lordId);
  if (!oneri) return { ...temel, neden: 'hedef_yok' };

  const sahada = equippedGenerals(lord.generals, new Date());
  const taraf = (esyalar: typeof onceki): Side => ({
    units: evOrdusu,
    gearBonus: gearBonusFrom(lord.gearLines),
    generalBonus: sahada.length ? aggregateGeneralBonus(sahada) : bosGeneralBonus(),
    lordContribution: lordContribution(lord.guc, esyalar),
    leadership: lord.liderlik,
    fortressBonus: 0,
    isDefender: false,
  });

  // İKİ simülasyon da AYNI seed'i kullanır. Farklı seed, ekipman farkını
  // rastgelelikle karıştırır ve karşılaştırmayı yalancı çıkarır.
  const seed = `ekipman-${lordId}-${oneri.regionId}`;
  const baglam = {
    defenderStore: { altin: 0, demir: 0, erzak: 0 },
    attackerCunning: lord.kurnazlik,
    canCapture: true,
  };
  const savunan = npcDefender(oneri.garrison, oneri.type, oneri.level);
  const a = simulateBattle(taraf(onceki), savunan, seed, baglam);
  const b = simulateBattle(taraf(sonraki), savunan, seed, baglam);

  return {
    ...temel,
    hedef: { regionId: oneri.regionId, name: oneri.name },
    kayipOncesi: armyCount(a.attackerLosses),
    kayipSonrasi: armyCount(b.attackerLosses),
    kazanirOncesi: a.winner === 'attacker',
    kazanirSonrasi: b.winner === 'attacker',
  };
}
