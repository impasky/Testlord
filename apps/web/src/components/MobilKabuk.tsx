/**
 * Mobil kabuk: sabit üst durum çubuğu + kaydırılan içerik + sabit alt gezinme.
 *
 * Masaüstü düzeni yok. Tüm ekranlar tek sütun, dokunmatik hedefleri ≥44px,
 * içerik sabit çubukların altında kalmayacak şekilde dolgulu.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LordState } from '../api/client';
import {
  IkonAltin,
  IkonDemir,
  IkonErzak,
  IkonNavDemirhane,
  IkonNavGeneraller,
  IkonNavHarita,
  IkonNavKisla,
  IkonNavLord,
  IkonNavMalikane,
  IkonNavMenu,
  IkonNavSiralama,
  IkonSancak,
  IkonSohret,
  IkonSure,
} from './Ikonlar';
import type { Ekran } from '@lordlar/shared';
import { Ilerleme, kisaSayi } from './ui';

/**
 * Sekme adları packages/shared'daki EKRANLAR'dan geliyor — sunucunun
 * ölçüm doğrulaması da aynı listeyi kullanıyor. Ayrı tutmak, yeni bir
 * ekran eklendiğinde /me'nin o ekranda 400 dönmesi demekti.
 */
export type Sekme = Ekran;

const ALT_SEKMELER: { key: Sekme; ad: string; Ikon: typeof IkonNavMalikane }[] = [
  { key: 'malikane', ad: 'Malikâne', Ikon: IkonNavMalikane },
  { key: 'kisla', ad: 'Kışla', Ikon: IkonNavKisla },
  { key: 'harita', ad: 'Harita', Ikon: IkonNavHarita },
  { key: 'demirhane', ad: 'Demirhane', Ikon: IkonNavDemirhane },
];

/**
 * Menü sayfaları.
 *
 * Sıra rastgele değil, kullanım sıklığına göre: görevler ve olaylar her
 * girişte bakılan şeyler (Malikâne'den taşındılar), hesap en altta çünkü
 * ayda bir açılıyor.
 */
const MENU_SEKMELERI: { key: Sekme; ad: string; Ikon: typeof IkonNavMalikane }[] = [
  { key: 'gorevler', ad: 'Görevler', Ikon: IkonSure },
  { key: 'olaylar', ad: 'Olaylar', Ikon: IkonSancak },
  { key: 'lord', ad: 'Lord', Ikon: IkonNavLord },
  { key: 'generaller', ad: 'Generaller', Ikon: IkonNavGeneraller },
  { key: 'siralama', ad: 'Sıralama', Ikon: IkonNavSiralama },
  { key: 'ittifak', ad: 'İttifak', Ikon: IkonSohret },
  { key: 'hesap', ad: 'Hesap', Ikon: IkonNavLord },
];

