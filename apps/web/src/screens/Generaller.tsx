/** Generaller — 12 kişilik sabit kadro, kiralama, slot yerleşimi. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type GeneralDto } from '../api/client';
import { Gorsel } from '../components/Gorsel';
import { IkonAltin, IkonNavGeneraller } from '../components/Ikonlar';
import { Bolum, Buton, EngelNotu, Ilerleme, Kart, Rozet, formatSayi } from '../components/ui';
import { Zemin } from '../components/Zemin';

const NADIRLIK_RENGI: Record<string, string> = {
  bronz: '#c97b3c',
  gumus: '#b8c4cc',
  altin: '#f5b731',
};
const NADIRLIK_ADI: Record<string, string> = { bronz: 'Bronz', gumus: 'Gümüş', altin: 'Altın' };

const ETKI_ADI: Record<string, string> = {
  ordu_saldiri: 'Ordu saldırısı',
  ordu_savunma: 'Ordu savunması',
  savunmada_ordu_savunma: 'Savunmada ordu savunması',
  okcu_saldiri: 'Okçu saldırısı',
  mizrakci_savunma: 'Mızrakçı savunması',
  kusatma_saldiri: 'Mancınık saldırısı',
  lord_savas_katkisi: 'Lord savaş katkısı',
  yagma: 'Yağma',
  bolge_geliri: 'Bölge geliri',
  ordu_bakim_maliyeti: 'Ordu bakım maliyeti',
  yuruyus_suresi: 'Yürüyüş süresi',
  kayip_geri_donus: 'Kayıpların geri dönüşü',
};

function GeneralKarti({
  g,
  slots,
  altin,
  bekliyor,
  onKirala,
  onAta,
}: {
  g: GeneralDto;
  slots: number;
  altin: number;
  bekliyor: boolean;
  onKirala: () => void;
  onAta: (slot: number | null) => void;
}) {
  const renk = NADIRLIK_RENGI[g.nadirlik] ?? '#9aa0a6';
  const yeterli = altin >= g.maliyet_altin;
  const yuzde = Math.round(g.etkinDeger * 100);
  const sahada = g.slotIndex !== null;

  return (
    <Kart className="p-3" vurgu={sahada ? 'var(--color-altin)' : renk}>
      <div className="flex gap-3">
        <div
          className="oyuk flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
          style={{ borderColor: `color-mix(in srgb, ${renk} 45%, transparent)`, color: renk }}
        >
          <Gorsel
            tur="generaller"
            ad={g.key}
            alt={g.ad}
            boyut={64}
            className="h-full w-full"
            yedek={<IkonNavGeneraller boyut={34} />}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="baslik min-w-0 flex-1 text-[13px] leading-tight">{g.ad}</h3>
            <Rozet renk={renk}>{NADIRLIK_ADI[g.nadirlik]}</Rozet>
          </div>

          <p className="mt-1 text-[12px]">
            <span className="text-solgun">{g.pasif.ad}:</span>{' '}
            {ETKI_ADI[g.pasif.etki] ?? g.pasif.etki}{' '}
            <span className="font-bold" style={{ color: renk }}>
              {yuzde >= 0 ? '+' : ''}%{yuzde}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-sonuk">
            <span className="text-solgun">{g.yetenek.ad}:</span> {g.yetenek.aciklama}
          </p>
        </div>
      </div>

      {g.sahipMi ? (
        <div className="mt-2.5 border-t border-kenar/70 pt-2.5">
          <div className="mb-2 flex items-center gap-2">
            <span className="tabular shrink-0 text-[11px] text-solgun">Sv {g.level}/20</span>
            <div className="min-w-0 flex-1">
              <Ilerleme deger={g.xp} max={g.xpForNext || 1} renk={renk} boy="ince" />
            </div>
          </div>
          {g.dinleniyor ? (
            <p className="text-[11px] text-kirmizi">
              Yaralı — {new Date(g.dinleniyor).toLocaleString('tr-TR')} tarihine kadar dinleniyor.
            </p>
          ) : (
            <div className="flex gap-1.5">
              {Array.from({ length: slots }, (_, i) => (
                <Buton
                  key={i}
                  tur={g.slotIndex === i ? 'altin' : 'sessiz'}
                  boy="kucuk"
                  onClick={() => onAta(g.slotIndex === i ? null : i)}
                  disabled={bekliyor}
                  className="flex-1"
                >
                  Slot {i + 1}
                </Buton>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2.5 border-t border-kenar/70 pt-2.5">
          <Buton onClick={onKirala} disabled={bekliyor || !yeterli} tam>
            <span className="mr-1.5 inline-block align-[-2px]">
              <IkonAltin boyut={14} />
            </span>
            {bekliyor ? 'Gönderiliyor…' : `Kirala · ${formatSayi(g.maliyet_altin)}`}
          </Buton>
          {!yeterli && (
            <EngelNotu
              kisa="Altının yetmiyor"
              uzun={`${formatSayi(g.maliyet_altin - altin)} altın eksik.`}
            />
          )}
        </div>
      )}
    </Kart>
  );
}

export function Generaller({ onGuncelle }: { onGuncelle: () => void }) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['generals'], queryFn: api.generals });

  // Tek bayrak on iki kartin butun dugmelerini birden sonduruyordu.
  const [gonderilen, setGonderilen] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async ({ f }: { f: () => Promise<unknown>; anahtar: string }) => f(),
    onMutate: ({ anahtar }) => setGonderilen(anahtar),
    onSettled: () => setGonderilen(null),
    onSuccess: () => {
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['generals'] });
      onGuncelle();
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'İşlem başarısız.'),
  });

  if (q.isLoading || !q.data) {
    return <p className="pt-6 text-center text-solgun">Kadro çağrılıyor...</p>;
  }
  const sahada = q.data.kadro.filter((g) => g.slotIndex !== null);

  return (
    <div className="space-y-4">
      <Zemin ad="generaller" baslik="Generaller" altyazi="Savaş meclisin" />
      <Bolum baslik={`Sahadaki Generaller · ${sahada.length}/${q.data.slots}`}>
        <Kart className="p-3">
          {sahada.length === 0 ? (
            <p className="text-[13px] text-solgun">
              Sahada general yok. Kiraladığın bir generali slota yerleştir.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {sahada.map((g) => (
                <li
                  key={g.key}
                  className="baslik rounded-lg border border-altin/50 bg-altin/10 px-2.5 py-1.5 text-[11px] text-altin"
                >
                  {g.ad} <span className="text-solgun">Sv{g.level}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2.5 border-t border-kenar/70 pt-2 text-[11px] text-sonuk">
            Slot sayısı Liderlik statına bağlıdır: 1 + Liderlik/30, en fazla 3.
          </p>
        </Kart>
        {hata && <p className="mt-2 text-[13px] text-kirmizi">{hata}</p>}
      </Bolum>

      {(['altin', 'gumus', 'bronz'] as const).map((nad) => (
        <Bolum key={nad} baslik={`${NADIRLIK_ADI[nad]} Generaller`}>
          <div className="space-y-2">
            {q.data.kadro
              .filter((g) => g.nadirlik === nad)
              .map((g) => (
                <GeneralKarti
                  key={g.key}
                  g={g}
                  slots={q.data.slots}
                  altin={q.data.altin}
                  bekliyor={gonderilen === g.key}
                  onKirala={() =>
                    mut.mutate({ anahtar: g.key, f: () => api.hireGeneral(g.key) })
                  }
                  onAta={(slot) =>
                    mut.mutate({ anahtar: g.key, f: () => api.assignGeneral(g.key, slot) })
                  }
                />
              ))}
          </div>
        </Bolum>
      ))}
    </div>
  );
}
