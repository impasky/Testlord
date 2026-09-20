/**
 * Dil motoru.
 *
 * ── TEK KARAR: TÜRKÇE METNİN KENDİSİ ANAHTARDIR ────────────────────
 *
 * `t('Ordun yetiyor.')` yazıyoruz, `t('ordu.yeterli')` değil. Üç şey
 * birden kazanılıyor:
 *
 *   1. KOD OKUNUR KALIYOR. `t('ordu.yeterli')` yazan bir dosyada ne
 *      yazdığını görmek için ikinci bir dosyaya bakmak gerekir.
 *   2. FALLBACK KENDİLİĞİNDEN DOĞRU. Çeviri yoksa argüman dönüyor,
 *      yani oyuncu boş kutu değil Türkçesini görüyor.
 *   3. SUNUCUYA HİÇ DOKUNULMUYOR. API Türkçe mesaj döndürüyor ve
 *      istemci onu aynı sözlükte arayabiliyor — çünkü anahtar zaten o
 *      Türkçe metnin özeti. Dil bilgisini her isteğe eklemek, her uçta
 *      çeviri yapmak ve iki ayrı sözlük taşımak gerekmiyor.
 *
 * Bedeli: Türkçe cümle değişince anahtar değişiyor ve çeviri düşüyor.
 * Bu bir kusur değil — değişmiş bir cümlenin eski çevirisi yanlış
 * çeviridir.
 */

/** Desteklenen diller. Anahtar HTML `lang` niteliğiyle aynı. */
export const DILLER = [
  { kod: 'tr', ad: 'Türkçe' },
  { kod: 'en', ad: 'English' },
] as const;

export type DilKodu = (typeof DILLER)[number]['kod'];
export const VARSAYILAN_DIL: DilKodu = 'tr';

export function dilGecerli(k: string): k is DilKodu {
  return DILLER.some((d) => d.kod === k);
}

/** Metinden anahtar — `tools/metin-cikar.mjs` ile BİREBİR aynı FNV-1a. */
export function anahtar(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 't' + h.toString(16).padStart(8, '0');
}

/** anahtar -> çeviri. Çevrilmemiş kayıt sözlükte HİÇ bulunmuyor. */
export type Sozluk = Readonly<Record<string, string>>;

/** `{0}`, `{1}` yerine argümanları koyar. */
export function yerlestir(kalip: string, args: readonly unknown[]): string {
  if (args.length === 0) return kalip;
  return kalip.replace(/\{(\d+)\}/g, (tam, i) => {
    const d = args[Number(i)];
    return d === undefined || d === null ? tam : String(d);
  });
}

/**
 * Çeviri — arayüzün her yerinde çağrılan şey.
 *
 * Sözlük yoksa ya da kayıt yoksa Türkçe dönüyor. Bu yüzden yarım bir
 * çeviri oyunu kırmıyor: çevrilmemiş satır Türkçe kalıyor, gerisi
 * İngilizce.
 */
export function cevir(sozluk: Sozluk | null, tr: string, ...args: unknown[]): string {
  /*
   * ÇOĞUL YALNIZ ÇEVİRİYE UYGULANIYOR, Türkçeye değil.
   *
   * Türkçede sayıdan sonra çoğul eki yok ("3 savaş", "1 savaş"), o
   * yüzden kaynak metinde hiç `|` bulunmuyor. Geri düşüşte Türkçeyi
   * bölmeye kalkmak, içinde boru işareti geçen bir cümleyi sessizce
   * ikiye kırardı.
   */
  const kayit = sozluk?.[anahtar(tr)];
  return yerlestir(kayit === undefined ? tr : cogulSec(kayit, args), args);
}

/* ------------------------------------------------------------------ */
/* Çoğul                                                               */
/* ------------------------------------------------------------------ */

