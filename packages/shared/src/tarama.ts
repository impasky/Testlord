/**
 * ÖRNEKLEME — aynı savaşı birkaç kez çalıştırıp dağılımı okumak.
 *
 * NEDEN BURADA: bu dosyadaki her şey saf. Veritabanı yok, istek yok,
 * yalnız savaş motoru ve `balance.json` eşikleri. Bir süre
 * `apps/api/src/services/hedef.ts` içinde durdu ve orada olmasının bir
 * bedeli vardı: testi yazınca ortaya çıktı — dosya `prisma`yı da
 * yüklüyordu, yani örneklemenin birim testi DATABASE_URL istiyordu.
 * CI'nın veritabanısız hızlı işi tam da bunun üstünde kaldı.
 *
 * Saf mantık saf pakette durmalı. API tarafı bunları yeniden dışa
 * aktarıyor, çağıran hiçbir yer değişmedi.
 */
import { B } from './balance.js';
import { armyCount, simulateBattle } from './combat.js';
import type { Side } from './types.js';

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

/** Aday taramasının tek bir bölge için verdiği cevap. */
export interface TaramaSonucu {
  /** Örneğin HEPSİ fetihle bitti mi — öneri şeridinin "ordun yetiyor"u. */
  kazanir: boolean;
  /** Savaşı kazanır ama bölgeyi alamaz. */
  darZafer: boolean;
  /** Kazanırsa geriye kaç birim kalır. Kazanmıyorsa anlamsız, 0. */
  kalan: number;
}

/**
 * Aday taraması: `savasOrneklemesi` ile AYNI cevap, daha az savaş.
 *
 * NEDEN VAR: harita ucu her açılışta sahipsiz bölgelerin hepsini tarıyor.
 * 61 bölgede bu dokuz yüz savaştı ve kimse fark etmedi; diyar 121 bölgeye
 * çıkınca bin yetmiş oldu ve ölçüldü: istek başına ~17 ms, üstelik olay
 * döngüsünü BLOKE ederek. Otuz eşzamanlı oyuncuda bu, sona kalanın yarım
 * saniyeden fazla sırada beklemesi demek — yük testinde p95 1 sn eşiğini
 * geçen şey buydu.
 *
 * Cevabı bozmadan nasıl kısalıyor: eşikler bir ORANA bakıyor, orana ise
 * kalan örneklerin hepsi lehte ya da aleyhte düşse bile erişilemeyeceği bir
 * an geliyor. O andan sonra çalıştırılan savaş cevabı değiştiremez.
 *
 *   guvenli_fetih_orani 1.0  -> tek bir örnek fethedemezse `kazanir` bitti,
 *   muhtemel_kazanma_orani   -> dört yenilgide `darZafer` de imkânsız.
 *
 * Yani ordusu yetmeyen bir hedef dokuz yerine dört savaşta kapanıyor;
 * gerçekten alınabilen hedef zaten dokuzunu da koşuyor (ortancaya, yani
 * `kalan`a ihtiyaç var). Eşikler `data/balance.json`dan okunuyor, burada
 * kopyası yok: oran değişirse kısa devre de kendiliğinden değişir.
 *
 * `kalan` yalnız `kazanir` iken anlamlı: "kazanırsan geriye ne kalır"
 * sorusunun kaybedilen savaşta cevabı yok. Erken çıkışta 0 dönüyor.
 */
export function taramaSonucu(
  saldiran: Side,
  savunan: Side,
  seedTaban: string,
  baglam: Parameters<typeof simulateBattle>[3],
): TaramaSonucu {
  const sonuclar: ReturnType<typeof simulateBattle>[] = [];
  let fetih = 0;
  let kazanan = 0;

  for (let i = 0; i < ORNEK; i++) {
    const r = simulateBattle(saldiran, savunan, `${seedTaban}-${i}`, baglam);
    sonuclar.push(r);
    if (r.captured) fetih++;
    if (r.winner === 'attacker') kazanan++;

    const kalanOrnek = ORNEK - sonuclar.length;
    // En iyi ihtimalle ulaşılabilecek oran; buna bile yetmiyorsa cevap "hayır".
    const fetihMumkun = (fetih + kalanOrnek) / ORNEK >= B.oneri.guvenli_fetih_orani;
    const zaferMumkun = (kazanan + kalanOrnek) / ORNEK >= B.oneri.muhtemel_kazanma_orani;
    // En kötü ihtimalde bile aşılan oran; aşıldıysa cevap "evet".
    const zaferKesin = kazanan / ORNEK >= B.oneri.muhtemel_kazanma_orani;
    if (!fetihMumkun && (zaferKesin || !zaferMumkun)) {
      return { kazanir: false, darZafer: zaferKesin, kalan: 0 };
    }
  }

  const kazanir = fetih / ORNEK >= B.oneri.guvenli_fetih_orani;
  const sirali = [...sonuclar].sort(
    (a, b) => armyCount(a.attackerSurvivors) - armyCount(b.attackerSurvivors),
  );
  return {
    kazanir,
    darZafer: !kazanir && kazanan / ORNEK >= B.oneri.muhtemel_kazanma_orani,
    kalan: armyCount(sirali[Math.floor(ORNEK / 2)]!.attackerSurvivors),
  };
}
