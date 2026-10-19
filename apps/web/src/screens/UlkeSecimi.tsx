/**
 * ÜLKE SEÇİMİ (docs/27) — oyuna başlarken bir kez.
 *
 * Ülkesi olmayan lord (yeni kayıt ya da gerçek dünyaya göçen eski lord)
 * oyuna bu ekrandan giriyor: kampı seçtiği ülkede, bir şehrin yanında
 * kuruluyor. Seçim bir kez; ülke bir takım değil, bir BAŞLANGIÇ YERİ —
 * herkes kendi adına oynuyor.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ApiError, api, type UlkeSatiriDto } from '../api/client';
import { Buton, Input, Iskelet, formatSayi } from '../components/ui';

/** Türkçe sıralama ve arama: "ı/i" ayrımı ve büyük-küçük harf duyarsız. */
const kucuk = (s: string) => s.toLocaleLowerCase('tr');

export function UlkeSecimi({ onSecildi }: { onSecildi: () => void }) {
  const qc = useQueryClient();
  const sorgu = useQuery({ queryKey: ['ulkeler'], queryFn: api.ulkeler });
  const [arama, setArama] = useState('');
  const [secili, setSecili] = useState<UlkeSatiriDto | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const sec = useMutation({
    mutationFn: (kod: string) => api.ulkeSec(kod),
    onSuccess: () => {
      // Yalnız kampa ve ülkeye bağlı veriler. Hepsini geçersiz kılmak o an
      // süren istekleri (ordu, kaynak) iptal ediyordu.
      for (const k of ['map', 'dunya', 'ulke', 'ulkeler'])
        void qc.invalidateQueries({ queryKey: [k] });
      onSecildi();
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'Seçim yapılamadı.'),
  });

  const liste = useMemo(() => {
    const u = sorgu.data?.ulkeler ?? [];
    const q = kucuk(arama.trim());
    return u
      .filter((x) => !q || kucuk(x.ad).includes(q) || kucuk(x.adEn).includes(q))
      .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  }, [sorgu.data, arama]);

  return (
    <div className="flex min-h-dvh flex-col bg-gece" data-ulke-secimi="">
      <div className="shrink-0 space-y-2 px-4 pt-6 pb-3">
        <h1 className="baslik text-[20px] text-altin">Ülkeni seç</h1>
        <p className="text-[13px] text-parsomen/85">
          Dünya artık gerçek dünya: her şehir ele geçirilebilir bir toprak, her ülkenin başkenti bir
          taht. Kampın seçtiğin ülkede kurulacak.
        </p>
        <ul className="space-y-0.5 text-[12px] text-solgun">
          <li>• Kendi ülkenin her şehrine saldırabilirsin.</li>
          <li>
            • Başka bir ülkeye ancak sınırdan geçersin: evinin ya da bir şehrinin komşusundan.
          </li>
          <li>• Herkes kendi adına oynar — aynı ülkeden lordlar da birbirine saldırabilir.</li>
          <li>• Seçim bir kez yapılır.</li>
        </ul>
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Ülke ara…"
          aria-label="Ülke ara"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-40">
        {sorgu.isLoading && <Iskelet satir={8} />}
        {sorgu.isError && (
          <p className="px-4 py-6 text-center text-[13px] text-kirmizi">
            Ülkeler yüklenemedi. Bağlantını kontrol et.
          </p>
        )}
        <ul>
          {liste.map((u) => (
            <li key={u.kod}>
              <button
                type="button"
                data-ulke={u.kod}
                aria-pressed={secili?.kod === u.kod}
                onClick={() => {
                  setSecili(u);
                  setHata(null);
                }}
                className={`bas flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                  secili?.kod === u.kod ? 'bg-altin/15' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="baslik block truncate text-[14px] text-parsomen">{u.ad}</span>
                  <span className="block truncate text-[12px] text-solgun">
                    {`${formatSayi(u.sehirSayisi)} şehir`}
                    {u.baskent ? ` · başkent ${u.baskent}` : ''}
                    {u.hukumdar ? ` · hükümdar ${u.hukumdar.name}` : ''}
                  </span>
                </span>
                <span className="tabular shrink-0 text-[12px] text-mavi">
                  {u.lordSayisi > 0 ? `${formatSayi(u.lordSayisi)} lord` : 'boş'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {secili && (
        <div className="fixed inset-x-0 bottom-0 z-20 space-y-2 border-t border-kenar bg-panel/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <p className="text-[13px] text-parsomen">
            <span className="baslik text-altin">{secili.ad}</span>
            {` — ${formatSayi(secili.sehirSayisi)} şehir. Kampın en az kalabalık küçük şehrin yanına kurulacak.`}
          </p>
          {hata && <p className="text-[12px] text-kirmizi">{hata}</p>}
          <Buton
            tam
            boy="buyuk"
            isaret="ulke-sec"
            disabled={sec.isPending}
            onClick={() => sec.mutate(secili.kod)}
          >
            {sec.isPending ? 'Kamp kuruluyor…' : `${secili.ad} ile başla`}
          </Buton>
        </div>
      )}
    </div>
  );
}
