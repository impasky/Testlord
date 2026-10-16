/**
 * Mağaza (docs/25) — öde, zamanı atla.
 *
 * Satılan tek şey elmas; elmasın harcandığı tek yer kendi işlerinin
 * süresi. Ekran bunu en üstte açıkça söylüyor ve ne SATILMADIĞINI da
 * sayıyor: oyuncu "bu oyun parayla kazanılıyor mu" sorusunun cevabını
 * satın alma düğmesinden ÖNCE görmeli.
 *
 * Satın alma ve ödüllü reklam yalnız Android uygulamasında (Google Play
 * Faturalandırma, AdMob). Web'de ekran bilgi kipinde: paketler görünüyor,
 * satın alma yerine uygulamaya bağlantı var. Hızlandırma her yerde.
 */
import { REKLAM } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, type ElmasPaketiDto, type MagazaDto } from '../api/client';
import { HizlandirDugmesi, IS_ADI } from '../components/Hizlandir';
import { IkonElmas, IkonSure } from '../components/Ikonlar';
import { Bolum, Buton, GeriSayim, Kart, Rozet, formatSayi, sablonlu } from '../components/ui';
import { yarimSatinAlmalariTamamla } from '../lib/yarimSatinAlma';
import { playFiyatlari, playSatinAl, reklamIzle, uygulamadaMi } from '../lib/yerel';

