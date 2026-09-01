import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, getToken, setToken, type MeResponse } from './api/client';
import { MobilKabuk, type Sekme } from './components/MobilKabuk';
import { Buton } from './components/ui';
import { Demirhane } from './screens/Demirhane';
import { Generaller } from './screens/Generaller';
import { Giris } from './screens/Giris';
import { Harita } from './screens/Harita';
import { Kisla } from './screens/Kisla';
import { LordEkrani } from './screens/LordEkrani';
import { Malikane } from './screens/Malikane';
import { Siralama } from './screens/Siralama';

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

  const tazele = () => void qc.invalidateQueries({ queryKey: ['me'] });

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
          void qc.invalidateQueries({ queryKey: ['me'] });
        }}
      />
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-kirmizi">Oturum açılamadı. Tekrar giriş yapman gerekiyor.</p>
        <Buton onClick={cikis} boy="buyuk">
          Giriş ekranına dön
        </Buton>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-solgun">
        Diyar yükleniyor...
      </div>
    );
  }

  const { lord, queues, events } = data;

  return (
    <MobilKabuk lord={lord} sekme={sekme} setSekme={setSekme} onCikis={cikis}>
      {sekme === 'malikane' && (
        <Malikane lord={lord} queues={queues} events={events} onGit={setSekme} />
      )}
      {sekme === 'kisla' && <Kisla onGuncelle={tazele} />}
      {sekme === 'harita' && <Harita lordId={lord.id} onGuncelle={tazele} />}
      {sekme === 'demirhane' && <Demirhane onGuncelle={tazele} />}
      {sekme === 'lord' && <LordEkrani lord={lord} onGuncelle={tazele} />}
      {sekme === 'generaller' && <Generaller onGuncelle={tazele} />}
      {sekme === 'siralama' && <Siralama lordId={lord.id} />}
    </MobilKabuk>
  );
}
