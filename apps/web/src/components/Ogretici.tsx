/**
 * Öğretici — oyuncu ilk girdiğinde oyunun tamamını kabaca anlatan tam ekran
 * tanıtım.
 *
 * Neden tam ekran ve neden ilk girişte: yeni oyuncu ilk otuz saniyede "burada
 * ne var" sorusunu cevaplayamazsa çıkıyor. Malikânedeki `DiyarTanitimi` kartı
 * amacı söylüyor (docs/08 İ6), `Omurga` sıradaki adımı söylüyor (İ4) — ama
 * ikisi de oyunun HARİTASINI vermiyor: kışla nedir, demirhane ne işe yarar,
 * ittifak neden var, uykudayken silinip silinmeyeceğim. Öğretici o boşluğu
 * dolduruyor.
 *
 * Kasten anlatım, oyun içi elden tutma değil. "Şimdi şuraya bas" tarzı zorunlu
 * bir tur, oyuncunun ilk on dakikasını elinden alıyor ve zaten omurga aynı işi
 * yapıyor. Burada sekiz sayfa okunuyor, isteyen ilk saniyede geçiyor.
 *
 * İçerik burada DEĞİL: `packages/shared/src/ogretici.ts` sayfaları
 * `balance.json`dan türetiyor. Sebebi, dengedeki bir sayı değiştiğinde
 * öğreticinin sessizce yalan söylemeye başlamaması.
 */
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ogreticiSayfalari, type OgreticiSayfa } from '@lordlar/shared';
import { api, type LordState } from '../api/client';
import type { Sekme } from './MobilKabuk';
import {
  IkonKale,
  IkonKapali,
  IkonNavDemirhane,
  IkonNavHarita,
  IkonNavKisla,
  IkonNavMalikane,
  IkonSancak,
  IkonSaldiri,
  IkonSohret,
  IkonSure,
} from './Ikonlar';
import { Arma } from './Arma';
import { KarsiCemberi } from './KarsiCemberi';
import { Buton } from './ui';

/** Sayfa anahtarı → simge. Anahtarlar shared'da, simgeler burada: motorun
    metne ihtiyacı var, ikona yok. */
const SIMGELER: Record<string, typeof IkonNavMalikane> = {
  diyar: IkonNavHarita,
  kaynak: IkonSohret,
  ordu: IkonNavKisla,
  savas: IkonSaldiri,
  buyume: IkonNavDemirhane,
  koruma: IkonKale,
  ittifak: IkonSancak,
  ritim: IkonSure,
};

