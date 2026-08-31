import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, getToken, setToken, type MeResponse } from './api/client';
import { KaynakCubugu } from './components/KaynakCubugu';
import { Button } from './components/ui';
import { Demirhane } from './screens/Demirhane';
import { Generaller } from './screens/Generaller';
import { Giris } from './screens/Giris';
import { Harita } from './screens/Harita';
import { Kisla } from './screens/Kisla';
import { LordEkrani } from './screens/LordEkrani';
import { Malikane } from './screens/Malikane';
import { Siralama } from './screens/Siralama';

type Sekme = 'malikane' | 'lord' | 'demirhane' | 'kisla' | 'harita' | 'generaller' | 'siralama';

const SEKMELER: { key: Sekme; ad: string }[] = [
  { key: 'malikane', ad: 'Malikâne' },
  { key: 'lord', ad: 'Lord' },
  { key: 'demirhane', ad: 'Demirhane' },
  { key: 'kisla', ad: 'Kışla' },
  { key: 'harita', ad: 'Harita' },
  { key: 'generaller', ad: 'Generaller' },
  { key: 'siralama', ad: 'Sıralama' },
];

export function App() {
  const [girisli, setGirisli] = useState(() => getToken() !== null);
  const [sekme, setSekme] = useState<Sekme>('malikane');
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: api.me,
    enabled: girisli,
    refetchInterval: 30_000,
    retry: false,
  });

  const tazele = () => {
    void qc.invalidateQueries({ queryKey: ['me'] });
  };

  function cikis() {
    setToken(null);
    qc.clear();
    setGirisli(false);
  }

  if (!girisli) {
    return (
      <Giris
        onGiris={() => {
          setGirisli(true);
          qc.invalidateQueries({ queryKey: ['me'] });
        }}
      />
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-kan">Oturum açılamadı. Tekrar giriş yapman gerekiyor.</p>
        <Button onClick={cikis}>Giriş ekranına dön</Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-solgun">
        Diyar yükleniyor...
      </div>
    );
  }

  const { lord, queues, events } = data;

  return (
    <div className="min-h-screen">
      <header className="border-b border-kenar bg-derin/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h1 className="text-lg font-bold tracking-wide text-altin">Lordlar Çağı</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-solgun">{lord.name}</span>
              <Button variant="ghost" onClick={cikis}>
                Çıkış
              </Button>
            </div>
          </div>
          <KaynakCubugu lord={lord} />
        </div>
      </header>

      <nav className="border-b border-kenar bg-panel/40">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {SEKMELER.map((s) => (
            <button
              key={s.key}
              onClick={() => setSekme(s.key)}
              className={`border-b-2 px-4 py-2.5 text-sm transition-colors ${
                sekme === s.key
                  ? 'border-altin text-altin'
                  : 'border-transparent text-solgun hover:text-parsomen'
              }`}
            >
              {s.ad}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {sekme === 'malikane' && <Malikane lord={lord} queues={queues} events={events} />}
        {sekme === 'lord' && <LordEkrani lord={lord} onGuncelle={tazele} />}
        {sekme === 'demirhane' && <Demirhane onGuncelle={tazele} />}
        {sekme === 'kisla' && <Kisla onGuncelle={tazele} />}
        {sekme === 'harita' && <Harita onGuncelle={tazele} />}
        {sekme === 'generaller' && <Generaller onGuncelle={tazele} />}
        {sekme === 'siralama' && <Siralama lordId={lord.id} />}
      </main>
    </div>
  );
}
