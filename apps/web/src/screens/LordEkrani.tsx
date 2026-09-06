/**
 * Lord — oyunun ANA SAYFASI.
 *
 * Menüden çıkıp alt çubuğa yerleşti ve kendine ait olan her şeyin evi
 * oldu. Oyuncu referans bir oyunu göstererek anlatmıştı:
 *
 *   "bizde generaller ayrı bir sayfada; onun yerine oyuncunun kendi üstünü
 *    dizdiği, kontrol ettiği sayfa olan Lord sekmesini ana sayfaya
 *    çevirip oraya bir general bölümü eklenebilir. Orada o general kısmına
 *    tıklandığında oyuncu general sayfasına geçmez, general sayfası bir
 *    pop-up gibi açılır."
 *
 * Sonra rolleri de netleştirdi:
 *
 *   "ana sayfada her şeye erişimimiz olmalı, tüm yönlendirmeleri oradan
 *    yapabilmeliyiz. Malikâne'yi sahip olduğumuz arazi yönetimleri,
 *    ipuçları gibi içerikleri barındıran bir alana çevirip Lord sayfasını
 *    oyunun ana sayfası hâline getirirsek daha iyi olabilir."
 *
 * Öyle yapıldı. Oyuncu buraya iniyor ve buradan her yere gidiyor:
 *
 *   - kâhya ve omurga ("şimdi ne yapmalısın") — ekranın tepesinde,
 *   - ALTI kapının hepsi — general, demirhane, ittifak, olaylar, sıralama,
 *     hesap,
 *   - durum şeridi, görev özeti, kuyruklar,
 *   - ve lordun kendisi: unvan, nitelikler, ekipman, görünüş.
 *
 * Diyarın kendisi (topraklar, gelirleri, ipuçları) Malikâne'de kaldı.
 */
import {
  B,
  EQUIP_SLOTS,
  KAPILAR,
  KAPI_ADI,
  STAT_KEYS,
  type Kapi,
  type StatKey,
} from '@lordlar/shared';
import { useState } from 'react';
import { ApiError, api, type LordState } from '../api/client';
import {
  IkonCan,
  IkonKale,
  IkonKurnaz,
  IkonNavDemirhane,
  IkonNavGeneraller,
  IkonNavHarita,
  IkonNavKisla,
  IkonNavLord,
  IkonNavSiralama,
  IkonSaldiri,
  IkonSancak,
  IkonSohret,
  IkonSure,
  IkonUyari,
  IkonYer,
} from '../components/Ikonlar';
import {
  AltSekmeler,
  Bolum,
  Buton,
  DurumSiridi,
  GeriSayim,
  Hap,
  Ilerleme,
  Kart,
  Rozet,
  formatSayi,
  nadirlikRengi,
} from '../components/ui';
import { Gorsel } from '../components/Gorsel';
import { addanPortre } from '@lordlar/shared';
import { OrduSahnesi } from '../components/OrduSahnesi';
import { Arma } from '../components/Arma';
import { ArmaSecici } from '../components/ArmaSecici';
import { DiyarTanitimi } from '../components/DiyarTanitimi';
import { GorevOzeti } from '../components/GorevOzeti';
import { Omurga, useOmurgaAdimi } from '../components/Omurga';
import { Rehber } from '../components/Rehber';
import type { QueueItem, YoklukOzeti } from '../api/client';
import type { Sekme } from '../components/MobilKabuk';

const STAT: Record<StatKey, { ad: string; renk: string; etki: (n: number) => string }> = {
  guc: { ad: 'Güç', renk: 'var(--color-kirmizi)', etki: (n) => `Savaş katkısı +${n * 3}` },
  dayaniklilik: {
    ad: 'Dayanıklılık',
    renk: 'var(--color-yesil)',
    etki: (n) => `Can +${n * 25} · yaralanma −%${Math.min(50, n)}`,
  },
  liderlik: { ad: 'Liderlik', renk: 'var(--color-mavi)', etki: (n) => `Komuta ${50 + n * 8} yer` },
  kurnazlik: {
    ad: 'Kurnazlık',
    renk: 'var(--color-mor)',
    etki: (n) => `Yağma +%${Math.min(100, n)}`,
  },
};

