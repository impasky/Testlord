/**
 * Başarımlar kartı.
 *
 * Oyunun sorunu "ne yapacağımı bilmiyorum" değildi (onu omurga çözdü,
 * docs/08 İ4); "yaptığım şey bir yere varıyor mu" idi. Başarım, ilerlemeye
 * biçim veriyor: on bölge almak bir sayı değil bir kilometre taşı oluyor.
 *
 * Tamamen türetilmiş — sunucu yalnızca ölçütleri veriyor (docs/09 K3).
 * "Yeni açıldı" işareti localStorage'da: cihaz başına bir nokta için
 * yeterli ve hiçbir oyun durumunu kirletmiyor. Okunamazsa (özel pencere,
 * silinmiş site verisi) sadece nokta çıkmıyor, kart yine çalışıyor.
 */
import { basarimSayaci, basarimlar, type BasarimOlcutleri } from '@lordlar/shared';
import { useEffect, useState } from 'react';
import { Bolum, Kart } from './ui';

const ANAHTAR = 'lordlar_gorulen_basarimlar';

function gorulenleriOku(): Set<string> {
  try {
    const ham = localStorage.getItem(ANAHTAR);
    return new Set(ham ? (JSON.parse(ham) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function Basarimlar({ olcutler }: { olcutler: BasarimOlcutleri }) {
  const kumeler = basarimlar(olcutler);
  const { tamam, toplam } = basarimSayaci(kumeler);
  const [gorulen, setGorulen] = useState<Set<string>>(() => gorulenleriOku());
  const [acik, setAcik] = useState(false);

  // Kart açıldığında tamamlananlar "görüldü" sayılıyor. Açılmadan
  // işaretlemek, oyuncunun hiç bakmadığı bir başarımı eski göstermek olurdu.
  useEffect(() => {
    if (!acik) return;
    const yeni = new Set(gorulen);
    for (const k of kumeler) for (const b of k.basarimlar) if (b.tamam) yeni.add(b.key);
    if (yeni.size === gorulen.size) return;
    setGorulen(yeni);
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify([...yeni]));
    } catch {
      // Yazamıyorsak sorun değil: nokta bir daha çıkar, oyun etkilenmez.
    }
  }, [acik, kumeler, gorulen]);

  const yeniVar = kumeler.some((k) => k.basarimlar.some((b) => b.tamam && !gorulen.has(b.key)));

  return (
    <Bolum baslik={`Başarımlar · ${tamam}/${toplam}`}>
      <Kart className="p-0">
        <button
          onClick={() => setAcik((a) => !a)}
          className="bas flex w-full items-center gap-3 p-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="oyuk h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${toplam > 0 ? (tamam / toplam) * 100 : 0}%`,
                  background: 'var(--color-altin)',
                }}
              />
            </div>
          </div>
          {yeniVar && (
            <span
              className="baslik shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-gece"
              style={{ background: 'var(--color-altin)' }}
            >
              yeni
            </span>
          )}
          <span className="baslik shrink-0 text-[11px] text-solgun">{acik ? 'kapat' : 'aç'}</span>
        </button>

        {acik && (
          <div className="space-y-3 border-t border-kenar px-3 pt-3 pb-3">
            {kumeler.map((k) => (
              <div key={k.ad}>
                <h4 className="baslik mb-1.5 text-[11px] text-sonuk">{k.ad}</h4>
                <ul className="space-y-1.5">
                  {k.basarimlar.map((b) => {
                    const oran = Math.min(1, b.hedef > 0 ? b.simdi / b.hedef : 0);
                    return (
                      <li key={b.key} className="flex items-center gap-2.5">
                        <span
                          className="baslik flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px]"
                          style={{
                            background: b.tamam ? 'var(--color-altin)' : 'var(--color-oyuk)',
                            color: b.tamam ? 'var(--color-gece)' : 'var(--color-sonuk)',
                          }}
                        >
                          {b.tamam ? '✓' : ''}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className={`truncate text-[13px] ${b.tamam ? 'text-parsomen' : 'text-solgun'}`}
                            >
                              {b.ad}
                            </span>
                            {!b.tamam && (
                              <span className="tabular shrink-0 text-[11px] text-sonuk">
                                {Math.min(b.simdi, b.hedef)}/{b.hedef}
                              </span>
                            )}
                          </div>
                          {!b.tamam && (
                            <>
                              <p className="truncate text-[11px] text-sonuk">{b.aciklama}</p>
                              <div className="oyuk mt-1 h-1 overflow-hidden rounded-full">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${oran * 100}%`,
                                    background: 'var(--color-kenar-acik)',
                                  }}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Kart>
    </Bolum>
  );
}
