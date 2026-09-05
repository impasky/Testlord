/**
 * Dünya başlığı ve olay şeridi — haritayı yaşayan bir yer yapan iki parça.
 *
 * Oyunun ilk gerçek testinde oyuncu şunu sordu: "harita niye bu kadar küçük,
 * tek oyunculu bir oyun mu bu". İki ayrı sorun tek cümlede:
 *
 *  1. Haritada başka insan görünmüyordu. 61 altıgenin hiçbirinde lord adı
 *     yoktu, dünyada kaç kişi olduğu yazmıyordu, kimsenin ne yaptığı
 *     görünmüyordu. Diğer 119 oyuncu arayüzde yalnızca Sıralama ekranında
 *     bir liste olarak vardı.
 *  2. Gördüğü 61 hex'in "oyunun tamamı" olduğunu sanıyordu; dünyanın 120
 *     kişilik olduğu bilgisi hiçbir yerde geçmiyordu.
 *
 * Başlık ikinciyi, olay şeridi birinciyi çözüyor. Şerit veriyi Battle
 * tablosundan alıyor — yeni model yok, sahte veri yok: savaş yoksa şerit
 * hiç görünmüyor. (docs/08 İ5)
 */
import { useQuery } from '@tanstack/react-query';
import { api, type DunyaDto } from '../api/client';
import { IkonSaldiri, IkonTaht } from './Ikonlar';
import { Kart, formatSayi } from './ui';

/** "2 saat önce", "az önce". */
function nezaman(iso: string): string {
  const sn = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sn < 90) return 'az önce';
  const dk = Math.floor(sn / 60);
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} saat önce`;
  return `${Math.floor(sa / 24)} gün önce`;
}

export function DunyaBasligi({ dunya }: { dunya: DunyaDto }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-solgun">
      <span>
        <strong className="text-parsomen">{formatSayi(dunya.lordSayisi)}</strong> lorddan{' '}
        <strong className="text-parsomen">{formatSayi(dunya.aktifLord)}</strong>'i bu hafta oynadı
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <span className="text-altin">
          <IkonTaht boyut={11} />
        </span>
        {dunya.taht?.sahip ? (
          <strong className="text-altin">{dunya.taht.sahip.name}</strong>
        ) : (
          <span>taht sahipsiz</span>
        )}
      </span>

      {/* Lider avı: oyuncunun kimin peşine düşeceğini bilmesi gerekiyor.
          Lider bensem cümle tersine dönüyor — av benim üstümde. */}
      {dunya.liderAvi && (
        <>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <span className="text-kirmizi">
              <IkonSaldiri boyut={11} />
            </span>
            {dunya.liderAvi.benMiyim ? (
              <span>
                <strong className="text-kirmizi">av sensin</strong> · sana saldıran{' '}
                <strong className="text-parsomen">
                  +%{Math.round(dunya.liderAvi.yagmaBonusu * 100)}
                </strong>{' '}
                yağma alır
              </span>
            ) : (
              <span>
                lider avı <strong className="text-parsomen">{dunya.liderAvi.ad}</strong> ·{' '}
                <strong className="text-kirmizi">
                  +%{Math.round(dunya.liderAvi.yagmaBonusu * 100)}
                </strong>{' '}
                yağma
              </span>
            )}
          </span>
        </>
      )}
    </div>
  );
}

export function OlaySeridi({ onBolgeAc }: { onBolgeAc: (regionId: number) => void }) {
  const dunya = useQuery({ queryKey: ['dunya'], queryFn: api.dunya, refetchInterval: 60_000 });
  const olaylar = dunya.data?.olaylar ?? [];
  if (olaylar.length === 0) return null;

  return (
    <Kart className="p-3">
      <h3 className="baslik mb-2 text-[11px] text-solgun">Diyarda neler oluyor</h3>
      <ul className="space-y-1.5">
        {olaylar.slice(0, 6).map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onBolgeAc(o.bolgeId)}
              className="bas flex w-full items-baseline gap-2 text-left text-[12px]"
            >
              <span className="min-w-0 flex-1 leading-snug">
                <strong className="text-parsomen">{o.saldiran}</strong>{' '}
                {o.eleGecti ? (
                  <>
                    <span className="text-altin">{o.bolge}</span> bölgesini aldı
                  </>
                ) : o.saldiranKazandi ? (
                  <>
                    <span className="text-parsomen">{o.bolge}</span> bölgesini yağmaladı
                  </>
                ) : (
                  <>
                    <span className="text-parsomen">{o.bolge}</span> önünde püskürtüldü
                  </>
                )}
                {o.savunan && <span className="text-sonuk"> · {o.savunan}</span>}
              </span>
              <time className="shrink-0 text-[11px] text-sonuk">{nezaman(o.zaman)}</time>
            </button>
          </li>
        ))}
      </ul>
    </Kart>
  );
}
