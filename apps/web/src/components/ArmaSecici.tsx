/**
 * Arma seçici.
 *
 * docs/10 §2.1 — arma bedava ve istendiği kadar değiştirilebilir.
 * Ortaçağda arma kalıcıydı ama oyunda değiştirememek bir ceza olurdu;
 * parayla satmak ise parası olmayanı kimliksiz bırakırdı.
 *
 * Seçim ANINDA önizleniyor, kaydetmek ayrı bir hareket: oyuncu on sekiz
 * bin kombinasyonu gezerken her denemede sunucuya yazmanın anlamı yok ve
 * "beğenmedim, geri al" mümkün kalmalı.
 */
import { ARMA, type Arma as ArmaTipi } from '@lordlar/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { Arma } from './Arma';
import { hisOnay } from './hisGeriBildirimi';
import { Bolum, Buton, Kart } from './ui';

function Secenek({
  secili,
  onTikla,
  children,
  aria,
}: {
  secili: boolean;
  onTikla: () => void;
  children: React.ReactNode;
  aria: string;
}) {
  return (
    <button
      type="button"
      onClick={onTikla}
      aria-label={aria}
      aria-pressed={secili}
      className={`bas flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-2.5 py-1.5 text-[11px] ${
        secili ? 'border-altin/70 bg-altin/15 text-altin' : 'border-kenar text-solgun'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Seçici hem LORD hem İTTİFAK arması için kullanılıyor.
 *
 * Parçaları (kalkan, desen, renk, sembol) ikinci kez yazmak, bir gün
 * birine eklenen sembolün diğerinde olmaması demekti. Değişen tek şey
 * başlık, açıklama ve nereye kaydettiği; heraldiğin kendisi tek yerde.
 */
export function ArmaSecici({
  mevcut,
  baslik = 'Arman',
  aciklama = 'Armanı sıralamada, ittifak listende ve savaş raporlarında herkes görür.',
  dugme = 'Armanı değiştir',
  kaydeden,
}: {
  mevcut: ArmaTipi;
  baslik?: string;
  aciklama?: string;
  dugme?: string;
  /** Varsayılan: lordun kendi arması. */
  kaydeden?: (a: ArmaTipi) => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const [taslak, setTaslak] = useState<ArmaTipi>(mevcut);
  const [acik, setAcik] = useState(false);

  const kaydet = useMutation({
    mutationFn: () => (kaydeden ?? api.armaKaydet)(taslak),
    onSuccess: () => {
      hisOnay();
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['rankings'] });
      void qc.invalidateQueries({ queryKey: ['ittifak'] });
      setAcik(false);
    },
  });

  const degisti =
    taslak.kalkan !== mevcut.kalkan ||
    taslak.desen !== mevcut.desen ||
    taslak.renk1 !== mevcut.renk1 ||
    taslak.renk2 !== mevcut.renk2 ||
    taslak.sembol !== mevcut.sembol;

  return (
    <Bolum baslik={baslik}>
      <Kart className="p-3">
        <div className="flex items-center gap-3">
          <Arma arma={acik ? taslak : mevcut} boyut={64} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-solgun">{aciklama}</p>
            <Buton
              tur="sessiz"
              boy="kucuk"
              className="mt-2"
              onClick={() => {
                setTaslak(mevcut);
                setAcik((a) => !a);
              }}
            >
              {acik ? 'Kapat' : dugme}
            </Buton>
          </div>
        </div>

        {acik && (
          <div className="mt-3 space-y-3 border-t border-kenar/70 pt-3">
            <div>
              <span className="baslik text-[11px] text-solgun">Kalkan</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ARMA.kalkanlar.map((k) => (
                  <Secenek
                    key={k.key}
                    secili={taslak.kalkan === k.key}
                    aria={k.ad}
                    onTikla={() => setTaslak({ ...taslak, kalkan: k.key })}
                  >
                    <Arma arma={{ ...taslak, kalkan: k.key }} boyut={22} />
                  </Secenek>
                ))}
              </div>
            </div>

            <div>
              <span className="baslik text-[11px] text-solgun">Desen</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ARMA.desenler.map((d) => (
                  <Secenek
                    key={d.key}
                    secili={taslak.desen === d.key}
                    aria={d.ad}
                    onTikla={() => setTaslak({ ...taslak, desen: d.key })}
                  >
                    <Arma arma={{ ...taslak, desen: d.key }} boyut={22} />
                  </Secenek>
                ))}
              </div>
            </div>

            {(['renk1', 'renk2'] as const).map((alan) => (
              <div key={alan}>
                <span className="baslik text-[11px] text-solgun">
                  {alan === 'renk1' ? 'Zemin rengi' : 'İkinci renk'}
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ARMA.renkler.map((r) => (
                    <Secenek
                      key={r.key}
                      secili={taslak[alan] === r.key}
                      aria={r.ad}
                      onTikla={() => setTaslak({ ...taslak, [alan]: r.key })}
                    >
                      <span
                        className="block h-5 w-5 rounded"
                        style={{ background: r.kod }}
                        title={r.ad}
                      />
                    </Secenek>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <span className="baslik text-[11px] text-solgun">Sembol</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ARMA.semboller.map((sm) => (
                  <Secenek
                    key={sm.key}
                    secili={taslak.sembol === sm.key}
                    aria={sm.ad}
                    onTikla={() => setTaslak({ ...taslak, sembol: sm.key })}
                  >
                    {sm.key === 'yok' ? (
                      <span className="text-[11px]">yok</span>
                    ) : (
                      <Arma arma={{ ...taslak, sembol: sm.key }} boyut={22} />
                    )}
                  </Secenek>
                ))}
              </div>
            </div>

            <Buton
              tam
              onClick={() => kaydet.mutate()}
              disabled={!degisti || kaydet.isPending}
            >
              {kaydet.isPending ? 'Kaydediliyor…' : degisti ? 'Armayı kaydet' : 'Değişiklik yok'}
            </Buton>
          </div>
        )}
      </Kart>
    </Bolum>
  );
}
