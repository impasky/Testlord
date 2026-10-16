/**
 * Hızlandır — bir işin kalan süresini elmasla, biriken reklam süresiyle
 * ya da (uygulamada) ödüllü reklamla kısaltmak (docs/25).
 *
 * Düğme yalnız hızlandırılabilir işlerde çıkıyor (bina, araştırma,
 * eğitim, üretim, yükseltme); oyuncular arası rekabete dokunan hiçbir şey
 * (saldırı, casus, sevkiyat) hızlanmıyor. Fiyat burada GÖSTERİLİYOR ama
 * sunucuda hesaplanıyor; reklamın ödülünü de sunucu veriyor.
 */
import { REKLAM, bankadanHarca, hizlandirilabilirMi, hizlandirmaBedeli } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { kapiAcIstegi } from '../lib/kapiIstegi';
import { reklamIzle, uygulamadaMi } from '../lib/yerel';
import { IkonElmas, IkonHiz, IkonSure } from './Ikonlar';
import { Buton, GeriSayim, formatKalan, formatSayi } from './ui';

export interface HizlanacakIs {
  id: string;
  kind: string;
  finishAt: string;
}

/** İşin türünün oyuncuya görünen adı. */
export const IS_ADI: Record<string, string> = {
  bina: 'İnşaat',
  research: 'Araştırma',
  train: 'Asker eğitimi',
  craft: 'Ekipman üretimi',
  upgrade_item: 'Ekipman yükseltme',
  upgrade_gear: 'Ordu donanımı',
  upgrade_region: 'Bölge yükseltme',
};

export function HizlandirDugmesi({ is, ad }: { is: HizlanacakIs; ad?: string }) {
  const [acik, setAcik] = useState(false);
  if (!hizlandirilabilirMi(is.kind)) return null;
  return (
    <>
      <button
        type="button"
        data-hizlandir={is.id}
        onClick={() => setAcik(true)}
        aria-label={`${ad ?? IS_ADI[is.kind] ?? 'İş'} — hızlandır`}
        className="bas inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-elmas/60 bg-elmas/10 px-2.5 text-[12px] font-bold text-elmas"
      >
        <IkonHiz boyut={14} />
        Hızlandır
      </button>
      {acik && (
        <HizlandirPenceresi is={is} ad={ad ?? IS_ADI[is.kind]} onKapat={() => setAcik(false)} />
      )}
    </>
  );
}

