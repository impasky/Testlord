/**
 * Hastane: savaştan yaralı dönen askerler.
 *
 * Yaralı dönüş sistemi (docs/09 K6b) ölü sayılan askerin bir kısmını
 * geri veriyordu ama asker anında savaşa hazır oluyordu — kaybın bir
 * ağırlığı kalmıyordu. Hastane kaybı ZAMANA çeviriyor: asker ölmüyor
 * ama hemen de kullanılamıyor.
 *
 * Kışla'da duruyor çünkü ordunun yaşadığı yer orası. Boşken hiç
 * görünmüyor: yaralısı olmayan oyuncuya sürekli boş bir hastane
 * göstermek, ekranı hiçbir şey söylemeyen bir kartla doldurmak olurdu.
 */
import { armyCount, unitName, type Army } from '@lordlar/shared';
import { BirimIkonu } from './Ikonlar';
import { GeriSayim, Kart } from './ui';
import type { QueueItem } from '../api/client';

export function Hastane({ hastane, queues }: { hastane: Army; queues: QueueItem[] }) {
  const toplam = armyCount(hastane);
  if (toplam === 0) return null;

  // Tedavi kuyruğu: en erken bitecek olan gösteriliyor.
  const tedavi = queues
    .filter((q) => q.kind === 'iyilestir')
    .sort((a, b) => new Date(a.finishAt).getTime() - new Date(b.finishAt).getTime())[0];

  return (
    <Kart className="border-kirmizi/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="baslik text-[11px] text-solgun">Hastane</h3>
        {tedavi && (
          <span className="tabular text-[12px] text-altin">
            <GeriSayim bitis={tedavi.finishAt} />
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[12px] leading-snug text-solgun">
        {toplam} asker yaralı döndü. İyileşene kadar savaşa giremez, erzak yemez ve komuta yerini
        kaplamaz.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {(Object.entries(hastane) as [string, number][])
          .filter(([, n]) => n > 0)
          .map(([tur, n]) => (
            <span key={tur} className="flex items-center gap-1 text-[12px] text-metin">
              <BirimIkonu tip={tur} boyut={14} />
              {unitName(tur as never)} <span className="text-solgun">{n}</span>
            </span>
          ))}
      </div>
    </Kart>
  );
}
