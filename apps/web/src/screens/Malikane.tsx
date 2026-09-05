/**
 * Malikâne — "şimdi ne yapmalısın" sayfası.
 *
 * Eskiden altı ayrı işi taşıyordu: sıradaki adım, durum, kuyruklar,
 * günlük görevler, haftalık sefer, başarımlar ve olay akışı. İki buçuk
 * ekran uzunluğundaydı ve oyuncunun "her şey iç içe, karman çorman"
 * dediği şeyin merkezi buydu.
 *
 * Şimdi tek iş yapıyor: ŞU AN ne olduğu ve sıradaki adım. Görevler ve
 * olaylar kendi sayfalarına çıktı; buradan yalnız birer kanca kalıyor
 * (görünmeyen bir "yarın geri gel" sebebi sebep değildir, docs/09 K4).
 */
import { B } from '@lordlar/shared';
import type { GameEvent, LordState, QueueItem, YoklukOzeti } from '../api/client';
import type { Sekme } from '../components/MobilKabuk';
import {
  IkonKale,
  IkonNavDemirhane,
  IkonNavHarita,
  IkonNavKisla,
  IkonSancak,
  IkonSure,
  IkonUyari,
  IkonYer,
} from '../components/Ikonlar';
import { DiyarTanitimi } from '../components/DiyarTanitimi';
import { Omurga, useOmurgaAdimi } from '../components/Omurga';
import { Rehber } from '../components/Rehber';
import {
  Bolum,
  Buton,
  DurumSiridi,
  GeriSayim,
  Hap,
  Ilerleme,
  Kart,
  formatSayi,
} from '../components/ui';
import { GorevOzeti } from '../components/GorevOzeti';
import { Zemin } from '../components/Zemin';

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

export function Malikane({
  lord,
  queues,
  events,
  yokluk,
  onBolgeyiAc,
  onGit,
}: {
  lord: LordState;
  queues: QueueItem[];
  events: GameEvent[];
  yokluk: YoklukOzeti | null;
  /** Bir bölgeyi haritada açar: hem omurganın hedefi hem karşı saldırı. */
  onBolgeyiAc: (regionId: number) => void;
  onGit: (s: Sekme) => void;
}) {
  const yarali = lord.woundedUntil && new Date(lord.woundedUntil) > new Date();
  const korumali = lord.protectionUntil && new Date(lord.protectionUntil) > new Date();
  // Rehber omurganın hesapladığı adımı okuyor; iki ayrı hesap olmasın diye
  // aynı hook. Sorgular TanStack önbelleğinden, ikinci istek üretmiyor.
  const rehberAdimi = useOmurgaAdimi(lord, queues);

  return (
    <div className="space-y-4">
      <Zemin ad="malikane" baslik="Malikâne" altyazi="Diyarının kalbi" />
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

      <DiyarTanitimi lord={lord} queues={queues} />

      {/* Kâhya omurganın ÜSTÜNDE: önce neden, sonra ne. Adımı omurgadan
          okuyor, kendi senaryosunu tutmuyor (docs/09 T4). */}
      <Rehber adim={rehberAdimi?.anahtar ?? null} bolgeSayisi={lord.regionCount} />
      <Omurga lord={lord} queues={queues} onGit={onGit} onHedefeGit={onBolgeyiAc} />

      {/*
        Dört ayrı istatistik kartı yerine tek rozet satırı.
        Kartlar ekranın yarısını kaplıyor ve hepsi aynı ağırlıkta
        görünüyordu: yeni oyuncu "KOMUTA 0/90" ile "GÜNLÜK SALDIRI 0/12"
        arasında hangisinin önemli olduğunu ayırt edemiyordu. Rozet satırı
        aynı bilgiyi bir satırda veriyor ve omurgayı ekranın tepesinde
        tek büyük öğe olarak bırakıyor.
      */}
      <DurumSiridi>
        <Hap ikon={<IkonKale boyut={13} />} renk="var(--color-altin)">
          {lord.regionCount}/{lord.maxRegions} bölge
          {lord.ownsThrone && ' +Taht'}
        </Hap>
        <Hap
          ikon={<IkonYer boyut={13} />}
          renk={
            lord.usedSlots >= lord.commandCapacity ? 'var(--color-kirmizi)' : 'var(--color-mavi)'
          }
        >
          {formatSayi(lord.usedSlots)}/{formatSayi(lord.commandCapacity)} komuta
        </Hap>
        <Hap ikon={<IkonSancak boyut={13} />} renk="var(--color-yesil)">
          Sv {lord.level}
        </Hap>
        <Hap ikon={<IkonSure boyut={13} />}>
          {lord.dailyAttacks}/{B.korumalar.gunluk_saldiri_limiti} saldırı
        </Hap>
      </DurumSiridi>

      {lord.statPoints > 0 && (
        <Kart className="p-3" vurgu="var(--color-yesil)">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 text-[13px]">
              <strong className="baslik text-yesil">{lord.statPoints} stat puanı</strong>
              <p className="text-solgun">Dağıtılmayı bekliyor.</p>
            </div>
            <Buton tur="yesil" boy="kucuk" onClick={() => onGit('lord')}>
              Dağıt
            </Buton>
          </div>
        </Kart>
      )}

      {korumali && (
        <Kart className="border-yesil/40 p-3">
          <p className="text-[12px] text-solgun">
            <span className="baslik text-yesil">Yeni lord kalkanı</span> —{' '}
            <GeriSayim bitis={lord.protectionUntil!} /> kaldı. İlk saldırında kalkan düşer.
          </p>
        </Kart>
      )}

      {/* Görev KANCASI, görevlerin kendisi değil: ayrıntı Görevler
          sayfasında. Ödül alınmayı bekliyorsa şerit yeşilleniyor —
          oyuncunun oraya gitmesi için tek gerçek sebep o. */}
      <GorevOzeti onGit={() => onGit('gorevler')} />

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
              <Buton tur="sessiz" boy="kucuk" onClick={() => onGit('demirhane')}>
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

      {/* Olay kancası: akışın kendisi Olaylar sayfasında. Son olayı
          burada göstermek "bir şey oldu mu" sorusunu sayfaya gitmeden
          cevaplıyor. */}
      <Kart className="p-3" sakin={events.length === 0} onClick={() => onGit('olaylar')}>
        <div className="flex items-center gap-2">
          <span className="baslik shrink-0 text-[11px] text-solgun">OLAYLAR</span>
          <p className="min-w-0 flex-1 truncate text-[12px] text-solgun">
            {events.length === 0
              ? 'Henüz bir şey olmadı.'
              : typeof events[0]!.payload.mesaj === 'string'
                ? events[0]!.payload.mesaj
                : events[0]!.kind}
          </p>
          <span className="baslik shrink-0 text-[11px] text-altin">
            {events.length > 0 ? `${events.length} · AÇ` : 'AÇ'}
          </span>
        </div>
      </Kart>
    </div>
  );
}
