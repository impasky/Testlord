/** Malikâne — durum özeti, kuyruklar, olay akışı. Mobil ana ekran. */
import { B } from '@lordlar/shared';
import { useState } from 'react';
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
import { Omurga } from '../components/Omurga';
import { SavasRaporu } from '../components/SavasRaporu';
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
import { Basarimlar } from '../components/Basarimlar';
import { BosHal } from '../components/BosHal';
import { GunlukKart } from '../components/GunlukKart';
import { SeferKart } from '../components/SeferKart';
import { Zemin } from '../components/Zemin';

const KUYRUK_ADI: Record<string, string> = {
  train: 'Asker eğitimi',
  craft: 'Ekipman üretimi',
  upgrade_item: 'Ekipman yükseltme',
  upgrade_gear: 'Ordu donanımı',
  upgrade_region: 'Bölge yükseltme',
  kesif: 'Keşif',
};

const OLAY_RENGI: Record<string, string> = {
  bolge_aldin: 'var(--color-yesil)',
  savas_kazandin: 'var(--color-yesil)',
  bolge_kaybettin: 'var(--color-kirmizi)',
  savas_kaybettin: 'var(--color-kirmizi)',
  saldiriya_ugradin: 'var(--color-turuncu)',
  general_seviye: 'var(--color-altin)',
  ittifak_katilim: 'var(--color-yesil)',
  ittifak_ayrilma: 'var(--color-solgun)',
  ittifak_lider: 'var(--color-altin)',
  ittifak_hedef: 'var(--color-mavi)',
  ittifak_cikarildin: 'var(--color-turuncu)',
  kesif_raporu: 'var(--color-mavi)',
  casus_yakalandi: 'var(--color-turuncu)',
  casus_yakaladin: 'var(--color-yesil)',
  general_dinleniyor: 'var(--color-turuncu)',
  aclik: 'var(--color-kirmizi)',
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
  const [rapor, setRapor] = useState<string | null>(null);
  const yarali = lord.woundedUntil && new Date(lord.woundedUntil) > new Date();
  const korumali = lord.protectionUntil && new Date(lord.protectionUntil) > new Date();

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

      {/* "Bugün" kuyrukların ÜSTÜNDE: kuyruk "ne başlattım"ı gösteriyor,
          bugün "ne yapmalıyım"ı. İkinci soru daha yukarıda durmalı. */}
      <GunlukKart onGit={onGit} />
      <SeferKart />

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

      {/* Başarımlar olay akışının üstünde: akış "ne oldu"yu anlatıyor,
          başarımlar "nereye gidiyorum"u. İkinci soru daha yukarıda
          durmalı. */}
      <Basarimlar olcutler={lord.basarimOlcutleri} />

      <Bolum baslik="Olay Akışı" sakin={events.length === 0}>
        {events.length === 0 ? (
          <BosHal
            mesaj="Henüz bir şey olmadı. Bir saldırı yaptığında ya da bölgen geliştiğinde burada okursun."
            eylemler={[
              { etiket: 'Haritaya git', onTikla: () => onGit('harita') },
              { etiket: 'Kışla', onTikla: () => onGit('kisla') },
            ]}
          />
        ) : (
          <div className="space-y-2">
            {events.slice(0, 12).map((e) => {
              // Savaş olayları raporu taşır; taşımayanlar düz kart kalır.
              // Tıklanamayan bir kartı tıklanabilir göstermek, olay akışında
              // her satırı denemeye davet ederdi.
              const raporId = typeof e.payload.battleId === 'string' ? e.payload.battleId : null;
              const govde = (
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 flex-1 text-[13px]">
                    {typeof e.payload.mesaj === 'string' ? e.payload.mesaj : e.kind}
                  </p>
                  <time className="shrink-0 text-[10px] text-sonuk">
                    {new Date(e.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              );
              return (
                <Kart key={e.id} className="p-3" vurgu={OLAY_RENGI[e.kind]}>
                  {raporId ? (
                    <button
                      className="bas w-full text-left"
                      onClick={() => setRapor(raporId)}
                      aria-label="Savaş raporunu aç"
                    >
                      {govde}
                      <span className="baslik mt-1 block text-[10px] text-altin">RAPORU AÇ</span>
                    </button>
                  ) : (
                    govde
                  )}
                </Kart>
              );
            })}
          </div>
        )}
      </Bolum>

      {rapor && (
        <SavasRaporu
          battleId={rapor}
          benimId={lord.id}
          onKapat={() => setRapor(null)}
          onKarsiSaldiri={(bolgeId) => {
            setRapor(null);
            onBolgeyiAc(bolgeId);
          }}
        />
      )}
    </div>
  );
}
