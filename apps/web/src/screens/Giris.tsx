import { useEffect, useState } from 'react';
import { ApiError, api, setToken, type DiyarSecimiDto } from '../api/client';
import { IkonNavMalikane } from '../components/Ikonlar';
import { Alan, Buton, Input, Kart, formatSayi } from '../components/ui';
import { TamZemin } from '../components/Zemin';

/**
 * Diyar (sunucu) seçimi.
 *
 * Eskiden yoktu: kayıt olan oyuncu en eski açık diyara konuyordu ve
 * arkadaşıyla aynı haritada oynamak isteyen iki kişi bunu yapamıyordu.
 * Bir strateji oyununda insanların oyuna girme sebeplerinden biri bu.
 *
 * TEK diyar varsa hiç görünmüyor. Seçeneği olmayan bir seçim, ekranda
 * yalnızca gürültü ve yeni oyuncuya "burada bir karar vermem gerek" diye
 * okunuyor.
 *
 * Satırda iki sayı var ve ikisi ayrı soruya cevap veriyor: KAYITLI lord
 * diyarın ne kadar dolduğunu, AKTİF lord orada gerçekten oyun olup
 * olmadığını söylüyor. Yüz kayıtlı ama üç aktif bir diyar, on aktif olandan
 * daha ıssızdır.
 */
