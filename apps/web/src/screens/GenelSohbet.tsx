/**
 * Genel sohbet — bütün oyuncuların tek kanalı.
 *
 * Oyuncunun isteği: "Tüm oyuncuların sohbet edebileceği genel sohbet yap
 * ve buna her sayfadan erişilebilsin." Kapı olarak açılıyor; girişi üst
 * çubukta (her sekmede duruyor) ve uygulama kasasında.
 *
 * Yoklamalı, anlık değil (IttifakSohbet ile aynı gerekçe): kanal açıkken
 * birkaç saniyede bir soruluyor, kapalıyken hiç. Üst çubuktaki nokta
 * yalnız son mesajın ANINI soruyor.
 *
 * Kurallar kanalın tepesinde tek satır: yazan kime yazdığını bilmiyor,
 * ne yapabileceğini (şikâyet, engel) okumadan bilmeli.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { GENEL_SOHBET } from '@lordlar/shared';
import { ApiError, api } from '../api/client';
import { hisRet } from '../components/hisGeriBildirimi';
import { ProfilKarti } from '../components/ProfilKarti';
import { SikayetSayfasi } from '../components/SikayetSayfasi';
import { EngelOnayi, SohbetMesajlari, type SohbetSatiri } from '../components/SohbetMesajlari';
import { Buton, EngelNotu, Input } from '../components/ui';
import { okunduYaz } from '../lib/sohbetOkundu';

export function GenelSohbet({ lordId }: { lordId: string }) {
  const qc = useQueryClient();
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [profil, setProfil] = useState<string | null>(null);
  const [sikayet, setSikayet] = useState<SohbetSatiri | null>(null);
  const [engelSor, setEngelSor] = useState<SohbetSatiri | null>(null);
  // Yavaş mod: gönderdikten sonra düğme kalan saniyeyi sayıyor. Sunucu da
  // aynı freni uyguluyor; bu yalnız oyuncuya boşuna basmadan söylemek.
  const [bekle, setBekle] = useState(0);

  const durum = useQuery({
    queryKey: ['moderasyon-durum'],
    queryFn: api.moderasyonDurumu,
    staleTime: 60_000,
  });

  const q = useQuery({
    queryKey: ['genel-sohbet'],
    queryFn: api.genelSohbet,
    refetchInterval: GENEL_SOHBET.yoklamaSn * 1000,
    staleTime: 2_000,
  });

  // Açık olan sohbet okunmuş sohbettir.
  const son = q.data?.mesajlar[q.data.mesajlar.length - 1]?.an;
  useEffect(() => {
    okunduYaz(son ?? new Date().toISOString());
    void qc.invalidateQueries({ queryKey: ['genel-sohbet-son'] });
  }, [son, qc]);

  useEffect(() => {
    if (bekle <= 0) return;
    const id = window.setTimeout(() => setBekle((b) => b - 1), 1000);
    return () => window.clearTimeout(id);
  }, [bekle]);

  const yaz = useMutation({
    mutationFn: () => api.genelYaz(metin.trim()),
    onSuccess: () => {
      setMetin('');
      setHata(null);
      setBekle(q.data?.ikiMesajArasiSn ?? GENEL_SOHBET.ikiMesajArasiSn);
      void qc.invalidateQueries({ queryKey: ['genel-sohbet'] });
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Mesaj gönderilemedi.');
      void qc.invalidateQueries({ queryKey: ['moderasyon-durum'] });
    },
  });

  const engelle = useMutation({
    mutationFn: (m: SohbetSatiri) => api.engelle(m.lordId),
    onSuccess: (_, m) => {
      setEngelSor(null);
      setHata(null);
      setBilgi(
        `${m.ad} engellendi. Mesajlarını artık görmeyeceksin; Hesap ekranından kaldırabilirsin.`,
      );
      void qc.invalidateQueries({ queryKey: ['genel-sohbet'] });
      void qc.invalidateQueries({ queryKey: ['ittifak-sohbet'] });
      void qc.invalidateQueries({ queryKey: ['engeller'] });
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Engellenemedi.');
    },
  });

  const enFazla = q.data?.enFazlaHarf ?? GENEL_SOHBET.enFazlaHarf;
  const gonderilebilir = metin.trim().length > 0 && !yaz.isPending && bekle <= 0;
  const d = durum.data;

  return (
    <div className="flex min-h-full flex-col" data-genel-sohbet>
      <p className="mb-3 text-[12px] leading-snug text-sonuk">
        Bütün diyarların lordları burada. Saygılı ol: ⚑ ile şikâyet et, ⊘ ile engelle; ada ya da
        resme dokununca profil açılır.{' '}
        <a href="#/kosullar" className="text-solgun underline decoration-dotted underline-offset-2">
          Kurallar
        </a>
      </p>

      {engelSor && (
        <EngelOnayi
          ad={engelSor.ad}
          bekliyor={engelle.isPending}
          onVazgec={() => setEngelSor(null)}
          onEngelle={() => engelle.mutate(engelSor)}
        />
      )}

      <div className="flex-1">
        {!q.data ? (
          <p className="py-6 text-center text-[12px] text-sonuk">
            {q.isError ? 'Sohbete ulaşılamadı.' : 'Yükleniyor…'}
          </p>
        ) : (
          <SohbetMesajlari
            mesajlar={q.data.mesajlar}
            benimId={lordId}
            bosMetin="Henüz kimse yazmadı. İlk sözü sen söyle."
            onProfil={setProfil}
            onSikayet={setSikayet}
            onEngelle={setEngelSor}
          />
        )}
      </div>

      {/* Yazma kutusu panelin dibine yapışık: uzun bir akışta yazmak için
          aşağı kaydırmak gerekmesin. */}
      <div className="sticky bottom-0 -mx-3 mt-3 border-t border-kenar/70 bg-derin px-3 pt-2.5 pb-1">
        {d?.susturulmus ? (
          <p className="text-[12px] text-turuncu">{d.susturmaMetni}</p>
        ) : d && !d.epostaDogrulandi ? (
          <p className="text-[12px] text-turuncu">
            Genel sohbete yazmak için e-postanı doğrulaman gerekiyor. Hesap ekranından yeni bağlantı
            isteyebilirsin.
          </p>
        ) : (
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Input
                value={metin}
                onChange={(e) => setMetin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && gonderilebilir) yaz.mutate();
                }}
                placeholder="Diyara seslen…"
                maxLength={enFazla}
                aria-label="Genel sohbete mesaj"
              />
            </div>
            <Buton onClick={() => yaz.mutate()} disabled={!gonderilebilir} className="shrink-0">
              {bekle > 0 ? `Yaz (${bekle})` : 'Yaz'}
            </Buton>
          </div>
        )}
        {metin.length > enFazla - 30 && (
          <p className="mt-1 text-right text-[11px] text-sonuk">{`${metin.length}/${enFazla}`}</p>
        )}
        {hata && <EngelNotu kisa={hata} uzun="Mesajını gözden geçir ve tekrar dene." />}
        {bilgi && <p className="mt-2 text-[12px] text-yesil">{bilgi}</p>}
      </div>

      {profil && <ProfilKarti lordId={profil} onKapat={() => setProfil(null)} />}
      {sikayet && (
        <SikayetSayfasi
          baslik={`${sikayet.ad} — mesaj şikâyeti`}
          alinti={sikayet.metin}
          onKapat={() => setSikayet(null)}
          onGonderildi={(m) => {
            setBilgi(m);
            void qc.invalidateQueries({ queryKey: ['genel-sohbet'] });
          }}
          gonder={(sebep, aciklama) => api.genelRaporEt(sikayet.id, sebep, aciklama)}
        />
      )}
    </div>
  );
}
