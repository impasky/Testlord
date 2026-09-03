/**
 * Günlük görevler ve giriş serisi kartı.
 *
 * Omurga (docs/08 İ4) "şimdi ne yapmalısın" diyor. Bu kart farklı bir
 * soruya bakıyor: **oyuncu neden yarın geri gelsin?** Türün en ucuz ve en
 * etkili aracı bu (docs/09 §2.5).
 *
 * Üç görev sabit ve oyunun üç eksenine karşılık geliyor — savaş, ordu,
 * imar. Rastgele görev üretmedik: rastgelelik "bugün şanssızım" hissi
 * yaratıyor ve oyuncunun planlamasını bozuyor.
 *
 * Ödül BAŞTAN görünüyor, hak edilince belirmiyor: oyuncu üç işi neyin
 * için yaptığını bilmeli. Kilitli bir ödül sebeptir, sonradan çıkan bir
 * ödül sürprizdir — sürpriz kimseyi yarın geri getirmez.
 *
 * Ödül otomatik düşmüyor, oyuncu ALIYOR. Kendiliğinden gelen kaynak fark
 * edilmez bile; "Al" düğmesi günü bitiren küçük bir tören. (docs/09 K4b)
 */
import { gunlukSayaci } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { IkonAltin, IkonDemir, IkonErzak } from './Ikonlar';
import { Bolum, Buton, Kart, formatSayi } from './ui';

/** Ödülün üç kaynağı tek satırda. */
function OdulSatiri({ kaynak }: { kaynak: { altin: number; demir: number; erzak: number } }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1">
        <span className="text-altin">
          <IkonAltin boyut={13} />
        </span>
        <span className="tabular font-bold">{formatSayi(kaynak.altin)}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-mavi">
          <IkonDemir boyut={13} />
        </span>
        <span className="tabular font-bold">{formatSayi(kaynak.demir)}</span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-yesil">
          <IkonErzak boyut={13} />
        </span>
        <span className="tabular font-bold">{formatSayi(kaynak.erzak)}</span>
      </span>
    </span>
  );
}

export function GunlukKart({ onGit }: { onGit: (s: 'harita' | 'kisla' | 'demirhane') => void }) {
  // Bir dakikalık tazelik yeterli: görevler gün boyunca değişiyor, saniye
  // saniye değil. Sık yoklamak üç sayım sorgusunu boşuna tekrarlardı.
  const q = useQuery({ queryKey: ['gunluk'], queryFn: api.gunluk, staleTime: 60_000 });
  const qc = useQueryClient();
  const al = useMutation({
    mutationFn: api.gunlukOdul,
    // Kaynaklar da değişiyor: üst bardaki sayılar ödülden sonra eski
    // kalmamalı, yoksa oyuncu ödülü aldığını göremez.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['gunluk'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  if (!q.data) return null;

  const { gorevler, seri, odul } = q.data;
  const { tamam, toplam } = gunlukSayaci(gorevler);
  const hepsi = tamam === toplam;

  const hedef: Record<string, 'harita' | 'kisla' | 'demirhane'> = {
    saldiri: 'harita',
    egitim: 'kisla',
    imar: 'demirhane',
  };

  return (
    <Bolum baslik={`Bugün · ${tamam}/${toplam}`}>
      <Kart className="p-3" vurgu={hepsi ? 'var(--color-yesil)' : undefined}>
        {seri > 1 && (
          <p className="mb-2 text-[12px] text-solgun">
            <strong className="text-altin">{seri} gün</strong> üst üste giriyorsun.
          </p>
        )}
        <ul className="space-y-1.5">
          {gorevler.map((g) => (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => !g.tamam && onGit(hedef[g.key] ?? 'harita')}
                disabled={g.tamam}
                className="bas flex w-full items-center gap-2.5 text-left"
              >
                <span
                  className="baslik flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px]"
                  style={{
                    background: g.tamam ? 'var(--color-yesil)' : 'var(--color-oyuk)',
                    color: g.tamam ? 'var(--color-gece)' : 'var(--color-sonuk)',
                  }}
                >
                  {g.tamam ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`text-[13px] ${g.tamam ? 'text-solgun line-through' : 'text-parsomen'}`}
                  >
                    {g.ad}
                  </span>
                  {!g.tamam && (
                    <span className="block truncate text-[11px] text-sonuk">{g.aciklama}</span>
                  )}
                </span>
                {!g.tamam && <span className="baslik shrink-0 text-[10px] text-altin">git</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 border-t border-kenar/70 pt-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="baslik text-[11px] text-solgun">Günün ödülü</span>
            {odul.seriCarpani > 1 && (
              <span className="tabular text-[11px] text-altin">
                seri ×{odul.seriCarpani.toFixed(1)}
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-parsomen">
            <OdulSatiri kaynak={odul.kaynak} />
          </div>

          {odul.alindi ? (
            <p className="mt-2 text-[12px] text-yesil">
              Bugünün ödülü alındı. Yarın seri {seri + 1} olur, ödül de büyür.
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
                {al.isPending ? 'Alınıyor…' : 'Ödülü al'}
              </Buton>
              {al.data?.kirpildi && (
                <p className="mt-1.5 text-[11px] text-turuncu">
                  Deponun bir kısmı doluydu; sığan kadarı verildi.
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[12px] text-sonuk">
              Üç görevi de bitirince alınır ({tamam}/{toplam}).
            </p>
          )}
        </div>
      </Kart>
    </Bolum>
  );
}
