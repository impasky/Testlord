/**
 * Lord adı denetimi.
 *
 * Ad oyuncu tarafından yazılıyor ve sıralamada, savaş raporlarında herkese
 * görünüyor. Süzgeç olmadan bir oyuncunun yazdığı şey bütün diyara
 * dayatılıyor.
 *
 * Süzgeç kusursuz değil ve olamaz: her yazımı yakalamaya çalışan bir liste,
 * masum adları da eler ("Cumhur" içinde geçen harf dizileri gibi). Bu yüzden
 * iki katman var — otomatik süzgeç bariz olanı keser, şikâyet mekanizması
 * kalanı insana taşır.
 */

/** Benzer görünen karakterleri sadeleştirir: "5ik1ş" -> "sikis". */
function normalize(ad: string): string {
  return ad
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-z]/g, '');
}

/**
 * Yasaklı parçalar. Kelime değil PARÇA arıyoruz çünkü oyuncular araya
 * karakter sıkıştırıyor; normalize zaten onları temizliyor.
 */
const YASAKLI = [
  'amk', 'aq', 'orospu', 'piclik', 'pic', 'sikis', 'sikik', 'siktir', 'yarrak',
  'gotveren', 'ibne', 'amcik', 'kahpe', 'oruspu',
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nazi', 'hitler',
];

/** Oyunun kendi kurumlarını taklit eden adlar da alınamaz. */
const AYRILMIS = ['admin', 'yonetici', 'moderator', 'sistem', 'lordlarcagi', 'destek'];

export interface AdSonucu {
  uygun: boolean;
  sebep?: string;
}

export function adiDenetle(ad: string): AdSonucu {
  const n = normalize(ad);

  if (n.length < 3) {
    return { uygun: false, sebep: 'Lord adı en az 3 harf içermeli.' };
  }
  for (const y of YASAKLI) {
    if (n.includes(y)) {
      return { uygun: false, sebep: 'Bu ad kullanılamaz. Başka bir ad seç.' };
    }
  }
  for (const a of AYRILMIS) {
    if (n === a || n.startsWith(a)) {
      return { uygun: false, sebep: 'Bu ad ayrılmış. Başka bir ad seç.' };
    }
  }
  // Aynı karakterin tekrarı: "aaaaaaaa" gibi adlar sıralamayı çöpe çevirir.
  if (/(.)\1{4,}/.test(n)) {
    return { uygun: false, sebep: 'Aynı harfi arka arkaya bu kadar tekrarlayamazsın.' };
  }

  return { uygun: true };
}
