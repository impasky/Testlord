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
  hexDistance,
  lordContribution,
  marchDurationSec,
  maxRegions,
  calculateFame,
  regionIncome,
  armyPower,
  armySlots,
  commandCapacity,
  simulateBattle,
  siraTahmini,
  unit,
  totalEquipmentPower,
  type Army,
  type EquipSlot,
  type Rarity,
  type Resources,
  type Side,
  type UnitType,
} from '@lordlar/shared';
import { prisma, type Tx } from '../db.js';
import { equippedGenerals, gearBonusFrom } from './lord.js';
import { regionFortressBonus } from './region.js';

/** Lordun savaş tarafını kurar (ekipman, donanım, generaller dahil). */
export async function lordSide(
  lordId: string,
  army: Army,
  generalKeys: string[],
  client: Tx = prisma,
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
  return {
    units: army,
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

  const [saldiran, yuruyusSayisi, bolgeSayisi, adaylar] = await Promise.all([
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
  ]);

  const limitDolu = bolgeSayisi >= maxRegions(lord.level);
  const ilkYuruyus = yuruyusSayisi === 0;

  const sirali: { puan: number; hedef: HedefOnerisi }[] = [];

  for (const r of adaylar) {
    const garrison: Army = {};
    const ham = (r.npcGarrison ?? {}) as Record<string, number>;
    for (const t of UNIT_TYPES) if ((ham[t] ?? 0) > 0) garrison[t] = ham[t]!;

    // Ordu boşsa savaş simülasyonu anlamsız — sonuç baştan bellidir.
    //
    // Tarama da ÖRNEKLEME kullanıyor ve önizlemeyle aynı tohum tabanından
    // gidiyor. Tek kurayla taramak, şanslı bir tohum düşen alınamaz bir
    // şehri gerçekten alınabilir bir tarlanın önüne geçiriyordu: sıralamayı
    // güvenilmeyen sayı, cevabı güvenilen sayı veriyordu ve ikisi
    // birbirini tutmuyordu. 61 bölge × 9 savaş ≈ 9 ms; bu tutarlılığın
    // bedeli olarak kabul edilebilir.
    let kazanir = false;
    let darZafer = false;
    let kalan = 0;
    if (orduVar) {
      const ornek = savasOrneklemesi(
        saldiran,
        npcDefender(garrison, r.type, r.level),
        onizlemeTohumu(lordId, r.id),
        { defenderStore: { altin: 0, demir: 0, erzak: 0 }, attackerCunning: 0, canCapture: true },
      );
      kazanir = ornek.fetihOrani >= B.oneri.guvenli_fetih_orani;
      darZafer = !kazanir && ornek.kazanmaOrani >= B.oneri.muhtemel_kazanma_orani;
      kalan = armyCount(ornek.ortanca.attackerSurvivors);
    }

    const distance = hexDistance({ q: lord.homeQ, r: lord.homeR }, { q: r.q, r: r.r });
    const ilkSaldiri = ilkYuruyus && distance <= B.yuruyus.ilk_saldiri_max_hex;
    // Ordu boşken hız referansı kullanılır (marchDurationSec'in kendi
    // davranışı); gösterilen süre "bu mesafe kabaca ne kadar" demektir.
    const marchSec = marchDurationSec(distance, evOrdusu, saldiran.generalBonus, { ilkSaldiri });

    const gelir = regionIncome(r.type, r.level, r.incomeMult);

    // İki ayrı sıralama, çünkü iki ayrı soru soruluyor:
    //
    //  - Kazanılabilen hedefler arasında soru "hangisi en kârlı": saat
    //    başına düşen değer kazanır, yakın ve verimli hedef uzak ve zengin
    //    hedefi yener.
    //  - Kazanılamıyorsa soru "hangisi ulaşabileceğim ilk basamak":
    //    önce YAKINLIK, sonra en ZAYIF savunma. Değere göre sıralamak
    //    ordusu olmayan oyuncuya 160 birimlik şehri gösteriyordu; zayıf
    //    garnizonu öne almak ise 6 hex uzaktaki bir bölgeyi — yani tam
    //    da düzeltmeye çalıştığımız "ordumu yolladım, bir saat sonra
    //    dönerim" deneyimini. Yeni oyuncunun ilk hedefi yürüme mesafesinde
    //    olmalı.
    //
    //    Zorluk ölçüsü birim SAYISI değil savunma GÜCÜ: aynı 37 birimlik
    //    garnizon bir kalede tahkimat bonusuyla çok daha zor. Sayıya bakmak,
    //    oyuncuya hiçbir ordunun alamayacağı bir kaleyi hedef gösteriyordu.
    //
    //  - Oyuncunun İLK saldırısında yakınlık her şeyin önüne geçer. Değer
    //    sıralaması, ordusunu yeni kurmuş bir oyuncuyu 4 hex öteye, 57
    //    dakikalık bir yürüyüşe yollayabiliyordu — yani "saldırıya
    //    gönderdim, eee ne oldu şimdi" duygusunun ta kendisine. İlk
    //    saldırı kısayolunun geçerli olduğu hedef öne alınıyor.
    const saat = Math.max(marchSec, 60) / 3600;
    const savunmaGucu = armyPower(garrison) * (1 + regionFortressBonus(r.type, r.level));
    const puan = kazanir
      ? 1e9 + (ilkSaldiri ? 1e6 : 0) + altinKarsiligi(gelir) / saat + kalan
      : -distance * 1000 - savunmaGucu / 1000;


    sirali.push({
      puan,
      hedef: {
        regionId: r.id,
        name: r.name,
        type: r.type,
        level: r.level,
        distance,
        marchSec,
        ilkSaldiri,
        orduVar,
        kazanir,
        darZafer,
        eksik: null,
        kalanBirim: kalan,
        garrison,
        saatlikGelir: {
          altin: Math.round(gelir.altin),
          demir: Math.round(gelir.demir),
          erzak: Math.round(gelir.erzak),
          sohret: Math.round(gelir.sohret),
        },
        sohretFarki: fetihKazanci({
          lordLevel: lord.level,
          regions: lord.regions.map((x) => ({ type: x.type, level: x.level })),
          hedef: { type: r.type, level: r.level, incomeMult: r.incomeMult },
          totalEquipmentPower: 0,
          army: {},
          pvpWins: lord.pvpWins,
          fortressFameAccrued: lord.fortressFameAccrued,
          ownsThrone: lord.regions.some((x) => x.type === 'taht'),
        }).sohretFarki,
        limitDolu,
      },
    });
  }

  sirali.sort((a, b) => b.puan - a.puan);
  let enIyi = sirali[0]?.hedef ?? null;

  // Aday taraması tek simülasyonla yapılır (60 bölge × 9 örnek gereksiz);
  // ama SEÇİLEN hedefin "alınır mı" cevabı örneklemeyle veriliyor ve
  // önizlemeyle AYNI tohum tabanını kullanıyor — böylece öneri şeridi ile
  // saldırı önizlemesi aynı ekranda birbirine ters düşemiyor.
  // --- Ulaşılabilirlik denetimi ---
  //
  // En yakın hedef, alınabilir hedef olmak zorunda değil. Ring 4'teki bir
  // KALE ile bir TARLA aynı 37 birimi barındırıyor ama kalenin tahkimatı
  // onu 1. seviye bir lord için imkânsız kılıyor. Mesafe sıralamada baskın
  // olduğu için, kale hex'inde doğan oyuncuya hiçbir orduyla alamayacağı
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

    for (const { hedef } of sirali.slice(0, B.oneri.ulasilabilirlik_denetimi)) {
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


/** Önizleme örneklemesinde kaç savaş çalıştırılır. */
const ORNEK = B.oneri.ornek_savas_sayisi;

/**
 * Öneri, önizleme ve ekipman karşılaştırması AYNI tohum tabanını kullanır.
 * Ayrı tohumlar aynı savaşa üç farklı cevap üretiyordu.
 */
export function onizlemeTohumu(lordId: string, regionId: number): string {
  return `preview-${lordId}-${regionId}`;
}

export interface SavasOrneklemesi {
  kazanmaOrani: number;
  fetihOrani: number;
  /** Örneklemin ortancasına en yakın savaş — kayıp/yağma rakamları bundan. */
  ortanca: ReturnType<typeof simulateBattle>;
}

/**
 * Aynı savaşı birkaç kez çalıştırıp sonucun DAĞILIMINI verir.
 *
 * Savaşta her turda ±%7 tohumlu varyans var (balance.json
 * savas.rastgelelik_bandi). Tek bir simülasyon bu yüzden bir tahmin değil,
 * bir kura sonucu: fetih eşiğinin (R ≥ 0,60) yakınında aynı ordu bir seferde
 * bölgeyi alır, bir seferde almaz.
 *
 * Bunun iki somut zararı vardı:
 *  - Öneri şeridi "ordun yetiyor" derken önizleme "bölge el değiştirmez"
 *    diyebiliyordu; ikisi ayrı tohum kullanıyordu ve oyuncu aynı ekranda
 *    çelişen iki cümle görüyordu.
 *  - Önizleme "BÖLGE ELE GEÇER" deyip gerçek savaş bölgeyi vermeyebiliyordu.
 *    Tutulmayan söz, düzeltmeye çalıştığımız hayal kırıklığının ta kendisi.
 *
 * Örnekleme ikisini de çözüyor: hem öneri hem önizleme aynı dağılımı okuyor,
 * hem de oyuncuya kesinlik yerine ihtimal söylenebiliyor.
 */
export function savasOrneklemesi(
  saldiran: Side,
  savunan: Side,
  seedTaban: string,
  baglam: Parameters<typeof simulateBattle>[3],
): SavasOrneklemesi {
  const sonuclar = Array.from({ length: ORNEK }, (_, i) =>
    simulateBattle(saldiran, savunan, `${seedTaban}-${i}`, baglam),
  );
  const kazanan = sonuclar.filter((r) => r.winner === 'attacker').length;
  const fetih = sonuclar.filter((r) => r.captured).length;
  const sirali = [...sonuclar].sort(
    (a, b) => armyCount(a.attackerSurvivors) - armyCount(b.attackerSurvivors),
  );
  return {
    kazanmaOrani: kazanan / ORNEK,
    fetihOrani: fetih / ORNEK,
    ortanca: sirali[Math.floor(ORNEK / 2)]!,
  };
}

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
  region: { type: string; level: number; incomeMult: number },
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

  const gelirOncesi = topla(lord.regions.map((r) => regionIncome(r.type, r.level, r.incomeMult)));
  const hedefGelir = regionIncome(region.type, region.level, region.incomeMult);
  const bolgeSayisi = lord.regions.filter((r) => r.type !== 'taht').length;
  const limit = maxRegions(lord.level);
  const limitDolu = bolgeSayisi >= limit && region.type !== 'taht';

  return {
    saatlikGelir: yuvarla4(hedefGelir),
    toplamGelirOncesi: yuvarla3(gelirOncesi),
    toplamGelirSonrasi: yuvarla3({
      altin: gelirOncesi.altin + hedefGelir.altin,
      demir: gelirOncesi.demir + hedefGelir.demir,
      erzak: gelirOncesi.erzak + hedefGelir.erzak,
    }),
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

type EsyaKaydi = { slot: string; tier: number; rarity: string; upgradeLevel: number; equipped: boolean };

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
