import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, getToken, setToken, type MeResponse } from './api/client';
import { MobilKabuk, type Sekme } from './components/MobilKabuk';
import { Buton } from './components/ui';
import { Demirhane } from './screens/Demirhane';
import { Generaller } from './screens/Generaller';
import { Giris } from './screens/Giris';
import { Hesap } from './screens/Hesap';
import { Harita } from './screens/Harita';
import { Kisla } from './screens/Kisla';
import { LordEkrani } from './screens/LordEkrani';
import { Malikane } from './screens/Malikane';
import { ParolaSifirla } from './screens/ParolaSifirla';
import { Siralama } from './screens/Siralama';

/**
 * E-postadaki sıfırlama bağlantısının jetonu.
 *
 * Yönlendirici yok; tek bir bağlantı için kütüphane eklemek yerine hash
 * okunuyor. Açılışta bir kez bakılıyor, sonra state üzerinden yürüyor.
 */
function hashJetonu(): string | null {
  const h = window.location.hash;
  if (!h.startsWith('#/parola-sifirla')) return null;
  return new URLSearchParams(h.slice(h.indexOf('?') + 1)).get('jeton');
}

export function App() {
  const [sifirlamaJetonu, setSifirlamaJetonu] = useState<string | null>(hashJetonu);

  // Hash yalnızca açılışta okunursa, uygulama zaten açıkken tıklanan bağlantı
  // hiçbir şey yapmaz: tarayıcı hash değişimini sayfa yüklemesi saymaz.
  useEffect(() => {
    const dinle = () => setSifirlamaJetonu(hashJetonu());
    window.addEventListener('hashchange', dinle);
    return () => window.removeEventListener('hashchange', dinle);
  }, []);
  const [girisli, setGirisli] = useState(() => getToken() !== null);
  const [sekme, setSekme] = useState<Sekme>('malikane');
  // Savaş raporundan "karşı saldır" denince haritaya taşınan hedef.
  const [hedefBolge, setHedefBolge] = useState<number | null>(null);
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

  if (sifirlamaJetonu) {
    return (
      <ParolaSifirla
        jeton={sifirlamaJetonu}
        onBitti={() => {
          window.location.hash = '';
          setSifirlamaJetonu(null);
        }}
      />
    );
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

  const { lord, queues, events, yokluk } = data;

  return (
    <MobilKabuk lord={lord} sekme={sekme} setSekme={setSekme} onCikis={cikis}>
      {sekme === 'malikane' && (
        <Malikane
          lord={lord}
          queues={queues}
          events={events}
          yokluk={yokluk}
          onKarsiSaldiri={(bolgeId) => {
            setHedefBolge(bolgeId);
            setSekme('harita');
          }}
          onGit={setSekme}
        />
      )}
      {sekme === 'kisla' && <Kisla lord={lord} queues={queues} onGuncelle={tazele} />}
      {sekme === 'harita' && (
        <Harita
          lord={lord}
          queues={queues}
          baslangicBolge={hedefBolge}
          onBaslangicIslendi={() => setHedefBolge(null)}
          onGuncelle={tazele}
        />
      )}
      {sekme === 'demirhane' && <Demirhane lord={lord} queues={queues} onGuncelle={tazele} />}
      {sekme === 'lord' && <LordEkrani lord={lord} onGuncelle={tazele} />}
      {sekme === 'generaller' && <Generaller onGuncelle={tazele} />}
      {sekme === 'siralama' && <Siralama lordId={lord.id} />}
      {sekme === 'hesap' && <Hesap lord={lord} onCikis={cikis} />}
    </MobilKabuk>
  );
}
