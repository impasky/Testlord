/**
 * Rehber ışığı — ekranı karartıp TEK düğmeyi açıkta bırakan perde.
 *
 * Oyuncu testinden çıktı:
 *
 *   "yaptıran öğretici olmamış. Oyuncu girdiğinde zorunlu olarak
 *    tıklamasını istemeliyiz, sadece o buton aktif olmalı, diğer tüm ekran
 *    üzerinde transparan siyah bir panel olmalı — bunu yapmadan başka bir
 *    şeye tıklayamazsın der gibi."
 *
 * ── Neden kaçış düğmesi YOK ───────────────────────────────────────────
 *
 * İlk hâlinde sağ üstte bir "GEÇ" vardı. Oyuncu ikinci turda ayrımı net
 * koydu: "öğretici ile zorunlu yaptırmayı ayır, oyuncu okusa da okumasa da
 * yaptırmalı." Sekiz sayfalık tanıtım ANLATIYOR ve geçilebilir; burası
 * YAPTIRIYOR ve geçilemez. Birini atlamak öbürünü atlamak değil.
 *
 * Zorunluluk kısa ve sonlu: altı dokunuş (eğit → bekle → hepsi → saldır) ve
 * ilk bölge alınınca rehber kendiliğinden biter, bir daha da dönmez.
 *
 * ── Neden sebep BURADA yazıyor ────────────────────────────────────────
 *
 * Oyuncunun ikinci şikâyeti: "şuraya bas diyoruz ama neden bastığını
 * söylemiyoruz." Sebep aslında kâhyanın kartında yazıyordu — ama kart
 * PERDENİN ALTINDA kalıyordu. Kendi perdem sebebi örtüyordu.
 *
 * Artık kâhya perdenin ÜSTÜNDE: portresi ve tek cümlesi deliğin yanında
 * duruyor, cümle de adımın değil DÜĞMENİN sebebini söylüyor (zincirin ara
 * düğmelerinin kendi gerekçesi var; `packages/shared/src/rehber.ts`).
 *
 * ── Delik nasıl açılıyor ───────────────────────────────────────────────
 *
 * Tek bir perde koyup `clip-path` ile delmek görsel olarak delik açar ama
 * tıklamayı geçirmez; `pointer-events: none` eklenince de perde bu kez
 * hiçbir yeri engellemez. Bu yüzden perde DÖRT dikdörtgen: hedefin üstü,
 * altı, solu ve sağı. Deliğin olduğu yerde hiçbir öğe yok, dolayısıyla
 * tıklama tarayıcının kendi kurallarıyla düğmeye ulaşıyor — hile yok.
 *
 * ── Kilitlenmeye karşı ────────────────────────────────────────────────
 *
 * Kaçış düğmesi kalkınca emniyetlerin otomatik olması şart oldu. Üçü var:
 *
 *  1. Ekrandaki İŞ düğmelerinin hepsi kapalıysa (parası yetmiyor, kuyruk
 *     dolu) perde tamamen kalkar. Bu olmasaydı oyuncu Malikâne ile Kışla
 *     arasında sonsuza kadar gidip gelirdi: basılabilir tek düğme onu hep
 *     öbür ekrana yollardı.
 *  2. Listedeki hiçbir işaret bulunamazsa perde birkaç yoklama sonra
 *     kalkar; ışık ekranı asla "boşuna" karartmaz.
 *  3. Hedef güvenli şeride getirilemiyorsa yine kalkar — basılamayan bir
 *     düğmeyi göstermektense hiç göstermemek yeğdir.
 */
import {
  REHBER,
  rehberBeklemesi,
  rehberGorunsunMu,
  rehberIsaretSebebi,
  rehberIsigi,
  rehberSozu,
  type RehberIsaret,
} from '@lordlar/shared';
import { useEffect, useRef, useState } from 'react';
import { Gorsel } from './Gorsel';
import { IkonNavGeneraller, IkonSure } from './Ikonlar';
import { GeriSayim, Hap } from './ui';

