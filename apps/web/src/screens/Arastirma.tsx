/**
 * Araştırma ağacı ekranı (Lord ana sayfasından açılan kapı).
 *
 * Ağacın kuralları sunucudan hazır geliyor: hangi düğüm açık, hangisi
 * kilitli ve NEDEN kilitli. Arayüz kuralı yeniden hesaplamıyor —
 * hesaplasaydı motorla ayrışabilir ve oyuncuya "başlat" düğmesi gösterip
 * sunucudan hata alabilirdi.
 *
 * Dallar sekmeli değil alt alta: üç dalın toplamı on beş kart ve oyuncu
 * "hangi dalı sürdüreyim" kararını ancak üçünü aynı anda görürse
 * verebilir.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { hisOnay, hisRet } from '../components/hisGeriBildirimi';
import { IkonAltin, IkonDemir, IkonErzak, IkonSure } from '../components/Ikonlar';
import { Bolum, Buton, GeriSayim, Ilerleme, Iskelet, Kart, formatSayi } from '../components/ui';

/**
 * Depo düğümünün oyuncunun KENDİ tavanına ne yapacağı.
 *
 * Depo düğümü değilse ya da tavan henüz gelmediyse null: tahmin
 * uydurmaktansa hiçbir şey yazmamak doğru.
 */
function depoArtisi(
  d: { etki: Record<string, number>; tamamlandi: boolean },
  tavan: number,
): string | null {
  const carpan = d.etki.depo_carpani;
  if (!carpan || d.tamamlandi) return null;
  // Tavan zaten uygulanmış bonusları içeriyor; bu düğümün payı üstüne
  // ekleniyor. Taban = tavan / (1 + mevcut bonuslar) hesabı sunucuda,
  // burada yalnız FARKI gösteriyoruz ve nasıl hesaplandığını iddia
  // etmiyoruz: "şu kadar artar" diyoruz, "şu kadar olur" değil.
  const artis = Math.round(tavan * carpan);
  return `Şu anki tavanın ${formatSayi(tavan)} — bu araştırma ${formatSayi(artis)} ekler.`;
}

function sureMetni(sn: number): string {
  const sa = Math.floor(sn / 3600);
  const dk = Math.round((sn % 3600) / 60);
  return sa > 0 ? `${sa}sa ${dk}dk` : `${dk}dk`;
}

