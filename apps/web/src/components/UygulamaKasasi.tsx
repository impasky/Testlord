/**
 * Uygulama kasası — alt çubuğu yukarı çekince açılan, bütün sayfaların
 * ızgarası.
 *
 * Oyuncunun isteği: "Footer'ı oyuncular yukarı çektiği zaman tüm sayfalara
 * erişebileceği genel bir merkezi alan olsun, her biri isim + görsel
 * butonu olsun — Samsung uygulama kasası gibi."
 *
 * Neden var: beş sekme ve binalardan açılan kapılar günlük akış için
 * doğru (oyuncu bulunduğu yerden kopmuyor), ama "Sıralama nerede?"
 * sorusunun cevabı bir binanın içinde saklı kalıyordu. Kasa ikisini de
 * bozmuyor: hiçbir giriş yerinden kalkmadı, kasa hepsini TEK YERDE
 * topluyor.
 *
 * Açmanın iki yolu var ve ikisi de şart: çubuğu yukarı sürüklemek
 * (oyuncunun tarif ettiği hareket) ve çubuğun tepesindeki tutamağa
 * dokunmak. Yalnız sürükleme olsaydı ekran okuyucu ve tek parmakla
 * sürükleyemeyen oyuncu kasaya hiç ulaşamazdı.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KAPI_ADI, type AltSekme, type Kapi } from '@lordlar/shared';
import { IkonGoz, IkonKapali, IkonKilit, IkonSohbet, IkonUyari } from './Ikonlar';

export type KasaHedefi = { tur: 'sekme'; key: AltSekme } | { tur: 'kapi'; key: Kapi };

interface Karo {
  hedef: KasaHedefi;
  ad: string;
  /** public/gorseller altında bir görsel ya da çizilmiş bir simge. */
  gorsel: string | ReactNode;
  /** Manzara görseli: kareyi doldursun (bina çizimleri sığdırılıyor). */
  kapla?: boolean;
  /** Yalnız yöneticiye görünen kapılar. */
  yonetici?: boolean;
}

const KAROLAR: Karo[] = [
  { hedef: { tur: 'sekme', key: 'sehir' }, ad: 'Şehir', gorsel: 'bolgeler/sehir_5', kapla: true },
  { hedef: { tur: 'sekme', key: 'kisla' }, ad: 'Ordu', gorsel: 'binalar/kisla_3' },
  { hedef: { tur: 'sekme', key: 'akin' }, ad: 'Akın', gorsel: 'birimler/suvari' },
  { hedef: { tur: 'sekme', key: 'harita' }, ad: 'Dünya', gorsel: 'harita/dunya-01', kapla: true },
  { hedef: { tur: 'sekme', key: 'lord' }, ad: 'Lord', gorsel: 'portre/lord_3' },
  { hedef: { tur: 'kapi', key: 'malikane' }, ad: KAPI_ADI.malikane, gorsel: 'binalar/malikane_3' },
  {
    hedef: { tur: 'kapi', key: 'gorevler' },
    ad: KAPI_ADI.gorevler,
    gorsel: 'binalar/gorev_panosu',
  },
  {
    hedef: { tur: 'kapi', key: 'generaller' },
    ad: KAPI_ADI.generaller,
    gorsel: 'binalar/karargah_3',
  },
  {
    hedef: { tur: 'kapi', key: 'demirhane' },
    ad: KAPI_ADI.demirhane,
    gorsel: 'binalar/demirhane_3',
  },
  {
    hedef: { tur: 'kapi', key: 'arastirma' },
    ad: KAPI_ADI.arastirma,
    gorsel: 'binalar/kutuphane_3',
  },
  { hedef: { tur: 'kapi', key: 'pazar' }, ad: KAPI_ADI.pazar, gorsel: 'binalar/pazar_3' },
  { hedef: { tur: 'kapi', key: 'ittifak' }, ad: KAPI_ADI.ittifak, gorsel: 'binalar/elcilik_3' },
  {
    hedef: { tur: 'kapi', key: 'sohbet' },
    ad: KAPI_ADI.sohbet,
    gorsel: <IkonSohbet boyut={30} />,
  },
  {
    hedef: { tur: 'kapi', key: 'siralama' },
    ad: KAPI_ADI.siralama,
    gorsel: 'binalar/onur_meydani',
  },
  {
    hedef: { tur: 'kapi', key: 'medeniyet' },
    ad: KAPI_ADI.medeniyet,
    gorsel: 'bolgeler/taht',
    kapla: true,
  },
  {
    hedef: { tur: 'kapi', key: 'olaylar' },
    ad: KAPI_ADI.olaylar,
    gorsel: 'binalar/haberci_kulesi',
  },
  { hedef: { tur: 'kapi', key: 'hesap' }, ad: KAPI_ADI.hesap, gorsel: <IkonKilit boyut={26} /> },
  {
    hedef: { tur: 'kapi', key: 'moderasyon' },
    ad: KAPI_ADI.moderasyon,
    gorsel: <IkonUyari boyut={26} />,
    yonetici: true,
  },
  {
    hedef: { tur: 'kapi', key: 'yoneticiPaneli' },
    ad: KAPI_ADI.yoneticiPaneli,
    gorsel: <IkonGoz boyut={26} />,
    yonetici: true,
  },
];

