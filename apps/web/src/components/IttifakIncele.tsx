/**
 * Başka bir ittifağı inceleme kartı.
 *
 * Başvuru sistemi bunu zorunlu kıldı: kapıyı çalmadan önce "bunlar kim"
 * sorusunun bir cevabı olmalı. Öncesinde listede yalnız ad, üye sayısı ve
 * toplam şöhret vardı; bir ittifağa körlemesine giriliyordu.
 *
 * Gösterilen şey kasten sınırlı — üyeler, seviye, kapı ve duyuru. Kayıt
 * defteri, bağışlar, ortak hedef ve paktlar dışarı açık DEĞİL: onlar
 * ittifağın iç bilgisi ve rakibin eline geçtiğinde istihbarat olurdu.
 * Bilgi almanın yolu casusluk (B5) ve bedeli var.
 *
 * Tam ekran açılıyor çünkü karar burada veriliyor: liste satırının altına
 * açılan bir kutu, sekiz üyeyi ve ayrıcalıkları taşıyamazdı.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api } from '../api/client';
import { Arma } from './Arma';
import { hisOnay, hisRet } from './hisGeriBildirimi';
import { Bolum, Buton, EngelNotu, Hap, Kart, Rozet, formatSayi } from './ui';
import { Iskelet } from './ui';

export function IttifakIncele({ id, onKapat }: { id: string; onKapat: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['ittifak-incele', id],
    queryFn: () => api.ittifakIncele(id),
    staleTime: 10_000,
  });
  const [hata, setHata] = useState<string | null>(null);
  const [not, setNot] = useState('');

  const ortak = {
    onSuccess: () => {
      hisOnay();
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['ittifak'] });
      void qc.invalidateQueries({ queryKey: ['ittifak-incele', id] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'İşlem yapılamadı.');
    },
  };
  const katil = useMutation({ mutationFn: () => api.ittifakKatil(id), ...ortak });
  const basvur = useMutation({ mutationFn: () => api.ittifakBasvur(id, not.trim()), ...ortak });
  const geriCek = useMutation({
    mutationFn: (bid: string) => api.ittifakBasvuruGeriCek(bid),
    ...ortak,
  });
  const bekliyor = katil.isPending || basvur.isPending || geriCek.isPending;

  if (!q.data) return <Iskelet />;
  const a = q.data;

  return (
    <>
      <div className="px-3 pt-2">
        <Buton tur="sessiz" boy="kucuk" onClick={onKapat}>
          ← Listeye dön
        </Buton>
      </div>

      <Bolum baslik={`${a.ad} [${a.etiket}]`} yan={<Arma arma={a.arma} boyut={26} />}>
        <Kart className="p-3" vurgu="var(--color-altin)">
          <div className="flex flex-wrap gap-1.5">
            <Hap>Sv {a.seviye.seviye}</Hap>
            <Hap>
              {a.uyeler.length}/{a.azamiUye} üye
            </Hap>
            <Hap>{formatSayi(a.toplamSohret)} şöhret</Hap>
            <Hap>{a.katilim === 'acik' ? 'Herkes katılabilir' : 'Başvuru ile'}</Hap>
            {a.asgariSeviye > 1 && <Hap>en az Sv{a.asgariSeviye}</Hap>}
          </div>

          {a.duyuru && (
            <div className="mt-3 rounded-lg border border-dashed border-kenar p-2.5">
              <span className="baslik text-[11px] text-solgun">DUYURU</span>
              <p className="mt-1 text-[12px]">{a.duyuru}</p>
            </div>
          )}

          {/* Ayrıcalıklar dışarı açık: "bu ittifağa girersem ne kazanırım"
              sorusu katılma kararının yarısı. */}
          <div className="mt-3 border-t border-kenar/60 pt-2.5 text-[11px] text-solgun">
            Kaynak gönderme tavanı +{formatSayi(a.ayricaliklar.ticaretTavani)} · takviye %
            {Math.round(a.ayricaliklar.takviyeHizi * 100)} hızlı · keşif %
            {Math.round(a.ayricaliklar.kesifIndirimi * 100)} ucuz
          </div>
        </Kart>
      </Bolum>

      <Bolum baslik="Üyeler">
        <ul className="space-y-2">
          {a.uyeler.map((u) => (
            <li key={u.id}>
              <Kart sakin className="p-2.5">
                <div className="flex items-center gap-2">
                  <Arma arma={u.arma} boyut={24} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{u.ad}</span>
                  {u.rutbe !== 'uye' && <Rozet>{u.rutbe === 'lider' ? 'LİDER' : 'YAŞLI'}</Rozet>}
                  <span className="tabular shrink-0 text-[12px] text-solgun">Sv {u.seviye}</span>
                  <span className="tabular w-16 shrink-0 text-right text-[12px] font-bold">
                    {formatSayi(u.sohret)}
                  </span>
                </div>
              </Kart>
            </li>
          ))}
        </ul>
      </Bolum>

      {!a.benimki && (
        <Bolum baslik="Katılmak">
          <Kart className="p-3">
            {a.basvurumId ? (
              <>
                <p className="mb-2 text-[12px] text-solgun">
                  Başvurun gönderildi, liderin cevabı bekleniyor.
                </p>
                <Buton
                  tur="anahat"
                  boy="kucuk"
                  tam
                  disabled={bekliyor}
                  onClick={() => geriCek.mutate(a.basvurumId!)}
                >
                  Başvuruyu geri çek
                </Buton>
              </>
            ) : a.katilim === 'basvuru' ? (
              <>
                {/* Not isteğe bağlı: zorunlu olsaydı yazacak sözü olmayan
                    oyuncu boş bir cümle uydururdu ve lider için değeri
                    olmayan bir alan olurdu. */}
                <label className="baslik text-[11px] text-solgun" htmlFor="basvuru-not">
                  Kısa not (isteğe bağlı)
                </label>
                <textarea
                  id="basvuru-not"
                  value={not}
                  onChange={(e) => setNot(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="Sv12, aktifim, gece oynuyorum."
                  className="mt-1 w-full resize-none rounded-lg border border-kenar bg-gece/40 p-2 text-[12px] outline-none focus:border-altin/60"
                />
                <Buton
                  tur="altin"
                  boy="kucuk"
                  tam
                  className="mt-2"
                  disabled={bekliyor || !a.katilabilirMiyim.olur}
                  onClick={() => basvur.mutate()}
                >
                  Başvur
                </Buton>
              </>
            ) : (
              <Buton
                tur="altin"
                boy="kucuk"
                tam
                disabled={bekliyor || !a.katilabilirMiyim.olur}
                onClick={() => katil.mutate()}
              >
                Katıl
              </Buton>
            )}

            {/* Engel varsa SEBEBİ yazıyor: kapalı bir düğme, sebebini
                söylemiyorsa bir hata gibi görünür. */}
            {!a.katilabilirMiyim.olur && a.katilabilirMiyim.sebep && !a.basvurumId && (
              <div className="mt-2">
                <EngelNotu
                  kisa={a.katilabilirMiyim.sebep}
                  uzun="Koşul değiştiğinde düğme kendiliğinden açılır."
                />
              </div>
            )}
            {hata && (
              <div className="mt-2">
                <EngelNotu kisa={hata} uzun="Durum bu arada değişmiş olabilir; sayfayı tazele." />
              </div>
            )}
          </Kart>
        </Bolum>
      )}
    </>
  );
}
