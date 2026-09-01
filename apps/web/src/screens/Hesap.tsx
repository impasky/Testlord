/**
 * Hesap — parola değiştirme ve hesap silme.
 *
 * İkisi de aynı ekranda ama görsel olarak ayrılmış: silme geri alınamaz bir
 * işlem ve yanlışlıkla tetiklenmemeli. Parola ve birebir yazılan bir onay
 * metni isteniyor; tek dokunuşla silinen bir hesap, kaza demek.
 */
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type LordState } from '../api/client';
import { Alan, Bolum, Buton, EngelNotu, Input, Kart } from '../components/ui';

export function Hesap({ lord, onCikis }: { lord: LordState; onCikis: () => void }) {
  const [mevcut, setMevcut] = useState('');
  const [yeni, setYeni] = useState('');
  const [parolaBilgi, setParolaBilgi] = useState<string | null>(null);
  const [parolaHata, setParolaHata] = useState<string | null>(null);

  const [silmeAcik, setSilmeAcik] = useState(false);
  const [silmeParola, setSilmeParola] = useState('');
  const [silmeOnay, setSilmeOnay] = useState('');
  const [silmeHata, setSilmeHata] = useState<string | null>(null);

  const parolaMut = useMutation({
    mutationFn: () => api.parolaDegistir(mevcut, yeni),
    onSuccess: () => {
      setParolaHata(null);
      setParolaBilgi('Parolan değişti. Diğer cihazlarda yeniden giriş yapman gerekebilir.');
      setMevcut('');
      setYeni('');
    },
    onError: (e) => {
      setParolaBilgi(null);
      setParolaHata(e instanceof ApiError ? e.message : 'Parola değiştirilemedi.');
    },
  });

  const silmeMut = useMutation({
    mutationFn: () => api.hesabiSil(silmeParola),
    onSuccess: onCikis,
    onError: (e) => setSilmeHata(e instanceof ApiError ? e.message : 'Hesap silinemedi.'),
  });

  const parolaEngeli =
    mevcut.length === 0
      ? { kisa: 'Mevcut parolanı gir', uzun: 'Değişikliği doğrulamak için gerekiyor.' }
      : yeni.length < 8
        ? { kisa: 'Yeni parola çok kısa', uzun: 'En az 8 karakter olmalı.' }
        : null;

  const silmeEngeli =
    silmeParola.length === 0
      ? { kisa: 'Parolanı gir', uzun: 'Silme işlemini doğrulamak için gerekiyor.' }
      : silmeOnay !== 'HESABIMI SIL'
        ? { kisa: 'Onay metnini yaz', uzun: 'Kutuya birebir HESABIMI SIL yazman gerekiyor.' }
        : null;

  return (
    <div className="space-y-4 pt-3">
      <Bolum baslik="Hesap">
        <Kart className="p-3">
          <p className="text-[13px] text-solgun">
            Lordun <span className="font-bold text-parsomen">{lord.name}</span> · Seviye{' '}
            {lord.level}
          </p>
        </Kart>
      </Bolum>

      <Bolum baslik="Parola Değiştir">
        <Kart className="p-3">
          <Alan etiket="Mevcut parola">
            <Input
              type="password"
              value={mevcut}
              onChange={(e) => setMevcut(e.target.value)}
              autoComplete="current-password"
            />
          </Alan>
          <div className="mt-2.5">
            <Alan etiket="Yeni parola" ipucu="En az 8 karakter">
              <Input
                type="password"
                value={yeni}
                onChange={(e) => setYeni(e.target.value)}
                autoComplete="new-password"
              />
            </Alan>
          </div>

          <Buton
            className="mt-3"
            tam
            onClick={() => parolaMut.mutate()}
            disabled={parolaMut.isPending || parolaEngeli !== null}
          >
            {parolaMut.isPending ? 'Gönderiliyor…' : 'Parolayı değiştir'}
          </Buton>

          {parolaEngeli && <EngelNotu kisa={parolaEngeli.kisa} uzun={parolaEngeli.uzun} />}
          {parolaHata && <p className="mt-1.5 text-[12px] text-kirmizi">{parolaHata}</p>}
          {parolaBilgi && <p className="mt-1.5 text-[12px] text-yesil">{parolaBilgi}</p>}
        </Kart>
      </Bolum>

      <Bolum baslik="Hesabı Sil">
        <Kart className="border-kirmizi/40 p-3">
          <p className="text-[12px] text-solgun">
            Hesabın, lordun, ordun ve ekipmanın kalıcı olarak silinir.{' '}
            <span className="text-kirmizi">Bu işlem geri alınamaz.</span> Bölgelerin sahipsiz
            kalır ve başkaları tarafından yeniden fethedilebilir.
          </p>

          {!silmeAcik ? (
            <Buton tur="kirmizi" className="mt-3" tam onClick={() => setSilmeAcik(true)}>
              Hesabımı silmek istiyorum
            </Buton>
          ) : (
            <div className="mt-3">
              <Alan etiket="Parolan">
                <Input
                  type="password"
                  value={silmeParola}
                  onChange={(e) => setSilmeParola(e.target.value)}
                  autoComplete="current-password"
                />
              </Alan>
              <div className="mt-2.5">
                <Alan etiket="Onay" ipucu="Kutuya HESABIMI SIL yaz">
                  <Input
                    value={silmeOnay}
                    onChange={(e) => setSilmeOnay(e.target.value)}
                    placeholder="HESABIMI SIL"
                    autoCapitalize="characters"
                  />
                </Alan>
              </div>

              <div className="mt-3 flex gap-2">
                <Buton
                  tur="anahat"
                  className="flex-1"
                  onClick={() => {
                    setSilmeAcik(false);
                    setSilmeParola('');
                    setSilmeOnay('');
                    setSilmeHata(null);
                  }}
                >
                  Vazgeç
                </Buton>
                <Buton
                  tur="kirmizi"
                  className="flex-1"
                  onClick={() => silmeMut.mutate()}
                  disabled={silmeMut.isPending || silmeEngeli !== null}
                >
                  {silmeMut.isPending ? 'Siliniyor…' : 'Kalıcı olarak sil'}
                </Buton>
              </div>

              {silmeEngeli && <EngelNotu kisa={silmeEngeli.kisa} uzun={silmeEngeli.uzun} />}
              {silmeHata && <p className="mt-1.5 text-[12px] text-kirmizi">{silmeHata}</p>}
            </div>
          )}
        </Kart>
      </Bolum>
    </div>
  );
}
