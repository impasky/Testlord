import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError, api, getToken, setToken, type MeResponse } from './api/client';
import { BaglantiDurumu } from './components/BaglantiDurumu';
import { MobilKabuk, type Sekme } from './components/MobilKabuk';
import { Ogretici } from './components/Ogretici';
import { RehberIsigi } from './components/RehberIsigi';
import { Buton } from './components/ui';
import { Demirhane } from './screens/Demirhane';
import { Generaller } from './screens/Generaller';
import { Giris } from './screens/Giris';
import { Hesap } from './screens/Hesap';
import { Harita } from './screens/Harita';
import { Kisla } from './screens/Kisla';
import { LordEkrani } from './screens/LordEkrani';
import { useOmurgaAdimi } from './components/Omurga';
import { Malikane } from './screens/Malikane';
import { Gorevler } from './screens/Gorevler';
import { Olaylar } from './screens/Olaylar';
import { ParolaSifirla } from './screens/ParolaSifirla';
import { Siralama } from './screens/Siralama';
import { Ittifak } from './screens/Ittifak';

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
  /**
   * Öğretici bu oturumda kapatıldı mı.
   *
   * Sunucudaki damga tek kaynak, ama /me 30 saniyede bir tazeleniyor:
   * yalnız sunucuya bakarsak oyuncu "geç"e bastıktan sonra bir sonraki
   * /me yanıtı gelene kadar öğretici ekranda kalırdı. Bu bayrak o boşluğu
   * kapatıyor; kalıcı hâfıza değil.
   */
  const [ogreticiKapandi, setOgreticiKapandi] = useState(false);
  // Savaş raporundan "karşı saldır" denince haritaya taşınan hedef.
  const [hedefBolge, setHedefBolge] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, error, isFetching, failureCount } = useQuery<MeResponse>({
    // Sekme anahtara giriyor: sekme değişince /me yeniden çağrılır ve
    // sunucu oyuncunun hangi ekranda olduğunu kaydeder. Ölçüm için ayrı
    // bir istek açmıyoruz. (docs/08 İ7)
    queryKey: ['me', sekme],
    queryFn: () => api.me(sekme),
    // Sekme değişince anahtar da değişiyor; önceki veriyi tutmazsak her
    // sekme geçişinde "Diyar yükleniyor…" ekranı yanıp sönerdi.
    placeholderData: (onceki) => onceki,
    enabled: girisli,
    refetchInterval: 30_000,
    // Ağ hatasında birkaç kez dene: ücretsiz katmanda sunucu uykudan
    // uyanırken ilk istekler düşüyor. Yetki hatasında denemenin anlamı yok.
    retry: (deneme, e) => deneme < 3 && !(e instanceof ApiError && e.status === 401),
    retryDelay: (deneme) => Math.min(2000 * 2 ** deneme, 15_000),
  });

  // Omurganın adımı hem Malikâne kartında hem alt çubuktaki işarette
  // kullanılıyor. Hook, erken dönüşlerden ÖNCE çağrılmak zorunda.
  const omurgaAdimi = useOmurgaAdimi(data?.lord, data?.queues ?? []);

  /**
   * Rehber turu bitti: ilk bölge alındı, damga vurulsun.
   *
   * Rehberin kapatma düğmesi yok (oyuncu "okusa da okumasa da yaptırmalı"
   * dedi), o yüzden damgayı OYUN vuruyor: döngü kapandığı an.
   *
   * Görünürlük ölçütü tek başına "bölgesi yok" olsaydı damgaya gerek
   * kalmazdı — ama o zaman bölgelerini savaşta kaybetmiş KIDEMLİ bir lord
   * kendini yeniden zorunlu turun içinde bulurdu. Damga bir kez konuyor,
   * uç da `updateMany ... rehberBittiAt: null` ile korunuyor.
   */
  const rehberBitir = useMutation({
    mutationFn: api.rehberBitti,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me'] }),
  });
  const rehberDamgalandi = useRef(false);
  const rehberTuruBitti = Boolean(
    data?.lord && data.lord.regionCount > 0 && !data.lord.rehberGorundu,
  );
  useEffect(() => {
    if (!rehberTuruBitti || rehberDamgalandi.current) return;
    // Ref, /me tazelenene kadar geçen sürede ikinci bir isteği engelliyor.
    rehberDamgalandi.current = true;
    // Bağımlılık yalnız koşul: `rehberBitir` her çizimde yeni bir nesne,
    // listeye koymak etkiyi sürekli yeniden kurardı.
    rehberBitir.mutate();
  }, [rehberTuruBitti]);

  // İlk yanıt gelmeden önceki denemeler: sunucu muhtemelen uyanıyor.
  const sunucuyaUlasilamiyor = failureCount > 0 && !data;

  const tazele = () => void qc.invalidateQueries({ queryKey: ['me'] });

  function cikis() {
    setToken(null);
    qc.clear();
    setOgreticiKapandi(false);
    // Yeni lord kendi damgasını kendi hak etsin.
    rehberDamgalandi.current = false;
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

  // 401 dışındaki hatalarda oturumu düşürmüyoruz: ağ koptuğu için çıkış
  // yaptırmak, oyuncuyu yeniden giriş yapmaya zorlayan bir ceza olurdu.
  if (error && error instanceof ApiError && error.status === 401) {
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
      <>
        <BaglantiDurumu sunucuyaUlasilamiyor={sunucuyaUlasilamiyor} />
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-solgun">
          <p>Diyar yükleniyor…</p>
          {sunucuyaUlasilamiyor && (
            <p className="max-w-xs text-[12px] text-sonuk">
              Sunucu uykudan uyanıyor olabilir. Bu ilk açılışta 30–60 saniye sürebilir.
            </p>
          )}
          {error && !sunucuyaUlasilamiyor && (
            <Buton onClick={() => void qc.invalidateQueries({ queryKey: ['me'] })}>
              Yeniden dene
            </Buton>
          )}
        </div>
      </>
    );
  }

  const { lord, queues, events, yokluk } = data;

  return (
    <MobilKabuk
      lord={lord}
      sekme={sekme}
      setSekme={setSekme}
      onCikis={cikis}
      isaretli={omurgaAdimi?.hedefSekme ?? null}
    >
      <BaglantiDurumu sunucuyaUlasilamiyor={isFetching && failureCount > 0} />
      {/* Öğretici her şeyin üstünde: ilk giren oyuncu önce oyunun ne
          olduğunu okuyor, sonra ekranı görüyor. */}
      <Ogretici
        lord={lord}
        acik={!lord.ogreticiGorundu && !ogreticiKapandi}
        onKapat={() => {
          setOgreticiKapandi(true);
          tazele();
        }}
        onGit={setSekme}
      />
      {/* Rehber ışığı ekranın TAMAMINI karartıp tek düğmeyi açıkta
          bırakıyor, o yüzden burada duruyor: Malikâne'nin içinde olsaydı
          Kışla ve Harita'da sönerdi, oysa zincirin asıl düğmeleri orada.
          Sekiz sayfalık öğretici açıkken yanmıyor — iki tam ekran perde
          üst üste binmesin. */}
      <RehberIsigi
        adim={omurgaAdimi?.anahtar ?? null}
        bolgeSayisi={lord.regionCount}
        gorundu={lord.rehberGorundu}
        dogruEkranda={omurgaAdimi?.hedefSekme === sekme}
        acik={lord.ogreticiGorundu || ogreticiKapandi}
      />
      {sekme === 'malikane' && (
        <Malikane
          lord={lord}
          queues={queues}
          events={events}
          yokluk={yokluk}
          onBolgeyiAc={(bolgeId) => {
            setHedefBolge(bolgeId);
            setSekme('harita');
          }}
          onGit={setSekme}
        />
      )}
      {sekme === 'kisla' && (
        <Kisla
          lord={lord}
          queues={queues}
          onGuncelle={tazele}
          onHaritayaGit={(bolgeId) => {
            setHedefBolge(bolgeId);
            setSekme('harita');
          }}
        />
      )}
      {sekme === 'harita' && (
        <Harita
          lord={lord}
          queues={queues}
          baslangicBolge={hedefBolge}
          onBaslangicIslendi={() => setHedefBolge(null)}
          onGuncelle={tazele}
          onGit={setSekme}
        />
      )}
      {sekme === 'demirhane' && (
        <Demirhane lord={lord} queues={queues} onGuncelle={tazele} onGit={setSekme} />
      )}
      {sekme === 'gorevler' && <Gorevler lord={lord} onGit={setSekme} />}
      {sekme === 'olaylar' && (
        <Olaylar
          lord={lord}
          events={events}
          onGit={setSekme}
          onBolgeyiAc={(bolgeId) => {
            setHedefBolge(bolgeId);
            setSekme('harita');
          }}
        />
      )}
      {sekme === 'lord' && <LordEkrani lord={lord} onGuncelle={tazele} />}
      {sekme === 'generaller' && <Generaller onGuncelle={tazele} />}
      {sekme === 'siralama' && <Siralama lordId={lord.id} onGit={setSekme} />}
      {sekme === 'ittifak' && <Ittifak lordId={lord.id} />}
      {sekme === 'hesap' && (
        <Hesap
          lord={lord}
          onCikis={cikis}
          onOgreticiyiAc={() => {
            setOgreticiKapandi(false);
            tazele();
          }}
        />
      )}
    </MobilKabuk>
  );
}
