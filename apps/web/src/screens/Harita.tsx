/** Harita — 61 bölge, alt sayfada bölge detayı, garnizon ve saldırı. */
import {
  B,
  UNIT_TYPES,
  bolgeAsamaAdi,
  formatArmy,
  regionIncome,
  unitName,
  type Army,
  type UnitType,
} from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, api, type LordState, type PreviewDto, type QueueItem } from '../api/client';
import { HexHarita } from '../components/HexHarita';
import { BirimIkonu, IkonKapali, IkonSure } from '../components/Ikonlar';
import { hisAgir, hisOnay, hisRet } from '../components/hisGeriBildirimi';
import { DunyaBasligi, OlaySeridi } from '../components/DunyaSeridi';
import { SaldiriOnizleme } from '../components/SaldiriOnizleme';
import { SavasRaporu } from '../components/SavasRaporu';
import {
  Bolum,
  Buton,
  EngelNotu,
  Input,
  Iskelet,
  Fark,
  Hap,
  Kart,
  KuyrukSeridi,
  SonucSatiri,
  formatKalan,
  formatSayi,
  kaynakEngeli,
} from '../components/ui';

const BOLGE_LIMITI = B.kuyruklar.es_zamanli.upgrade_region;

const GELIR_ADI = { altin: 'altın', demir: 'demir', erzak: 'erzak' } as const;

const TIP_ADI: Record<string, string> = {
  tarla: 'Tarla',
  maden: 'Maden',
  sehir: 'Şehir',
  kale: 'Kale',
  taht: 'Taht Kalesi',
};

/**
 * Bölge alt sayfasının tepesindeki manzara afişi.
 *
 * Gorsel bileşenini kullanmıyor: orada illüstrasyon yoksa ikon gösteriliyor,
 * burada ise hiçbir şey gösterilmemeli — küçük bir ikonu afiş yüksekliğine
 * germek, afişi hiç koymamaktan kötü durur. Görsel gelene kadar yükseklik
 * sıfır tutulur ki illüstrasyonu olmayan bölgelerde boşluk zıplaması olmasın.
 *
 * Oran 3/2: kaynak görseller kare ve kompozisyonları ortalı. Daha dar bir
 * şeride (16/9 ya da sabit 112px) kırpınca tarlanın ambarı, kalenin
 * kuleleri, taht salonunun tacı kadraj dışında kalıyordu — geriye sadece
 * bir doku şeridi kalıyor. 3/2 karenin üçte ikisini koruyor ve afiş
 * kaydırılınca yukarı çıktığı için alt sayfayı boğmuyor.
 */