/** Aşağı sürükleyince kapanma eşiği (piksel). */
const KAPAT_ESIGI = 80;

export function UygulamaKasasi({
  acik,
  sekme,
  yonetici,
  onKapat,
  onGit,
}: {
  acik: boolean;
  sekme: AltSekme;
  yonetici: boolean;
  onKapat: () => void;
  onGit: (h: KasaHedefi) => void;
}) {
  // Aşağı sürükleme: kasa parmağı izliyor, eşiği geçince kapanıyor.
  // Pencereden dinleniyor (bkz. MobilKabuk): işaretçi yakalamak, başlıktaki
  // Kapat düğmesine basılmasını yutardı.
  const [surukle, setSurukle] = useState(0);
  const surukleyeBasla = (y0: number) => {
    let son = 0;
    const hareket = (m: PointerEvent) => {
      son = Math.max(0, m.clientY - y0);
      setSurukle(son);
    };
    const bitir = () => {
      window.removeEventListener('pointermove', hareket);
      window.removeEventListener('pointerup', bitir);
      window.removeEventListener('pointercancel', bitir);
      if (son > KAPAT_ESIGI) kapat.current();
      else setSurukle(0);
    };
    window.addEventListener('pointermove', hareket);
    window.addEventListener('pointerup', bitir);
    window.addEventListener('pointercancel', bitir);
  };

  // Kabuk her yeniden çizildiğinde yeni bir `onKapat` geliyor; efekt ona
  // bağlı olsaydı sürükleme ortasında sıfırlanırdı.
  const kapat = useRef(onKapat);
  kapat.current = onKapat;
  useEffect(() => {
    if (!acik) return;
    setSurukle(0);
    const tus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') kapat.current();
    };
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [acik]);

  if (!acik) return null;
  const karolar = KAROLAR.filter((k) => !k.yonetici || yonetici);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[54] bg-black/60"
        onClick={onKapat}
        aria-label="Tüm sayfaları kapat"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tüm sayfalar"
        data-uygulama-kasasi
        className="kasa-acilis fixed inset-x-0 bottom-0 z-[54] mx-auto flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-3xl border-t-2 border-kenar-acik bg-derin/97 backdrop-blur"
        style={{ transform: surukle > 0 ? `translateY(${surukle}px)` : undefined }}
      >
        <div
          className="cursor-grab touch-none px-4 pt-2 pb-1"
          onPointerDown={(e) => surukleyeBasla(e.clientY)}
        >
          <span className="mx-auto block h-1 w-10 rounded-full bg-kenar-acik" aria-hidden />
          <div className="mt-2 flex items-center">
            <h2 className="baslik flex-1 text-[15px] text-altin">Tüm sayfalar</h2>
            <button
              type="button"
              onClick={onKapat}
              aria-label="Kapat"
              className="bas -mr-1 flex h-10 w-10 items-center justify-center rounded-xl text-solgun"
            >
              <IkonKapali boyut={20} />
            </button>
          </div>
        </div>
        <ul className="grid grid-cols-4 gap-x-2 gap-y-3 overflow-y-auto px-3 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {karolar.map((k) => {
            const etkin = k.hedef.tur === 'sekme' && k.hedef.key === sekme;
            return (
              <li key={`${k.hedef.tur}-${k.hedef.key}`}>
                <button
                  type="button"
                  onClick={() => onGit(k.hedef)}
                  aria-current={etkin ? 'page' : undefined}
                  data-kasa={k.hedef.key}
                  className="bas flex w-full flex-col items-center gap-1.5"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_50%_35%,#3a2b1b,#1a120c)] text-altin ${
                      etkin ? 'border-altin' : 'border-kenar'
                    }`}
                  >
                    {typeof k.gorsel === 'string' ? (
                      <img
                        src={`/gorseller/${k.gorsel}.webp`}
                        alt=""
                        width={56}
                        height={56}
                        loading="lazy"
                        decoding="async"
                        className={`h-full w-full ${k.kapla ? 'object-cover' : 'object-contain p-0.5'}`}
                      />
                    ) : (
                      k.gorsel
                    )}
                  </span>
                  <span
                    className={`line-clamp-2 text-center text-[11px] leading-tight ${
                      etkin ? 'text-altin' : 'text-parsomen'
                    }`}
                  >
                    {k.ad}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
