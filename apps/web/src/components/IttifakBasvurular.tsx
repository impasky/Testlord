/**
 * Başvuru kutusu: liderin "kimi alıyorum" ekranı.
 *
 * İki iş bir arada, çünkü ikisi tek bir karar. Üstte KAPI (herkes girer mi,
 * en az kaçıncı seviye), altta KUYRUK (bekleyenler). Ayırsaydık lider
 * kuyruğu boşaltırken kapının açık olduğunu görmezdi ve aynı kuyruk
 * yeniden dolardı.
 *
 * Kabul/ret yetkisi yaşlıda da var (yonetebilirMi), ama kapı ayarı yalnız
 * liderde: kuyruğa bakmak paylaşılabilir bir iş, ittifakın kime açık
 * olduğuna karar vermek değil.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api } from '../api/client';
import { hisOnay, hisRet } from './hisGeriBildirimi';
import { Arma } from './Arma';
import { Bolum, Buton, EngelNotu, Kart, Rozet, formatSayi } from './ui';
import { BosHal } from './BosHal';

export function IttifakBasvurular() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['ittifak-basvurular'],
    queryFn: api.ittifakBasvurular,
    staleTime: 10_000,
  });
  const [hata, setHata] = useState<string | null>(null);

  const tazele = () => {
    void qc.invalidateQueries({ queryKey: ['ittifak-basvurular'] });
    void qc.invalidateQueries({ queryKey: ['ittifak'] });
    void qc.invalidateQueries({ queryKey: ['me'] });
  };
  const ortak = {
    onSuccess: () => {
      hisOnay();
      setHata(null);
      tazele();
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'İşlem yapılamadı.');
    },
  };

  const karar = useMutation({
    mutationFn: ({ id, kabul }: { id: string; kabul: boolean }) =>
      api.ittifakBasvuruKarar(id, kabul),
    ...ortak,
  });
  const ayarla = useMutation({
    mutationFn: (v: { katilim?: 'acik' | 'basvuru'; asgariSeviye?: number }) =>
      api.ittifakAyarlar(v),
    ...ortak,
  });
  const bekliyor = karar.isPending || ayarla.isPending;

  if (!q.data?.yonetebilir) return null;
  const { basvurular, lider, katilim, asgariSeviye = 1, bosYer = 0, azamiAsgariSeviye = 30 } = q.data;

  return (
    <>
      {lider && (
        <Bolum baslik="İttifakın Kapısı">
          <Kart className="p-3">
            <p className="mb-2 text-[12px] text-solgun">
              {katilim === 'acik'
                ? 'Şu an isteyen herkes doğrudan katılabiliyor.'
                : 'Şu an yalnız onayladığın lordlar katılıyor.'}
            </p>
            <div className="flex gap-2">
              <Buton
                tur={katilim === 'basvuru' ? 'altin' : 'sessiz'}
                boy="kucuk"
                tam
                disabled={bekliyor || katilim === 'basvuru'}
                onClick={() => ayarla.mutate({ katilim: 'basvuru' })}
              >
                Başvuru ile
              </Buton>
              <Buton
                tur={katilim === 'acik' ? 'altin' : 'sessiz'}
                boy="kucuk"
                tam
                disabled={bekliyor || katilim === 'acik'}
                onClick={() => ayarla.mutate({ katilim: 'acik' })}
              >
                Herkes katılsın
              </Buton>
            </div>

            {/* Seviye eşiği HER İKİ kapıda da geçerli: "herkese açığım ama
                Lv10 altı gelmesin" meşru bir kural ve kapıyı kapatmayı
                gerektirmemeli. */}
            <div className="mt-3 border-t border-kenar/60 pt-3">
              <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                <span className="text-solgun">En düşük seviye</span>
                <span className="tabular font-bold">
                  {asgariSeviye === 1 ? 'eşik yok' : `Sv ${asgariSeviye}`}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={azamiAsgariSeviye}
                value={asgariSeviye}
                disabled={bekliyor}
                onChange={(e) => ayarla.mutate({ asgariSeviye: Number(e.target.value) })}
                className="w-full accent-[var(--color-altin)]"
                aria-label="En düşük üye seviyesi"
              />
              <p className="mt-1 text-[11px] text-solgun">
                Eşiğin altındaki lordlar başvuramaz. Kuyruğu senin yerine süzer.
              </p>
            </div>
          </Kart>
        </Bolum>
      )}

      <Bolum
        baslik={basvurular.length ? `Başvurular (${basvurular.length})` : 'Başvurular'}
        sakin={basvurular.length === 0}
      >
        {basvurular.length === 0 ? (
          <BosHal
            mesaj={
              katilim === 'acik'
                ? 'Kapı herkese açık, başvuru gelmiyor.'
                : 'Bekleyen başvuru yok.'
            }
            eylemler={[]}
          />
        ) : (
          <ul className="space-y-2">
            {basvurular.map((b) => (
              <li key={b.id}>
                <Kart className="p-3">
                  <div className="flex items-center gap-2">
                    <Arma arma={b.lord.arma} boyut={26} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                      {b.lord.ad}
                    </span>
                    <Rozet>Sv {b.lord.seviye}</Rozet>
                    <span className="tabular shrink-0 text-[12px] text-solgun">
                      {formatSayi(b.lord.sohret)}
                    </span>
                  </div>
                  {b.mesaj && <p className="mt-2 text-[12px] text-solgun">“{b.mesaj}”</p>}
                  <div className="mt-2 flex gap-2">
                    <Buton
                      tur="yesil"
                      boy="kucuk"
                      tam
                      disabled={bekliyor || bosYer <= 0}
                      onClick={() => karar.mutate({ id: b.id, kabul: true })}
                    >
                      {bosYer <= 0 ? 'İttifak dolu' : 'Kabul et'}
                    </Buton>
                    <Buton
                      tur="sessiz"
                      boy="kucuk"
                      tam
                      disabled={bekliyor}
                      onClick={() => karar.mutate({ id: b.id, kabul: false })}
                    >
                      Reddet
                    </Buton>
                  </div>
                </Kart>
              </li>
            ))}
          </ul>
        )}
        {hata && (
          <div className="mt-2">
            <EngelNotu kisa={hata} uzun="Başvuru bu arada değişmiş olabilir; sayfayı tazele." />
          </div>
        )}
      </Bolum>
    </>
  );
}