const STAT_IKONU: Record<StatKey, typeof IkonSaldiri> = {
  guc: IkonSaldiri,
  dayaniklilik: IkonCan,
  liderlik: IkonYer,
  kurnazlik: IkonKurnaz,
};

const SLOT_ADI: Record<string, string> = {
  silah: 'Silah',
  kalkan: 'Kalkan',
  zirh: 'Zırh',
  migfer: 'Miğfer',
  at: 'At',
  sancak: 'Sancak',
};

/**
 * Kuyruk satırı ve "sen yokken" kartı — eskiden Malikâne'deydiler.
 *
 * Malikâne diyarın ekranı oldu (topraklar, ipuçları); "şu an ne oluyor"
 * bilgisi ana sayfaya, yani buraya taşındı.
 */
const KUYRUK_ADI: Record<string, string> = {
  train: 'Asker eğitimi',
  craft: 'Ekipman üretimi',
  upgrade_item: 'Ekipman yükseltme',
  upgrade_gear: 'Ordu donanımı',
  upgrade_region: 'Bölge yükseltme',
  kesif: 'Keşif',
};

function KuyrukSatiri({ q }: { q: QueueItem }) {
  const bas = new Date(q.startedAt).getTime();
  const bit = new Date(q.finishAt).getTime();
  const gecen = Math.max(0, Math.min(1, (Date.now() - bas) / (bit - bas)));
  return (
    <Kart className="p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate">
          {KUYRUK_ADI[q.kind] ?? q.kind}
          {typeof q.payload.count === 'number' && (
            <span className="ml-1.5 text-solgun">×{q.payload.count as number}</span>
          )}
        </span>
        <span className="shrink-0 text-[12px] text-altin">
          <GeriSayim bitis={q.finishAt} />
        </span>
      </div>
      <Ilerleme deger={gecen} max={1} renk="var(--color-altin)" boy="ince" />
    </Kart>
  );
}

/**
 * "Sen yokken ne oldu" kartı.
 *
 * Bekleme üzerine kurulu bir oyunda dönüş anı en önemli an. Önceden oyuncu
 * olay akışını kendisi taramak zorundaydı; şimdi ne kadar süre geçtiğini,
 * kaç olay ve kaç savaş olduğunu tek bakışta görüyor.
 */
function YoklukKarti({ y, onGit }: { y: YoklukOzeti; onGit: (s: Sekme) => void }) {
  const saat = Math.floor(y.sureSaniye / 3600);
  const dakika = Math.floor((y.sureSaniye % 3600) / 60);
  const sure = saat > 0 ? `${saat} saat ${dakika} dakika` : `${dakika} dakika`;

  return (
    <Kart className="p-3" vurgu="var(--color-mavi)">
      <h3 className="baslik mb-1 text-[12px] text-mavi">Sen yokken</h3>
      <p className="text-[13px] text-solgun">
        <span className="text-parsomen">{sure}</span> uzaktaydın. Bu sürede{' '}
        <span className="text-parsomen">{y.olaylar}</span> olay
        {y.savaslar > 0 && (
          <>
            {' '}
            ve <span className="text-kirmizi">{y.savaslar} savaş</span>
          </>
        )}{' '}
        oldu.
      </p>
      {y.savaslar > 0 && (
        <p className="mt-1 text-[11px] text-sonuk">
          Savaş raporlarını aşağıdaki olay akışından açabilirsin.
        </p>
      )}
      <Buton tur="sessiz" boy="kucuk" className="mt-2.5" onClick={() => onGit('harita')}>
        Haritaya bak
      </Buton>
    </Kart>
  );
}

