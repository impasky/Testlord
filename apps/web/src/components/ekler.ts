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

/**
 * Uzun kelimeleri hece sınırlarından BÖLÜNEBİLİR yapar (yumuşak tire, U+00AD).
 *
 * Araştırma tuvalinin kutuları telefonda 60 piksel genişliğinde ve
 * "Değirmenler", "Mühendisliği" oraya sığmıyor. Tarayıcının kendi
 * tirelemesi (`hyphens: auto`) Türkçe sözlük taşımıyor; sığmayan kelimeyi
 * harfin ortasından, tiresiz kesiyordu: "Değirmen / ler", "Rasathan / e".
 *
 * Türkçe heceleme kuralı düzenli olduğu için elle yazılabiliyor: her hecede
 * tek ünlü var; iki ünlü arasındaki SON ünsüz sonraki heceye geçer
 * (ka-lem, kal-kan, Türk-çe), yan yana iki ünlü ayrılır (sa-at). Yumuşak
 * tire yalnız satır orada kırılırsa görünüyor; kırılmazsa hiçbir şey
 * değişmiyor.
 */
const UNLU = 'aeıioöuüâîû';

function kelimeHeceleri(k: string): string {
  if (k.length < 7) return k;
  const kucuk = k.toLocaleLowerCase('tr');
  const unluler: number[] = [];
  for (let i = 0; i < kucuk.length; i++) if (UNLU.includes(kucuk[i]!)) unluler.push(i);
  const kesikler: number[] = [];
  for (let j = 1; j < unluler.length; j++) {
    const u = unluler[j]!;
    const onceki = u - 1;
    // Önceki harf ünsüzse ve bir önceki ünlüye ait değilse hece ondan başlar.
    const bas = onceki > unluler[j - 1]! && !UNLU.includes(kucuk[onceki]!) ? onceki : u;
    // Satırın iki ucunda en az ÜÇ harf kalsın. İkiyle denendi: tarayıcı
    // satırı doldurmak için her fırsatı kullanıyor ve alt satıra bütün
    // sığacak kelimeyi bile "Tahıl Am- / barları", "Derin Ma- / denler"
    // diye bölüyordu. Üç harfli kopuşlar hem daha az hem okunur.
    if (bas >= 3 && k.length - bas >= 3) kesikler.push(bas);
  }
  let cikti = '';
  let son = 0;
  for (const b of kesikler) {
    cikti += `${k.slice(son, b)}­`;
    son = b;
  }
  return cikti + k.slice(son);
}

export function heceTireli(metin: string): string {
  return metin
    .split(' ')
    .map((k) => (/^[\p{L}]+$/u.test(k) ? kelimeHeceleri(k) : k))
    .join(' ');
}