/** Deliğin çevresindeki nefes payı. */
const PAY = 8;
/**
 * Deliğin durabileceği güvenli şerit — üstte başlık çubuğu, altta gezinme
 * çubuğu var ve ikisi de perdenin ÜSTÜNDE değil ALTINDA kalıyor. Hedef bu
 * şeridin dışına taşarsa delik oyuncunun basamayacağı bir yeri gösterir.
 */
const UST_PAY = 96;
const ALT_PAY = 96;
/** Kaç yoklama boyunca hedef bulunamazsa perde kalkar (150 ms × 20 = 3 sn). */
const SABIR = 20;
const YOKLAMA_MS = 150;
/**
 * Bir aday ışığı hak etmeden önce kaç milisaniye kararlı durmalı.
 *
 * Oyuncunun bildirdiği hata: "eğit diyorum, Kışla'ya yolluyor; Kışla
 * ekranı açılınca Malikâne'yi gösteriyor, sonra Eğit'i gösteriyor, hepsi
 * 1-2 saniyede oluyor." Sebep şuydu: Kışla açıldığı an listedeki asıl
 * düğme (`kisla-egit`) HENÜZ YOK — verisi geliyor. Işık da o boşlukta
 * listenin gerisine düşüp "Malikâne'ye dön" diyordu. Yani oyuncuya yarım
 * saniyeliğine YANLIŞ yönü gösteriyordu, üstelik geldiği yönü.
 *
 * Yerelde hiç görünmüyordu: her istek anında dönüyor, boşluk oluşmuyor.
 * 600 ms gecikmeyle bakınca kendini hemen gösterdi.
 */
const KARARLILIK_MS = 450;
/**
 * "İş düğmelerinin hepsi kapalı" hâli kaç ms sürerse GERÇEK sayılır.
 *
 * Kararlılık payından çok daha uzun, çünkü bu hâlin yükleme sırasındaki
 * sahtesi tıpatıp aynı görünüyor: Kışla açılırken kaynaklar henüz
 * gelmemişken eğitim düğmesi "altın yetmiyor" diye kapalı çiziliyor. 450
 * ms'de karar verince perde bir kalkıp bir iniyordu. Parası gerçekten
 * yetmeyen oyuncu üç saniye bekliyor; yükleme yapaylığı çok önce geçiyor.
 */
const ENGEL_SABRI = 3000;

interface Kutu {
  ust: number;
  sol: number;
  en: number;
  boy: number;
}

/**
 * Öğe SABİT bir katmanda mı duruyor (alt gezinme çubuğu gibi)?
 *
 * Güvenli şerit kuralı kaydırılan içerik için: orada hedef, üst başlık ya
 * da alt çubuğun ARKASINA kayabiliyor ve delik oyuncunun basamayacağı bir
 * yeri gösteriyor. Sabit bir öğe böyle kaybolmaz — çubuğun kendisi
 * zaten o katman.
 *
 * Ayrım olmadan gerçek bir hata çıktı: Malikâne sekmesi (alt çubukta,
 * ekranın son 67 pikselinde) her zaman "şeridin dışında" sayılıyor,
 * kaydırma da onu kurtaramıyor ve ışık üç saniye sonra sönüyordu. Oyuncu
 * eğitimden sonra Malikâne'ye çağrılıyor, üç saniye sonra tek başına
 * kalıyordu.
 */
function sabitKatmandaMi(e: HTMLElement): boolean {
  for (let n: HTMLElement | null = e; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === 'fixed') return true;
  }
  return false;
}

function basilabilirMi(e: HTMLElement): boolean {
  if (e.hasAttribute('disabled') || e.getAttribute('aria-disabled') === 'true') return false;
  const r = e.getBoundingClientRect();
  return r.width >= 4 && r.height >= 4;
}

/**
 * Sırayla dener, BULUNAN VE BASILABİLİR ilk işareti döndürür.
 *
 * `null` iki şeyi birden anlatamaz, o yüzden `engelli` ayrı: ekranda İŞ
 * düğmesi var ama hepsi kapalıysa (parası yetmiyor, kuyruk dolu) perde
 * kalkmalı. Kaçış düğmesi olmadığı için bu emniyet şart — yoksa oyuncuyu
 * Malikâne ile Kışla arasında sonsuz bir gidiş gelişe hapsederdik:
 * basılabilir tek düğme onu hep öbür ekrana yollardı.
 *
 * `yol` düğmeleri (omurga düğmesi, Malikâne sekmesi) bu hesaba girmez;
 * onlar iş yapmıyor, taşıyor.
 */
