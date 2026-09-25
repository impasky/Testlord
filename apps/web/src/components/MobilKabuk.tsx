/**
 * Mobil kabuk: sabit üst durum çubuğu + kaydırılan içerik + sabit alt gezinme.
 *
 * Masaüstü düzeni yok. Tüm ekranlar tek sütun, dokunmatik hedefleri ≥44px,
 * içerik sabit çubukların altında kalmayacak şekilde dolgulu.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type LordState } from '../api/client';
import { okunduOku } from '../lib/sohbetOkundu';
import { ProfilGorseli } from './ProfilGorseli';
import { UygulamaKasasi, type KasaHedefi } from './UygulamaKasasi';
import {
  IkonAltin,
  IkonDemir,
  IkonElmas,
  IkonErzak,
  IkonNavAkin,
  IkonNavHarita,
  IkonNavKisla,
  IkonNavLord,
  IkonNavMalikane,
  IkonKasa,
  IkonSohbet,
  IkonSohret,
} from './Ikonlar';
import {
  ANA_SEKME,
  ERZAK_FIRAR_ORANI,
  erzakTukenmesiSaat,
  type AltSekme,
  type Kapi,
} from '@lordlar/shared';
import { Ilerleme, kisaSayi } from './ui';

/**
 * Sekme adları packages/shared'daki EKRANLAR'dan geliyor — sunucunun
 * ölçüm doğrulaması da aynı listeyi kullanıyor. Ayrı tutmak, yeni bir
 * ekran eklendiğinde /me'nin o ekranda 400 dönmesi demekti.
 */
/**
 * Gezinilebilen sekme = alt çubuktaki BEŞ yer.
 *
 * Eskiden `Ekran` idi, yani on bir sayfanın hepsi. Artık gezinme yalnız
 * beş sekme; gerisi kapı (`Kapi`) ve panel olarak açılıyor. Tipin
 * daraltılması refaktörün kendisini denetledi: kapıya "git" demeye çalışan
 * her yer derlemede ortaya çıktı.
 */
export type Sekme = AltSekme;

/**
 * Alt çubuk: BEŞ sekme, menü yok.
 *
 * Oyuncu referans bir oyunu göstererek anlattı:
 *
 *   "ana sayfada nav bar ile gidebileceğimiz yerler sadece 5 tane, bunlar
 *    gün içinde en çok giriş yapılanlar. Onun dışında her şeyi 5 ana
 *    sayfanın içinde pop-up pencereleri şeklinde ayarlamış."
 *
 * Önceki hâl DÖRT sekme + "Menü" idi ve menü tam da şikâyet edilen şeydi:
 * konusuyla ilgisi olmayan yedi sayfanın düz listesi. Oyuncunun ilk geri
 * dönüşü zaten "kafamda kategorize edemiyorum" idi ve menü o duygunun
 * kaynağıydı — Demirhane ile Hesap yan yana duruyordu.
 *
 * Şimdi gezinilecek yer yalnız bu beşi; gerisi konusunun içinde kapı
 * olarak açılıyor (`KAPI_EVI`, `KapiPaneli.tsx`). Lord menüden çubuğa
 * çıktı çünkü oyuncunun kendini yönettiği yer orası ve artık kendine ait
 * olanın (general, ekipman, sıralama, hesap) evi.
 *
 * Altı yuvanın 390px'te eşitsiz göründüğünü ölçmüştüm (54-81px); beş yuva
 * o sorunu da çözüyor.
 */
const CUBUK: { key: AltSekme; ad: string; Ikon: typeof IkonNavMalikane }[] = [
  { key: 'sehir', ad: 'Şehir', Ikon: IkonNavMalikane },
  { key: 'kisla', ad: 'Ordu', Ikon: IkonNavKisla },
  { key: 'akin', ad: 'Akın', Ikon: IkonNavAkin },
  { key: 'harita', ad: 'Dünya', Ikon: IkonNavHarita },
  { key: 'lord', ad: 'Lord', Ikon: IkonNavLord },
];

/** Sayma animasyonunun süresi. Ödülün "geldiğini" görmeye yetecek kadar, beklemeyecek kadar kısa. */
const SAYMA_MS = 700;

