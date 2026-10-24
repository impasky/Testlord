/**
 * Telefonda çizim ölçümü (docs/24 "Telefonda ölçüm").
 *
 * Oyuncu: "telefonda çizim ölçüm ekranı." Bütün hız ölçümleri bu güne kadar
 * geliştirme kabının yazılım GPU'suyla yapıldı; gerçek telefonda nasıl
 * çalıştığını hiç bilmiyorduk. Adrese `?olcum=1` eklenince her çizim işi
 * (`glCiz`) buraya bir kayıt bırakıyor ve ekranın köşesinde bir pano
 * beliriyor (`CizimOlcumPaneli`); oyuncu sonuçları kopyalayıp gönderiyor.
 *
 * Açık olduğu cihazda kalıyor (`localStorage`): ana ekrana eklenmiş uygulama
 * adres çubuğu olmadan açılıyor. `?olcum=0` kapatıyor. Kapalıyken hiçbir
 * şey kaydedilmiyor; maliyeti bir bayrak okumak.
 *
 * TAKILMA da burada (`takilmaIzle`): 50 ms'yi aşan kareler ve tarayıcının
 * bildirdiği uzun görevler, o an açık ekranla. "Şehirde kasma var" şikâyeti
 * defalarca geliştirme kabında ölçülüp düzeltildi ve telefonda sürdü; kabın
 * GPU'su yazılım, telefonunki değil. Takılmanın NEREDE olduğunu artık
 * telefonun kendisi söylüyor.
 */

const ANAHTAR = 'cizim-olcum';
/** En çok bu kadar kayıt tutuluyor (en eskisi düşüyor). */
const SINIR = 300;

let acik: boolean | null = null;

/** Ölçüm açık mı: adres (`?olcum=1` / `?olcum=0`) ya da cihazdaki ayar. */
export function olcumAcik(): boolean {
  if (acik !== null) return acik;
  acik = false;
  try {
    const p = new URLSearchParams(window.location.search).get('olcum');
    if (p === '1') localStorage.setItem(ANAHTAR, '1');
    else if (p === '0') localStorage.removeItem(ANAHTAR);
    acik = localStorage.getItem(ANAHTAR) === '1';
  } catch {
    // Depo kapalı (gizli sekme): yalnız adresteki bayrak.
    try {
      acik = new URLSearchParams(window.location.search).get('olcum') === '1';
    } catch {
      acik = false;
    }
  }
  return acik;
}

/** Ölçümü kapatır (pano "Kapat"). */
export function olcumuKapat(): void {
  acik = false;
  try {
    localStorage.removeItem(ANAHTAR);
  } catch {
    /* depo kapalı */
  }
  haberVer();
}

export interface CizimKaydi {
  /** Çizimin anahtarı (`bina:kisla_3|…|136x136`). */
  anahtar: string;
  /** Çıktının piksel sayısı (en × boy). */
  piksel: number;
  /** Nereden geldi: cihazdaki kayıttan, çizilerek, ya da gelmedi. */
  kaynak: 'kayit' | 'cizim' | 'yok';
  /** Önce kaba taslak mı (`Sahne` `OnceKaba`). */
  taslak: boolean;
  /** İstendikten sonra resim gelene kadar (ms). */
  toplam: number;
  /** Bunun çizimde geçen kısmı (ms; sırada bekleme toplamdan geriye kalan). */
  cizim: number;
  /** Kaç kez kesildi (bkz. `gl.ts` `kesmeyiDene`). */
  kesilme: number;
  /** Ne zaman bitti (sayfa açıldıktan sonra, ms). */
  bitti: number;
  /** Çizimin aşama süreleri (`CizimSonucu.evreler`); kayıttan gelende yok. */
  evreler?: Record<string, number>;
}

const KAYITLAR: CizimKaydi[] = [];
const DINLEYICILER = new Set<() => void>();

function haberVer() {
  for (const f of DINLEYICILER) f();
}

export function olcumKaydet(k: CizimKaydi): void {
  if (!olcumAcik()) return;
  KAYITLAR.push(k);
  if (KAYITLAR.length > SINIR) KAYITLAR.shift();
  haberVer();
}

export function olcumKayitlari(): readonly CizimKaydi[] {
  return KAYITLAR;
}

