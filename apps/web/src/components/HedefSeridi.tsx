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
import type { HedefOnerisiDto } from '../api/client';
import { BolgeIkonu, IkonAltin, IkonDemir, IkonErzak, IkonSohret } from './Ikonlar';
import { Kart, formatKalan, formatSayi } from './ui';

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
    { v: g.altin, ikon: <IkonAltin boyut={11} />, ad: 'altın' },
    { v: g.demir, ikon: <IkonDemir boyut={11} />, ad: 'demir' },
    { v: g.erzak, ikon: <IkonErzak boyut={11} />, ad: 'erzak' },
  ].filter((k) => k.v > 0);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {kalemler.map((k) => (
        <span key={k.ad} className="tabular inline-flex items-center gap-1 text-yesil">
          <span className="opacity-80">{k.ikon}</span>+{formatSayi(k.v)}
        </span>
      ))}
      {g.sohret > 0 && (
        <span className="tabular inline-flex items-center gap-1 text-yesil">
          <IkonSohret boyut={11} />+{g.sohret}
        </span>
      )}
      <span className="text-[11px] text-sonuk">/ saat</span>
    </span>
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
  return (
    <Kart className="p-3" vurgu={hedef.kazanir ? 'var(--color-altin)' : 'var(--color-kenar)'}>
      <div className="baslik mb-2 text-[10px] text-solgun">{baslik}</div>

      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-altin">
          <BolgeIkonu tip={hedef.type} boyut={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="baslik text-[15px] text-parsomen">{hedef.name}</div>
          <div className="text-[11px] text-sonuk">
            {TIP_ADI[hedef.type] ?? hedef.type} · {hedef.distance} hex ·{' '}
            {formatKalan(hedef.marchSec * 1000)} yürüyüş
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1 text-[12px]">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-solgun">Alırsan:</span>
          <HedefGeliri hedef={hedef} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-solgun">Şöhretin:</span>
          <span className="tabular text-yesil">+{formatSayi(hedef.sohretFarki)}</span>
        </div>
      </div>

      <p
        className={`mt-2 text-[12px] leading-snug ${
          hedef.kazanir ? 'text-yesil' : 'text-turuncu'
        }`}
      >
        {hedef.kazanir
          ? `Ordun yetiyor — savaştan ${hedef.kalanBirim} birimin sağ çıkar.`
          : hedef.orduVar
            ? `Ordun henüz yetmiyor. Burayı ${toplam(hedef.garrison)} birim savunuyor; daha fazla asker eğit.`
            : `Burayı ${toplam(hedef.garrison)} birim savunuyor. Almak için önce bir ordu kur.`}
      </p>

      {hedef.limitDolu && (
        <p className="mt-1 text-[11px] leading-snug text-turuncu">
          Bölge limitin dolu. Kazansan bile bu bölgeyi alamazsın — önce seviye atla ya da bir
          bölgeni bırak.
        </p>
      )}

      {onAc && (
        <button
          type="button"
          onClick={onAc}
          className="bas baslik mt-2.5 w-full rounded-xl border border-altin-koyu bg-gradient-to-b from-altin to-altin-koyu px-4 py-2.5 text-[13px] text-gece shadow-[0_2px_0_rgba(0,0,0,0.35)]"
        >
          {hedef.name} · haritada aç
        </button>
      )}
    </Kart>
  );
}

function toplam(a: Record<string, number | undefined>): number {
  return Object.values(a).reduce<number>((s, n) => s + (n ?? 0), 0);
}