function hedefBul(
  isaretler: RehberIsaret[],
  yolYasak: boolean,
): { hedef: HTMLElement | null; sira: number; ilkYol: boolean; engelli: boolean } {
  let isVar = false;
  let isAcik = false;
  let ilk: HTMLElement | null = null;
  let ilkSira = -1;
  let ilkYol = false;

  for (let i = 0; i < isaretler.length; i++) {
    const { isaret, yol } = isaretler[i]!;
    // Oyuncu zaten doğru ekrandaysa yol düğmesi aranmaz: "Malikâne'ye dön"
    // demek ona geldiği yönü göstermek olurdu.
    if (yol && yolYasak) continue;
    const e = document.querySelector<HTMLElement>(`[data-rehber="${isaret}"]`);
    if (!e) continue;
    const acik = basilabilirMi(e);
    if (!yol) {
      isVar = true;
      if (acik) isAcik = true;
    }
    if (acik && !ilk) {
      ilk = e;
      ilkSira = i;
      ilkYol = Boolean(yol);
    }
  }

  return { hedef: ilk, sira: ilkSira, ilkYol, engelli: isVar && !isAcik };
}

function ayniMi(a: Kutu | null, r: DOMRect): boolean {
  return (
    a !== null &&
    Math.abs(a.ust - r.top) < 1 &&
    Math.abs(a.sol - r.left) < 1 &&
    Math.abs(a.en - r.width) < 1 &&
    Math.abs(a.boy - r.height) < 1
  );
}