export function Ogretici({
  lord,
  acik,
  onKapat,
  onGit,
}: {
  /** İlk sayfada oyuncunun kendi arması gösteriliyor. */
  lord: LordState;
  acik: boolean;
  /** Öğretici bitti ya da geçildi. */
  onKapat: () => void;
  /** "Oraya git" — öğreticiyi kapatıp ilgili sekmeye taşır. */
  onGit: (s: Sekme) => void;
}) {
  const sayfalar = ogreticiSayfalari();
  const [i, setI] = useState(0);

  // Sunucuya bir kez haber ver. Başarısız olsa bile öğretici kapanıyor:
  // ağ hatası yüzünden oyuncuyu tanıtım ekranında tutmak, çözdüğünden
  // fazla sorun çıkarır (bir sonraki girişte tekrar açılır, o kadar).
  const bitirMut = useMutation({ mutationFn: api.ogreticiBitti });

  // Tam ekran açıkken arkadaki sayfa kaymasın: öğretici kapanınca oyuncu
  // baktığı yerde kalsın diye gövde kilitleniyor.
  useEffect(() => {
    if (!acik) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = onceki;
    };
  }, [acik]);

  if (!acik) return null;

  const sayfa: OgreticiSayfa = sayfalar[i]!;
  const Simge = SIMGELER[sayfa.anahtar] ?? IkonNavMalikane;
  const sonMu = i === sayfalar.length - 1;

  function kapat() {
    // Sunucuya haber ver ve BEKLEME. Yanıtı beklemek, ağın yavaş olduğu
    // bir anda oyuncuyu tanıtım ekranında tutardı. İstek düşerse öğretici
    // bir sonraki girişte tekrar açılır — kabul edilebilir tek maliyet bu.
    bitirMut.mutate();
    onKapat();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-gece"
      role="dialog"
      aria-modal="true"
      aria-label="Öğretici"
    >
      {/* ---- Üst: ilerleme ve geç ---- */}
      <div className="mx-auto flex w-full max-w-lg shrink-0 items-center gap-3 px-4 pt-4 pb-2">
        <div className="flex flex-1 gap-1">
          {sayfalar.map((s, n) => (
            <span
              key={s.anahtar}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: n <= i ? 'var(--color-altin)' : 'var(--color-kenar)' }}
            />
          ))}
        </div>
        <button
          onClick={kapat}
          className="bas baslik flex h-10 shrink-0 items-center gap-1 text-[11px] text-sonuk"
          aria-label="Öğreticiyi geç"
        >
          GEÇ
          <IkonKapali boyut={13} />
        </button>
      </div>

      {/* ---- Orta: sayfa ----
          flex-col + mt-auto: "oraya bak" düğmesi listenin hemen altında
          asılı kalmasın, okunacak şeyin sonunda dursun. */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto px-4 pb-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-altin/15 text-altin">
            <Simge boyut={26} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="baslik mb-1 text-[11px] text-sonuk">
              {i + 1} / {sayfalar.length}
            </p>
            <h2 className="baslik text-[17px] leading-tight text-altin">{sayfa.baslik}</h2>
          </div>
        </div>

        <p className="mb-4 text-[13px] leading-snug text-solgun">{sayfa.ozet}</p>

        {/* İlk sayfada oyuncunun KENDİ arması. "Sen bir lordsun" cümlesi
            soyut bir iddia olmaktan çıkıp ekranda duran bir şeye dönüşüyor;
            arma da ilk kez burada tanıtılmış oluyor (docs/10 §1.1). */}
        {sayfa.anahtar === 'diyar' && (
          <div className="oyuk mb-3 flex items-center gap-3 rounded-xl p-3">
            <Arma arma={lord.arma} boyut={46} />
            <div className="min-w-0">
              <p className="baslik truncate text-[13px] text-parsomen">{lord.name}</p>
              <p className="text-[11px] text-solgun">{lord.unvan.ad}</p>
              <p className="mt-0.5 text-[11px] text-sonuk">
                Bu senin arman. Haritada ve sıralamada seni bu temsil ediyor.
              </p>
            </div>
          </div>
        )}

        {/* Ordu sayfasında halkayı ÇİZİYORUZ: üç eşleşmeyi cümle olarak
            okumak, aralarındaki çemberi göstermiyor. */}
        {sayfa.anahtar === 'ordu' && (
          <div className="mb-3">
            <KarsiCemberi />
          </div>
        )}

        <ul className="space-y-3 pb-3">
          {sayfa.maddeler.map((m) => (
            <li key={m.vurgu} className="oyuk rounded-xl p-3">
              <p className="baslik mb-1 text-[12px] text-parsomen">{m.vurgu}</p>
              <p className="text-[12.5px] leading-snug text-solgun">{m.metin}</p>
            </li>
          ))}
        </ul>

        {sayfa.sekme && (
          <button
            onClick={() => {
              kapat();
              onGit(sayfa.sekme as Sekme);
            }}
            className="bas baslik mt-auto w-full shrink-0 rounded-xl border border-kenar py-3 text-[11px] text-solgun"
          >
            ŞİMDİ ORAYA BAK
          </button>
        )}
      </div>

      {/* ---- Alt: gezinme ----
          Sabit değil akışın sonunda: klavye/sistem çubuğu açıldığında sabit
          bir çubuk içeriğin üstüne biner. */}
      <div
        className="mx-auto flex w-full max-w-lg shrink-0 items-center gap-2 border-t border-kenar bg-derin px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <Buton
          tur="anahat"
          className="flex-1"
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={i === 0}
        >
          Geri
        </Buton>
        <Buton
          className="flex-[2]"
          boy="buyuk"
          onClick={() => (sonMu ? kapat() : setI((n) => n + 1))}
        >
          {sonMu ? 'Diyarıma dön' : 'Devam'}
        </Buton>
      </div>
    </div>
  );
}
