/**
 * Profil: oyuncunun öteki oyunculara görünen yüzü.
 *
 * Oyuncunun istekleri:
 *   - "Tüm oyuncuların sohbet edebileceği genel sohbet yap."
 *   - "Mesaj yazan birinin ismine ya da profil resmine tıkladığında profili
 *      ve bazı bilgiler görünsün, kritik bilgiler görünmesin."
 *   - "Profil resmi seçme ve yükleme olsun; resimler bir denetimden
 *      geçmeli, +18 ve benzeri içerik engellenmeli."
 *
 * Bu dosya SAF: veritabanı yok, sınıflandırıcı yok. Resmin kendisini
 * sunucu (services/resimDenetimi.ts) sınıflandırıyor; burada yalnız
 * sınıflandırıcının sayılarından KARAR çıkıyor — test edilebilsin, eşikler
 * tek yerde (balance.json → profil_resmi) dursun diye.
 */
import { B } from './balance.js';

const P = B.profil_resmi;
const G = B.genel_sohbet;

/* ------------------------------------------------------------------ */
/* Genel sohbet                                                        */
/* ------------------------------------------------------------------ */

export const GENEL_SOHBET = {
  enFazlaHarf: G.mesaj_en_fazla_harf,
  gosterilenMesaj: G.gosterilen_mesaj,
  ikiMesajArasiSn: G.iki_mesaj_arasi_sn,
  ayniMesajTekrarSn: G.ayni_mesaj_tekrar_sn,
  yoklamaSn: G.yoklama_sn,
} as const;

/**
 * Aynı söz mü — büyük/küçük harf, boşluk ve noktalama farkı sayılmıyor.
 *
 * "SELAM!!!" ile "selam" aynı satırı akıtmanın iki yolu; yalnız birebir
 * aynı metni reddetmek freni bir ünlem işaretiyle aşılır kılardı.
 */
export function ayniSozMu(a: string, b: string): boolean {
  const sade = (s: string) =>
    s
      .toLocaleLowerCase('tr')
      .replace(/[\s\p{P}\p{S}]+/gu, '')
      .trim();
  const x = sade(a);
  return x.length > 0 && x === sade(b);
}

/* ------------------------------------------------------------------ */
/* Profil resmi                                                        */
/* ------------------------------------------------------------------ */

export const PROFIL_RESMI = {
  boyutPx: P.boyut_px,
  enFazlaKb: P.en_fazla_kb,
  gunlukYukleme: P.gunluk_yukleme,
} as const;

export interface HazirPortre {
  /** Kalıcı anahtar — `apps/web/public/gorseller/portre/<key>.webp`. */
  key: string;
  ad: string;
}

/**
 * Hazır portreler: oyunun kendi figürlerinden baş-omuz kırpmaları
 * (tools/portre-kirp.py). Denetim gerektirmiyor — hepsini biz çizdik.
 */
export const HAZIR_PORTRELER: readonly HazirPortre[] = [
  { key: 'lord_1', ad: 'Lord I' },
  { key: 'lord_2', ad: 'Lord II' },
  { key: 'lord_3', ad: 'Lord III' },
  { key: 'lord_4', ad: 'Lord IV' },
  { key: 'lord_5', ad: 'Lord V' },
  { key: 'kumandan_alparslan', ad: 'Kumandan Alparslan' },
  { key: 'sovalye_doruk', ad: 'Şövalye Doruk' },
  { key: 'kale_bekcisi_sarya', ad: 'Kale Bekçisi Sarya' },
  { key: 'okcubasi_elif', ad: 'Okçubaşı Elif' },
  { key: 'casus_leyla', ad: 'Casus Leyla' },
  { key: 'suvari_bora', ad: 'Süvari Bora' },
  { key: 'mizrakci_kadir', ad: 'Mızrakçı Kadir' },
  { key: 'kusatmaci_tarik', ad: 'Kuşatmacı Tarık' },
  { key: 'demirci_yusuf', ad: 'Demirci Yusuf' },
  { key: 'erzakci_meryem', ad: 'Erzakçı Meryem' },
  { key: 'kahya_sinan', ad: 'Kâhya Sinan' },
  { key: 'vaiz_bertan', ad: 'Vaiz Bertan' },
  { key: 'barbar_sef', ad: 'Barbar Şefi' },
  { key: 'eskiya_sef', ad: 'Eşkıya Şefi' },
  { key: 'haydut_sef', ad: 'Haydut Şefi' },
  { key: 'kultist_sef', ad: 'Kültist Şefi' },
  { key: 'lejyoner_sef', ad: 'Lejyoner Şefi' },
];

