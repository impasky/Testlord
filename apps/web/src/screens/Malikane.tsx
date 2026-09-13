/**
 * Malikâne — DİYARIN kendisi: topraklar, koruma ve ipuçları.
 *
 * Bu ekran eskiden oyunun ana sayfasıydı ve her şeyi taşıyordu: omurga,
 * kâhya, durum şeridi, görev özeti, kuyruklar, olaylar. Oyuncu rolleri
 * netleştirdi:
 *
 *   "ana sayfada her şeye erişimimiz olmalı, tüm yönlendirmeleri oradan
 *    yapabilmeliyiz. Malikâne'yi sahip olduğumuz arazi yönetimleri,
 *    ipuçları gibi içerikleri barındıran bir alana çevirip Lord sayfasını
 *    oyunun ana sayfası hâline getirirsek daha iyi olabilir."
 *
 * Öyle yapıldı. "Şimdi ne yapmalısın" ve bütün kapılar Lord'a taşındı;
 * burada yalnız DİYAR kaldı — hangi topraklar senin, ne getiriyorlar, ne
 * kadar korunuyorsun, ve oyunu daha iyi oynatan ipuçları.
 *
 * Toprak listesi yeni: oyunda "bölgelerim" diye bir yer hiç yoktu, sahip
 * olduklarını görmek için haritada tek tek aramak gerekiyordu.
 */
import { ipucuSec, regionIncome, type Kapi } from '@lordlar/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type GameEvent, type LordState } from '../api/client';
import {
  BolgeIkonu,
  IkonAltin,
  IkonDemir,
  IkonErzak,
  IkonKale,
  IkonSure,
} from '../components/Ikonlar';
import { Zemin } from '../components/Zemin';
import { SavunmaDuzeni } from '../components/SavunmaDuzeni';
import { Pazar } from '../components/Pazar';
import { BosHal } from '../components/BosHal';
import {
  Bolum,
  Buton,
  DurumSiridi,
  GeriSayim,
  Hap,
  Iskelet,
  Kart,
  formatSayi,
} from '../components/ui';
import type { Sekme } from '../components/MobilKabuk';

const TIP_ADI: Record<string, string> = {
  tarla: 'Tarla',
  maden: 'Maden',
  sehir: 'Şehir',
  kale: 'Kale',
  taht: 'Taht Kalesi',
};

/**
 * Bölgenin saatlik geliri.
 *
 * Formülü BURADA yeniden yazmıyoruz: `regionIncome` motorun kendi
 * fonksiyonu ve sunucu da onu kullanıyor. İkinci bir hesap, er ya da geç
 * ekranın sunucudan farklı bir sayı göstermesi demekti.
 */
function gelir(tip: string, seviye: number, carpan: number) {
  const g = regionIncome(tip, seviye, carpan);
  return {
    altin: Math.round(g.altin),
    demir: Math.round(g.demir),
    erzak: Math.round(g.erzak),
  };
}

