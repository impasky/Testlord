/**
 * Araştırma ağacı — HOI4 tarzı tuval (docs/20 §7).
 *
 * Eski ekran on beş kartı alt alta diziyordu ve sorusu "hangi dalı
 * sürdüreyim" idi. Ağaç altmış düğüme, dört sekmeye, altı çağa ve üç
 * büyük seçime çıkınca liste okunmaz oldu: oyuncunun asıl sorusu artık
 * "bu yol NEREYE gidiyor" ve onu ancak çizgiler gösterir. O yüzden
 * HOI4'ün dili: satır = çağ (yukarıdan aşağı zaman), sütun = hat,
 * çizgi = önkoşul, kesikli kırmızı çerçeve = "yalnız biri".
 *
 * Kurallar hâlâ sunucudan hazır geliyor (açık mı, neden kilitli, süre,
 * erken cezası, bırakmanın bedeli). Arayüz hiçbirini yeniden
 * hesaplamıyor — hesaplasaydı motorla ayrışabilir ve oyuncuya "başlat"
 * düğmesi gösterip sunucudan hata alabilirdi. Kendi çizdiği tek şey
 * yerleşim: hangi kutu nerede, çizgi nereden geçer.
 */
import { B, type ArastirmaDurumu } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type ArastirmaGrubuDto, type SurenArastirma } from '../api/client';
import { Zemin } from '../components/Zemin';
import { heceTireli } from '../components/ekler';
import { hisOnay, hisRet } from '../components/hisGeriBildirimi';
import { etkiRozeti, type EtkiRozeti } from '../components/arastirmaRozeti';
import {
  Ikon,
  IkonAltin,
  IkonDemir,
  IkonErzak,
  IkonKapali,
  IkonKilit,
  IkonOnay,
  IkonSure,
} from '../components/Ikonlar';
import {
  AltSekmeler,
  Buton,
  GeriSayim,
  Ilerleme,
  Iskelet,
  Kart,
  formatSayi,
} from '../components/ui';

type Kaynak = { altin: number; demir: number; erzak: number };

/* ---------------- Yerleşim ölçüleri ---------------- */

/**
 * Kutunun yüksekliği: üç satır ad + etki/durum satırı. 64'tü; etki
 * rozeti gelince üç satırlık adlar ("Değirmen-/ler", "Ticaret Yol-/ları")
 * rozetle çakışıyordu. 72, 44 px dokunma hedefinin de rahat üstünde.
 */
const KUTU = 72;
/** Çağ satırları arasındaki boşluk; çizgilerin yatay kolları burada. */
const ARA = 26;
const SATIR = KUTU + ARA;
const UST = ARA / 2;
const ROMA = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const ustY = (kademe: number) => UST + (kademe - 1) * SATIR;
const altY = (kademe: number) => ustY(kademe) + KUTU;

/**
 * Önkoşul çizgisinin rotası (yüzde x, piksel y noktaları).
 *
 * Bitişik çağlar arasında çizgi basit: aşağı, boşlukta yana, aşağı. Çağ
 * ATLAYAN bir önkoşulda (Ambarlar → Tahıl Ambarları) çizgi aradaki
 * satırlardan geçiyor ve oradaki bir kutunun ARKASINDAN geçerse göz onu
 * o kutuya bağlı sanar: "Lonca → Ticaret Yolları → Mimar Ocağı" diye
 * olmayan bir zincir okunurdu. Üç rota sırayla deneniyor:
 *
 *   A. ebeveynin sütunundan in, çocuğun satırının üstünde yana geç
 *   B. ebeveynin altında yana geç, çocuğun sütunundan in
 *   C. iki kutu arasındaki SINIR çizgisinden in (kutuların arasındaki
 *      boşluk) — aradaki hücreler doluysa tek temiz yol bu
 */
function rota(
  p: { kademe: number; sutun: number },
  c: { kademe: number; sutun: number },
  n: number,
  dolu: Set<string>,
): [number, number][] {
  const orta = (s: number) => ((s + 0.5) * 100) / n;
  const xp = orta(p.sutun);
  const xc = orta(c.sutun);
  const bosMu = (s: number) => {
    for (let k = p.kademe + 1; k < c.kademe; k++) if (dolu.has(`${k}:${s}`)) return false;
    return true;
  };
  const cocukUstu = ustY(c.kademe) - ARA / 2;
  const ebeveynAlti = altY(p.kademe) + ARA / 2;
  if (bosMu(p.sutun))
    return [
      [xp, altY(p.kademe)],
      [xp, cocukUstu],
      [xc, cocukUstu],
      [xc, ustY(c.kademe)],
    ];
  if (bosMu(c.sutun))
    return [
      [xp, altY(p.kademe)],
      [xp, ebeveynAlti],
      [xc, ebeveynAlti],
      [xc, ustY(c.kademe)],
    ];
  // Çocuğun sütununun sol sınırı; ilk sütunsa sağ sınırı.
  const xs = ((c.sutun === 0 ? 1 : c.sutun) * 100) / n;
  return [
    [xp, altY(p.kademe)],
    [xp, ebeveynAlti],
    [xs, ebeveynAlti],
    [xs, cocukUstu],
    [xc, cocukUstu],
    [xc, ustY(c.kademe)],
  ];
}