/**
 * ÇOĞUL — `"{0} battle|{0} battles"`.
 *
 * Türkçe kaynak tek biçim taşıyor ve taşımalı: "1 savaş" da "3 savaş"
 * da doğru. İngilizce öyle değil — "1 battles" yazan bir ekran özensiz
 * görünüyor ve oyuncunun gözüne ilk çarpan şey oluyor. Çeviri iki
 * biçimi birden verebilsin diye boru işareti ayırıyor: SOLDA tekil,
 * SAĞDA çoğul.
 *
 * Hangi biçim seçilecek `Intl.PluralRules`e soruluyor; "1 ise tekil"
 * diye elle yazmak İngilizce için tesadüfen doğru, başka diller için
 * yanlış olurdu (Rusçada üç, Arapçada altı biçim var).
 *
 * Sayı ARGÜMANLARDAN okunuyor. Çoğu yerde sayı zaten biçimlenmiş bir
 * dizge olarak geliyor (`formatSayi(1234)` -> "1.234"), o yüzden
 * rakam dışındaki her şey atılıyor: "1.234" -> 1234, "1" -> 1.
 */
const PLURAL_ONBELLEK = new Map<string, Intl.PluralRules>();

function pluralKurali(dil: DilKodu): Intl.PluralRules {
  const y = YEREL[dil];
  let k = PLURAL_ONBELLEK.get(y);
  if (!k) {
    k = new Intl.PluralRules(y);
    PLURAL_ONBELLEK.set(y, k);
  }
  return k;
}

/** Tek bir argümandan sayı; okunamıyorsa null. */
function sayiCoz(a: unknown): number | null {
  if (typeof a === 'number' && Number.isFinite(a)) return a;
  if (typeof a === 'string') {
    const rakamlar = a.replace(/[^\d]/g, '');
    if (rakamlar) return Number(rakamlar);
  }
  return null;
}

/** İlk SAYIYA çevrilebilen argüman; yoksa null. */
function ilkSayi(args: readonly unknown[]): number | null {
  for (const a of args) {
    const n = sayiCoz(a);
    if (n !== null) return n;
  }
  return null;
}

/**
 * İKİ SAYILI CÜMLE — `"{0} [lord|lords] played in the last {1} [day|days]"`.
 *
 * Cümlenin tamamını tekil/çoğul diye ikiye ayırmak burada yetmiyor:
 * iki ayrı sayı var ve biri 1 iken öteki 5 olabiliyor. Köşeli parantez
 * içindeki seçenek, SOLUNDAKİ en yakın yer tutucuya bağlanıyor — yani
 * hangi sayının hangi ismi yönettiği cümlenin kendi sırasından
 * okunuyor, çevirmenin ayrıca numara yazmasına gerek kalmıyor.
 *
 * Solunda yer tutucu olmayan bir grup genel hâle (çoğula) düşüyor.
 */
const KOSELI = /\{(\d+)\}|\[([^[\]|]*)\|([^[\]|]*)\]/g;

function koseliCogul(kalip: string, args: readonly unknown[], dil: DilKodu): string {
  let sonIndeks: number | null = null;
  return kalip.replace(KOSELI, (tam, idx: string | undefined, tekil: string, cogul: string) => {
    if (idx !== undefined) {
      sonIndeks = Number(idx);
      return tam;
    }
    const n = sonIndeks === null ? null : sayiCoz(args[sonIndeks]);
    if (n === null) return cogul;
    return pluralKurali(dil).select(n) === 'one' ? tekil : cogul;
  });
}

export function cogulSec(
  kalip: string,
  args: readonly unknown[],
  dil: DilKodu = aktifDilKodu,
): string {
  if (!kalip.includes('|')) return kalip;
  // Önce köşeli gruplar çözülüyor; geriye boru işareti kalırsa cümlenin
  // TAMAMI iki biçimli demektir.
  const cozulmus = kalip.includes('[') ? koseliCogul(kalip, args, dil) : kalip;
  if (!cozulmus.includes('|')) return cozulmus;
  const formlar = cozulmus.split('|');
  const n = ilkSayi(args);
  // Sayı bulunamadıysa çoğul: "0 results" gibi genel hâl, "1 result"
  // gibi özel hâlden daha güvenli.
  if (n === null) return formlar[formlar.length - 1] ?? cozulmus;
  const secim = pluralKurali(dil).select(n);
  return (secim === 'one' ? formlar[0] : formlar[1]) ?? formlar[0] ?? cozulmus;
}

/* ------------------------------------------------------------------ */
/* Sunucudan gelen metin                                               */
/* ------------------------------------------------------------------ */