/** Pano en son ne zaman temizlendi (sayfa açıldıktan sonra, ms): rapor ondan sonrası. */
let temizlendi: number | null = null;

export function temizlenmeAni(): number | null {
  return temizlendi;
}

export function olcumuTemizle(): void {
  KAYITLAR.length = 0;
  TAKILMALAR.length = 0;
  IZLENEN.clear();
  // Geçişler de: sayılan karelerle aynı dönemi anlatsın (dördüncü raporda
  // geçişler baştan, kareler temizlikten sonrasıydı).
  GECISLER.length = 0;
  temizlendi = performance.now();
  haberVer();
}

/** Kayıt ya da kapatma olunca çağrılır; dönen işlev dinlemeyi bırakır. */
export function olcumuDinle(f: () => void): () => void {
  DINLEYICILER.add(f);
  return () => DINLEYICILER.delete(f);
}

/** Ölçülen bir çizim denemesi: süresi `cizim`e eklenir, deneme sayısı artar. */
export async function olcerek<T>(
  o: { cizim: number; deneme: number },
  f: () => Promise<T>,
): Promise<T> {
  const bas = performance.now();
  o.deneme++;
  try {
    return await f();
  } finally {
    o.cizim += performance.now() - bas;
  }
}

/** Kaydın kısa adı: anahtarın ilk parçası ve çıktı boyu (`bina:kisla_3 136×136`). */
export function kisaAd(anahtar: string): string {
  const parcalar = anahtar.split('|');
  const boy = [...parcalar].reverse().find((p) => /^\d+x\d+$/.test(p));
  return `${parcalar[0]}${boy ? ' ' + boy.replace('x', '×') : ''}`;
}

/** Kayıtların özeti: kaynağa göre sayı, ortalama ve en uzun süre. */
export function ozet(kayitlar: readonly CizimKaydi[]) {
  const grup = (s: (k: CizimKaydi) => boolean) => {
    const k = kayitlar.filter(s);
    const sure = k.map((x) => x.toplam);
    return {
      sayi: k.length,
      ortalama: sure.length ? sure.reduce((a, x) => a + x, 0) / sure.length : 0,
      enUzun: sure.length ? Math.max(...sure) : 0,
      cizimOrtalama: k.length ? k.reduce((a, x) => a + x.cizim, 0) / k.length : 0,
    };
  };
  return {
    kayit: grup((k) => k.kaynak === 'kayit'),
    cizim: grup((k) => k.kaynak === 'cizim' && !k.taslak),
    taslak: grup((k) => k.kaynak === 'cizim' && k.taslak),
    kesilme: kayitlar.reduce((a, k) => a + k.kesilme, 0),
  };
}

/* ── Takılma ─────────────────────────────────────────────────────────── */

/** Takılma: eşiği aşan bir kare ya da tarayıcının bildirdiği uzun görev. */
export interface TakilmaKaydi {
  tur: 'kare' | 'gorev';
  /** Süre (ms). */
  sure: number;
  /** O an açık ekran (alt çubuktaki adı). */
  ekran: string;
  /** Sayfa açıldıktan sonra (ms). */
  an: number;
  /**
   * Uzun karede ne oldu (Long Animation Frames; Chrome): en uzun betik
   * (çağıran, işlev, dosya), stil + yerleşim süresi; ana iş parçacığı
   * boştuysa çizimi GPU ya da bileşikleyici bekletmiş. Bilinmiyorsa boş.
   */
  neden?: string;
}

/** Bundan uzun kare takılma sayılıyor: 60 Hz'de üç kare kaçmış demek. */
export const KARE_ESIGI = 50;

const TAKILMALAR: TakilmaKaydi[] = [];
/** Açık ekranın değiştiği anlar: takılmalar geçişlerle yan yana okunsun. */
const GECISLER: { ekran: string; an: number }[] = [];
/** Ekran başına izlenen kare sayısı ve süre: takılmayı orana çevirmek için. */
const IZLENEN = new Map<string, { kare: number; sure: number }>();

export function takilmaKaydet(k: TakilmaKaydi): void {
  if (!olcumAcik()) return;
  TAKILMALAR.push(k);
  if (TAKILMALAR.length > SINIR) TAKILMALAR.shift();
  haberVer();
}

