/**
 * İttifak ekranı.
 *
 * docs/09 §2.1: türün en büyük kaldıracı ittifak ve bizde hiç yoktu —
 * oyuncu 60 bölgelik bir diyarda tek başına oynuyordu.
 *
 * Ekran iki hâlde: ittifakın varsa üyeler ve ayrılma, yoksa kurma ve
 * katılma. İkisi de aynı listeyi gösteriyor; "hangi ittifaklar var"
 * sorusu üye olsan da olmasan da aynı soru.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type IttifakDto } from '../api/client';
import { IkonAltin, IkonSohret } from '../components/Ikonlar';
import { hisOnay, hisRet } from '../components/hisGeriBildirimi';
import { BosHal } from '../components/BosHal';
import { IttifakSohbet } from '../components/IttifakSohbet';
import {
  Bolum,
  Buton,
  EngelNotu,
  Input,
  Iskelet,
  Kart,
  Rozet,
  formatKalan,
  formatSayi,
} from '../components/ui';

function UyeSatiri({
  uye,
  liderMiyim,
  benimId,
  onCikar,
  bekliyor,
}: {
  uye: IttifakDto['ittifakim'] extends null ? never : NonNullable<IttifakDto['ittifakim']>['uyeler'][number];
  liderMiyim: boolean;
  benimId: string;
  onCikar: (id: string) => void;
  bekliyor: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      <span className="min-w-0 flex-1 truncate">
        <span className={uye.id === benimId ? 'font-bold text-altin' : ''}>{uye.ad}</span>
        {uye.lider && (
          <span className="ml-1.5 align-middle">
            <Rozet renk="var(--color-altin)">lider</Rozet>
          </span>
        )}
      </span>
      <span className="tabular w-10 shrink-0 text-right text-[11px] text-solgun">
        Sv {uye.seviye}
      </span>
      <span className="tabular flex w-20 shrink-0 items-center justify-end gap-1 font-bold">
        <span className="text-altin/70">
          <IkonSohret boyut={13} />
        </span>
        {formatSayi(uye.sohret)}
      </span>
      {liderMiyim && !uye.lider && (
        <Buton
          tur="sessiz"
          boy="kucuk"
          onClick={() => onCikar(uye.id)}
          disabled={bekliyor}
          className="shrink-0"
        >
          çıkar
        </Buton>
      )}
    </li>
  );
}

export function Ittifak({ lordId }: { lordId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ittifak'], queryFn: api.ittifak, staleTime: 15_000 });
  const [ad, setAd] = useState('');
  const [etiket, setEtiket] = useState('');
  const [hata, setHata] = useState<string | null>(null);

  const tazele = () => {
    void qc.invalidateQueries({ queryKey: ['ittifak'] });
    void qc.invalidateQueries({ queryKey: ['me'] });
  };
  const yut = (e: unknown) => {
    hisRet();
    setHata(e instanceof ApiError ? e.message : 'İşlem yapılamadı.');
  };
  const basarili = () => {
    hisOnay();
    setHata(null);
    tazele();
  };

  const kur = useMutation({
    mutationFn: () => api.ittifakKur(ad, etiket),
    onSuccess: () => {
      setAd('');
      setEtiket('');
      basarili();
    },
    onError: yut,
  });
  const katil = useMutation({
    mutationFn: (id: string) => api.ittifakKatil(id),
    onSuccess: basarili,
    onError: yut,
  });
  const ayril = useMutation({ mutationFn: api.ittifakAyril, onSuccess: basarili, onError: yut });
  const cikar = useMutation({
    mutationFn: (id: string) => api.ittifakUyeCikar(id),
    onSuccess: basarili,
    onError: yut,
  });
  const hedefKaldir = useMutation({
    mutationFn: () => api.ittifakHedef(null),
    onSuccess: basarili,
    onError: yut,
  });
  const bekliyor =
    kur.isPending ||
    katil.isPending ||
    ayril.isPending ||
    cikar.isPending ||
    hedefKaldir.isPending;

  if (!q.data) return <Iskelet />;
  const { ittifakim, liste, altin, kurmaMaliyeti, azamiUye, bekleme } = q.data;
  const liderMiyim = ittifakim?.liderId === lordId;

  return (
    <>
      {ittifakim ? (
        <Bolum baslik={`${ittifakim.ad} [${ittifakim.etiket}]`}>
          <Kart className="p-3" vurgu="var(--color-altin)">
            <div className="mb-2 flex items-baseline justify-between gap-2 text-[12px]">
              <span className="text-solgun">
                {ittifakim.uyeler.length}/{ittifakim.azamiUye} üye
              </span>
              <span className="tabular flex items-center gap-1">
                <span className="text-altin/70">
                  <IkonSohret boyut={13} />
                </span>
                <span className="font-bold">{formatSayi(ittifakim.toplamSohret)}</span>
                <span className="text-solgun">toplam şöhret</span>
              </span>
            </div>

            <ul className="space-y-1.5">
              {ittifakim.uyeler.map((u) => (
                <UyeSatiri
                  key={u.id}
                  uye={u}
                  liderMiyim={liderMiyim}
                  benimId={lordId}
                  onCikar={(id) => cikar.mutate(id)}
                  bekliyor={bekliyor}
                />
              ))}
            </ul>

            <div className="mt-2.5 border-t border-kenar/70 pt-2.5">
              <span className="baslik text-[11px] text-solgun">Ortak hedef</span>
              {ittifakim.hedef ? (
                <p className="mt-1 text-[12px]">
                  <span className="font-bold text-mavi">{ittifakim.hedef.ad}</span>
                  {ittifakim.hedef.not && (
                    <span className="text-solgun"> — {ittifakim.hedef.not}</span>
                  )}
                  <span className="block text-[11px] text-sonuk">
                    Haritada kesik çizgiyle işaretli.
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-[12px] text-sonuk">
                  {liderMiyim
                    ? 'Haritadan bir bölge seç ve "İttifak hedefi yap" de.'
                    : 'Lider henüz bir hedef işaretlemedi.'}
                </p>
              )}
              {liderMiyim && ittifakim.hedef && (
                <Buton
                  tur="sessiz"
                  boy="kucuk"
                  className="mt-1.5"
                  onClick={() => hedefKaldir.mutate()}
                  disabled={bekliyor}
                >
                  Hedefi kaldır
                </Buton>
              )}
            </div>

            <p className="mt-2.5 border-t border-kenar/70 pt-2.5 text-[11px] text-sonuk">
              İttifak üyelerine saldıramazsın, onlar da sana saldıramaz.
            </p>

            <Buton
              tur="sessiz"
              tam
              className="mt-2"
              onClick={() => ayril.mutate()}
              disabled={bekliyor}
            >
              {liderMiyim ? 'Ayrıl (liderlik devredilir)' : 'İttifaktan ayrıl'}
            </Buton>
          </Kart>
        </Bolum>
      ) : (
        <Bolum baslik="İttifak Kur">
          <Kart className="p-3">
            <p className="mb-2 text-[12px] text-solgun">
              Tek başına oynamak zorunda değilsin. İttifak üyeleri birbirine saldıramaz.
            </p>
            <Input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="İttifak adı"
              maxLength={24}
            />
            <div className="mt-2">
              <Input
                value={etiket}
                onChange={(e) => setEtiket(e.target.value.toUpperCase())}
                placeholder="Etiket (2-5 harf)"
                maxLength={5}
              />
            </div>
            <Buton
              tam
              className="mt-2"
              onClick={() => kur.mutate()}
              disabled={bekliyor || !ad.trim() || !etiket.trim() || altin < kurmaMaliyeti}
            >
              <span className="mr-1.5 inline-block align-[-2px]">
                <IkonAltin boyut={14} />
              </span>
              Kur · {formatSayi(kurmaMaliyeti)}
            </Buton>
            {altin < kurmaMaliyeti && (
              <EngelNotu
                kisa="Altının yetmiyor"
                uzun={`İttifak kurmak ${formatSayi(kurmaMaliyeti)} altın tutuyor; ${formatSayi(
                  altin,
                )} altının var.`}
              />
            )}
          </Kart>
        </Bolum>
      )}

      {ittifakim && <IttifakSohbet lordId={lordId} />}

      {hata && (
        <div className="px-3">
          <EngelNotu kisa={hata} uzun="Kuralları sağladığından emin ol ve tekrar dene." />
        </div>
      )}

      <Bolum baslik="Diyarın İttifakları">
        {liste.length === 0 ? (
          <BosHal
            mesaj="Bu diyarda henüz ittifak yok. İlkini sen kurabilirsin."
            eylemler={[]}
          />
        ) : (
          <ul className="space-y-2">
            {liste.map((a, i) => (
              <li key={a.id}>
                <Kart className="p-3" vurgu={a.benimki ? 'var(--color-altin)' : undefined}>
                  <div className="flex items-center gap-2">
                    <span className="tabular w-6 shrink-0 text-[12px] text-solgun">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                      {a.ad} <span className="text-solgun">[{a.etiket}]</span>
                    </span>
                    <span className="tabular shrink-0 text-[11px] text-solgun">
                      {a.uyeSayisi}/{azamiUye}
                    </span>
                    <span className="tabular flex w-20 shrink-0 items-center justify-end gap-1 text-[13px] font-bold">
                      <span className="text-altin/70">
                        <IkonSohret boyut={13} />
                      </span>
                      {formatSayi(a.toplamSohret)}
                    </span>
                  </div>

                  {!ittifakim && (
                    <Buton
                      tur="sessiz"
                      boy="kucuk"
                      tam
                      className="mt-2"
                      onClick={() => katil.mutate(a.id)}
                      disabled={bekliyor || a.uyeSayisi >= azamiUye || bekleme !== null}
                    >
                      {a.uyeSayisi >= azamiUye
                        ? 'Dolu'
                        : bekleme
                          ? `${formatKalan(bekleme.kalanSn * 1000)} sonra katılabilirsin`
                          : 'Katıl'}
                    </Buton>
                  )}
                </Kart>
              </li>
            ))}
          </ul>
        )}
      </Bolum>
    </>
  );
}