function BolgeAfisi({
  tip,
  ad,
  ustyazi,
}: {
  tip: string;
  ad: string;
  /** Görselin üstüne binen başlık: bölgenin adı ve gelişim aşaması. */
  ustyazi?: ReactNode;
}) {
  const [durum, setDurum] = useState<'bekliyor' | 'var' | 'yok'>('bekliyor');

  if (durum === 'yok') return null;

  return (
    <div
      className={`relative overflow-hidden ${durum === 'var' ? 'aspect-[3/2]' : 'h-0'}`}
    >
      <img
        src={`/gorseller/bolgeler/${tip}.webp`}
        alt={ad}
        className="h-full w-full object-cover"
        // Ortadan değil, biraz yukarıdan kırpar: kare kaynaklarda ilgi çeken
        // öğe (ambar, kule, taht) üst yarıda, alt yarı çoğunlukla zemin.
        style={{ objectPosition: 'center 18%' }}
        loading="lazy"
        decoding="async"
        onLoad={() => setDurum('var')}
        onError={() => setDurum('yok')}
      />
      {/* Alt kenarı panele eritir; afişin sert kesimi başlık satırına bitişik durmasın. */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-panel via-panel/80 to-transparent" />

      {/* Ad ve aşama görselin ÜSTÜNDE durur. Altında ayrı bir satırda
          dururken görsel dekor gibi kalıyordu; üstüne binince illüstrasyon
          bölgenin PORTRESİ oluyor ve oyuncu "oradaymış" gibi hissediyor.
          (docs/08 İ10) */}
      {ustyazi && <div className="absolute inset-x-0 bottom-0 px-4 pb-3">{ustyazi}</div>}
    </div>
  );
}

function OrduSecici({
  mevcut,
  secim,
  onDegis,
  etiket,
}: {
  mevcut: Army;
  secim: Army;
  onDegis: (a: Army) => void;
  etiket: string;
}) {
  const gorunen = UNIT_TYPES.filter((t) => (mevcut[t] ?? 0) > 0 || (secim[t] ?? 0) > 0);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="baslik text-[11px] text-solgun">{etiket}</h4>
        {gorunen.length > 0 && (
          <button
            onClick={() => onDegis(Object.fromEntries(gorunen.map((t) => [t, mevcut[t] ?? 0])))}
            className="baslik text-[10px] text-altin"
          >
            Hepsi
          </button>
        )}
      </div>
      {gorunen.length === 0 ? (
        <p className="text-[12px] text-solgun">Evde asker yok. Önce Kışla'da eğit.</p>
      ) : (
        <ul className="space-y-1.5">
          {gorunen.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="shrink-0 text-altin/70">
                <BirimIkonu tip={t} boyut={18} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px]">{unitName(t)}</span>
              <span className="tabular shrink-0 text-[11px] text-sonuk">/{mevcut[t] ?? 0}</span>
              <Input
                type="number"
                min={0}
                max={mevcut[t] ?? 0}
                value={secim[t] ?? 0}
                onChange={(e) =>
                  onDegis({
                    ...secim,
                    [t]: Math.max(0, Math.min(mevcut[t] ?? 0, Number(e.target.value) || 0)),
                  })
                }
                className="w-20 py-1.5 text-center text-[12px]"
                inputMode="numeric"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Harita({
  lord,
  queues,
  baslangicBolge,
  onBaslangicIslendi,
  onGuncelle,
}: {
  lord: LordState;
  queues: QueueItem[];
  /** Başka ekrandan gelen hedef (karşı saldırı) — açılışta seçili gelir. */
  baslangicBolge: number | null;
  onBaslangicIslendi: () => void;
  onGuncelle: () => void;
}) {
  const lordId = lord.id;
  const qc = useQueryClient();
  const [seciliId, setSeciliId] = useState<number | null>(baslangicBolge);
  const [rapor, setRapor] = useState<string | null>(null);
  // Tek bayrak alt sayfadaki bütün düğmeleri birden söndürüyordu.
  const [gonderilen, setGonderilen] = useState<string | null>(null);
  const [saldiriOrdusu, setSaldiriOrdusu] = useState<Army>({});
  const [garnizon, setGarnizon] = useState<Army>({});
  const [onizleme, setOnizleme] = useState<PreviewDto | null>(null);
  const [onizlemeBekliyor, setOnizlemeBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const harita = useQuery({ queryKey: ['map'], queryFn: api.map });
  const army = useQuery({ queryKey: ['army'], queryFn: api.army });
  const marches = useQuery({ queryKey: ['marches'], queryFn: api.marches, refetchInterval: 15_000 });
  const detay = useQuery({
    queryKey: ['region', seciliId],
    queryFn: () => api.region(seciliId!),
    enabled: seciliId !== null,
  });
  // Diğer sorguların yanında duruyor, aşağıda değil: bu bileşen harita
  // yüklenene kadar erken dönüyor ve o dönüşten sonra çağrılan bir hook
  // "Rendered more hooks than during the previous render" hatası veriyor.
  // enabled ile ağ isteği yine sadece alt sayfa açıkken yapılıyor.
  const dunya = useQuery({ queryKey: ['dunya'], queryFn: api.dunya });
  const savaslar = useQuery({
    queryKey: ['battles'],
    queryFn: () => api.battles(),
    enabled: seciliId !== null,
  });

  const tazele = () => {
    void qc.invalidateQueries({ queryKey: ['map'] });
    void qc.invalidateQueries({ queryKey: ['army'] });
    void qc.invalidateQueries({ queryKey: ['marches'] });
    if (seciliId !== null) void qc.invalidateQueries({ queryKey: ['region', seciliId] });
    onGuncelle();
  };

  const mut = useMutation({
    mutationFn: async ({ f }: { f: () => Promise<unknown>; anahtar: string }) => f(),
    onMutate: ({ anahtar }) => setGonderilen(anahtar),
    onSuccess: (_v, degisken) => {
      setHata(null);
      hisOnay();
      // Bırakılan bölgenin paneli açık kalırsa artık senin olmayan bir
      // bölgenin sahip arayüzünü gösterirdi.
      if (degisken.anahtar.startsWith('birak:')) kapat();
      tazele();
    },
    onError: (e) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.');
    },
    onSettled: () => setGonderilen(null),
  });

  const bolgeKuyrugu = queues.filter((q) => q.kind === 'upgrade_region');

  // Karşı saldırı ekranı bu sekmeye getirdiyse bölgeyi aç ve isteği tüket;
  // tüketmezsek oyuncu paneli kapattığında hemen yeniden açılırdı.
  useEffect(() => {
    if (baslangicBolge === null) return;
    setSeciliId(baslangicBolge);
    onBaslangicIslendi();
  }, [baslangicBolge, onBaslangicIslendi]);

  // Önizleme artık ayrı bir düğme değil: ordu seçilir seçilmez hesaplanır.
  // Ayrı düğme, "ne kazanacağımı görmek" ile "saldırmak" arasına gereksiz
  // bir adım koyuyordu ve oyuncuların çoğu o adımı atlayıp sonucu hiç
  // görmeden saldırıyordu. (docs/08 İ1)
  const hedefId = detay.data?.id ?? null;
  const hedefBenim = detay.data?.isMine ?? false;
  const orduAnahtari = JSON.stringify(saldiriOrdusu);
  useEffect(() => {
    if (hedefId === null || hedefBenim) return;
    const ordu = JSON.parse(orduAnahtari) as Army;
    if (UNIT_TYPES.every((t) => (ordu[t] ?? 0) === 0)) {
      setOnizleme(null);
      return;
    }
    let iptal = false;
    setOnizlemeBekliyor(true);
    // Sürgü her oynadığında istek atmamak için kısa gecikme.
    const zaman = setTimeout(() => {
      api
        .preview(hedefId, ordu)
        .then((p) => {
          if (!iptal) setOnizleme(p);
        })
        .catch(() => {
          if (!iptal) setOnizleme(null);
        })
        .finally(() => {
          if (!iptal) setOnizlemeBekliyor(false);
        });
    }, 300);
    return () => {
      iptal = true;
      clearTimeout(zaman);
      setOnizlemeBekliyor(false);
    };
  }, [hedefId, hedefBenim, orduAnahtari]);

  if (harita.isLoading || !harita.data) {
    return <Iskelet satir={3} />;
  }

  const bolge = detay.data;
  const bolgeSavaslari = (savaslar.data ?? []).filter((b) => b.regionId === seciliId).slice(0, 5);
  const evdeki = army.data?.home ?? {};
  const secimBos = UNIT_TYPES.every((t) => (saldiriOrdusu[t] ?? 0) === 0);

  /**
   * Saldırının neden yapılamadığı. Sunucu bunların hepsini zaten reddediyor;
   * fark, oyuncunun sebebi düğmeye basmadan ÖNCE görmesi. Sıra sunucudaki
   * kontrol sırasıyla aynı tutuldu.
   */
  const saldiriEngeli = (() => {
    if (!bolge) return null;
    if (lord.woundedUntil && new Date(lord.woundedUntil) > new Date()) {
      return {
        kisa: 'Lordun yaralı',
        uzun: 'İyileşene kadar saldıramazsın. Malikâne ekranında kalan süreyi görebilirsin.',
      };
    }
    // Taht Kalesi günlük limitten muaf (docs/01 §5) — sunucu da böyle
    // davranıyor. Burada muafiyeti atlamak, sunucunun izin verdiği bir
    // saldırıyı arayüzün kapatması demekti.
    const limitMuaf = bolge.type === 'taht' && B.korumalar.taht_kalesi_limitten_muaf;
    if (!limitMuaf && lord.dailyAttacks >= B.korumalar.gunluk_saldiri_limiti) {
      return {
        kisa: 'Günlük saldırı hakkın bitti',
        uzun: `Günde en fazla ${B.korumalar.gunluk_saldiri_limiti} saldırı yapabilirsin. Taht Kalesi bu limitten muaftır; yarın sıfırlanır.`,
      };
    }
    if (bolge.shielded) {
      return {
        kisa: 'Bölge kalkan altında',
        uzun: 'Yeni ele geçirilmiş ya da yeni oyuncuya ait bölgelere bir süre saldırılamaz.',
      };
    }
    if (secimBos) {
      return {
        kisa: 'Ordu seçmedin',
        uzun: 'Yukarıdan kaç birim göndereceğini seç.',
      };
    }
    return null;
  })();
  const benimSayi = harita.data.regions.filter((r) => r.isMine && r.type !== 'taht').length;

  function kapat() {
    setSeciliId(null);
    setSaldiriOrdusu({});
    setGarnizon({});
    setOnizleme(null);
    setHata(null);
    setBilgi(null);
  }

  async function saldir() {
    if (!bolge) return;
    setHata(null);
    setBilgi(null);
    try {
      const r = await api.march(bolge.id, saldiriOrdusu);
      hisAgir();
      setBilgi(
        `Ordu yola çıktı. Varış ${formatKalan(new Date(r.arriveAt).getTime() - Date.now())} sonra.` +
          (r.uyari ? ` ${r.uyari}` : ''),
      );
      setSaldiriOrdusu({});
      setOnizleme(null);
      tazele();
    } catch (e) {
      setHata(e instanceof ApiError ? e.message : 'Saldırı başlatılamadı.');
    }
  }

  return (
    <div className="space-y-4 pt-3">
      {/* Başlık "Dünya Haritası" değil diyarın ADI: oyuncu gördüğü 61
          hex'in bir dünyanın parçası olduğunu ilk bakışta anlamalı. Kaç
          lord olduğu ve tahtın kimde olduğu hemen altında. (docs/08 İ5) */}
      <Bolum
        baslik={dunya.data?.ad ?? 'Dünya Haritası'}
        yan={
          <span className="text-[11px] text-solgun">
            Bölgen {benimSayi}/{harita.data.maxRegions}
          </span>
        }
      >
        {dunya.data && (
          <div className="mb-2 px-1">
            <DunyaBasligi dunya={dunya.data} />
          </div>
        )}
        <Kart className="p-2">
          <HexHarita
            regions={harita.data.regions}
            home={harita.data.home}
            seciliId={seciliId}
            yuruyusler={marches.data ?? []}
            onSec={(id) => {
              setSeciliId(id);
              setSaldiriOrdusu({});
              setGarnizon({});
              setOnizleme(null);
              setHata(null);
              setBilgi(null);
            }}
          />
          <div className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-sonuk">
            <span>Çapraz = senin</span>
            <span>Noktalı = düşman</span>
            <span>Düz = sahipsiz</span>
            <span>⛨ korumalı</span>
          </div>
        </Kart>

        {/* Haritanın altındaki boşluk, oyuncunun "tek oyunculu mu bu"
            sorusunu soran boşluktu. Diyarda olup bitenler oraya konuyor;
            savaş yoksa şerit hiç görünmüyor, sahte hareket üretilmiyor. */}
        <div className="mt-3">
          <OlaySeridi onBolgeAc={setSeciliId} />
        </div>
      </Bolum>

      {(marches.data?.length ?? 0) > 0 && (
        <Bolum baslik="Yürüyüşler">
          <div className="space-y-2">
            {marches.data?.map((m) => (
              <Kart key={m.id} className="p-3" vurgu={m.kind === 'attack' ? 'var(--color-turuncu)' : 'var(--color-yesil)'}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {m.kind === 'attack' ? 'Saldırı' : 'Dönüş'} →{' '}
                    {harita.data.regions.find((r) => r.id === m.toRegionId)?.name}
                  </span>
                  <span className="tabular flex shrink-0 items-center gap-1 text-[12px] text-altin">
                    <IkonSure boyut={13} />
                    {formatKalan(new Date(m.arriveAt).getTime() - Date.now())}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-sonuk">{formatArmy(m.army)}</p>
                {m.kind === 'attack' && (
                  <Buton
                    tur="anahat"
                    boy="kucuk"
                    className="mt-2"
                    onClick={() =>
                      mut.mutate({ anahtar: `recall:${m.id}`, f: () => api.recallMarch(m.id) })
                    }
                    disabled={gonderilen === `recall:${m.id}`}
                  >
                    Geri çağır
                  </Buton>
                )}
              </Kart>
            ))}
          </div>
        </Bolum>
      )}

      {/* ---- Bölge alt sayfası ---- */}
      {bolge && (
        <>
          <button className="fixed inset-0 z-40 bg-black/70" onClick={kapat} aria-label="Kapat" />
          <div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[82dvh] max-w-lg overflow-y-auto rounded-t-2xl border-t border-kenar bg-panel"
            style={{ paddingBottom: 'calc(var(--alt-bar) + 12px)' }}
          >
            <BolgeAfisi
              tip={bolge.type}
              ad={TIP_ADI[bolge.type] ?? bolge.type}
              ustyazi={
                <>
                  <h2
                    className="baslik text-[22px] leading-tight text-parsomen"
                    style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
                  >
                    {bolge.name}
                  </h2>
                  <p
                    className="text-[13px] text-altin"
                    style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
                  >
                    {bolgeAsamaAdi(bolge.type, bolge.level)}
                    {bolge.owner && (
                      <span className="text-parsomen/80">
                        {' · '}
                        {bolge.isMine ? 'senin' : bolge.owner.name}
                      </span>
                    )}
                    {!bolge.owner && <span className="text-parsomen/70"> · sahipsiz</span>}
                  </p>
                </>
              }
            />
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-kenar bg-panel px-4 py-2">
              <div className="flex flex-wrap gap-1.5">
                {bolge.type === 'taht' && (
                  <Hap renk="var(--color-altin)">
                    {bolge.owner ? `Diyarın Lordu · ${bolge.owner.name}` : 'taht boş'}
                  </Hap>
                )}
                <Hap renk="var(--color-mavi)">{bolge.distance} hex</Hap>
                {bolge.fortressBonus > 0 && (
                  <Hap renk="var(--color-kirmizi)">
                    tahkimat +%{Math.round(bolge.fortressBonus * 100)}
                  </Hap>
                )}
              </div>
              <button onClick={kapat} className="bas shrink-0 text-solgun" aria-label="Kapat">
                <IkonKapali boyut={20} />
              </button>
            </div>

            <div className="space-y-3 px-4 pt-3">
              {bolge.type === 'taht' && (
                <Kart className="p-3" vurgu="var(--color-altin)">
                  <h3 className="baslik mb-1 text-[11px] text-altin">Taht Kalesi</h3>
                  <p className="text-[12px] text-solgun">
                    Diyarda tek. Sahibi %
                    {Math.round(B.taht_kalesi.unvan_sohret_bonusu * 100)} şöhret bonusu alır,
                    bölge limitine sayılmaz. Buraya saldırmak günlük hakkından düşmez ve el
                    değiştirdikten sonra kalkanı yalnızca {B.taht_kalesi.kaybetme_korumasi_saat}{' '}
                    saat sürer.
                  </p>
                </Kart>
              )}

              {bolge.isMine ? (
                <>
                  {/*
                    Geliştirme kartı.

                    Oyuncu "bölgeyi ele geçirdim ama şehri geliştiremiyorum"
                    diyordu; oysa geliştirebiliyordu — arayüz ona "Seviye 2'ye
                    yükselt" diyordu. Bir yeri geliştirmek, o yerin AD
                    DEĞİŞTİRMESİYLE hissedilir: Kasaba'nın Pazar Şehri olması,
                    "seviye 2" olmasından bambaşka bir şey. Mekanik aynı,
                    anlatım değişti. (docs/08 İ10)
                  */}
                  {bolge.upgradeCost ? (
                    (() => {
                      const engel =
                        bolgeKuyrugu.length >= BOLGE_LIMITI
                          ? {
                              kisa: 'Geliştirme kuyruğu dolu',
                              uzun: `Aynı anda en fazla ${BOLGE_LIMITI} bölge geliştirilebilir. Biri bitmeden yenisi başlamaz.`,
                            }
                          : kaynakEngeli(bolge.upgradeCost, lord.resources);
                      const anahtar = `upgrade:${bolge.id}`;
                      const sonrakiAd = bolgeAsamaAdi(bolge.type, bolge.level + 1);
                      const simdi = regionIncome(bolge.type, bolge.level, bolge.incomeMult);
                      const sonra = regionIncome(bolge.type, bolge.level + 1, bolge.incomeMult);
                      return (
                        <Kart className="p-3" vurgu="var(--color-altin)">
                          <h3 className="baslik mb-2 text-[11px] text-solgun">Geliştirme</h3>

                          <div className="flex flex-wrap items-center gap-2 text-[14px]">
                            <span className="baslik text-solgun">
                              {bolgeAsamaAdi(bolge.type, bolge.level)}
                            </span>
                            <span className="text-sonuk">→</span>
                            <span className="baslik text-altin">{sonrakiAd}</span>
                          </div>

                          <div className="mt-2 space-y-0.5">
                            {(['altin', 'demir', 'erzak'] as const)
                              .filter((k) => Math.round(sonra[k]) > 0)
                              .map((k) => (
                                <SonucSatiri key={k} etiket={`Saatlik ${GELIR_ADI[k]}`}>
                                  <Fark
                                    oncesi={Math.round(simdi[k])}
                                    sonrasi={Math.round(sonra[k])}
                                  />
                                </SonucSatiri>
                              ))}
                            {sonra.sohret > 0 && (
                              <SonucSatiri etiket="Saatlik şöhret">
                                <Fark
                                  oncesi={Math.round(simdi.sohret)}
                                  sonrasi={Math.round(sonra.sohret)}
                                />
                              </SonucSatiri>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Hap
                              renk={
                                bolge.upgradeCost!.altin > lord.resources.altin
                                  ? 'var(--color-kirmizi)'
                                  : 'var(--color-kaynak-altin)'
                              }
                            >
                              {formatSayi(bolge.upgradeCost!.altin)} altın
                            </Hap>
                            <Hap
                              renk={
                                bolge.upgradeCost!.demir > lord.resources.demir
                                  ? 'var(--color-kirmizi)'
                                  : 'var(--color-kaynak-demir)'
                              }
                            >
                              {formatSayi(bolge.upgradeCost!.demir)} demir
                            </Hap>
                            <Hap ikon={<IkonSure boyut={13} />}>
                              {formatKalan(bolge.upgradeCost!.sec * 1000)}
                            </Hap>
                          </div>

                          <Buton
                            className="mt-2.5"
                            boy="buyuk"
                            onClick={() =>
                              mut.mutate({ anahtar, f: () => api.upgradeRegion(bolge.id) })
                            }
                            disabled={gonderilen === anahtar || engel !== null}
                            tam
                          >
                            {gonderilen === anahtar ? 'Gönderiliyor…' : `${sonrakiAd} yap`}
                          </Buton>
                          {engel && <EngelNotu kisa={engel.kisa} uzun={engel.uzun} />}
                          <KuyrukSeridi
                            kuyruklar={bolgeKuyrugu.filter((q) => q.payload.regionId === bolge.id)}
                            etiket={`${sonrakiAd} oluyor`}
                          />
                        </Kart>
                      );
                    })()
                  ) : (
                    <Kart className="p-3">
                      <h3 className="baslik mb-1 text-[11px] text-solgun">Geliştirme</h3>
                      <p className="text-[12px] text-solgun">
                        {bolgeAsamaAdi(bolge.type, bolge.level)} — bu bölge en üst aşamada.
                      </p>
                    </Kart>
                  )}

                  {bolge.store && (
                    <Kart className="p-3">
                      <h3 className="baslik mb-1 text-[11px] text-solgun">Yağmalanabilir depo</h3>
                      <p className="tabular text-[12px]">
                        {formatSayi(bolge.store.altin)} altın · {formatSayi(bolge.store.demir)} demir
                        · {formatSayi(bolge.store.erzak)} erzak
                      </p>
                    </Kart>
                  )}

                  <Kart className="p-3">
                    <OrduSecici
                      mevcut={Object.fromEntries(
                        UNIT_TYPES.map((t) => [
                          t,
                          (evdeki[t] ?? 0) + ((bolge.garrison[t] as number) ?? 0),
                        ]),
                      )}
                      secim={Object.keys(garnizon).length ? garnizon : (bolge.garrison as Army)}
                      onDegis={setGarnizon}
                      etiket="Garnizon"
                    />
                    <Buton
                      className="mt-2.5"
                      tam
                      onClick={() =>
                        mut.mutate({
                          anahtar: 'garrison',
                          f: () => api.setGarrison(bolge.id, garnizon),
                        })
                      }
                      disabled={gonderilen === 'garrison' || Object.keys(garnizon).length === 0}
                    >
                      Garnizonu ayarla
                    </Buton>
                    <p className="mt-1.5 text-[10px] text-sonuk">
                      Bu bölgeyi sadece buradaki garnizon savunur.
                    </p>
                  </Kart>

                  {/* Taht bırakılamaz; diyarın tek endgame hedefi elden ancak
                      savaşla çıkar. Düğmeyi hiç göstermiyoruz. */}
                  {bolge.type !== 'taht' && (
                    <Kart className="border-kirmizi/30 p-3">
                      <h3 className="baslik mb-1 text-[11px] text-solgun">Bölgeyi bırak</h3>
                      <p className="text-[11px] text-solgun">
                        Bölge sahipsiz kalır, garnizondaki birlikler eve döner. Bakımı ağır gelen
                        ya da savunamadığın bir bölgeden böyle kurtulabilirsin.
                      </p>
                      <Buton
                        tur="kirmizi"
                        boy="kucuk"
                        className="mt-2.5"
                        onClick={() =>
                          mut.mutate({
                            anahtar: `birak:${bolge.id}`,
                            f: () => api.bolgeyiBirak(bolge.id),
                          })
                        }
                        disabled={gonderilen === `birak:${bolge.id}`}
                      >
                        {gonderilen === `birak:${bolge.id}` ? 'Bırakılıyor…' : 'Bu bölgeyi bırak'}
                      </Buton>
                    </Kart>
                  )}
                </>
              ) : (
                <Kart className="p-3">
                  <OrduSecici
                    mevcut={evdeki}
                    secim={saldiriOrdusu}
                    onDegis={(a) => {
                      setSaldiriOrdusu(a);
                      setOnizleme(null);
                    }}
                    etiket="Saldırı ordusu"
                  />

                  {onizleme ? (
                    <SaldiriOnizleme onizleme={onizleme} />
                  ) : (
                    !secimBos &&
                    onizlemeBekliyor && (
                      <p className="mt-3 text-[12px] text-solgun">Sonuç hesaplanıyor…</p>
                    )
                  )}

                  <Buton
                    className="mt-3"
                    boy="buyuk"
                    tam
                    onClick={saldir}
                    disabled={saldiriEngeli !== null}
                  >
                    Saldır
                  </Buton>

                  {saldiriEngeli && (
                    <EngelNotu kisa={saldiriEngeli.kisa} uzun={saldiriEngeli.uzun} />
                  )}
                </Kart>
              )}

              {bolge.garrisonVisible ? (
                <Kart className="p-3">
                  <h3 className="baslik mb-1.5 text-[11px] text-solgun">Garnizon</h3>
                  {Object.entries(bolge.garrison).filter(([, n]) => (n as number) > 0).length === 0 ? (
                    <p className="text-[12px] text-solgun">boş</p>
                  ) : (
                    <ul className="space-y-1">
                      {Object.entries(bolge.garrison)
                        .filter(([, n]) => (n as number) > 0)
                        .map(([t, n]) => (
                          <li key={t} className="flex items-center gap-2 text-[13px]">
                            <span className="text-altin/70">
                              <BirimIkonu tip={t} boyut={17} />
                            </span>
                            <span className="flex-1">{unitName(t as UnitType)}</span>
                            <span className="tabular font-bold">{n as number}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </Kart>
              ) : (
                <Kart className="p-3">
                  <p className="text-[11px] text-sonuk">
                    Düşman garnizonu görünmüyor. Casus Leyla kadrondayken tam bilgi alırsın.
                  </p>
                </Kart>
              )}

              {bolgeSavaslari.length > 0 && (
                <Kart className="p-3">
                  <h3 className="baslik mb-2 text-[11px] text-solgun">Bu Bölgedeki Savaşların</h3>
                  <ul className="space-y-1.5">
                    {bolgeSavaslari.map((b) => {
                      // Sonuç bakanın gözünden: aynı savaş saldıran için zafer,
                      // savunan için yenilgi.
                      const benimSaldirim = b.attackerLordId === lordId;
                      const kazandim = (b.result === 'attacker_win') === benimSaldirim;
                      return (
                        <li key={b.id}>
                          <button
                            className="bas flex w-full items-center gap-2 text-left text-[12px]"
                            onClick={() => setRapor(b.id)}
                          >
                            <span
                              className={`baslik w-16 shrink-0 ${
                                kazandim ? 'text-yesil' : 'text-kirmizi'
                              }`}
                            >
                              {kazandim ? 'ZAFER' : 'YENİLGİ'}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-solgun">
                              {benimSaldirim ? `→ ${b.defender?.name ?? 'garnizon'}` : `← ${b.attacker.name}`}
                            </span>
                            <time className="shrink-0 text-[10px] text-sonuk">
                              {new Date(b.createdAt).toLocaleString('tr-TR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Kart>
              )}

              {hata && (
                <Kart className="border-kirmizi/50 p-3">
                  <p className="text-[13px] text-kirmizi">{hata}</p>
                </Kart>
              )}
              {bilgi && (
                <Kart className="border-yesil/50 p-3">
                  <p className="text-[13px] text-yesil">{bilgi}</p>
                </Kart>
              )}
            </div>
          </div>
        </>
      )}

      {rapor && <SavasRaporu battleId={rapor} benimId={lordId} onKapat={() => setRapor(null)} />}
    </div>
  );
}
