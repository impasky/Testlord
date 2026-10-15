/**
 * Bildirim tercihleri (docs/12 §17): konu konu aç/kapat ve sessiz saatler.
 *
 * Push ya hep ya hiçti; gece "pazar emrin eşleşmiyor" ile uyanmak
 * istemeyen oyuncu hepsini kapatıyor, saldırı uyarısını da kaçırıyordu.
 * Her değişiklik anında kaydediliyor (ayrı bir "kaydet" düğmesi yok:
 * anahtar çevrildiği an geçerli). Sessiz saatler oyuncunun KENDİ saat
 * diliminde; dilim tarayıcıdan okunuyor.
 */
import { BILDIRIM_TURLERI, type BildirimTercihi, type BildirimTuru } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const SAATLER = Array.from({ length: 24 }, (_, i) => i);
const saatYazisi = (s: number) => `${String(s).padStart(2, '0')}:00`;

function saatDilimi(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul';
  } catch {
    return 'Europe/Istanbul';
  }
}

export function BildirimTercihleri() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['push-tercih'], queryFn: api.pushTercih });
  const kaydet = useMutation({
    mutationFn: api.pushTercihKaydet,
    // İyimser: anahtar parmağın altında hemen dönüyor; hata olursa sunucunun
    // hâline geri dönülüyor.
    onMutate: (t) => qc.setQueryData(['push-tercih'], t),
    onError: () => void qc.invalidateQueries({ queryKey: ['push-tercih'] }),
    onSuccess: (t) => qc.setQueryData(['push-tercih'], t),
  });
  const t = q.data;
  if (!t) return null;

  const degistir = (yeni: Partial<BildirimTercihi>) => kaydet.mutate({ ...t, ...yeni });
  const konuAc = (k: BildirimTuru, acik: boolean) =>
    degistir({ kapali: acik ? t.kapali.filter((x) => x !== k) : [...t.kapali, k] });

  return (
    <div className="mt-3 border-t border-kenar pt-2.5" data-bildirim-tercihleri>
      <p className="baslik mb-1 text-[11px] text-solgun">Hangi bildirimler gelsin</p>
      <ul>
        {BILDIRIM_TURLERI.map((tur) => {
          const acik = !t.kapali.includes(tur.key);
          return (
            <li key={tur.key}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-[var(--color-altin)]"
                  checked={acik}
                  data-bildirim-turu={tur.key}
                  onChange={(e) => konuAc(tur.key, e.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold">{tur.ad}</span>
                  <span className="block text-[11px] leading-snug text-sonuk">{tur.aciklama}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <label className="mt-1 flex min-h-[44px] cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 accent-[var(--color-altin)]"
          checked={t.sessiz !== null}
          data-sessiz-saat
          onChange={(e) =>
            degistir({ sessiz: e.target.checked ? { bas: 23, son: 8, dilim: saatDilimi() } : null })
          }
        />
        <span className="text-[13px] font-bold">Sessiz saatler</span>
      </label>
      {t.sessiz && (
        <div className="flex items-center gap-2 pl-7 text-[13px]">
          <select
            aria-label="Sessiz saatlerin başı"
            className="min-h-[44px] rounded-lg border border-kenar oyuk px-2"
            value={t.sessiz.bas}
            onChange={(e) => degistir({ sessiz: { ...t.sessiz!, bas: Number(e.target.value) } })}
          >
            {SAATLER.map((s) => (
              <option key={s} value={s}>
                {saatYazisi(s)}
              </option>
            ))}
          </select>
          <span className="text-sonuk">–</span>
          <select
            aria-label="Sessiz saatlerin sonu"
            className="min-h-[44px] rounded-lg border border-kenar oyuk px-2"
            value={t.sessiz.son}
            onChange={(e) => degistir({ sessiz: { ...t.sessiz!, son: Number(e.target.value) } })}
          >
            {SAATLER.map((s) => (
              <option key={s} value={s}>
                {saatYazisi(s)}
              </option>
            ))}
          </select>
        </div>
      )}
      {t.sessiz && (
        <p className="mt-1 pl-7 text-[11px] leading-snug text-sonuk">
          Bu saatlerde hiçbir bildirim gelmez; olaylar oyunun içinde seni bekler.
        </p>
      )}
      {kaydet.isError && <p className="mt-1 text-[12px] text-kirmizi">Tercih kaydedilemedi.</p>}
    </div>
  );
}
