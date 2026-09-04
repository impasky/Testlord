/**
 * İttifak sohbeti.
 *
 * docs/09 B3: "sosyal tutkalın kendisi. Moderasyon yükü getirir; ittifak
 * sohbetiyle başlanmalı." Bu yüzden kapsam dar: yalnız kendi ittifakın,
 * en fazla sekiz kişi. Kapalı bir gruba yazmak, herkese açık bir kanala
 * yazmaktan bambaşka bir sorumluluk — yazan kime yazdığını biliyor.
 *
 * Anlık değil, yoklamalı. Gerçek zamanlı bir kanal (websocket) sohbeti
 * canlandırırdı ama sunucuda kalıcı bağlantı demek; oyunun geri kalanı
 * yoklamayla çalışıyor ve sohbet için ikinci bir altyapı kurmak, bakımı
 * iki katına çıkarırdı. On saniyelik yoklama sekiz kişilik bir sohbet
 * için fazlasıyla yeterli.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../api/client';
import { hisRet } from './hisGeriBildirimi';
import { Bolum, Buton, EngelNotu, Input, Kart, formatGecen } from './ui';

export function IttifakSohbet({ lordId }: { lordId: string }) {
  const qc = useQueryClient();
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const dip = useRef<HTMLDivElement | null>(null);

  const q = useQuery({
    queryKey: ['ittifak-sohbet'],
    queryFn: api.ittifakSohbet,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const yaz = useMutation({
    mutationFn: () => api.ittifakYaz(metin.trim()),
    onSuccess: () => {
      setMetin('');
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['ittifak-sohbet'] });
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Mesaj gönderilemedi.');
    },
  });

  const sayi = q.data?.mesajlar.length ?? 0;
  // Yeni mesaj gelince dibe kaydır. Sohbet aşağı doğru akıyor; okuyanın
  // her seferinde elle kaydırması gerekmemeli.
  useEffect(() => {
    dip.current?.scrollIntoView({ block: 'nearest' });
  }, [sayi]);

  if (!q.data) return null;
  const { mesajlar, enFazlaHarf } = q.data;
  const gonderilebilir = metin.trim().length > 0 && !yaz.isPending;

  return (
    <Bolum baslik="İttifak Sohbeti">
      <Kart className="p-3">
        {mesajlar.length === 0 ? (
          <p className="text-[12px] text-sonuk">
            Henüz kimse yazmadı. İlk sözü sen söyle — bir hedef göster, yardım iste.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {mesajlar.map((m) => {
              const benim = m.lordId === lordId;
              return (
                <li key={m.id}>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`min-w-0 truncate text-[12px] font-bold ${
                        benim ? 'text-altin' : 'text-parsomen'
                      }`}
                    >
                      {m.ad}
                    </span>
                    <span className="shrink-0 text-[10px] text-sonuk">{formatGecen(m.an)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-snug">
                    {m.metin}
                  </p>
                </li>
              );
            })}
            <div ref={dip} />
          </ul>
        )}

        <div className="mt-2.5 flex gap-2 border-t border-kenar/70 pt-2.5">
          <div className="min-w-0 flex-1">
            <Input
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && gonderilebilir) yaz.mutate();
              }}
              placeholder="Bir şey yaz…"
              maxLength={enFazlaHarf}
            />
          </div>
          <Buton onClick={() => yaz.mutate()} disabled={!gonderilebilir} className="shrink-0">
            Yaz
          </Buton>
        </div>
        {hata && <EngelNotu kisa={hata} uzun="Mesajını gözden geçir ve tekrar dene." />}
      </Kart>
    </Bolum>
  );
}
