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
 * Kâhya (Rehber.tsx) neden bastığını söylüyordu ama neye basacağını
 * göstermiyordu; ekranda hâlâ kırk tıklanabilir şey vardı ve oyuncunun
 * asıl şikâyeti oydu: "neler önemli neler önemsiz anlayamadım."
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
 * Zorunlu bir perdenin tek gerçek riski oyuncuyu hapsetmesi. Üç ayrı
 * emniyet var:
 *   1. Hedef KAPALI ise (parası yetmiyor, kuyruk dolu) atlanır ve sıradaki
 *      işarete geçilir — kapalı bir düğmeye basmaya zorlamak kilit demekti.
 *   2. Listedeki hiçbir işaret bulunamazsa perde birkaç yoklama sonra
 *      tamamen kalkar; ışık ekranı asla "boşuna" karartmaz.
 *   3. Perdenin altında küçük bir "yeter, anladım" var — 8 sayfalık
 *      öğreticideki "GEÇ" ile aynı nezaket. Zorunlu tur değil.
 */
import { rehberGorunsunMu, rehberIsigi } from '@lordlar/shared';
import { useEffect, useState } from 'react';
import { rehberiKapat, useRehberKapali } from './rehberKapali';

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

/**
 * Sırayla dener, BULUNAN VE BASILABİLİR ilk işareti döndürür.
 *
 * `disabled` kontrolü şart: Kışla'da parası yetmeyen oyuncunun eğitim
 * düğmesi kapalı olur ve ışık onu aydınlatsaydı oyuncu basamadığı bir
 * düğmeye bakarak kilitli kalırdı.
 */
function hedefBul(isaretler: string[]): HTMLElement | null {
  for (const ad of isaretler) {
    const e = document.querySelector<HTMLElement>(`[data-rehber="${ad}"]`);
    if (!e) continue;
    if (e.hasAttribute('disabled') || e.getAttribute('aria-disabled') === 'true') continue;
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    return e;
  }
  return null;
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
  acik,
}: {
  /** Omurganın hesapladığı adım. Işık kendi senaryosunu tutmuyor. */
  adim: string | null;
  bolgeSayisi: number;
  /** Öğretici kapandı mı — iki tam ekran perde üst üste binmesin. */
  acik: boolean;
}) {
  const kapali = useRehberKapali();
  const [kutu, setKutu] = useState<Kutu | null>(null);
  const [itiraz, setItiraz] = useState(false);

  const isaretler = rehberIsigi(adim);
  const calissin = acik && !kapali && rehberGorunsunMu(bolgeSayisi, kapali) && isaretler.length > 0;
  // Etki bağımlılığı için sabit bir değer: dizi her çizimde yeniden üretilir
  // ve doğrudan bağımlılık yapılsaydı etki her karede yeniden kurulurdu.
  const anahtar = isaretler.join('|');

  useEffect(() => {
    if (!calissin) {
      setKutu(null);
      return;
    }
    const liste = anahtar.split('|');
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
      const e = hedefBul(liste);
      if (!e) {
        yok++;
        if (yok >= SABIR) setKutu(null);
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

  // İpucu deliğin altına, yer yoksa üstüne. Tek satır: oyuncunun şikâyeti
  // zaten "her yerde bir şeyler yazıyor" idi.
  const altaSigar = window.innerHeight - a > 96;

  return (
    <>
      <div className={perde} style={{ top: 0, left: 0, right: 0, height: u }} onClick={dokun} />
      <div className={perde} style={{ top: a, left: 0, right: 0, bottom: 0 }} onClick={dokun} />
      <div className={perde} style={{ top: u, left: 0, width: s, height: a - u }} onClick={dokun} />
      <div className={perde} style={{ top: u, left: g, right: 0, height: a - u }} onClick={dokun} />

      {/* Halka ve yazı tıklamayı geçirir: deliğin üstünde duran hiçbir şey
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
        className="pointer-events-none fixed z-[56] flex justify-center px-4"
        style={altaSigar ? { top: a + 12, left: 0, right: 0 } : { top: Math.max(8, u - 44), left: 0, right: 0 }}
      >
        <span className="baslik rounded-xl border border-altin/40 bg-gece/90 px-3 py-1.5 text-[12px] text-altin">
          Şimdi buna bas
        </span>
      </div>

      {/* Kaçış kapısı SAĞ ÜSTTE, sekiz sayfalık öğreticideki "GEÇ" ile aynı
          yerde ve aynı sözcükle: iki perde de aynı şekilde geçiliyor.

          Önce ekranın altındaydı ve orada gerçek bir tuzaktı — alt gezinme
          çubuğunun tam üstüne düşüyordu, ortadaki sekmeye basmak isteyen
          oyuncu farkında olmadan öğreticiyi kapatıyordu (testteki "perdeye
          bas, ışık sönmesin" kontrolü bunu yakaladı).

          Yazısı da kâhya kartındaki "yeter, anladım"dan ayrı: aynı anda iki
          özdeş kapatma düğmesi hem oyuncu için hem test için belirsizlik. */}
      <button
        type="button"
        onClick={rehberiKapat}
        aria-label="Rehberi kapat"
        className="bas baslik fixed top-2 right-3 z-[57] px-3 py-2 text-[11px] text-sonuk"
      >
        GEÇ
      </button>
    </>
  );
}
