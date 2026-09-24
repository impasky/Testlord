/** Sıralama — üç liste, üç oyun tarzı. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type IttifakSiralamaSatiri, type RankingRow } from '../api/client';
import { SikayetSayfasi } from '../components/SikayetSayfasi';
import { Arma } from '../components/Arma';
import { IkonNavSiralama } from '../components/Ikonlar';
import { Bolum, Kart, Rozet, formatSayi } from '../components/ui';
import type { Kapi } from '@lordlar/shared';
import type { Sekme } from '../components/MobilKabuk';
import { BosHal } from '../components/BosHal';
import { Zemin } from '../components/Zemin';

type Board = 'fame' | 'conquest' | 'elo' | 'ittifak';

const TABLAR: { key: Board; ad: string; aciklama: string; renk: string }[] = [
  {
    key: 'fame',
    ad: 'Şöhret',
    aciklama: 'Genel toplam skor. Dengeli oyuncuyu ödüllendirir.',
    renk: 'var(--color-altin)',
  },
  {
    key: 'conquest',
    ad: 'Fetih',
    aciklama: 'Bölge seviyesi × tip çarpanı. Toprak sahibinin sıralaması.',
    renk: 'var(--color-yesil)',
  },
  {
    key: 'elo',
    ad: 'Kılıç',
    aciklama: 'PvP derecesi. Bölgesiz bir lord da birinci olabilir.',
    renk: 'var(--color-kirmizi)',
  },
  {
    key: 'ittifak',
    ad: 'İttifak',
    aciklama: 'Üyelerin şöhret toplamı. Lord sıralamasıyla aynı ölçü.',
    renk: 'var(--color-mavi)',
  },
];

const MADALYA = ['#f5b731', '#c8d1d9', '#c97b3c'];

function Satir({
  r,
  benMi,
  renk,
  onRapor,
}: {
  r: RankingRow;
  benMi: boolean;
  renk: string;
  onRapor?: (r: RankingRow) => void;
}) {
  const madalya = r.sira <= 3 ? MADALYA[r.sira - 1] : undefined;
  return (
    /*
     * SATIR, KART DEĞİL.
     *
     * Sıralama ekranı bir liste için 37 kart çiziyordu: her satırın kendi
     * kenarlığı, kendi zemini, kendi köşe yuvarlaması. Kart, RESMİ VE
     * KARARI olan şey içindir — bir bölge, bir bina, bir hedef. Göz
     * gezdirilen şey satır ister. Otuz yedi kart, otuz yedi ayrı nesne
     * gibi okunuyor ve aralarındaki tek fark olan SIRA kayboluyordu.
     *
     * Kendi satırın hâlâ ayrı duruyor — ama kart olarak değil, zemin ve
     * sol kenar vurgusuyla: listede kendini aramak bir dokunuşluk iş
     * olmamalı.
     */
    <div
      className={`border-b border-kenar/40 px-1.5 py-2 last:border-0 ${
        benMi ? 'rounded-lg border-b-0 bg-altin/10 ring-1 ring-altin/40' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="baslik flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px]"
          style={
            madalya
              ? { background: `color-mix(in srgb, ${madalya} 22%, transparent)`, color: madalya }
              : { background: 'var(--color-oyuk)', color: 'var(--color-sonuk)' }
          }
        >
          {r.sira}
        </span>
        {/* Arma: sıralama bir isim listesi olmaktan çıkıyor, yüzler
            listesi oluyor. Ortaçağda armanın tek işi buydu — kalabalıkta
            kim olduğunu söylemek (docs/10 §1.1). */}
        <Arma arma={r.arma} boyut={26} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium">{r.name}</span>
            {r.tahtSahibi && <Rozet renk="var(--color-altin)">DİYARIN LORDU</Rozet>}
          </div>
          <div className="truncate text-[11px] text-sonuk">{`${r.unvan} · Sv ${r.level} · ${r.bolgeSayisi} bölge`}</div>
        </div>
        <span className="tabular shrink-0 text-[14px] font-bold" style={{ color: renk }}>
          {formatSayi(r.deger)}
        </span>

        {/* Şikâyet yalnızca başkası için: kendini şikâyet etmek anlamsız,
            sunucu da reddediyor. */}
        {onRapor && !benMi && (
          <button
            onClick={() => onRapor(r)}
            aria-label={`${r.name} adlı lordu şikâyet et`}
            className="bas -mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center text-[15px] leading-none text-sonuk"
            title="Şikâyet et"
          >
            ⚑
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * İttifak satırı.
 *
 * Lord satırından ayrı, çünkü sorular farklı: lordda "kim bu, şikâyet
 * edeyim mi", ittifakta "kaç kişiler, kaç bölge tutuyorlar". Tek bileşeni
 * ikisine birden uydurmak, her iki tarafta da yarısı boş bir satır demekti.
 */
function IttifakSatiri({ r, renk }: { r: IttifakSiralamaSatiri; renk: string }) {
  return (
    <Kart className="p-2.5" vurgu={r.benimki ? renk : undefined}>
      <div className="flex items-center gap-2">
        <span className="tabular w-6 shrink-0 text-center text-[12px] font-bold text-solgun">
          {r.sira}
        </span>
        <Arma arma={r.arma} boyut={24} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
          {r.ad} <span className="text-solgun">[{r.etiket}]</span>
        </span>
        <span className="baslik shrink-0 rounded-md bg-altin/15 px-1.5 py-0.5 text-[11px] text-altin">{`Sv ${r.seviye}`}</span>
        <span className="tabular w-16 shrink-0 text-right text-[13px] font-bold">
          {formatSayi(r.toplamSohret)}
        </span>
      </div>
      <div className="mt-1 pl-8 text-[11px] text-solgun">{`${r.uyeSayisi} üye · ${r.bolgeSayisi} bölge`}</div>
    </Kart>
  );
}

export function Siralama({
  lordId,
  onKapiAc,
  onGit,
}: {
  lordId: string;
  /** Boş hâllerden çıkış yolu — hiçbir ekran çıkmaz sokak olmamalı. */
  onKapiAc: (k: Kapi) => void;
  onGit: (s: Sekme) => void;
}) {
  const [board, setBoard] = useState<Board>('fame');
  const [raporlanan, setRaporlanan] = useState<RankingRow | null>(null);
  const [raporBilgi, setRaporBilgi] = useState<string | null>(null);
  /**
   * İki ayrı sorgu, tek ekran.
   *
   * İttifak sıralamasının satırları lord satırlarıyla aynı biçimde
   * değil (üye ve bölge sayısı taşıyorlar). Tek sorguya sıkıştırıp
   * arayüzde ayırsaydık, iki farklı şeyi tek tipmiş gibi göstermek
   * için ikisini de yoksullaştırmak gerekirdi.
   */
  const lordluk = board !== 'ittifak';
  const q = useQuery({
    queryKey: ['rankings', board],
    queryFn: () => api.rankings(board as 'fame' | 'conquest' | 'elo'),
    refetchInterval: 60_000,
    enabled: lordluk,
  });
  const qi = useQuery({
    queryKey: ['rankings-ittifak'],
    queryFn: () => api.ittifakSiralamasi(),
    refetchInterval: 60_000,
    enabled: !lordluk,
  });
  const aktif = TABLAR.find((t) => t.key === board)!;

  return (
    <div className="space-y-4">
      <Zemin
        ad="siralama"
        baslik="Sıralama"
        altyazi={lordluk ? 'Diyarın lordları' : 'Diyarın ittifakları'}
      />
      <div className="oyuk flex gap-1 rounded-xl p-1">
        {TABLAR.map((t) => (
          <button
            key={t.key}
            onClick={() => setBoard(t.key)}
            aria-pressed={board === t.key}
            className={`bas baslik flex-1 rounded-lg py-2.5 text-[12px] ${
              board === t.key ? 'text-gece' : 'text-solgun'
            }`}
            style={board === t.key ? { background: t.renk } : undefined}
          >
            {t.ad}
          </button>
        ))}
      </div>

      <Bolum
        baslik={`${aktif.ad} Sıralaması`}
        yan={
          <span className="text-[11px] text-sonuk">
            {lordluk
              ? q.data
                ? `${q.data.toplam} lord`
                : ''
              : qi.data
                ? `${qi.data.toplam} ittifak`
                : ''}
          </span>
        }
      >
        <p className="mb-2 px-1 text-[11px] text-sonuk">{aktif.aciklama}</p>

        {!lordluk ? (
          !qi.data ? (
            <Kart className="p-4">
              <p className="text-[13px] text-solgun">Yükleniyor...</p>
            </Kart>
          ) : qi.data.satirlar.length === 0 ? (
            <BosHal
              ikon={<IkonNavSiralama boyut={26} />}
              mesaj="Bu diyarda henüz ittifak yok. İlkini sen kurabilirsin."
              eylemler={[{ etiket: 'İttifaka git', onTikla: () => onKapiAc('ittifak') }]}
            />
          ) : (
            <>
              <div className="space-y-1.5">
                {qi.data.satirlar.map((r) => (
                  <IttifakSatiri key={r.id} r={r} renk={aktif.renk} />
                ))}
              </div>
              {qi.data.benim && !qi.data.satirlar.some((r) => r.benimki) && (
                <div className="mt-3 border-t border-kenar pt-3">
                  <p className="baslik mb-1.5 px-1 text-[11px] text-solgun">İttifakının sırası</p>
                  <IttifakSatiri r={qi.data.benim} renk={aktif.renk} />
                </div>
              )}
            </>
          )
        ) : q.isLoading || !q.data ? (
          <Kart className="p-4">
            <p className="text-[13px] text-solgun">Yükleniyor...</p>
          </Kart>
        ) : (
          <>
            <div className="oyuk rounded-xl border border-kenar px-1 py-0.5">
              {q.data.satirlar.map((r) => (
                <Satir
                  key={r.lordId}
                  r={r}
                  benMi={r.lordId === lordId}
                  renk={aktif.renk}
                  onRapor={setRaporlanan}
                />
              ))}
            </div>

            {q.data.benim && !q.data.satirlar.some((r) => r.lordId === lordId) && (
              <div className="mt-3 border-t border-kenar pt-3">
                <p className="baslik mb-1.5 px-1 text-[11px] text-solgun">Senin sıran</p>
                <Satir r={q.data.benim} benMi renk={aktif.renk} />
              </div>
            )}

            {q.data.satirlar.length === 0 && (
              // Boş hâl kendi kartını çiziyor; burada ikinci bir kartla
              // sarmak iç içe iki kart demekti.
              <BosHal
                ikon={<IkonNavSiralama boyut={26} />}
                mesaj="Bu tabloda henüz kimse yok. Sıralamaya girmenin yolu bölge almaktan geçiyor."
                eylemler={[{ etiket: 'Haritaya git', onTikla: () => onGit('harita') }]}
              />
            )}
          </>
        )}
      </Bolum>
      {raporBilgi && <p className="px-1 text-center text-[12px] text-yesil">{raporBilgi}</p>}

      {raporlanan && (
        <SikayetSayfasi
          baslik={`${raporlanan.name} şikâyet`}
          onKapat={() => setRaporlanan(null)}
          onGonderildi={setRaporBilgi}
          gonder={(sebep, aciklama) => api.raporEt(raporlanan.lordId, sebep, aciklama)}
        />
      )}
    </div>
  );
}