function hareketAzaltilmis(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Sayıyı SIÇRAMALARDA sayarak gösterir.
 *
 * Ödül alındığında kaynak sayısı bir karede 3.080 artıyordu; göz onu
 * kaçırıyor, oyuncu ödülün geldiğini ancak rakamı hatırlıyorsa fark
 * ediyordu. Artık sıçrama 0,7 saniyede sayılıyor ve artarken yeşil.
 * Eşiğin altındaki değişim (saniyelik gelir) doğrudan yazılıyor — her
 * saniye sayan bir çubuk gürültü olurdu. Hareket azaltılmışsa hiç
 * saymıyor.
 */
function useSayan(hedef: number, esik: number): { deger: number; yon: -1 | 0 | 1 } {
  const [gosterilen, setGosterilen] = useState(hedef);
  const [yon, setYon] = useState<-1 | 0 | 1>(0);
  const simdiki = useRef(hedef);
  useEffect(() => {
    const bas = simdiki.current;
    const fark = hedef - bas;
    if (Math.abs(fark) < esik || hareketAzaltilmis()) {
      simdiki.current = hedef;
      setGosterilen(hedef);
      setYon(0);
      return;
    }
    setYon(fark > 0 ? 1 : -1);
    const t0 = performance.now();
    let id = 0;
    const adim = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / SAYMA_MS));
      const v = bas + fark * (1 - Math.pow(1 - k, 3));
      simdiki.current = v;
      setGosterilen(v);
      if (k < 1) id = requestAnimationFrame(adim);
      else setYon(0);
    };
    id = requestAnimationFrame(adim);
    return () => cancelAnimationFrame(id);
  }, [hedef, esik]);
  return { deger: gosterilen, yon };
}

/** Kaynak sayacı: sunucu değerinden itibaren saniye saniye ilerler. */
/**
 * Doluluk çubuğunun görünmeye başladığı oran.
 *
 * %75: taşmaya bu noktadan sonra bir şey yapılabilir (harcamak, araştırma
 * açmak). Daha erken göstermek çubuğu yine süse çevirirdi.
 */
