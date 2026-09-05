/**
 * Saldırı önizlemesi: "kazanırsan ne olur, kaybedersen ne olur".
 *
 * Eskiden bu blok ZAFER/YENİLGİ ve kayıp sayısı gösteriyordu. Oyunun ilk
 * gerçek testinde oyuncu ordusunu yola çıkardı ve "eee ne oldu şimdi, ne
 * işe yarayacak bu saldırı" deyip oyunu kapattı — çünkü saldırının neyi
 * kazandıracağı hiçbir yerde yazmıyordu. (docs/08 İ1)
 *
 * Kural: hiçbir onay düğmesi, bastıktan sonra ne olacağını söylemeden
 * basılabilir olmamalı.
 */
import { formatArmy } from '@lordlar/shared';
import { useEffect, useRef } from 'react';
import type { PreviewDto } from '../api/client';
import { IkonAltin, IkonDemir, IkonErzak, IkonSohret } from './Ikonlar';
import { Fark, SonucSatiri, KazanKaybet, formatKalan, formatSayi } from './ui';

function Kaynaklar({ r }: { r: { altin: number; demir: number; erzak: number } }) {
  const kalemler = [
    { v: r.altin, ikon: <IkonAltin boyut={11} />, ad: 'altın' },
    { v: r.demir, ikon: <IkonDemir boyut={11} />, ad: 'demir' },
    { v: r.erzak, ikon: <IkonErzak boyut={11} />, ad: 'erzak' },
  ].filter((k) => k.v > 0);
  if (kalemler.length === 0) return <span className="text-sonuk">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
      {kalemler.map((k) => (
        <span key={k.ad} className="tabular inline-flex items-center gap-1">
          <span className="opacity-70">{k.ikon}</span>
          {formatSayi(k.v)}
        </span>
      ))}
    </span>
  );
}

/**
 * İhtimali kelimeye çevirir.
 *
 * Ham yüzde göstermek ("fetih %67") sayıya güven duygusu yükler; oyuncunun
 * ihtiyacı olan şey karar verebilmek. Üç bant yeter: rahat, sınırda, riskli.
 */
function ihtimalMetni(oran: number): { metin: string; sinif: string } {
  if (oran >= 0.85) return { metin: 'neredeyse kesin', sinif: 'text-yesil' };
  if (oran >= 0.6) return { metin: 'muhtemel', sinif: 'text-yesil' };
  if (oran > 0.35) return { metin: 'kıl payı — sonuç değişebilir', sinif: 'text-turuncu' };
  if (oran > 0) return { metin: 'zayıf ihtimal', sinif: 'text-turuncu' };
  return { metin: 'imkânsız', sinif: 'text-kirmizi' };
}

