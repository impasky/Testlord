/** Harita — 61 bölge, alt sayfada bölge detayı, garnizon ve saldırı. */
import { B, UNIT_TYPES, formatArmy, unitName, type Army, type UnitType } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError, api, type LordState, type PreviewDto, type QueueItem } from '../api/client';
import { HexHarita } from '../components/HexHarita';
import { BirimIkonu, BolgeIkonu, IkonKapali, IkonSure } from '../components/Ikonlar';
import { SavasRaporu } from '../components/SavasRaporu';
import {
  Bolum,
  Buton,
  EngelNotu,
  Input,
  Kart,
  KuyrukSeridi,
  Rozet,
  formatKalan,
  formatSayi,
  kaynakEngeli,
} from '../components/ui';

const BOLGE_LIMITI = B.kuyruklar.es_zamanli.upgrade_region;

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
function BolgeAfisi({ tip, ad }: { tip: string; ad: string }) {
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
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-panel to-transparent" />
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
      // Bırakılan bölgenin paneli açık kalırsa artık senin olmayan bir
      // bölgenin sahip arayüzünü gösterirdi.
      if (degisken.anahtar.startsWith('birak:')) kapat();
      tazele();
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.'),
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

  if (harita.isLoading || !harita.data) {
    return <p className="pt-6 text-center text-solgun">Harita açılıyor...</p>;
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

  async function onizle() {
    if (!bolge) return;
    setHata(null);
    try {
      setOnizleme(await api.preview(bolge.id, saldiriOrdusu));
    } catch (e) {
      setHata(e instanceof ApiError ? e.message : 'Önizleme alınamadı.');
    }
  }

  async function saldir() {
    if (!bolge) return;
    setHata(null);
    setBilgi(null);
    try {
      const r = await api.march(bolge.id, saldiriOrdusu);
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
      <Bolum
        baslik="Dünya Haritası"
        yan={
          <span className="text-[11px] text-solgun">
            Bölgen {benimSayi}/{harita.data.maxRegions}
          </span>
        }
      >
        <Kart className="p-2">
          <HexHarita
            regions={harita.data.regions}
            home={harita.data.home}
            seciliId={seciliId}
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
            <BolgeAfisi tip={bolge.type} ad={TIP_ADI[bolge.type] ?? bolge.type} />
            <div className="sticky top-0 z-10 border-b border-kenar bg-panel px-4 pt-3 pb-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-kenar" />
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-altin/15 text-altin">
                  <BolgeIkonu tip={bolge.type} boyut={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="baslik truncate text-[15px]">{bolge.name}</h2>
                  <p className="text-[11px] text-solgun">
                    {TIP_ADI[bolge.type]} · Sv {bolge.level} ·{' '}
                    {bolge.owner ? bolge.owner.name : 'sahipsiz'}
                  </p>
                </div>
                <button onClick={kapat} className="bas shrink-0 text-solgun">
                  <IkonKapali boyut={20} />
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {bolge.type === 'taht' && (
                  <Rozet renk="var(--color-altin)">
                    {bolge.owner ? `DİYARIN LORDU · ${bolge.owner.name}` : 'TAHT BOŞ'}
                  </Rozet>
                )}
                <Rozet renk="var(--color-mavi)">{bolge.distance} HEX</Rozet>
                <Rozet renk="var(--color-kirmizi)">
                  TAHKİMAT +%{Math.round(bolge.fortressBonus * 100)}
                </Rozet>
                <Rozet renk="var(--color-yesil)">GELİR ×{bolge.incomeMult}</Rozet>
              </div>
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

              {bolge.isMine ? (
                <>
                  {bolge.store && (
                    <Kart className="p-3">
                      <h3 className="baslik mb-1 text-[11px] text-solgun">Yağmalanabilir depo</h3>
                      <p className="tabular text-[12px]">
                        {formatSayi(bolge.store.altin)} altın · {formatSayi(bolge.store.demir)} demir
                        · {formatSayi(bolge.store.erzak)} erzak
                      </p>
                    </Kart>
                  )}

                  {bolge.upgradeCost &&
                    (() => {
                      const engel =
                        bolgeKuyrugu.length >= BOLGE_LIMITI
                          ? {
                              kisa: 'Yükseltme kuyruğu dolu',
                              uzun: `Aynı anda en fazla ${BOLGE_LIMITI} bölge yükseltilebilir. Biri bitmeden yenisi başlamaz.`,
                            }
                          : kaynakEngeli(bolge.upgradeCost, lord.resources);
                      const anahtar = `upgrade:${bolge.id}`;
                      return (
                        <Kart className="p-3">
                          <Buton
                            onClick={() =>
                              mut.mutate({ anahtar, f: () => api.upgradeRegion(bolge.id) })
                            }
                            disabled={gonderilen === anahtar || engel !== null}
                            tam
                          >
                            {gonderilen === anahtar
                              ? 'Gönderiliyor…'
                              : `Seviye ${bolge.level + 1}'e yükselt`}
                          </Buton>
                          <p className="tabular mt-1.5 text-center text-[10px] text-sonuk">
                            <span
                              className={
                                bolge.upgradeCost!.altin > lord.resources.altin ? 'text-kirmizi' : ''
                              }
                            >
                              {formatSayi(bolge.upgradeCost!.altin)} altın
                            </span>
                            {' · '}
                            <span
                              className={
                                bolge.upgradeCost!.demir > lord.resources.demir ? 'text-kirmizi' : ''
                              }
                            >
                              {formatSayi(bolge.upgradeCost!.demir)} demir
                            </span>
                            {' · '}
                            {formatKalan(bolge.upgradeCost!.sec * 1000)}
                          </p>
                          {engel && <EngelNotu kisa={engel.kisa} uzun={engel.uzun} />}
                          <KuyrukSeridi
                            kuyruklar={bolgeKuyrugu.filter((q) => q.payload.regionId === bolge.id)}
                            etiket="Yükseltiliyor"
                          />
                        </Kart>
                      );
                    })()}

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

                  {onizleme && (
                    <div className="oyuk mt-3 rounded-xl p-3">
                      <p className="baslik text-[13px]">
                        Tahmin:{' '}
                        <span
                          className={
                            onizleme.tahmin.kazanan === 'attacker' ? 'text-yesil' : 'text-kirmizi'
                          }
                        >
                          {onizleme.tahmin.kazanan === 'attacker' ? 'ZAFER' : 'YENİLGİ'}
                        </span>
                        {onizleme.tahmin.eleGecirir && (
                          <span className="text-altin"> · BÖLGE ELE GEÇER</span>
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-solgun">
                        Tahmini kaybın: {formatArmy(onizleme.tahmin.saldiranKayip)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-solgun">
                        Yürüyüş: {formatKalan(onizleme.marchSec * 1000)}
                      </p>
                      <p
                        className={`mt-1 text-[10px] ${
                          onizleme.istihbaratKesin ? 'text-yesil' : 'text-turuncu'
                        }`}
                      >
                        {onizleme.not}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Buton tur="sessiz" onClick={onizle} disabled={secimBos} className="flex-1">
                      Önizle
                    </Buton>
                    <Buton onClick={saldir} disabled={saldiriEngeli !== null} className="flex-1">
                      Saldır
                    </Buton>
                  </div>

                  {saldiriEngeli && (
                    <EngelNotu kisa={saldiriEngeli.kisa} uzun={saldiriEngeli.uzun} />
                  )}
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
