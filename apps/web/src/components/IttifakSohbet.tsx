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
import { useState } from 'react';
import { ApiError, api } from '../api/client';
import { hisRet } from './hisGeriBildirimi';
import { ProfilKarti } from './ProfilKarti';
import { SikayetSayfasi } from './SikayetSayfasi';
import { EngelOnayi, SohbetMesajlari, type SohbetSatiri } from './SohbetMesajlari';
import { Bolum, Buton, EngelNotu, Input, Kart } from './ui';

export function IttifakSohbet({ lordId }: { lordId: string }) {
  const qc = useQueryClient();
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [sikayet, setSikayet] = useState<SohbetSatiri | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [engelSor, setEngelSor] = useState<SohbetSatiri | null>(null);
  // Ada ya da resme dokununca: genel sohbetle aynı profil kartı.
  const [profil, setProfil] = useState<string | null>(null);

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
    mutationFn: (h: SohbetSatiri) => api.engelle(h.lordId),
    onSuccess: (_, h) => {
      setEngelSor(null);
      setHata(null);
      setBilgi(
        `${h.ad} engellendi. Mesajlarını artık görmeyeceksin; Hesap ekranından kaldırabilirsin.`,
      );
      void qc.invalidateQueries({ queryKey: ['ittifak-sohbet'] });
      void qc.invalidateQueries({ queryKey: ['genel-sohbet'] });
      void qc.invalidateQueries({ queryKey: ['engeller'] });
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Engellenemedi.');
    },
  });

  if (!q.data) return null;
  const { mesajlar, enFazlaHarf } = q.data;
  const gonderilebilir = metin.trim().length > 0 && !yaz.isPending;

  return (
    <Bolum baslik="İttifak Sohbeti">
      <Kart className="p-3">
        {engelSor && (
          <EngelOnayi
            ad={engelSor.ad}
            bekliyor={engelle.isPending}
            onVazgec={() => setEngelSor(null)}
            onEngelle={() => engelle.mutate(engelSor)}
          />
        )}
        <div className="max-h-72 overflow-y-auto">
          <SohbetMesajlari
            mesajlar={mesajlar}
            benimId={lordId}
            bosMetin="Henüz kimse yazmadı. İlk sözü sen söyle — bir hedef göster, yardım iste."
            onProfil={setProfil}
            onSikayet={setSikayet}
            onEngelle={setEngelSor}
          />
        </div>

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

      {profil && <ProfilKarti lordId={profil} onKapat={() => setProfil(null)} />}
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
