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
  rehberGorunsunMu,
  rehberIsaretSebebi,
  rehberIsigi,
  type RehberIsaret,
} from '@lordlar/shared';
import { useEffect, useRef, useState } from 'react';
import { Gorsel } from './Gorsel';
import { IkonNavGeneraller } from './Ikonlar';

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

interface Kutu {
  ust: number;
  sol: number;
  en: number;
  boy: number;
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
function hedefBul(isaretler: RehberIsaret[]): { hedef: HTMLElement | null; engelli: boolean } {
  let isVar = false;
  let isAcik = false;
  let ilk: HTMLElement | null = null;

  for (const { isaret, yol } of isaretler) {
    const e = document.querySelector<HTMLElement>(`[data-rehber="${isaret}"]`);
    if (!e) continue;
    const acik = basilabilirMi(e);
    if (!yol) {
      isVar = true;
      if (acik) isAcik = true;
    }
    if (acik && !ilk) ilk = e;
  }

  return { hedef: ilk, engelli: isVar && !isAcik };
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
  /** Öğretici kapandı mı — iki tam ekran perde üst üste binmesin. */
  acik: boolean;
}) {
  const [kutu, setKutu] = useState<Kutu | null>(null);
  // Aydınlatılan düğmenin adı: kâhyanın cümlesi buna göre değişiyor.
  const [hedefAdi, setHedefAdi] = useState<string | null>(null);
  const [itiraz, setItiraz] = useState(false);

  const isaretler = rehberIsigi(adim);
  const calissin =
    acik && rehberGorunsunMu(bolgeSayisi, gorundu) && isaretler.length > 0;
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
      setHedefAdi(null);
      return;
    }
    const liste = isaretlerRef.current;
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

    const olc = () => {
      const { hedef: e, engelli } = hedefBul(liste);
      // Ekrandaki iş düğmelerinin hepsi kapalı: yapılacak bir şey yok,
      // perde hemen kalksın. Beklemenin anlamı olmazdı — kapalı düğme
      // birkaç yoklama sonra kendiliğinden açılmıyor.
      if (engelli) {
        setKutu(null);
        setHedefAdi(null);
        return;
      }
      if (!e) {
        yok++;
        if (yok >= SABIR) {
          setKutu(null);
          setHedefAdi(null);
        }
        return;
      }
      yok = 0;
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
      const disarida = r.top < UST_PAY || r.bottom > window.innerHeight - ALT_PAY;
      if (disarida) {
        // Hedef değiştiyse yumuşak (göz takip etsin), yerinde kaydıysa
        // anında — 150 ms'de bir yumuşak kaydırma titreme yaratırdı.
        e.scrollIntoView({ block: 'center', behavior: ad !== sonAd ? 'smooth' : 'auto' });
        disari++;
        if (disari >= SABIR) {
          setKutu(null);
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
  }, [calissin, anahtar]);

  if (!calissin || !kutu) return null;

  const u = Math.max(0, kutu.ust - PAY);
  const a = Math.min(window.innerHeight, kutu.ust + kutu.boy + PAY);
  const s = Math.max(0, kutu.sol - PAY);
  const g = kutu.sol + kutu.en + PAY;

  // Perdeye basmak bir şey yapmaz ama sessiz kalmaz: halka bir kez
  // titrer. Tepkisiz bir ekran "oyun dondu" diye okunur.
  const perde = 'fixed z-[55] bg-black/72';
  const dokun = () => {
    setItiraz(true);
    window.setTimeout(() => setItiraz(false), 450);
  };

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
        className={`pointer-events-none fixed z-[56] rounded-2xl border-2 border-altin ${
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
        className="pointer-events-none fixed z-[56] flex justify-center px-3"
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
