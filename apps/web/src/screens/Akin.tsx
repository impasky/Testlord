/**
 * Akın — beş NPC diyarı, her birinde on grup (docs/12 §6).
 *
 * Bu sekmenin tek işi var: ordusu olan oyuncuya BUGÜN yapacak bir şey
 * vermek. Dünya haritası toprak veriyor ve toprak kıt — komşusu kalkanlı,
 * önerilen hedef uzak, eldeki asker bekliyor. Burası o boşluğu dolduruyor.
 *
 * ── Ekranın kuralları ───────────────────────────────────────────────
 *
 * 1. **Önce harita, sonra grup.** İki katman: kapalı harita bir liste
 *    öğesi olarak duruyor ve neyin eksik olduğunu söylüyor ("15.
 *    seviyede açılır"). Elli grubu tek listede göstermek, oyuncunun
 *    şikâyet ettiği "her şey üstüme geliyor" duygusunun ta kendisi.
 * 2. **Gitmeden önce ne olacağını söyle.** Grup seçilince önizleme
 *    çağrılıyor: kazanma ihtimali, tahmini kayıp, süre (docs/09 İ1).
 *    Bedeli olan bir kararı karşılığını bilmeden vermek olmaz.
 * 3. **Vurulan grup GRİ ama görünür.** Kaybolmuyor, ne zaman
 *    yenileneceğini yazıyor: "burada bir şey vardı, ne zaman dönecek"
 *    sorusu ekranda cevaplanmalı.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  api,
  type AkinGrupDurumu,
  type AkinHaritaDurumu,
  type LordState,
} from '../api/client';
import { AKIN_YOLU, UNIT_TYPES, unitName, type Army, type UnitType } from '@lordlar/shared';
import {
  Bolum,
  Buton,
  GeriSayim,
  Hap,
  Iskelet,
  Kart,
  formatKalan,
  formatSayi,
} from '../components/ui';
import { Zemin } from '../components/Zemin';
import { IkonAltin, IkonDemir, IkonErzak, IkonSure } from '../components/Ikonlar';

/** Ordunun toplam birim sayısı. */
function orduSayisi(ordu: Army | null | undefined): number {
  if (!ordu) return 0;
  return UNIT_TYPES.reduce((t, u) => t + (ordu[u] ?? 0), 0);
}

/** "12 mızrakçı · 8 okçu" — garnizonu ve orduyu aynı biçimde yazıyor. */
function orduYazisi(ordu: Army | null | undefined): string {
  if (!ordu) return '—';
  const parcalar = UNIT_TYPES.filter((u) => (ordu[u] ?? 0) > 0).map(
    (u) => `${formatSayi(ordu[u] ?? 0)} ${unitName(u)}`,
  );
  return parcalar.length ? parcalar.join(' · ') : '—';
}