/** Kaynak sayacı: sunucu değerinden itibaren saniye saniye ilerler. */
function KaynakSayaci({
  ikon,
  deger,
  saatlik,
  tavan,
  renk,
  ad,
}: {
  ikon: ReactNode;
  deger: number;
  saatlik: number;
  tavan: number;
  renk: string;
  ad: string;
}) {
  const [, tik] = useState(0);
  const [baslangic] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => tik((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const gecen = (Date.now() - baslangic) / 3_600_000;
  const canli = Math.min(tavan, Math.max(0, deger + saatlik * gecen));
  const dolu = canli >= tavan;
  /**
   * Kaynak sütununun DURUMU.
   *
   * Üç kaynak eşit ağırlıkta duruyordu; oysa ikisi sessizce israf edilebilir
   * (depo dolunca üretim durur) ve biri eksiye düşüp orduyu eritebilir
   * (erzak). "Bir şeyler ters" bilgisi, yalnız 9 piksellik bir yazıya
   * bırakılamayacak kadar önemli — sütunun kendisi renk değiştiriyor
   * (docs/11 §2.3 G3).
   */
  const durum = saatlik < 0 ? 'kritik' : dolu ? 'israf' : null;

  return (
    <div
      className={`-mx-0.5 min-w-0 flex-1 rounded-lg px-1 py-0.5 ${
        durum === 'kritik'
          ? 'bg-kirmizi/15 ring-1 ring-kirmizi/40'
          : durum === 'israf'
            ? 'bg-turuncu/12 ring-1 ring-turuncu/30'
            : ''
      }`}
      title={`${ad}: ${Math.floor(canli)} (${saatlik >= 0 ? '+' : ''}${Math.round(saatlik)}/sa)${
        durum === 'kritik'
          ? ' — eksiye gidiyor'
          : durum === 'israf'
            ? ' — depo dolu, üretim boşa gidiyor'
            : ''
      }`}
    >
      <div className="flex items-center gap-1">
        <span className="shrink-0" style={{ color: renk }}>
          {ikon}
        </span>
        <span className="tabular truncate text-[13px] font-bold">{kisaSayi(canli)}</span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <Ilerleme deger={canli} max={tavan} renk={renk} boy="ince" />
        </div>
        <span
          className={`tabular shrink-0 text-[11px] ${saatlik < 0 ? 'text-kirmizi' : 'text-sonuk'}`}
        >
          {saatlik >= 0 ? '+' : ''}
          {Math.round(saatlik)}
        </span>
      </div>
      {durum === 'israf' && <div className="mt-0.5 text-[11px] text-turuncu">depo dolu</div>}
      {durum === 'kritik' && <div className="mt-0.5 text-[11px] text-kirmizi">azalıyor</div>}
    </div>
  );
}

export function MobilKabuk({
  lord,
  sekme,
  setSekme,
  onCikis,
  isaretli,
  children,
}: {
  lord: LordState;
  sekme: Sekme;
  setSekme: (s: Sekme) => void;
  onCikis: () => void;
  /** Omurganın işaret ettiği sekme; altın nokta oraya konur. */
  isaretli?: Sekme | null;
  children: ReactNode;
}) {
  const [menuAcik, setMenuAcik] = useState(false);
  const menudeMi = MENU_SEKMELERI.some((m) => m.key === sekme);

  // --ust-bar başlığın GERÇEK yüksekliğinden gelir, elle yazılmış bir
  // sabitten değil. styles.css'teki 108px bir tahmindi ve ölçülen 87px'ten
  // 21px fazlaydı: her ekranın tepesinde o kadar ölü boşluk kalıyordu.
  // Kartlarda fark edilmiyordu, manzara şeridi gelince başlıkla afiş
  // arasında duran karanlık bir bant olarak ortaya çıktı.
  //
  // Ölçmek tahminden ayrıca sağlam: lord adı uzunluğu, sistem yazı tipi
  // büyütmesi ya da çentik dolgusu başlığı büyütürse içerik altına kaymıyor.
  const baslikRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = baslikRef.current;
    if (!el) return;
    const yaz = () =>
      document.documentElement.style.setProperty('--ust-bar', `${el.offsetHeight}px`);
    yaz();
    const gozcu = new ResizeObserver(yaz);
    gozcu.observe(el);
    return () => gozcu.disconnect();
  }, []);

  return (
    <div className="min-h-dvh">
      {/* ---- Üst durum çubuğu ---- */}
      <header
        ref={baslikRef}
        className="fixed inset-x-0 top-0 z-30 border-b border-kenar bg-derin/95 backdrop-blur"
      >
        <div className="mx-auto max-w-lg px-3 pt-2 pb-2">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="baslik truncate text-[13px]">{lord.name}</span>
              <span className="baslik shrink-0 rounded-md bg-altin/20 px-1.5 py-0.5 text-[11px] text-altin">
                Sv {lord.level}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-[11px] text-solgun">
              <span className="text-altin">
                <IkonSohret boyut={13} />
              </span>
              <span className="tabular">{kisaSayi(lord.fame)}</span>
            </div>
            <button
              onClick={onCikis}
              className="bas baslik shrink-0 rounded-lg border border-kenar px-2 py-1 text-[11px] text-solgun"
            >
              Çıkış
            </button>
          </div>

          <div className="flex items-start gap-3">
            <KaynakSayaci
              ikon={<IkonAltin boyut={14} />}
              deger={lord.resources.altin}
              saatlik={lord.hourlyIncome.altin}
              tavan={lord.storageCapacity}
              renk="var(--color-kaynak-altin)"
              ad="Altın"
            />
            <KaynakSayaci
              ikon={<IkonDemir boyut={14} />}
              deger={lord.resources.demir}
              saatlik={lord.hourlyIncome.demir}
              tavan={lord.storageCapacity}
              renk="var(--color-kaynak-demir)"
              ad="Demir"
            />
            <KaynakSayaci
              ikon={<IkonErzak boyut={14} />}
              deger={lord.resources.erzak}
              saatlik={lord.netErzakPerHour}
              tavan={lord.storageCapacity}
              renk="var(--color-kaynak-erzak)"
              ad="Erzak"
            />
          </div>
        </div>
      </header>

      {/* ---- İçerik ---- */}
      <main
        className="mx-auto max-w-lg px-3"
        style={{ paddingTop: 'var(--ust-bar)', paddingBottom: 'calc(var(--alt-bar) + 16px)' }}
      >
        {children}
      </main>

      {/* ---- Menü sayfası ---- */}
      {menuAcik && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setMenuAcik(false)}
            aria-label="Menüyü kapat"
          />
          <div
            className="fixed inset-x-0 z-50 mx-auto max-w-lg rounded-t-2xl border-t border-kenar bg-panel p-3"
            style={{ bottom: 'var(--alt-bar)' }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-kenar" />
            <ul className="grid grid-cols-3 gap-2">
              {MENU_SEKMELERI.map(({ key, ad, Ikon }) => (
                <li key={key}>
                  <button
                    onClick={() => {
                      setSekme(key);
                      setMenuAcik(false);
                    }}
                    className={`bas flex w-full flex-col items-center gap-1.5 rounded-xl border p-3 ${
                      sekme === key
                        ? 'border-altin/60 bg-altin/10 text-altin'
                        : 'border-kenar bg-yuzey text-solgun'
                    }`}
                  >
                    <Ikon boyut={24} />
                    <span className="baslik text-[11px]">{ad}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* ---- Alt gezinme ---- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-kenar bg-derin/95 backdrop-blur"
        style={{ height: 'var(--alt-bar)' }}
      >
        <ul className="mx-auto flex h-full max-w-lg items-stretch px-1">
          {ALT_SEKMELER.map(({ key, ad, Ikon }) => {
            const etkin = sekme === key;
            return (
              <li key={key} className="flex-1">
                <button
                  onClick={() => {
                    setSekme(key);
                    setMenuAcik(false);
                  }}
                  className={`bas flex h-full w-full flex-col items-center justify-center gap-1 ${
                    etkin ? 'text-altin' : 'text-sonuk'
                  }`}
                  aria-current={etkin ? 'page' : undefined}
                >
                  <span className="relative">
                    <Ikon boyut={22} />
                    {/* Omurganın işaret ettiği sekmede altın nokta.
                        Referanstaki kırmızı noktaların işlevi bu: oyuncu
                        nereye gideceğini okumadan görüyor. */}
                    {isaretli === key && !etkin && (
                      <span
                        className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full border border-gece bg-altin"
                        aria-hidden
                      />
                    )}
                  </span>
                  <span className="baslik text-[11px]">{ad}</span>
                </button>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setMenuAcik((a) => !a)}
              className={`bas flex h-full w-full flex-col items-center justify-center gap-1 ${
                menuAcik || menudeMi ? 'text-altin' : 'text-sonuk'
              }`}
            >
              <span className="relative">
                <IkonNavMenu boyut={22} />
                {isaretli !== null &&
                  isaretli !== undefined &&
                  MENU_SEKMELERI.some((m) => m.key === isaretli) &&
                  !menudeMi && (
                    <span
                      className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full border border-gece bg-altin"
                      aria-hidden
                    />
                  )}
              </span>
              <span className="baslik text-[11px]">Menü</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
