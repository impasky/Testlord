/**
 * "Bunu yaparsam ne kazanırım, ne kaybederim?"
 *
 * Oyunun en büyük eksiği bir mekanik değil, bir cümleydi: oyuncu bir eyleme
 * karar verirken karşılığını hiçbir yerde göremiyordu. Savaş önizlemesi
 * "ZAFER" ve kayıp sayısı gösteriyordu; bölgeyi alınca ne olacağını
 * söylemiyordu. Demirhane "+172 güç" diyordu; o gücün neye yaradığını
 * söylemiyordu.
 *
 * Buradaki her şey SAF: veritabanı, saat ve rastgelelik yok. Sunucu ve
 * istemci aynı sayıyı üretir. (docs/08 İ1, İ2)
 */
import { B, unit } from './balance.js';
import { upkeepPerHour } from './economy.js';
import { calculateFame, armySlots, captureXp } from './progression.js';
import type { Army, GeneralBonus, Resources } from './types.js';
import { UNIT_TYPES } from './types.js';

/** Bir kaynağın altın cinsinden kabaca karşılığı — sıralama/karşılaştırma için. */
export function altinKarsiligi(r: Resources): number {
  const k = B.kaynaklar.altin_karsiligi;
  return r.altin * k.altin + r.demir * k.demir + r.erzak * k.erzak;
}

export interface FetihKazanciGirdi {
  lordLevel: number;
  /** Şu anda sahip olunan bölgeler. */
  regions: { type: string; level: number }[];
  /** Ele geçirilecek bölge. */
  hedef: { type: string; level: number; incomeMult: number };
  totalEquipmentPower: number;
  /** Şöhret hesabına giren tüm birimler (ev + garnizon + yürüyüş). */
  army: Army;
  pvpWins: number;
  fortressFameAccrued: number;
  ownsThrone: boolean;
  /** Tahtı tutan medeniyet benimki mi (docs/16 §13 soru 5). */
  medeniyetTahti: boolean;
}

export interface FetihKazanci {
  sohretOncesi: number;
  sohretSonrasi: number;
  sohretFarki: number;
  /** Ele geçirmenin verdiği XP. */
  xp: number;
}

/**
 * Bir bölgeyi ele geçirmenin ŞÖHRET karşılığı.
 *
 * Şöhret farkı gerçekten hesaplanır (formül tahmin edilmez): mevcut bölge
 * listesine hedef eklenip `calculateFame` iki kez çağrılır.
 *
 * GELİR burada DÖNMÜYOR ve dönmemeli. Bir `saatlikGelir` alanı vardı, hiçbir
 * çağıran onu okumuyordu (ikisi de geliri kendi hesaplıyor) ve vilayet
 * birliğini saymadığı için YANLIŞTI. Okunmayan yanlış bir alan, bir gün
 * okunacak yanlış bir alandır; gelir hesabı tek yerde (`hedef.ts`) kalsın.
 */
export function fetihKazanci(g: FetihKazanciGirdi): FetihKazanci {
  const ortak = {
    lordLevel: g.lordLevel,
    totalEquipmentPower: g.totalEquipmentPower,
    army: g.army,
    pvpWins: g.pvpWins,
    fortressFameAccrued: g.fortressFameAccrued,
  };
  const oncesi = calculateFame({
    ...ortak,
    regions: g.regions,
    ownsThrone: g.ownsThrone,
    medeniyetTahti: g.medeniyetTahti,
  });
  const sonrasi = calculateFame({
    ...ortak,
    regions: [...g.regions, { type: g.hedef.type, level: g.hedef.level }],
    /*
     * TAHTI ALMAK İKİ ÇARPANI BİRDEN AÇIYOR: hem şahsi unvan hem de
     * medeniyetinin tahtı. Önizleme ikincisini saymasaydı, oyuncuya
     * haritanın en büyük ödülünü olduğundan küçük gösterirdi.
     */
    ownsThrone: g.ownsThrone || g.hedef.type === 'taht',
    medeniyetTahti: g.medeniyetTahti || g.hedef.type === 'taht',
  });

  return {
    sohretOncesi: oncesi,
    sohretSonrasi: sonrasi,
    sohretFarki: sonrasi - oncesi,
    /*
     * XP FORMÜLÜ BURADA DEĞİL, `captureXp`te.
     *
     * Burası oyuncuya saldırı ÖNCESİ gösterilen önizleme; gerçekte
     * verilen XP `march.ts`te `captureXp(region.incomeMult)` ile
     * hesaplanıyor. İkisi `Math.round(1500 * incomeMult)`u ayrı ayrı
     * yazıyordu: aynı formülün iki kopyası, biri vitrin biri kasa.
     *
     * Hemen yukarıdaki nota bak — `saatlikGelir` alanı tam olarak bu
     * yüzden kaldırılmıştı ("gelir hesabı tek yerde kalsın") ve `xp`
     * satırı o temizliğin dışında kalmış. Biri ayarlanıp öteki
     * unutulursa önizleme oyuncuya yalan söyler.
     */
    xp: captureXp(g.hedef.incomeMult),
  };
}

export interface OrduBedeli {
  kaynak: Resources;
  saniye: number;
  yer: number;
}

/**
 * Bir orduyu sıfırdan eğitmenin bedeli.
 *
 * "~340 asker kaybedersin" tek başına soyut; "yeniden eğitmek 41.000 altın ve
 * 3 saat" somut. Kayıp, ancak yerine koymanın maliyetiyle anlaşılır.
 */
export function orduBedeli(army: Army): OrduBedeli {
  const kaynak: Resources = { altin: 0, demir: 0, erzak: 0 };
  let saniye = 0;
  for (const t of UNIT_TYPES) {
    const n = army[t] ?? 0;
    if (n <= 0) continue;
    const u = unit(t);
    kaynak.altin += u.maliyet.altin * n;
    kaynak.demir += u.maliyet.demir * n;
    kaynak.erzak += u.maliyet.erzak * n;
    saniye += u.egitim_sn * n;
  }
  return {
    kaynak: {
      altin: Math.round(kaynak.altin),
      demir: Math.round(kaynak.demir),
      erzak: Math.round(kaynak.erzak),
    },
    saniye: Math.round(saniye),
    yer: armySlots(army),
  };
}

/** Ordunun saatlik erzak gideri — kaybın "artık ödemeyeceğin" tarafı. */
export function orduBakimi(army: Army, generalBonus?: GeneralBonus): number {
  return upkeepPerHour(army, generalBonus);
}

/**
 * Bir sıralama listesinde verilen puanın kaçıncı sıraya denk geldiği.
 *
 * `puanlar` azalan sırada olmalı. Dönen değer 1 tabanlıdır.
 * Amaç kesin sıra değil, oyuncuya "kaç sıra yukarı çıkarsın" diyebilmek.
 */
export function siraTahmini(puanlar: number[], puan: number): number {
  let sira = 1;
  for (const p of puanlar) {
    if (p > puan) sira++;
    else break;
  }
  return sira;
}
