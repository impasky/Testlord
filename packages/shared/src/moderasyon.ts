/**
 * Moderasyon: şikâyetin insana taşınması.
 *
 * İki katmanlı tasarımın ikinci katmanı. Birincisi otomatik süzgeç
 * (`adDenetimi`, `mesajDenetimi`) ve bariz olanı kesiyor; süzgeç kusursuz
 * olamaz ve olmaya çalışırsa masum kelimeleri eler. Kaçanı bir insanın
 * önüne koyan yol burası.
 *
 * TASARIM KURALI — OTOMATİK CEZA YOK. Bir şikâyet, şikâyet edilene hiçbir
 * şey yapmaz. Yapsaydı süzgeç değil silah olurdu: üç kişi anlaşıp
 * beğenmedikleri bir oyuncuyu oyundan attırırdı. Şikâyetin tek yetkisi bir
 * insanın BAKMASINI istemek.
 *
 * Tek istisna otomatik GİZLEME ve o da ceza değil: mesaj görünmez olur,
 * yazana hiçbir şey olmaz, yönetici "yok say" derse mesaj geri gelir.
 * Sebebi zaman dilimi — gece yarısı yazılan bir hakaret, yönetici uyanana
 * kadar sekiz saat ekranda duramaz.
 *
 * Bu dosya SAF: veritabanı yok, tarih `simdi` parametresiyle dışarıdan
 * geliyor. Testler saati taklit edebilsin diye.
 */
import { B } from './balance.js';

const M = B.moderasyon;

/** Şikâyetin neye açıldığı. Lord = adı/davranışı, mesaj = tek bir söz. */
export type SikayetTuru = 'lord' | 'mesaj';

/** Yöneticinin bir ŞİKÂYETE verebileceği karar. */
export type ModerasyonKarari = 'yok_say' | 'mesaj_sil' | 'sustur';

/**
 * Yönetici panelinden yapılabilen işlem.
 *
 * Şikâyet kararlarının üstüne üç tane daha var ve üçü de şikâyetsiz
 * yapılabiliyor: kuyruk ŞİKÂYET EDİLENİ gösteriyor, ama bot hesabı da
 * hile de kimse şikâyet etmeden durabiliyor. Panel oyuncuyu aramaya
 * yarıyor, kuyruk beklemeye.
 */
export type YoneticiIslemi = ModerasyonKarari | 'yasakla' | 'yasak_kaldir' | 'susturma_kaldir';

export interface Denetim {
  uygun: boolean;
  sebep?: string;
}

/* ------------------------------------------------------------------ */
/* Şikâyet                                                             */
/* ------------------------------------------------------------------ */

/**
 * Hazır sebepler.
 *
 * Serbest metin de var ama liste önce geliyor: "neden şikâyet ediyorsun"
 * sorusuna boş bir kutuyla cevap vermek oyuncuyu yazmaktan vazgeçiriyor,
 * yöneticiye de sıralanamayan bir yığın bırakıyor. Anahtar kalıcı, metin
 * değişebilir.
 */
export const SIKAYET_SEBEPLERI = [
  { anahtar: 'hakaret', metin: 'Hakaret veya küfür' },
  { anahtar: 'taciz', metin: 'Taciz veya tehdit' },
  { anahtar: 'nefret', metin: 'Nefret söylemi' },
  { anahtar: 'reklam', metin: 'Reklam veya bağlantı yağmuru' },
  { anahtar: 'ad', metin: 'Uygunsuz lord adı' },
  { anahtar: 'diger', metin: 'Başka bir sebep' },
] as const;

export type SikayetSebebi = (typeof SIKAYET_SEBEPLERI)[number]['anahtar'];

/**
 * Yalnız anahtarlar — istek gövdesini doğrulayan şemalar için.
 *
 * Her uç kendi listesini yazsaydı listeler birbirinden sapardı; iki
 * şikâyet ucu (lord ve mesaj) aynı diziyi okuyor.
 */
