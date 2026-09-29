/**
 * Şehir — oyunun yeni ana sayfası.
 *
 * Oyuncunun cümlesi: "ana sayfamız şu an lord ya, onu değiştirelim şehir
 * sayfası yap; şehir haritasından oyuncu demirci, lord, malikâne gibi
 * ordan gezebilsin."
 *
 * Eski Lord ekranı bir KAPI IZGARASIYDI: yan yana düğmeler. Oyuncu
 * "demirhaneye gitmiyor", bir düğmeye basıyordu. Burada kapıların hepsi
 * duruyor — sadece girişleri bir listeden bir BİNAYA döndü.
 *
 * ── Boş arsa ────────────────────────────────────────────────────────
 *
 * Dikilmemiş bina listeden çıkmıyor, yerinde bir arsa olarak duruyor.
 * Dokununca ne işe yaradığını ve bedelini söylüyor. Böylece oyuncu
 * oyunun tamamını ilk dakikada GÖRÜYOR ama hepsi birden üstüne
 * gelmiyor — "her şey üstüme geliyor" şikâyetinin panzehiri bu.
 *
 * ── Zemin resim, bilgi DOM ──────────────────────────────────────────
 *
 * Dünya haritasıyla aynı mimari (DunyaHaritasi.tsx): yerleşim zemini tek
 * bir resim, binalar üstüne yüzdelik konumlarıyla konan düğmeler. Zemin
 * yoksa gradyan kalıyor ve sayfa çalışmaya devam ediyor.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { ApiError, api, type BinaDurumu, type LordState, type QueueItem } from '../api/client';
import { useOmurgaAdimi } from '../components/Omurga';
import { Rehber } from '../components/Rehber';
import { useRehberDurumu } from '../rehberDurumu';
import { IKONLAR } from '../components/ikon-verisi';
import {
  Buton,
  GeriSayim,
  Iskelet,
  Maliyet,
  Sure,
  Kart,
  formatKalan,
  formatSayi,
} from '../components/ui';
import { IkonUyari } from '../components/Ikonlar';
import { BinaCizimi, CIZILEN_BINALAR, YerlesimCizimi } from '../cizim/Cizimler';
import {
  BINA_TABAN_BOY,
  KASABA_KUTUSU,
  YERLESIM_KUTUSU,
  type YerlesimBinasi,
} from '../cizim/yerlesim';
import type { Kapi } from '@lordlar/shared';
import type { Sekme } from '../components/MobilKabuk';

/** Binada süren işin adı (sayaç rozeti ve erişilebilir ad). */
const KUYRUK_ADI: Record<string, string> = {
  // `bina` unutulmuştu: inşaat kuyruğu listede ham anahtarıyla ("bina")
  // görünüyordu.
  bina: 'İnşaat',
  train: 'Asker eğitimi',
  craft: 'Ekipman üretimi',
  upgrade_item: 'Ekipman yükseltme',
  upgrade_gear: 'Ordu donanımı',
  upgrade_region: 'Bölge yükseltme',
  kesif: 'Keşif',
};

/**
 * Hangi iş HANGİ BİNADA geçiyor.
 *
 * Sayaçlar ayrı bir listede duruyordu; köyde asker eğitildiğinin hiçbir
 * izi yoktu. Oysa oyunun her işi bir binaya ait: asker kışlada eğitilir,
 * ekipman demirhanede dövülür, yaralı hastanede yatar. Eşleme burada tek
 * yerde duruyor, `bina` işi ise kendi anahtarını payload'ında taşıyor.
 *
 * `upgrade_region` listede YOK ve olmamalı: bölge şehirde değil dünya
 * haritasında yükseliyor, köyde gösterecek bir binası yok.
 */
const KUYRUK_BINASI: Record<string, string> = {
  train: 'kisla',
  iyilestir: 'hastane',
  craft: 'demirhane',
  upgrade_item: 'demirhane',
  upgrade_gear: 'demirhane',
  research: 'kutuphane',
  kesif: 'haberci_kulesi',
};

/** Bina anahtarı → o binada süren işin bitişi. Aynı binada birden çok iş
 *  varsa EN ERKEN bitecek olan gösteriliyor: sayaç bir sonraki olaya
 *  bakmalı, rastgele birine değil. */
function binadakiIsler(queues: QueueItem[]): Map<string, { bitis: string; ad: string }> {
  const harita = new Map<string, { bitis: string; ad: string }>();
  for (const q of queues) {
    const key =
      q.kind === 'bina'
        ? ((q.payload as { key?: string }).key ?? null)
        : (KUYRUK_BINASI[q.kind] ?? null);
    if (!key) continue;
    const mevcut = harita.get(key);
    if (!mevcut || q.finishAt < mevcut.bitis) {
      harita.set(key, { bitis: q.finishAt, ad: KUYRUK_ADI[q.kind] ?? q.kind });
    }
  }
  return harita;
}

