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
export function normalize(ad: string): string {
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
 * Uzun yasaklı parçalar: adın HERHANGİ bir yerinde geçerse elenir.
 *
 * Dört harf ve üstü olduğu için masum bir adın içine tesadüfen düşmesi
 * pratikte imkânsız; oyuncunun araya karakter sıkıştırması ise normalize
 * tarafından zaten temizleniyor.
 */
const UZUN_YASAKLI = [
  'orospu',
  'oruspu',
  'piclik',
  'sikis',
  'sikik',
  'siktir',
  'yarrak',
  'gotveren',
  'ibne',
  'amcik',
  'kahpe',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'nazi',
  'hitler',
];

/**
 * Kısa yasaklı parçalar: yalnız AYRI SÖZCÜK olarak ya da adın tamamıyken
 * elenir, adın içinde geçtiği için değil.
 *
 * Sebebi somut bir hata: bunlar da alt-dize aranıyordu ve meşru adları
 * eliyordu — "Aquila" (heraldikte kartal, bu oyuna birebir yakışan bir ad),
 * "Şaqir", "Jaqueline", "Aqua" hepsi "aq" yüzünden reddediliyordu;
 * "Picasso" ve "Picard" da "pic" yüzünden. İki harflik bir parçayı adın
 * her yerinde aramak, engellediğinden fazlasını engelliyor.
 *
 * Kaçırdığı hâller var ("Lordamk" gibi bitişik yazımlar) ve bu bilinçli:
 * dosyanın başındaki iki katman kuralı burada işliyor — otomatik süzgeç
 * bariz olanı keser, şikâyet mekanizması kalanı insana taşır. Meşru bir
 * adı engellemek, kaçırmaktan pahalı.
 */
const KISA_YASAKLI = ['amk', 'aq', 'pic'];

/** Testler ve şikâyet ekranı için: iki liste birlikte. */
export const YASAKLI = [...UZUN_YASAKLI, ...KISA_YASAKLI];

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
  for (const y of UZUN_YASAKLI) {
    if (n.includes(y)) {
      return { uygun: false, sebep: 'Bu ad kullanılamaz. Başka bir ad seç.' };
    }
  }
  // Kısa parçalar: adın TAMAMI buysa ("amk", "a.m.k") ya da ayrı bir
  // sözcük olarak geçiyorsa ("Kral amk") elenir.
  const sozcukler = ad
    .split(/[^\p{L}\p{N}]+/u)
    .map(normalize)
    .filter(Boolean);
  for (const y of KISA_YASAKLI) {
    if (n === y || sozcukler.includes(y)) {
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

/**
 * Lord adının BENZERSİZLİK anahtarı (`Lord.adAnahtari`, docs/18).
 *
 * "Yunus" ile "YUNUS", "Işık" ile "IŞIK" aynı ad: sıralamada ve savaş
 * raporunda ayırt edilemiyorlar, biri ötekinin kılığına girebiliyor.
 * Anahtar büyük/küçük harfe ve Türkçenin dört I'sına duyarsız; baştaki,
 * sondaki ve arka arkaya boşluklar tek sayılıyor. Bundan ötesi (5→s gibi)
 * `normalize`ın işi ve orada kalıyor: "Ali5" ile "Alis" iki ayrı oyuncu
 * olabilir.
 *
 * Göçteki SQL bunun aynısı (`20261015120000_lord_adi_benzersiz`):
 * `lower(translate(regexp_replace(btrim(name), '\s+', ' ', 'g'),
 * 'İIıÇĞÖŞÜ', 'iiiçğöşü'))`. Biri değişirse öteki de değişmeli.
 */
export function lordAdiAnahtari(ad: string): string {
  return ad.normalize('NFC').trim().replace(/\s+/g, ' ').replace(/[İIı]/g, 'i').toLowerCase();
}

const SIRA_EKI = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Sistemin açtığı bir lord için boş ad: istenen ad boşsa o, değilse
 * "II", "III"… (hükümdar sırası, ortaçağın kendi çözümü).
 *
 * Lord adı veritabanında benzersiz (docs/18). Bir oyuncu "Sungur Bey"
 * adını demo lordlardan önce almışsa ya da ikinci bir diyar tohumlanıyorsa
 * düz ad çakışıyor ve kısıt açılışı düşürürdü. On sıra da doluysa zamandan
 * kısa bir ek. `alinmis` anahtarı alıyor (bkz. `lordAdiAnahtari`).
 */
export async function bosLordAdi(
  ad: string,
  alinmis: (anahtar: string) => Promise<boolean>,
): Promise<string> {
  for (const aday of [ad, ...SIRA_EKI.map((e) => `${ad} ${e}`)]) {
    if (!(await alinmis(lordAdiAnahtari(aday)))) return aday;
  }
  return `${ad} ${Date.now().toString(36).slice(-4)}`;
}