/**
 * Sunucu mesajları YERLEŞTİRİLMİŞ geliyor.
 *
 * API `"Bu bölgeye 12 saat içinde tekrar saldıramazsın."` döndürüyor;
 * sözlükte duran ise `"Bu bölgeye {0} saat içinde tekrar
 * saldıramazsın."` Doğrudan özet araması bu yüzden ıskalıyor.
 *
 * Çözüm: yer tutuculu kayıtları bir kez kalıba çevirip gelen metni
 * onlara uyduruyoruz. Yakalanan parçalar (sayılar, adlar) çeviriye
 * aynı sırayla geri konuyor.
 *
 * Bu tabloyu kurmak sözlük başına BİR kez oluyor; arama yalnız hata
 * mesajı gösterilirken çalışıyor ve o da nadir.
 */
export interface SunucuKalibi {
  desen: RegExp;
  anahtar: string;
}

export function sunucuKaliplari(
  sozluk: Sozluk,
  kaynaklar: Readonly<Record<string, string>>,
): SunucuKalibi[] {
  const liste: { k: SunucuKalibi; agirlik: number }[] = [];
  for (const [a, tr] of Object.entries(kaynaklar)) {
    if (!sozluk[a] || !/\{\d+\}/.test(tr)) continue;
    // Sabit parçalar kaçırılıyor, yer tutucular yakalayıcıya dönüyor.
    const desen = tr
      .split(/(\{\d+\})/)
      .map((p) => (/^\{\d+\}$/.test(p) ? '([\\s\\S]*?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('');
    liste.push({
      k: { desen: new RegExp('^' + desen + '$'), anahtar: a },
      // Sabit metni en uzun olan önce denensin: `{0} altın` gibi zayıf
      // bir kalıp, kendinden daha belirgin bir kalıbı çalamasın.
      agirlik: tr.replace(/\{\d+\}/g, '').length,
    });
  }
  return liste.sort((x, y) => y.agirlik - x.agirlik).map((x) => x.k);
}

/**
 * Sunucudan gelen tek bir metni çevirir.
 *
 * Önce doğrudan arama (yer tutucusuz mesajların hepsi burada biter),
 * sonra kalıp eşleştirme. İkisi de tutmazsa gelen metin olduğu gibi
 * dönüyor — çevrilmemiş bir hata mesajı, hiç mesaj olmamasından iyidir.
 */
export function cevirSunucu(
  sozluk: Sozluk | null,
  kaliplar: readonly SunucuKalibi[],
  metin: string,
): string {
  if (!sozluk || !metin) return metin;
  const dogrudan = sozluk[anahtar(metin)];
  if (dogrudan) return cogulSec(dogrudan, []);

  for (const k of kaliplar) {
    const m = k.desen.exec(metin);
    if (m) {
      const kalip = sozluk[k.anahtar];
      const gruplar = m.slice(1);
      return yerlestir(kalip === undefined ? metin : cogulSec(kalip, gruplar), gruplar);
    }
  }
  return metin;
}

/* ------------------------------------------------------------------ */
/* Etkin sözlük — modül düzeyinde                                      */
/* ------------------------------------------------------------------ */

/**
 * Derleme eklentisinin sardığı `__t` buraya bakıyor.
 *
 * Neden shared'da: `vite-ceviri.mjs` hem `apps/web/src` hem
 * `packages/shared/src` dosyalarını sarıyor ve sarma bir içe aktarma
 * ekliyor. Sözlük arayüz katmanında dursaydı motor paketi arayüze
 * bağımlı hâle gelirdi — yönü ters bir bağımlılık. Çözücü ve tuttuğu
 * durum, çözücünün tanımlandığı yerde duruyor.
 *
 * Değişken (`let`) olması bilinçli: sözlük açılışta ağdan geliyor ve
 * bir kez yerine oturuyor.
 */
let aktifSozluk: Sozluk | null = null;
let aktifKaliplar: readonly SunucuKalibi[] = [];
let aktifDilKodu: DilKodu = VARSAYILAN_DIL;

/** Sözlüğü yerine koyar. Yalnız dil sağlayıcısı çağırıyor. */
export function sozlukKur(
  sozluk: Sozluk | null,
  kaliplar: readonly SunucuKalibi[] = [],
  dil: DilKodu = VARSAYILAN_DIL,
): void {
  aktifSozluk = sozluk;
  aktifKaliplar = kaliplar;
  aktifDilKodu = dil;
}

/**
 * Ekranın ŞU AN hangi dilde olduğu.
 *
 * Sözlükle birlikte kuruluyor, ayrı okunmuyor: sözlük yerine
 * oturmadan arayüz Türkçe çiziliyor ve sayı biçimi de Türkçe olmalı.
 * İkisini ayrı kaynaklardan okumak, "İngilizce metin + Türkçe sayı"
 * gibi yarım bir ekran üretirdi.
 */
export function aktifDil(): DilKodu {
  return aktifDilKodu;
}

/**
 * `Intl` için BCP-47 etiketi — sayı, tarih ve çoğul kuralları buradan.
 *
 * Ayrı bir tablo, çünkü dil kodu (`tr`) ile yerel kod (`tr-TR`) aynı
 * şey değil: biri hangi dilde yazdığımızı, öteki sayıyı hangi ülkenin
 * âdetine göre yazdığımızı söylüyor.
 */
const YEREL: Record<DilKodu, string> = { tr: 'tr-TR', en: 'en-US' };

export function yerel(): string {
  return YEREL[aktifDilKodu];
}

export function aktifSozlukVar(): boolean {
  return aktifSozluk !== null;
}

/**
 * Çeviri — derleme eklentisinin her metnin başına koyduğu çağrı.
 *
 * Elle de çağrılabilir; eklentinin göremediği bir yer olursa (dizi
 * sabiti, yardımcı işlev) `t('Türkçe')` yazmak yeterli.
 */
export function t(tr: string, ...args: unknown[]): string {
  return cevir(aktifSozluk, tr, ...args);
}

/** Sunucudan gelen metni çevirir (yerleştirilmiş mesajlar dahil). */
export function ts(metin: string): string {
  return cevirSunucu(aktifSozluk, aktifKaliplar, metin);
}

/* ------------------------------------------------------------------ */
/* Eşzamanlı açılış                                                    */
/* ------------------------------------------------------------------ */

/**
 * SÖZLÜK, HER ŞEYDEN ÖNCE VE BEKLEMEDEN KURULUYOR.
 *
 * Sebebi somut bir hata ve mimarinin en ince yeri burası:
 *
 *   export const KADEME_OZETI = { kamp: t('Bir ateş, birkaç çadır…') }
 *
 * Bu sabit MODÜL YÜKLENİRKEN değerini alıyor. Sözlük ağdan gelseydi —
 * yani bir söz (Promise) beklenseydi — bu satır çoktan çalışmış ve
 * Türkçeyi yakalamış olurdu. Ekranın yarısı İngilizce, yerleşim
 * açıklamaları Türkçe kalıyordu; gerçekten öyle oldu.
 *
 * Çözüm: paket bir kez indirilip `localStorage`a yazılıyor, sonraki
 * her açılışta oradan EŞZAMANLI okunuyor. `localStorage` senkron
 * olduğu için bu satır, ilk sabit değerini almadan bitiyor.
 *
 * `dil.ts` motorun `index.ts` dosyasında EN ÜSTTE duruyor; yani bu
 * blok, metin taşıyan hiçbir modül değerlendirilmeden çalışıyor.
 *
 * Sunucu tarafında `localStorage` yok: blok sessizce atlanıyor ve API
 * her zaman Türkçe üretiyor (istemci çeviriyor).
 */
export const SOZLUK_ANAHTARI = 'lordlar_sozluk';
export const KALIP_ANAHTARI = 'lordlar_kaliplar';
const DIL_ANAHTARI = 'lordlar_dil';

function acilistaKur(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const dil = localStorage.getItem(DIL_ANAHTARI);
    if (!dil || dil === VARSAYILAN_DIL || !dilGecerli(dil)) return;
    const ham = localStorage.getItem(`${SOZLUK_ANAHTARI}_${dil}`);
    if (!ham) return;
    const sozluk = JSON.parse(ham) as Sozluk;
    const kalipHam = localStorage.getItem(`${KALIP_ANAHTARI}_${dil}`);
    const kaynaklar = kalipHam ? (JSON.parse(kalipHam) as Record<string, string>) : {};
    sozlukKur(sozluk, sunucuKaliplari(sozluk, kaynaklar), dil);
  } catch {
    // Bozuk kayıt, dolu depo, gizli sekme: oyun Türkçe açılıyor.
  }
}

acilistaKur();
