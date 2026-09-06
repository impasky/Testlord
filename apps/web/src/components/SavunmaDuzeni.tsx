/**
 * Savunma düzeni kartı — Malikâne'de.
 *
 * Neden var: async bir oyunda savunanın çevrimdışı olması kural, istisna
 * değil. Saldıran her seferinde dizilimini kurup taktiğini seçiyor;
 * savunan uyuyor. Bu kart, o anda verilemeyecek kararı ÖNCEDEN
 * verdiriyor — bir kez kur, her savaşta kullanılsın.
 *
 * Kurmayan cezalı değil: sunucu garnizonun varsayılan dizilimini
 * uyguluyor ve kart bunu açıkça yazıyor.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { armyCount, bosDizilim, type Dizilim } from '@lordlar/shared';
import { api } from '../api/client';
import { DizilimIzgarasi } from './DizilimIzgarasi';
import { Buton, Kart } from './ui';
import { hisOnay } from './hisGeriBildirimi';

export function SavunmaDuzeni() {
  const qc = useQueryClient();
  const [acik, setAcik] = useState(false);
  const [dizilim, setDizilim] = useState<Dizilim>(() => bosDizilim());
  const [taktik, setTaktik] = useState<string | null>(null);
  const [kirli, setKirli] = useState(false);

  const kayit = useQuery({ queryKey: ['savunma-duzeni'], queryFn: api.savunmaDuzeni });

  // Sunucudan gelen düzeni yerel duruma AL — ama oyuncunun kaydetmemiş
  // değişikliğinin üstüne yazma. Yoksa her arka plan tazelemesi
  // oyuncunun elindeki düzenlemeyi silerdi.
  useEffect(() => {
    if (!kayit.data || kirli) return;
    setDizilim(kayit.data.dizilim);
    setTaktik(kayit.data.taktik);
  }, [kayit.data, kirli]);

  const kaydet = useMutation({
    mutationFn: () => api.savunmaDuzeniKaydet(dizilim, taktik),
    onSuccess: () => {
      hisOnay();
      setKirli(false);
      void qc.invalidateQueries({ queryKey: ['savunma-duzeni'] });
    },
  });

  const garnizon = kayit.data?.garnizon ?? {};
  const asker = armyCount(garnizon);

  return (
    <Kart className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="baslik text-[11px] text-solgun">Savunma Düzeni</h3>
          <p className="mt-0.5 text-[12px] leading-snug text-solgun">
            {asker === 0
              ? 'Evde asker yok. Kışla’da asker eğitince buradan savunma dizilimini kurabilirsin.'
              : kayit.data?.kayitli
                ? 'Sana saldırıldığında ordun bu düzende savaşacak.'
                : 'Kurulmadı — ordun şimdilik önerilen düzende savaşıyor. Elle kurarsan daha iyisini yapabilirsin.'}
          </p>
        </div>
        {asker > 0 && (
          <Buton tur="anahat" onClick={() => setAcik((a) => !a)} isaret="savunma-duzeni">
            {acik ? 'Kapat' : 'Düzenle'}
          </Buton>
        )}
      </div>

      {acik && asker > 0 && (
        <div className="mt-3 border-t border-cerceve/50 pt-3">
          <DizilimIzgarasi
            ordu={garnizon}
            dizilim={dizilim}
            taktik={taktik}
            baslik="Savunma dizilimi"
            onDegis={(d, t) => {
              setDizilim(d);
              setTaktik(t);
              setKirli(true);
            }}
          />
          <Buton
            className="mt-3"
            tam
            boy="buyuk"
            disabled={kaydet.isPending || !kirli}
            onClick={() => kaydet.mutate()}
          >
            {/* Etiket duruma göre DEĞİŞMİYOR: bir düğmenin adının
                değişmesi, oyuncunun aradığı düğmeyi bulamaması demek.
                Kaydedecek bir şey yoksa düğme sönük duruyor. */}
            {kaydet.isPending ? 'Kaydediliyor…' : 'Savunma düzenini kaydet'}
          </Buton>
          {kaydet.isError && (
            <p className="mt-1.5 text-[12px] text-kirmizi">Kaydedilemedi, tekrar dene.</p>
          )}
        </div>
      )}
    </Kart>
  );
}