export function Akin({ lord, onGuncelle }: { lord: LordState; onGuncelle: () => void }) {
  const qc = useQueryClient();
  const veri = useQuery({ queryKey: ['akin'], queryFn: api.akin, refetchInterval: 15000 });
  const [secili, setSecili] = useState<{ harita: string; grup: number } | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const cik = useMutation({
    mutationFn: (g: { haritaKey: string; grupNo: number; army: Army }) => api.akinaCik(g),
    onSuccess: () => {
      setHata(null);
      setSecili(null);
      void qc.invalidateQueries({ queryKey: ['akin'] });
      void qc.invalidateQueries({ queryKey: ['army'] });
      onGuncelle();
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'Akına çıkılamadı.'),
  });

  if (veri.isPending || !veri.data) return <Iskelet satir={5} />;
  const { haritalar, sahadaki, sonuclar, esZamanli } = veri.data;

  // Rehber ışığı zincirinin hedefleri: ilk AÇIK diyar ve onun ilk açık
  // grubu. Işık tek düğme aydınlatıyor; hangisi olduğu burada seçiliyor.
  const ilkAcikHarita = haritalar.find((h) => h.acik)?.key ?? null;
  const seciliHarita = secili ? (haritalar.find((h) => h.key === secili.harita) ?? null) : null;
  const seciliGrup = seciliHarita?.gruplar.find((g) => g.grupNo === secili?.grup) ?? null;

  return (
    <div className="space-y-4">
      <Zemin ad="akin" baslik="Akın" altyazi="Düşman kamplarına in, kaynak ve ekipman getir" />

      {/* Sahadaki akınlar EN ÜSTTE: "askerlerim nerede" sorusu
          cevaplanmadan başka hiçbir şey okunmuyor. */}
      {sahadaki.length > 0 && (
        <Bolum baslik={`Sahadaki akınlar · ${sahadaki.length}/${esZamanli}`}>
          <div className="space-y-2">
            {sahadaki.map((a) => (
              <Kart key={a.id} className="border-altin/40 p-3">
                <div className="flex items-center justify-between gap-2" data-akin-sahada={a.id}>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-altin">
                      {a.haritaAdi} · {a.grupAdi}
                    </p>
                    <p className="text-[12px] text-solgun">{orduYazisi(a.army)}</p>
                  </div>
                  <span className="tabular shrink-0 text-[12px] text-parsomen">
                    <GeriSayim bitis={a.arriveAt} />
                  </span>
                </div>
              </Kart>
            ))}
          </div>
        </Bolum>
      )}

      {hata && <p className="text-[12px] text-kirmizi">{hata}</p>}

      {/* --- Haritalar --- */}
      <Bolum baslik="Diyarlar">
        <div className="space-y-2.5">
          {haritalar.map((h) => (
            <HaritaKarti
              key={h.key}
              h={h}
              lordSeviyesi={lord.level}
              acikMi={secili?.harita === h.key}
              seciliGrup={secili?.harita === h.key ? secili.grup : null}
              onAc={() =>
                setSecili((o) => (o?.harita === h.key ? null : { harita: h.key, grup: 0 }))
              }
              onGrupSec={(no) => {
                setHata(null);
                setSecili({ harita: h.key, grup: no });
              }}
              ilkAcikMi={h.key === ilkAcikHarita}
            >
              {/* Sefer kartı SEÇİLEN GRUBUN ALTINDA açılıyor, sayfanın
                  sonunda değil. Önce sayfanın sonuna koymuştum: oyuncu
                  bir gruba dokunuyor, ekranda hiçbir şey değişmiyor gibi
                  görünüyor ve kaydırmadan kartı hiç bulamıyordu. */}
              {seciliHarita?.key === h.key && seciliGrup?.acik && (
                <SeferKarti
                  lord={lord}
                  harita={seciliHarita}
                  grup={seciliGrup}
                  bekliyor={cik.isPending}
                  onGonder={(army) =>
                    cik.mutate({ haritaKey: seciliHarita.key, grupNo: seciliGrup.grupNo, army })
                  }
                />
              )}
            </HaritaKarti>
          ))}
        </div>
      </Bolum>

      {/* --- Son sonuçlar --- */}
      <Bolum baslik="Son akınlar" sakin>
        {sonuclar.length === 0 ? (
          <p className="text-[12px] text-solgun">
            Henüz akına çıkmadın. Bir diyar seç, grubunu belirle, ordunu gönder.
          </p>
        ) : (
          <div className="space-y-2">
            {sonuclar.map((s) => (
              <Kart key={s.id} sakin className="p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] text-parsomen">
                    {s.haritaAdi} · {s.grupAdi}
                  </span>
                  <Hap renk={s.kazanildi ? 'var(--color-yesil)' : 'var(--color-kirmizi)'}>
                    {s.kazanildi ? 'zafer' : 'yenilgi'}
                  </Hap>
                </div>
                {s.kazanildi && s.odul && (
                  <p className="mt-1 text-[12px] text-solgun">
                    {formatSayi(s.odul.altin)} altın · {formatSayi(s.odul.demir)} demir ·{' '}
                    {formatSayi(s.odul.erzak)} erzak
                    {s.dusenItemId && ' · bir ekipman düştü'}
                  </p>
                )}
                {orduSayisi(s.yarali) > 0 && (
                  <p className="mt-0.5 text-[11.5px] text-turuncu">
                    {formatSayi(orduSayisi(s.yarali))} yaralı hastaneye girdi.
                  </p>
                )}
              </Kart>
            ))}
          </div>
        )}
      </Bolum>
    </div>
  );
}