/**
 * Bir yapının haritadaki taban genişliği (kabın yüzdesi).
 *
 * Gerçek boy bununla `data/binalar.json` içindeki `olcek` çarpımı. Tek
 * bir sayı olmasının sebebi: hiyerarşi orandan gelmeli, elle yazılmış on
 * üç ayrı boydan değil — biri değişince ötekilerle ilişkisi kayardı.
 * Yerleşke sahnesi binayı aynı kutuya çiziyor (`yerlesim.sahneBinasi`).
 */
const TABAN_BOY = BINA_TABAN_BOY;

/**
 * Yerleşkenin sayfadaki boyu (CSS pikseli): ekran biriminin 8 katı. İnsan
 * ~30 piksel boyunda: okçunun yayı, mızrakçının hamlesi seçiliyor.
 * Telefonda yerleşkenin yarısı kadarı görünüyor, gerisi kaydırılarak.
 */
const PIKSEL = 8;
const [YX, YY, YW, YH] = YERLESIM_KUTUSU;
const [KX, KY, KW, KH] = KASABA_KUTUSU;
const SAHNE_EN = YW * PIKSEL;
const SAHNE_BOY = YH * PIKSEL;
/** Kasabanın (binaların) yerleşkedeki yeri: binaların yüzdeleri buna göre. */
const KASABA_YERI = {
  left: `${((KX - YX) / YW) * 100}%`,
  top: `${((KY - YY) / YH) * 100}%`,
  width: `${(KW / YW) * 100}%`,
  height: `${(KH / YH) * 100}%`,
};
/** Açılışta ortalanan yer (yerleşkenin oranı): malikânenin önü (%51, %53). */
const ORTA: [number, number] = [(KX + KW * 0.51 - YX) / YW, (KY + KH * 0.53 - YY) / YH];

/**
 * Binanın dokunulan alanı, kutusunun yüzdesi olarak: sprite'ın gövdesi.
 * Tabandan çakılı sprite'larda üst %30 çoğunlukla boş; yanlardan da pay.
 * Bu şemayla hiçbir binanın ortası önündekinin alanına düşmüyor (ölçüldü:
 * `data/binalar.json` konumlarıyla on üç binanın hepsi).
 */
const BINA_DOKUNMA = { left: '18%', right: '18%', top: '30%', bottom: '4%' } as const;

/** Bina anahtarı → ikon. Anahtarlar veride, ikonlar burada. */
const BINA_IKONU: Record<string, keyof typeof IKONLAR> = {
  malikane: 'navMalikane',
  kisla: 'navKisla',
  gorev_panosu: 'sure',
  demirhane: 'navDemirhane',
  hastane: 'can',
  pazar: 'altin',
  surlar: 'savunma',
  karargah: 'navGeneraller',
  kutuphane: 'kurnaz',
  haberci_kulesi: 'goz',
  liman: 'hiz',
  elcilik: 'sancak',
  onur_meydani: 'navSiralama',
};

/**
 * Bina çizimleri artık KODDAN (docs/24, `cizim/binalar.ts`): her bina ×
 * aşama çiziliyor, dosya yok, istek yok. Liste çizim modülünden geliyor.
 */
const SPRITE_OLAN = CIZILEN_BINALAR;

/**
 * Binanın görseli: kodla çizim, çizimi olmayan bina için çizgi ikon.
 *
 * İkon yedek olarak duruyor: veriye yeni bir bina eklenip tarifi henüz
 * `cizim/binalar.ts`e yazılmadıysa kutu boş kalmıyor. `gorsel-denetim`
 * çizimi eksik binayı ayrıca bildiriyor.
 *
 * Çizim adı SEVİYEYE bağlı: `_1` ahşap, `_3` taş taban + ahşap üst kat,
 * `_5` tam taş. Üç kademe, çünkü ikisi az kalıyordu: bina tavanı kademeye
 * bağlı (kamp 1, köy 2, kasaba 3, şehir/kale 4, metropol 5) ve iki
 * görselle oyuncu seviye 3'te zaten en gelişmiş hâli görüyordu — geri
 * kalan iki yükseltme görsel olarak hiçbir şey vermiyordu. Üç kademeyle
 * tam taş hâl metropole, yani oyunun sonuna kalıyor.
 *
 * Dikilmemiş bina paylaşılan `arsa` görselini kullanıyor.
 */
function spriteAdi(binaKey: string, seviye: number, seviyeli: boolean): string {
  if (!seviyeli) return binaKey;
  if (seviye <= 0) return 'arsa';
  return `${binaKey}_${seviye >= 5 ? 5 : seviye >= 3 ? 3 : 1}`;
}

function BinaIkonu({
  binaKey,
  boyut,
  seviye = 1,
  seviyeli = true,
}: {
  binaKey: string;
  boyut: number;
  seviye?: number;
  seviyeli?: boolean;
}) {
  const ad = spriteAdi(binaKey, seviye, seviyeli);
  if (SPRITE_OLAN.has(ad)) return <BinaCizimi ad={ad} boyut={boyut} />;
  const v = IKONLAR[BINA_IKONU[binaKey] ?? 'navMalikane'];
  return (
    <svg
      viewBox={`0 0 ${v.w} ${v.h}`}
      width={boyut}
      height={boyut}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: v.body }}
    />
  );
}