/** Saniyede bir yeniden çizilen kalan süre (fiyat da onunla değişiyor). */
function useKalanSaniye(finishAt: string): number {
  const [, tik] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tik((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.ceil((new Date(finishAt).getTime() - Date.now()) / 1000));
}

export function HizlandirPenceresi({
  is,
  ad,
  onKapat,
}: {
  is: HizlanacakIs;
  ad?: string;
  onKapat: () => void;
}) {
  const qc = useQueryClient();
  const m = useQuery({ queryKey: ['magaza'], queryFn: api.magaza });
  const guncel = m.data?.kuyruklar.find((k) => k.id === is.id);
  const kalan = useKalanSaniye(guncel?.finishAt ?? is.finishAt);
  const bedel = hizlandirmaBedeli(kalan);
  const [hata, setHata] = useState<string | null>(null);
  const [reklamDurumu, setReklamDurumu] = useState<string | null>(null);

  const tazele = () => {
    // Hızlanan iş her ekranda görünüyor: kuyruk, ordu, bina, kaynak.
    void qc.invalidateQueries();
  };
  const hizlandir = useMutation({
    mutationFn: (yontem: 'elmas' | 'banka') => api.hizlandir(is.id, yontem),
    onSuccess: (s) => {
      tazele();
      if (s.kalanSaniye === 0) onKapat();
    },
    onError: (e) => setHata((e as Error).message),
  });

  const reklam = useMutation({
    mutationFn: async () => {
      if (!m.data?.reklam.birim) throw new Error('Reklam şu an kapalı.');
      const o = await api.reklamOturumu(is.id);
      setReklamDurumu('Reklam yükleniyor…');
      const sonuc = await reklamIzle({
        birim: m.data.reklam.birim,
        oturumId: o.oturumId,
        kullanici: o.kullanici,
        kisisellestirilmis: m.data.reklam.kisisellestirilmis,
      });
      if (sonuc === 'kapatildi') return 'kapatildi' as const;
      // Ödülü Google'ın sunucumuza çağrısı veriyor; birkaç saniye sürebilir.
      setReklamDurumu('Ödül işleniyor…');
      for (let i = 0; i < 20; i++) {
        const d = await api.reklamOturumDurumu(o.oturumId);
        if (d.durum === 'odullendi') return d;
        await new Promise((r) => setTimeout(r, 1500));
      }
      return 'gecikti' as const;
    },
    onSuccess: (s) => {
      tazele();
      setReklamDurumu(
        s === 'kapatildi'
          ? 'Reklam bitmeden kapandı; ödül yok.'
          : s === 'gecikti'
            ? 'Ödül henüz gelmedi; birazdan işin süresine bak.'
            : s.kuyrukSaniye > 0 && s.bankaDakika > 0
              ? `İşten ${formatKalan(s.kuyrukSaniye * 1000)} silindi; artan ${s.bankaDakika} dk biriktirildi.`
              : s.kuyrukSaniye > 0
                ? `İşten ${formatKalan(s.kuyrukSaniye * 1000)} silindi.`
                : `${s.bankaDakika} dk biriktirildi; istediğin işte kullan.`,
      );
    },
    onError: (e) => {
      setReklamDurumu(null);
      setHata((e as Error).message);
    },
  });

  const elmas = m.data?.elmas ?? 0;
  const banka = m.data?.reklamDakikasi ?? 0;
  const bankadan = bankadanHarca(kalan, banka);
  const r = m.data?.reklam;
  const reklamGorunur = uygulamadaMi() && Boolean(r?.acik);
  const mesgul = hizlandir.isPending || reklam.isPending;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/70"
        onClick={onKapat}
        aria-label="Kapat"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${ad ?? 'İş'} — hızlandır`}
        data-hizlandir-penceresi
        className="fixed inset-x-0 bottom-0 z-[61] mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t-2 border-kenar-acik bg-derin px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-kenar-acik" aria-hidden />
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="baslik text-[16px] text-parsomen">{ad ?? 'İş'}</h2>
          <span className="tabular flex items-center gap-1 text-[13px] text-altin">
            <IkonSure boyut={13} />
            {kalan > 0 ? <GeriSayim bitis={guncel?.finishAt ?? is.finishAt} /> : 'bitti'}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-snug text-sonuk">
          Hızlanan iş beklenerek bitenle aynı: elmas zaman kısaltır, güç satmaz.
        </p>

        {kalan === 0 ? (
          <Buton className="mt-4" tam onClick={onKapat}>
            Kapat
          </Buton>
        ) : (
          <div className="mt-4 space-y-2.5">
            <div data-hizlandir-elmas={bedel}>
              <Buton
                tur="altin"
                tam
                disabled={mesgul || elmas < bedel || !m.data}
                onClick={() => {
                  setHata(null);
                  hizlandir.mutate('elmas');
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {`Hemen bitir · ${formatSayi(bedel)}`}
                  <IkonElmas boyut={15} />
                </span>
              </Buton>
              {m.data && elmas < bedel && (
                <p className="mt-1 text-[12px] text-sonuk">
                  {`Elmasın yetmiyor (${formatSayi(Math.max(0, elmas))}).`}{' '}
                  <button
                    type="button"
                    className="font-bold text-elmas underline"
                    onClick={() => {
                      onKapat();
                      kapiAcIstegi('magaza');
                    }}
                  >
                    Mağaza
                  </button>
                </p>
              )}
            </div>

            {banka > 0 && (
              <div data-hizlandir-banka={bankadan.harcananDakika}>
                <Buton
                  tur="anahat"
                  tam
                  disabled={mesgul}
                  onClick={() => {
                    setHata(null);
                    hizlandir.mutate('banka');
                  }}
                >
                  {`Biriken süreyi kullan · ${bankadan.harcananDakika} dk`}
                </Buton>
              </div>
            )}

            {reklamGorunur && r && (
              <div data-hizlandir-reklam>
                <Buton
                  tur="anahat"
                  tam
                  disabled={mesgul || !r.hak.izinli}
                  onClick={() => {
                    setHata(null);
                    reklam.mutate();
                  }}
                >
                  {`Reklam izle · −${r.odulDakika} dk`}
                </Buton>
                <p className="mt-1 text-[11px] text-solgun">
                  {r.hak.engel === 'tavan'
                    ? 'Bugünlük reklam hakkın bitti; yarın yenilenir.'
                    : r.hak.engel === 'bekleme'
                      ? `Bir sonraki reklam ${r.hak.beklemeSn} sn sonra.`
                      : `Bugün ${r.hak.kalan}/${REKLAM.gunlukTavan} reklam hakkın var.`}
                </p>
              </div>
            )}
            {reklamDurumu && <p className="text-[12px] text-yesil">{reklamDurumu}</p>}
            {hata && <p className="text-[12px] text-kirmizi">{hata}</p>}
          </div>
        )}
      </div>
    </>
  );
}
