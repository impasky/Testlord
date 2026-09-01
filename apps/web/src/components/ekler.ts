/**
 * Türkçe ek getirme.
 *
 * Bölge adları veriden geliyor ve arayüzde çekim ekiyle kullanılıyor:
 * "Kırıkkaya'ya saldır", "Dörtyol'u incele". Eki sabit yazmak
 * "Kırıkkaya'a saldır" gibi yanlışlar üretiyordu — oyuncunun gözüne ilk
 * çarpan şey, oyunun kendi diyarının adını doğru söyleyememesi olurdu.
 *
 * Kurallar sesli uyumu ve kaynaştırma harfiyle sınırlı; özel adların
 * kesme işaretiyle ayrılması esas. Sesli uyumunu son SESLİ harf belirler.
 */
const KALIN = 'aıouâî';
const INCE = 'eiöü';
const SESLI = KALIN + INCE;

function sonSesli(ad: string): string | null {
  const k = ad.toLocaleLowerCase('tr');
  for (let i = k.length - 1; i >= 0; i--) {
    const h = k[i]!;
    if (SESLI.includes(h)) return h;
  }
  return null;
}

function sesliMi(h: string | undefined): boolean {
  return h !== undefined && SESLI.includes(h.toLocaleLowerCase('tr'));
}

/** "Kırıkkaya'ya", "Dörtyol'a" — yönelme hâli. */
export function eYonelme(ad: string): string {
  const v = sonSesli(ad);
  const ek = v && INCE.includes(v) ? 'e' : 'a';
  const kaynastirma = sesliMi(ad[ad.length - 1]) ? 'y' : '';
  return `${ad}'${kaynastirma}${ek}`;
}

/** "Kırıkkaya'yı", "Dörtyol'u" — belirtme hâli. */
export function iBelirtme(ad: string): string {
  const v = sonSesli(ad);
  const kaynastirma = sesliMi(ad[ad.length - 1]) ? 'y' : '';
  return `${ad}'${kaynastirma}${v ? duzEk(v) : 'ı'}`;
}

/** Dört sesliye göre belirtme eki: ı / i / u / ü. */
function duzEk(v: string): string {
  if ('aı'.includes(v)) return 'ı';
  if ('ei'.includes(v)) return 'i';
  if ('ou'.includes(v)) return 'u';
  if ('öü'.includes(v)) return 'ü';
  return 'ı';
}

/** "Kırıkkaya'nın", "Dörtyol'un" — ilgi hâli. */
export function inIlgi(ad: string): string {
  const v = sonSesli(ad);
  const ek = v ? duzEk(v) : 'ı';
  const kaynastirma = sesliMi(ad[ad.length - 1]) ? 'n' : '';
  return `${ad}'${kaynastirma}${ek}n`;
}