export function Magaza() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['magaza'], queryFn: api.magaza, refetchInterval: 30_000 });
  const uygulama = uygulamadaMi();
  const urunler = q.data?.paketler.map((p) => p.urun) ?? [];
  const fiyat = useQuery({
    queryKey: ['play-fiyat', urunler.join(',')],
    queryFn: () => playFiyatlari(urunler),
    enabled: uygulama && Boolean(q.data?.play.acik) && urunler.length > 0,
    staleTime: 10 * 60_000,
  });
  const [bildiri, setBildiri] = useState<{ tur: 'iyi' | 'kotu'; metin: string } | null>(null);
  const tazele = () => void qc.invalidateQueries();

  const satinAl = useMutation({
    mutationFn: async (p: ElmasPaketiDto) => {
      const s = await playSatinAl(p.urun, q.data!.play.hesapEtiketi);
      if ('iptal' in s) return null;
      return api.playDogrula(p.urun, s.jeton);
    },
    onSuccess: (s) => {
      if (!s) return;
      tazele();
      setBildiri(
        s.durum === 'bekliyor'
          ? { tur: 'iyi', metin: 'Ödeme bekleniyor; tamamlanınca elmasın kendiliğinden gelecek.' }
          : { tur: 'iyi', metin: `${formatSayi(s.elmas)} elmas kesene eklendi.` },
      );
    },
    onError: (e) => setBildiri({ tur: 'kotu', metin: (e as Error).message }),
  });

  /*
   * Yarım kalmış satın almalar (lib/yarimSatinAlma.ts): uygulama açılışta
   * da topluyor; Mağaza açılınca bir kez daha ve sonucu burada söylüyor.
   */
  const toparla = useMutation({
    mutationFn: () => yarimSatinAlmalariTamamla(q.data!.play.hesapEtiketi),
    onSuccess: (elmas) => {
      if (elmas > 0) {
        tazele();
        setBildiri({
          tur: 'iyi',
          metin: `Yarım kalan satın alma tamamlandı: +${formatSayi(elmas)} elmas.`,
        });
      }
    },
  });
  const toparlandi = useRef(false);
  useEffect(() => {
    if (uygulama && q.data?.play.acik && !toparlandi.current) {
      toparlandi.current = true;
      toparla.mutate();
    }
  }, [uygulama, q.data?.play.acik, toparla]);

  if (!q.data) {
    return (
      <p className="py-8 text-center text-[13px] text-sonuk">
        {q.isError ? 'Mağaza açılamadı.' : 'Yükleniyor…'}
      </p>
    );
  }
  const d = q.data;

  return (
    <div className="space-y-4" data-magaza={uygulama ? 'uygulama' : 'web'}>
      <Kart className="p-3" vurgu="var(--color-elmas)">
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--color-elmas)' }}>
            <IkonElmas boyut={34} />
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="tabular text-[24px] leading-none font-bold text-parsomen"
              data-magaza-elmas={d.elmas}
            >
              {formatSayi(d.elmas)}
            </div>
            <div className="mt-0.5 text-[12px] text-solgun">
              {d.reklamDakikasi > 0
                ? `elmas · ${d.reklamDakikasi} dk biriken reklam süresi`
                : 'elmas'}
            </div>
          </div>
        </div>
        {/* Tek şablon: `<strong>` etrafında bölünen cümle çeviri listesine
            parça parça düşüyordu ve hiç çevrilemiyordu. */}
        <p className="mt-3 border-t border-kenar/70 pt-2.5 text-[12px] leading-snug text-sonuk">
          {sablonlu(
            'Elmas yalnız {0} kısaltır: inşaat, araştırma, eğitim, üretim ve yükseltme. Hızlanan iş beklenerek bitenle aynı. {1} kaynak, asker, kalkan, saldırı ve casus yürüyüşleri — oyuncular arası rekabete dokunan hiçbir şey.',
            [
              <strong key="z" className="text-parsomen">
                zaman
              </strong>,
              <strong key="s" className="text-parsomen">
                Satılmayanlar:
              </strong>,
            ],
          )}
        </p>
      </Kart>

      <Bolum baslik="Süren işlerin">
        {d.kuyruklar.length === 0 ? (
          <p className="text-[12px] text-sonuk">Şu an hızlandırılacak bir işin yok.</p>
        ) : (
          <div className="space-y-2">
            {d.kuyruklar.map((k) => (
              // `Kart` data-* niteliklerini aktarmıyor; işaret sarmalayıcıda.
              <div key={k.id} data-magaza-is={k.kind}>
                <Kart sakin className="flex items-center gap-2 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-parsomen">
                      {IS_ADI[k.kind] ?? k.kind}
                    </div>
                    <div className="tabular flex items-center gap-1 text-[12px] text-altin">
                      <IkonSure boyut={12} />
                      <GeriSayim bitis={k.finishAt} />
                    </div>
                  </div>
                  <HizlandirDugmesi is={k} />
                </Kart>
              </div>
            ))}
          </div>
        )}
      </Bolum>

      <ReklamBolumu d={d} uygulama={uygulama} onBildiri={setBildiri} onTazele={tazele} />

      <Bolum baslik="Elmas">
        {!uygulama && (
          <p className="mb-2 text-[12px] leading-snug text-sonuk" data-magaza-web>
            Elmas paketleri Android uygulamasında, Google Play üzerinden alınıyor.
            {d.play.paket && (
              <>
                {' '}
                <a
                  className="font-bold text-elmas underline"
                  href={`https://play.google.com/store/apps/details?id=${encodeURIComponent(d.play.paket)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Play'de aç
                </a>
              </>
            )}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {d.paketler.map((p) => {
            const satilabilir = uygulama && d.play.acik;
            const fiyatMetni = fiyat.data?.[p.urun];
            return (
              <div key={p.urun} className="flex" data-paket={p.urun}>
                <Kart className="flex w-full flex-col p-3">
                  <div className="flex items-start justify-between gap-1">
                    <span className="baslik text-[12px] leading-tight text-parsomen">{p.ad}</span>
                    {p.ek > 0 && (
                      <Rozet renk="var(--color-yesil)">{`+%${Math.round((p.ek / p.elmas) * 100)}`}</Rozet>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <span style={{ color: 'var(--color-elmas)' }}>
                      <IkonElmas boyut={18} />
                    </span>
                    <span className="tabular text-[20px] font-bold text-parsomen">
                      {formatSayi(p.toplam)}
                    </span>
                  </div>
                  {p.ek > 0 && (
                    <span className="text-[11px] text-solgun">{`${formatSayi(p.elmas)} + ${formatSayi(p.ek)} hediye`}</span>
                  )}
                  <div className="mt-auto pt-2.5">
                    {satilabilir ? (
                      <Buton
                        tur="altin"
                        tam
                        disabled={satinAl.isPending || !fiyatMetni}
                        onClick={() => {
                          setBildiri(null);
                          satinAl.mutate(p);
                        }}
                      >
                        {fiyatMetni ?? (fiyat.isError ? 'Play açılamadı' : '…')}
                      </Buton>
                    ) : (
                      <span className="block text-center text-[11px] text-solgun">
                        Android uygulamasında
                      </span>
                    )}
                  </div>
                </Kart>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-solgun">
          Satın alma Google Play üzerinden yapılır; fiyatlar Play'de vergi dahil gösterilir. İade
          Google Play'in iade kurallarına tabidir ve iade edilen satın almanın elması geri alınır.
          18 yaşından küçüksen satın almadan önce ebeveyninden izin al.{' '}
          <a className="underline" href="#/kosullar">
            Kullanım Koşulları
          </a>
        </p>
      </Bolum>

      {bildiri && (
        <p
          className={`text-[13px] ${bildiri.tur === 'iyi' ? 'text-yesil' : 'text-kirmizi'}`}
          data-magaza-bildiri={bildiri.tur}
        >
          {bildiri.metin}
        </p>
      )}

      {d.gecmis.length > 0 && (
        <Bolum baslik="Satın almaların">
          <div className="oyuk divide-y divide-kenar/60 rounded-xl px-3">
            {d.gecmis.map((g, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-2 text-[12px]">
                <span className="text-parsomen">
                  {d.paketler.find((p) => p.urun === g.urun)?.ad ?? g.urun}
                  <span className="ml-1 text-solgun">
                    {new Date(g.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span className={g.durum === 'iade' ? 'text-kirmizi' : 'text-parsomen'}>
                  {g.durum === 'iade'
                    ? `İade · −${formatSayi(g.elmas)}`
                    : `+${formatSayi(g.elmas)}`}
                </span>
              </div>
            ))}
          </div>
        </Bolum>
      )}
    </div>
  );
}

/** Ödüllü reklam: hedefsiz izlenen reklamın süresi bankaya. */
function ReklamBolumu({
  d,
  uygulama,
  onBildiri,
  onTazele,
}: {
  d: MagazaDto;
  uygulama: boolean;
  onBildiri: (b: { tur: 'iyi' | 'kotu'; metin: string }) => void;
  onTazele: () => void;
}) {
  const r = d.reklam;
  const izle = useMutation({
    mutationFn: async () => {
      const o = await api.reklamOturumu();
      const s = await reklamIzle({
        birim: r.birim!,
        oturumId: o.oturumId,
        kullanici: o.kullanici,
        kisisellestirilmis: r.kisisellestirilmis,
      });
      if (s === 'kapatildi') return null;
      for (let i = 0; i < 20; i++) {
        const x = await api.reklamOturumDurumu(o.oturumId);
        if (x.durum === 'odullendi') return x;
        await new Promise((ok) => setTimeout(ok, 1500));
      }
      return 'gecikti' as const;
    },
    onSuccess: (s) => {
      onTazele();
      if (s === null) onBildiri({ tur: 'kotu', metin: 'Reklam bitmeden kapandı; ödül yok.' });
      else if (s === 'gecikti') onBildiri({ tur: 'iyi', metin: 'Ödül birazdan gelecek.' });
      else
        onBildiri({
          tur: 'iyi',
          metin: `${s.bankaDakika} dk biriktirildi; istediğin işte kullan.`,
        });
    },
    onError: (e) => onBildiri({ tur: 'kotu', metin: (e as Error).message }),
  });

  return (
    <Bolum baslik="Ücretsiz hızlandırma">
      <div data-magaza-reklam={uygulama && r.acik ? 'acik' : 'kapali'}>
        <Kart sakin className="p-3">
          <p className="text-[12px] leading-snug text-sonuk">
            {`Kısa bir reklam izle, bir işten ${r.odulDakika} dakika sil. Bir işin yanındaki Hızlandır'dan izlersen süre o işe gider; buradan izlersen biriktirilir (en çok ${r.bankaTavanDakika} dk).`}
          </p>
          {uygulama && r.acik ? (
            <>
              <Buton
                tur="anahat"
                tam
                className="mt-2.5"
                disabled={izle.isPending || !r.hak.izinli}
                onClick={() => izle.mutate()}
              >
                {izle.isPending ? 'Reklam…' : `Reklam izle · +${r.odulDakika} dk`}
              </Buton>
              <p className="mt-1 text-[11px] text-solgun">
                {r.hak.engel === 'tavan'
                  ? 'Bugünlük reklam hakkın bitti; yarın yenilenir.'
                  : r.hak.engel === 'bekleme'
                    ? `Bir sonraki reklam ${r.hak.beklemeSn} sn sonra.`
                    : `Bugün ${r.hak.kalan}/${REKLAM.gunlukTavan} reklam hakkın var.`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[11px] text-solgun">Ödüllü reklam Android uygulamasında.</p>
          )}
        </Kart>
      </div>
    </Bolum>
  );
}
