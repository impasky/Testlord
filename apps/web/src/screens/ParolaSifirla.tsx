/**
 * Parola sıfırlama ekranı.
 *
 * E-postadaki bağlantı `#/parola-sifirla?jeton=...` adresine düşer. Uygulamada
 * yönlendirici yok — sekme tabanlı — bu yüzden App açılışta hash'e bakıp bu
 * ekranı tek başına gösteriyor. Yönlendirici eklemek tek bir bağlantı için
 * fazla ağır olurdu.
 */
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api } from '../api/client';
import { Alan, Buton, Input, Kart } from '../components/ui';

export function ParolaSifirla({ jeton, onBitti }: { jeton: string; onBitti: () => void }) {
  const [parola, setParola] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bitti, setBitti] = useState(false);

  const mut = useMutation({
    mutationFn: () => api.sifirlamaYap(jeton, parola),
    onSuccess: () => {
      setHata(null);
      setBitti(true);
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'Parola sıfırlanamadı.'),
  });

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="baslik mb-1 text-center text-[20px] text-altin">Lordlar Çağı</h1>
        <p className="mb-5 text-center text-[13px] text-solgun">Yeni parolanı belirle</p>

        <Kart className="p-4">
          {bitti ? (
            <>
              <p className="text-[13px] text-yesil">
                Parolan değişti. Artık yeni parolanla giriş yapabilirsin.
              </p>
              <Buton className="mt-3" tam onClick={onBitti}>
                Giriş ekranına dön
              </Buton>
            </>
          ) : (
            <>
              <Alan etiket="Yeni parola" ipucu="En az 8 karakter">
                <Input
                  type="password"
                  value={parola}
                  onChange={(e) => setParola(e.target.value)}
                  autoComplete="new-password"
                />
              </Alan>

              <Buton
                className="mt-3"
                tam
                boy="buyuk"
                onClick={() => mut.mutate()}
                disabled={mut.isPending || parola.length < 8}
              >
                {mut.isPending ? 'Gönderiliyor…' : 'Parolayı belirle'}
              </Buton>

              {parola.length > 0 && parola.length < 8 && (
                <p className="mt-1.5 text-[11px] text-solgun">En az 8 karakter olmalı.</p>
              )}
              {hata && <p className="mt-2 text-[12px] text-kirmizi">{hata}</p>}

              <button onClick={onBitti} className="bas mt-3 w-full text-[12px] text-sonuk">
                Vazgeç, giriş ekranına dön
              </button>
            </>
          )}
        </Kart>
      </div>
    </div>
  );
}
