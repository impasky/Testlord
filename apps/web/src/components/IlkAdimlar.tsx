/**
 * İlk Adımlar — yeni lorda oyunun çekirdek döngüsünü gösteren dört adım.
 *
 * Neden durum saklamıyor: adımların hiçbiri "okundu" işareti değil, oyun
 * durumundan türetiliyor. Ordun varsa ilk adım biter, bölgen varsa üçüncü.
 * Böylece rehber gerçeği gösterir — cihaz değiştiren ya da tarayıcı verisini
 * silen oyuncu ilerlemesini kaybetmez, sunucuya yeni bir alan da eklemek
 * gerekmez.
 *
 * Dördü de tamamlanınca kart tamamen kaybolur. Kapatma düğmesi yok: kapanan
 * bir rehberin geri getirilmesi için ayrı bir menü gerekirdi ve zaten
 * kendiliğinden bitiyor.
 *
 * Türetme, adımın geri açılabilmesi anlamına da geliyor: ordusu tamamen
 * kırılan lord "asker eğit" adımını yeniden görür. Bu kusur değil — o anda
 * gerçekten yapması gereken şey odur.
 *
 * docs/04 M9'da adımlar "asker eğit → haritaya bak → saldır → yükselt" diye
 * yazılmıştı. "Haritaya bak" bir sonuç değil bir araç, durumdan türetilemiyor;
 * yerine ekipman ve general kondu — böylece dört adım docs/00'daki altı keyif
 * ekseninden dördüne dokunuyor.
 */
import { useQuery } from '@tanstack/react-query';
import { api, type LordState, type QueueItem } from '../api/client';
import type { Sekme } from './MobilKabuk';
import { Buton, Kart } from './ui';

type Adim = {
  ad: string;
  aciklama: string;
  bitti: boolean;
  sekme: Sekme;
  dugme: string;
};

function Isaret({ bitti }: { bitti: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
        bitti ? 'border-yesil bg-yesil/20 text-yesil' : 'border-kenar text-sonuk'
      }`}
      aria-hidden
    >
      {bitti ? '✓' : ''}
    </span>
  );
}

export function IlkAdimlar({
  lord,
  queues,
  onGit,
}: {
  lord: LordState;
  queues: QueueItem[];
  onGit: (s: Sekme) => void;
}) {
  // Generaller /me içinde dönmüyor; sadece rehber görünürken çekiliyor.
  // Rehber bitince bileşen hiç render edilmediği için istek de durur.
  const generaller = useQuery({ queryKey: ['generals'], queryFn: api.generals });

  const adimlar: Adim[] = [
    {
      ad: 'Asker eğit',
      aciklama: 'Kışlada birlik yetiştir. Ordun olmadan bölge alamazsın.',
      // homeArmy değil usedSlots: evdeki ordu, birlikler sefere çıkınca
      // boşalıyor ve adım geri açılıyordu. usedSlots lordun her yerdeki
      // birliğini sayar — evde, garnizonda, yolda.
      bitti: lord.usedSlots > 0 || queues.some((q) => q.kind === 'train'),
      sekme: 'kisla',
      dugme: 'Kışla',
    },
    {
      ad: 'Ekipman kuşan',
      aciklama: 'Demirhanede eşya üret ve Lord ekranından kuşan.',
      bitti: lord.equippedItems.length > 0,
      sekme: 'demirhane',
      dugme: 'Demirhane',
    },
    {
      ad: 'Bölge ele geçir',
      aciklama: 'Haritadan zayıf bir bölgeye saldır. Bölge saatlik gelir getirir.',
      bitti: lord.regionCount > 0,
      sekme: 'harita',
      dugme: 'Harita',
    },
    {
      ad: 'General kirala',
      aciklama: 'General ordunu güçlendirir ve savaşta yetenek kullanır.',
      bitti: (generaller.data?.kadro ?? []).some((g) => g.sahipMi),
      sekme: 'generaller',
      dugme: 'Generaller',
    },
  ];

  const biten = adimlar.filter((a) => a.bitti).length;
  if (biten === adimlar.length) return null;

  // İlk bitmemiş adım öne çıkarılır: dört düğme birden göstermek, "şimdi ne
  // yapayım" sorusunu cevaplamak yerine dörde bölerdi.
  const sira = adimlar.findIndex((a) => !a.bitti);

  return (
    <Kart className="p-3" vurgu="var(--color-altin)">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="baslik text-[12px] text-altin">İlk Adımlar</h3>
        <span className="tabular text-[11px] text-solgun">{biten}/{adimlar.length}</span>
      </div>

      <ul className="space-y-2">
        {adimlar.map((a, i) => (
          <li key={a.ad} className="flex gap-2.5">
            <Isaret bitti={a.bitti} />
            <div className="min-w-0 flex-1">
              <p
                className={`text-[13px] ${
                  a.bitti ? 'text-sonuk line-through' : 'font-bold'
                }`}
              >
                {a.ad}
              </p>
              {i === sira && (
                <>
                  <p className="mt-0.5 text-[12px] text-solgun">{a.aciklama}</p>
                  <Buton boy="kucuk" className="mt-2" onClick={() => onGit(a.sekme)}>
                    {a.dugme}
                  </Buton>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Kart>
  );
}
