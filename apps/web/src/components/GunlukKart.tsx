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
 * Görevler henüz ÖDÜL VERMİYOR. Ödül, "bugün alındı mı" durumunu
 * saklamak demek ve kaynak ödülü ekonomiyi dengelemeyi gerektiriyor;
 * ikisi de ayrı bir iş (docs/09 K4b). Şimdilik ödül serinin kendisi:
 * "yedi gün üst üste" görünür bir şey.
 */
import { gunlukSayaci } from '@lordlar/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Bolum, Kart } from './ui';

export function GunlukKart({ onGit }: { onGit: (s: 'harita' | 'kisla' | 'demirhane') => void }) {
  // Bir dakikalık tazelik yeterli: görevler gün boyunca değişiyor, saniye
  // saniye değil. Sık yoklamak üç sayım sorgusunu boşuna tekrarlardı.
  const q = useQuery({ queryKey: ['gunluk'], queryFn: api.gunluk, staleTime: 60_000 });
  if (!q.data) return null;

  const { gorevler, seri } = q.data;
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
        {hepsi && (
          <p className="mt-2 text-[12px] text-yesil">
            Bugünün üçü de tamam. Yarın seri {seri + 1} olur.
          </p>
        )}
      </Kart>
    </Bolum>
  );
}