export const SIKAYET_SEBEP_ANAHTARLARI = SIKAYET_SEBEPLERI.map((s) => s.anahtar) as unknown as [
  SikayetSebebi,
  ...SikayetSebebi[],
];

export function sebepMetni(anahtar: string): string {
  return SIKAYET_SEBEPLERI.find((s) => s.anahtar === anahtar)?.metin ?? anahtar;
}

/**
 * Şikâyet sebebini denetler.
 *
 * Hazır sebep seçildiyse açıklama isteğe bağlı; "diğer" seçildiyse zorunlu,
 * çünkü "başka bir sebep" tek başına yöneticiye hiçbir şey söylemiyor.
 */
export function sikayetiDenetle(sebepAnahtari: string, aciklama: string): Denetim {
  const bilinen = SIKAYET_SEBEPLERI.some((s) => s.anahtar === sebepAnahtari);
  if (!bilinen) return { uygun: false, sebep: 'Bir sebep seç.' };

  const t = aciklama.trim();
  if (t.length > M.sebep_en_fazla_harf) {
    return { uygun: false, sebep: `Açıklama en fazla ${M.sebep_en_fazla_harf} harf olabilir.` };
  }
  if (sebepAnahtari === 'diger' && t.length < M.sebep_en_az_harf) {
    return {
      uygun: false,
      sebep: `"Başka bir sebep" seçtiysen en az ${M.sebep_en_az_harf} harfle açıkla.`,
    };
  }
  return { uygun: true };
}

/** Şikâyet kaydında saklanan tek satır: seçilen sebep + varsa açıklama. */
export function sikayetSatiri(sebepAnahtari: string, aciklama: string): string {
  const t = aciklama.trim();
  const bas = sebepMetni(sebepAnahtari);
  return t ? `${bas} — ${t}` : bas;
}

/**
 * Bir mesaj, şikâyet sayısı yüzünden gizlenmeli mi.
 *
 * Sayan şey FARKLI şikâyetçi sayısı: aynı kişinin beş kez basması bir
 * mesajı gizlemeye yetmemeli.
 */
export function otomatikGizlenir(farkliSikayetci: number): boolean {
  return farkliSikayetci >= M.otomatik_gizleme_esigi;
}

export const GIZLEME_ESIGI = M.otomatik_gizleme_esigi;

/* ------------------------------------------------------------------ */
/* Susturma                                                            */
/* ------------------------------------------------------------------ */

/**
 * Yöneticinin seçebileceği susturma süreleri (saat).
 *
 * KALICI SUSTURMA YOK ve bu bilinçli: kalıcı susturma, hesabı silmenin
 * oyuncuya hiç söylenmeyen hâlidir. Tekrarlayan birini oyundan çıkarmak
 * ittifak liderinin (atma) ya da hesabın kendisinin işi; susturmak geçici
 * bir frendir.
 */
export const SUSTURMA_SURELERI: readonly number[] = M.susturma_sureleri_sa;

export function susturmaSuresiGecerli(saat: number): boolean {
  return SUSTURMA_SURELERI.includes(saat);
}

/** Süreyi insanın okuduğu hâle çevirir: 1 → "1 saat", 168 → "7 gün". */
export function saatMetni(saat: number): string {
  if (saat < 24) return `${saat} saat`;
  const gun = saat / 24;
  return Number.isInteger(gun) ? `${gun} gün` : `${saat} saat`;
}

/** Susturma süresinin okunur hâli. Yasakla aynı ölçü, ayrı ad. */
export function susturmaSuresiMetni(saat: number): string {
  return saatMetni(saat);
}

export function susturmaBitisi(saat: number, simdi: Date): Date {
  return new Date(simdi.getTime() + saat * 3600_000);
}

export interface SusturmaDurumu {
  susturulmus: boolean;
  /** Ne zaman biteceği. Susturulmuş değilse null. */
  bitis: Date | null;
  /** Oyuncuya gösterilecek tek satır. Susturulmuş değilse null. */
  metin: string | null;
}