/* ---------------- Durum → görünüş ---------------- */

type Hal = 'bitti' | 'suruyor' | 'acik' | 'kapali' | 'kilitli';

function hal(d: ArastirmaDurumu): Hal {
  if (d.tamamlandi) return 'bitti';
  if (d.suruyor) return 'suruyor';
  if (d.acik) return 'acik';
  if (d.kapali) return 'kapali';
  return 'kilitli';
}

/*
 * Durum RENKLE söyleniyor, saydamlıkla değil. Eski ekran kilitli kartı
 * %60 opaklığa indiriyordu: metin zeminle karışıyor, okunurluk denetimi
 * kontrastı ölçemiyordu. Her hâlin kendi zemini ve kenarı var.
 *
 * "Başlatılabilir" ağacın en önemli hâli — oyuncunun şimdi yapabileceği
 * tek şey o. İnce altın kenarla kilitli kutudan ayırt edilmiyordu (ikisi
 * de koyu zemin, ikisi de ince kenar); şimdi kalın kenar, parıltı ve
 * yanıp sönen nokta taşıyor.
 */
const HAL_SINIFI: Record<Hal, string> = {
  bitti: 'border border-yesil/70 bg-yesil-koyu/35 text-parsomen',
  suruyor: 'border border-altin bg-altin/15 text-parsomen',
  acik: 'border-2 border-altin bg-yuzey text-parsomen shadow-[0_0_10px_rgba(245,183,49,0.4)]',
  kapali: 'border border-dashed border-kirmizi/60 bg-oyuk text-sonuk',
  kilitli: 'border border-kenar bg-derin text-solgun',
};

const HAL_ADI: Record<Hal, string> = {
  bitti: 'tamamlandı',
  suruyor: 'araştırılıyor',
  acik: 'başlatılabilir',
  kapali: 'bu yol kapalı',
  kilitli: 'kilitli',
};

function HalSimgesi({ h, erken }: { h: Hal; erken: boolean }) {
  if (h === 'bitti') return <IkonOnay boyut={12} className="shrink-0 text-yesil" />;
  if (h === 'suruyor')
    return <IkonSure boyut={12} className="shrink-0 text-altin motion-safe:animate-pulse" />;
  if (h === 'kapali') return <IkonKapali boyut={12} className="shrink-0 text-kirmizi" />;
  if (h === 'kilitli') return <IkonKilit boyut={12} className="shrink-0 text-sonuk" />;
  return erken ? (
    <IkonSure boyut={12} className="shrink-0 text-turuncu" />
  ) : (
    <span className="h-2 w-2 shrink-0 rounded-full bg-altin motion-safe:animate-pulse" />
  );
}

/** Rozetin rengi kutunun hâline uyuyor: alınmış yeşil, alınabilir altın. */
const ROZET_RENGI: Record<Hal, string> = {
  bitti: 'text-yesil',
  suruyor: 'text-altin',
  acik: 'text-altin',
  kapali: 'text-sonuk',
  kilitli: 'text-solgun',
};

/**
 * Kutunun ne verdiği: simge + sayı ("🛡 +%10"). Birim etkisinde birimin
 * simgesi, köşesinde küçük kılıç ya da kalkan — okçu SALDIRISI mı okçu
 * SAVUNMASI mı. Kalan etkiler detay sayfasında; kutu yalnız ilkini
 * taşıyor, çünkü 76 piksele ikinci bir sayı sığmıyor.
 */
function Rozet({ r, h }: { r: EtkiRozeti; h: Hal }) {
  const isaret = r.isaret < 0 ? '−' : '+';
  const metin = r.tur === 'yuzde' ? `${isaret}%${r.deger}` : `${isaret}${r.deger}`;
  return (
    <span className={`flex min-w-0 items-center gap-0.5 ${ROZET_RENGI[h]}`}>
      <span className={`relative shrink-0 ${r.yon ? 'mr-1' : ''}`}>
        <Ikon ad={r.ikon} boyut={12} />
        {r.yon && (
          <Ikon
            ad={r.yon}
            boyut={8}
            className="absolute -right-1 -bottom-0.5 drop-shadow-[0_0_1px_rgba(0,0,0,1)]"
          />
        )}
      </span>
      <span className="truncate text-[11px] leading-none font-semibold">{metin}</span>
    </span>
  );
}

/**
 * Süren araştırmanın ilerlemesi, kutunun alt kenarında. Kendi saatiyle
 * işliyor: bütün ağacı saniyede bir yeniden çizmek yerine yalnız çubuk.
 */