export function Sehir({
  lord,
  queues,
  onGit,
  onKapiAc,
  onBolumeGit,
}: {
  lord: LordState;
  queues: QueueItem[];
  onGit: (s: Sekme) => void;
  onKapiAc: (k: Kapi) => void;
  /** Aynı ekrandaki bir bölüme kaydırır. */
  onBolumeGit: (bolumId: string) => void;
}) {
  const qc = useQueryClient();
  // Kâhya ve omurga ANA SAYFANIN tepesinde. "Şimdi ne yapmalısın"
  // sorusunun cevabı oyuncunun indiği yerde durmalı; ana sayfa
  // değiştiği için bu ikisi de buraya taşındı (docs/12 §3).
  const rehberAdimi = useOmurgaAdimi(lord, queues);
  const rehberDurumu = useRehberDurumu(lord);
  const veri = useQuery({ queryKey: ['sehir'], queryFn: api.sehir });
  const [secili, setSecili] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  /** Yapı listesi açık mı (seviye yükseltme oradan; dokunuş yapının içine giriyor). */
  const [liste, setListe] = useState(false);
  const kartRef = useRef<HTMLDivElement>(null);
  /*
   * Yerleşke ekrandan büyük: açılışta malikânenin önü ortada. Bir kez,
   * veri geldiğinde; oyuncu kaydırdıktan sonra yerinden oynatılmıyor.
   */
  const kaydirici = useRef<HTMLDivElement>(null);
  const ortalandi = useRef(false);
  const hazir = Boolean(veri.data);
  useLayoutEffect(() => {
    const k = kaydirici.current;
    if (!hazir || !k || ortalandi.current) return;
    ortalandi.current = true;
    const [x, y] = ORTA;
    k.scrollLeft = x * SAHNE_EN - k.clientWidth / 2;
    k.scrollTop = y * SAHNE_BOY - k.clientHeight * 0.55;
  }, [hazir]);

  const yap = useMutation({
    mutationFn: (key: string) => api.binaYap(key),
    onSuccess: () => {
      setHata(null);
      setSecili(null);
      void qc.invalidateQueries({ queryKey: ['sehir'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'İnşaat başlatılamadı.'),
  });
  const iptal = useMutation({
    mutationFn: (id: string) => api.binaIptal(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sehir'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const tasi = useMutation({
    mutationFn: (bolgeId: number) => api.baskentTasi(bolgeId),
    onSuccess: () => {
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['sehir'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => setHata(e instanceof ApiError ? e.message : 'Başkent taşınamadı.'),
  });

  if (veri.isPending || !veri.data) return <Iskelet satir={5} />;
  const { yerlesim, binalar, insaat, tasinabilir } = veri.data;
  const isler = binadakiIsler(queues);
  const seciliBina = binalar.find((b) => b.key === secili) ?? null;
  // Çizimi olan yapılar yerleşkenin İÇİNDE çiziliyor (aynı zemin, gölge,
  // ışık); işaretler yalnız dokunma alanı, rozet ve seçim halkası.
  const sahnedekiler: YerlesimBinasi[] = binalar.flatMap((b) => {
    const ad = spriteAdi(b.key, b.seviye, b.seviyeli);
    return SPRITE_OLAN.has(ad) ? [{ ad, x: b.x, y: b.y, olcek: b.olcek }] : [];
  });

  /**
   * Binanın açtığı yere götür. Kapı sekme değiştirmiyor, panel açıyor.
   *
   * Bölüm ikisinin arasında: hastanenin kapısı yok, Kışla sekmesinin
   * İÇİNDE bir bölüm. `onBolumeGit` hem sekmeyi değiştiriyor hem oraya
   * kaydırıyor; yalnız `onGit(b.sekme)` çağırsaydık oyuncu Kışla'nın
   * tepesine düşer ve hastaneyi kendi arardı.
   */
  function binayaGit(b: BinaDurumu) {
    if (b.kapi) onKapiAc(b.kapi as Kapi);
    else if (b.bolum) onBolumeGit(b.bolum);
    else if (b.sekme) onGit(b.sekme as Sekme);
  }

  /**
   * Haritadaki yapıya dokunmak: DİKİLİYSE doğrudan içine girer.
   *
   * Oyuncu: "kışlayı seçiyorum, sonra alttan bir daha kışlaya git
   * diyorum." Haklıydı — harita bir menüydü, menünün de kendi menüsü
   * vardı. Binanın üstündeki dokunuş artık binanın kendisi.
   *
   * Boş arsa ve girilecek yeri olmayan yapı (surlar) hâlâ KART açıyor:
   * gidilecek bir yer yok, gösterilecek bedel ve etki var. Seviye
   * yükseltme de kartta duruyor, ona aşağıdaki listeden geliniyor —
   * tek dokunuşun bedeli bu ve bilerek ödendi: oyuncu binaya günde
   * onlarca kez giriyor, seviye yükseltmeye ayda birkaç kez.
   */
  function haritadaSec(b: BinaDurumu) {
    if (b.seviye > 0 && (b.kapi || b.sekme)) {
      binayaGit(b);
      return;
    }
    setSecili((s) => (s === b.key ? null : b.key));
  }

  return (
    /*
     * TAM EKRAN YERLEŞKE. Oyuncu: "şehir sayfasında sadece şehir olsun,
     * alttaki yazılar olmasın; kendi köyümüz olduğunu hissedelim." Harita
     * gibi üst çubukla omurga şeridi arasındaki bütün alan; yerleşke ondan
     * büyük ve parmakla kaydırılıyor (tarayıcının kendi kaydırması: akıcı,
     * JS yok). Kâhya, süren inşaat ve seçili yapının kartı yerleşkenin
     * ÜSTÜNDE yüzüyor; altında sayfa yok.
     */
    <div
      className="fixed inset-x-0 z-10 mx-auto max-w-lg overflow-hidden bg-[#2f3b22]"
      style={{ top: 'var(--ust-bar)', bottom: 'calc(var(--alt-bar) + var(--omurga-serit))' }}
      data-sehir-sayfasi=""
    >
      {/* Ekranda yazı yok; ekran okuyucu yerleşkenin adını ve özetini duyuyor. */}
      <h2 className="sr-only">{yerlesim.ad}</h2>
      <p id="yerlesim-ozeti" className="sr-only">
        {yerlesim.ozet}
      </p>
      <div
        ref={kaydirici}
        className="gizli-kaydirma h-full w-full overflow-auto overscroll-contain"
      >
        <div
          /* isolate: yapıların derinlik sırası (`zIndex = y`) YALNIZ
             yerleşkenin içinde geçerli olmalı; yoksa 96'ya çıkan bir bina
             yüzen kartların üstüne geçip dokunuşu yiyordu. */
          className="relative isolate"
          style={{ width: SAHNE_EN, height: SAHNE_BOY }}
          role="img"
          aria-label={`${yerlesim.ad} — ${binalar.length} yapı`}
          aria-describedby="yerlesim-ozeti"
        >
          <YerlesimCizimi
            kademe={yerlesim.kademe}
            binalar={sahnedekiler}
            className="absolute inset-0 h-full w-full"
          />
          {/* Kasaba: binalar yüzdeleriyle, yerleşkenin ortasındaki çerçevede. */}
          <div className="absolute" style={KASABA_YERI}>
            {binalar.map((b) => (
              <BinaIsareti
                key={b.key}
                b={b}
                secili={secili === b.key}
                mesgul={isler.get(b.key) ?? null}
                onSec={() => haritadaSec(b)}
              />
            ))}
            {/* Adlar en üstte ve tıklamayı geçiriyor: hangi binanın adı
                olduğu konumdan belli, dokunuş binanın kendisine gitmeli. */}
            <div className="pointer-events-none absolute inset-0 z-[400]">
              {binalar.map((b) => (
                <YapiEtiketi key={b.key} b={b} secili={secili === b.key} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Üstte yüzenler: kâhya, süren inşaat, taşınma, hata --- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] space-y-1.5 p-2">
        <div className="pointer-events-auto">
          <Rehber
            adim={rehberAdimi?.anahtar ?? null}
            durum={rehberDurumu}
            gorundu={lord.rehberGorundu}
            medeniyet={lord.medeniyet}
          />
        </div>
        {insaat.map((i) => (
          <div
            key={i.id}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-altin/50 bg-gece/85 py-1 pr-1 pl-3 text-[12px] backdrop-blur"
          >
            <span className="min-w-0 flex-1 truncate text-altin">{`${i.ad} inşa ediliyor`}</span>
            <span className="tabular shrink-0 text-parsomen">
              <GeriSayim bitis={i.finishAt} kisa />
            </span>
            <Buton
              tur="anahat"
              boy="kucuk"
              disabled={iptal.isPending}
              onClick={() => iptal.mutate(i.id)}
            >
              İptal
            </Buton>
          </div>
        ))}
        {/* Fetih ancak KARŞILIĞI görünürse bir kazanç: daha büyük bir
            yerleşim aldığında oyun bunu kendiliğinden söylüyor; binalar
            lordla birlikte taşınıyor (docs/12 §2.4). */}
        {tasinabilir.map((t) => (
          <div
            key={t.bolgeId}
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-altin/50 bg-gece/85 p-2 backdrop-blur"
            data-tasinabilir={t.bolgeId}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-altin">{`Başkentini taşı: ${t.ad}`}</p>
              <p className="text-[11px] text-solgun">{`${t.kademeAdi} · bina tavanı ${t.binaTavani}`}</p>
            </div>
            <Buton
              tur="altin"
              boy="kucuk"
              isaret="sehir-tasin"
              disabled={tasi.isPending}
              onClick={() => tasi.mutate(t.bolgeId)}
            >
              Taşın
            </Buton>
          </div>
        ))}
        {hata && (
          <p className="pointer-events-auto rounded-lg bg-gece/90 px-3 py-1.5 text-[12px] text-kirmizi">
            {hata}
          </p>
        )}
      </div>

      {/* --- Altta: seçili yapının kartı, yapı listesi ya da listenin düğmesi --- */}
      <div ref={kartRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-2">
        {seciliBina ? (
          <div className="pointer-events-auto relative">
            <BinaKarti
              b={seciliBina}
              kaynak={lord.resources}
              bekliyor={yap.isPending}
              onGit={() => binayaGit(seciliBina)}
              onYap={() => yap.mutate(seciliBina.key)}
              onKapat={() => setSecili(null)}
            />
          </div>
        ) : liste ? (
          <Kart className="pointer-events-auto max-h-[60vh] overflow-y-auto p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="baslik text-[13px] text-altin">Yapılar</span>
              <button
                type="button"
                aria-label="Listeyi kapat"
                onClick={() => setListe(false)}
                className="bas flex h-7 w-7 items-center justify-center rounded-full text-solgun"
              >
                ✕
              </button>
            </div>
            {/* Seviye yükseltme burada: haritadaki dokunuş yapının içine giriyor. */}
            <div id="yapilar" className="grid grid-cols-4 gap-1.5">
              {binalar.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => {
                    setListe(false);
                    setSecili(b.key);
                  }}
                  className="kart relative flex min-h-[76px] w-full flex-col items-center justify-start gap-1 p-1.5 text-center"
                >
                  <span
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      b.seviye > 0 ? 'bg-altin/15 text-altin' : 'bg-kenar/40 text-sonuk'
                    }`}
                  >
                    <BinaIkonu binaKey={b.key} boyut={22} seviye={b.seviye} seviyeli={b.seviyeli} />
                    {b.seviyeli && b.seviye > 0 && (
                      <span className="tabular absolute -top-1.5 -right-1.5 rounded-full border border-kenar bg-panel px-1 text-[11px] leading-[15px] font-bold text-altin">
                        {b.seviye}
                      </span>
                    )}
                  </span>
                  <span
                    className={`line-clamp-2 text-[11px] leading-tight ${
                      b.seviye > 0 ? 'text-parsomen' : 'text-sonuk'
                    }`}
                  >
                    {b.ad}
                  </span>
                  {b.insaatta && (
                    <span
                      aria-label="inşa ediliyor"
                      className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-altin"
                    />
                  )}
                </button>
              ))}
            </div>
          </Kart>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              data-yapilar-ac=""
              onClick={() => setListe(true)}
              className="bas pointer-events-auto flex items-center gap-1.5 rounded-full border border-kenar bg-gece/85 px-3 py-2 text-[12px] font-bold text-altin shadow-[0_2px_8px_rgba(0,0,0,0.5)] backdrop-blur"
            >
              <BinaIkonu binaKey="malikane" boyut={16} seviye={1} seviyeli={false} />
              Yapılar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Etki değerini insanın okuyacağı gibi yazar.
 *
 * Üç birim var ve üçü de aynı satırda görünüyor: düz sayı (kuyruk,
 * slot), saniye (tedavi tavanı) ve oran (surlar). Tek biçimle
 * yazsaydık "Başkent tahkimatı: 0,04" ya da "En uzun tedavi: 21600"
 * çıkardı — ikisi de oyuncuya hiçbir şey söylemez.
 */
function etkiYazisi(deger: number | null, birim: BinaDurumu['etkiBirimi']): string {
  if (deger === null) return '—';
  if (birim === 'saniye') return formatKalan(deger * 1000);
  if (birim === 'oran') return `%${Math.round(deger * 100)}`;
  return formatSayi(deger);
}

/**
 * Haritadaki tek bir yapı.
 *
 * Oyuncu referans olarak başka oyunlardan iki ekran gönderdi ve tek bir
 * şey sordu: "zemine tam oturan bir yapı kurabilir miyiz?" Aradaki fark
 * çizimden çok YERLEŞTİRMEDEN geliyordu. Dört şey birlikte çalışıyor:
 *
 * 1. TABANDAN ÇAKMA. `translate(-50%, -100%)` — kutunun ALT kenarı
 *    x/y'ye oturuyor, merkezi değil. Bütün binalar aynı sabit kutuda
 *    çiziliyor (`BINA_KUTUSU`), yani tabanları aynı çizgide; kutuya
 *    göre değişseydi biri zemine gömülü, öteki havada dururdu.
 *
 * 2. TEMAS GÖLGESİ. Binanın ayak bastığı yere bir elips. Bir nesnenin
 *    zeminde durduğunu söyleyen şey bu; sprite'ın kendi düşen gölgesi
 *    (drop-shadow) onu kâğıt gibi gösteriyordu.
 *
 * 3. DERİNLİK SIRASI. `zIndex = y` — önde duran arkadakini örtüyor.
 *    Sıralar bilerek çakışıyor; çakışmasaydı binalar küçük kalırdı.
 *
 * 4. ÖLÇEK. Boy `data/binalar.json` içindeki `olcek` ile geliyor:
 *    malikâne 1.25, görev panosu 0.60. Hepsi aynı boyken hangisinin
 *    diyarın kalbi olduğu okunmuyordu.
 *
 * Etiket artık HER ZAMAN durmuyor. On üç koyu etiket hapı manzarayı
 * örtüyordu ve referansların hiçbirinde yok. Boş arsada duruyor (orada
 * sprite hepsi için AYNI — `arsa` — yani ad olmadan hangi yapı olduğu
 * bilinemez) ve seçili yapıda duruyor. Dikili binanın kimliği silueti;
 * adı `aria-label`da, listede ve dokununca açılan kartta.
 */
function BinaIsareti({
  b,
  secili,
  mesgul,
  onSec,
}: {
  b: BinaDurumu;
  secili: boolean;
  /** Bu yapıda süren iş — varsa bitiş zamanı ve tek kelimelik adı. */
  mesgul: { bitis: string; ad: string } | null;
  onSec: () => void;
}) {
  const dikili = b.seviye > 0;
  const ad = spriteAdi(b.key, b.seviye, b.seviyeli);
  const sprite = SPRITE_OLAN.has(ad);
  const girilebilir = dikili && Boolean(b.kapi || b.sekme);
  return (
    <button
      type="button"
      onClick={onSec}
      data-bina={b.key}
      // Testler ve rehber ışığı binayı AÇTIĞI KAPIDAN buluyor: bina
      // anahtarı ile kapı adı her zaman aynı değil (karargâh → generaller).
      data-bina-kapi={b.kapi ?? undefined}
      data-bina-mesgul={mesgul ? '' : undefined}
      aria-label={`${b.ad} — ${dikili ? `seviye ${b.seviye}` : 'boş arsa'}, ${
        girilebilir ? b.ozet : b.aciklama
      }${mesgul ? `, ${mesgul.ad} sürüyor` : ''}`}
      title={`${b.ad} — ${dikili ? `seviye ${b.seviye}` : 'boş arsa'}`}
      // Dokunma KUTUDAN değil aşağıdaki gövde alanından (`BINA_DOKUNMA`).
      className="pointer-events-none absolute aspect-square"
      style={{
        left: `${b.x}%`,
        top: `${b.y}%`,
        width: `${TABAN_BOY * b.olcek}%`,
        transform: 'translate(-50%, -100%)',
        /*
         * Derinlik sırası y'den; AMA meşgul ya da seçili yapı öne alınıyor.
         * Sıralar bilerek çakıştığı için öndeki bina arkadakinin tabanını
         * örtüyor ve sayaç tam orada duruyor — demirhanenin "4dk"si
         * kütüphanenin çatısının altında kalıyordu. Olan biteni gösteren
         * şey, üstü örtülü olmamalı.
         */
        zIndex: Math.round(b.y) + (mesgul || secili ? 200 : 0),
      }}
    >
      {/*
        SEÇİM HALKASI — bina artık yerleşkenin içinde çiziliyor (gölgesi
        yere düşüyor, bkz. `yerlesim.sahneBinasi`); seçili ya da işi süren
        yapıyı tabanındaki halka gösteriyor. Önceden çizimin kendisi
        parlıyordu; ayrı resim olmayınca parlatılacak bir şey yok, oyunlarda
        seçim de zaten tabandaki halkayla okunuyor.
      */}
      {sprite && (secili || mesgul) && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-[-5%] left-1/2 h-[30%] w-[92%] -translate-x-1/2 rounded-[50%] border-2 ${
            secili
              ? 'border-[#fff3cf] shadow-[0_0_10px_2px_rgba(245,183,49,0.75)]'
              : 'animate-pulse border-altin/70 shadow-[0_0_8px_rgba(245,183,49,0.45)]'
          }`}
        />
      )}

      {/*
        DOKUNMA ALANI — kutunun tamamı değil, sprite'ın GÖVDESİ.

        Sıralar bilerek çakışıyor (yukarıda, 3.) ve dokunma bütün kare
        kutudaydı: öndeki binanın kutusunun ÜST kısmı çoğunlukla boş gökyüzü,
        ama arkadakinin üstüne biniyordu. Tüm düğmeleri deneyen bot
        (tools/tum-dugmeler-testi.mjs) yakaladı: Elçilik'in ortası
        Malikâne'nin kutusunun altında kalıyordu, Elçilik'e dokunan oyuncu
        Malikâne'ye giriyordu. Düğmenin kendisi dokunulmaz, yalnız bu alan
        dokunulur; çocuklar `pointer-events`i düğmeden devraldığı için başka
        hiçbir parça dokunmayı yutmuyor. Klavye ve ekran okuyucu için düğme
        aynen duruyor.
      */}
      <span aria-hidden="true" className="pointer-events-auto absolute z-20" style={BINA_DOKUNMA} />

      {/*
        İSKELE — kuyruktaki bina inşa hâlinde görünsün.

        Bekleme süresi sayıyla anlatılıyordu ("2dk 14sn") ve şehirde
        hiçbir izi yoktu: 1. seviye kışla ile yükseltilmekte olan kışla
        birebir aynı duruyordu. Oyuncunun beklediği şey ekranda yoksa
        beklemek boş bir sayaç oluyor.

        Çizim değil ÇİZGİ: yeni bir görsel üretmiyoruz, binanın üstüne
        ahşap bir iskele çiziliyor. Bütün binalar için çalışıyor, hiçbiri
        için ayrı dosya gerekmiyor.
      */}
      {mesgul && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        >
          <g stroke="#c79a5a" strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.92}>
            {/* Dikmeler */}
            <line x1={16} y1={96} x2={16} y2={26} />
            <line x1={84} y1={96} x2={84} y2={26} />
            {/* Kat kirişleri */}
            <line x1={13} y1={68} x2={87} y2={68} />
            <line x1={13} y1={44} x2={87} y2={44} />
            {/* Çapraz destek: iskeleyi "iki çizgi" olmaktan çıkaran şey */}
            <line x1={16} y1={68} x2={84} y2={44} strokeWidth={1.6} opacity={0.75} />
            {/* Tepe kalası */}
            <line x1={22} y1={26} x2={78} y2={26} strokeWidth={1.8} />
          </g>
        </svg>
      )}

      {sprite ? null : (
        <span
          className={`relative flex h-full w-full items-center justify-center rounded-xl shadow-[0_2px_6px_rgba(0,0,0,0.55)] ${
            dikili
              ? 'bg-[#6a5334] text-parsomen'
              : 'border-2 border-dashed border-solgun/45 text-sonuk'
          }`}
          style={secili ? { outline: '3px solid #fff3cf', outlineOffset: '2px' } : undefined}
        >
          <BinaIkonu binaKey={b.key} boyut={22} seviye={b.seviye} seviyeli={b.seviyeli} />
        </span>
      )}

      {/*
        --- Rozet TABANDA, köşede değil ---

        Rozet kutunun sağ alt köşesindeydi. Çizim kareyi doldurmadığı için
        rozet binadan kopuyor, bazen komşu binanın üstüne düşüyor, kenardaki
        yapılarda yarısı kırpılıyordu — oyuncunun "yazılar birbirinin üstüne
        biniyor" dediği şey buydu. Ortaya, tabanın üstüne alındı: her yapıda
        aynı yerde ve komşusuyla çakışamıyor, çünkü tabanlar birbirinden
        uzak.
      */}
      {/*
        --- Tabanda TEK rozet ---

        Üç şey aynı anda rozet istiyordu: seviye, boş arsadaki artı ve süren
        işin sayacı. Üçü ayrı köşelere konunca haritada yazı kalabalığı
        oluyor, biri komşu binanın üstüne düşüyordu. Hepsi tabanın üstünde
        AYNI yerde duruyor ve sırası şu: meşgulse sayaç, değilse seviye,
        dikilmemişse artı.

        Sayacın seviyeyi örtmesi doğru: bir iş sürerken oyuncunun sorduğu
        şey "kaçıncı seviye" değil, "ne zaman biter". Seviye zaten binanın
        içinde ve Yapılar listesinde yazıyor.

        Sayacın kendisi, denemeye veren bir oyuncunun cümlesinden geldi:
        "ben köyü görmek isterim, eğitilen o yeri görmek daha kendine
        bağlar." Asker kışlada eğitiliyor, ekipman demirhanede dövülüyor
        ama köyde bunun hiçbir izi yoktu.
      */}
      {mesgul ? (
        <span className="tabular absolute bottom-[1%] left-1/2 -translate-x-1/2 rounded-full border border-altin/70 bg-gece/90 px-1 text-[11px] leading-tight font-bold whitespace-nowrap text-altin">
          <GeriSayim bitis={mesgul.bitis} kisa />
        </span>
      ) : b.seviyeli && dikili ? (
        <span className="tabular absolute bottom-[1%] left-1/2 -translate-x-1/2 rounded-full bg-gece/90 px-1.5 text-[11px] leading-tight font-bold text-altin">
          {b.seviye}
        </span>
      ) : b.seviyeli && !dikili ? (
        <span className="absolute bottom-[1%] left-1/2 -translate-x-1/2 rounded-full bg-gece/90 px-1.5 text-[11px] leading-tight font-bold text-solgun">
          +
        </span>
      ) : null}

      {/* Ad etiketi burada DEĞİL: `YapiEtiketi` ile ayrı bir katmanda
          (bkz. o bileşenin notu). */}
    </button>
  );
}

/**
 * YAPI ADI — binaların ÜSTÜNDE, ayrı bir katmanda.
 *
 * ── Neden düğmenin içinde olamıyor ───────────────────────────────────
 *
 * Etiket binanın kutusunun altına (`top-full`) çiziliyordu ve iki kusuru
 * vardı:
 *
 *  1. KIRPILIYORDU. Haritanın alt sırasındaki yapıların etiketi kabın
 *     dışına taşıyor, `overflow-hidden` onu kesiyordu — "Pazar" yazısının
 *     alt yarısı yoktu.
 *  2. KOMŞUNUN ALTINDA KALIYORDU. Her bina düğmesi kendi `zIndex`ini
 *     kuruyor (derinlik sırası y'den geliyor), yani kendi YIĞIN BAĞLAMINI
 *     açıyor. İçindeki etiket o bağlamdan çıkamıyor: aşağıdaki bir
 *     binanın çizimi, yukarıdaki binanın adını örtüyordu.
 *
 * İkisi de tek bir şeyden: etiket, ait olduğu düğmenin içindeydi. Ayrı
 * katmanda ikisi de kendiliğinden çözülüyor — katman bütün binaların
 * üstünde ve kabın içinde kalıyor.
 *
 * Alt sıradaki yapıda etiket yapının ÜSTÜNE geçiyor: aşağı sığmıyorsa
 * yukarı sığar, kırpılmaktansa yer değiştirsin.
 */
function YapiEtiketi({ b, secili }: { b: BinaDurumu; secili: boolean }) {
  const dikili = b.seviye > 0;
  if (!(secili || !dikili)) return null;
  // %86'dan aşağıdaki yapının etiketi kaba sığmıyor: üstüne alınıyor.
  const ustte = b.y > 86;
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute max-w-[110px] -translate-x-1/2 truncate rounded bg-gece/85 px-1 text-[11px] leading-tight font-bold whitespace-nowrap ${
        dikili ? 'text-altin' : 'text-solgun'
      }`}
      style={{
        left: `${b.x}%`,
        // Yapının tabanı y'de; etiket ya hemen altında ya da kutunun
        // üstünde. Kutu yüksekliği genişlikle aynı (aspect-square).
        top: ustte
          ? `calc(${b.y}% - ${TABAN_BOY * b.olcek}% - 1.15rem)`
          : `calc(${b.y}% + 0.25rem)`,
      }}
    >
      {b.ad}
    </span>
  );
}

/** Seçili yapının kartı: ne yapar, ne durumda, sıradaki seviye ne getirir. */
function BinaKarti({
  b,
  kaynak,
  bekliyor,
  onGit,
  onYap,
  onKapat,
}: {
  b: BinaDurumu;
  kaynak: { altin: number; demir: number; erzak: number };
  bekliyor: boolean;
  onGit: () => void;
  onYap: () => void;
  onKapat: () => void;
}) {
  const dikili = b.seviye > 0;
  const girilebilir = dikili && (b.kapi || b.sekme);
  return (
    <Kart className="p-3" vurgu={dikili ? 'var(--color-altin)' : undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="baslik text-[13px] text-parsomen">{b.ad}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-[12px] text-solgun">
            {b.seviyeli ? (dikili ? `Seviye ${b.seviye} / ${b.tavan}` : 'boş arsa') : 'yapı'}
          </span>
          {/* Kart yerleşkenin üstünde yüzüyor: kapanınca yerleşke açılıyor. */}
          <button
            type="button"
            aria-label="Kartı kapat"
            onClick={onKapat}
            className="bas -my-1 flex h-7 w-7 items-center justify-center rounded-full text-solgun"
          >
            ✕
          </button>
        </span>
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-solgun">{b.aciklama}</p>

      {b.maliyet && (
        <>
          {/* Fiyat tek nesne, süre ayrı tür (`Maliyet`, `Sure`) — kışla ve
              bölge kartıyla aynı gramer. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Maliyet
              altin={b.maliyet.altin}
              demir={b.maliyet.demir}
              erzak={b.maliyet.erzak}
              kaynaklar={kaynak}
            />
            {b.sureSn !== null && <Sure>{formatKalan(b.sureSn * 1000)}</Sure>}
          </div>
          {/* Seviyenin NE VERDİĞİ yazılı — binanın seviyesi değil ETKİSİ.
              Önce "Depo tabanı: 1 → 2" yazıyordu; o iki sayı seviyeydi ve
              oyuncu 1200 altını harcamadan önce ne kazanacağını hiçbir
              yerde göremiyordu (docs/09 İ1). */}
          {b.etkiMetni && (
            <p className="mt-1.5 text-[11px] text-altin">
              {b.etkiMetni}: {etkiYazisi(b.etkiSimdi, b.etkiBirimi)}
              {b.etkiSonra !== null && ` → ${etkiYazisi(b.etkiSonra, b.etkiBirimi)}`}
            </p>
          )}
        </>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {b.seviyeli && (
          <Buton
            onClick={onYap}
            disabled={bekliyor || !b.yukseltilebilir}
            isaret={dikili ? undefined : 'sehir-insa'}
          >
            {bekliyor ? 'Gönderiliyor…' : dikili ? `Seviye ${b.seviye + 1} yap` : 'İnşa et'}
          </Buton>
        )}
        {girilebilir && (
          <Buton tur="anahat" onClick={onGit} isaret="sehir-kapiya-git">{`${b.ad}'a git`}</Buton>
        )}
      </div>

      {b.engel && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-solgun">
          <span className="mt-0.5 shrink-0 text-turuncu">
            <IkonUyari boyut={12} />
          </span>
          {b.engel}
        </p>
      )}
    </Kart>
  );
}
