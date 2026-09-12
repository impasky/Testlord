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
import { useEffect, useRef, useState } from 'react';
import { ApiError, api, type BinaDurumu, type LordState, type QueueItem } from '../api/client';
import { Omurga, useOmurgaAdimi } from '../components/Omurga';
import { Rehber } from '../components/Rehber';
import { useRehberDurumu } from '../rehberDurumu';
import { DiyarTanitimi } from '../components/DiyarTanitimi';
import { IKONLAR } from '../components/ikon-verisi';
import {
  Bolum,
  Buton,
  GeriSayim,
  Hap,
  Ilerleme,
  Iskelet,
  Kart,
  formatKalan,
  formatSayi,
} from '../components/ui';
import { IkonAltin, IkonDemir, IkonErzak, IkonSure, IkonUyari } from '../components/Ikonlar';
import type { Kapi } from '@lordlar/shared';
import type { Sekme } from '../components/MobilKabuk';

/**
 * Kuyruk satırı — "şu an ne oluyor".
 *
 * Malikâne'den Lord ekranına, oradan da buraya taşındı: her seferinde
 * ANA SAYFANIN peşinden gitti. Oyuncunun "bir şey başlattım, ne oldu"
 * sorusu indiği yerde cevaplanmalı.
 */
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

function KuyrukSatiri({ q }: { q: QueueItem }) {
  const bas = new Date(q.startedAt).getTime();
  const bit = new Date(q.finishAt).getTime();
  const gecen = Math.max(0, Math.min(1, (Date.now() - bas) / (bit - bas)));
  return (
    <Kart className="p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate">
          {KUYRUK_ADI[q.kind] ?? q.kind}
          {typeof q.payload.count === 'number' && (
            <span className="ml-1.5 text-solgun">×{q.payload.count as number}</span>
          )}
        </span>
        <span className="shrink-0 text-[12px] text-altin">
          <GeriSayim bitis={q.finishAt} />
        </span>
      </div>
      <Ilerleme deger={gecen} max={1} renk="var(--color-altin)" boy="ince" />
    </Kart>
  );
}

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
 */
const TABAN_BOY = 22;

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
 * Üretilmiş bina sprite'ları — `public/gorseller/binalar/` ile aynı liste.
 *
 * `Zemin.tsx`teki `ZEMINI_OLAN` ile aynı desen ve aynı gerekçe: dosya
 * yoksa isteği hiç atmıyoruz. `onError` ile denemek de olurdu ama şehir
 * sayfasında 13 yapı var, yani her çizimde 13 boşa istek — üretimde 13
 * gerçek 404. Vite geliştirme sunucusu eksik dosyaya index.html dönüp
 * 200 verdiği için bu ölçümde de görünmezdi.
 *
 * Liste `gorsel-denetim.mjs` tarafından klasörle karşılaştırılıyor:
 * dosya eklenip satır unutulursa ya da tersi olursa denetim düşüyor.
 */
const SPRITE_OLAN = new Set<string>([
  'arsa',
  'malikane_1',
  'malikane_5',
  'kisla_1',
  'kisla_5',
  'demirhane_1',
  'demirhane_5',
  'hastane_1',
  'hastane_5',
  'pazar_1',
  'pazar_5',
  'surlar_1',
  'surlar_5',
  'karargah_1',
  'karargah_5',
  'kutuphane_1',
  'kutuphane_5',
  'liman_1',
  'liman_5',
  'elcilik_1',
  'elcilik_5',
  'gorev_panosu',
  'haberci_kulesi',
  'onur_meydani',
]);

/**
 * Binanın görseli: varsa SPRITE, yoksa çizgi ikon.
 *
 * İkisi birden duruyor ve bu bilinçli. Sprite'lar üretildikçe şehir
 * kendiliğinden zenginleşiyor; üretilmeyen bina çizgi ikonuyla çalışmaya
 * devam ediyor. Tersi — önce ikonu kaldırıp sprite beklemek — dosya
 * gelene kadar boş kutular demekti.
 *
 * Dosya adı SEVİYEYE bağlı: `_1` temel, `_5` gelişmiş. Arada üç ayrı
 * görsel üretmenin karşılığı yok; seviye zaten rozetle yazılı.
 * Dikilmemiş bina paylaşılan `arsa` görselini kullanıyor.
 */