/**
 * public/gorseller/lord/ altındaki portre sayısı.
 *
 * Elle yazılı bir sayı, çünkü tarayıcı klasörü listeleyemiyor. Dosya
 * eklenip bu sayı güncellenmezse yeni portre hiç seçilmez (sessiz ama
 * zararsız); sayı dosyalardan büyük olursa var olmayan bir dosya istenir
 * ve Gorsel yedeğe düşer — yine sessiz, yine zararsız.
 */
const PORTRE_SAYISI = 5;

/** Kapı düğmesinin simgesi ve altındaki tek satır. */
const KAPI_YUZU: Record<Kapi, { Ikon: typeof IkonNavLord; alt: (l: LordState) => string }> = {
  generaller: { Ikon: IkonNavGeneraller, alt: (l) => `${l.generalSlots} yuva` },
  demirhane: {
    Ikon: IkonNavDemirhane,
    alt: (l) => `${l.equippedItems.length}/${EQUIP_SLOTS.length} kuşanılı`,
  },
  arastirma: { Ikon: IkonKurnaz, alt: () => 'diyarını şekillendir' },
  ittifak: { Ikon: IkonSohret, alt: () => 'ortak hedef, sohbet' },
  olaylar: { Ikon: IkonSancak, alt: () => 'diyarda ne oldu' },
  siralama: { Ikon: IkonNavSiralama, alt: (l) => `${formatSayi(l.fame)} şöhret` },
  hesap: { Ikon: IkonNavLord, alt: () => 'parola, çıkış' },
};

