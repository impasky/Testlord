/**
 * Görevler — "nereye gidiyorum" sayfası.
 *
 * Günlük görevler, haftalık sefer ve başarımlar üçü de aynı soruyu
 * cevaplıyor: bundan sonra ne için oynayacağım. Üçü Malikâne'nin içinde,
 * kuyrukların ve olay akışının arasına sıkışmış duruyordu; Malikâne'yi
 * iki buçuk ekrana çıkaran şeyin yarısı buydu.
 *
 * Malikâne'de bir ÖZET şerit kalıyor (docs/09 K4: yarın geri gelme sebebi
 * görünmezse işe yaramaz), ayrıntı buraya taşındı.
 */
import { Basarimlar } from '../components/Basarimlar';
import { GunlukKart } from '../components/GunlukKart';
import { SeferKart } from '../components/SeferKart';
import { Zemin } from '../components/Zemin';
import type { LordState } from '../api/client';
import type { Kapi } from '@lordlar/shared';
import type { Sekme } from '../components/MobilKabuk';

export function Gorevler({
  lord,
  onGit,
  onKapiAc,
}: {
  lord: LordState;
  onGit: (s: Sekme) => void;
  onKapiAc: (k: Kapi) => void;
}) {
  return (
    <div className="space-y-4">
      <Zemin ad="gorevler" baslik="Görevler" altyazi="Bugün, bu hafta ve kilometre taşları" />
      <GunlukKart onGit={onGit} onKapiAc={onKapiAc} />
      <SeferKart />
      <Basarimlar olcutler={lord.basarimOlcutleri} />
    </div>
  );
}
