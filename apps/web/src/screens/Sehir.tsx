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
import { useState } from 'react';
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

function BinaIkonu({ binaKey, boyut }: { binaKey: string; boyut: number }) {
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
  const seciliBina = binalar.find((b) => b.key === secili) ?? null;

  /** Binanın açtığı yere götür. Kapı sekme değiştirmiyor, panel açıyor. */
  function binayaGit(b: BinaDurumu) {
    if (b.kapi) onKapiAc(b.kapi as Kapi);
    else if (b.sekme) onGit(b.sekme as Sekme);
  }

  return (
    <div className="space-y-4">
      {/* Kâhya omurganın ÜSTÜNDE: önce neden, sonra ne. Adımı omurgadan
          okuyor, kendi senaryosunu tutmuyor (docs/09 T4). */}
      <Rehber
        adim={rehberAdimi?.anahtar ?? null}
        durum={rehberDurumu}
        gorundu={lord.rehberGorundu}
      />
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

      {/* --- Yerleşim başlığı --- */}
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

      {hata && <p className="text-[12px] text-kirmizi">{hata}</p>}

      {/* --- Yerleşim haritası --- */}
      <div className="oyuk relative overflow-hidden rounded-xl border border-kenar">
        <div
          className="relative aspect-[4/3] w-full bg-[radial-gradient(ellipse_at_50%_38%,#4a4028_0%,#332c1f_45%,#221c14_100%)]"
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
              onSec={() => setSecili((s) => (s === b.key ? null : b.key))}
            />
          ))}
        </div>
      </div>

      {/* --- Seçili binanın kartı --- */}
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
          Bir yapıya dokun: ne işe yaradığını ve bedelini söyler.
        </p>
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
        <div className="space-y-1.5">
          {binalar.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setSecili(b.key)}
              className="kart flex w-full items-center gap-2.5 p-2.5 text-left"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  b.seviye > 0 ? 'bg-altin/15 text-altin' : 'bg-kenar/40 text-sonuk'
                }`}
              >
                <BinaIkonu binaKey={b.key} boyut={18} />
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
 * Haritadaki tek bir yapı.
 *
 * Dikilmemiş bina soluk ve kesik çizgili bir arsa; dikilmiş olan dolu bir
 * madalyon. Fark bir bakışta okunmalı — oyuncunun "şehrimde ne eksik"
 * sorusu haritaya bakarak cevaplanabilmeli.
 */
function BinaIsareti({ b, secili, onSec }: { b: BinaDurumu; secili: boolean; onSec: () => void }) {
  const dikili = b.seviye > 0;
  return (
    <button
      type="button"
      onClick={onSec}
      data-bina={b.key}
      // Testler ve rehber ışığı binayı AÇTIĞI KAPIDAN buluyor: bina
      // anahtarı ile kapı adı her zaman aynı değil (karargâh → generaller).
      data-bina-kapi={b.kapi ?? undefined}
      aria-label={`${b.ad} — ${dikili ? `seviye ${b.seviye}` : 'boş arsa'}, ${b.ozet}`}
      title={`${b.ad} — ${dikili ? `seviye ${b.seviye}` : 'boş arsa'}`}
      // Dairesel 44px hedef: dünya haritasıyla aynı gerekçe — kare kutu
      // komşusunun merkezini örtüyor (docs/12 §5.1).
      className="absolute flex h-11 w-11 items-center justify-center rounded-full"
      style={{ left: `${b.x}%`, top: `${b.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg shadow-[0_2px_6px_rgba(0,0,0,0.55)] ${
          dikili
            ? 'bg-[#6a5334] text-parsomen'
            : 'border-2 border-dashed border-solgun/45 text-sonuk'
        }`}
        style={secili ? { outline: '3px solid #fff3cf', outlineOffset: '2px' } : undefined}
      >
        <BinaIkonu binaKey={b.key} boyut={18} />
        {b.seviyeli && dikili && (
          <span className="tabular absolute -right-1.5 -bottom-1.5 rounded bg-gece px-1 text-[11px] leading-tight font-bold text-altin">
            {b.seviye}
          </span>
        )}
        {b.insaatta && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-altin bg-gece text-[11px] leading-none text-altin">
            ⚒
          </span>
        )}
      </span>
      <span className="pointer-events-none absolute top-full left-1/2 mt-0.5 max-w-[80px] -translate-x-1/2 truncate rounded bg-gece/85 px-1 text-[11px] leading-tight font-bold whitespace-nowrap text-parsomen">
        {b.ad}
      </span>
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
          {/* Seviyenin NE VERDİĞİ yazılı. Araştırmada da böyle: bedeli
              olan bir kararı karşılığını bilmeden vermek olmaz. */}
          {b.etkiMetni && (
            <p className="mt-1.5 text-[11px] text-altin">
              {b.etkiMetni}: {b.seviye} → {b.seviye + 1}
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
