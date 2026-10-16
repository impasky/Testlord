/**
 * Ekranın derinindeki bir bileşenin bir kapıyı (paneli) açtırması.
 *
 * Kapıyı App açıyor ve işleyicisi her ekrana prop olarak inmiyor; ortak
 * bileşenler (ör. Hızlandır penceresindeki "Mağaza" bağlantısı) onu bu
 * olayla istiyor. App tek dinleyici.
 */
import type { Kapi } from '@lordlar/shared';

const OLAY = 'lordlar:kapi-ac';

export function kapiAcIstegi(kapi: Kapi): void {
  window.dispatchEvent(new CustomEvent<Kapi>(OLAY, { detail: kapi }));
}

export function kapiIstekleriniDinle(fn: (kapi: Kapi) => void): () => void {
  const dinle = (e: Event) => fn((e as CustomEvent<Kapi>).detail);
  window.addEventListener(OLAY, dinle);
  return () => window.removeEventListener(OLAY, dinle);
}
