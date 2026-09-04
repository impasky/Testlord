/**
 * Haftalık sefer kartı.
 *
 * Günlük görev kartı yarını tutuyor, bu haftayı. Fark sadece süre değil:
 * günlük üç küçük iş, sefer TEK bir tema — bu hafta diyar neyle meşgul.
 *
 * Sıralama tablosu YOK, bilerek. Türün klasik etkinliği "en çok yağmalayan
 * ilk 10 ödül alır" olur; o, zaten önde olanı daha ilerletir ve geç
 * başlayan oyuncu hiçbir hafta ödül göremez. Hedef herkes için aynı:
 * ulaşan alır (docs/09 §3.4).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { IkonAltin, IkonDemir, IkonErzak } from './Ikonlar';
import { Bolum, Buton, Ilerleme, Kart, formatSayi } from './ui';

export function SeferKart() {
  // Sefer haftalık; dakikada bir yenilemek fazlasıyla yeter.
  const q = useQuery({ queryKey: ['sefer'], queryFn: api.sefer, staleTime: 60_000 });
  const qc = useQueryClient();
  const al = useMutation({
    mutationFn: api.seferOdul,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sefer'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  if (!q.data) return null;

  const { sefer, odul } = q.data;
  const yuzde = Math.min(1, sefer.simdi / Math.max(1, sefer.hedef));

  return (
    <Bolum baslik="Bu Haftanın Seferi">
      <Kart className="p-3" vurgu={sefer.tamam ? 'var(--color-yesil)' : 'var(--color-mavi)'}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="baslik text-[13px] text-parsomen">{sefer.ad}</h3>
          <span className="tabular shrink-0 text-[11px] text-solgun">
            {sefer.kalanGun} gün kaldı
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-sonuk">{sefer.aciklama}</p>

        <div className="mt-2 flex items-center gap-2">
          <span className="tabular shrink-0 text-[12px] text-parsomen">
            {sefer.simdi}/{sefer.hedef}{' '}
            <span className="text-solgun">{sefer.birim}</span>
          </span>
          <div className="min-w-0 flex-1">
            <Ilerleme
              deger={yuzde}
              max={1}
              renk={sefer.tamam ? 'var(--color-yesil)' : 'var(--color-mavi)'}
              boy="ince"
            />
          </div>
        </div>

        <div className="mt-2.5 border-t border-kenar/70 pt-2.5">
          <span className="baslik text-[11px] text-solgun">Sefer ödülü</span>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="flex items-center gap-1">
              <span className="text-altin">
                <IkonAltin boyut={13} />
              </span>
              <span className="tabular font-bold">{formatSayi(odul.kaynak.altin)}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-mavi">
                <IkonDemir boyut={13} />
              </span>
              <span className="tabular font-bold">{formatSayi(odul.kaynak.demir)}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-yesil">
                <IkonErzak boyut={13} />
              </span>
              <span className="tabular font-bold">{formatSayi(odul.kaynak.erzak)}</span>
            </span>
          </div>

          {odul.alindi ? (
            <p className="mt-2 text-[12px] text-yesil">
              Bu haftanın seferi tamamlandı ve ödülü alındı. Pazartesi yeni sefer açılır.
            </p>
          ) : odul.hakEdildi ? (
            <>
              <Buton
                tur="altin"
                tam
                className="mt-2"
                onClick={() => al.mutate()}
                disabled={al.isPending}
              >
                {al.isPending ? 'Alınıyor…' : 'Sefer ödülünü al'}
              </Buton>
              {al.data?.kirpildi && (
                <p className="mt-1.5 text-[11px] text-turuncu">
                  Deponun bir kısmı doluydu; sığan kadarı verildi.
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[12px] text-sonuk">
              {sefer.hedef - sefer.simdi} {sefer.birim} daha.
            </p>
          )}
        </div>
      </Kart>
    </Bolum>
  );
}
