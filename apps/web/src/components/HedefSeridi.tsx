/**
 * "Sıradaki hedef" — oyunun oyuncuya somut bir amaç gösterdiği yer.
 *
 * Oyunun ilk gerçek testinde oyuncu asker üretti, rastgele bir yere saldırdı
 * ve "eee ne oldu şimdi, ne işe yarayacak bu saldırı" deyip çıktı. Asker
 * eğitmenin de saldırmanın da bir sebebi vardı ama o sebep hiçbir ekranda
 * yazmıyordu. Bu şerit sebebi yazar: hangi bölge, ne kazandırır, ordun
 * yetiyor mu. (docs/08 İ1, İ4)
 *
 * Hedef sunucudan gelir ve gerçek savaş simülasyonuyla seçilir — burada
 * ikinci bir sezgisel kural yok.
 */
import { unitName, type UnitType } from '@lordlar/shared';
import type { HedefOnerisiDto } from '../api/client';
import { BolgeIkonu, IkonAltin, IkonDemir, IkonErzak, IkonSohret } from './Ikonlar';
import { Buton, Hap, Kart, formatKalan, formatSayi } from './ui';

const TIP_ADI: Record<string, string> = {
  tarla: 'Tarla',
  maden: 'Maden',
  sehir: 'Şehir',
  kale: 'Kale',
  taht: 'Taht Kalesi',
};

export function HedefGeliri({ hedef }: { hedef: HedefOnerisiDto }) {
  const g = hedef.saatlikGelir;
  const kalemler = [
    { v: g.altin, ikon: <IkonAltin boyut={13} />, ad: 'altin' },
    { v: g.demir, ikon: <IkonDemir boyut={13} />, ad: 'demir' },
    { v: g.erzak, ikon: <IkonErzak boyut={13} />, ad: 'erzak' },
  ].filter((k) => k.v > 0);

  return (
    <>
      {kalemler.map((k) => (
        <Hap key={k.ad} ikon={k.ikon} renk="var(--color-yesil)">
          +{formatSayi(k.v)}/sa
        </Hap>
      ))}
      {g.sohret > 0 && (
        <Hap ikon={<IkonSohret boyut={13} />} renk="var(--color-yesil)">
          +{g.sohret}/sa
        </Hap>
      )}
    </>
  );
}

export function HedefSeridi({
  hedef,
  baslik = 'Sıradaki hedef',
  onAc,
}: {
  hedef: HedefOnerisiDto;
  baslik?: string;
  onAc?: () => void;
}) {
  const eksik = hedef.eksik;
  return (
    <Kart className="p-3" vurgu={hedef.kazanir ? 'var(--color-yesil)' : undefined}>
      <div className="baslik mb-2 text-[11px] text-sonuk">{baslik}</div>

      <div className="flex items-center gap-2.5">
        <span className="shrink-0 text-altin">
          <BolgeIkonu tip={hedef.type} boyut={26} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="baslik truncate text-[16px] text-parsomen">{hedef.name}</div>
          <div className="text-[11px] text-sonuk">
            {TIP_ADI[hedef.type] ?? hedef.type} · {formatKalan(hedef.marchSec * 1000)} yürüyüş
          </div>
        </div>
      </div>

      {/* Bütün sayılar rozette. Önceden burada dört satır düz yazı vardı ve
          aynı bilgi Malikâne'deki omurgada başka kelimelerle tekrar
          ediliyordu; iki ekranın aynı şeyi farklı anlatması "karman
          çorman" duygusunu büyütüyordu. */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <HedefGeliri hedef={hedef} />
        <Hap ikon={<IkonSohret boyut={13} />} renk="var(--color-yesil)">
          +{formatSayi(hedef.sohretFarki)}
        </Hap>
        {hedef.kazanir ? (
          <Hap renk="var(--color-yesil)">ordun yetiyor</Hap>
        ) : eksik ? (
          <>
            <Hap
              renk={eksik.karsilanabilir ? 'var(--color-altin)' : 'var(--color-kirmizi)'}
            >
              {eksik.adet} {unitName(eksik.birim as UnitType)} daha
            </Hap>
            <Hap
              ikon={<IkonAltin boyut={13} />}
              renk={
                eksik.karsilanabilir ? 'var(--color-kaynak-altin)' : 'var(--color-kirmizi)'
              }
            >
              {formatSayi(eksik.maliyet.altin)}
            </Hap>
          </>
        ) : (
          <Hap renk="var(--color-turuncu)">{toplam(hedef.garrison)} savunan</Hap>
        )}
      </div>

      {hedef.limitDolu && (
        <p className="mt-2 text-[11px] leading-snug text-turuncu">
          Bölge limitin dolu — kazansan bile alamazsın.
        </p>
      )}

      {onAc && (
        <Buton className="mt-2.5" tam onClick={onAc}>
          {hedef.name} · haritada aç
        </Buton>
      )}
    </Kart>
  );
}

function toplam(a: Record<string, number | undefined>): number {
  return Object.values(a).reduce<number>((s, n) => s + (n ?? 0), 0);
}
