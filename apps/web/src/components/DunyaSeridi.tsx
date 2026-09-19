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
 *  2. Gördüğü 61 bölgenin "oyunun tamamı" olduğunu sanıyordu; dünyanın 120
 *     kişilik olduğu bilgisi hiçbir yerde geçmiyordu.
 *
 * Başlık ikinciyi, olay şeridi birinciyi çözüyor. Şerit veriyi Battle
 * tablosundan alıyor — yeni model yok, sahte veri yok: savaş yoksa şerit
 * hiç görünmüyor. (docs/08 İ5)
 */
import { useQuery } from '@tanstack/react-query';
import { api, type DunyaDto } from '../api/client';
import { IkonSaldiri, IkonTaht } from './Ikonlar';
import { Kart, formatSayi, sablonlu } from './ui';

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

/**
 * Birleşme ilanı.
 *
 * Kendi satırında ve şeridin ÜSTÜNDE duruyor: haritanın birkaç gün sonra
 * bambaşka olacağı, "kaç lord var" bilgisinin yanına sıkıştırılacak bir
 * ayrıntı değil. Haritası bir sabah değişmiş oyuncu, oyunu bırakan
 * oyuncudur.
 *
 * Cümle iki taraf için farklı, çünkü olan şey farklı: konuk taşınıyor,
 * ev sahibi kalabalıklaşıyor.
 */
function BirlesmeIlani({ b }: { b: NonNullable<DunyaDto['birlesme']> }) {
  const kalanSaat = Math.max(
    0,
    Math.round((new Date(b.birlesmeAt).getTime() - Date.now()) / 3_600_000),
  );
  const ne = kalanSaat >= 24 ? `${Math.round(kalanSaat / 24)} gün` : `${kalanSaat} saat`;
  const vurgu = (x: string) => <strong className="text-altin">{x}</strong>;
  /*
   * Cümle TEK ŞABLON. İlk hâli JSX parçalarına bölünmüştü ve parçalar
   * çeviri listesine "cümle ortası" diye düşüp hiç çevrilmiyordu —
   * ilan, oyun İngilizceyken yarı Türkçe kalırdı. Sözcük sırası da
   * dilden dile değişiyor: şablon bütün olunca çevirmen onu taşıyabiliyor.
   */
  return (
    <p className="mb-1.5 rounded-xl border border-altin/40 bg-altin/10 px-3 py-2 text-[11.5px] leading-snug text-parsomen">
      {sablonlu(
        b.konukMuyum
          ? '{0} sonra {1} diyarına taşınıyorsun. Lordun, ordun, araştırman ve binaların geliyor; bölgelerin ancak orada boşsa geliyor, gelmeyenin bir günlük geliri kasana yazılıyor.'
          : '{0} sonra {1} diyarının lordları buraya geliyor. Taht sahipsiz kalacak — ilk alan Diyarın Lordu olur.',
        [vurgu(ne), vurgu(b.karsiDiyar)],
      )}
    </p>
  );
}

export function DunyaBasligi({ dunya }: { dunya: DunyaDto }) {
  return (
    <>
      {dunya.birlesme && <BirlesmeIlani b={dunya.birlesme} />}
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

        {/* Tahtı tutan MEDENİYET (docs/16 §13 soru 5). Taht artık bir
            lordun unvanı değil bir tarafın kazancı: tutan medeniyetin
            her üyesi şöhret çarpanı alıyor. Kolektif hedefin ekranda bir
            karşılığı olmalı. */}
        {dunya.taht?.medeniyet && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 shrink-0 rounded-full border border-gece"
                style={{ background: dunya.taht.medeniyet.renk }}
                aria-hidden
              />
              <span>
                <strong className="text-parsomen">{dunya.taht.medeniyet.ad}</strong>
                {dunya.taht.benimMedeniyetimde ? ' — medeniyetinin tahtı · ' : ' tahtta · '}
                <strong className="text-altin">
                  +%{Math.round(dunya.taht.medeniyetSohretBonusu * 100)}
                </strong>{' '}
                şöhret
              </span>
            </span>
          </>
        )}

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

        {/* Fraksiyon lider avı: bireyselin yanında AYRI bir satır.
          Biri bir lordu işaret ediyor, öbürü bir tarafı; ikisi üst üste
          binebildiği için aynı cümleye sıkıştırmak oyuncuya hangi
          bonusu ne zaman aldığını sorduracaktı. Rengi medeniyetin
          kendi rengi — haritadaki çerçeveyle aynı işaret. */}
        {dunya.medeniyetAvi && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 shrink-0 rounded-full border border-gece"
                style={{ background: dunya.medeniyetAvi.renk ?? 'var(--color-kirmizi)' }}
                aria-hidden
              />
              {dunya.medeniyetAvi.benimMi ? (
                <span>
                  <strong className="text-kirmizi">medeniyetin önde</strong> · toprağına saldıran{' '}
                  <strong className="text-parsomen">
                    +%{Math.round(dunya.medeniyetAvi.yagmaBonusu * 100)}
                  </strong>{' '}
                  yağma alır
                </span>
              ) : (
                <span>
                  <strong className="text-parsomen">{dunya.medeniyetAvi.ad}</strong> önde (%
                  {Math.round(dunya.medeniyetAvi.pay * 100)}) ·{' '}
                  <strong className="text-kirmizi">
                    +%{Math.round(dunya.medeniyetAvi.yagmaBonusu * 100)}
                  </strong>{' '}
                  yağma
                </span>
              )}
            </span>
          </>
        )}
      </div>
    </>
  );
}

export function OlaySeridi({ onBolgeAc }: { onBolgeAc: (regionId: number) => void }) {
  const dunya = useQuery({ queryKey: ['dunya'], queryFn: api.dunya, refetchInterval: 60_000 });
  const olaylar = dunya.data?.olaylar ?? [];
  if (olaylar.length === 0) return null;

  return (
    <Kart className="p-3">
      <h2 className="baslik mb-2 text-[11px] text-solgun">Diyarda neler oluyor</h2>
      <ul className="space-y-1.5">
        {olaylar.slice(0, 6).map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onBolgeAc(o.bolgeId)}
              // Satır 12px yazıyla 18px yüksekliğinde kalıyordu; WCAG
              // 2.5.8'in 24px alt sınırının altında ve başparmakla
              // ıskalanıyor. Dikey dolgu listeyi de nefes aldırıyor.
              className="bas flex w-full items-baseline gap-2 py-1 text-left text-[12px]"
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