export function hazirPortreVarMi(key: string): boolean {
  return HAZIR_PORTRELER.some((p) => p.key === key);
}

/**
 * Profil resmi — her ekranda aynı biçim.
 *
 * `arma` varsayılan: resim seçmemiş oyuncu da boş bir daire değil kendi
 * armasıyla görünüyor (arma addan türetildiği için herkesinki farklı).
 */
export type ProfilResmi =
  { tur: 'arma' } | { tur: 'hazir'; key: string } | { tur: 'yuklenen'; id: string };

/**
 * `Lord.profilResmi` sütununu çözer: "hazir:<key>" | "yuklenen:<id>" | null.
 *
 * Tanınmayan değer ARMAYA düşüyor, hata vermiyor: portre listesinden
 * çıkarılan bir anahtar, o portreyi seçmiş oyuncunun sohbetini
 * kırmamalı.
 */
export function profilResmiCoz(sutun: string | null | undefined): ProfilResmi {
  if (!sutun) return { tur: 'arma' };
  const i = sutun.indexOf(':');
  const tur = sutun.slice(0, i);
  const deger = sutun.slice(i + 1);
  if (tur === 'hazir' && hazirPortreVarMi(deger)) return { tur: 'hazir', key: deger };
  if (tur === 'yuklenen' && deger.length > 0) return { tur: 'yuklenen', id: deger };
  return { tur: 'arma' };
}

export function profilResmiSutunu(r: ProfilResmi): string | null {
  if (r.tur === 'hazir') return `hazir:${r.key}`;
  if (r.tur === 'yuklenen') return `yuklenen:${r.id}`;
  return null;
}

/**
 * Görüntü sınıflandırıcısının çıktısı — nsfwjs'in beş sınıfı, olasılık.
 * Porn/Hentai: açık cinsel içerik (fotoğraf/çizim). Sexy: açık ama cinsel
 * olmayan. Neutral/Drawing: güvenli.
 */
export interface ResimTahmini {
  Porn: number;
  Hentai: number;
  Sexy: number;
  Neutral: number;
  Drawing: number;
}

/**
 * red: kimse görmüyor, oyuncuya söyleniyor. inceleme: yönetici bakana
 * kadar yalnız yükleyen görüyor. onay: hemen görünüyor.
 */
export type ResimKarari = 'red' | 'inceleme' | 'onay';

export interface ResimDenetimi {
  karar: ResimKarari;
  /** Oyuncuya gösterilecek cümle. */
  metin: string;
}

/**
 * Otomatik denetimin kararı.
 *
 * ÜÇ KADEME, İKİ DEĞİL. Sınıflandırıcı kusursuz değil: oyunun kendi
 * okçubaşı portresi Hentai 0,46 aldı (çizim sanatı onu yanıltabiliyor).
 * İki kademeli bir süzgeç ya o portreyi reddederdi ya da aynı eşikte
 * gerçek bir çizimi geçirirdi. Emin olmadığı resmi bir İNSANA vermek,
 * iki hatanın da yolunu kesiyor.
 *
 * Sınıflandırıcı çalışmadıysa (null) resim yine İNCELEMEYE gidiyor,
 * onaya değil: denetlenemeyen resim denetlenmiş sayılamaz.
 */
export function resimKarari(t: ResimTahmini | null): ResimDenetimi {
  if (!t) {
    return {
      karar: 'inceleme',
      metin: 'Resmin bir yöneticinin onayını bekliyor. Onaylanınca herkes görecek.',
    };
  }
  const acik = t.Porn + t.Hentai;
  if (acik >= P.red_esigi || t.Sexy >= P.sexy_red_esigi) {
    return {
      karar: 'red',
      metin: 'Bu resim uygunsuz içerik barındırıyor, kullanılamaz. Başka bir resim dene.',
    };
  }
  if (acik + t.Sexy < P.onay_esigi) {
    return { karar: 'onay', metin: 'Profil resmin güncellendi.' };
  }
  return {
    karar: 'inceleme',
    metin: 'Resmin bir yöneticinin onayını bekliyor. Onaylanınca herkes görecek.',
  };
}

/** Kabul edilen resim biçimleri — sunucu içeriğe bakarak doğruluyor, uzantıya değil. */
export const RESIM_BICIMLERI = ['jpeg', 'png', 'webp'] as const;
