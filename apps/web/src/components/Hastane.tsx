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
 *
 * Oyuncunun isteği: "iyileşme süresini uzatalım, oyuncular isterse elmas
 * harcayarak kısaltabilsin." Kart bu yüzden iki şey daha söylüyor: süre
 * çubuğu (ne kadarı geçti) ve "şimdi taburcu et" — bedeli ve kesedeki
 * elmasla birlikte, basmadan önce.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { armyCount, tedaviKisaltmaBedeli, unitName, type Army } from '@lordlar/shared';
import { BirimIkonu, IkonElmas } from './Ikonlar';
import { Buton, GeriSayim, Kart, SureCubugu } from './ui';
import { hisOnay, hisRet } from './hisGeriBildirimi';
import { ApiError, api, type QueueItem } from '../api/client';

export function Hastane({
  hastane,
  queues,
  elmas,
  onGuncelle,
}: {
  hastane: Army;
  queues: QueueItem[];
  elmas: number;
  onGuncelle: () => void;
}) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const taburcu = useMutation({
    mutationFn: api.hastaneKisalt,
    onSuccess: () => {
      setHata(null);
      hisOnay();
      void qc.invalidateQueries({ queryKey: ['army'] });
      onGuncelle();
    },
    onError: (e) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Taburcu edilemedi.');
    },
  });

  const toplam = armyCount(hastane);
  if (toplam === 0) return null;

  // Kafileler paralel iyileşiyor: ilk biten sayaçta, en uzun süren bedelde.
  const kafileler = queues
    .filter((q) => q.kind === 'iyilestir')
    .sort((a, b) => new Date(a.finishAt).getTime() - new Date(b.finishAt).getTime());
  const ilk = kafileler[0];
  const son = kafileler[kafileler.length - 1];
  const kalanSn = son ? (new Date(son.finishAt).getTime() - Date.now()) / 1000 : 0;
  const bedel = tedaviKisaltmaBedeli(kalanSn);
  const yetiyor = elmas >= bedel;

  return (
    <Kart className="border-kirmizi/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        {/* Ekranın doğrudan altında duran bir bölüm başlığı: h2.
            h3 bırakmak h1'den sonra bir seviye atlamak demekti ve
            ekran okuyucu kullanıcısının başlıklarla gezinmesini
            bozuyordu (erisim-denetim.mjs yakaladı). */}
        <h2 className="baslik text-[11px] text-solgun">Hastane</h2>
        {ilk && (
          <span className="tabular text-[12px] text-altin">
            <GeriSayim bitis={ilk.finishAt} />
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[12px] leading-snug text-solgun">{`${toplam} asker yaralı döndü. İyileşene kadar savaşa giremez, erzak yemez ve komuta yerini kaplamaz.`}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {(Object.entries(hastane) as [string, number][])
          .filter(([, n]) => n > 0)
          .map(([tur, n]) => (
            <span key={tur} className="flex items-center gap-1 text-[12px] text-parsomen">
              <BirimIkonu tip={tur} boyut={14} />
              {unitName(tur as never)} <span className="text-solgun">{n}</span>
            </span>
          ))}
      </div>
      {ilk && (
        <div className="mt-2.5">
          <SureCubugu baslangic={ilk.startedAt} bitis={ilk.finishAt} renk="var(--color-kirmizi)" />
          {kafileler.length > 1 && son && (
            <p className="tabular mt-1 text-[11px] text-sonuk">
              {`${kafileler.length} kafile · hepsi `}
              <GeriSayim bitis={son.finishAt} />
            </p>
          )}
        </div>
      )}
      {son && bedel > 0 && (
        <div className="mt-2.5">
          <Buton onClick={() => taburcu.mutate()} disabled={taburcu.isPending || !yetiyor} tam>
            <span className="flex items-center justify-center gap-1.5">
              {taburcu.isPending ? 'Taburcu ediliyor…' : 'Hepsini şimdi iyileştir'}
              <span className="flex items-center gap-0.5" style={{ color: 'var(--color-elmas)' }}>
                <IkonElmas boyut={14} />
                <span className="tabular">{bedel}</span>
              </span>
            </span>
          </Buton>
          <p className="mt-1 text-[11px] text-sonuk">
            {yetiyor
              ? `Kesende ${elmas} elmas. Elmas yalnız zamanı kısaltır; taburcu olan asker beklenerek iyileşenle aynı.`
              : `Kesende ${elmas} elmas; ${bedel - elmas} eksik. Elmas günlük görevlerden, şef kamplarından ve başarımlardan gelir.`}
          </p>
        </div>
      )}
      {hata && <p className="mt-1.5 text-[12px] text-kirmizi">{hata}</p>}
    </Kart>
  );
}
