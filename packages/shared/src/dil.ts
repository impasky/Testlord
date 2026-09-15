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
  const kalip = sozluk?.[anahtar(tr)] ?? tr;
  return yerlestir(kalip, args);
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
  if (dogrudan) return dogrudan;

  for (const k of kaliplar) {
    const m = k.desen.exec(metin);
    if (m) return yerlestir(sozluk[k.anahtar] ?? metin, m.slice(1));
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

/** Sözlüğü yerine koyar. Yalnız dil sağlayıcısı çağırıyor. */
export function sozlukKur(sozluk: Sozluk | null, kaliplar: readonly SunucuKalibi[] = []): void {
  aktifSozluk = sozluk;
  aktifKaliplar = kaliplar;
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
    sozlukKur(sozluk, sunucuKaliplari(sozluk, kaynaklar));
  } catch {
    // Bozuk kayıt, dolu depo, gizli sekme: oyun Türkçe açılıyor.
  }
}

acilistaKur();