const ESIK = 0.75;

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
  /*
   * Saat STATE'te, render'da okunmuyor.
   *
   * Önce `canli` her render'da `Date.now()` ile hesaplanıyordu: her render
   * yeni bir değer, `useSayan`'ın efekti yeni değeri state'e yazıyor, o da
   * yeni bir render — render bir milisaniyeden uzun sürdükçe (yavaş
   * telefon, görselli Akın ekranı) döngü dönüp duruyordu. Tüm düğmeleri
   * deneyen bot "Maximum update depth exceeded" olarak yakaladı. Artık
   * değer yalnız saniyelik tıkta ya da sunucu değeri gelince değişiyor.
   */
  const [simdi, setSimdi] = useState(() => Date.now());
  /*
   * Canlı sayacın TABANI: sunucu değerinin ve ALINDIĞI anın ikilisi.
   *
   * Önce taban yalnız bileşenin ilk açıldığı andı. Oysa `/me` 30 saniyede
   * bir yenileniyor ve sunucu değeri o ana kadarki geliri zaten içeriyor:
   * sayaç o geliri İKİNCİ kez ekliyordu. Hata oturum boyunca büyüyordu —
   * ölçüldü, saatte 610 altın gelirli lordda 95 saniyede +16, bir saatte
   * +610. Oyuncu kesesinde olmayan altını görüp "yetmiyor" uyarısına
   * şaşırırdı. Yeni değer gelince taban da yeni değer oluyor (render
   * sırasında: efektle yapsak bir kare boyunca eski taban görünürdü).
   */
  const [taban, setTaban] = useState(() => ({ deger, zaman: Date.now() }));
  if (taban.deger !== deger) setTaban({ deger, zaman: Date.now() });
  useEffect(() => {
    const id = setInterval(() => setSimdi(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Taban tıktan SONRA kurulmuş olabilir (sunucu değeri yeni geldi): o
  // zaman geçen süre sıfır, eksi değil.
  const gecen = Math.max(0, simdi - taban.zaman) / 3_600_000;
  const canli = Math.min(tavan, Math.max(0, deger + saatlik * gecen));
  // Sıçramalar (ödül, harcama, ganimet) sayılarak gösteriliyor; saniyelik
  // akış olduğu gibi. Eşik: bir dakikalık gelirden büyük değişim.
  const sayan = useSayan(canli, Math.max(20, Math.abs(saatlik) / 60));
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
  /**
   * ÇUBUK HER ZAMAN ÇİZİLMİYOR.
   *
   * Üç kaynağın üç dolu çubuğu, ekranın tepesinde her ekranda duruyordu ve
   * çoğu zaman hiçbir şey söylemiyordu: oyuncu "%93 dolu" ile "%70 dolu"
   * arasında farklı bir şey yapamıyor. Daha kötüsü, sürekli çizilen bir
   * çubuk UYARI hâlini de sıradanlaştırıyor — kritik durumda kızaran
   * çubuk, yanındaki iki dolu çubuğun içinde kayboluyordu.
   *
   * Çubuk artık yalnız DOLULUK BİR KARARA DÖNÜŞÜNCE çiziliyor: taşmaya
   * yaklaşan depo ya da eksiye giden erzak. O zaman da tek başına
   * duruyor, yani gerçekten görülüyor.
   */
  const oran = tavan > 0 ? canli / tavan : 0;
  const cubukGerek = durum !== null || oran >= ESIK;
  /*
   * "Azalıyor" bir GÖZLEMDİ, uyarı değil. Oyuncu ne zaman biteceğini ve
   * bitince ne olacağını bilmeden karar veremez. Sayı motordan geliyor
   * (`erzakTukenmesiSaat`), burada yeniden hesaplanmıyor.
   */
  const kalanSaat = erzakTukenmesiSaat(canli, saatlik);
  const bitisYazisi =
    kalanSaat === null
      ? null
      : kalanSaat < 1
        ? `${Math.max(1, Math.round(kalanSaat * 60))} dk sonra biter`
        : `${Math.round(kalanSaat)} sa sonra biter`;

  /*
   * İPUCU TEK CÜMLE olarak kuruluyor, kuyruk eklenerek değil.
   *
   * Önceki hâlde baş kısma " — depo dolu, üretim boşa gidiyor" gibi
   * bir kuyruk yapışıyordu; o kuyruk tek başına çevrilemeyen bir
   * parçaydı (küçük harfle başlayıp beş sözcüğü geçiyor) ve
   * İngilizce arayüzde Türkçe kalıyordu. Her durum artık kendi tam
   * cümlesi; yer tutucular baştaki sayıları taşıyor.
   */
  const bas = `${ad}: ${Math.floor(canli)} (${saatlik >= 0 ? '+' : ''}${Math.round(saatlik)}/sa)`;
  const ipucu =
    durum === 'kritik'
      ? bitisYazisi
        ? `${bas} — ${bitisYazisi}, sonra ordu saatte %${Math.round(ERZAK_FIRAR_ORANI * 100)} firar verir`
        : `${bas} — eksiye gidiyor`
      : durum === 'israf'
        ? `${bas} — depo dolu, üretim boşa gidiyor`
        : bas;

  return (
    <div
      className={`-mx-0.5 min-w-0 flex-1 rounded-lg px-1 py-0.5 ${
        durum === 'kritik'
          ? 'bg-kirmizi/15 ring-1 ring-kirmizi/40'
          : durum === 'israf'
            ? 'bg-turuncu/12 ring-1 ring-turuncu/30'
            : ''
      }`}
      title={ipucu}
    >
      <div className="flex items-center gap-1">
        <span className="shrink-0" style={{ color: renk }}>
          {ikon}
        </span>
        <span
          className={`tabular truncate text-[13px] font-bold transition-colors duration-300 ${
            sayan.yon > 0 ? 'text-yesil' : ''
          }`}
        >
          {kisaSayi(sayan.deger)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1">
        {cubukGerek && (
          <div className="min-w-0 flex-1">
            <Ilerleme deger={canli} max={tavan} renk={renk} boy="ince" />
          </div>
        )}
        <span
          className={`tabular shrink-0 text-[11px] ${
            cubukGerek ? '' : 'flex-1'
          } ${saatlik < 0 ? 'text-kirmizi' : 'text-sonuk'}`}
        >
          {saatlik >= 0 ? '+' : ''}
          {Math.round(saatlik)}
        </span>
      </div>
      {durum === 'israf' && <div className="mt-0.5 text-[11px] text-turuncu">depo dolu</div>}
      {durum === 'kritik' && (
        <div className="text-[11px] text-kirmizi mt-0.5 leading-tight">
          {bitisYazisi ?? 'azalıyor'}
        </div>
      )}
    </div>
  );
}

/** Çubuğu bu kadar piksel yukarı çekmek kasayı açıyor. */
const KASA_ESIGI = 36;

/**
 * Genel sohbette okunmamış mesaj var mı.
 *
 * Yalnız son mesajın ANI soruluyor (tek tarih, liste değil) ve sohbet
 * açıkken hiç sorulmuyor — açık sohbet zaten okunmuş sohbettir.
 */
function useGenelOkunmamis(sohbetAcik: boolean): boolean {
  const q = useQuery({
    queryKey: ['genel-sohbet-son'],
    queryFn: api.genelSohbetSon,
    refetchInterval: 30_000,
    enabled: !sohbetAcik,
  });
  if (sohbetAcik || !q.data?.son) return false;
  const okundu = okunduOku();
  return !okundu || new Date(q.data.son).getTime() > new Date(okundu).getTime();
}

export function MobilKabuk({
  lord,
  sekme,
  setSekme,
  kapi,
  onKapiAc,
  onCikis,
  isaretli,
  omurga,
  children,
}: {
  lord: LordState;
  sekme: AltSekme;
  setSekme: (s: AltSekme) => void;
  /** Açık kapı — genel sohbet açıkken okunmamış noktası sönük kalsın diye. */
  kapi: Kapi | null;
  /** Kapı aç: üst çubuktaki sohbet düğmesi ve uygulama kasası. */
  onKapiAc: (k: Kapi) => void;
  onCikis: () => void;
  /** Omurganın işaret ettiği sekme; altın nokta oraya konur. */
  isaretli?: AltSekme | null;
  /**
   * Alt gezinmenin ÜSTÜNDE duran omurga şeridi.
   *
   * Kabuk şeridi kendi kurmuyor, yalnız yerini veriyor: şeridin ihtiyacı
   * olan altı işleyici (`onGit`, `onKapiAc`, ...) App'te duruyor ve
   * hepsini kabuktan geçirmek, kabuğu App'in ikizine çevirirdi.
   */
  omurga?: ReactNode;
  children: ReactNode;
}) {
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

  const okunmamis = useGenelOkunmamis(kapi === 'sohbet');
  const yonetici =
    useQuery({ queryKey: ['moderasyon-durum'], queryFn: api.moderasyonDurumu, staleTime: 60_000 })
      .data?.yonetici === true;

  /*
   * UYGULAMA KASASI: alt çubuk yukarı çekilince açılıyor (oyuncunun
   * istediği hareket) ya da tutamağa dokununca (sürükleyemeyen için).
   * Sürükleme bir sekme düğmesinin üstünde başlarsa o düğmeye basılmış
   * sayılmamalı — `cekildi` ilk tıklamayı yutuyor.
   */
  const [kasa, setKasa] = useState(false);
  const cekildi = useRef(false);
  /*
   * Hareket PENCEREDEN dinleniyor, çubuktan değil: parmak (ya da fare)
   * yukarı çekilince çubuğun dışına çıkıyor ve olaylar artık çubuğa
   * gelmiyor. Çubuğa işaretçi yakalamak (pointer capture) da olmazdı —
   * bırakma çubuğa düşer, sekme düğmesine basılmamış sayılırdı.
   */
  const cekmeyeBasla = (y0: number) => {
    cekildi.current = false;
    const hareket = (m: PointerEvent) => {
      if (!cekildi.current && y0 - m.clientY > KASA_ESIGI) {
        cekildi.current = true;
        setKasa(true);
      }
    };
    const bitir = () => {
      window.removeEventListener('pointermove', hareket);
      window.removeEventListener('pointerup', bitir);
      window.removeEventListener('pointercancel', bitir);
    };
    window.addEventListener('pointermove', hareket);
    window.addEventListener('pointerup', bitir);
    window.addEventListener('pointercancel', bitir);
  };
  const kasadanGit = (h: KasaHedefi) => {
    setKasa(false);
    if (h.tur === 'sekme') setSekme(h.key);
    else onKapiAc(h.key);
  };

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
              <ProfilGorseli resim={lord.resim} arma={lord.arma} boyut={24} />
              <span className="baslik truncate text-[13px]">{lord.name}</span>
              <span className="baslik shrink-0 rounded-md bg-altin/20 px-1.5 py-0.5 text-[11px] text-altin">{`Sv ${lord.level}`}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-[11px] text-solgun">
              <span className="text-altin">
                <IkonSohret boyut={13} />
              </span>
              <span className="tabular">{kisaSayi(lord.fame)}</span>
            </div>
            {/* Elmas: oyuncunun isteği ("üst headere elmas da ekle"). Hastanede
                taburcu için harcanıyor; kesede ne olduğu harcanacağı ekrana
                gitmeden görünmeli. */}
            <div
              className="flex shrink-0 items-center gap-1 text-[11px] text-solgun"
              title="Elmas"
              data-ust-elmas
            >
              <span style={{ color: 'var(--color-elmas)' }}>
                <IkonElmas boyut={13} />
              </span>
              <span className="tabular">{kisaSayi(lord.elmas ?? 0)}</span>
            </div>
            {/* Genel sohbet HER EKRANDAN: üst çubuk her sekmede duruyor
                (oyuncunun isteği "her sayfadan erişilebilsin"). */}
            <button
              type="button"
              onClick={() => onKapiAc('sohbet')}
              aria-label={okunmamis ? 'Genel sohbet — yeni mesaj var' : 'Genel sohbet'}
              data-ust-sohbet
              // 44px dokunma hedefi; negatif dikey boşluk başlık satırını
              // büyütmüyor.
              className="bas relative -my-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-kenar text-solgun"
            >
              <IkonSohbet boyut={18} />
              {okunmamis && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-gece bg-altin"
                  aria-hidden
                />
              )}
            </button>
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
        style={{
          paddingTop: 'var(--ust-bar)',
          // Şerit varsa içerik onun da altında kalmamalı.
          paddingBottom: 'calc(var(--alt-bar) + var(--omurga-serit) + 16px)',
        }}
      >
        {/*
         * GÖRÜNMEZ SAYFA BAŞLIĞI.
         *
         * Tasarımda bilerek görünür bir sayfa başlığı yok: telefon ekranı
         * dar ve her ekranın tepesinde bir satır harcamak, asıl içeriği
         * aşağı itiyor. Ama ekran okuyucu kullanıcısı için sayfanın adı
         * gezinmenin OMURGASI — "hangi ekrandayım" sorusunun cevabı.
         *
         * `sr-only` ikisini birden veriyor: gözle hiçbir şey değişmiyor,
         * ekran okuyucu her sekmede nerede olduğunu söylüyor.
         */}
        <h1 className="sr-only">{CUBUK.find((c) => c.key === sekme)?.ad ?? 'Lordlar Çağı'}</h1>
        {children}
      </main>

      {omurga}

      {/* ---- Alt gezinme ---- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-kenar bg-derin/95 backdrop-blur"
        // touch-none: çubuk yukarı çekilirken tarayıcı sayfayı kaydırmasın.
        style={{ height: 'var(--alt-bar)', touchAction: 'none' }}
        onPointerDown={(e) => cekmeyeBasla(e.clientY)}
        onClickCapture={(e) => {
          if (cekildi.current) {
            e.stopPropagation();
            e.preventDefault();
            cekildi.current = false;
          }
        }}
      >
        {/* Tutamak: çubuğun çekilebildiğini söyleyen görsel ipucu ve
            sürükleyemeyenin kapısı. */}
        <button
          type="button"
          onClick={() => setKasa(true)}
          aria-label="Tüm sayfalar"
          aria-expanded={kasa}
          data-kasa-tutamak
          className="bas absolute top-0 left-1/2 flex h-6 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-kenar bg-derin text-sonuk"
        >
          <IkonKasa boyut={13} />
        </button>
        <ul className="mx-auto flex h-full max-w-lg items-stretch px-1">
          {CUBUK.map(({ key, ad, Ikon }) => {
            const etkin = sekme === key;
            return (
              <li key={key} className="flex-1">
                <button
                  onClick={() => setSekme(key)}
                  className={`bas flex h-full w-full flex-col items-center justify-center gap-1 ${
                    etkin ? 'text-altin' : 'text-sonuk'
                  }`}
                  aria-current={etkin ? 'page' : undefined}
                  /* Rehber ışığının son çare hedefi: ANA SAYFA. Oyuncu ilk
                     döngüde alâkasız bir ekrandaysa ışık onu omurga
                     düğmesinin durduğu tek yere çağırıyor; zincirin hiçbir
                     ekranda kopmamasını bu sağlıyor. */
                  data-rehber={key === ANA_SEKME ? 'nav-ana' : undefined}
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
        </ul>
      </nav>

      <UygulamaKasasi
        acik={kasa}
        sekme={sekme}
        yonetici={yonetici}
        onKapat={() => setKasa(false)}
        onGit={kasadanGit}
      />
    </div>
  );
}
