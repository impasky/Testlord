import { useState } from 'react';
import { ApiError, api, setToken } from '../api/client';
import { IkonNavMalikane } from '../components/Ikonlar';
import { Alan, Buton, Input, Kart } from '../components/ui';
import { TamZemin } from '../components/Zemin';

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

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);
    try {
      const s =
        mod === 'kayit' ? await api.register(email, parola, lordAdi) : await api.login(email, parola);
      setToken(s.token);
      onGiris();
    } catch (err) {
      setHata(err instanceof ApiError ? err.message : 'Bağlantı kurulamadı.');
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
                  <p className="mt-1.5 text-[11px] text-solgun">
                    Önce e-posta adresini yaz.
                  </p>
                )}
                {sifirlamaBilgi && (
                  <p className="mt-2 text-[12px] text-yesil">{sifirlamaBilgi}</p>
                )}
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