export function Arastirma({ depoTavani }: { depoTavani: number }) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const veri = useQuery({ queryKey: ['arastirma'], queryFn: api.arastirma });

  const baslat = useMutation({
    mutationFn: (key: string) => api.arastirmaBaslat(key),
    onSuccess: () => {
      hisOnay();
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['arastirma'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Araştırma başlatılamadı.');
    },
  });

  const iptal = useMutation({
    mutationFn: (id: string) => api.arastirmaIptal(id),
    onSuccess: () => {
      hisOnay();
      void qc.invalidateQueries({ queryKey: ['arastirma'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  if (veri.isPending || !veri.data) return <Iskelet satir={4} />;
  const { dallar, ilerleme, suren } = veri.data;

  // Dal başlıkları veriden geliyor; ekranda ikinci bir liste tutmuyoruz.
  const dalAnahtarlari = [...new Set(dallar.map((d) => d.dal))];

  return (
    <div className="space-y-4">
      {/* Zemin YOK: bu kapının zemin görseli henüz üretilmedi ve
          görselsiz Zemin düz bir başlık basıyor — panel zaten "Araştırma"
          yazdığı için başlık iki kez görünüyordu. İttifak ve Hesap da
          aynı sebeple Zemin kullanmıyor. Görsel geldiğinde Generaller ve
          Demirhane gibi eklenir (istem: docs/GORSEL-ISTEMLERI.md). */}
      <Kart className="p-3">
        <div className="flex items-baseline justify-between">
          <span className="baslik text-[11px] text-solgun">İlerleme</span>
          <span className="text-[12px] text-parsomen">
            {ilerleme.biten} / {ilerleme.toplam}
          </span>
        </div>
        <Ilerleme deger={ilerleme.biten} max={Math.max(1, ilerleme.toplam)} />
        <p className="mt-1.5 text-[11px] leading-snug text-solgun">
          Aynı anda tek araştırma yürütebilirsin. Sıra senin kararın: önce ekonomiyi mi büyütürsün,
          orduyu mu?
        </p>
      </Kart>

      {suren && (
        <Kart className="border-altin/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-altin">{suren.ad}</p>
              <p className="text-[12px] text-solgun">
                <GeriSayim bitis={suren.finishAt} /> kaldı
              </p>
            </div>
            <Buton tur="anahat" disabled={iptal.isPending} onClick={() => iptal.mutate(suren.id)}>
              İptal
            </Buton>
          </div>
          <p className="mt-1.5 text-[11px] text-solgun">
            İptal edersen harcadığının yarısı geri gelir.
          </p>
        </Kart>
      )}

      {hata && <p className="text-[12px] text-kirmizi">{hata}</p>}

      {dalAnahtarlari.map((dalKey) => {
        const dugumler = dallar.filter((d) => d.dal === dalKey);
        const dalAdi = dugumler[0]?.dalAdi ?? dalKey;
        return (
          <Bolum key={dalKey} baslik={dalAdi}>
            <div className="space-y-1.5">
              {dugumler
                .sort((a, b) => a.kademe - b.kademe)
                .map((d) => (
                  <Kart
                    key={d.key}
                    className={`p-3 ${d.tamamlandi ? 'border-yesil/40' : d.acik ? '' : 'opacity-60'}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`text-[13px] font-semibold ${
                          d.tamamlandi ? 'text-yesil' : d.acik ? 'text-parsomen' : 'text-solgun'
                        }`}
                      >
                        {d.ad}
                      </span>
                      <span className="shrink-0 text-[10px] text-solgun">
                        {d.tamamlandi ? 'tamamlandı' : `kademe ${d.kademe}`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-snug text-solgun">{d.aciklama}</p>

                    {/* Ne kadar? Açıklama ne yaptığını anlatıyordu ama ne
                        kadar yaptığını söylemiyordu; yüz binlerce kaynak
                        bedeli olan bir karar böyle verilemez. Cümleler
                        motordan geliyor (arastirma.ts → etkiCumlesi), yani
                        sayı veri dosyasıyla aynı kaynaktan. */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {d.etkiSatirlari.map((e) => (
                        <span
                          key={e}
                          className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                            d.tamamlandi ? 'bg-yesil/15 text-yesil' : 'bg-altin/12 text-altin'
                          }`}
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                    {depoArtisi(d, depoTavani) && (
                      <p className="mt-1 text-[11px] text-solgun">{depoArtisi(d, depoTavani)}</p>
                    )}

                    {!d.tamamlandi && (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-solgun">
                          <span className="flex items-center gap-1">
                            <IkonAltin boyut={12} /> {formatSayi(d.maliyet.altin)}
                          </span>
                          <span className="flex items-center gap-1">
                            <IkonDemir boyut={12} /> {formatSayi(d.maliyet.demir)}
                          </span>
                          <span className="flex items-center gap-1">
                            <IkonErzak boyut={12} /> {formatSayi(d.maliyet.erzak)}
                          </span>
                          <span className="flex items-center gap-1">
                            <IkonSure boyut={12} /> {sureMetni(d.sureSn)}
                          </span>
                        </div>
                        {d.acik ? (
                          <Buton
                            className="mt-2"
                            tam
                            disabled={baslat.isPending || suren !== null}
                            onClick={() => baslat.mutate(d.key)}
                            isaret={`arastirma-${d.key}`}
                          >
                            {suren ? 'Başka araştırma sürüyor' : 'Başlat'}
                          </Buton>
                        ) : (
                          <p className="mt-2 text-[11px] text-solgun">Kilitli — {d.engel}</p>
                        )}
                      </>
                    )}
                  </Kart>
                ))}
            </div>
          </Bolum>
        );
      })}
    </div>
  );
}
