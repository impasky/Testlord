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

export function olcumuTemizle(): void {
  KAYITLAR.length = 0;
  TAKILMALAR.length = 0;
  IZLENEN.clear();
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
}

/** Bundan uzun kare takılma sayılıyor: 60 Hz'de üç kare kaçmış demek. */
export const KARE_ESIGI = 50;

const TAKILMALAR: TakilmaKaydi[] = [];
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

function acikEkran(): string {
  return document.querySelector('nav [aria-current="page"]')?.textContent?.trim() || '?';
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
      const iz = IZLENEN.get(ekran) ?? { kare: 0, sure: 0 };
      iz.kare++;
      iz.sure += ara;
      IZLENEN.set(ekran, iz);
      if (ara > KARE_ESIGI) takilmaKaydet({ tur: 'kare', sure: ara, ekran, an: t });
    }
    requestAnimationFrame(kare);
  };
  requestAnimationFrame(kare);
  try {
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