function SurenCubugu({ bas, bit }: { bas: string; bit: string }) {
  const [, setTik] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTik((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const b = new Date(bas).getTime();
  const son = new Date(bit).getTime();
  const oran = Math.min(1, Math.max(0, (Date.now() - b) / Math.max(1, son - b)));
  return (
    <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-altin/20">
      <span
        className="block h-full bg-altin transition-[width] duration-1000"
        style={{ width: `${oran * 100}%` }}
      />
    </span>
  );
}

/* ---------------- Yardımcılar ---------------- */

/**
 * Depo düğümünün oyuncunun KENDİ tavanına ne yapacağı.
 *
 * Depo düğümü değilse ya da tamamlandıysa null: tahmin uydurmaktansa
 * hiçbir şey yazmamak doğru. "Şu kadar ekler" diyoruz, "şu kadar olur"
 * değil — tabanın hesabı sunucuda.
 */
function depoArtisi(d: ArastirmaDurumu, tavan: number): string | null {
  const carpan = d.etki.depo_carpani;
  if (!carpan || d.tamamlandi) return null;
  return `Şu anki tavanın ${formatSayi(tavan)} — bu araştırma ${formatSayi(Math.round(tavan * carpan))} ekler.`;
}

function sureMetni(sn: number): string {
  const sa = Math.floor(sn / 3600);
  const dk = Math.round((sn % 3600) / 60);
  return sa > 0 ? `${sa}sa ${dk}dk` : `${dk}dk`;
}

function MaliyetSatiri({ m, sureSn }: { m: Kaynak; sureSn?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-parsomen">
      <span className="flex items-center gap-1">
        <IkonAltin boyut={13} className="text-kaynak-altin" /> {formatSayi(m.altin)}
      </span>
      <span className="flex items-center gap-1">
        <IkonDemir boyut={13} className="text-kaynak-demir" /> {formatSayi(m.demir)}
      </span>
      <span className="flex items-center gap-1">
        <IkonErzak boyut={13} className="text-kaynak-erzak" /> {formatSayi(m.erzak)}
      </span>
      {sureSn !== undefined && (
        <span className="flex items-center gap-1">
          <IkonSure boyut={13} className="text-solgun" /> {sureMetni(sureSn)}
        </span>
      )}
    </div>
  );
}

/**
 * Ağacın üstünde açılan alt sayfa.
 *
 * Katman: kapı panelinin (z-53) üstünde, rehber ışığının (z-55) altında —
 * ışık ilk araştırmada buradaki "Başlat"ı gösteriyor. Yükseklik SABİT:
 * kısa içerikte sayfa aşağıda kalırdı ve düğme alt çubuğun hizasına,
 * ışığın güvenli şeridinin dışına düşerdi.
 */
function AltSayfa({
  baslik,
  onKapat,
  children,
}: {
  baslik: string;
  onKapat: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onKapat();
    };
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [onKapat]);

  return (
    <>
      <button
        type="button"
        onClick={onKapat}
        aria-label="Detayı kapat"
        className="fixed inset-0 z-[54] bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
        className="fixed inset-x-0 bottom-0 z-[54] mx-auto flex h-[74dvh] w-full max-w-lg flex-col rounded-t-3xl border-t-2 border-altin/50 bg-panel"
      >
        <div className="relative flex items-center gap-2 border-b border-kenar px-4 pt-3 pb-2">
          <span
            aria-hidden
            className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-kenar-acik"
          />
          <h3 className="baslik min-w-0 flex-1 truncate pt-1 text-[15px] text-altin">{baslik}</h3>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Detayı kapat"
            className="bas -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-solgun"
          >
            <IkonKapali boyut={18} />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </>
  );
}

/* ---------------- Yuvalar ---------------- */

/**
 * Araştırma yuvaları (HOI4'ün "research slot"u).
 *
 * Boş yuva da çiziliyor: "bir yuvam boşta" bilgisi oyuncunun en sık
 * kaçırdığı şey. Yuvanın nereden geldiği altta yazıyor — "bir yuva daha
 * nasıl açılır" sorusunun cevabı ekranda.
 *
 * Yuvalar yan yana ÇİP: eskiden her biri İptal düğmeli tam genişlik bir
 * karttı ve üç satırlık açıklamayla birlikte ağacı ilk ekranın altına
 * itiyordu. Süren çipe dokununca düğümün sayfası açılıyor; iptal orada.
 */
function Yuvalar({
  surenler,
  esZamanli,
  yuva,
  onAc,
}: {
  surenler: SurenArastirma[];
  esZamanli: number;
  yuva: { kutuphane: number; arastirma: number };
  onAc: (key: string) => void;
}) {
  const qc = useQueryClient();

  // İlk biten araştırma bitince ağacı tazele: sunucu GET'te gecikmişleri
  // kapatıyor, yani düğüm "tamamlandı"ya kendiliğinden geçiyor.
  const ilkBitis = surenler[0]?.finishAt ?? null;
  useEffect(() => {
    if (!ilkBitis) return;
    const ms = Math.max(0, new Date(ilkBitis).getTime() - Date.now()) + 1500;
    const id = setTimeout(() => void qc.invalidateQueries({ queryKey: ['arastirma'] }), ms);
    return () => clearTimeout(id);
  }, [ilkBitis, qc]);

  const adet = Math.max(esZamanli, surenler.length);
  return (
    <div className="space-y-1.5">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(2, adet)}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: adet }, (_, i) => {
          const s = surenler[i];
          if (!s)
            return (
              <div
                key={`bos-${i}`}
                className="flex min-h-11 items-center rounded-xl border border-dashed border-kenar-acik px-2.5 py-1.5 text-[12px] leading-snug text-solgun"
              >
                Boş yuva — ağaçtan bir düğüm seç.
              </div>
            );
          return (
            <button
              key={s.id}
              type="button"
              // Anahtarsız süren kayıt (eski ağaçtan kalma) açılacak bir düğüm taşımıyor.
              disabled={!s.key}
              onClick={() => s.key && onAc(s.key)}
              className="bas relative flex min-h-11 min-w-0 flex-col justify-center overflow-hidden rounded-xl border border-altin/50 bg-altin/10 px-2.5 pt-1 pb-2 text-left"
            >
              <span className="truncate text-[12px] font-semibold text-altin">{s.ad}</span>
              <span className="flex items-center gap-1 text-[11px] text-solgun">
                <IkonSure boyut={11} className="shrink-0" />
                <GeriSayim bitis={s.finishAt} />
              </span>
              <SurenCubugu bas={s.startedAt} bit={s.finishAt} />
            </button>
          );
        })}
      </div>
      <p className="text-[11px] leading-snug text-solgun">
        {`Yuvalar: kütüphaneden ${yuva.kutuphane}${yuva.arastirma > 0 ? `, araştırmadan ${yuva.arastirma}` : ''}. Kütüphane, Medrese ve Beytülhikme yuva ekler.`}
      </p>
    </div>
  );
}

