/**
 * İkon seti — game-icons.net (CC BY 3.0), künye: docs/LISANSLAR.md
 *
 * Önce bu ikonlar elle çizilmişti. Sebep olarak "atıf yükü olmasın" denmişti;
 * yanlış bir denge kurmuşuz: atıf bir satırlık künye, karşılığında 4134
 * tutarlı ve GERÇEKTEN ÇİZİLMİŞ görsel var. Elle çizilmiş çizgi ikonlar
 * (nal, mızrak) birimin ne olduğunu anlatıyordu ama oyunu oyun gibi
 * hissettirmiyordu. Dolu siluetler — zırhlı atlı, mızrak duvarı, mancınık —
 * aynı yerde çok daha güçlü duruyor.
 *
 * Sadece kullanılan ikonlar gömülüdür (tools/ikon-uret.mjs). Yeni ikon
 * gerekirse o dosyadaki listeye ekleyip script'i tekrar çalıştır.
 */
import type { SVGProps } from 'react';
import { IKONLAR, type IkonAnahtari } from './ikon-verisi';

type IkonProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { boyut?: number };

function yap(anahtar: IkonAnahtari) {
  const v = IKONLAR[anahtar];
  return function IkonBileseni({ boyut = 20, ...rest }: IkonProps) {
    return (
      <svg
        width={boyut}
        height={boyut}
        viewBox={`0 0 ${v.w} ${v.h}`}
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
        {...rest}
        dangerouslySetInnerHTML={{ __html: v.body }}
      />
    );
  };
}

/* Birimler */
export const IkonMilis = yap('milis');
export const IkonMizrakci = yap('mizrakci');
export const IkonOkcu = yap('okcu');
export const IkonSuvari = yap('suvari');
export const IkonKusatma = yap('kusatma');

/* Savaş nitelikleri */
export const IkonSaldiri = yap('saldiri');
export const IkonSavunma = yap('savunma');
export const IkonCan = yap('can');
export const IkonHiz = yap('hiz');
export const IkonYer = yap('yer');

/* Kaynaklar ve durum */
export const IkonAltin = yap('altin');
export const IkonDemir = yap('demir');
export const IkonErzak = yap('erzak');
export const IkonSure = yap('sure');
export const IkonUyari = yap('uyari');

/* Bölge tipleri */
export const IkonTarla = yap('tarla');
export const IkonMaden = yap('maden');
export const IkonSehir = yap('sehir');
export const IkonKale = yap('kale');
export const IkonTaht = yap('taht');

const BIRIM_IKONU = {
  milis: IkonMilis,
  mizrakci: IkonMizrakci,
  okcu: IkonOkcu,
  suvari: IkonSuvari,
  kusatma: IkonKusatma,
} as const;

export function BirimIkonu({ tip, ...rest }: { tip: string } & IkonProps) {
  const C = BIRIM_IKONU[tip as keyof typeof BIRIM_IKONU] ?? IkonMilis;
  return <C {...rest} />;
}

/* Gezinme ve arayüz */
export const IkonNavMalikane = yap('navMalikane');
export const IkonNavKisla = yap('navKisla');
export const IkonNavHarita = yap('navHarita');
export const IkonNavDemirhane = yap('navDemirhane');
export const IkonNavMenu = yap('navMenu');
export const IkonNavLord = yap('navLord');
export const IkonNavGeneraller = yap('navGeneraller');
export const IkonNavSiralama = yap('navSiralama');
export const IkonSohret = yap('sohret');
export const IkonKapali = yap('kapali');
export const IkonOnay = yap('onay');
export const IkonGoz = yap('goz');
export const IkonSancak = yap('sancak');
export const IkonKurnaz = yap('kurnaz');

const BOLGE_IKONU = {
  tarla: IkonTarla,
  maden: IkonMaden,
  sehir: IkonSehir,
  kale: IkonKale,
  taht: IkonTaht,
} as const;

export function BolgeIkonu({ tip, ...rest }: { tip: string } & IkonProps) {
  const C = BOLGE_IKONU[tip as keyof typeof BOLGE_IKONU] ?? IkonSehir;
  return <C {...rest} />;
}
