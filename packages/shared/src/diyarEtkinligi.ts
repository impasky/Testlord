/**
 * Hafta sonu diyar seferi (docs/09 §2.6): diyarın bütün lordları BİRLİKTE
 * bir hedefe yürüyor.
 *
 * Haftalık sefer (sefer.ts) kişisel bir hedef: "bu hafta sen ne yaptın".
 * Bu ortak: "bu hafta sonu diyar ne yaptı". Kendi başına oynayan oyuncu
 * da diyarın bir parçası olduğunu ilk burada görüyor — haritada
 * gördüğü adlar onunla aynı çubuğu dolduruyor.
 *
 * Seferin ilkeleri aynen:
 *
 * 1. Tema SAKLANMIYOR, hafta numarasından türetiliyor; pencere de.
 *    Sunucu yeniden başlasa da iki sunucu birden çalışsa da herkes aynı
 *    etkinliği görüyor.
 * 2. Sıralama YOK, hedef var. En çok yapan değil, KATILAN ödül alıyor:
 *    hedefe varılırsa en az bir katkısı olan herkes. Önde olanı daha
 *    ileri iten bir tablo diyarı böler; ortak çubuk birleştiriyor.
 *
 * Hedef diyarın nüfusuyla ölçekleniyor (`etkinlikHedefi`) ve nüfus
 * etkinlik BAŞLAMADAN önceki yedi günden okunuyor: hafta sonu boyunca
 * hedef oynamıyor.
 */
import { DIYAR_ETKINLIGI } from './balance.js';
import { malikaneIncome } from './economy.js';
import { gunNumarasi } from './gunluk.js';
import { haftaBasi, haftaNumarasi, haftaninGunu } from './sefer.js';
import type { Resources } from './types.js';

export type EtkinlikOlcutu = 'akin_zaferi' | 'savas_zaferi' | 'egitilen_asker';

export interface EtkinlikTanimi {
  key: string;
  ad: string;
  aciklama: string;
  olcut: EtkinlikOlcutu;
  taban: number;
  kisi_basi: number;
  birim: string;
}

export const ETKINLIKLER = DIYAR_ETKINLIGI.etkinlikler as unknown as EtkinlikTanimi[];
export const ETKINLIK_EN_AZ_KATKI: number = DIYAR_ETKINLIGI.en_az_katki;

/** yaklasiyor: hafta içi (tema belli, sayım yok) · acik: hafta sonu · odul: pazartesi, yalnız ödül. */
export type EtkinlikDurumu = 'yaklasiyor' | 'acik' | 'odul';

export interface EtkinlikPenceresi {
  tanim: EtkinlikTanimi;
  /** Cumartesi 00:00 UTC. Etkinliğin kimliği de bu an. */
  bas: Date;
  /** Pazartesi 00:00 UTC — sayımın üst sınırı (hariç). */
  son: Date;
  /** Ödülün son alınabileceği an (pazartesi bitişi). */
  odulSonu: Date;
  durum: EtkinlikDurumu;
}

const GUN = 86_400_000;

/**
 * Şu anın etkinliği. Pazartesi bir önceki hafta sonunun ödül günü; salı
 * ile cuma arası bu hafta sonunun etkinliği "yaklaşıyor" (tema belli —
 * oyuncu hazırlanabilsin).
 */
export function diyarEtkinligi(an: Date): EtkinlikPenceresi {
  const gun = haftaninGunu(an); // 0 = pazartesi
  const pazartesi = haftaBasi(an).getTime();
  const bas = gun === 0 ? pazartesi - 2 * GUN : pazartesi + 5 * GUN;
  const durum: EtkinlikDurumu = gun === 0 ? 'odul' : gun >= 5 ? 'acik' : 'yaklasiyor';
  const tanim = ETKINLIKLER[haftaNumarasi(new Date(bas)) % ETKINLIKLER.length]!;
  return {
    tanim,
    bas: new Date(bas),
    son: new Date(bas + 2 * GUN),
    odulSonu: new Date(bas + 3 * GUN),
    durum,
  };
}

/** Aktif nüfusun okunduğu günler: etkinlikten önceki yedi gün (UTC gün numarası). */
export function aktifPenceresi(bas: Date): { ilkGun: number; sonGun: number } {
  const g = gunNumarasi(bas);
  return { ilkGun: g - 7, sonGun: g - 1 };
}

export function etkinlikHedefi(tanim: EtkinlikTanimi, aktifLord: number): number {
  return Math.max(tanim.taban, Math.ceil(Math.max(0, aktifLord) * tanim.kisi_basi));
}

/** Ödül: malikâne saatlik gelirinin katı — sefer ve günlük ödülle aynı ilke. */
export function etkinlikOdulu(lordSeviyesi: number): Resources {
  const gelir = malikaneIncome(lordSeviyesi);
  const k = DIYAR_ETKINLIGI.odul_malikane_saati;
  return {
    altin: Math.round(gelir.altin * k),
    demir: Math.round(gelir.demir * k),
    erzak: Math.round(gelir.erzak * k),
  };
}

export interface EtkinlikHakki {
  hakEdildi: boolean;
  alindi: boolean;
  /** Neden alınamıyor (arayüz ve uç aynı kararı okuyor). */
  engel: 'kapali' | 'hedef' | 'katki' | 'alindi' | null;
}

/** Ödül alınabilir mi — uçla arayüzün tek kararı. */
export function etkinlikHakki(
  p: EtkinlikPenceresi,
  toplam: number,
  hedef: number,
  katkim: number,
  sonAlim: Date | null,
): EtkinlikHakki {
  const alindi = sonAlim !== null && sonAlim.getTime() === p.bas.getTime();
  const tuttu = toplam >= hedef;
  const katildi = katkim >= ETKINLIK_EN_AZ_KATKI;
  const engel = alindi
    ? 'alindi'
    : p.durum === 'yaklasiyor'
      ? 'kapali'
      : !tuttu
        ? 'hedef'
        : !katildi
          ? 'katki'
          : null;
  return { hakEdildi: tuttu && katildi && p.durum !== 'yaklasiyor', alindi, engel };
}
