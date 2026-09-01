/**
 * Diyar tanıtımı — oyunun ne olduğunu 30 saniyede söyleyen tek ekran.
 *
 * Oyun kazanma koşulunu hiçbir yerde yazmıyordu. Taht Kalesi kodda vardı,
 * dengede vardı, haritada vardı — ama oyuncuya hiç tanıtılmıyordu. İlk
 * gerçek testte oyuncu "ne saçma oyun deyip çıktım" derken, aslında hiç
 * söylenmemiş bir amacın peşinde olmadığını söylüyordu. (docs/08 İ6)
 *
 * Üç cümle, üç soru: Neredeyim? Kazanmak ne demek? Şu an neredeyim?
 *
 * Ne zaman görünür: yalnızca hiçbir şey yapmamış bir lorda. Koşul oyun
 * durumundan türetiliyor — ilk asker eğitildiği anda kendiliğinden kayboluyor
 * ve bir daha dönmüyor. Kapatma düğmesi de var; okuyup geçmek isteyen
 * beklemek zorunda kalmasın.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, type LordState, type QueueItem } from '../api/client';
import { IkonTaht } from './Ikonlar';
import { Hap, Kart, formatSayi } from './ui';

const KAPATILDI = 'lordlar_diyar_tanitimi';

/** Lord henüz oyuna hiç dokunmamış mı? */
function yepyeniMi(lord: LordState, queues: QueueItem[]): boolean {
  return (
    lord.level === 1 &&
    lord.xp === 0 &&
    lord.usedSlots === 0 &&
    lord.regionCount === 0 &&
    !lord.ownsThrone &&
    lord.equippedItems.length === 0 &&
    queues.length === 0
  );
}

export function DiyarTanitimi({ lord, queues }: { lord: LordState; queues: QueueItem[] }) {
  const gerekli = yepyeniMi(lord, queues);
  const [kapali, setKapali] = useState(false);

  // localStorage yalnızca "okudum, kapat" için. Asıl koşul oyun durumundan
  // geliyor; depolama silinse bile kart ilk eylemden sonra zaten dönmez.
  useEffect(() => {
    try {
      if (localStorage.getItem(KAPATILDI) === '1') setKapali(true);
    } catch {
      /* özel pencere: kart görünür kalır, zararsız */
    }
  }, []);

  const dunya = useQuery({ queryKey: ['dunya'], queryFn: api.dunya, enabled: gerekli && !kapali });

  if (!gerekli || kapali || !dunya.data) return null;
  const d = dunya.data;

  function kapat() {
    setKapali(true);
    try {
      localStorage.setItem(KAPATILDI, '1');
    } catch {
      /* yazılamadıysa kart bu oturumda kapalı kalır, yeter */
    }
  }

  return (
    <Kart className="p-4" vurgu="var(--color-altin)">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="baslik text-[15px] text-altin">{d.ad}</h2>
        <button onClick={kapat} className="baslik shrink-0 text-[10px] text-sonuk">
          ANLADIM
        </button>
      </div>

      <ol className="space-y-2.5 text-[13px] leading-snug">
        <li className="flex items-center gap-2.5">
          <Sira>1</Sira>
          <span className="flex flex-wrap items-center gap-1.5">
            <Hap>{formatSayi(d.lordSayisi)} lord</Hap>
            <Hap>{formatSayi(d.bolgeSayisi)} bölge</Hap>
            <span className="text-solgun">için savaşıyor</span>
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <Sira>2</Sira>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-solgun">Tahtı tutan</span>
            <strong className="text-altin">Diyarın Lordu</strong>
            <Hap renk="var(--color-altin)">
              +%{Math.round((d.taht?.sohretBonusu ?? 0) * 100)} şöhret
            </Hap>
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <Sira>3</Sira>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-solgun">Şu an</span>
            <Hap renk="var(--color-parsomen)">{d.benimSiram}. sıradasın</Hap>
          </span>
        </li>
      </ol>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-sonuk">
        <IkonTaht boyut={13} />
        Taht Kalesi haritada altın çerçeveyle işaretli.
      </p>
    </Kart>
  );
}

function Sira({ children }: { children: string }) {
  return (
    <span className="baslik mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-altin/20 text-[11px] text-altin">
      {children}
    </span>
  );
}