/* ---------------- Tuval ---------------- */

function Tuval({
  dugumler,
  sutunlar,
  caglar,
  cagNo,
  gruplar,
  surenler,
  lordSeviyesi,
  isaretli,
  onSec,
}: {
  dugumler: ArastirmaDurumu[];
  sutunlar: string[];
  caglar: { no: number; ad: string; seviye: number }[];
  cagNo: number;
  gruplar: ArastirmaGrubuDto[];
  surenler: SurenArastirma[];
  lordSeviyesi: number;
  /** Rehber ışığının göstereceği düğüm (sekmedeki ilk açık düğüm). */
  isaretli: string | null;
  onSec: (key: string) => void;
}) {
  const n = Math.max(1, sutunlar.length);
  const yukseklik = UST * 2 + caglar.length * SATIR - ARA;
  const dolu = new Set(dugumler.map((d) => `${d.kademe}:${d.sutun}`));
  const bul = new Map(dugumler.map((d) => [d.key, d]));
  const suren = new Map(surenler.map((s) => [s.key, s]));
  /*
   * Seviyesi henüz yetmeyen çağlar: erken araştırma penceresinin de
   * ötesinde, yani o satırdaki HİÇBİR kutu başlatılamaz. Oyuncu bunu
   * kutu kutu kilit simgesinden çıkarmak zorundaydı; şimdi satırın
   * kendisi taralı ve oluğunda kilit var. Yalnız GÖRÜNÜŞ: hangi kutunun
   * açık olduğunu yine sunucu söylüyor.
   */
  const pencere = B.arastirma.erken_pencere_seviye;
  const uzakCag = (c: { seviye: number }) => lordSeviyesi < c.seviye - pencere;

  const cizgiler = dugumler.flatMap((c) =>
    c.onkosul
      .map((pk) => bul.get(pk))
      .filter((p): p is ArastirmaDurumu => !!p)
      .map((p) => {
        const noktalar = rota(p, c, n, dolu);
        const tarz = c.kapali
          ? { renk: 'var(--color-kenar)', kesik: true, kalin: 1.5 }
          : p.tamamlandi
            ? { renk: 'var(--color-altin)', kesik: false, kalin: 2 }
            : p.acik || p.suruyor
              ? { renk: 'var(--color-kenar-acik)', kesik: false, kalin: 1.5 }
              : { renk: 'var(--color-kenar)', kesik: true, kalin: 1.5 };
        return { key: `${p.key}>${c.key}`, noktalar, ...tarz };
      }),
  );

  // "Yalnız biri" çerçeveleri: grubun seçenekleri aynı çağda yan yana.
  const cerceveler = gruplar
    .map((g) => {
      const secenek = g.secenekler.map((s) => bul.get(s.key)).filter((d) => !!d);
      if (secenek.length < 2) return null;
      const sutun = secenek.map((d) => d!.sutun);
      return {
        key: g.key,
        kademe: secenek[0]!.kademe,
        sol: Math.min(...sutun),
        sag: Math.max(...sutun),
      };
    })
    .filter((c) => !!c);

  return (
    <div>
      {/*
       * Lejant AĞACIN ÜSTÜNDE: altındayken oyuncu renk dilini ancak
       * altmış kutuyu geçtikten sonra öğreniyordu.
       */}
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-solgun">
        <span className="flex items-center gap-1">
          <span className="flex h-3 w-4 items-center justify-center rounded-sm border-2 border-altin bg-yuzey">
            <span className="h-1 w-1 rounded-full bg-altin" />
          </span>
          başlatılabilir
        </span>
        <span className="flex items-center gap-1">
          <span className="relative h-3 w-4 overflow-hidden rounded-sm border border-altin bg-altin/15">
            <span className="absolute bottom-0 left-0 h-0.5 w-2 bg-altin" />
          </span>
          araştırılıyor
        </span>
        <span className="flex items-center gap-1">
          <IkonOnay boyut={11} className="text-yesil" /> tamam
        </span>
        <span className="flex items-center gap-1">
          <IkonSure boyut={11} className="text-turuncu" /> erken (uzun sürer)
        </span>
        <span className="flex items-center gap-1">
          <IkonKilit boyut={11} className="text-sonuk" /> kilitli
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-kirmizi/80" />
          yalnız biri
        </span>
      </div>

      {/* Sütun başlıkları: HOI4'teki hat adları. */}
      <div className="flex pb-1">
        <span className="w-8 shrink-0" />
        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {sutunlar.map((s) => (
            <span key={s} className="truncate px-0.5 text-center text-[11px] text-sonuk">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="relative flex" style={{ height: yukseklik }}>
        {/* Lordun bulunduğu çağ: satır boyu hafif altın şerit. */}
        {caglar
          .filter((c) => c.no === cagNo)
          .map((c) => (
            <div
              key={c.no}
              aria-hidden
              className="absolute inset-x-0 rounded-lg bg-altin/[0.07]"
              style={{ top: ustY(c.no) - ARA / 2 + 2, height: SATIR - 4 }}
            />
          ))}

        {/* Seviyesi yetmeyen çağlar: taralı şerit (kutuların arkasında). */}
        {caglar.filter(uzakCag).map((c) => (
          <div
            key={`uzak-${c.no}`}
            aria-hidden
            className="absolute inset-x-0 rounded-lg bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.22)_0_6px,transparent_6px_12px)]"
            style={{ top: ustY(c.no) - ARA / 2 + 2, height: SATIR - 4 }}
          />
        ))}

        {/* Çağ oluğu: Roma rakamı ve seviye kapısı. */}
        <div className="relative w-8 shrink-0">
          {caglar.map((c) => (
            <div
              key={c.no}
              className="absolute inset-x-0 flex flex-col items-center justify-center"
              style={{ top: ustY(c.no), height: KUTU }}
              title={`${c.ad} çağı`}
            >
              {uzakCag(c) && <IkonKilit boyut={11} className="text-sonuk" />}
              <span
                className={`baslik text-[13px] ${c.no === cagNo ? 'text-altin' : 'text-solgun'}`}
              >
                {ROMA[c.no - 1] ?? c.no}
              </span>
              <span className={`text-[11px] ${c.no === cagNo ? 'text-altin' : 'text-sonuk'}`}>
                {`Sv${c.seviye}`}
              </span>
              {c.no === cagNo && <span className="text-[11px] leading-3 text-altin">şimdi</span>}
            </div>
          ))}
        </div>

        <div className="relative flex-1">
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
            {cizgiler.map((c) => (
              <g key={c.key}>
                {c.noktalar.slice(1).map(([x, y], i) => {
                  const [x0, y0] = c.noktalar[i]!;
                  return (
                    <line
                      key={i}
                      x1={`${x0}%`}
                      y1={y0}
                      x2={`${x}%`}
                      y2={y}
                      stroke={c.renk}
                      strokeWidth={c.kalin}
                      strokeDasharray={c.kesik ? '4 4' : undefined}
                      strokeLinecap="round"
                    />
                  );
                })}
                <circle
                  cx={`${c.noktalar[c.noktalar.length - 1]![0]}%`}
                  cy={c.noktalar[c.noktalar.length - 1]![1]}
                  r={2.5}
                  fill={c.renk}
                />
              </g>
            ))}
          </svg>

          {cerceveler.map((c) => (
            <div
              key={c!.key}
              aria-hidden
              className="pointer-events-none absolute rounded-xl border border-dashed border-kirmizi/80"
              style={{
                left: `calc(${(c!.sol * 100) / n}% + 1px)`,
                width: `calc(${((c!.sag - c!.sol + 1) * 100) / n}% - 2px)`,
                top: ustY(c!.kademe) - 4,
                height: KUTU + 8,
              }}
            >
              <span className="absolute -top-2.5 right-2 rounded-md bg-derin px-1 text-[11px] leading-4 text-kirmizi">
                yalnız biri
              </span>
            </div>
          ))}

          {dugumler.map((d) => {
            const h = hal(d);
            const r = etkiRozeti(d.etki);
            const s = suren.get(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => onSec(d.key)}
                aria-label={`${d.ad}, ${HAL_ADI[h]}`}
                data-rehber={d.key === isaretli ? 'arastirma-dugum' : undefined}
                className={`bas absolute flex flex-col justify-between overflow-hidden rounded-lg px-[5px] py-1.5 text-left ${HAL_SINIFI[h]}`}
                style={{
                  left: `calc(${(d.sutun * 100) / n}% + 2px)`,
                  width: `calc(${100 / n}% - 4px)`,
                  top: ustY(d.kademe),
                  height: KUTU,
                }}
              >
                <span className="line-clamp-3 text-[11px] leading-[13px] font-semibold break-words">
                  {heceTireli(d.ad)}
                </span>
                <span className="flex h-3.5 items-center justify-between gap-1">
                  {r ? <Rozet r={r} h={h} /> : <span />}
                  <HalSimgesi h={h} erken={d.erken} />
                </span>
                {s && <SurenCubugu bas={s.startedAt} bit={s.finishAt} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Büyük seçim kartı ---------------- */

/*
 * Seçim kartı KISA: ad, "yalnız biri", tek cümle açıklama. Eskiden
 * seçenekleri bir de cümleyle sayıyordu ("Henüz seçmedin: ..."); onlar
 * zaten hemen aşağıda, ağaçta kırmızı kesikli çerçevenin içinde.
 */
function SecimKarti({ g, onBirak }: { g: ArastirmaGrubuDto; onBirak: () => void }) {
  return (
    <Kart className="border-kirmizi/40 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="baslik text-[13px] text-parsomen">{g.ad}</span>
        <span className="shrink-0 text-[11px] text-kirmizi">yalnız biri</span>
        {g.secili && (
          <span className="ml-auto min-w-0 truncate text-[12px] text-parsomen">
            Seçimin: <span className="font-semibold text-altin">{g.seciliAd}</span>
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[12px] leading-snug text-solgun">{g.aciklama}</p>
      {g.secili &&
        (g.birakma?.acik ? (
          <Buton className="mt-1.5" tur="kirmizi" boy="kucuk" onClick={onBirak}>
            Yolu bırak
          </Buton>
        ) : (
          g.birakma?.engel && <p className="mt-1 text-[12px] text-solgun">{g.birakma.engel}</p>
        ))}
    </Kart>
  );
}

/* ---------------- Ekran ---------------- */

export function Arastirma({ depoTavani, kaynak }: { depoTavani: number; kaynak?: Kaynak }) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [sekme, setSekme] = useState<string | null>(null);
  const [secili, setSecili] = useState<string | null>(null);
  const [birakilacak, setBirakilacak] = useState<string | null>(null);
  /** Dışlayan seçimde ikinci dokunuş bekleniyor mu (düğüm anahtarı). */
  const [onayli, setOnayli] = useState<string | null>(null);
  const veri = useQuery({ queryKey: ['arastirma'], queryFn: api.arastirma });

  const tazele = () => {
    void qc.invalidateQueries({ queryKey: ['arastirma'] });
    void qc.invalidateQueries({ queryKey: ['me'] });
  };

  const baslat = useMutation({
    mutationFn: (key: string) => api.arastirmaBaslat(key),
    onSuccess: (s) => {
      hisOnay();
      setHata(null);
      setSecili(null);
      setOnayli(null);
      setBilgi(`${s.ad} başladı.`);
      tazele();
    },
    onError: (e) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Araştırma başlatılamadı.');
    },
  });

  const iptal = useMutation({
    mutationFn: (id: string) => api.arastirmaIptal(id),
    onSuccess: () => {
      hisOnay();
      setSecili(null);
      tazele();
    },
    onError: (e) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'İptal edilemedi.');
    },
  });

  const birak = useMutation({
    mutationFn: (grup: string) => api.arastirmaYolBirak(grup),
    onSuccess: (s) => {
      hisOnay();
      setBirakilacak(null);
      setHata(null);
      setBilgi(
        `Yol bırakıldı: ${s.silinen.length} araştırma silindi, ${formatSayi(s.iade.altin)} altın geri geldi.`,
      );
      tazele();
    },
    onError: (e) => {
      hisRet();
      setBirakilacak(null);
      setHata(e instanceof ApiError ? e.message : 'Yol bırakılamadı.');
    },
  });

  if (veri.isPending || !veri.data) return <Iskelet satir={4} />;
  const { dallar, sekmeler, caglar, gruplar, ilerleme, surenler, esZamanli, yuva, lordSeviyesi } =
    veri.data;
  const yuvaDolu = surenler.length >= esZamanli;

  // Varsayılan sekme: süren araştırmanınki, yoksa ilk açık düğümünki.
  const surenKey = surenler[0]?.key;
  const varsayilan =
    dallar.find((d) => d.key === surenKey)?.dal ??
    dallar.find((d) => d.acik)?.dal ??
    sekmeler[0]?.key ??
    '';
  const etkin = sekme ?? varsayilan;
  const etkinSekme = sekmeler.find((s) => s.key === etkin) ?? sekmeler[0];
  const sekmeDugumleri = dallar.filter((d) => d.dal === etkinSekme?.key);
  const sekmeGruplari = gruplar.filter((g) =>
    g.secenekler.some((s) => sekmeDugumleri.some((d) => d.key === s.key)),
  );
  const cagNo = [...caglar].reverse().find((c) => lordSeviyesi >= c.seviye)?.no ?? 1;

  // Rehber ışığının SABİT hedefleri: bu sekmedeki ilk açık düğüm ve onun
  // sayfasındaki Başlat. Işık zinciri sabit bir ad arıyor; hangi
  // araştırma olduğu oyuncunun kararı.
  const isaretli = sekmeDugumleri.find((d) => d.acik)?.key ?? null;

  const d = secili ? (dallar.find((x) => x.key === secili) ?? null) : null;
  const dGrubu = d?.grup ? gruplar.find((g) => g.key === d.grup) : undefined;
  // Düğümün YOLUNUN grubu: seçeneğin kendisi değil, yolun derinindeki bir
  // düğüm de (Ok Yağmuru Ustalığı) o seçim kapandığı için kapalı.
  const yolGrubu = d?.yol
    ? gruplar.find((g) => g.secenekler.some((s) => s.yol === d.yol))
    : undefined;
  const dSuren = d ? surenler.find((s) => s.key === d.key) : undefined;
  const cag = d ? caglar.find((c) => c.no === d.kademe) : undefined;
  const bg = birakilacak ? gruplar.find((g) => g.key === birakilacak) : undefined;

  const bekleGun = Math.round(B.arastirma.yol_degisim_bekleme_saat / 24);
  const iadeYuzde = Math.round(B.arastirma.yol_degisim_iadesi * 100);

  return (
    <div className="space-y-4">
      <Zemin ad="arastirma" baslik="Araştırma" altyazi="Diyarını kendi seçimlerinle büyüt" />

      <Kart className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <span className="baslik shrink-0 text-[11px] text-solgun">İlerleme</span>
          <div className="flex-1">
            <Ilerleme deger={ilerleme.biten} max={Math.max(1, ilerleme.toplam)} boy="ince" />
          </div>
          <span className="tabular shrink-0 text-[12px] text-parsomen">
            {ilerleme.biten} / {ilerleme.toplam}
          </span>
        </div>
        <Yuvalar
          surenler={surenler}
          esZamanli={esZamanli}
          yuva={yuva}
          onAc={(key) => {
            const dal = dallar.find((x) => x.key === key)?.dal;
            if (dal) setSekme(dal);
            setSecili(key);
            setOnayli(null);
            setHata(null);
          }}
        />
      </Kart>

      {hata && (
        <p role="alert" className="text-[12px] text-kirmizi">
          {hata}
        </p>
      )}
      {bilgi && !hata && (
        <p role="status" className="text-[12px] text-yesil">
          {bilgi}
        </p>
      )}

      <AltSekmeler
        sekmeler={sekmeler.map((s) => ({
          key: s.key,
          ad: s.ad,
          sayi: dallar.filter((x) => x.dal === s.key && x.acik).length,
        }))}
        etkin={etkinSekme?.key ?? ''}
        onSec={(k) => setSekme(k)}
      />
      {etkinSekme && (
        <p className="-mt-2 text-[12px] leading-snug text-solgun">{etkinSekme.ozet}</p>
      )}

      {etkinSekme && (
        <Tuval
          dugumler={sekmeDugumleri}
          sutunlar={etkinSekme.sutunlar}
          caglar={caglar}
          cagNo={cagNo}
          gruplar={sekmeGruplari}
          surenler={surenler}
          lordSeviyesi={lordSeviyesi}
          isaretli={isaretli}
          onSec={(k) => {
            setSecili(k);
            setOnayli(null);
            setHata(null);
          }}
        />
      )}

      {/*
       * Seçim kartları AĞACIN ALTINDA: ağaçtaki kırmızı çerçevenin
       * dipnotu onlar. Üstteyken ağacı ilk ekranın dışına itiyorlardı.
       */}
      {sekmeGruplari.map((g) => (
        <SecimKarti key={g.key} g={g} onBirak={() => setBirakilacak(g.key)} />
      ))}

      {d && (
        <AltSayfa baslik={d.ad} onKapat={() => setSecili(null)}>
          <p className="text-[11px] text-solgun">
            {`${cag ? `${ROMA[cag.no - 1]}. çağ · ${cag.ad}` : ''} · ${d.dalAdi} · ${etkinSekme?.sutunlar[d.sutun] ?? ''}`}
          </p>

          <div className="flex flex-wrap gap-1">
            {d.etkiSatirlari.map((e) => (
              <span
                key={e}
                className={`rounded-md px-1.5 py-0.5 text-[12px] ${
                  d.tamamlandi ? 'bg-yesil/15 text-yesil' : 'bg-altin/12 text-altin'
                }`}
              >
                {e}
              </span>
            ))}
          </div>
          {depoArtisi(d, depoTavani) && (
            <p className="text-[12px] text-solgun">{depoArtisi(d, depoTavani)}</p>
          )}

          {d.tamamlandi ? (
            <p className="flex items-center gap-1.5 text-[13px] text-yesil">
              <IkonOnay boyut={14} /> Tamamlandı — etkisi sürüyor.
            </p>
          ) : dSuren ? (
            <>
              <p className="text-[13px] text-altin">
                Araştırılıyor — <GeriSayim bitis={dSuren.finishAt} /> kaldı
              </p>
              <Buton
                tur="anahat"
                tam
                disabled={iptal.isPending}
                onClick={() => iptal.mutate(dSuren.id)}
              >
                İptal et (yarısı geri gelir)
              </Buton>
            </>
          ) : (
            <>
              <MaliyetSatiri m={d.maliyet} sureSn={d.sureSn} />
              {d.sureNotu && (
                <p className={`text-[12px] ${d.erken ? 'text-turuncu' : 'text-yesil'}`}>
                  {d.sureNotu}
                </p>
              )}

              {dGrubu && !d.kapali && (
                <div
                  className={`rounded-xl border px-3 py-2 text-[12px] leading-snug ${
                    onayli === d.key
                      ? 'border-kirmizi bg-kirmizi/10 text-parsomen'
                      : 'border-kirmizi/50 text-solgun'
                  }`}
                >
                  {`${dGrubu.ad}: yalnız biri. Bunu seçersen ${dGrubu.secenekler
                    .filter((s) => s.key !== d.key)
                    .map((s) => s.ad)
                    .join(
                      ' ve ',
                    )} kapanır. Sonra değiştirmek istersen bu yolun araştırmaları silinir, bedellerinin %${iadeYuzde}'si geri gelir ve ${bekleGun} gün yeniden değiştiremezsin.`}
                </div>
              )}

              {d.acik ? (
                <Buton
                  tam
                  disabled={baslat.isPending || yuvaDolu}
                  isaret={d.key === isaretli ? 'arastirma-baslat' : `arastirma-${d.key}`}
                  onClick={() => {
                    if (dGrubu && onayli !== d.key) {
                      setOnayli(d.key);
                      return;
                    }
                    baslat.mutate(d.key);
                  }}
                >
                  {yuvaDolu
                    ? 'Bütün yuvalar dolu'
                    : dGrubu
                      ? onayli === d.key
                        ? `Eminim — ${d.ad} seçilsin`
                        : 'Bu yolu seç'
                      : 'Başlat'}
                </Buton>
              ) : d.kapali && yolGrubu?.birakma ? (
                <>
                  <p className="flex items-start gap-1.5 text-[12px] text-solgun">
                    <IkonKapali boyut={13} className="mt-0.5 shrink-0 text-kirmizi" />
                    {d.engel}
                  </p>
                  {yolGrubu.birakma.acik ? (
                    <Buton
                      tur="kirmizi"
                      tam
                      onClick={() => {
                        setSecili(null);
                        setBirakilacak(yolGrubu.key);
                      }}
                    >
                      {`${yolGrubu.seciliAd ?? 'Seçili'} yolunu bırak`}
                    </Buton>
                  ) : (
                    yolGrubu.birakma.engel && (
                      <p className="text-[12px] text-solgun">{yolGrubu.birakma.engel}</p>
                    )
                  )}
                </>
              ) : (
                <p className="flex items-start gap-1.5 text-[12px] text-solgun">
                  {d.kapali ? (
                    <IkonKapali boyut={13} className="mt-0.5 shrink-0 text-kirmizi" />
                  ) : (
                    <IkonKilit boyut={13} className="mt-0.5 shrink-0 text-sonuk" />
                  )}
                  {d.engel}
                </p>
              )}
              {hata && <p className="text-[12px] text-kirmizi">{hata}</p>}
            </>
          )}

          {d.onkosulDurumu.length > 0 && (
            <div>
              <p className="baslik text-[11px] text-solgun">Önkoşul</p>
              <ul className="mt-1 space-y-0.5">
                {d.onkosulDurumu.map((o) => (
                  <li key={o.key} className="flex items-center gap-1.5 text-[12px]">
                    {o.tamam ? (
                      <IkonOnay boyut={12} className="text-yesil" />
                    ) : (
                      <IkonKilit boyut={12} className="text-sonuk" />
                    )}
                    <span className={o.tamam ? 'text-parsomen' : 'text-solgun'}>{o.ad}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[12px] leading-snug text-solgun">{d.aciklama}</p>
        </AltSayfa>
      )}

      {bg?.birakma && (
        <AltSayfa baslik={`${bg.seciliAd ?? ''} yolunu bırak`} onKapat={() => setBirakilacak(null)}>
          <p className="text-[12px] leading-snug text-solgun">
            {`${bg.ad} değişecek. Bu yolun araştırmaları silinir ve bedellerinin %${iadeYuzde}'si geri gelir. Sonra ${bekleGun} gün bu seçimi yeniden değiştiremezsin.`}
          </p>
          <div>
            <p className="baslik text-[11px] text-solgun">Silinecek</p>
            <ul className="mt-1 space-y-0.5">
              {bg.birakma.silinecek.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-parsomen">
                  <IkonKapali boyut={11} className="text-kirmizi" /> {s.ad}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="baslik text-[11px] text-solgun">Geri gelecek</p>
            <div className="mt-1">
              <MaliyetSatiri m={bg.birakma.iade} />
            </div>
          </div>
          {kaynak &&
            (() => {
              // İade depo tavanına karşı yazılıyor; tavanı aşan kısım bir
              // sonraki hesapta kırpılıyor. Oyuncu bunu SONRA değil ŞİMDİ
              // öğrenmeli: önce harcayıp yer açmak onun kararı.
              const tasan = (['altin', 'demir', 'erzak'] as const).filter(
                (k) => kaynak[k] + bg.birakma!.iade[k] > depoTavani,
              );
              return tasan.length > 0 ? (
                <p className="rounded-xl border border-turuncu/60 px-3 py-2 text-[12px] leading-snug text-turuncu">
                  {`Depon dolu: iadenin bir kısmı tavanı (${formatSayi(depoTavani)}) aşıyor ve taşan kısım kaybolur. Önce harcayıp yer açabilirsin.`}
                </p>
              ) : null;
            })()}
          <div className="flex gap-2">
            <Buton tur="anahat" className="flex-1" onClick={() => setBirakilacak(null)}>
              Vazgeç
            </Buton>
            <Buton
              tur="kirmizi"
              className="flex-1"
              disabled={birak.isPending}
              onClick={() => birak.mutate(bg.key)}
            >
              Yolu bırak
            </Buton>
          </div>
        </AltSayfa>
      )}
    </div>
  );
}
