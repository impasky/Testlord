/**
 * Dünya haritası — bir ızgara değil, bir DİYAR.
 *
 * Oyuncunun cümlesi kısaydı: "hex sistemi olmasın." Altıgen petek oyunu
 * bir yer değil bir tablo gibi gösteriyordu. Yerine geçen şey referans
 * haritalardaki gibi: elle çizilmiş bir zemin, üstünde adı olan yerler.
 *
 * ── Mimari: resim ZEMİN, bilgi DOM ────────────────────────────────────
 *
 * Zemin tek bir resim; bölgeler onun üstüne yüzdelik konumlarıyla
 * (`x`/`y`) konan HTML düğmeleri. Ad, sahiplik, seviye, kalkan — hepsi
 * gerçek metin.
 *
 * Bu ayrım kasıtlı ve iki sebebi var:
 *
 *  1. **Görsel modeli okunabilir yazı üretemiyor.** Bölge adları resme
 *     gömülseydi karalama olurdu. Ayrıca adlar veriden geliyor: bir
 *     bölgenin adı değişirse resmi yeniden üretmek gerekmemeli.
 *  2. **Zemin değişebilir olmalı.** Motor `x`/`y` okumuyor (harita.ts);
 *     zemini yeniden ürettiğimizde oyunun kuralları kaymıyor, yalnız
 *     işaretçilerin durduğu resim değişiyor.
 *
 * Zemin yoksa altındaki gradyan görünür ve harita ÇALIŞMAYA DEVAM EDER.
 * Bu da kasıtlı: görseller son aşamada üretiliyor (docs/12 §10) ve harita
 * o güne kadar oynanabilir kalmalı.
 *
 * Sahiplik hem RENK hem ŞEKİL ile gösteriliyor (renk körü güvenliği):
 * seninkinde altın halka, düşmanınkinde kırmızı ve içi dolu bir nokta.
 */
import { gecitMi } from '@lordlar/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MarchDto, RegionDto } from '../api/client';
import { IKONLAR } from './ikon-verisi';

/** Vilayet renkleri. Hiçbir sayıya dokunmuyorlar, o yüzden burada. */
const VILAYET_RENGI: Record<string, string> = {
  kuzeymark: '#7fb2e0',
  demirvadi: '#c0c6cc',
  gunbati: '#e0b878',
  aksu: '#8fd3a8',
  karaorman: '#9ad06a',
  tasgecit: '#d69a7a',
  taht: '#f5b731',
};

const VILAYET_ADI: Record<string, string> = {
  kuzeymark: 'Kuzeymark',
  demirvadi: 'Demirvadi',
  gunbati: 'Günbatı Kıyıları',
  aksu: 'Aksu Ovası',
  karaorman: 'Karaorman',
  tasgecit: 'Taşgeçit',
  taht: 'Taht Vilayeti',
};

const TIP_IKON: Record<string, keyof typeof IKONLAR> = {
  koy: 'koy',
  tarla: 'tarla',
  maden: 'maden',
  sehir: 'sehir',
  kale: 'kale',
  taht: 'taht',
};

/** İşaretçinin madalyon rengi: tür bir bakışta okunmalı. */
const TIP_RENGI: Record<string, string> = {
  koy: '#8a7a52',
  tarla: '#6f8a3a',
  maden: '#5a6b7d',
  sehir: '#a8823c',
  kale: '#8d4a3c',
  taht: '#f5b731',
};

function TipIkonu({ tip, boyut }: { tip: string; boyut: number }) {
  const v = IKONLAR[TIP_IKON[tip] ?? 'tarla'];
  return (
    <svg
      viewBox={`0 0 ${v.w} ${v.h}`}
      width={boyut}
      height={boyut}
      aria-hidden="true"
      className="shrink-0"
      dangerouslySetInnerHTML={{ __html: v.body }}
    />
  );
}

/** Uzun bölge adını işaretçiye sığdırır. */
function kisaAd(ad: string): string {
  return ad.length > 11 ? `${ad.slice(0, 10)}…` : ad;
}