export function takilmalar(): readonly TakilmaKaydi[] {
  return TAKILMALAR;
}

export function izlenenKareler(): ReadonlyMap<string, { kare: number; sure: number }> {
  return IZLENEN;
}

export function ekranGecisleri(): readonly { ekran: string; an: number }[] {
  return GECISLER;
}

/** Long Animation Frames kaydının kullanılan kısmı (TypeScript'in tiplerinde yok). */
export interface UzunKare extends PerformanceEntry {
  styleAndLayoutStart: number;
  /** Karedeki 50 ms'yi aşan görevlerin aşan kısımları toplamı: 0 ise ana iş parçacığı tıkanmadı. */
  blockingDuration: number;
  scripts: {
    invoker: string;
    sourceURL: string;
    sourceFunctionName: string;
    sourceCharPosition: number;
    duration: number;
  }[];
}

/**
 * Uzun kareyi tek satıra: en uzun betik (birden çoksa toplamı da), stil +
 * yerleşim ve ikisinin dışında kalan. Kalan, ana iş parçacığı tıkanmadıysa
 * ya da 100 ms'yi aşıyorsa yazılıyor: kare çizimi beklemiş (GPU ya da
 * bileşikleyici). Geliştirme kabında Şehir'in en uzun kareleri (0,6–1,9 sn)
 * böyleydi: betik yok, stil ve yerleşim 0 ms; o sırada işçinin GPU işi
 * sürüyordu. Kalanın içinde 5 ms'den kısa betikler de var (listede yoklar).
 */
export function uzunKareNedeni(k: UzunKare): string {
  const parca: string[] = [];
  const betik = [...k.scripts].sort((a, b) => b.duration - a.duration)[0];
  const betikler = k.scripts.reduce((a, s) => a + s.duration, 0);
  if (betik) {
    const dosya = betik.sourceURL.split('/').pop()?.split('?')[0] ?? '';
    const yer = dosya ? ` ${dosya}:${betik.sourceCharPosition}` : '';
    const islev = betik.sourceFunctionName ? ` ${betik.sourceFunctionName}` : '';
    parca.push(`betik ${Math.round(betik.duration)} ms (${betik.invoker}${islev}${yer})`);
  }
  if (k.scripts.length > 1) parca.push(`betikler toplam ${Math.round(betikler)} ms`);
  const stil = k.styleAndLayoutStart > 0 ? k.startTime + k.duration - k.styleAndLayoutStart : 0;
  if (stil >= 5) parca.push(`stil+yerleşim ${Math.round(stil)} ms`);
  // Ana iş parçacığı boştu: kareyi GPU ya da bileşikleyici bekletti.
  const bos = k.duration - betikler - stil;
  if (!k.blockingDuration || bos >= 100)
    parca.push(`boşta ${Math.round(bos)} ms (GPU/bileşikleyici)`);
  return parca.join(', ');
}

/**
 * Uzun kare bildirimi: nedeni aynı karenin takılmasına (`requestAnimationFrame`
 * aralığı, `an` karenin içinde) yazılıyor. Ana iş parçacığı tıkandıysa
 * ayrıca uzun görev; tıkanmadıysa takılma zaten karede sayılı.
 */
export function uzunKareyiKaydet(k: UzunKare, ekran: string): void {
  if (k.duration <= KARE_ESIGI) return;
  const neden = uzunKareNedeni(k);
  const bitis = k.startTime + k.duration;
  for (let i = TAKILMALAR.length - 1; i >= Math.max(0, TAKILMALAR.length - 10); i--) {
    const t = TAKILMALAR[i]!;
    if (t.tur === 'kare' && !t.neden && t.an >= k.startTime - 1 && t.an <= bitis + 1) {
      t.neden = neden;
      haberVer();
      break;
    }
  }
  if (k.blockingDuration > 0)
    takilmaKaydet({ tur: 'gorev', sure: k.duration, ekran, an: k.startTime, neden });
}

/**
 * O an açık ekran: alt çubuktaki sekme ve üstünde açık panel varsa onun adı
 * ("Akın › Sıralama"). Kapılar sekmenin üstünde açılıyor (`KapiPaneli`):
 * dördüncü raporda Sıralama, Görevler, Pazar ve Generaller'in takılmaları
 * hep "Akın" diye sayılmıştı.
 */