export function RehberIsigi({
  adim,
  bolgeSayisi,
  gorundu,
  dogruEkranda,
  bekleyisBitis,
  acik,
}: {
  /** Omurganın hesapladığı adım. Işık kendi senaryosunu tutmuyor. */
  adim: string | null;
  bolgeSayisi: number;
  /**
   * Lord bu rehberi daha önce kapatmış mı — HESABA bağlı, tarayıcıya
   * değil. Tarayıcı deposunda tutulduğunda aynı tarayıcıda açılan her
   * yeni hesap rehbersiz açılıyordu.
   */
  gorundu: boolean;
  /**
   * Oyuncu zaten omurganın işaret ettiği ekranda mı?
   *
   * Bildirilen hatanın asıl çözümü bu. Kışla açılırken `kisla-egit` bir
   * süre DOM'da yok — verisi geliyor. Işık o boşlukta listenin gerisine
   * düşüp "Malikâne'ye dön" diyordu; oyuncu Kışla'ya yeni gelmişken ona
   * geldiği yönü gösteriyordu. Doğru ekrandayken yol düğmeleri hiç
   * aranmıyor: gösterilecek bir şey yoksa ışık BEKLİYOR, yanlış yeri
   * göstermiyor.
   *
   * Ölçüt uydurma değil: omurga zaten her adım için `hedefSekme`
   * hesaplıyor ve alt çubuktaki altın nokta da onu kullanıyor.
   */
  dogruEkranda: boolean;
  /**
   * Beklenen işin bitiş anı (ISO). Eğitim sürerken perde kalkmıyor;
   * kâhya kalan süreyi söylüyor.
   */
  bekleyisBitis: string | null;
  /** Öğretici kapandı mı — iki tam ekran perde üst üste binmesin. */
  acik: boolean;
}) {
  const [kutu, setKutu] = useState<Kutu | null>(null);
  /** Doğru ekrandayız ama düğme henüz gelmedi: perde dursun, delik yok. */
  const [bekleme, setBekleme] = useState(false);
  // Aydınlatılan düğmenin adı: kâhyanın cümlesi buna göre değişiyor.
  const [hedefAdi, setHedefAdi] = useState<string | null>(null);
  const [itiraz, setItiraz] = useState(false);

  const isaretler = rehberIsigi(adim);
  const gorunur = acik && rehberGorunsunMu(bolgeSayisi, gorundu);

  /*
   * TUTMA: basacak düğme yok, iş bitene kadar bekleniyor.
   *
   * Oyuncu turu bir bütün istedi: "eğit dedi, o zaman eğitim tamamlanana
   * kadar geçilemesin ve Kâhya Sinan desin ki askerleriniz eğitiliyor."
   * Önceden bu adımda ışık sönüyor, oyuncu serbest kalıyor ve tur tam
   * orada — sonucu görmeden — kopuyordu.
   *
   * Emniyet: kalan süre `azamiSaniye`yi aşıyorsa tutmuyoruz. İlk eğitim
   * beş saniye; kimseyi kara ekranda dakikalarca bekletmeyelim.
   */
  const bekleyis = rehberBeklemesi(adim);
  const kalanMs = bekleyisBitis ? new Date(bekleyisBitis).getTime() - Date.now() : null;
  const tutuluyor =
    gorunur &&
    bekleyis !== null &&
    kalanMs !== null &&
    kalanMs > 0 &&
    kalanMs <= bekleyis.azamiSaniye * 1000;

  const calissin = gorunur && !tutuluyor && isaretler.length > 0;
  // Etki bağımlılığı için sabit bir değer: dizi her çizimde yeniden üretilir
  // ve doğrudan bağımlılık yapılsaydı etki her karede yeniden kurulurdu.
  const anahtar = isaretler.map((x) => x.isaret).join('|');
  // Etki yalnız `anahtar` değişince kuruluyor; listenin kendisini ref ile
  // geçiriyoruz. Diziyi doğrudan bağımlılık yapmak etkiyi her karede
  // yeniden kurardı (her çizimde yeni bir dizi üretiliyor).
  const isaretlerRef = useRef<RehberIsaret[]>(isaretler);
  isaretlerRef.current = isaretler;

  useEffect(() => {
    if (!calissin) {
      setKutu(null);
      setBekleme(false);
      setHedefAdi(null);
      return;
    }
    let yok = 0;
    /**
     * Hedef üst üste kaç kez güvenli şeridin dışında kaldı.
     *
     * Kaydırma çoğu zaman düzeltiyor ama düzeltemediği bir hâl olabilir
     * (kap zaten sonuna kadar kaymış, hedef yine de çubuğun altında).
     * Orada delik oyuncunun basamayacağı bir yeri gösterirdi; ısrar
     * ederse perdeyi kaldırıyoruz. Ekranı karartıp basılamayan bir düğme
     * göstermektense hiç karartmamak yeğdir.
     */
    let disari = 0;
    let sonAd = '';

    /**
     * O an ışığın üstünde durduğu işaretin listedeki DERİNLİĞİ.
     *
     * Küçük sıra = ekranın derinindeki asıl düğme, büyük sıra = yüzeydeki
     * yol düğmesi. `null` ise henüz hiçbir şey aydınlatılmadı.
     */
    let mevcutSira: number | null = null;
    /** Kabul edilmeyi bekleyen adayın sırası ve ne zamandır beklediği. */
    let aday: { sira: number; ne: number } | null = null;
    /** "İş düğmelerinin hepsi kapalı" hâli ne zamandır sürüyor. */
    let engelDen: number | null = null;

    /**
     * Aday şimdi kabul edilsin mi?
     *
     * İŞ düğmesi anında kabul edilir: o bir yükleme yan ürünü değil,
     * varış noktasının ta kendisi. Beklemeye sokmak, oyuncu Kışla'ya
     * varmışken eğitim düğmesi ortadayken yarım saniye boş bakması
     * demekti.
     *
     * DERİNE gitmek de anında: oyuncu bir düğmeye bastı ve asıl düğme
     * belirdi, ışık hemen oraya geçmeli.
     *
     * Yalnız YOL düğmesine düşmek beklemeli — o neredeyse her zaman
     * ekranın hâlâ yükleniyor olması demek.
     */
    const kabulEt = (sira: number, yol: boolean, simdi: number): boolean => {
      if (!yol) return true;
      if (mevcutSira !== null && sira <= mevcutSira) return true;
      if (!aday || aday.sira !== sira) {
        aday = { sira, ne: simdi };
        return false;
      }
      return simdi - aday.ne >= KARARLILIK_MS;
    };

    const olc = () => {
      const liste = isaretlerRef.current;
      const simdi = performance.now();
      const { hedef: e, sira, ilkYol, engelli } = hedefBul(liste, dogruEkranda);

      /*
       * Ekrandaki iş düğmelerinin hepsi kapalı: yapılacak bir şey yok,
       * perde kalksın. Buna da kararlılık aranıyor — bir eylem gönderilirken
       * düğme kısa süre kapanıyor ve o an perdeyi kaldırmak titreme olurdu.
       */
      if (engelli) {
        engelDen ??= simdi;
        const gercek = simdi - engelDen >= ENGEL_SABRI;
        setKutu(null);
        // Karar verilene kadar perde duruyor: bir kalkıp bir inmesin.
        setBekleme(dogruEkranda && !gercek);
        if (gercek) {
          setHedefAdi(null);
          mevcutSira = null;
        }
        return;
      }
      engelDen = null;

      if (!e) {
        yok++;
        // Doğru ekranda ve düğme henüz gelmediyse perde DURUYOR, delik
        // açılmıyor: oyuncu bu arada başka bir yere basamasın diye. Ekran
        // zaten iskeletlerle yükleniyor, kâhya da ne beklediğini söylüyor.
        setKutu(null);
        setBekleme(dogruEkranda && yok < SABIR);
        if (yok >= SABIR) {
          setHedefAdi(null);
          mevcutSira = null;
        }
        return;
      }
      yok = 0;
      setBekleme(false);

      if (!kabulEt(sira, ilkYol, simdi)) {
        // Aday henüz olgunlaşmadı. Eski hedef DOM'dan gittiyse eski
        // koordinatta delik açmak, o noktada artık duran başka bir şeyi
        // aydınlatmak olurdu; delik kapanıyor ama PERDE DURUYOR — bir
        // kalkıp bir inen perde oyuncunun şikâyet ettiği titremenin ta
        // kendisiydi.
        if (!document.body.contains(document.querySelector(`[data-rehber="${sonAd}"]`))) {
          setKutu(null);
          setBekleme(dogruEkranda);
          setHedefAdi(null);
        }
        return;
      }
      aday = null;
      mevcutSira = sira;

      const r = e.getBoundingClientRect();

      /*
       * Hedefi güvenli şeride getir.
       *
       * Bu kontrol yalnız hedef DEĞİŞTİĞİNDE yapılıyordu ve gerçek bir
       * hataya yol açtı: haritada "Hepsi"ye basınca saldırı önizlemesi ile
       * karşı-ipuçları kartı beliriyor, panel 770'ten 1188 piksele uzuyor
       * ve "Saldır" düğmesi alt gezinme çubuğunun ARKASINA kayıyordu.
       * Hedef değişmediği için ışık peşinden gitmiyor, delik oyuncunun
       * basamayacağı bir yeri gösteriyordu.
       *
       * Perde zaten bütün dokunuşları yuttuğu için oyuncu kendi
       * kaydıramaz; hedefi görünür tutmak bu yüzden bir incelik değil,
       * kilitlenmeye karşı şart.
       */
      const ad = e.getAttribute('data-rehber') ?? '';
      setHedefAdi((o) => (o === ad ? o : ad));
      // Sabit katmandaki hedef için tek koşul: ekranda olsun.
      const disarida = sabitKatmandaMi(e)
        ? r.bottom <= 0 || r.top >= window.innerHeight
        : r.top < UST_PAY || r.bottom > window.innerHeight - ALT_PAY;
      if (disarida) {
        // Hedef değiştiyse yumuşak (göz takip etsin), yerinde kaydıysa
        // anında — 150 ms'de bir yumuşak kaydırma titreme yaratırdı.
        e.scrollIntoView({ block: 'center', behavior: ad !== sonAd ? 'smooth' : 'auto' });
        disari++;
        if (disari >= SABIR) {
          setKutu(null);
          setHedefAdi(null);
          sonAd = ad;
          return;
        }
      } else {
        disari = 0;
      }
      sonAd = ad;

      setKutu((o) => (ayniMi(o, r) ? o : { ust: r.top, sol: r.left, en: r.width, boy: r.height }));
    };

    olc();
    const id = setInterval(olc, YOKLAMA_MS);
    // Yakalama evresinde: iç kaydırıcılar (bölge paneli, kışla listesi)
    // window'a olay sızdırmaz, delik onlarla birlikte kaymalı.
    window.addEventListener('scroll', olc, true);
    window.addEventListener('resize', olc);
    return () => {
      clearInterval(id);
      window.removeEventListener('scroll', olc, true);
      window.removeEventListener('resize', olc);
    };
  }, [calissin, anahtar, dogruEkranda]);

  // Perdeye basmak bir şey yapmaz ama sessiz kalmaz: halka bir kez titrer.
  // Tepkisiz bir ekran "oyun dondu" diye okunur.
  /*
   * Perde parçaları KAYARAK yer değiştiriyor, zıplayarak değil.
   *
   * Oyuncu: "yönlendirme işini daha akıcı ve smooth yapar mısın." Delik
   * bir düğmeden öbürüne anında atlayınca göz bağı kopuyor ve zincir
   * "bir şeyler oluyor" gibi okunuyordu. 220 ms'lik kayma, gözün deliği
   * takip etmesine yetiyor.
   *
   * Hareket hassasiyeti olan oyuncu için kapalı: `motion-safe`.
   */
  const perde = 'fixed z-[55] bg-black/72 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out';
  const dokun = () => {
    setItiraz(true);
    window.setTimeout(() => setItiraz(false), 450);
  };

  /*
   * TUTMA: iş sürüyor, oyuncu turdan çıkmıyor.
   *
   * Perde tam ekran, delik yok, kâhya kalan süreyi söylüyor. Beş saniye
   * sonra eğitim bitiyor, askerler orduya katılıyor ve tur "saldır"
   * adımıyla kendiliğinden devam ediyor.
   */
  if (tutuluyor && bekleyis && bekleyisBitis) {
    return (
      <>
        <div className={perde} style={{ inset: 0 }} onClick={dokun} />
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 top-1/2 z-[56] flex -translate-y-1/2 justify-center px-3"
        >
          <div className="w-full max-w-sm rounded-2xl border border-altin/45 bg-gece/95 p-3 shadow-xl">
            <div className="flex items-start gap-2.5">
              <div className="oyuk h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-kenar">
                <Gorsel
                  tur="generaller"
                  ad={REHBER.key}
                  alt={REHBER.ad}
                  boyut={36}
                  yedek={
                    <span className="flex h-full w-full items-center justify-center text-solgun">
                      <IkonNavGeneraller boyut={18} />
                    </span>
                  }
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="baslik text-[10px] text-mavi">{REHBER.ad}</span>
                <p className="mt-0.5 text-[13px] leading-snug text-parsomen">{bekleyis.soz}</p>
              </div>
            </div>
            <div className="mt-2 flex justify-center">
              <Hap ikon={<IkonSure boyut={13} />} renk="var(--color-altin)">
                <GeriSayim bitis={bekleyisBitis} />
              </Hap>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!calissin) return null;

  /*
   * BEKLEME: doğru ekrandayız, düğme henüz gelmedi.
   *
   * Perde tam ekran duruyor ve delik açılmıyor. Perdeyi tamamen kaldırmak
   * da bir seçenekti ama o da titreme olurdu — oyuncunun şikâyeti zaten
   * "hepsi 1-2 saniye içinde anlık oluyor" idi. Perde sabit kalıyor,
   * yalnız delik hazır olunca açılıyor.
   */
  if (!kutu) {
    if (!bekleme) return null;
    return (
      <>
        <div className={perde} style={{ inset: 0 }} onClick={dokun} />
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 top-1/2 z-[56] flex -translate-y-1/2 justify-center px-3"
        >
          <div className="w-full max-w-sm rounded-2xl border border-altin/45 bg-gece/95 p-3 shadow-xl">
            <div className="flex items-start gap-2.5">
              <div className="oyuk h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-kenar">
                <Gorsel
                  tur="generaller"
                  ad={REHBER.key}
                  alt={REHBER.ad}
                  boyut={36}
                  yedek={
                    <span className="flex h-full w-full items-center justify-center text-solgun">
                      <IkonNavGeneraller boyut={18} />
                    </span>
                  }
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="baslik text-[10px] text-mavi">{REHBER.ad}</span>
                <p className="mt-0.5 text-[13px] leading-snug text-parsomen">
                  {rehberSozu(adim)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const u = Math.max(0, kutu.ust - PAY);
  const a = Math.min(window.innerHeight, kutu.ust + kutu.boy + PAY);
  const s = Math.max(0, kutu.sol - PAY);
  const g = kutu.sol + kutu.en + PAY;

  /*
   * Kâhya kartı deliğin altına, yer yoksa üstüne.
   *
   * Kart perdenin ÜSTÜNDE (z-56) çünkü asıl mesele buydu: sebep
   * Malikâne'deki kâhya kartında yazıyordu ama perdenin altında kalıyordu.
   * Oyuncu "şuraya bas diyoruz ama neden bastığını söylemiyoruz" derken
   * tam olarak bunu gördü.
   */
  const KART_BOY = 150;
  const altaSigar = window.innerHeight - a > KART_BOY;
  const sebep = rehberIsaretSebebi(adim, hedefAdi ?? '');

  return (
    <>
      <div className={perde} style={{ top: 0, left: 0, right: 0, height: u }} onClick={dokun} />
      <div className={perde} style={{ top: a, left: 0, right: 0, bottom: 0 }} onClick={dokun} />
      <div className={perde} style={{ top: u, left: 0, width: s, height: a - u }} onClick={dokun} />
      <div className={perde} style={{ top: u, left: g, right: 0, height: a - u }} onClick={dokun} />

      {/* Halka ve kart tıklamayı geçirir: deliğin üstünde duran hiçbir şey
          düğmeye giden parmağı yakalamamalı. */}
      <div
        aria-hidden
        className={`pointer-events-none fixed z-[56] rounded-2xl border-2 border-altin motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out ${
          itiraz ? 'motion-safe:animate-[nabiz_0.45s_ease-in-out]' : ''
        }`}
        style={{
          top: u,
          left: s,
          width: g - s,
          height: a - u,
          boxShadow: '0 0 0 2px rgba(0,0,0,0.55), 0 0 22px 4px var(--color-altin)',
        }}
      />

      <div
        role="status"
        className="pointer-events-none fixed z-[56] flex justify-center px-3 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out"
        style={
          altaSigar
            ? { top: a + 12, left: 0, right: 0 }
            : { top: Math.max(8, u - KART_BOY + 6), left: 0, right: 0 }
        }
      >
        <div className="w-full max-w-sm rounded-2xl border border-altin/45 bg-gece/95 p-3 shadow-xl">
          <div className="flex items-start gap-2.5">
            <div className="oyuk h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-kenar">
              <Gorsel
                tur="generaller"
                ad={REHBER.key}
                alt={REHBER.ad}
                boyut={36}
                yedek={
                  <span className="flex h-full w-full items-center justify-center text-solgun">
                    <IkonNavGeneraller boyut={18} />
                  </span>
                }
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="baslik text-[10px] text-mavi">{REHBER.ad}</span>
              {/* NEDEN bastığı. Cümle adımın değil DÜĞMENİN sebebi —
                  zincirin ara düğmelerinin kendi gerekçesi var. */}
              <p className="mt-0.5 text-[13px] leading-snug text-parsomen">{sebep}</p>
            </div>
          </div>
          <p className="baslik mt-2 text-center text-[11px] text-altin">
            ↓ şimdi buna bas ↓
          </p>
        </div>
      </div>
    </>
  );
}
