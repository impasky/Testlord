/**
 * Saldırmazlık paktları (docs/09 B1d).
 *
 * İttifak "üyeler birbirine saldıramaz" diyordu ve ittifaklar ARASINDA
 * hiçbir şey yoktu: iki ittifak anlaşmak istese sohbette söz verebiliyordu,
 * oyunun bundan haberi olmuyordu.
 *
 * Kart üç frenin üçünü de yüzüne söylüyor, çünkü üçü de oyuncunun
 * planını değiştirir:
 *  - pakt kotası (kaç pakt kaldı),
 *  - feshin ANINDA olmadığı ve ne kadar süreceği,
 *  - yalnız liderin karar verebildiği.
 *
 * Fren görünmezse oyuncu reddedilen bir eylemle karşılaşıp nedenini
 * anlamıyor — deponun baştan beri uyguladığı kural (docs/08 İ1).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type IttifakListesiDto, type PaktSatiriDto } from '../api/client';
import { hisOnay, hisRet } from './hisGeriBildirimi';
import { Bolum, Buton, EngelNotu, Hap, Kart, formatKalan } from './ui';

export function Paktlar({ liste }: { liste: IttifakListesiDto[] }) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const [secili, setSecili] = useState('');

  const q = useQuery({ queryKey: ['paktlar'], queryFn: api.paktlar, staleTime: 10_000 });

  function tazele() {
    void qc.invalidateQueries({ queryKey: ['paktlar'] });
    void qc.invalidateQueries({ queryKey: ['ittifak'] });
    void qc.invalidateQueries({ queryKey: ['map'] });
  }

  // Dört mutasyon aynı sonuç/hata işini yapıyor ama hook'ları TEK TEK
  // yazıyoruz: bir yardımcı fonksiyonun içinden useMutation çağırmak
  // (çağrı sırası bugün sabit olsa bile) hook kuralını çiğniyor ve ileride
  // birini koşula sokan bir düzenleme sessizce bozardı.
  const ortak = {
    onSuccess: () => {
      hisOnay();
      setHata(null);
      setSecili('');
      tazele();
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'İşlem tamamlanamadı.');
    },
  };

  const teklif = useMutation({ mutationFn: (id: string) => api.paktTeklif(id), ...ortak });
  const kabul = useMutation({ mutationFn: (id: string) => api.paktKabul(id), ...ortak });
  const reddet = useMutation({ mutationFn: (id: string) => api.paktReddet(id), ...ortak });
  const fesih = useMutation({ mutationFn: (id: string) => api.paktFesih(id), ...ortak });

  const d = q.data;
  if (!d || !d.ittifakim) return null;

  const bekleyen = new Set([
    ...d.yururlukte.map((p) => p.ittifakId),
    ...d.gelen.map((p) => p.ittifakId),
    ...d.giden.map((p) => p.ittifakId),
  ]);
  // Teklif edilebilecek ittifaklar: kendi ittifakım ve zaten ilişkim
  // olanlar listede durmamalı — seçtiği anda reddedilen bir seçenek
  // sunmak, sunmamaktan kötü.
  const adaylar = liste.filter((a) => !a.benimki && !bekleyen.has(a.id));
  const kotaDoldu = d.yururlukte.length >= d.azami;

  return (
    <Bolum
      baslik="Saldırmazlık Paktları"
      sakin={d.yururlukte.length === 0 && d.gelen.length === 0 && d.giden.length === 0}
      yan={
        <span className="tabular text-[11px] text-sonuk">
          {d.yururlukte.length}/{d.azami}
        </span>
      }
    >
      <div className="space-y-2">
        {d.gelen.length > 0 && (
          <Kart className="p-3" vurgu="var(--color-mavi)">
            <p className="baslik mb-2 text-[11px] text-mavi">GELEN TEKLİF</p>
            {d.gelen.map((p) => (
              <Satir key={p.id} p={p}>
                {d.liderMiyim ? (
                  <>
                    <Buton
                      boy="kucuk"
                      onClick={() => kabul.mutate(p.id)}
                      disabled={kabul.isPending || kotaDoldu}
                    >
                      Kabul
                    </Buton>
                    <Buton
                      tur="anahat"
                      boy="kucuk"
                      onClick={() => reddet.mutate(p.id)}
                      disabled={reddet.isPending}
                    >
                      Reddet
                    </Buton>
                  </>
                ) : (
                  <span className="text-[11px] text-sonuk">liderin kararı</span>
                )}
              </Satir>
            ))}
          </Kart>
        )}

        {d.yururlukte.map((p) => (
          <Kart key={p.id} className="p-3" vurgu="var(--color-yesil)">
            <Satir p={p}>
              {d.liderMiyim && p.durum === 'yururlukte' && (
                <Buton
                  tur="kirmizi"
                  boy="kucuk"
                  onClick={() => fesih.mutate(p.id)}
                  disabled={fesih.isPending}
                >
                  Feshet
                </Buton>
              )}
            </Satir>
            {p.durum === 'feshediliyor' && p.kalanSn !== null && (
              <p className="mt-1.5 text-[11px] text-turuncu">
                {p.benMiFeshettim ? 'Feshettin' : 'Karşı taraf feshetti'} — pakt{' '}
                {formatKalan(p.kalanSn * 1000)} sonra sona eriyor. O ana kadar iki taraf da
                saldıramaz.
              </p>
            )}
          </Kart>
        ))}

        {d.giden.map((p) => (
          <Kart key={p.id} className="p-3" sakin>
            <Satir p={p}>
              <span className="text-[11px] text-sonuk">yanıt bekleniyor</span>
              {d.liderMiyim && (
                <Buton
                  tur="anahat"
                  boy="kucuk"
                  onClick={() => reddet.mutate(p.id)}
                  disabled={reddet.isPending}
                >
                  Geri çek
                </Buton>
              )}
            </Satir>
          </Kart>
        ))}

        {/* Teklif etme */}
        {d.liderMiyim && (
          <Kart className="p-3">
            <p className="baslik mb-2 text-[11px] text-solgun">YENİ PAKT TEKLİF ET</p>
            <p className="mb-2.5 text-[11.5px] leading-snug text-sonuk">
              Pakt iki tarafın da onayıyla kurulur. Feshetmek anında değil:{' '}
              <strong className="text-turuncu">{d.ihbarSaat} saat</strong> ihbar süresi boyunca pakt
              hâlâ korur — söz verdiğin an geri alınamıyor, o yüzden söz değerli.
            </p>
            {kotaDoldu ? (
              <EngelNotu
                kisa={`Pakt kotan dolu (${d.azami})`}
                uzun="Yeni bir pakt için önce birini feshetmen gerekiyor."
              />
            ) : adaylar.length === 0 ? (
              <p className="text-[12px] text-sonuk">Teklif edilebilecek başka ittifak yok.</p>
            ) : (
              <>
                <select
                  value={secili}
                  onChange={(e) => setSecili(e.target.value)}
                  className="oyuk mb-2 w-full rounded-lg px-3 py-2.5 text-[13px] text-parsomen"
                  aria-label="Pakt teklif edilecek ittifak"
                >
                  <option value="">İttifak seç…</option>
                  {adaylar.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.etiket}] {a.ad} · {a.uyeSayisi} üye
                    </option>
                  ))}
                </select>
                <Buton
                  className="w-full"
                  onClick={() => teklif.mutate(secili)}
                  disabled={!secili || teklif.isPending}
                >
                  {teklif.isPending ? 'Gönderiliyor…' : 'Pakt teklif et'}
                </Buton>
              </>
            )}
          </Kart>
        )}

        {!d.liderMiyim && d.yururlukte.length === 0 && d.gelen.length === 0 && (
          <Kart sakin className="p-3">
            <p className="text-[12px] text-solgun">
              İttifakının henüz paktı yok. Pakt kurma kararını lider verir.
            </p>
          </Kart>
        )}

        {hata && <EngelNotu kisa={hata} uzun="Kuralları sağladığından emin ol ve tekrar dene." />}
      </div>
    </Bolum>
  );
}

function Satir({ p, children }: { p: PaktSatiriDto; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Hap className="shrink-0">{p.etiket}</Hap>
      <span className="min-w-0 flex-1 truncate text-[13px]">{p.ad}</span>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}
