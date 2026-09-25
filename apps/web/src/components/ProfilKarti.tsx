/**
 * Profil kartı — sohbette bir ada ya da resme dokununca.
 *
 * Oyuncunun isteği: "Mesaj yazan birinin ismine ya da profil resmine
 * tıkladığında profili ve bazı bilgiler görünsün, kritik bilgiler
 * görünmesin."
 *
 * Kartta yalnız oyunun zaten herkese gösterdiği şeyler var (sunucu da
 * yalnız bunları gönderiyor — services/profil.ts). Kaynak, ordu, ekipman,
 * kampın yeri, son görülme ve e-posta YOK: biri kişisel veri, gerisi bir
 * saldırgana bedavaya hedef seçtiren istihbarat.
 *
 * Kötüye kullanana karşı iki araç da burada: engelle (anında, sessiz) ve
 * şikâyet et (yöneticiye). Yüklenmiş bir profil resmi ayrıca şikâyet
 * edilebiliyor — hazır portreleri biz çizdik, onlar değil.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { yerel } from '@lordlar/shared';
import { ApiError, api } from '../api/client';
import { hisRet } from './hisGeriBildirimi';
import { ProfilGorseli } from './ProfilGorseli';
import { SikayetSayfasi } from './SikayetSayfasi';
import { Buton, EngelNotu, formatSayi } from './ui';

const RUTBE_ADI = { lider: 'Lider', yasli: 'Yaşlı', uye: 'Üye' } as const;

function Satir({ ad, children }: { ad: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-kenar/50 py-1.5 last:border-0">
      <dt className="shrink-0 text-[12px] text-sonuk">{ad}</dt>
      <dd className="min-w-0 truncate text-right text-[13px] text-parsomen">{children}</dd>
    </div>
  );
}

export function ProfilKarti({ lordId, onKapat }: { lordId: string; onKapat: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['profil', lordId], queryFn: () => api.profilKarti(lordId) });
  const [sikayet, setSikayet] = useState<'lord' | 'resim' | null>(null);
  const [engelSor, setEngelSor] = useState(false);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const sohbetleriTazele = () => {
    void qc.invalidateQueries({ queryKey: ['profil', lordId] });
    void qc.invalidateQueries({ queryKey: ['genel-sohbet'] });
    void qc.invalidateQueries({ queryKey: ['ittifak-sohbet'] });
    void qc.invalidateQueries({ queryKey: ['engeller'] });
  };

  const engelle = useMutation({
    mutationFn: () => api.engelle(lordId),
    onSuccess: () => {
      setEngelSor(false);
      setHata(null);
      setBilgi('Engellendi. Mesajlarını artık görmeyeceksin; o bundan haberdar olmaz.');
      sohbetleriTazele();
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Engellenemedi.');
    },
  });
  const engelKaldir = useMutation({
    mutationFn: () => api.engelKaldir(lordId),
    onSuccess: () => {
      setHata(null);
      setBilgi('Engel kaldırıldı. Mesajlarını yeniden göreceksin.');
      sohbetleriTazele();
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Engel kaldırılamadı.');
    },
  });

  const p = q.data;
  const katildi = p
    ? new Date(p.katildi).toLocaleDateString(yerel(), { month: 'long', year: 'numeric' })
    : '';

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/70"
        onClick={onKapat}
        aria-label="Profili kapat"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p ? `${p.ad} — profil` : 'Profil'}
        data-profil-karti
        className="fixed inset-x-0 bottom-0 z-[61] mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t-2 border-kenar-acik bg-derin px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-kenar-acik" aria-hidden />
        {!p ? (
          <p className="py-8 text-center text-[13px] text-sonuk">
            {q.isError ? 'Profil açılamadı.' : 'Yükleniyor…'}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <ProfilGorseli resim={p.resim} arma={p.arma} boyut={76} />
              <div className="min-w-0 flex-1">
                <h2 className="baslik truncate text-[17px] text-parsomen">{p.ad}</h2>
                <p className="text-[13px] text-altin">{p.unvan}</p>
                <p className="text-[12px] text-sonuk">
                  {p.rakip ? `Rakip lord · Sv ${p.seviye}` : `Sv ${p.seviye}`}
                </p>
              </div>
            </div>

            <dl className="oyuk mt-3 rounded-xl px-3 py-1">
              <Satir ad="Şöhret">{formatSayi(p.sohret)}</Satir>
              <Satir ad="Medeniyet">
                {p.medeniyet ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: p.medeniyet.renk }}
                      aria-hidden
                    />
                    {p.medeniyet.ad}
                    {p.faydaRutbesi && <span className="text-sonuk">{`· ${p.faydaRutbesi}`}</span>}
                  </span>
                ) : (
                  '—'
                )}
              </Satir>
              <Satir ad="İttifak">
                {p.ittifak
                  ? `[${p.ittifak.etiket}] ${p.ittifak.ad}${p.ittifak.rutbe ? ` · ${RUTBE_ADI[p.ittifak.rutbe]}` : ''}`
                  : 'Yok'}
              </Satir>
              <Satir ad="Toprak">{`${formatSayi(p.bolgeSayisi)} bölge`}</Satir>
              <Satir ad="Diyar">{p.diyar}</Satir>
              <Satir ad="Katıldı">{katildi}</Satir>
            </dl>
            <p className="mt-1.5 text-[11px] leading-snug text-sonuk">
              Kaynakları, ordusu ve hesap bilgileri kimseye gösterilmez.
            </p>

            {!p.benim && !p.rakip && (
              <div className="mt-3 space-y-2">
                {engelSor ? (
                  <div className="rounded-xl border border-kirmizi/40 bg-kirmizi/10 p-2.5">
                    <p className="text-[12px] leading-snug text-parsomen">{`${p.ad} engellensin mi? Mesajlarını bir daha görmezsin; o bundan haberdar olmaz.`}</p>
                    <div className="mt-2 flex gap-2">
                      <Buton tur="anahat" boy="kucuk" onClick={() => setEngelSor(false)}>
                        Vazgeç
                      </Buton>
                      <Buton
                        boy="kucuk"
                        onClick={() => engelle.mutate()}
                        disabled={engelle.isPending}
                      >
                        Engelle
                      </Buton>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {p.engelledin ? (
                      <Buton
                        tur="anahat"
                        className="flex-1"
                        onClick={() => engelKaldir.mutate()}
                        disabled={engelKaldir.isPending}
                      >
                        Engeli kaldır
                      </Buton>
                    ) : (
                      <Buton tur="anahat" className="flex-1" onClick={() => setEngelSor(true)}>
                        ⊘ Engelle
                      </Buton>
                    )}
                    <Buton tur="anahat" className="flex-1" onClick={() => setSikayet('lord')}>
                      ⚑ Şikâyet et
                    </Buton>
                  </div>
                )}
                {p.resim.tur === 'yuklenen' && (
                  <button
                    type="button"
                    onClick={() => setSikayet('resim')}
                    className="bas w-full py-1.5 text-[12px] text-sonuk underline decoration-dotted underline-offset-2"
                  >
                    Profil resmini şikâyet et
                  </button>
                )}
              </div>
            )}
            {p.benim && (
              <p className="mt-3 text-[12px] text-solgun">
                Bu senin profilin. Resmini Lord ekranından değiştirebilirsin.
              </p>
            )}
            {bilgi && <p className="mt-2 text-[12px] text-yesil">{bilgi}</p>}
            {hata && <EngelNotu kisa={hata} uzun="Biraz sonra yeniden dene." />}
          </>
        )}
        <Buton tur="anahat" tam className="mt-3" onClick={onKapat}>
          Kapat
        </Buton>
      </div>

      {sikayet && p && (
        <div className="relative z-[62]">
          <SikayetSayfasi
            baslik={sikayet === 'resim' ? `${p.ad} — profil resmi şikâyeti` : `${p.ad} — şikâyet`}
            onKapat={() => setSikayet(null)}
            onGonderildi={(m) => {
              setBilgi(m);
              void qc.invalidateQueries({ queryKey: ['profil', lordId] });
            }}
            gonder={(sebep, aciklama) =>
              sikayet === 'resim'
                ? api.resimRaporEt(lordId, sebep, aciklama)
                : api.raporEt(lordId, sebep, aciklama)
            }
          />
        </div>
      )}
    </>
  );
}