/**
 * Vilayet adının yazılacağı yer: o vilayetin bölgelerinin ağırlık merkezi.
 * Taht Vilayeti hariç — tek bölge ve adı zaten bölgenin kendi adı.
 */
function vilayetMerkezleri(regions: RegionDto[]): { key: string; x: number; y: number }[] {
  const gruplar = new Map<string, RegionDto[]>();
  for (const r of regions) {
    if (r.province === 'taht') continue;
    const liste = gruplar.get(r.province) ?? [];
    liste.push(r);
    gruplar.set(r.province, liste);
  }
  return [...gruplar].map(([key, uyeler]) => ({
    key,
    x: uyeler.reduce((t, r) => t + r.x, 0) / uyeler.length,
    y: uyeler.reduce((t, r) => t + r.y, 0) / uyeler.length,
  }));
}

interface Gorunum {
  olcek: number;
  dx: number;
  dy: number;
}

const EN_AZ = 1;
const EN_COK = 3.2;

export function DunyaHaritasi({
  regions,
  homeBolgeId,
  seciliId,
  yuruyusler,
  ittifakHedefiId,
  onSec,
}: {
  regions: RegionDto[];
  /** Kampın çıpası: hangi bölgenin yanında durduğu. */
  homeBolgeId: number;
  seciliId: number | null;
  /** Yoldaki ordular: evden hedefe çizgi ve ilerleyen bir işaret. */
  yuruyusler: MarchDto[];
  /** İttifakın ortak hedefi. Haritada işaretli olmazsa hedef değil, nottur. */
  ittifakHedefiId?: number | null;
  onSec: (id: number) => void;
}) {
  // Yürüyüş işaretinin yeri her karede Date.now()'dan hesaplanıyor; bileşen
  // yeniden çizilmezse işaret donuyor. Yürüyüş yokken zamanlayıcı hiç
  // kurulmuyor: haritanın boşuna yeniden çizilmesi uzun oturumlarda pil yakar.
  const [, tik] = useState(0);
  useEffect(() => {
    if (yuruyusler.length === 0) return;
    const z = setInterval(() => tik((n) => n + 1), 1000);
    return () => clearInterval(z);
  }, [yuruyusler.length]);

  const [gorunum, setGorunum] = useState<Gorunum>({ olcek: 1, dx: 0, dy: 0 });
  const kutuRef = useRef<HTMLDivElement>(null);

  /*
   * ETİKET SEYRELTME — çakışanı sustur.
   *
   * Kademe kuralı (aşağıda) hangi adların ADAY olduğunu söylüyor; bu etki
   * hangilerinin gerçekten YAZILACAĞINI söylüyor. İkisi ayrı iş: aday
   * olmak yer bulmak demek değil.
   *
   * Ölçüm şart, hesap yetmiyor: etiketin genişliği metne bağlı ("Taht
   * Kalesi" ile "Çakıllı Köyü" aynı yeri kaplamıyor) ve harita
   * yakınlaştıkça işaretçiler ters ölçekleniyor. Dolayısıyla kutular
   * çizildikten SONRA okunuyor.
   *
   * Yöntem haritacılığın kendi yöntemi: önceliğe göre sırala, sırayla
   * yerleştir, yerleşmiş bir kutuya değen etiketi sustur. Susan etiket
   * kaybolmuyor — madalyonu duruyor, dokununca panelde adıyla açılıyor
   * ve yakınlaşınca yeri açıldığı an geri geliyor.
   */
  useEffect(() => {
    const kutu = kutuRef.current;
    if (!kutu) return;
    let kare = 0;
    const seyrelt = () => {
      const etiketler = [...kutu.querySelectorAll<HTMLElement>('[data-bolge-ad]')];
      // Ölçmeden önce hepsi açılıyor: kapalı kalan bir etiketin kutusu
      // sıfır olur ve bir daha asla yer bulamazdı.
      for (const e of etiketler) e.style.visibility = '';
      const sirali = etiketler
        .map((e) => ({ e, oncelik: Number(e.dataset.oncelik ?? 9) }))
        .sort((a, b) => a.oncelik - b.oncelik);
      const yerlesen: DOMRect[] = [];
      for (const { e } of sirali) {
        const r = e.getBoundingClientRect();
        if (r.width === 0) continue;
        // 2 piksel pay: kutular tam değmese de bitişik iki ad tek bir
        // bulanık şerit gibi okunuyor.
        const carpisti = yerlesen.some(
          (o) =>
            r.left < o.right + 2 &&
            o.left < r.right + 2 &&
            r.top < o.bottom + 2 &&
            o.top < r.bottom + 2,
        );
        if (carpisti) e.style.visibility = 'hidden';
        else yerlesen.push(r);
      }
    };
    // Dönüşüm bittikten sonra ölç: kaydırma sırasında her karede ölçmek
    // 61 kutuyu boşuna okumak olurdu.
    kare = requestAnimationFrame(seyrelt);
    return () => cancelAnimationFrame(kare);
  });
  const isaretciler = useRef(new Map<number, { x: number; y: number }>());
  const surukleme = useRef({ mesafe: 0, ilkAralik: 0, ilkOlcek: 1 });

  /**
   * Kaydırmayı çerçevenin içinde tutar.
   *
   * Sınırsız kaydırma haritayı ekrandan çıkarıyor ve oyuncu onu geri
   * getiremiyordu; "sığdır" düğmesini bulmak da bir çözüm değil, bir
   * kurtarma hamlesidir.
   */
  function sinirla(g: Gorunum): Gorunum {
    const olcek = Math.min(EN_COK, Math.max(EN_AZ, g.olcek));
    const kutu = kutuRef.current;
    if (!kutu) return { ...g, olcek };
    const enPay = (kutu.clientWidth * (olcek - 1)) / 2;
    const boyPay = (kutu.clientHeight * (olcek - 1)) / 2;
    return {
      olcek,
      dx: Math.max(-enPay, Math.min(enPay, g.dx)),
      dy: Math.max(-boyPay, Math.min(boyPay, g.dy)),
    };
  }

  function isaretciIndi(e: React.PointerEvent) {
    isaretciler.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    surukleme.current.mesafe = 0;
    if (isaretciler.current.size === 2) {
      const [a, b] = [...isaretciler.current.values()];
      surukleme.current.ilkAralik = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      surukleme.current.ilkOlcek = gorunum.olcek;
    }
  }

  function isaretciHareket(e: React.PointerEvent) {
    const onceki = isaretciler.current.get(e.pointerId);
    if (!onceki) return;
    isaretciler.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    surukleme.current.mesafe += Math.hypot(e.clientX - onceki.x, e.clientY - onceki.y);

    if (isaretciler.current.size === 2 && surukleme.current.ilkAralik > 0) {
      const [a, b] = [...isaretciler.current.values()];
      const aralik = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const oran = aralik / surukleme.current.ilkAralik;
      setGorunum((g) => sinirla({ ...g, olcek: surukleme.current.ilkOlcek * oran }));
      return;
    }
    // Tek parmakla kaydırma yalnız YAKINLAŞMIŞKEN: tam görünümde sayfanın
    // kendi kaydırması engellenmemeli.
    if (gorunum.olcek > 1) {
      setGorunum((g) =>
        sinirla({ ...g, dx: g.dx + (e.clientX - onceki.x), dy: g.dy + (e.clientY - onceki.y) }),
      );
    }
  }

  function isaretciKalkti(e: React.PointerEvent) {
    isaretciler.current.delete(e.pointerId);
    if (isaretciler.current.size < 2) surukleme.current.ilkAralik = 0;
  }

  /** Sürüklemeden sonra gelen tıklama seçim SAYILMAZ. */
  const suruklendiMi = () => surukleme.current.mesafe > 8;

  const ev = regions.find((r) => r.id === homeBolgeId) ?? regions[0];
  const vilayetler = vilayetMerkezleri(regions);

  /*
   * ETİKET KADEMELERİ — haritacılığın en eski sorunu.
   *
   * İlk denemede 61 bölgenin adı birden yazılıyordu ve harita okunmuyordu:
   * etiketler birbirinin üstüne biniyor, hiçbiri okunmuyordu. Telefon
   * genişliğinde 61 ada aynı anda yer yok; bu bir yerleşim hatası değil,
   * geometrik bir imkânsızlık.
   *
   * Çözüm gerçek haritaların çözümü: ÖLÇEĞE GÖRE göster.
   *
   *   uzak (×1)     → yalnız vilayet adları ve SENİ İLGİLENDİREN yerler
   *                   (senin, düşmanın, taht, seçili). Gerisi madalyon.
   *   orta (×1.4)   → bütün adlar, kısaltılmış
   *   yakın (×1.8)  → adlar tam, sahip etiketleri de açık
   *
   * Adı görünmeyen bölge kaybolmuyor: madalyonu türünü söylüyor ve
   * dokununca panelde adıyla açılıyor.
   */
  /*
   * Yollar: her komsuluk BIR kez. `komsular` karsilikli oldugu icin
   * suzmeden cizersek her cizgi iki kere cizilir ve gecit cizgileri
   * kalinlasip titrer.
   */
  const yollar = useMemo(() => {
    const yer = new Map(regions.map((r) => [r.id, r]));
    const liste: { a: RegionDto; b: RegionDto; gecit: boolean }[] = [];
    for (const r of regions) {
      for (const k of r.komsular) {
        if (k <= r.id) continue;
        const komsu = yer.get(k);
        if (komsu) liste.push({ a: r, b: komsu, gecit: gecitMi(r.id, k) });
      }
    }
    // Geçitler EN SONA: aynı katmanda çizilen sıradan yollar onların
    // üstünü örtüyordu ve dağ geçidi sıradan bir yol gibi görünüyordu.
    liste.sort((x, y) => Number(x.gecit) - Number(y.gecit));
    return liste;
  }, [regions]);

  const kademe: 'uzak' | 'orta' | 'yakin' =
    gorunum.olcek >= 1.8 ? 'yakin' : gorunum.olcek >= 1.4 ? 'orta' : 'uzak';

  return (
    <div className="oyuk relative overflow-hidden rounded-xl border border-kenar">
      <div
        ref={kutuRef}
        className="relative"
        style={{ touchAction: gorunum.olcek > 1 ? 'none' : 'pan-y' }}
        onPointerDown={isaretciIndi}
        onPointerMove={isaretciHareket}
        onPointerUp={isaretciKalkti}
        onPointerCancel={isaretciKalkti}
      >
        <div
          className="relative"
          data-harita-tuval=""
          style={{
            transform: `translate(${gorunum.dx}px, ${gorunum.dy}px) scale(${gorunum.olcek})`,
            transformOrigin: 'center',
          }}
        >
          {/* --- Zemin ---
              Resim yoksa altındaki gradyan kalır ve harita çalışmaya devam
              eder; işaretçilerin yeri resme değil veriye bağlı. */}
          <div
            className="aspect-square w-full bg-[radial-gradient(ellipse_at_50%_45%,#3c4a2e_0%,#2a3626_42%,#16242e_72%,#0f1b23_100%)]"
            role="img"
            aria-label={`Dünya haritası, ${regions.length} bölge`}
          >
            <img
              src="/gorseller/harita/dunya.webp"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
          </div>

          {/* --- Yollar ve geçitler ---
              Haritanin en onemli KURALI burada gorunuyor: saldirabilecegin
              yer, toprağına BİTİŞİK olan yer. O bitişiklik veride yazılı
              (`komsular`) ama ekranda hiç çizilmiyordu; oyuncu iki bölgenin
              komşu olup olmadığını ancak deneyerek öğreniyordu.

              GEÇİT ayrı çiziliyor: dağı aşan tek yol. Diyarın dar boğazları
              bunlar ve iki yanında çoğu zaman bir kale duruyor. Bir geçidi
              tutmak arkasındaki her şeyi tutmak demek — ama bunu görmeyen
              oyuncu için harita yine düz bir liste olurdu.

              Yakınlaşınca soluyor: o ölçekte bölge adları yazılıyor ve
              çizgiler onların altında kalıyor. */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ opacity: gorunum.olcek >= 1.8 ? 0.35 : 0.8 }}
            aria-hidden="true"
          >
            {yollar.map(({ a, b, gecit }) => (
              <line
                key={`${a.id}-${b.id}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={gecit ? '#ff8c3a' : '#e6d3ae'}
                strokeWidth={gecit ? 1.6 : 0.6}
                strokeDasharray={gecit ? '2.2 1.4' : undefined}
                strokeLinecap="round"
                opacity={gecit ? 1 : 0.38}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {/* --- Yürüyüşler ---
              Ordunun yolda olduğunu yalnız listeden anlamak beklemeyi boş bir
              bekleyişe çeviriyordu; harita üzerinde ilerleyen bir işaret aynı
              süreyi gerilime çeviriyor. İşaretin yeri gerçek: yola çıkış ve
              varış zamanından oranlanıyor.

              preserveAspectRatio="none": çizgiler yüzdelik uzayda duruyor,
              işaretçilerle aynı koordinatları kullanmalılar. */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {yuruyusler.map((y) => {
              const hedef = regions.find((r) => r.id === y.toRegionId);
              if (!hedef || !ev) return null;
              const bas = new Date(y.departAt).getTime();
              const bit = new Date(y.arriveAt).getTime();
              const oran =
                bit > bas ? Math.max(0, Math.min(1, (Date.now() - bas) / (bit - bas))) : 1;
              const donus = y.kind === 'return';
              const bx = donus ? hedef.x : ev.x;
              const by = donus ? hedef.y : ev.y;
              const hx = donus ? ev.x : hedef.x;
              const hy = donus ? ev.y : hedef.y;
              const renk = donus ? '#3ddc84' : '#e8524d';
              return (
                <g key={y.id}>
                  <line
                    x1={bx}
                    y1={by}
                    x2={hx}
                    y2={hy}
                    stroke={renk}
                    strokeWidth="0.5"
                    strokeDasharray="1.5 1.5"
                    opacity="0.65"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={bx + (hx - bx) * oran}
                    cy={by + (hy - by) * oran}
                    r={1.1 / gorunum.olcek}
                    fill={renk}
                    stroke="#17100c"
                    strokeWidth={0.4 / gorunum.olcek}
                  />
                </g>
              );
            })}
          </svg>

          {/* --- Bölgeler --- */}
          {regions.map((r) => (
            <BolgeIsareti
              key={r.id}
              r={r}
              secili={seciliId === r.id}
              ortakHedef={ittifakHedefiId === r.id}
              kampBurada={r.id === homeBolgeId}
              kademe={kademe}
              olcek={gorunum.olcek}
              onSec={() => {
                // Sürükledikten sonraki tıklama seçim değil: haritayı
                // kaydırırken parmağın kalktığı bölge seçilirse kaydırmak
                // imkânsız hâle gelir.
                if (!suruklendiMi()) onSec(r.id);
              }}
            />
          ))}

          {/* --- Vilayet adları ---
              Gerçek haritalardaki gibi aralıklı ve soluk. Bölgelerin
              ÜSTÜNDE: ilk denemede altındaydılar ve madalyonlar hepsini
              tamamen kapatıyordu — vilayet adları haritada hiç
              görünmüyordu. Tıklamayı engellemiyorlar. */}
          <div
            className="pointer-events-none absolute inset-0 select-none transition-opacity"
            // Yakınlaşınca vilayet adı çekiliyor: o ölçekte bölge adları
            // yazılıyor ve ikisi aynı yerde birbirini okunmaz kılıyor.
            style={{ opacity: kademe === 'uzak' ? 0.75 : 0 }}
          >
            {vilayetler.map((v) => (
              <span
                key={v.key}
                className="baslik absolute text-[11px] tracking-[0.25em] whitespace-nowrap"
                style={{
                  left: `${v.x}%`,
                  top: `${v.y}%`,
                  transform: `translate(-50%, -50%) scale(${1 / gorunum.olcek})`,
                  color: VILAYET_RENGI[v.key] ?? '#cbb894',
                  textShadow: '0 0 5px #0f0a06, 0 0 3px #0f0a06, 0 1px 2px #0f0a06',
                }}
              >
                {(VILAYET_ADI[v.key] ?? v.key).toLocaleUpperCase('tr')}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Yakınlaştırma düğmeleri: parmakla yakınlaştırmayı bilmeyen ya da tek
          eliyle oynayan oyuncu da haritaya yaklaşabilmeli. */}
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
        <YakinlikDugmesi
          etiket="Yakınlaştır"
          isaret="+"
          onTikla={() => setGorunum((g) => sinirla({ ...g, olcek: g.olcek * 1.5 }))}
        />
        <YakinlikDugmesi
          etiket="Uzaklaştır"
          isaret="−"
          onTikla={() => setGorunum((g) => sinirla({ ...g, olcek: g.olcek / 1.5 }))}
        />
        {gorunum.olcek > 1 && (
          <YakinlikDugmesi
            etiket="Haritayı sığdır"
            isaret="⊡"
            onTikla={() => setGorunum({ olcek: 1, dx: 0, dy: 0 })}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Tek bir bölgenin işaretçisi.
 *
 * Madalyon (tür) + ad şeridi. Sahiplik madalyonun halkasında: altın halka
 * senin, kırmızı düşmanın, sönük kenar sahipsiz. Renk tek başına ölçüt
 * değil — düşman madalyonunda ayrıca içi dolu bir nokta var.
 */
function BolgeIsareti({
  r,
  secili,
  ortakHedef,
  kampBurada,
  kademe,
  olcek,
  onSec,
}: {
  r: RegionDto;
  secili: boolean;
  ortakHedef: boolean;
  kampBurada: boolean;
  kademe: 'uzak' | 'orta' | 'yakin';
  /** Haritanın o anki yakınlığı; işaretçi bununla TERS ölçekleniyor. */
  olcek: number;
  onSec: () => void;
}) {
  const taht = r.type === 'taht';
  // Uzak ölçekte yalnız oyuncuyu ilgilendiren yerlerin adı yazılıyor.
  const adGoster = kademe !== 'uzak' || r.isMine || Boolean(r.owner) || taht || secili;
  /*
   * Etiket ÖNCELİĞİ — çakışanı hangisinin yeneceği.
   *
   * Kademe kuralı tek başına yetmiyordu ve sebebi ölçüldü: dolu bir
   * diyarda 61 bölgenin neredeyse hepsinin sahibi var, yani "sahipli
   * olanı göster" kuralı ×1'de "hepsini göster"e dönüşüyor. Telefon
   * genişliğinde 19 etiketten 8 çifti üst üste biniyordu.
   *
   * Sayı küçük olan önce yerleşir; yer kalmazsa büyük olan susar.
   */
  const oncelik = secili ? 0 : taht ? 1 : r.isMine ? 2 : r.owner ? 3 : 4;
  // Seçili ve taht her ölçekte büyük: ikisi de "buraya bak" demek.
  const madalyon = kademe === 'uzak' && !secili && !taht ? 24 : 32;
  const halka = r.isMine
    ? '#f5b731'
    : r.owner
      ? '#e8524d'
      : taht
        ? '#f5b731'
        : 'rgba(240,225,200,0.45)';
  return (
    <button
      type="button"
      onClick={onSec}
      /*
       * 44 piksellik DAİRESEL dokunma hedefi.
       *
       * Madalyon 32 piksel ve görsel olarak öyle kalmalı — 61 tanesi
       * telefon genişliğine ancak sığıyor. Dokunma hedefi görünenden
       * büyük olabilir; görsel denetim ilk hâlini 32×32 diye yakaladı ve
       * haklıydı.
       *
       * Ama KARE bir 44'lük kutu daha kötüydü: işaretçiler ~37 piksel
       * arayla duruyor, kutunun köşeleri komşunun MERKEZİNİ örtüyor ve
       * bir bölgeye basmak yandakini seçiyordu. Daire bu sorunu çözüyor —
       * yarıçap 22, komşu merkezi 37 piksel ötede, yani hiçbir dairenin
       * içine bir başkasının merkezi düşmüyor.
       *
       * Ad şeridi de tıklama geçirmiyor (aşağıda): kutunun içinde
       * kalsaydı aşağıdaki komşuyu örterdi. Log'da tam bunu görmüştük —
       * Taht Kalesi'nin etiketi altındaki tarlanın tıklamasını yiyordu.
       */
      className="absolute flex h-11 w-11 items-center justify-center rounded-full"
      /*
       * TERS ÖLÇEK — harita pinlerinin kuralı.
       *
       * Sarmalayıcı yakınlaştıkça zemin resmi büyüyor; işaretçi ise aynı
       * PİKSEL boyutunda kalmalı. İlk denemede kalmıyordu: ×2,25'te
       * madalyonlar dev gibi oluyor, adlar birbirinin üstüne biniyor ve
       * yakınlaştırmak haritayı okunur değil okunmaz yapıyordu.
       *
       * Ters ölçekle yakınlaştırmak işaretçileri BİRBİRİNDEN AYIRIYOR:
       * asıl istenen şey buydu.
       */
      style={{
        left: `${r.x}%`,
        top: `${r.y}%`,
        transform: `translate(-50%, -50%) scale(${1 / olcek})`,
        // Kutular komşularıyla hafifçe örtüşüyor; oyuncuyu ilgilendiren
        // bölge üstte kalmalı ki dokunuş ona gitsin.
        // Taht, sahipli bölgelerin ÜSTÜNDE. Altındayken komşusunun ad
        // şeridi (madalyonun hemen altında duruyor) tahtın madalyonunu
        // kesiyordu — oyunun ucu yarım bir daire olarak görünüyordu.
        zIndex: secili ? 30 : taht ? 25 : r.isMine || r.owner ? 20 : 1,
      }}
      /*
       * Ad HER ZAMAN erişilebilir isimde duruyor, görünür etiket
       * gizliyken bile. İki sebep:
       *  - ekran okuyucu bölgeyi adıyla duyurmalı; madalyonun rengi
       *    ona hiçbir şey söylemiyor,
       *  - testler bölgeyi adıyla buluyor ve yakınlık kademesi
       *    yüzünden bulamamaları ürünün değil ölçümün kusuru olurdu.
       */
      aria-label={`${r.name} — ${r.type}, seviye ${r.level}, ${
        r.owner ? `sahibi ${r.owner.name}` : 'sahipsiz'
      }, ${r.distance} adım`}
      data-bolge={r.id}
      title={`${r.name} — ${r.type}, seviye ${r.level}, ${
        r.owner ? `sahibi ${r.owner.name}` : 'sahipsiz'
      }, ${r.distance} adım`}
    >
      {/*
        Madalyon UZAKTA KÜÇÜK.
        Bölgeler artık ızgarada değil araziye serpili (docs/12 §11) ve
        aralıkları eşit değil: ovada sık, dağda seyrek. 32 pikselli madalyon
        eşit kafeste denk düşüyordu, serpintide bitişikleri birbirine
        değiyor ve altlarındaki harita hiç görünmüyordu — oyuncunun
        baktığı şey diyar değil, bir rozet kalabalığı oluyordu.

        Uzakta 24, yakında 32. Dokunma hedefi değişmiyor: onu saran
        44 piksellik daire yukarıda ve oralı değil.
      */}
      <span
        className="relative flex items-center justify-center rounded-full text-parsomen shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
        style={{
          width: madalyon,
          height: madalyon,
          background: TIP_RENGI[r.type] ?? '#6a5334',
          border: `${secili ? 3 : 2}px solid ${secili ? '#fff3cf' : halka}`,
          outline: ortakHedef ? '2px dashed #7cc4f0' : undefined,
          outlineOffset: '2px',
        }}
      >
        <TipIkonu tip={r.type} boyut={kademe === 'uzak' ? 13 : 16} />

        {/*
          ROZETLER hep KOYU BİR ÇİPİN üstünde duruyor.

          İlk denemede kalkan işareti doğrudan madalyonun rengine
          basılıyordu ve okunurluk denetimi onu 1,7 kontrastla yakaladı —
          eşik 4,5. Madalyonun rengi bölge türüne göre değişiyor, yani
          rozetin arkası ne olacağı belli değil; tek çözüm rozetin kendi
          zeminini taşıması.
        */}
        {/* Düşman bölgesi: renk körü için renkten AYRI bir işaret. */}
        {r.owner && !r.isMine && (
          <span className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full border-2 border-gece bg-kirmizi" />
        )}
        {r.shielded && (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-mavi bg-gece text-[11px] leading-none text-mavi"
            title="Korumalı"
          >
            ⛨
          </span>
        )}
        {r.level > 1 && (
          <span className="tabular absolute -right-1.5 -bottom-1.5 rounded bg-gece px-1 text-[11px] leading-tight font-bold text-altin">
            {r.level}
          </span>
        )}
        {/* Kamp çıpası: oyuncunun haritadaki başlangıç noktası. */}
        {kampBurada && (
          <span
            className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 rounded-full border-2 border-gece bg-altin"
            title="Kampın"
          />
        )}
      </span>
      {/* Etiketler madalyonun ALTINDA ve tıklama geçirmiyor: akışın
          içinde olsalardı düğmenin kutusunu uzatır ve alttaki komşunun
          tıklamasını yerlerdi. */}
      <span className="pointer-events-none absolute top-full left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5">
        {adGoster && (
          <span
            data-bolge-ad=""
            data-oncelik={oncelik}
            className="max-w-[96px] truncate rounded bg-gece/85 px-1 text-[11px] leading-tight font-bold whitespace-nowrap text-parsomen"
            style={{ textShadow: '0 1px 2px #000' }}
          >
            {kademe === 'yakin' ? r.name : kisaAd(r.name)}
          </span>
        )}
        {/* Sahip etiketi yalnız YAKIN ölçekte: uzakta madalyon halkası
            zaten kimin olduğunu söylüyor ve ikinci bir satır yer
            kalmıyor. */}
        {r.owner && kademe === 'yakin' && (
          <span
            className="max-w-[96px] truncate rounded px-1 text-[11px] leading-tight whitespace-nowrap"
            style={{
              // Koyu metin, doygun zemin: ikisi de kontrast eşiğinin üstünde.
              background: r.isMine ? '#f5b731' : '#e8524d',
              color: '#17100c',
            }}
          >
            {r.owner.name}
          </span>
        )}
      </span>
    </button>
  );
}

function YakinlikDugmesi({
  etiket,
  isaret,
  onTikla,
}: {
  etiket: string;
  isaret: string;
  onTikla: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTikla}
      aria-label={etiket}
      title={etiket}
      // 44px: dokunma hedefi alt sınırı (tools/gorsel-denetim.mjs ölçüyor).
      className="bas flex h-11 w-11 items-center justify-center rounded-lg border border-kenar bg-gece/70 text-[16px] leading-none text-solgun backdrop-blur"
    >
      {isaret}
    </button>
  );
}
