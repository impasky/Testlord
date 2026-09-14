/**
 * Şikâyet kuyruğu — yöneticinin ekranı.
 *
 * Neden var: `Report` tablosu vardı ama okuyan yoktu. Şikâyet bir kayda
 * dönüşüp orada kalıyordu; oyuncuya "inceleyeceğiz" denip hiç
 * incelenmemesi, şikâyet düğmesini olmamasından daha kötü yapar.
 *
 * ── Ekranın tek işi: BİR ŞİKÂYETE BAKIP KARAR VERMEK ────────────────
 *
 * Bu yüzden her satır kararı vermek için gereken HER ŞEYİ yanında
 * taşıyor: şikâyetin sebebi, şikâyet edilen mesajın metni, ve hedefin
 * moderasyon geçmişi. Geçmiş olmadan "bu kaçıncı" sorusu cevapsız kalır
 * ve aynı davranışa ilk seferki cezayı vermek zorunda kalırsın.
 *
 * Üç karar var, üçü de iz bırakıyor ve hiçbiri hesabı silmiyor:
 * yok say · mesajı kaldır · sohbette sustur.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type KuyrukSatiriDto } from '../api/client';
import { BosHal } from '../components/BosHal';
import { Bolum, Buton, EngelNotu, Iskelet, Kart, Rozet, formatGecen } from '../components/ui';

export function Moderasyon() {
  const qc = useQueryClient();
  const [durum, setDurum] = useState<'acik' | 'kapali'>('acik');
  const [sayfa, setSayfa] = useState(0);
  const [hata, setHata] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['moderasyon-kuyruk', durum, sayfa],
    queryFn: () => api.moderasyonKuyrugu(durum, sayfa),
    staleTime: 10_000,
  });

  const karar = useMutation({
    mutationFn: (v: { raporId: string; karar: string; saat: number | null }) =>
      api.moderasyonKarar(v.raporId, v.karar, v.saat),
    onSuccess: () => {
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['moderasyon-kuyruk'] });
      void qc.invalidateQueries({ queryKey: ['moderasyon-durum'] });
    },
    onError: (e: unknown) => setHata(e instanceof ApiError ? e.message : 'Karar uygulanamadı.'),
  });

  const kaldir = useMutation({
    mutationFn: (lordId: string) => api.susturmaKaldir(lordId),
    onSuccess: () => {
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['moderasyon-kuyruk'] });
    },
    onError: (e: unknown) => setHata(e instanceof ApiError ? e.message : 'Susturma kaldırılamadı.'),
  });

  if (!q.data) return <Iskelet satir={5} />;
  const { satirlar, toplam, sayfaBoyu, sureler } = q.data;
  const sonSayfa = Math.max(0, Math.ceil(toplam / sayfaBoyu) - 1);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(['acik', 'kapali'] as const).map((d) => (
          <button
            key={d}
            onClick={() => {
              setDurum(d);
              setSayfa(0);
            }}
            aria-pressed={durum === d}
            className={`bas flex-1 rounded-lg border px-3 py-2.5 text-[12px] ${
              durum === d ? 'border-altin bg-altin/15 text-altin' : 'border-kenar text-solgun'
            }`}
          >
            {d === 'acik' ? 'Bekleyen' : 'Karara bağlanan'}
          </button>
        ))}
      </div>

      {hata && <EngelNotu kisa={hata} uzun="Kuyruğu tazeleyip tekrar dene." />}

      {satirlar.length === 0 ? (
        <BosHal
          mesaj={
            durum === 'acik'
              ? 'Bekleyen şikâyet yok. Sohbet ve lord adları temiz görünüyor — yeni şikâyet gelince burada belirir.'
              : 'Henüz karara bağlanan şikâyet yok. Verdiğin kararlar burada birikir.'
          }
        />
      ) : (
        <Bolum baslik={`${toplam} şikâyet`}>
          <div className="space-y-2">
            {satirlar.map((r) => (
              <Satir
                key={r.id}
                r={r}
                sureler={sureler}
                calisiyor={karar.isPending || kaldir.isPending}
                onKarar={(k, saat) => karar.mutate({ raporId: r.id, karar: k, saat })}
                onSusturmaKaldir={() => kaldir.mutate(r.hedefId)}
              />
            ))}
          </div>
        </Bolum>
      )}

      {sonSayfa > 0 && (
        <div className="flex items-center justify-between gap-2">
          <Buton
            tur="anahat"
            boy="kucuk"
            disabled={sayfa === 0}
            onClick={() => setSayfa((s) => s - 1)}
          >
            Önceki
          </Buton>
          <span className="tabular text-[12px] text-sonuk">
            {sayfa + 1} / {sonSayfa + 1}
          </span>
          <Buton
            tur="anahat"
            boy="kucuk"
            disabled={sayfa >= sonSayfa}
            onClick={() => setSayfa((s) => s + 1)}
          >
            Sonraki
          </Buton>
        </div>
      )}
    </div>
  );
}

function Satir({
  r,
  sureler,
  calisiyor,
  onKarar,
  onSusturmaKaldir,
}: {
  r: KuyrukSatiriDto;
  sureler: { saat: number; metin: string }[];
  calisiyor: boolean;
  onKarar: (karar: string, saat: number | null) => void;
  onSusturmaKaldir: () => void;
}) {
  const acik = r.durum === 'acik';

  return (
    <Kart className="p-3">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="min-w-0 truncate text-[13px] font-bold text-parsomen">{r.hedef}</span>
        {r.hedefSusturulmus && <Rozet renk="var(--color-turuncu)">SUSTURULMUŞ</Rozet>}
        <span className="ml-auto shrink-0 text-[11px] text-sonuk">{formatGecen(r.an)}</span>
      </div>

      <p className="text-[12px] text-solgun">
        <span className="text-sonuk">{r.sikayetEden}</span> şikâyet etti: {r.sebep}
      </p>

      {/* Şikâyet edilen metin. Kararı metni görmeden vermek mümkün değil. */}
      {r.mesaj && (
        <p className="oyuk mt-2 whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-[12px] text-parsomen">
          {r.mesaj.metin}
          {r.mesaj.silinmis && <span className="ml-1 text-[11px] text-sonuk">(kaldırıldı)</span>}
          {r.mesaj.gizli && <span className="ml-1 text-[11px] text-turuncu">(gizlendi)</span>}
        </p>
      )}

      {/* "Bu kaçıncı" — karar geçmişe bakmadan verilemez. */}
      {r.gecmis.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {r.gecmis.map((g, i) => (
            <li key={i} className="text-[11px] text-sonuk">
              • {g.ozet} — {formatGecen(g.an)}
            </li>
          ))}
        </ul>
      )}

      {acik ? (
        <div className="mt-2.5 space-y-1.5 border-t border-kenar/70 pt-2.5">
          <div className="flex gap-1.5">
            <Buton
              tur="anahat"
              boy="kucuk"
              className="flex-1"
              disabled={calisiyor}
              onClick={() => onKarar('yok_say', null)}
            >
              Yok say
            </Buton>
            {r.tur === 'mesaj' && (
              <Buton
                tur="anahat"
                boy="kucuk"
                className="flex-1"
                disabled={calisiyor}
                onClick={() => onKarar('mesaj_sil', null)}
              >
                Mesajı kaldır
              </Buton>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[11px] text-sonuk">Sustur:</span>
            {sureler.map((s) => (
              <Buton
                key={s.saat}
                boy="kucuk"
                className="flex-1"
                disabled={calisiyor}
                onClick={() => onKarar('sustur', s.saat)}
              >
                {s.metin}
              </Buton>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-2 border-t border-kenar/70 pt-2.5">
          <span className="text-[12px] text-yesil">{r.karar}</span>
          {/* Yanlış karar geri alınabilmeli: alınamayan bir karar,
              yöneticiyi karar vermekten korkutur. */}
          {r.hedefSusturulmus && (
            <Buton
              tur="anahat"
              boy="kucuk"
              className="ml-auto"
              disabled={calisiyor}
              onClick={onSusturmaKaldir}
            >
              Susturmayı kaldır
            </Buton>
          )}
        </div>
      )}
    </Kart>
  );
}
