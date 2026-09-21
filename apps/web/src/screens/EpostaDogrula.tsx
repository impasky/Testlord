/**
 * E-posta doğrulama ekranı.
 *
 * Postadaki bağlantı `#/eposta-dogrula?jeton=...` adresine düşüyor.
 * ParolaSifirla ile aynı desen: uygulamada yönlendirici yok, App
 * açılışta hash'e bakıp bu ekranı tek başına gösteriyor.
 *
 * GİRİŞ GEREKTİRMİYOR ve bu bilinçli: posta başka bir cihazda
 * açılabilir, oradaki tarayıcıda oturum olmayabilir. Jetonun kendisi
 * zaten kimliğin kanıtı.
 *
 * Doğrulama AÇILIŞTA kendiliğinden yapılıyor, bir düğmeye basılmıyor:
 * bağlantıya tıklamak zaten oyuncunun eylemi; ikinci bir onay istemek
 * aynı şeyi iki kez sormak olurdu.
 */
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ApiError, api } from '../api/client';
import { Buton, Kart } from '../components/ui';

export function EpostaDogrula({ jeton, onBitti }: { jeton: string; onBitti: () => void }) {
  const mut = useMutation({ mutationFn: () => api.epostaDogrula(jeton) });
  // Katı kipte etki iki kez çalışıyor; jeton tek kullanımlık olduğu için
  // ikinci istek "geçersiz" cevabı alır ve ekran yanlış görünürdü.
  const basladi = useRef(false);

  useEffect(() => {
    if (basladi.current) return;
    basladi.current = true;
    mut.mutate();
  }, [mut]);

  const hata = mut.error instanceof ApiError ? mut.error.message : null;

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="baslik mb-1 text-center text-[20px] text-altin">Lordlar Çağı</h1>
        <p className="mb-5 text-center text-[13px] text-solgun">E-posta doğrulama</p>

        <Kart className="p-4">
          {mut.isPending && <p className="text-[13px] text-solgun">Doğrulanıyor…</p>}
          {mut.isSuccess && (
            <p className="text-[13px] text-yesil">
              E-postan doğrulandı. Artık ittifak sohbetine yazabilir ve kaynak gönderebilirsin.
            </p>
          )}
          {mut.isError && (
            <p className="text-[13px] text-kirmizi">
              {hata ?? 'Doğrulanamadı. Hesap ekranından yeni bir bağlantı iste.'}
            </p>
          )}
          <Buton className="mt-3" tam onClick={onBitti}>
            Oyuna dön
          </Buton>
        </Kart>
      </div>
    </div>
  );
}
