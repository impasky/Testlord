import { useState } from 'react';
import { ApiError, api, setToken } from '../api/client';
import { Button, Field, Input, Panel } from '../components/ui';

export function Giris({ onGiris }: { onGiris: () => void }) {
  const [mod, setMod] = useState<'giris' | 'kayit'>('kayit');
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
      const sonuc =
        mod === 'kayit'
          ? await api.register(email, parola, lordAdi)
          : await api.login(email, parola);
      setToken(sonuc.token);
      onGiris();
    } catch (err) {
      setHata(err instanceof ApiError ? err.message : 'Bağlantı kurulamadı.');
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-wide text-altin">Lordlar Çağı</h1>
          <p className="mt-1 text-sm text-solgun">
            Bölge kıt, rakip çok. Tahtı hak eden alır.
          </p>
        </header>

        <Panel>
          <div className="mb-4 flex gap-1 rounded border border-kenar p-1">
            {(['kayit', 'giris'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMod(m);
                  setHata(null);
                }}
                className={`flex-1 rounded px-3 py-1.5 text-sm transition-colors ${
                  mod === m ? 'bg-altin/85 font-semibold text-gece' : 'text-solgun hover:bg-kenar/50'
                }`}
              >
                {m === 'kayit' ? 'Yeni Lord' : 'Giriş'}
              </button>
            ))}
          </div>

          <form onSubmit={gonder} className="space-y-3">
            {mod === 'kayit' && (
              <Field label="Lord adı" hint="Diyarda seni bu adla tanıyacaklar.">
                <Input
                  value={lordAdi}
                  onChange={(e) => setLordAdi(e.target.value)}
                  placeholder="Kara Yusuf"
                  required
                  minLength={3}
                  maxLength={20}
                />
              </Field>
            )}
            <Field label="E-posta">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <Field label="Parola" hint={mod === 'kayit' ? 'En az 8 karakter.' : undefined}>
              <Input
                type="password"
                value={parola}
                onChange={(e) => setParola(e.target.value)}
                required
                minLength={mod === 'kayit' ? 8 : 1}
                autoComplete={mod === 'kayit' ? 'new-password' : 'current-password'}
              />
            </Field>

            {hata && (
              <p className="rounded border border-kan/50 bg-kan/15 px-3 py-2 text-sm text-parsomen">
                {hata}
              </p>
            )}

            <Button type="submit" disabled={bekliyor} className="w-full">
              {bekliyor ? 'Bekle...' : mod === 'kayit' ? 'Diyara Gir' : 'Giriş Yap'}
            </Button>
          </form>
        </Panel>

        {mod === 'kayit' && (
          <p className="mt-4 text-center text-xs text-solgun">
            Yeni lordlar 72 saat saldırıya kapalıdır.
          </p>
        )}

        {/* CC BY 3.0 künye şartı: ikonların kaynağı belirtilmeli. */}
        <p className="mt-6 text-center text-[11px] text-solgun/60">
          İkonlar:{' '}
          <a
            href="https://game-icons.net"
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-dotted underline-offset-2 hover:text-solgun"
          >
            game-icons.net
          </a>{' '}
          — CC BY 3.0
        </p>
      </div>
    </div>
  );
}
