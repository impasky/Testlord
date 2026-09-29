/**
 * Çizim tarifleri (docs/24): sahnenin anahtarından modeli.
 *
 * Oyunun her çizimi bir anahtarla adlı: `zemin:kisla`, `bina:kisla_3`,
 * `birimler:okcu`, `diyar:bataklik:kapak`. Model bu anahtardan kuruluyor,
 * başka hiçbir şeye bakmadan; o yüzden GPU işçisi de aynı modeli kendisi
 * kurabiliyor. Ana iş parçacığı yalnız anahtarı yolluyor: binlerce yüzlük
 * bir ekran zemininin modeli, ağı ve bayrak kareleri telefonda bir saniyeyi
 * aşıyordu ve sayfa o arada donuyordu.
 *
 * `Cizimler.tsx` modelini de buradan alıyor: işçide kurulan model ile SVG
 * yedeğinin modeli aynı işlevden çıkmalı.
 */
import { binaModeli } from './binalar';
import { birlikModeli, dusmanModeli, ekipmanModeli } from './birlikler';
import { bolgeModeli } from './bolgeler';
import { diyarModeli, type Kadraj } from './diyarlar';
import { generalModeli, lordModeli, portreModeli } from './kisiler';
import type { Model } from './uc';
import { yerlesimAnahtariCoz, yerlesimModeli } from './yerlesim';
import { zeminModeli } from './zeminler';

const TARIFLER: Record<string, (ad: string) => Model | null> = {
  bina: binaModeli,
  yerlesim: (ad) => {
    const { kademe, binalar } = yerlesimAnahtariCoz(ad);
    return yerlesimModeli(kademe, binalar);
  },
  bolge: bolgeModeli,
  birimler: birlikModeli,
  dusmanlar: dusmanModeli,
  ekipman: ekipmanModeli,
  generaller: generalModeli,
  lord: lordModeli,
  portre: portreModeli,
  diyar: (ad) => {
    const [diyar = '', kadraj = ''] = ad.split(':');
    return diyarModeli(diyar, kadraj as Kadraj);
  },
  zemin: zeminModeli,
};

/** Anahtarın modeli; tarifi olmayan (ya da bilinmeyen) anahtar için null. */
export function tarifModeli(anahtar: string): Model | null {
  const i = anahtar.indexOf(':');
  if (i < 0) return null;
  return TARIFLER[anahtar.slice(0, i)]?.(anahtar.slice(i + 1)) ?? null;
}