export function LordEkrani({
  lord,
  queues,
  yokluk,
  onGuncelle,
  onGit,
  onKapiAc,
  onBolgeyiAc,
}: {
  lord: LordState;
  queues: QueueItem[];
  yokluk: YoklukOzeti | null;
  onGuncelle: () => void;
  onGit: (s: Sekme) => void;
  onKapiAc: (k: Kapi) => void;
  /** Bir bölgeyi haritada açar: omurganın hedefi. */
  onBolgeyiAc: (regionId: number) => void;
}) {
  const [dagitim, setDagitim] = useState<Record<StatKey, number>>({
    guc: 0,
    dayaniklilik: 0,
    liderlik: 0,
    kurnazlik: 0,
  });
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [sekme, setSekme] = useState<'guc' | 'gorunus'>('guc');

  /**
   * Omurganın "aynı ekranda şu bölüme git" isteği.
   *
   * Oyuncunun şikâyeti: "lord ekranındayım ama bana kocaman LORD EKRANI
   * git diyor." Omurga zaten bu sayfada duruyor; ekrana yollamak yerine
   * işin yapıldığı BÖLÜME götürüyor.
   *
   * Bölüm bir alt sekmenin içindeyse önce o sekme açılıyor: kaydırmak tek
   * başına yetmez, gizli bir bölüme kaydırmak hiçbir yere kaydırmamaktır.
   * Kaydırma sekme değişikliğinin boyanmasını beklesin diye bir kare
   * sonraya bırakılıyor.
   */
  function bolumeGit(bolumId: string) {
    if (bolumId === 'nitelikler') setSekme('guc');
    requestAnimationFrame(() => {
      document.getElementById(bolumId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const harcanan = STAT_KEYS.reduce((s, k) => s + dagitim[k], 0);
  const kalan = lord.statPoints - harcanan;

  async function onayla() {
    setHata(null);
    setBekliyor(true);
    try {
      await api.spendStats(dagitim);
      setDagitim({ guc: 0, dayaniklilik: 0, liderlik: 0, kurnazlik: 0 });
      onGuncelle();
    } catch (e) {
      setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.');
    } finally {
      setBekliyor(false);
    }
  }

  const kusanilan = new Map(lord.equippedItems?.map((i) => [i.slot, i]) ?? []);

  /**
   * İLK DÖNGÜ: oyuncu kaynak → asker → saldırı → bölge zincirini bir kez
   * tamamlamamış. Ana sayfanın ne kadarı gösterileceğini bu belirliyor
   * (docs/09, kademeli açılım).
   */
  const ilkDongu = lord.regionCount === 0;
  const yarali = lord.woundedUntil && new Date(lord.woundedUntil) > new Date();
  // Kâhya omurganın hesapladığı adımı okuyor; iki ayrı hesap olmasın diye
  // aynı kanca. Sorgular TanStack önbelleğinden, ikinci istek üretmiyor.
  const rehberAdimi = useOmurgaAdimi(lord, queues);

  return (
    <div className="space-y-4">
      {/* ---- Lordun kendisi ----
          Denetimin en büyük bulgusu buydu: oyunun adı "Lordlar Çağı" ve
          ana sayfada lord YOKTU. Ekranda tek bir görsel bile
          bulunmuyordu; oyuncu kendi lorduna değil bir tabloya bakıyordu.
          Portre addan türüyor (kimlik.ts → addanPortre), arma zaten
          öyleydi: ikisi de kayıtta yer tutmuyor ve hep aynı kalıyor. */}
      <Kart className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Gorsel
              tur="lord"
              ad={`lord_${addanPortre(lord.name, PORTRE_SAYISI)}`}
              alt={lord.name}
              boyut={56}
              className="rounded-xl"
              yedek={<IkonNavLord boyut={40} />}
            />
            {/* Arma portrenin köşesinde: ikisi tek bir kimlik. */}
            <span className="absolute -bottom-1 -right-1">
              <Arma arma={lord.arma} boyut={24} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="baslik truncate text-[16px] text-parsomen">{lord.name}</div>
            <div className="baslik text-[13px] text-altin">{lord.unvan.ad}</div>
            <p className="mt-0.5 text-[11px] leading-snug text-solgun">{lord.unvan.aciklama}</p>
          </div>
        </div>
      </Kart>

      {/* Ekranın tepesi artık bir sahne: lordun ordusu. Nitelik kartlarıyla
          açılmak, bu ekranı bir karakter sayfası değil bir form yapıyordu. */}
      <OrduSahnesi army={lord.homeArmy} komutaTavani={lord.commandCapacity} />

      {lord.starving && (
        <Kart className="border-kirmizi/60 p-3" vurgu="var(--color-kirmizi)">
          <div className="flex gap-2.5">
            <span className="shrink-0 text-kirmizi">
              <IkonUyari boyut={20} />
            </span>
            <div className="text-[13px]">
              <strong className="baslik text-kirmizi">Ordun aç</strong>
              <p className="mt-0.5 text-solgun">
                Erzak bitti, askerler saatte %5 firar ediyor. Tarla bölgesi al ya da ordunu küçült.
              </p>
            </div>
          </div>
        </Kart>
      )}

      {yarali && (
        <Kart className="border-turuncu/50 p-3" vurgu="var(--color-turuncu)">
          <div className="text-[13px]">
            <strong className="baslik text-turuncu">Lordun yaralı</strong>
            <p className="mt-0.5 text-solgun">
              İyileşmesine <GeriSayim bitis={lord.woundedUntil!} /> kaldı. Bu sürede saldıramazsın.
            </p>
          </div>
        </Kart>
      )}

      {yokluk && <YoklukKarti y={yokluk} onGit={onGit} />}

      {/* Kâhya omurganın ÜSTÜNDE: önce neden, sonra ne. Adımı omurgadan
          okuyor, kendi senaryosunu tutmuyor (docs/09 T4). */}
      <Rehber
        adim={rehberAdimi?.anahtar ?? null}
        bolgeSayisi={lord.regionCount}
        gorundu={lord.rehberGorundu}
      />
      <Omurga
        lord={lord}
        queues={queues}
        onGit={onGit}
        onKapiAc={onKapiAc}
        onHedefeGit={onBolgeyiAc}
        onBolumeGit={bolumeGit}
      />

      {/* Diyar tanıtımı omurganın ALTINDA.
          Üstteydi ve ölçünce görüldü ki yeni oyuncunun tek eylem düğmesi
          ("Kışlada okçu eğit") iki açıklama kartının altında, ekranın
          dışında kalıyordu. Oyuncu testinin "her şeyi üstümüze atıyor"
          cümlesinin somut hâli buydu: yapılacak şeye ulaşmak için iki
          metin bloğunu kaydırmak.
          Kartın KENDİ kapısı var (yepyeniMi): yalnız hiçbir şey yapmamış
          lorda görünüyor, ilk eylemden sonra kendiliğinden kayboluyor —
          bu yüzden ayrıca gizlenmesi gerekmiyor, yalnız sırası değişti.
          "Burası neresi" hâlâ cevaplanıyor, ama "şimdi ne yapmalıyım"
          cevabından sonra. */}
      <DiyarTanitimi lord={lord} queues={queues} />

      {/*
        Dört ayrı istatistik kartı yerine tek rozet satırı.
        Kartlar ekranın yarısını kaplıyor ve hepsi aynı ağırlıkta
        görünüyordu: yeni oyuncu "KOMUTA 0/90" ile "GÜNLÜK SALDIRI 0/12"
        arasında hangisinin önemli olduğunu ayırt edemiyordu. Rozet satırı
        aynı bilgiyi bir satırda veriyor ve omurgayı ekranın tepesinde
        tek büyük öğe olarak bırakıyor.
      */}
      {!ilkDongu && (
        <DurumSiridi>
          <Hap ikon={<IkonKale boyut={13} />} renk="var(--color-altin)">
            {lord.regionCount}/{lord.maxRegions} bölge
            {lord.ownsThrone && ' +Taht'}
          </Hap>
          {/* Komuta yeri BURADA YAZMIYOR: hemen yukarıdaki ordu sahnesi
            aynı sayıyı zaten söylüyor ("12/90 komuta"). Aynı bilgiyi tek
            ekranda iki kez göstermek, oyuncunun "her yerde bir şeyler
            yazıyor" şikâyetini büyütmekten başka işe yaramıyor. */}
          <Hap ikon={<IkonSancak boyut={13} />} renk="var(--color-yesil)">
            Sv {lord.level}
          </Hap>
          <Hap ikon={<IkonSure boyut={13} />}>
            {lord.dailyAttacks}/{B.korumalar.gunluk_saldiri_limiti} saldırı
          </Hap>
        </DurumSiridi>
      )}

      {/* Görev KANCASI, görevlerin kendisi değil: ayrıntı Görevler
          sayfasında. Ödül alınmayı bekliyorsa şerit yeşilleniyor —
          oyuncunun oraya gitmesi için tek gerçek sebep o. */}
      {!ilkDongu && <GorevOzeti onGit={() => onGit('gorevler')} />}

      {/* Boş kuyruk bölümü ilk döngüde de KALIYOR ve bu bilinçli — gizlemeyi
          denedim, iki şeyi birden bozdu. Boş hâlindeki üç düğme (Kışla,
          Demirhane, Harita) gürültü değil, docs/09 K7'nin ta kendisi:
          "yapacak bir şey yok ekranı olmasın, boş hâl bir sonraki işi
          göstersin". Ayrıca kart geç gelen kuyruk verisine bağlı gizlenince
          açılışta zıplama çıkıyordu (CLS 0.024 -> 0.222). */}
      <Bolum
        baslik={`Kuyruklar${queues.length ? ` · ${queues.length}` : ''}`}
        sakin={queues.length === 0}
      >
        {queues.length === 0 ? (
          <Kart sakin className="p-4">
            <p className="mb-3 text-[13px] text-solgun">Kuyruk boş. Bir şeyler başlat.</p>
            <div className="flex gap-2">
              <Buton tur="sessiz" boy="kucuk" onClick={() => onGit('kisla')}>
                <span className="mr-1.5 inline-block align-[-2px]">
                  <IkonNavKisla boyut={13} />
                </span>
                Kışla
              </Buton>
              <Buton tur="sessiz" boy="kucuk" onClick={() => onKapiAc('demirhane')}>
                <span className="mr-1.5 inline-block align-[-2px]">
                  <IkonNavDemirhane boyut={13} />
                </span>
                Demirhane
              </Buton>
              <Buton tur="sessiz" boy="kucuk" onClick={() => onGit('harita')}>
                <span className="mr-1.5 inline-block align-[-2px]">
                  <IkonNavHarita boyut={13} />
                </span>
                Harita
              </Buton>
            </div>
          </Kart>
        ) : (
          <div className="space-y-2">
            {queues.map((q) => (
              <KuyrukSatiri key={q.id} q={q} />
            ))}
          </div>
        )}
      </Bolum>

      {/* ---- Lordun kapıları ----
          Ayrı sayfalar değil: buradan panel olarak açılıyorlar ve
          kapanınca oyuncu yine burada oluyor. Her düğmenin altındaki tek
          satır, açmadan önce içeride ne olduğunu söylüyor — düz bir menü
          bağlantısı olmasınlar diye. */}
      <div className="grid grid-cols-3 gap-2">
        {KAPILAR.map((k, i) => {
          const yuz = KAPI_YUZU[k];
          // Son satırda TEK kart kalıyorsa satırı doldursun. Üç sütunlu
          // ızgarada yedinci kart soldan tek başına asılı duruyor ve
          // "eklenmiş" gibi görünüyor; sıranın tamamını kaplayınca
          // kasıtlı bir vurgu gibi okunuyor.
          const sonSatirdaYalniz = KAPILAR.length % 3 === 1 && i === KAPILAR.length - 1;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onKapiAc(k)}
              data-kapi={k}
              className={`bas flex flex-col items-center gap-1 rounded-2xl border-2 border-kenar bg-yuzey px-1 py-2.5 text-solgun ${
                sonSatirdaYalniz ? 'col-span-3' : ''
              }`}
            >
              <span className="text-altin">
                <yuz.Ikon boyut={24} />
              </span>
              <span className="baslik text-[11px] text-parsomen">{KAPI_ADI[k]}</span>
              {/* 11px taban: okunurluk denetimi bunun altını kabul etmiyor
                  ve haklı — bu satır düğmenin ne yaptığını söylüyor. */}
              <span className="text-[11px] leading-none text-sonuk">{yuz.alt(lord)}</span>
            </button>
          );
        })}
      </div>

      {/* Unvan: şöhretten türüyor, yeni sayaç yok (docs/10 §2.2). Taht
          sahibinin unvanını "Diyarın Lordu" eziyor. */}
      {/* Unvanın KENDİSİ yukarıdaki lord kartında; burada yalnız
          "sıradaki ne" kalıyor. Aynı bilgiyi iki kez göstermek, sayfayı
          uzatmaktan başka bir işe yaramıyordu. */}
      {lord.unvan.sonrakiAd && (
        <Kart className="p-3">
          <p className="text-[12px] text-solgun">
            <span className="text-parsomen">
              {formatSayi(lord.unvan.sonrakiEsik! - lord.fame)} şöhret
            </span>{' '}
            sonra <span className="text-altin">{lord.unvan.sonrakiAd}</span> olacaksın.
          </p>
        </Kart>
      )}

      {/* Arma KOZMETİK: hiçbir sayıya dokunmuyor (docs/10 §1.1). Güç
          kartlarıyla aynı sayfada durunca oyuncu onu da bir güç seçimi
          sanıyordu ve ekran dört ayrı işi taşıyordu. Sekme ikisini
          ayırıyor. */}
      <AltSekmeler
        sekmeler={[
          { key: 'guc', ad: 'Güç' },
          { key: 'gorunus', ad: 'Görünüş' },
        ]}
        etkin={sekme}
        onSec={setSekme}
      />

      {sekme === 'guc' && (
        <>
          <Bolum
            id="nitelikler"
            baslik="Nitelikler"
            yan={
              lord.statPoints > 0 ? (
                <Rozet renk="var(--color-yesil)">{kalan} PUAN</Rozet>
              ) : undefined
            }
          >
            <div className="space-y-2">
              {STAT_KEYS.map((k) => {
                const Ikon = STAT_IKONU[k];
                const bilgi = STAT[k];
                const mevcut = lord.stats[k];
                const eklenen = dagitim[k];
                return (
                  <Kart key={k} className="p-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: `color-mix(in srgb, ${bilgi.renk} 20%, transparent)`,
                          color: bilgi.renk,
                        }}
                      >
                        <Ikon boyut={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="baslik text-[13px]">{bilgi.ad}</span>
                          <span className="tabular text-lg leading-none font-bold">
                            {mevcut}
                            {eklenen > 0 && <span className="text-yesil"> +{eklenen}</span>}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-solgun">
                          {bilgi.etki(mevcut + eklenen)}
                        </p>
                      </div>
                      {lord.statPoints > 0 && (
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            onClick={() =>
                              setDagitim((d) => ({ ...d, [k]: Math.max(0, d[k] - 1) }))
                            }
                            disabled={eklenen === 0}
                            className="bas baslik h-9 w-9 rounded-lg border border-kenar text-solgun disabled:opacity-30"
                          >
                            −
                          </button>
                          <button
                            onClick={() => setDagitim((d) => ({ ...d, [k]: d[k] + 1 }))}
                            disabled={kalan <= 0}
                            className="bas baslik h-9 w-9 rounded-lg bg-yesil-koyu text-white disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </Kart>
                );
              })}
            </div>

            {hata && <p className="mt-2 text-[13px] text-kirmizi">{hata}</p>}

            {harcanan > 0 && (
              <div className="mt-3 flex gap-2">
                <Buton onClick={onayla} disabled={bekliyor} tam boy="buyuk">
                  {bekliyor ? 'Kaydediliyor...' : `${harcanan} puanı dağıt`}
                </Buton>
                <Buton
                  tur="anahat"
                  boy="buyuk"
                  onClick={() => setDagitim({ guc: 0, dayaniklilik: 0, liderlik: 0, kurnazlik: 0 })}
                >
                  Sıfırla
                </Buton>
              </div>
            )}
            <p className="mt-2 px-1 text-[11px] text-sonuk">
              Puan dağıtımı kalıcıdır. Liderlik ordunun büyüklüğünü ve general slotunu belirler.
            </p>
          </Bolum>

          <Bolum baslik="Kuşanılan Ekipman">
            {kusanilan.size === 0 && (
              /* Altı boş kutu ve hiçbirinde "nereden alınır" yok — denetimde
                 çıkan hâl buydu. Yuvalar ekipmanın nerede üretildiğini
                 söylemiyorsa, oyuncu onları hiç dolmayan bir süs sanıyor. */
              <p className="mb-2 text-[12px] leading-snug text-solgun">
                Hiçbir yuvan dolu değil. Ekipman{' '}
                <button
                  type="button"
                  className="text-altin underline underline-offset-2"
                  onClick={() => onKapiAc('demirhane')}
                >
                  Demirhane
                </button>
                'de dövülür; ürettiğin parçayı buradan kuşanırsın.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {EQUIP_SLOTS.map((slot) => {
                const it = kusanilan.get(slot);
                if (!it) {
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onKapiAc('demirhane')}
                      className="bas flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-dashed border-kenar bg-yuzey/50 p-2"
                    >
                      <span className="baslik text-[11px] text-sonuk">{SLOT_ADI[slot]}</span>
                      <span className="mt-1 text-[11px] text-altin/70">Demirhane</span>
                    </button>
                  );
                }
                const renk = nadirlikRengi(it.rarity);
                return (
                  // Dolu yuva bir VİTRİN: kuşandığın şey görünüyor, adı ve tier'ı
                  // altındaki şeritte duruyor. Oyuncunun ilk oturumdaki
                  // şikâyetlerinden biri buydu — "gücümü en yüksek olanı kuşan
                  // dedim, gücüm arttı, eee ne oldu şimdi". Sayı arttığını
                  // görmek, bir şey kuşandığını görmekle aynı şey değil.
                  <Kart key={slot} className="relative aspect-square p-0" vurgu={renk}>
                    <Gorsel
                      tur="ekipman"
                      ad={`${slot}_t${it.tier}`}
                      alt={`${SLOT_ADI[slot]} T${it.tier}`}
                      boyut={128}
                      className="h-full w-full"
                      yedek={
                        <span
                          className="baslik flex h-full w-full items-center justify-center text-[20px]"
                          style={{ color: renk }}
                        >
                          T{it.tier}
                        </span>
                      }
                    />
                    {/* Şerit görselin üstüne biner; kare zaten küçük, altına
                    ayrı bir satır koymak illüstrasyona kalan yeri yarıya
                    indiriyordu. */}
                    <div className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-1 bg-gradient-to-t from-gece via-gece/85 to-transparent px-1.5 pt-3 pb-1">
                      <span className="baslik truncate text-[11px] text-solgun">
                        {SLOT_ADI[slot]}
                      </span>
                      <span className="baslik shrink-0 text-[12px] text-altin">
                        T{it.tier}
                        {it.upgradeLevel > 0 && `+${it.upgradeLevel}`}
                      </span>
                    </div>
                  </Kart>
                );
              })}
            </div>
          </Bolum>

          <Bolum baslik="Savaş Gücü">
            <Kart className="divide-y divide-kenar/70 p-0">
              {/* Satır adları TÜRKÇE ve kısaltmasız.
                  Eskiden burada "ELO 1200 · 0G 0M" ve "Sld +%0 · Sav +%0
                  · Can +%0" yazıyordu: Türkçe bir ortaçağ oyununun ana
                  sayfasında çevrilmemiş jargon ve kimsenin çözemeyeceği
                  kısaltmalar. Oyuncu bir satırı okuyamıyorsa o satır
                  bilgi değil gürültüdür. */}
              {[
                ['Ekipman gücü', formatSayi(lord.equipmentPower)],
                ['Lord savaş katkısı', formatSayi(lord.lordContribution)],
                [
                  'Ordu donanımı',
                  `Saldırı +%${Math.round(lord.gearBonus.saldiri * 100)} · ` +
                    `Savunma +%${Math.round(lord.gearBonus.savunma * 100)} · ` +
                    `Can +%${Math.round(lord.gearBonus.can * 100)}`,
                ],
                // Bu iki satır YALNIZCA bir oyuncuyla savaştıysan var.
                //
                // Geçen turda "ELO"yu "Düello" diye çevirmiştim; ortada
                // düello diye bir özellik yok ve isim, olmayan bir sistemi
                // varmış gibi gösteriyordu. Bu sayılar oyunculara karşı
                // yapılan SALDIRILARIN karnesi (march.ts → updateElo);
                // NPC bölgeleri saymıyor.
                //
                // Hiç oynamamışken "0 galibiyet 0 yenilgi" göstermek de
                // bilgi değil: dokunmadığın bir sistemin sıfırı, o sistemi
                // arattırmaktan başka bir şey yapmıyor.
                ...(lord.pvpWins + lord.pvpLosses > 0
                  ? ([
                      ['Lordlara karşı', `${lord.pvpWins} galibiyet · ${lord.pvpLosses} yenilgi`],
                      ['Savaş derecen', formatSayi(lord.elo)],
                    ] as [string, string][])
                  : []),
              ].map(([ad, deger]) => (
                <div key={ad} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-[13px] text-solgun">{ad}</span>
                  <span className="tabular text-[13px] font-bold">{deger}</span>
                </div>
              ))}
            </Kart>
          </Bolum>
        </>
      )}

      {sekme === 'gorunus' && <ArmaSecici mevcut={lord.arma} />}
    </div>
  );
}