/** Bir diyar: başlık, kilit durumu ve açılınca on grup. */
function HaritaKarti({
  h,
  lordSeviyesi,
  acikMi,
  seciliGrup,
  onAc,
  onGrupSec,
  ilkAcikMi = false,
  children,
}: {
  h: AkinHaritaDurumu;
  lordSeviyesi: number;
  /** Rehber ışığının hedefi olan ilk açık diyar mı. */
  ilkAcikMi?: boolean;
  acikMi: boolean;
  seciliGrup: number | null;
  onAc: () => void;
  onGrupSec: (grupNo: number) => void;
  /** Seçilen grubun sefer kartı — grup ızgarasının hemen altında. */
  children?: ReactNode;
}) {
  const kilitli = !h.acik;
  return (
    <Kart className={`p-0 ${kilitli ? 'opacity-70' : ''}`}>
      {/* İmza DÜĞMENİN üstünde, kartın değil: araçlar zaten buna
          dokunuyor ve `Kart` fazladan öznitelik geçirmiyor (bilerek —
          imzalar açık bir prop olarak veriliyor, sessizce sızmıyor). */}
      <button
        type="button"
        data-akin-harita={h.key}
        /* Rehber ışığı zincirinin üçüncü halkası: ilk (kilitsiz) diyar.
           Yalnız ilkine konuyor — ışık TEK düğme aydınlatıyor ve beşini
           birden açık bırakmak seçim değil kararsızlık üretirdi. */
        data-rehber={ilkAcikMi ? 'akin-harita' : undefined}
        onClick={onAc}
        disabled={kilitli}
        className="bas w-full text-left"
        aria-expanded={acikMi}
      >
        {/* --- Diyarın kapağı ---
            Beş diyarın tek ayırt edici işareti yazıydı; oyuncu "burası
            neresi" sorusunu ancak okuyarak cevaplayabiliyordu. Boy SABİT
            (aspect-[16/6]) — görsel yüklenirken kart zıplamasın diye,
            `Zemin.tsx`teki gerekçenin aynısı.

            Kilitli diyarda gri: kilidin sebebi seviye, ve renkli bir
            kapak "gir" diye bağırıp kapıyı kapatıyordu. */}
        <div
          className={`relative w-full overflow-hidden rounded-t-[18px] aspect-[16/6] ${
            kilitli ? 'grayscale' : ''
          }`}
        >
          <img
            src={`/gorseller/akin/${h.key}.webp`}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {/* Alt kenarı karartan perde: kapağın açık tonu kart kenarıyla
              birleşince kartın nerede bittiği kayboluyordu. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--color-panel)] to-transparent" />
        </div>
        <div className="px-3 pb-2.5 pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="baslik text-[14px] text-altin">{h.ad}</span>
            {kilitli ? (
              <Hap renk="var(--color-sonuk)">Sv{h.gerekenSeviye}</Hap>
            ) : (
              <span className="tabular text-[11.5px] text-solgun">{h.acikGrup}/10 grup hazır</span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-solgun">{h.ozet}</p>
          <p className="mt-1 text-[11.5px] text-sonuk">
            {h.dusman}
            {kilitli && ` · ${h.gerekenSeviye - lordSeviyesi} seviye daha gerekiyor`}
          </p>
        </div>
      </button>

      {acikMi && !kilitli && (
        <div className="border-t border-kenar px-3 py-2.5">
          <DiyarHaritasi
            h={h}
            seciliGrup={seciliGrup}
            isiktakiGrup={ilkAcikMi ? (h.gruplar.find((x) => x.acik)?.grupNo ?? null) : null}
            onGrupSec={onGrupSec}
          />
          {children && <div className="mt-2.5">{children}</div>}
        </div>
      )}
    </Kart>
  );
}

/**
 * Bir grup düğmesi.
 *
 * Vurulan grup KAYBOLMUYOR, gri duruyor ve ne zaman döneceğini yazıyor.
 * Gizleseydik oyuncu "burada bir şey vardı" diye ekranı arardı.
 */
/** Kampın haritadaki genişliği (kabın yüzdesi). */
const KAMP_BOY = 14;

/**
 * Diyar haritası — on kamp, bir yol.
 *
 * Oyuncu: "akın kısmında harita yap, 10 NPC karakteri de o haritaya ekle;
 * oyuncu o karaktere tıklayarak akın saldırısı yapsın." Önceden gruplar iki
 * sütunlu bir YAZI ızgarasıydı: on düğme, on isim, hepsi aynı görünüyordu.
 * Diyarın neresi olduğu ve nereye kadar gelindiği hiçbir yerde yoktu.
 *
 * Yol beş diyarda da AYNI (`AKIN_YOLU`) ve bu bilinçli: oyuncu bir kez
 * öğreniyor — 1 sol altta, şef sağ üstte — ve bu her diyarda geçerli.
 * Diyarı ayıran şey zemin. Ayrıca zemin istemi tam bu yolu tarif ediyor;
 * yol diyara göre değişseydi zeminle koordine edilemezdi, çünkü zemin
 * üretilirken hangi yolun geleceği bilinmiyor (`data/akinlar.json`).
 */
function DiyarHaritasi({
  h,
  seciliGrup,
  isiktakiGrup,
  onGrupSec,
}: {
  h: AkinHaritaDurumu;
  seciliGrup: number | null;
  /** Rehber ışığının aydınlatacağı grup — yoksa null. */
  isiktakiGrup: number | null;
  onGrupSec: (grupNo: number) => void;
}) {
  /*
   * Diyar açılınca harita KENDİLİĞİNDEN görünür oluyor.
   *
   * Kart sırası kapak → ad → özet → harita; telefonda harita ekranın
   * altında kalıyor ve oyuncu diyara dokunup hiçbir şey olmadı sanıyordu.
   * Bileşen yalnız açıkken var olduğu için kaydırma mount'ta bir kez
   * yapılıyor, ayrı bir bayrak tutmaya gerek yok.
   */
  const kutu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    kutu.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  return (
    <div
      ref={kutu}
      className="oyuk relative isolate aspect-square w-full overflow-hidden rounded-lg border border-kenar"
    >
      <img
        src={`/gorseller/akin_harita/${h.key}.webp`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />

      {/* Kampları bağlayan iz. Zeminde boyalı bir patika zaten var ama
          işaretçiler tam onun üstüne oturmuyor — bu çizgi hangi kampın
          hangisinden sonra geldiğini kesinleştiriyor. Kesikli ve soluk:
          yolun kendisi zemindeki resim, bu yalnızca sırayı söylüyor. */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <polyline
          points={AKIN_YOLU.map((n) => `${n.x},${n.y}`).join(' ')}
          fill="none"
          stroke="rgba(245,183,49,0.35)"
          strokeWidth="0.8"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {h.gruplar.map((g, i) => (
        <KampIsareti
          key={g.grupNo}
          g={g}
          yer={AKIN_YOLU[i] ?? { x: 50, y: 50 }}
          dusmanKey={h.dusmanKey}
          secili={seciliGrup === g.grupNo}
          isikta={isiktakiGrup === g.grupNo}
          onSec={() => onGrupSec(g.grupNo)}
        />
      ))}
    </div>
  );
}

/**
 * Haritadaki tek bir düşman kampı.
 *
 * Şehir haritasındaki yapıyla aynı mimari (`Sehir.tsx`): figür TABANINDAN
 * çakılıyor, altında temas gölgesi var ve derinlik sırası y'den geliyor.
 * Aynı gerekçeler: taban hizası olmadan figürler havada duruyor, gölge
 * olmadan zemine basmıyorlar.
 *
 * Çizim diyarın düşmanı — 1-9. kamplarda asker, 10.'da ŞEF. Elli grubun
 * her birine ayrı çizim bütçeye sığmazdı ve gerekmiyor da: oyuncunun
 * sorduğu şey "burada tam olarak kim var" değil, "hangi diyardayım ve
 * sonuncu muyum".
 */
function KampIsareti({
  g,
  yer,
  dusmanKey,
  secili,
  isikta,
  onSec,
}: {
  g: AkinGrupDurumu;
  yer: { x: number; y: number };
  dusmanKey: string;
  secili: boolean;
  isikta: boolean;
  onSec: () => void;
}) {
  const bekliyor = !g.acik && g.yenilenirAt !== null;
  const ad = g.sef ? `${dusmanKey}_sef` : dusmanKey;
  return (
    <button
      type="button"
      onClick={onSec}
      disabled={!g.acik}
      data-akin-grup={g.grupNo}
      data-rehber={isikta ? 'akin-grup' : undefined}
      aria-label={`${g.grupNo}. ${g.ad}${g.sef ? ', şef' : ''} — ${
        g.acik ? `${formatSayi(g.garnizonSayisi)} savaşçı` : bekliyor ? 'yenileniyor' : 'kilitli'
      }`}
      className="absolute aspect-square"
      style={{
        left: `${yer.x}%`,
        top: `${yer.y}%`,
        // Şef daha iri: son kampın "patron" olduğu çizimden değil
        // boyuttan da okunmalı, çünkü çizim küçükken ayrıntı kaybolur.
        width: `${KAMP_BOY * (g.sef ? 1.3 : 1)}%`,
        transform: 'translate(-50%, -100%)',
        // Seçili kamp öne: sıralar çakışabiliyor ve seçtiğin şeyin üstü
        // örtülü olmamalı.
        zIndex: Math.round(yer.y) + (secili ? 200 : 0),
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-7%] left-1/2 h-[18%] w-[80%] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(20,14,8,0.55) 0%, rgba(20,14,8,0.24) 52%, rgba(20,14,8,0) 78%)',
        }}
      />
      <img
        src={`/gorseller/dusmanlar/${ad}.webp`}
        alt=""
        aria-hidden="true"
        className="relative h-full w-full object-contain"
        style={{
          filter: secili
            ? 'drop-shadow(0 0 3px #fff3cf) drop-shadow(0 0 8px #f5b731)'
            : isikta
              ? 'drop-shadow(0 0 6px rgba(245,183,49,0.8))'
              : undefined,
          // Vurulmuş ya da henüz açılmamış kamp solgun: oyuncu nereye
          // kadar geldiğini haritaya bakarak görmeli.
          opacity: g.acik ? 1 : 0.4,
          // Kilitli kamp GRİ, yenilenen kamp renkli ama solgun — ikisi
          // farklı şey söylüyor: "burası sana kapalı" ve "burayı vurdun".
          ...(g.acik || bekliyor ? {} : { filter: 'grayscale(1)' }),
        }}
      />
      <span
        className={`tabular absolute bottom-[1%] left-1/2 -translate-x-1/2 rounded-full px-1 text-[11px] leading-tight font-bold whitespace-nowrap ${
          bekliyor ? 'bg-gece/90 text-solgun' : 'bg-gece/90 text-altin'
        }`}
      >
        {bekliyor ? <GeriSayim bitis={g.yenilenirAt!} kisa /> : g.sef ? 'ŞEF' : g.grupNo}
      </span>
    </button>
  );
}

/**
 * Seçili gruba ordu gönderme kartı.
 *
 * Önizleme SUNUCUDAN geliyor ve gerçek savaşla aynı örnekleme motorunu
 * kullanıyor. İstemcide ayrı bir tahmin yazsaydık iki sayı er ya da geç
 * ayrışır, oyuncu "kazanırsın" yazan ekrana bakıp kaybederdi.
 */
function SeferKarti({
  lord,
  harita,
  grup,
  bekliyor,
  onGonder,
}: {
  lord: LordState;
  harita: AkinHaritaDurumu;
  grup: AkinGrupDurumu;
  bekliyor: boolean;
  onGonder: (army: Army) => void;
}) {
  // Varsayılan: evdeki ordunun tamamı. Oyuncunun ilk hamlesi neredeyse
  // her zaman bu ve tek tek sayı girmek gereksiz sürtünme.
  const [ordu, setOrdu] = useState<Army>(() => ({ ...lord.homeArmy }));
  const gonderilen = orduSayisi(ordu);

  const onizleme = useQuery({
    queryKey: ['akin-onizleme', harita.key, grup.grupNo, JSON.stringify(ordu)],
    queryFn: () => api.akinOnizleme({ haritaKey: harita.key, grupNo: grup.grupNo, army: ordu }),
    enabled: gonderilen > 0,
  });

  return (
    <Kart className="border-altin/40 p-3">
      <div className="flex items-baseline justify-between gap-2" data-akin-sefer>
        <span className="baslik text-[14px] text-altin">{grup.ad}</span>
        <span className="text-[11.5px] text-solgun">{harita.ad}</span>
      </div>

      {/* Karşındaki ordu AÇIKÇA yazılı: taş-kağıt-makas ancak düşmanı
          görünce bir karar olur (docs/09 K1). */}
      <p className="mt-1 text-[12px] text-solgun">Karşında: {orduYazisi(grup.garnizon)}</p>

      <div className="mt-2 space-y-1.5">
        {UNIT_TYPES.filter((u) => (lord.homeArmy[u] ?? 0) > 0).map((u) => (
          <BirimSatiri
            key={u}
            tur={u}
            evdeki={lord.homeArmy[u] ?? 0}
            deger={ordu[u] ?? 0}
            onDegis={(n) => setOrdu((o) => ({ ...o, [u]: n }))}
          />
        ))}
        {orduSayisi(lord.homeArmy) === 0 && (
          <p className="text-[12px] text-kirmizi">Evde asker yok. Önce Kışla'da asker eğit.</p>
        )}
      </div>

      {/* --- Önizleme: ne olacağını gitmeden söyle --- */}
      {gonderilen > 0 && onizleme.data && (
        <div className="oyuk mt-2.5 rounded-lg p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-solgun">Kazanma ihtimali</span>
            <span
              className="tabular text-[15px] font-semibold"
              style={{
                color:
                  onizleme.data.kazanmaOrani >= 0.8
                    ? 'var(--color-yesil)'
                    : onizleme.data.kazanmaOrani >= 0.5
                      ? 'var(--color-altin)'
                      : 'var(--color-kirmizi)',
              }}
              data-akin-ihtimal
            >
              %{Math.round(onizleme.data.kazanmaOrani * 100)}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-solgun">
            Tahmini kayıp: {formatSayi(orduSayisi(onizleme.data.tahminiKayip))} asker ·{' '}
            <IkonSure boyut={11} /> {formatKalan(onizleme.data.sureSn * 1000)}
          </p>
          <p className="mt-1 text-[11.5px] text-solgun">
            Kazanırsan: <IkonAltin boyut={11} /> {formatSayi(grup.odul.altin)} ·{' '}
            <IkonDemir boyut={11} /> {formatSayi(grup.odul.demir)} · <IkonErzak boyut={11} />{' '}
            {formatSayi(grup.odul.erzak)}
          </p>
          <p className="mt-0.5 text-[11.5px] text-sonuk">
            %{Math.round(grup.ekipmanIhtimali * 100)} ihtimalle T{grup.ekipmanTier} ekipman düşer.
          </p>
        </div>
      )}

      <div className="mt-2.5">
        <Buton
          tam
          isaret="akina-cik"
          disabled={bekliyor || gonderilen === 0}
          onClick={() => onGonder(ordu)}
        >
          {bekliyor ? 'Gönderiliyor…' : `Akına çık · ${formatSayi(gonderilen)} asker`}
        </Buton>
      </div>
    </Kart>
  );
}

/** Tek birim satırı: kaydırıcı + sayı. */
function BirimSatiri({
  tur,
  evdeki,
  deger,
  onDegis,
}: {
  tur: UnitType;
  evdeki: number;
  deger: number;
  onDegis: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 truncate text-[12px] text-solgun">{unitName(tur)}</span>
      <input
        type="range"
        min={0}
        max={evdeki}
        value={Math.min(deger, evdeki)}
        onChange={(e) => onDegis(Number(e.target.value))}
        className="min-w-0 flex-1 accent-[var(--color-altin)]"
        aria-label={`${unitName(tur)} adedi`}
      />
      <span className="tabular w-12 shrink-0 text-right text-[12px] text-parsomen">
        {formatSayi(Math.min(deger, evdeki))}
      </span>
    </div>
  );
}