/**
 * Susturma hâlâ sürüyor mu.
 *
 * Süresi geçmiş bir susturma kaydı temizlenmiyor — geçmişi silmek
 * yöneticinin "bu kaçıncı" sorusuna cevap vermesini imkânsız kılar.
 * Bu yüzden "aktif mi" sorusu her seferinde tarihe bakarak cevaplanıyor.
 */
export function susturmaDurumu(
  bitis: Date | null | undefined,
  sebep: string | null | undefined,
  simdi: Date,
): SusturmaDurumu {
  if (!bitis || bitis.getTime() <= simdi.getTime()) {
    return { susturulmus: false, bitis: null, metin: null };
  }
  const kalan = kalanMetni(bitis.getTime() - simdi.getTime());
  const kuyruk = sebep ? ` Sebep: ${sebep}` : '';
  return {
    susturulmus: true,
    bitis,
    metin: `Sohbette susturuldun — ${kalan} kaldı.${kuyruk}`,
  };
}

function kalanMetni(ms: number): string {
  const dk = Math.ceil(ms / 60_000);
  if (dk < 60) return `${dk} dakika`;
  const sa = Math.ceil(dk / 60);
  if (sa < 24) return `${sa} saat`;
  return `${Math.ceil(sa / 24)} gün`;
}

/* ------------------------------------------------------------------ */
/* Karar                                                               */
/* ------------------------------------------------------------------ */

/**
 * Karar bu şikâyete uygulanabilir mi.
 *
 * "Mesajı sil" bir LORD şikâyetine uygulanamaz — ortada silinecek bir mesaj
 * yok. Bu denetim arayüzde de var (düğme çıkmıyor) ama motorda da olmalı:
 * arayüz tek savunma hattı olduğunda er ya da geç delinir.
 */
export function karariDenetle(
  karar: string,
  tur: SikayetTuru,
  susturmaSaati: number | null | undefined,
): Denetim {
  if (karar !== 'yok_say' && karar !== 'mesaj_sil' && karar !== 'sustur') {
    return { uygun: false, sebep: 'Bilinmeyen karar.' };
  }
  if (karar === 'mesaj_sil' && tur !== 'mesaj') {
    return { uygun: false, sebep: 'Bu şikâyette silinecek bir mesaj yok.' };
  }
  if (karar === 'sustur') {
    if (susturmaSaati == null) return { uygun: false, sebep: 'Susturma süresi seç.' };
    if (!susturmaSuresiGecerli(susturmaSaati)) {
      return { uygun: false, sebep: 'Geçersiz susturma süresi.' };
    }
  }
  return { uygun: true };
}

/** Moderasyon kaydına yazılan satır — yöneticinin geçmişte okuyacağı şey. */
export function islemMetni(islem: YoneticiIslemi, saat?: number | null): string {
  switch (islem) {
    case 'yok_say':
      return 'Şikâyet yok sayıldı';
    case 'mesaj_sil':
      return 'Mesaj kaldırıldı';
    case 'sustur':
      return `Sohbette susturuldu (${saatMetni(saat ?? 0)})`;
    case 'yasakla':
      return saat == null
        ? 'Hesap KALICI olarak yasaklandı'
        : `Hesap yasaklandı (${saatMetni(saat)})`;
    case 'yasak_kaldir':
      return 'Yasak kaldırıldı';
    case 'susturma_kaldir':
      return 'Susturma kaldırıldı';
  }
}

export function kararMetni(karar: ModerasyonKarari, susturmaSaati?: number | null): string {
  return islemMetni(karar, susturmaSaati);
}

/* ------------------------------------------------------------------ */
/* Yasak                                                               */
/* ------------------------------------------------------------------ */

/**
 * Hesap yasağı — susturmanın oyuna bakan hâli.
 *
 * Susturma SOHBETE dokunuyor, yasak OYUNA: yasaklı hesap hiç giremiyor.
 * İkisi ayrı, çünkü ölçüleri ayrı — kötü bir söz için hesabı kapatmak da,
 * bot hesabını yalnız susturmak da yanlış olurdu.
 *
 * Yasak KULLANICIYA bağlı, lorda değil (`yonetici` gibi): yeni bir lord
 * açarak yasaktan kaçılamaz.
 *
 * KALICI YASAK VAR ve susturmadan farkı bu. Susturmada kalıcı yok çünkü
 * sohbete hiç sokmamak, oyuncuya söylenmeyen bir hesap silme olurdu;
 * yasakta ise bot ve hile hesaplarının karşılığı başka bir şey değil.
 * Her yasak geri alınabiliyor ve sebebi oyuncuya söyleniyor.
 */
