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
import { SikayetSayfasi } from './SikayetSayfasi';
import { Bolum, Buton, EngelNotu, Input, Kart, formatGecen } from './ui';

export function IttifakSohbet({ lordId }: { lordId: string }) {
  const qc = useQueryClient();
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [sikayet, setSikayet] = useState<{ id: string; ad: string; metin: string } | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  // Engel onayı: tek dokunuşla birini engellemek fazla kolay, ama ayrı bir
  // sayfa da fazla ağır — sohbetin üstünde tek satırlık bir soru.
  const [engelSor, setEngelSor] = useState<{ lordId: string; ad: string } | null>(null);
  const dip = useRef<HTMLDivElement | null>(null);

  /**
   * Susturulmuşsam yazamam ve bunu YAZMAYA ÇALIŞMADAN ÖNCE bilmeliyim.
   * Sebebini bilmeyen oyuncu davranışını değiştiremez.
   */
  const durum = useQuery({
    queryKey: ['moderasyon-durum'],
    queryFn: api.moderasyonDurumu,
    staleTime: 60_000,
  });

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
      // Susturma yazarken de yürürlüğe girebilir: durumu tazele ki kutu
      // yerini sebebe bıraksın.
      void qc.invalidateQueries({ queryKey: ['moderasyon-durum'] });
    },
  });

  /*
   * Engelle: kötüye kullanan oyuncunun mesajları bu oyuncuya bir daha
   * gelmiyor (App Store 1.2 / Google Play UGC: süzgeç, şikâyet ve
   * ENGEL). Engel Hesap ekranından kaldırılabiliyor.
   */
  const engelle = useMutation({
    mutationFn: (h: { lordId: string; ad: string }) => api.engelle(h.lordId),
    onSuccess: (_, h) => {
      setEngelSor(null);
      setHata(null);
      setBilgi(
        `${h.ad} engellendi. Mesajlarını artık görmeyeceksin; Hesap ekranından kaldırabilirsin.`,
      );
      void qc.invalidateQueries({ queryKey: ['ittifak-sohbet'] });
      void qc.invalidateQueries({ queryKey: ['engeller'] });
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Engellenemedi.');
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
        {engelSor && (
          <div className="mb-2.5 rounded-xl border border-kirmizi/40 bg-kirmizi/10 p-2.5">
            <p className="text-[12px] leading-snug text-parsomen">{`${engelSor.ad} engellensin mi? Mesajlarını bir daha görmezsin; o bundan haberdar olmaz.`}</p>
            <div className="mt-2 flex gap-2">
              <Buton tur="anahat" boy="kucuk" onClick={() => setEngelSor(null)}>
                Vazgeç
              </Buton>
              <Buton
                boy="kucuk"
                onClick={() => engelle.mutate(engelSor)}
                disabled={engelle.isPending}
              >
                Engelle
              </Buton>
            </div>
          </div>
        )}
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
                    <span className="shrink-0 text-[11px] text-sonuk">{formatGecen(m.an)}</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <p
                      className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-snug ${
                        m.kaldirildi ? 'italic text-sonuk' : ''
                      }`}
                    >
                      {m.metin}
                    </p>
                    {/* Kendi mesajını ve zaten kaldırılmışı şikâyet etmenin
                        anlamı yok: düğme yalnız işe yarayacağı yerde var. */}
                    {!benim && !m.kaldirildi && (
                      <button
                        onClick={() => setSikayet({ id: m.id, ad: m.ad, metin: m.metin })}
                        aria-label={`${m.ad} adlı lordun mesajını şikâyet et`}
                        className="bas -my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-[13px] text-sonuk"
                      >
                        ⚑
                      </button>
                    )}
                    {!benim && (
                      <button
                        onClick={() => setEngelSor({ lordId: m.lordId, ad: m.ad })}
                        aria-label={`${m.ad} adlı lordu engelle`}
                        className="bas -my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-[14px] text-sonuk"
                      >
                        ⊘
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            <div ref={dip} />
          </ul>
        )}

        {durum.data?.susturulmus ? (
          <p className="mt-2.5 border-t border-kenar/70 pt-2.5 text-[12px] text-turuncu">
            {durum.data.susturmaMetni}
          </p>
        ) : (
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
        )}
        {hata && <EngelNotu kisa={hata} uzun="Mesajını gözden geçir ve tekrar dene." />}
        {bilgi && <p className="mt-2 text-[12px] text-yesil">{bilgi}</p>}
      </Kart>

      {sikayet && (
        <SikayetSayfasi
          baslik={`${sikayet.ad} — mesaj şikâyeti`}
          alinti={sikayet.metin}
          onKapat={() => setSikayet(null)}
          onGonderildi={(m) => {
            setBilgi(m);
            void qc.invalidateQueries({ queryKey: ['ittifak-sohbet'] });
          }}
          gonder={(sebep, aciklama) => api.mesajRaporEt(sikayet.id, sebep, aciklama)}
        />
      )}
    </Bolum>
  );
}
