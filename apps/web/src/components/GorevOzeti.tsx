/**
 * Görev özeti — Malikâne'de duran tek satırlık şerit.
 *
 * Günlük görevler ve haftalık sefer kendi sayfalarına taşındı çünkü
 * Malikâne'yi iki buçuk ekrana çıkarıyorlardı. Ama tamamen kaldırmak
 * yanlış olurdu: docs/09 K4'ün bütün gerekçesi "yarın geri gelme sebebi"
 * ve görünmeyen bir sebep sebep değildir.
 *
 * Bu yüzden Malikâne'de KANCA kalıyor, ayrıntı sayfada. Şerit tek satır:
 * kaç görev bitti, seferde neredeyim, alınmayı bekleyen ödül var mı.
 * Ödül hazırsa şerit renk değiştiriyor — oyuncunun sayfaya gitmesi için
 * tek gerçek sebep o.
 */
import { useQuery } from '@tanstack/react-query';
import { gunlukSayaci } from '@lordlar/shared';
import { api } from '../api/client';
import { Hap, Kart } from './ui';

export function GorevOzeti({ onGit }: { onGit: () => void }) {
  const g = useQuery({ queryKey: ['gunluk'], queryFn: api.gunluk, staleTime: 60_000 });
  const s = useQuery({ queryKey: ['sefer'], queryFn: api.sefer, staleTime: 60_000 });
  if (!g.data && !s.data) return null;

  const sayac = g.data ? gunlukSayaci(g.data.gorevler) : null;
  const gunlukHazir = Boolean(sayac && sayac.tamam === sayac.toplam && !g.data?.odul.alindi);
  const seferHazir = Boolean(s.data?.sefer.tamam && !s.data.odul.alindi);
  const odulVar = gunlukHazir || seferHazir;

  return (
    <Kart className="p-3" onClick={onGit} vurgu={odulVar ? 'var(--color-yesil)' : undefined}>
      <div className="flex items-center gap-2">
        <span className="baslik shrink-0 text-[11px] text-solgun">GÖREVLER</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {sayac && (
            <Hap renk={sayac.tamam === sayac.toplam ? 'var(--color-yesil)' : undefined}>
              bugün {sayac.tamam}/{sayac.toplam}
            </Hap>
          )}
          {s.data && (
            <Hap renk={s.data.sefer.tamam ? 'var(--color-yesil)' : undefined}>
              sefer {s.data.sefer.simdi}/{s.data.sefer.hedef}
            </Hap>
          )}
        </div>
        <span className="baslik shrink-0 text-[10px] text-altin">
          {odulVar ? 'ÖDÜL HAZIR' : 'AÇ'}
        </span>
      </div>
    </Kart>
  );
}