export const YASAK_SURELERI: readonly number[] = M.yasak_sureleri_sa;
export const KALICI_YASAK_ACIK: boolean = M.kalici_yasak_acik;
export const YASAK_SEBEP_EN_AZ = M.yasak_sebep_en_az_harf;
export const ARAMA_SONUC_SAYISI = M.arama_sonuc_sayisi;
export const OYUNCU_MESAJ_SAYISI = M.oyuncu_mesaj_sayisi;

/** `saat === null` kalıcı demek. */
export function yasakSuresiGecerli(saat: number | null): boolean {
  if (saat === null) return KALICI_YASAK_ACIK;
  return YASAK_SURELERI.includes(saat);
}

export function yasagiDenetle(saat: number | null, sebep: string): Denetim {
  if (!yasakSuresiGecerli(saat)) return { uygun: false, sebep: 'Geçersiz yasak süresi.' };
  const t = sebep.trim();
  if (t.length < YASAK_SEBEP_EN_AZ) {
    return { uygun: false, sebep: `Yasak sebebini en az ${YASAK_SEBEP_EN_AZ} harfle yaz.` };
  }
  if (t.length > M.sebep_en_fazla_harf) {
    return { uygun: false, sebep: `Sebep en fazla ${M.sebep_en_fazla_harf} harf olabilir.` };
  }
  return { uygun: true };
}

export function yasakBitisi(saat: number, simdi: Date): Date {
  return new Date(simdi.getTime() + saat * 3600_000);
}

export interface YasakDurumu {
  yasakli: boolean;
  kalici: boolean;
  bitis: Date | null;
  /** Oyuncuya gösterilecek tek satır. Yasaklı değilse null. */
  metin: string | null;
}

/**
 * Yasak hâlâ sürüyor mu.
 *
 * Susturmadaki kuralın aynısı: süresi geçmiş kayıt TEMİZLENMİYOR, "aktif
 * mi" sorusu her seferinde tarihe bakılarak cevaplanıyor. Geçmişi silmek,
 * "bu kaçıncı" sorusunu cevapsız bırakırdı.
 */
export function yasakDurumu(
  kalici: boolean,
  bitis: Date | null | undefined,
  sebep: string | null | undefined,
  simdi: Date,
): YasakDurumu {
  const kuyruk = sebep ? ` Sebep: ${sebep}` : '';
  if (kalici) {
    return {
      yasakli: true,
      kalici: true,
      bitis: null,
      metin: `Hesabın kalıcı olarak yasaklandı.${kuyruk}`,
    };
  }
  if (!bitis || bitis.getTime() <= simdi.getTime()) {
    return { yasakli: false, kalici: false, bitis: null, metin: null };
  }
  return {
    yasakli: true,
    kalici: false,
    bitis,
    metin: `Hesabın yasaklı — ${kalanMetni(bitis.getTime() - simdi.getTime())} kaldı.${kuyruk}`,
  };
}

/** Silinmiş mesajın yerine ne yazıyor. Metin silinmiyor, gizleniyor. */
export const SILINMIS_MESAJ = 'Bu mesaj kaldırıldı.';
/** Şikâyet eşiğini aşıp yönetici bakana kadar gizlenen mesajın yeri. */
export const GIZLI_MESAJ = 'Bu mesaj şikâyet edildi, inceleniyor.';

export const SIKAYET_ARASI_SN = M.iki_sikayet_arasi_sn;
export const KUYRUK_SAYFA_BOYU = M.kuyruk_sayfa_boyu;
export const SUSTURMA_GECMIS_SAYISI = M.susturma_gecmis_sayisi;