function spriteAdi(binaKey: string, seviye: number, seviyeli: boolean): string {
  if (!seviyeli) return binaKey;
  if (seviye <= 0) return 'arsa';
  return `${binaKey}_${seviye >= 3 ? 5 : 1}`;
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
  if (SPRITE_OLAN.has(ad)) {
    return (
      <img
        src={`/gorseller/binalar/${ad}.webp`}
        alt=""
        aria-hidden="true"
        width={boyut}
        height={boyut}
        className="object-contain"
      />
    );
  }
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
  onBolgeyiAc,
  onBolumeGit,
}: {
  lord: LordState;
  queues: QueueItem[];
  onGit: (s: Sekme) => void;
  onKapiAc: (k: Kapi) => void;
  /** Bir bölgeyi haritada açar: omurganın hedefi. */
  onBolgeyiAc: (regionId: number) => void;
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
  /*
   * Kart HARİTANIN altında duruyor, liste ise sayfanın dibinde. Listeden
   * bir yapı seçen oyuncu, ekranın dışında açılan bir karta bakıyordu:
   * dokundu, hiçbir şey olmadı sandı. Seçim listeden geldiyse karta
   * kaydırılıyor; haritadan geldiyse kart zaten görünürde.
   */
  const kartRef = useRef<HTMLDivElement>(null);
  const listedenGeldi = useRef(false);
  useEffect(() => {
    if (!secili || !listedenGeldi.current) return;
    listedenGeldi.current = false;
    kartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [secili]);

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
    <div className="space-y-4">
      {/* --- Tepede YALNIZ kâhya ---
          Oyuncu: "üst kısımda sadece kâhya Sinan olsun." Kâhya ile omurga
          üst üste duruyordu ve ikisi de "şimdi ne yapmalısın" diyordu —
          biri hikâyeyle, biri düğmeyle. Alt alta iki cevap, telefonda
          ekranın tamamını yiyor ve oyuncu şehrini görmeden kaydırmaya
          başlıyordu. Kâhya kaldı (bir cümle), omurga haritanın altına
          indi (docs/12 §3.5). */}
      <Rehber
        adim={rehberAdimi?.anahtar ?? null}
        durum={rehberDurumu}
        gorundu={lord.rehberGorundu}
      />

      {/* --- Yerleşim haritası ---
          Sayfanın ilk ekranında artık ŞEHİR var. Ana sayfanın şehir
          olmasının bütün gerekçesi buydu; kartların altında kalınca
          oyuncu onu ancak kaydırarak buluyordu. */}
      <div className="oyuk relative overflow-hidden rounded-xl border border-kenar">
        <div
          /* isolate: yapıların derinlik sırası (`zIndex = y`) YALNIZ
             haritanın içinde geçerli olmalı. Kap kendi yığın bağlamını
             kurmayınca z-index'ler kök bağlamda yarışıyordu ve 96'ya
             çıkan bir bina, kapı panelinin (z-52) ÜSTÜNE geçip
             tıklamayı yiyordu. */
          className="relative aspect-[4/3] w-full isolate bg-[radial-gradient(ellipse_at_50%_38%,#4a4028_0%,#332c1f_45%,#221c14_100%)]"
          role="img"
          aria-label={`${yerlesim.ad} — ${binalar.length} yapı`}
        >
          <img
            src={`/gorseller/yerlesim/${yerlesim.kademe}.webp`}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
          />
          {binalar.map((b) => (
            <BinaIsareti
              key={b.key}
              b={b}
              secili={secili === b.key}
              mesgul={isler.get(b.key) ?? null}
              onSec={() => haritadaSec(b)}
            />
          ))}
        </div>
      </div>

      {/* --- Seçili binanın kartı --- */}
      <div ref={kartRef}>
        {seciliBina ? (
          <BinaKarti
            b={seciliBina}
            kaynak={lord.resources}
            bekliyor={yap.isPending}
            onGit={() => binayaGit(seciliBina)}
            onYap={() => yap.mutate(seciliBina.key)}
          />
        ) : (
          <p className="text-center text-[12px] text-sonuk">
            Dikili yapıya dokun: içine girersin. Boş arsaya dokun: bedelini söyler.
          </p>
        )}
      </div>

      {hata && <p className="text-[12px] text-kirmizi">{hata}</p>}

      {/* --- Şimdi ne yapmalısın ---
          Haritanın ALTINDA: oyuncu önce şehrini görüyor, sonra "sırada ne
          var" cevabını alıyor. Cevap ekrandan çıkmadı, sırası değişti. */}
      <Omurga
        lord={lord}
        queues={queues}
        onGit={onGit}
        onKapiAc={onKapiAc}
        onHedefeGit={onBolgeyiAc}
        onBolumeGit={onBolumeGit}
      />

      {/* Diyar tanıtımı omurganın ALTINDA: "burası neresi" hâlâ
          cevaplanıyor ama "şimdi ne yapmalıyım" cevabından sonra. Kartın
          kendi kapısı var — yalnız hiçbir şey yapmamış lorda görünüyor. */}
      <DiyarTanitimi lord={lord} queues={queues} />

      {/* --- Yerleşim başlığı ---
          Bu da haritanın altında: "burası bir kamp ve bina tavanı 1" bir
          AÇIKLAMA, haritanın kendisi değil. Üstte dururken haritayı
          aşağı itiyordu. */}
      <Kart className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="baslik text-[15px] text-altin">{yerlesim.ad}</span>
          <span className="text-[12px] text-solgun">
            {yerlesim.baskent ? yerlesim.baskent.ad : 'başkentin yok'}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-solgun">{yerlesim.ozet}</p>
        {/* Kademe bir TAVAN: fetihin karşılığı bu, o yüzden görünür. */}
        <p className="mt-1.5 text-[12px] text-sonuk">
          Binaların bu yerleşimde en fazla{' '}
          <strong className="text-parsomen">{yerlesim.binaTavani}. seviye</strong> olabilir.
          {yerlesim.kademe !== 'metropol' && ' Daha büyük bir başkent daha yükseğine izin verir.'}
        </p>
      </Kart>

      {/* --- Süren inşaat --- */}
      {insaat.map((i) => (
        <Kart key={i.id} className="border-altin/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-altin">{i.ad} inşa ediliyor</p>
              <p className="text-[12px] text-solgun">
                <GeriSayim bitis={i.finishAt} /> kaldı
              </p>
            </div>
            <Buton tur="anahat" disabled={iptal.isPending} onClick={() => iptal.mutate(i.id)}>
              İptal
            </Buton>
          </div>
          <p className="mt-1.5 text-[11px] text-solgun">
            İptal edersen harcadığının yarısı geri gelir.
          </p>
        </Kart>
      ))}

      {/* --- Başkentini taşı ---
          Fetih ancak KARŞILIĞI görünürse bir kazanç. Daha büyük bir
          yerleşim aldığında oyun bunu kendiliğinden söylüyor; binalar
          lordla birlikte taşındığı için taşınmak hiçbir şey kaybettirmez
          (docs/12 §2.4). Liste boşsa kart hiç çizilmiyor. */}
      {tasinabilir.length > 0 && (
        <Kart className="border-altin/40 p-3">
          <p className="baslik text-[13.5px] text-altin">Başkentini taşıyabilirsin</p>
          <p className="mt-1 text-[12px] leading-snug text-solgun">
            Daha büyük bir yerleşimin var. Taşınırsan binaların seninle gelir — hiçbir seviye
            kaybolmaz, yalnız tavan yükselir.
          </p>
          <div className="mt-2 space-y-2">
            {tasinabilir.map((t) => (
              <div
                key={t.bolgeId}
                className="flex items-center justify-between gap-2 rounded-lg border border-kenar bg-siyah/20 p-2"
                data-tasinabilir={t.bolgeId}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-parsomen">{t.ad}</p>
                  <p className="text-[11.5px] text-solgun">
                    {t.kademeAdi} · bina tavanı {t.binaTavani}
                  </p>
                </div>
                <Buton
                  tur="altin"
                  isaret="sehir-tasin"
                  disabled={tasi.isPending}
                  onClick={() => tasi.mutate(t.bolgeId)}
                >
                  Taşın
                </Buton>
              </div>
            ))}
          </div>
        </Kart>
      )}

      {/* Boş kuyruk bölümü ilk döngüde de KALIYOR ve bu bilinçli:
          boş hâlindeki düğmeler gürültü değil, "yapacak bir şey yok
          ekranı olmasın" kuralının kendisi (docs/09 K7). Ayrıca kart geç
          gelen kuyruk verisine bağlı gizlenince açılışta zıplama
          çıkıyordu. */}
      <Bolum
        baslik={`Kuyruklar${queues.length ? ` · ${queues.length}` : ''}`}
        sakin={queues.length === 0}
      >
        {queues.length === 0 ? (
          <Kart sakin className="p-4">
            <p className="mb-3 text-[13px] text-solgun">Kuyruk boş. Bir şeyler başlat.</p>
            <div className="flex gap-2">
              <Buton tur="sessiz" boy="kucuk" onClick={() => onGit('kisla')}>
                Kışla
              </Buton>
              <Buton tur="sessiz" boy="kucuk" onClick={() => onKapiAc('demirhane')}>
                Demirhane
              </Buton>
              <Buton tur="sessiz" boy="kucuk" onClick={() => onGit('harita')}>
                Harita
              </Buton>
            </div>
          </Kart>
        ) : (
          <div className="space-y-2">
            {queues.map((q) => (
              <KuyrukSatiri key={q.id} q={q} />
            ))}
          </div>
        )}
      </Bolum>

      {/* --- Liste görünümü ---
          Harita güzel ama bir LİSTE de gerekiyor: hangi binanın kaçıncı
          seviyede olduğunu görmek, haritada tek tek dokunmakla değil tek
          bakışta olmalı. */}
      <Bolum baslik="Yapılar" id="yapilar">
        <p className="mb-2 text-[12px] text-sonuk">
          Seviye yükseltmek için buradan seç: haritadaki dokunuş yapının içine giriyor.
        </p>
        <div className="space-y-1.5">
          {binalar.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => {
                listedenGeldi.current = true;
                setSecili(b.key);
              }}
              className="kart flex w-full items-center gap-2.5 p-2.5 text-left"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                  b.seviye > 0 ? 'bg-altin/15 text-altin' : 'bg-kenar/40 text-sonuk'
                }`}
              >
                <BinaIkonu binaKey={b.key} boyut={26} seviye={b.seviye} seviyeli={b.seviyeli} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[13px] font-semibold text-parsomen">{b.ad}</span>
                  {b.seviyeli && b.seviye > 0 && (
                    <span className="tabular text-[11px] text-altin">Sv {b.seviye}</span>
                  )}
                  {b.seviye === 0 && <span className="text-[11px] text-sonuk">boş arsa</span>}
                </span>
                <span className="block truncate text-[12px] text-solgun">{b.ozet}</span>
              </span>
              {b.insaatta && <Hap renk="var(--color-altin)">inşa</Hap>}
            </button>
          ))}
        </div>
      </Bolum>
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
 *    x/y'ye oturuyor, merkezi değil. Sprite'ların tabanı da ortak bir
 *    çizgiye getirildi (`tools/sprite-hizala.py`); önce alt boşlukları
 *    %3 ile %12 arasında geziyordu, yani aynı kutuya konsalar bile biri
 *    zemine gömülü, öteki havada duruyordu.
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
  const etiketVar = secili || !dikili;
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
      className="absolute aspect-square"
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
        --- Zemine oturtan iki gölge ---

        Oyuncu: "binalar havada duruyor gibi görünüyor." Tek bir yumuşak
        elips yetmiyordu; bir nesnenin yere BASTIĞINI söyleyen şey iki ayrı
        sinyal:

          ORTAM — geniş ve soluk, binanın çevresine yayılan karartma.
          TEMAS — dar ve KOYU, tam tabanın olduğu yerde.

        İkisinin de dikey merkezi çizimin tabanına (kutunun altından %2
        yukarısı) oturuyor, yani gölge binanın ÖNÜNE de taşıyor. Önceki
        hâlde elips kutunun dibindeydi: binanın altında değil, altındaki
        boşluktaydı ve açık zeminde hiç görünmüyordu.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-7%] left-1/2 h-[18%] w-[84%] -translate-x-1/2 rounded-[50%]"
        style={{
          // Sıcak siyah: saf siyah bir leke taş döşemede mürekkep gibi
          // duruyordu; kahveye çalan karartma çimende çiğnenmiş toprak,
          // taşta aşınma gibi okunuyor. (`mix-blend-multiply` denendi ve
          // çalışmadı: düğmenin kendi z-index'i var, yani kendi yığın
          // bağlamını kuruyor ve karışım zemine değil düğmenin saydam
          // arkasına uygulanıyordu — beyaz halkalar çıktı.)
          background:
            'radial-gradient(ellipse at center, rgba(38,28,16,0.44) 0%, rgba(38,28,16,0.20) 52%, rgba(38,28,16,0) 78%)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-2%] left-1/2 h-[8%] w-[46%] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0) 82%)',
        }}
      />

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

      {sprite ? (
        <img
          src={`/gorseller/binalar/${ad}.webp`}
          alt=""
          aria-hidden="true"
          className="relative h-full w-full object-contain"
          style={{
            // Sprite'ın KENDİ düşen gölgesi kalktı: temas gölgesi varken
            // ikincisi binayı zemine basan bir yapı değil, zeminin üstüne
            // yapıştırılmış bir çıkartma gibi gösteriyordu.
            filter: secili
              ? 'drop-shadow(0 0 3px #fff3cf) drop-shadow(0 0 8px #f5b731)'
              : mesgul
                ? 'drop-shadow(0 0 5px rgba(245,183,49,0.55))'
                : undefined,
            // Dikilmemiş arsa soluk: "burada ne var, ne yok" bir bakışta.
            opacity: dikili ? 1 : 0.72,
          }}
        />
      ) : (
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

      {etiketVar && (
        <span
          className={`pointer-events-none absolute top-full left-1/2 mt-1 max-w-[110px] -translate-x-1/2 truncate rounded bg-gece/85 px-1 text-[11px] leading-tight font-bold whitespace-nowrap ${
            dikili ? 'text-altin' : 'text-solgun'
          }`}
        >
          {b.ad}
        </span>
      )}
    </button>
  );
}

/** Seçili yapının kartı: ne yapar, ne durumda, sıradaki seviye ne getirir. */
function BinaKarti({
  b,
  kaynak,
  bekliyor,
  onGit,
  onYap,
}: {
  b: BinaDurumu;
  kaynak: { altin: number; demir: number; erzak: number };
  bekliyor: boolean;
  onGit: () => void;
  onYap: () => void;
}) {
  const dikili = b.seviye > 0;
  const girilebilir = dikili && (b.kapi || b.sekme);
  return (
    <Kart className="p-3" vurgu={dikili ? 'var(--color-altin)' : undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="baslik text-[13px] text-parsomen">{b.ad}</span>
        <span className="text-[12px] text-solgun">
          {b.seviyeli ? (dikili ? `Seviye ${b.seviye} / ${b.tavan}` : 'boş arsa') : 'yapı'}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-solgun">{b.aciklama}</p>

      {b.maliyet && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-solgun">
            <span className="flex items-center gap-1">
              <IkonAltin boyut={12} />{' '}
              <span className={kaynak.altin < b.maliyet.altin ? 'text-kirmizi' : ''}>
                {formatSayi(b.maliyet.altin)}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <IkonDemir boyut={12} />{' '}
              <span className={kaynak.demir < b.maliyet.demir ? 'text-kirmizi' : ''}>
                {formatSayi(b.maliyet.demir)}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <IkonErzak boyut={12} />{' '}
              <span className={kaynak.erzak < b.maliyet.erzak ? 'text-kirmizi' : ''}>
                {formatSayi(b.maliyet.erzak)}
              </span>
            </span>
            {b.sureSn !== null && (
              <span className="flex items-center gap-1">
                <IkonSure boyut={12} /> {formatKalan(b.sureSn * 1000)}
              </span>
            )}
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
          <Buton tur="anahat" onClick={onGit} isaret="sehir-kapiya-git">
            {b.ad}'a git
          </Buton>
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
