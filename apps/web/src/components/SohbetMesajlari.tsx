/**
 * Sohbet mesajları — genel sohbet ve ittifak sohbeti AYNI listeyi çiziyor.
 *
 * İki kanal iki ayrı liste olsaydı biri er geç ötekinden geri kalırdı:
 * birinde profil kartı açılır ötekinde açılmaz, birinde şikâyet düğmesi
 * olur ötekinde olmaz. Oyuncunun istediği davranış kanaldan bağımsız:
 * "ismine ya da profil resmine tıklayınca profil görünsün", "mesajlar
 * şikâyet edilebilsin", "oyuncu engellenebilsin".
 */
import { useEffect, useRef } from 'react';
import type { SohbetMesajiDto } from '../api/client';
import { ProfilGorseli } from './ProfilGorseli';
import { Buton, formatGecen } from './ui';

export type SohbetSatiri = SohbetMesajiDto & { ittifak?: string | null };

export function SohbetMesajlari({
  mesajlar,
  benimId,
  bosMetin,
  onProfil,
  onSikayet,
  onEngelle,
}: {
  mesajlar: SohbetSatiri[];
  benimId: string;
  bosMetin: string;
  onProfil: (lordId: string) => void;
  onSikayet: (m: SohbetSatiri) => void;
  onEngelle: (m: SohbetSatiri) => void;
}) {
  const dip = useRef<HTMLDivElement | null>(null);
  // Okuyan yukarı kaydırdıysa yeni mesaj onu dibe çekmemeli: yalnız dip
  // zaten görünürken (oyuncu akışı izliyorken) kaydırıyoruz.
  const dipteMi = useRef(true);
  const ilk = useRef(true);

  useEffect(() => {
    const el = dip.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const g = new IntersectionObserver(([e]) => {
      dipteMi.current = e?.isIntersecting ?? true;
    });
    g.observe(el);
    return () => g.disconnect();
  }, []);

  const sonId = mesajlar[mesajlar.length - 1]?.id;
  const sonBenim = mesajlar[mesajlar.length - 1]?.lordId === benimId;
  useEffect(() => {
    if (!sonId) return;
    if (ilk.current || dipteMi.current || sonBenim) {
      dip.current?.scrollIntoView({ block: 'nearest' });
      ilk.current = false;
    }
  }, [sonId, sonBenim]);

  if (mesajlar.length === 0) {
    return <p className="py-6 text-center text-[12px] text-sonuk">{bosMetin}</p>;
  }

  return (
    <ul className="space-y-2.5" data-sohbet-listesi>
      {mesajlar.map((m) => {
        const benim = m.lordId === benimId;
        return (
          <li key={m.id} className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onProfil(m.lordId)}
              aria-label={`${m.ad} profilini aç`}
              className="bas shrink-0 self-start rounded-full"
            >
              <ProfilGorseli resim={m.resim} arma={m.arma} boyut={34} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <button
                  type="button"
                  onClick={() => onProfil(m.lordId)}
                  className={`min-w-0 truncate text-left text-[12.5px] font-bold ${
                    benim ? 'text-altin' : 'text-parsomen'
                  }`}
                >
                  {m.ad}
                </button>
                {m.ittifak && (
                  <span className="shrink-0 text-[10.5px] text-sonuk">{`[${m.ittifak}]`}</span>
                )}
                <span className="ml-auto shrink-0 text-[11px] text-sonuk">{formatGecen(m.an)}</span>
              </div>
              <div className="flex items-start gap-1">
                <p
                  className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-snug ${
                    m.kaldirildi ? 'italic text-sonuk' : ''
                  }`}
                >
                  {m.metin}
                </p>
                {/* Kendi mesajını ve zaten kaldırılmışı şikâyet etmenin
                    anlamı yok: düğme yalnız işe yarayacağı yerde var. */}
                {!benim && !m.kaldirildi && (
                  <button
                    type="button"
                    onClick={() => onSikayet(m)}
                    aria-label={`${m.ad} adlı lordun mesajını şikâyet et`}
                    className="bas -my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-[13px] text-sonuk"
                  >
                    ⚑
                  </button>
                )}
                {!benim && (
                  <button
                    type="button"
                    onClick={() => onEngelle(m)}
                    aria-label={`${m.ad} adlı lordu engelle`}
                    className="bas -my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-[14px] text-sonuk"
                  >
                    ⊘
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
      <div ref={dip} aria-hidden />
    </ul>
  );
}

/**
 * Engel onayı: tek dokunuşla birini engellemek fazla kolay, ayrı bir sayfa
 * fazla ağır — sohbetin üstünde tek satırlık bir soru.
 */
export function EngelOnayi({
  ad,
  bekliyor,
  onVazgec,
  onEngelle,
}: {
  ad: string;
  bekliyor: boolean;
  onVazgec: () => void;
  onEngelle: () => void;
}) {
  return (
    <div className="mb-2.5 rounded-xl border border-kirmizi/40 bg-kirmizi/10 p-2.5">
      <p className="text-[12px] leading-snug text-parsomen">{`${ad} engellensin mi? Mesajlarını bir daha görmezsin; o bundan haberdar olmaz.`}</p>
      <div className="mt-2 flex gap-2">
        <Buton tur="anahat" boy="kucuk" onClick={onVazgec}>
          Vazgeç
        </Buton>
        <Buton boy="kucuk" onClick={onEngelle} disabled={bekliyor}>
          Engelle
        </Buton>
      </div>
    </div>
  );
}