export function Malikane({
  lord,
  events,
  onBolgeyiAc,
  onGit,
  onKapiAc,
}: {
  lord: LordState;
  events: GameEvent[];
  /** Bir bölgeyi haritada açar — yönetimi orada. */
  onBolgeyiAc: (regionId: number) => void;
  onGit: (s: Sekme) => void;
  onKapiAc: (k: Kapi) => void;
}) {
  const harita = useQuery({ queryKey: ['map'], queryFn: api.map });
  const korumali = lord.protectionUntil && new Date(lord.protectionUntil) > new Date();

  /**
   * İpucu SIRAYLA dönüyor ve sıra her açılışta bir ilerliyor.
   * Rastgele seçim aynı ipucunu üst üste gösterebiliyor ve oyuncu "hep
   * aynı şey yazıyor" diyor.
   */
  const [ipucuSayac, setIpucuSayac] = useState(() => Math.floor(Date.now() / 60_000));
  const ipucu = ipucuSec(ipucuSayac);

  const benim = (harita.data?.regions ?? []).filter((r) => r.isMine);

  return (
    <div className="space-y-4">
      <Zemin ad="malikane" baslik="Malikâne" altyazi="Diyarının toprakları" />

      <DurumSiridi>
        <Hap ikon={<IkonKale boyut={13} />} renk="var(--color-altin)">
          {lord.regionCount}/{lord.maxRegions} bölge
          {lord.ownsThrone && ' +Taht'}
        </Hap>
        <Hap ikon={<IkonAltin boyut={13} />} renk="var(--color-kaynak-altin)">
          +{formatSayi(lord.hourlyIncome.altin)}/sa
        </Hap>
        <Hap
          ikon={<IkonErzak boyut={13} />}
          renk={lord.netErzakPerHour < 0 ? 'var(--color-kirmizi)' : 'var(--color-kaynak-erzak)'}
        >
          {lord.netErzakPerHour >= 0 ? '+' : ''}
          {formatSayi(lord.netErzakPerHour)}/sa
        </Hap>
      </DurumSiridi>

      {korumali && (
        <Kart className="border-yesil/40 p-3">
          <p className="text-[12px] text-solgun">
            <span className="baslik text-yesil">Yeni lord kalkanı</span> —{' '}
            <GeriSayim bitis={lord.protectionUntil!} /> kaldı. İlk saldırında kalkan düşer.
          </p>
        </Kart>
      )}

      {/* Pazar: bölgeler tek kaynak ürettiği ve Lv15'e kadar tek bölge
          tutulabildiği için bir kaynak hep darboğaz, bir diğeri hep
          taşıyor. Malikâne'de duruyor çünkü burası oyuncunun kendi
          ekonomisini yönettiği yer. */}
      <Pazar />

      {/* Savunma düzeni: saldırıya uğradığında ordunun nasıl duracağı.
          Malikâne'de çünkü burası oyuncunun kendi diyarını yönettiği yer;
          saldırı kararları Harita'da veriliyor. */}
      <SavunmaDuzeni />

      {/* ---- Topraklarım ----
          Bölgeye dokunmak haritada onu açıyor: yükseltme, garnizon ve
          bırakma zaten orada. Burada ikinci bir yönetim arayüzü kurmak,
          aynı işi iki yerde tutmak olurdu. */}
      <Bolum
        baslik={`Topraklarım${benim.length ? ` · ${benim.length}` : ''}`}
        sakin={benim.length === 0}
      >
        {harita.isPending ? (
          <Iskelet satir={2} />
        ) : benim.length === 0 ? (
          <BosHal
            mesaj="Henüz toprağın yok. Haritada bir bölge al, geliri buraya işlesin."
            eylemler={[{ etiket: 'Haritaya git', onTikla: () => onGit('harita') }]}
          />
        ) : (
          <div className="space-y-2">
            {benim.map((r) => {
              const g = gelir(r.type, r.level, r.incomeMult);
              return (
                <Kart key={r.id} className="p-3" onClick={() => onBolgeyiAc(r.id)}>
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-altin">
                      <BolgeIkonu tip={r.type} boyut={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="baslik truncate text-[14px]">{r.name}</span>
                        <span className="shrink-0 text-[11px] text-sonuk">
                          {TIP_ADI[r.type] ?? r.type} · Sv {r.level}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {g.altin > 0 && (
                          <Hap ikon={<IkonAltin boyut={13} />} renk="var(--color-yesil)">
                            +{formatSayi(g.altin)}/sa
                          </Hap>
                        )}
                        {g.demir > 0 && (
                          <Hap ikon={<IkonDemir boyut={13} />} renk="var(--color-yesil)">
                            +{formatSayi(g.demir)}/sa
                          </Hap>
                        )}
                        {g.erzak > 0 && (
                          <Hap ikon={<IkonErzak boyut={13} />} renk="var(--color-yesil)">
                            +{formatSayi(g.erzak)}/sa
                          </Hap>
                        )}
                        {r.shielded && (
                          <Hap ikon={<IkonSure boyut={13} />} renk="var(--color-mavi)">
                            kalkan altında
                          </Hap>
                        )}
                      </div>
                    </div>
                    <span className="baslik shrink-0 text-[11px] text-altin">YÖNET</span>
                  </div>
                </Kart>
              );
            })}
          </div>
        )}
      </Bolum>

      {/* ---- İpucu ----
          Oyuncunun istediği ikinci içerik. Sayılar dengeden türüyor
          (packages/shared/src/ipuclari.ts): elle yazılmış bir sayı denge
          değişince sessizce yalana döner. */}
      <Kart className="p-3" vurgu="var(--color-mavi)">
        <div className="flex items-start justify-between gap-2">
          <span className="baslik text-[11px] text-mavi">İPUCU</span>
          <button
            type="button"
            onClick={() => setIpucuSayac((n) => n + 1)}
            // Negatif dış boşluk + iç dolgu: dokunma hedefi 24px'in
            // üstüne çıkıyor ama satırın görünen yerleşimi kaymıyor.
            className="bas baslik -my-1.5 shrink-0 px-1 py-1.5 text-[11px] text-sonuk"
          >
            SONRAKİ
          </button>
        </div>
        <p className="baslik mt-1 text-[14px] text-parsomen">{ipucu.baslik}</p>
        <p className="mt-1 text-[13px] leading-snug text-solgun">{ipucu.metin}</p>
      </Kart>

      {/* Olay kancası: akış Olaylar kapısında, son olay burada.
          Kapı arkasında bir şey varsa açılıyor — saldırıp kaybeden
          oyuncunun bölgesi yoktur ama raporu vardır. */}
      {events.length > 0 && (
        <Kart className="p-3" onClick={() => onKapiAc('olaylar')} kapi="olaylar">
          <div className="flex items-center gap-2">
            <span className="baslik shrink-0 text-[11px] text-solgun">OLAYLAR</span>
            <p className="min-w-0 flex-1 truncate text-[12px] text-solgun">
              {typeof events[0]!.payload.mesaj === 'string'
                ? events[0]!.payload.mesaj
                : events[0]!.kind}
            </p>
            <span className="baslik shrink-0 text-[11px] text-altin">{events.length} · AÇ</span>
          </div>
        </Kart>
      )}

      {/* Boş hâl gürültü değil: "yapacak bir şey yok" ekranı olmasın,
          bir sonraki iş görünsün (docs/09 K7). */}
      {events.length === 0 && (
        <Kart sakin className="p-3">
          <p className="text-[12px] text-solgun">
            Diyarda henüz bir şey olmadı. Bir sefere çıkınca burada okursun.
          </p>
        </Kart>
      )}

      <div className="pb-1">
        <Buton tur="sessiz" boy="kucuk" onClick={() => onGit('harita')}>
          Haritayı aç
        </Buton>
      </div>
    </div>
  );
}