export function SaldiriOnizleme({ onizleme }: { onizleme: PreviewDto }) {
  const { tahmin, odul, bedel } = onizleme;

  // Bölge alt sayfası uzun: afiş görseli, bölge bilgisi, garnizon ve ordu
  // seçici bu bloğu ekranın altına itiyor. Önizleme ilk belirdiğinde
  // görünür alana alınmazsa oyuncu "kazanırsan" bloğunu hiç görmeden
  // Saldır'a basıyor — yani düzeltmeye çalıştığımız şeyin aynısı oluyor.
  // Bağımlılık listesi boş: sadece ilk belirişte kaydırılır, ordu her
  // değiştiğinde ekran zıplamaz.
  const kutu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    kutu.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  const kazanir = tahmin.kazanan === 'attacker';
  const alir = tahmin.eleGecirir;

  const gelirVar =
    odul.saatlikGelir.altin + odul.saatlikGelir.demir + odul.saatlikGelir.erzak > 0;

  return (
    <div ref={kutu} className="mt-3 space-y-2.5">
      <div>
        <p className="baslik text-[13px]">
          Tahmin:{' '}
          <span className={kazanir ? 'text-yesil' : 'text-kirmizi'}>
            {kazanir ? 'ZAFER' : 'YENİLGİ'}
          </span>
          {alir && <span className="text-altin"> · BÖLGE ELE GEÇER</span>}
        </p>
        {/* Savaşta tur başına ±%7 varyans var; tek bir tahmin sözü tutmayabilir.
            Dokuz savaşın kaçının fetihle bittiğini söylemek, "kesin alırsın"
            deyip almamaktan dürüst. */}
        <p className="mt-0.5 text-[11px] text-solgun">
          Zafer ihtimali{' '}
          <span className={ihtimalMetni(tahmin.kazanmaOrani).sinif}>
            {ihtimalMetni(tahmin.kazanmaOrani).metin}
          </span>
          {tahmin.kazanmaOrani > 0 && (
            <>
              {' · '}bölgeyi alma ihtimali{' '}
              <span className={ihtimalMetni(tahmin.fetihOrani).sinif}>
                {ihtimalMetni(tahmin.fetihOrani).metin}
              </span>
            </>
          )}
        </p>
      </div>

      <KazanKaybet
        kaybetBaslik="Sana maliyeti"
        kazanBaslik={alir ? 'Kazanırsan' : 'Kazansan bile'}
        kazanirsan={
          !alir ? (
            // Dar zafer: savaş kazanılır ama bölge el değiştirmez
            // (balance.json savas.bolge_ele_gecirme). Buradaki ödülleri yine
            // de göstermek, oyuncuya tutulmayacak bir söz vermek olurdu —
            // düzeltmeye çalıştığımız hayal kırıklığının aynısı.
            <div>
              <p className="text-[12px] leading-snug text-turuncu">
                Savaşı kazanırsın ama <strong className="font-bold">bölge el değiştirmez.</strong>{' '}
                Bölgeyi almak için savunanın kabaca 1,5 katı güce ihtiyacın var; daha büyük bir
                orduyla gel.
              </p>
              <div className="mt-1.5">
                <SonucSatiri etiket="Kazancın yalnızca yağma" vurgu>
                  <Kaynaklar r={tahmin.yagma} />
                </SonucSatiri>
                <SonucSatiri etiket="Lord tecrübesi">
                  <span className="tabular text-yesil">+{formatSayi(odul.xp)} XP</span>
                </SonucSatiri>
              </div>
            </div>
          ) : (
          <div>
            {gelirVar && (
              <SonucSatiri etiket="Bu bölgenin geliri" vurgu>
                <span className="text-yesil">
                  saatte +<Kaynaklar r={odul.saatlikGelir} />
                </span>
              </SonucSatiri>
            )}
            {odul.saatlikGelir.sohret > 0 && (
              <SonucSatiri etiket="Şöhret üretimi">
                <span className="tabular inline-flex items-center gap-1 text-yesil">
                  <IkonSohret boyut={11} /> saatte +{odul.saatlikGelir.sohret}
                </span>
              </SonucSatiri>
            )}
            <SonucSatiri etiket="Şöhretin" vurgu>
              <Fark oncesi={odul.sohretOncesi} sonrasi={odul.sohretSonrasi} />
            </SonucSatiri>
            <SonucSatiri etiket="Şöhret sıralaman">
              <Fark
                oncesi={odul.siraOncesi}
                sonrasi={odul.siraSonrasi}
                birim="."
                tersYon
                bicim={(n) => String(Math.round(n))}
                farkMetni={(f, iyi) => `${f} sıra ${iyi ? 'yukarı' : 'aşağı'}`}
              />
            </SonucSatiri>
            <SonucSatiri etiket="Bölgelerin">
              <Fark
                oncesi={odul.bolgeOncesi}
                sonrasi={odul.bolgeSonrasi}
                bicim={(n) => String(Math.round(n))}
              />
              <span className="ml-1 text-[11px] text-sonuk">/ {odul.bolgeLimiti}</span>
            </SonucSatiri>
            <SonucSatiri etiket="Lord tecrübesi">
              <span className="tabular text-yesil">+{formatSayi(odul.xp)} XP</span>
            </SonucSatiri>
            {odul.limitDolu && (
              <p className="mt-1.5 text-[11px] leading-snug text-turuncu">
                Bölge limitin dolu ({odul.bolgeOncesi}/{odul.bolgeLimiti}). Kazansan bile bölgeyi
                alamazsın, sadece yağmalarsın — gelir artışı olmaz.
              </p>
            )}
          </div>
          )
        }
        kaybedersen={
          <div>
            <SonucSatiri etiket="Ordu kaybın" vurgu>
              <span className="text-kirmizi">{formatArmy(tahmin.saldiranKayip)}</span>
            </SonucSatiri>
            {bedel.kayipBirim > 0 && (
              <SonucSatiri etiket="Yerine koymak">
                <span className="inline-flex flex-col items-end gap-0.5">
                  <Kaynaklar r={bedel.yenidenEgitim} />
                  <span className="tabular text-[11px] text-sonuk">
                    {formatKalan(bedel.yenidenEgitimSn * 1000)} eğitim
                  </span>
                </span>
              </SonucSatiri>
            )}
            <SonucSatiri etiket="Ordun yolda">
              <span className="tabular">
                {formatKalan(onizleme.marchSec * 1000)} gidiş ·{' '}
                {formatKalan(onizleme.donusSec * 1000)} dönüş
              </span>
            </SonucSatiri>
            {onizleme.ilkSaldiri && (
              <p className="mt-1.5 text-[11px] leading-snug text-altin">
                İlk saldırın hızlandırıldı: ordun {formatKalan(onizleme.marchSec * 1000)} içinde
                varacak, sonucu bu oturumda göreceksin.
              </p>
            )}
          </div>
        }
      />

      <p
        className={`text-[11px] leading-snug ${
          onizleme.istihbaratKesin ? 'text-yesil' : 'text-turuncu'
        }`}
      >
        {onizleme.not}
      </p>
    </div>
  );
}
