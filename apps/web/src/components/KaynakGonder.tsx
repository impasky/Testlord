/**
 * İttifak üyesine kaynak gönderme (docs/09 B6).
 *
 * Takas değil gönderim: karşılıklı takas iki tarafın onayını ve bir teklif
 * kuyruğunu gerektiriyor, beklemeli bir oyunda bu üç yeni ekran demek.
 * Tek yönlü gönderim aynı işi görüyor — ihtiyacı olana kaynak gidiyor.
 *
 * Kart iki freni de AÇIKÇA söylüyor: kaynağın yolda geçireceği süre ve
 * günlük tavan. Fren görünmezse oyuncu reddedilen bir gönderimle
 * karşılaşıp nedenini anlamıyor.
 */
import type { Resources } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type IttifakUyesiDto } from '../api/client';
import { IkonAltin, IkonDemir, IkonErzak } from './Ikonlar';
import { hisOnay, hisRet } from './hisGeriBildirimi';
import { Bolum, Buton, EngelNotu, Input, Kart, formatKalan, formatSayi } from './ui';

const BOS: Resources = { altin: 0, demir: 0, erzak: 0 };

export function KaynakGonder({
  uyeler,
  benimId,
}: {
  uyeler: IttifakUyesiDto[];
  benimId: string;
}) {
  const qc = useQueryClient();
  const [alici, setAlici] = useState<string>('');
  const [yuk, setYuk] = useState<Resources>(BOS);
  const [hata, setHata] = useState<string | null>(null);

  const q = useQuery({ queryKey: ['ticaret'], queryFn: api.ticaret, staleTime: 15_000 });
  const gonder = useMutation({
    mutationFn: () => api.kaynakGonder(alici, yuk),
    onSuccess: () => {
      hisOnay();
      setHata(null);
      setYuk(BOS);
      void qc.invalidateQueries({ queryKey: ['ticaret'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Gönderilemedi.');
    },
  });

  const digerleri = uyeler.filter((u) => u.id !== benimId);
  if (digerleri.length === 0 || !q.data) return null;

  const { giden, gelen, gunlukTavan, kalanTavan } = q.data;
  const toplam = yuk.altin + yuk.demir + yuk.erzak;
  const gonderilebilir = Boolean(alici) && toplam > 0 && !gonder.isPending;

  const alan = (
    ad: keyof Resources,
    etiket: string,
    ikon: React.ReactNode,
    renk: string,
  ) => (
    <div className="flex items-center gap-2">
      <span className={renk}>{ikon}</span>
      <span className="w-12 shrink-0 text-[12px] text-solgun">{etiket}</span>
      <div className="min-w-0 flex-1">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={yuk[ad] === 0 ? '' : String(yuk[ad])}
          onChange={(e) => setYuk({ ...yuk, [ad]: Math.max(0, Number(e.target.value) || 0) })}
          placeholder="0"
        />
      </div>
    </div>
  );

  return (
    <Bolum baslik="Kaynak Gönder">
      <Kart className="p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {digerleri.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setAlici(alici === u.id ? '' : u.id)}
              className={`bas min-h-11 rounded-lg border px-3 py-2 text-[12px] ${
                alici === u.id ? 'border-altin/70 bg-altin/15 text-altin' : 'border-kenar text-solgun'
              }`}
            >
              {u.ad}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {alan('altin', 'Altın', <IkonAltin boyut={15} />, 'text-altin')}
          {alan('demir', 'Demir', <IkonDemir boyut={15} />, 'text-mavi')}
          {alan('erzak', 'Erzak', <IkonErzak boyut={15} />, 'text-yesil')}
        </div>

        <Buton className="mt-2" tam onClick={() => gonder.mutate()} disabled={!gonderilebilir}>
          {gonder.isPending ? 'Yola çıkıyor…' : 'Gönder'}
        </Buton>

        {/* Frenler açıkça yazıyor: görünmeyen fren, reddedilen bir
            gönderimle karşılaşıp nedenini anlamamak demek. */}
        <p className="mt-1.5 text-[11px] text-sonuk">
          Kaynak yolda vakit geçirir. Bugün {formatSayi(kalanTavan)} /{' '}
          {formatSayi(gunlukTavan)} değerinde daha gönderebilirsin.
        </p>
        {hata && <EngelNotu kisa={hata} uzun="Miktarı ve alıcıyı gözden geçir." />}

        {(giden.length > 0 || gelen.length > 0) && (
          <ul className="mt-2.5 space-y-1 border-t border-kenar/70 pt-2.5 text-[12px]">
            {giden.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-solgun">
                  → {s.kime}: {formatSayi(s.yuk.altin)}a · {formatSayi(s.yuk.demir)}d ·{' '}
                  {formatSayi(s.yuk.erzak)}e
                </span>
                <span className="tabular shrink-0 text-sonuk">
                  {formatKalan(new Date(s.arriveAt).getTime() - Date.now())}
                </span>
              </li>
            ))}
            {gelen.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-yesil">
                  ← {s.kimden}: {formatSayi(s.yuk.altin)}a · {formatSayi(s.yuk.demir)}d ·{' '}
                  {formatSayi(s.yuk.erzak)}e
                </span>
                <span className="tabular shrink-0 text-sonuk">
                  {formatKalan(new Date(s.arriveAt).getTime() - Date.now())}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Kart>
    </Bolum>
  );
}
