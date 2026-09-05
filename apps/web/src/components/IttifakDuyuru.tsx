/**
 * İttifak duyurusu — panoya çakılı kural.
 *
 * Sohbetten farkı akıp gitmemesi: "günde 5 bağış yapın, baskınlara
 * katılın" her yeni üyenin görmesi gereken bir kural ama sohbette üçüncü
 * mesajda kayboluyor. Referans oyunların hepsinde bu pano var ve sebebi
 * bu.
 *
 * Yalnız lider ve yaşlı yazabiliyor; herkes okuyor.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { duyuruEnFazlaHarf } from '@lordlar/shared';
import { ApiError, api } from '../api/client';
import { hisOnay, hisRet } from './hisGeriBildirimi';
import { Buton, Kart } from './ui';

export function IttifakDuyuru({
  duyuru,
  yazabilir,
}: {
  duyuru: string | null;
  yazabilir: boolean;
}) {
  const qc = useQueryClient();
  const [duzenle, setDuzenle] = useState(false);
  const [metin, setMetin] = useState(duyuru ?? '');
  const [hata, setHata] = useState<string | null>(null);

  const kaydet = useMutation({
    mutationFn: () => api.ittifakDuyuru(metin),
    onSuccess: () => {
      hisOnay();
      setHata(null);
      setDuzenle(false);
      void qc.invalidateQueries({ queryKey: ['ittifak'] });
    },
    onError: (e) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Duyuru kaydedilemedi.');
    },
  });

  // Duyuru yoksa ve yazamıyorsan kart hiç görünmüyor: boş bir pano
  // göstermek, olmayan bir şeye yer ayırmak.
  if (!duyuru && !yazabilir) return null;

  return (
    <Kart className="p-3" sakin={!duyuru}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="baslik text-[11px] text-sonuk">DUYURU</span>
        {yazabilir && !duzenle && (
          <button
            onClick={() => {
              setMetin(duyuru ?? '');
              setDuzenle(true);
            }}
            // -m ile dolgu satırı büyütmüyor ama dokunma hedefi 44px:
            // görsel denetim ilk hâlini 23x15 diye yakaladı.
            className="bas baslik -my-3.5 -mr-2 px-3.5 py-3.5 text-[11px] text-altin"
          >
            {duyuru ? 'DÜZENLE' : 'YAZ'}
          </button>
        )}
      </div>

      {duzenle ? (
        <>
          <textarea
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            maxLength={duyuruEnFazlaHarf()}
            rows={4}
            placeholder="Örn. Günde 5 bağış yapın, cuma akşamı ortak hedefe gidiyoruz."
            className="oyuk w-full rounded-lg px-3 py-2.5 text-[13px] text-parsomen"
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="tabular text-[11px] text-sonuk">
              {metin.length}/{duyuruEnFazlaHarf()}
            </span>
            <div className="flex flex-1 justify-end gap-2">
              <Buton tur="anahat" boy="kucuk" onClick={() => setDuzenle(false)}>
                Vazgeç
              </Buton>
              <Buton boy="kucuk" onClick={() => kaydet.mutate()} disabled={kaydet.isPending}>
                {kaydet.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </Buton>
            </div>
          </div>
        </>
      ) : (
        <p className="text-[12.5px] leading-snug whitespace-pre-wrap text-solgun">
          {duyuru ?? 'Henüz duyuru yok. Üyelerin görmesi gereken bir kural varsa buraya yaz.'}
        </p>
      )}
      {hata && <p className="mt-2 text-[12px] text-kirmizi">{hata}</p>}
    </Kart>
  );
}