export function acikEkran(): string {
  const sekme = document.querySelector('nav [aria-current="page"]')?.textContent?.trim() || '?';
  const paneller = document.querySelectorAll('[role="dialog"][aria-label]');
  const panel = paneller[paneller.length - 1]?.getAttribute('aria-label')?.trim();
  return panel ? `${sekme} › ${panel}` : sekme;
}

let izleniyor = false;

/**
 * Kare ve uzun görev izlemeyi başlatır — pano açılınca, yalnız ölçüm
 * açıkken. Kare izlemenin kendisi her karede ana iş parçacığını uyandırıyor;
 * ölçüm kapalıyken hiç çalışmıyor, kapatılınca duruyor.
 */
export function takilmaIzle(): void {
  if (izleniyor || !olcumAcik()) return;
  izleniyor = true;
  let son = performance.now();
  // Arka plandayken kare gelmiyor: dönüşteki boşluk takılma değil.
  document.addEventListener('visibilitychange', () => {
    son = performance.now();
  });
  const kare = (t: number) => {
    if (!olcumAcik()) {
      izleniyor = false;
      return;
    }
    const ara = t - son;
    son = t;
    if (document.visibilityState === 'visible') {
      const ekran = acikEkran();
      if (GECISLER[GECISLER.length - 1]?.ekran !== ekran) {
        GECISLER.push({ ekran, an: t });
        if (GECISLER.length > SINIR) GECISLER.shift();
      }
      const iz = IZLENEN.get(ekran) ?? { kare: 0, sure: 0 };
      iz.kare++;
      iz.sure += ara;
      IZLENEN.set(ekran, iz);
      if (ara > KARE_ESIGI) takilmaKaydet({ tur: 'kare', sure: ara, ekran, an: t });
    }
    requestAnimationFrame(kare);
  };
  requestAnimationFrame(kare);
  // Uzun görev: varsa Long Animation Frames (neyin çalıştığıyla), yoksa
  // eski "longtask" (yalnız süre). İkisi birden değil: aynı görev iki kez sayılmasın.
  try {
    if (PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) {
      new PerformanceObserver((liste) => {
        for (const g of liste.getEntries()) uzunKareyiKaydet(g as UzunKare, acikEkran());
      }).observe({ type: 'long-animation-frame' });
      return;
    }
    new PerformanceObserver((liste) => {
      for (const g of liste.getEntries())
        takilmaKaydet({ tur: 'gorev', sure: g.duration, ekran: acikEkran(), an: g.startTime });
    }).observe({ type: 'longtask' });
  } catch {
    // Uzun görev bildirimi yok (Safari): kareler yine ölçülüyor.
  }
}

export interface EkranTakilmasi {
  ekran: string;
  kare: number;
  /** Eşiği aşan kare sayısı. */
  takilma: number;
  /** Takılan karelerin izlenen karelere oranı (0–1). */
  oran: number;
  enUzunKare: number;
  gorev: number;
  gorevToplam: number;
}

/** Ekran başına takılma özeti — en çok takılan önce. */
export function takilmaOzeti(
  kayitlar: readonly TakilmaKaydi[],
  izlenen: ReadonlyMap<string, { kare: number; sure: number }>,
): EkranTakilmasi[] {
  const ekranlar = new Set([...izlenen.keys(), ...kayitlar.map((k) => k.ekran)]);
  return [...ekranlar]
    .map((ekran) => {
      const kareler = kayitlar.filter((k) => k.ekran === ekran && k.tur === 'kare');
      const gorevler = kayitlar.filter((k) => k.ekran === ekran && k.tur === 'gorev');
      const kare = izlenen.get(ekran)?.kare ?? 0;
      return {
        ekran,
        kare,
        takilma: kareler.length,
        oran: kare ? kareler.length / kare : 0,
        enUzunKare: kareler.reduce((m, k) => Math.max(m, k.sure), 0),
        gorev: gorevler.length,
        gorevToplam: gorevler.reduce((a, k) => a + k.sure, 0),
      };
    })
    .sort((a, b) => b.takilma + b.gorev - (a.takilma + a.gorev));
}