function DiyarSecimi({
  liste,
  secili,
  onSec,
}: {
  liste: DiyarSecimiDto;
  secili: string | null;
  onSec: (id: string) => void;
}) {
  if (liste.diyarlar.length < 2) return null;
  return (
    <div>
      <span className="baslik mb-1.5 block text-[11px] text-solgun">Diyar</span>
      {/* Kaydırmalı: diyar sayısı zamanla artıyor ve liste kayıt
          ekranını süpüremez. Dört satır görünüyor, gerisi kaydırmada. */}
      <div role="radiogroup" aria-label="Diyar" className="max-h-56 space-y-1.5 overflow-y-auto">
        {liste.diyarlar.map((d) => {
          const bu = secili === d.id;
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={bu}
              onClick={() => onSec(d.id)}
              className={`bas block w-full rounded-xl border px-3 py-2.5 text-left ${
                bu ? 'border-altin bg-altin/12' : 'border-kenar bg-yuzey'
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className={`baslik text-[13px] ${bu ? 'text-altin' : 'text-parsomen'}`}>
                  {d.ad}
                </span>
                <span className="tabular shrink-0 text-[11px] text-solgun">{`${formatSayi(d.lordSayisi)}/${formatSayi(d.kapasite)} lord`}</span>
              </span>
              <span className="mt-0.5 block text-[11px] text-sonuk">
                {d.aktifLord > 0
                  ? `${formatSayi(d.aktifLord)} lord son ${liste.aktifGun} günde oynadı`
                  : 'Henüz kimse oynamadı — yeni diyar'}
              </span>
            </button>
          );
        })}
      </div>
      <span className="mt-1 block text-[11px] text-sonuk">
        Arkadaşınla oynayacaksan onunla aynı diyarı seç. Diyarlar birbirinden bağımsız.
      </span>
    </div>
  );
}

export function Giris({ onGiris }: { onGiris: () => void }) {
  const [mod, setMod] = useState<'giris' | 'kayit'>('kayit');
  // Sıfırlama isteği aynı ekranda, ayrı bir sayfa değil: parolasını unutan
  // oyuncu zaten burada ve bir tık uzağa gitmesi gereksiz.
  const [sifirlamaAcik, setSifirlamaAcik] = useState(false);
  const [sifirlamaBilgi, setSifirlamaBilgi] = useState<string | null>(null);
  const [sifirlamaBekliyor, setSifirlamaBekliyor] = useState(false);

  async function sifirlamaIste() {
    setSifirlamaBekliyor(true);
    try {
      await api.sifirlamaIste(email);
      // Adresin kayıtlı olup olmadığını söylemiyoruz — sunucu da söylemiyor.
      // Söyleseydik hangi e-postaların kayıtlı olduğunu öğrenmenin yolu olurdu.
      setSifirlamaBilgi(
        'Adres kayıtlıysa sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et.',
      );
    } finally {
      setSifirlamaBekliyor(false);
    }
  }
  const [email, setEmail] = useState('');
  const [parola, setParola] = useState('');
  const [lordAdi, setLordAdi] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [diyarlar, setDiyarlar] = useState<DiyarSecimiDto | null>(null);
  const [diyar, setDiyar] = useState<string | null>(null);

  /*
   * Liste kayıt kipinde çekiliyor, giriş kipinde değil: mevcut oyuncunun
   * diyarı zaten belli ve gereksiz bir istek kayıt ekranını yavaşlatıyor.
   *
   * İstek başarısız olursa hiçbir şey gösterilmiyor ve kayıt eskisi gibi
   * çalışıyor — seçim bir KOLAYLIK, kaydın ön şartı değil. Sunucu listeyi
   * veremediği için kimsenin oyuna girememesi kabul edilemezdi.
   */
  useEffect(() => {
    if (mod !== 'kayit') return;
    let iptal = false;
    /*
     * Kısa bir gecikme, sonra istek.
     *
     * Ekran bir an için açılıp kapanabiliyor: elinde jeton olan oyuncunun
     * açılışında, ya da sayfa hemen yenilendiğinde. İsteği montajda atan
     * ilk hâl bu durumlarda yarıda kalan bir istek bırakıyordu — tarayıcı
     * için zararsız ama "hiçbir istek düşmeyecek" kuralını bozuyor ve o
     * kural gerçek hataları yakalıyor.
     *
     * Gecikme oyuncuya görünmüyor: kayıt formunu dolduran kimse ilk yarım
     * saniyede diyar listesine bakmıyor.
     */
    const zamanlayici = window.setTimeout(() => {
      void api
        .diyarlar()
        .then((d) => {
          if (iptal) return;
          setDiyarlar(d);
          setDiyar((onceki) => onceki ?? d.onerilen);
        })
        .catch(() => {});
    }, 400);
    return () => {
      iptal = true;
      window.clearTimeout(zamanlayici);
    };
  }, [mod]);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);
    try {
      const s =
        mod === 'kayit'
          ? await api.register(email, parola, lordAdi, diyar ?? undefined)
          : await api.login(email, parola);
      setToken(s.token);
      onGiris();
    } catch (err) {
      setHata(err instanceof ApiError ? err.message : 'Bağlantı kurulamadı.');
      /*
       * Seçilen diyar aradaki sürede dolmuş olabilir. Listeyi tazelemek,
       * oyuncunun aynı dolu satıra ikinci kez basmasını engelliyor —
       * hata mesajı "başka bir diyar seç" diyorsa ekranda güncel
       * seçeneklerin durması gerekiyor.
       */
      if (err instanceof ApiError && err.code === 'DIYAR_DOLU') {
        void api
          .diyarlar()
          .then((d) => {
            setDiyarlar(d);
            setDiyar(d.onerilen);
          })
          .catch(() => {});
      }
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-4 py-8">
      <TamZemin ad="giris" />
      {/* relative: TamZemin z-0'da duruyor, içerik onun üstünde kalmalı. */}
      <div className="relative z-10 mx-auto w-full max-w-sm">
        <header className="mb-7 text-center">
          <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-altin/15 text-altin">
            <IkonNavMalikane boyut={36} />
          </span>
          <h1 className="baslik text-3xl text-altin">Lordlar Çağı</h1>
          <p className="mt-1.5 text-[13px] text-solgun">
            Bölge kıt, rakip çok. Tahtı hak eden alır.
          </p>
        </header>

        <Kart className="p-4">
          <div className="oyuk mb-4 flex gap-1 rounded-xl p-1">
            {(['kayit', 'giris'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMod(m);
                  setHata(null);
                }}
                className={`bas baslik flex-1 rounded-lg px-3 py-2.5 text-[12px] ${
                  mod === m ? 'bg-altin text-gece' : 'text-solgun'
                }`}
              >
                {m === 'kayit' ? 'Yeni Lord' : 'Giriş'}
              </button>
            ))}
          </div>

          <form onSubmit={gonder} className="space-y-3">
            {mod === 'kayit' && (
              <Alan etiket="Lord adı" ipucu="Diyarda seni bu adla tanıyacaklar.">
                <Input
                  value={lordAdi}
                  onChange={(e) => setLordAdi(e.target.value)}
                  placeholder="Kara Yusuf"
                  required
                  minLength={3}
                  maxLength={20}
                />
              </Alan>
            )}
            {mod === 'kayit' && diyarlar && (
              <DiyarSecimi liste={diyarlar} secili={diyar} onSec={setDiyar} />
            )}
            <Alan etiket="E-posta">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
              />
            </Alan>
            <Alan etiket="Parola" ipucu={mod === 'kayit' ? 'En az 8 karakter.' : undefined}>
              <Input
                type="password"
                value={parola}
                onChange={(e) => setParola(e.target.value)}
                required
                minLength={mod === 'kayit' ? 8 : 1}
                autoComplete={mod === 'kayit' ? 'new-password' : 'current-password'}
              />
            </Alan>

            {hata && (
              <p className="rounded-xl border border-kirmizi/50 bg-kirmizi/10 px-3 py-2.5 text-[13px]">
                {hata}
              </p>
            )}

            <Buton type="submit" disabled={bekliyor} boy="buyuk" tam>
              {bekliyor ? 'Bekle...' : mod === 'kayit' ? 'Diyara Gir' : 'Giriş Yap'}
            </Buton>

            {mod === 'giris' && !sifirlamaAcik && (
              <button
                type="button"
                onClick={() => setSifirlamaAcik(true)}
                className="bas w-full text-center text-[12px] text-sonuk underline decoration-dotted underline-offset-2"
              >
                Parolamı unuttum
              </button>
            )}

            {mod === 'giris' && sifirlamaAcik && (
              <div className="oyuk rounded-xl border border-kenar p-3">
                <p className="mb-2 text-[12px] text-solgun">
                  Yukarıdaki e-posta adresine sıfırlama bağlantısı gönderelim.
                </p>
                <Buton
                  type="button"
                  tur="sessiz"
                  tam
                  onClick={sifirlamaIste}
                  disabled={sifirlamaBekliyor || !email.includes('@')}
                >
                  {sifirlamaBekliyor ? 'Gönderiliyor…' : 'Sıfırlama bağlantısı gönder'}
                </Buton>
                {!email.includes('@') && (
                  <p className="mt-1.5 text-[11px] text-solgun">Önce e-posta adresini yaz.</p>
                )}
                {sifirlamaBilgi && <p className="mt-2 text-[12px] text-yesil">{sifirlamaBilgi}</p>}
              </div>
            )}
          </form>
        </Kart>

        {mod === 'kayit' && (
          <p className="mt-4 text-center text-[11px] text-sonuk">
            Yeni lordlar 72 saat saldırıya kapalıdır.
          </p>
        )}

        <p className="mt-6 text-center text-[11px] text-sonuk">
          İkonlar{' '}
          <a
            href="https://game-icons.net"
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2"
          >
            game-icons.net
          </a>{' '}
          — CC BY 3.0
        </p>
      </div>
    </div>
  );
}
