/**
 * Telefonda çizim ölçümü panosu (`?olcum=1`, bkz. `cizim/cizimOlcumu.ts`).
 *
 * Köşede kapalı bir şerit: kaç çizim, ortalama ve en uzun süre, kaç
 * takılma (50 ms'yi aşan kare ya da uzun görev, ekran ekran). Açılınca
 * cihaz bilgisi (GPU'nun adı, ekran, çekirdek), kaynağa göre özet ve son
 * çizimler; "Kopyala" hepsini düz metin olarak panoya alıyor — oyuncu
 * yapıştırıp gönderiyor. Pano yalnız ölçüm açıkken yükleniyor (`main.tsx`,
 * tembel), oyunun paketinde yer tutmuyor.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  KARE_ESIGI,
  ekranGecisleri,
  izlenenKareler,
  kisaAd,
  olcumKayitlari,
  olcumuDinle,
  olcumuKapat,
  olcumuTemizle,
  ozet,
  takilmaIzle,
  takilmalar,
  takilmaOzeti,
  temizlenmeAni,
  type CizimKaydi,
  type EkranTakilmasi,
} from '../cizim/cizimOlcumu';
import { glVarMi } from '../cizim/gl';
import { kaliciDurumu, type KaliciDurum } from '../cizim/kalici';

/** GPU'nun adı: küçük bir bağlam açılıp sürücüye soruluyor, hemen bırakılıyor. */
function gpuAdi(): string {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    if (!gl) return 'WebGL yok';
    // Uzantı adları küçük harfle (büyük/küçük ayırt edilmiyor): büyük harfli
    // ad çevrilecek metin sanılıyor.
    const e = gl.getExtension('webgl_debug_renderer_info');
    const ad = String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('webgl_lose_context')?.loseContext();
    return ad;
  } catch {
    return '?';
  }
}

const ms = (x: number) => `${Math.round(x)} ms`;

function cihaz() {
  const n = navigator as Navigator & { deviceMemory?: number };
  return {
    gpu: gpuAdi(),
    gpuYolu: glVarMi(),
    ekran: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}`,
    cekirdek: n.hardwareConcurrency,
    bellek: n.deviceMemory,
    tarayici: navigator.userAgent,
  };
}

const saniye = (x: number) => `${(x / 1000).toFixed(1)} sn`;
const mb = (x: number | undefined) =>
  x === undefined ? '?' : x >= 1e9 ? `${(x / 1e9).toFixed(1)} GB` : `${Math.round(x / 1e6)} MB`;

/**
 * Cihaz kaydının durumu tek satırda (`kalici.ts`): "Kayıttan: 0" ise
 * nedeni burada — depo açılmadı mı, kayıt yazılamadı mı, sürüm mü değişti.
 */
function depoSatiri(d: KaliciDurum | null): string {
  if (!d) return 'Cihaz kaydı: ?';
  if (!d.acik) return `Cihaz kaydı: açılamadı${d.sonHata ? ` (${d.sonHata})` : ''}`;
  return (
    `Cihaz kaydı: sürüm ${d.surum} · ${d.kayit} kayıt (${d.guncel} bu sürümün)` +
    ` · okundu ${d.okunan}, bulunamadı ${d.yok}, eski sürüm ${d.eski}` +
    ` · yazıldı ${d.yazilan}, yazılamadı ${d.yazmaHatasi}${d.sonHata ? ` (${d.sonHata})` : ''}` +
    ` · kalıcı ${d.kalici === undefined ? '?' : d.kalici ? 'evet' : 'hayır'}` +
    ` · ${mb(d.kullanim)} / ${mb(d.kota)}`
  );
}

/** Şehrin ortam katmanı nasıl oynuyor (docs/24 "Ortam tuvali"). */
function ortamSatiri(): string {
  if (document.querySelector('.ortam-tuvali')) return 'Ortam katmanı: tuval (işçide)';
  if (document.querySelector('.hareket-su, .hareket-cimen, .hareket-isik'))
    return 'Ortam katmanı: CSS katmanları';
  return 'Ortam katmanı: yok';
}
const yuzde = (x: number) => `%${(x * 100).toFixed(1).replace('.', ',')}`;

function takilmaSatiri(t: EkranTakilmasi): string {
  return (
    `${t.ekran}: ${t.kare} kare, ${t.takilma} takılma (${yuzde(t.oran)}), en uzun ${ms(t.enUzunKare)}` +
    ` · uzun görev ${t.gorev} (${ms(t.gorevToplam)})`
  );
}

function rapor(
  kayitlar: readonly CizimKaydi[],
  takilma: EkranTakilmasi[],
  c: ReturnType<typeof cihaz>,
  depo: KaliciDurum | null,
): string {
  const o = ozet(kayitlar);
  const sonTakilmalar = [...takilmalar()].reverse().slice(0, 40);
  // En uzunlar ayrıca: son kırkın dışında kalan büyük takılma kaybolmasın.
  const enUzunlar = [...takilmalar()].sort((a, b) => b.sure - a.sure).slice(0, 15);
  const takilmaYazisi = (t: (typeof sonTakilmalar)[number]) =>
    `${t.ekran} · ${t.tur === 'kare' ? 'kare' : 'görev'} ${ms(t.sure)} · ${saniye(t.an)}` +
    (t.neden ? ` · ${t.neden}` : '');
  const satir = (ad: string, g: ReturnType<typeof ozet>['cizim']) =>
    `${ad}: ${g.sayi}, ortalama ${ms(g.ortalama)} (çizimde ${ms(g.cizimOrtalama)}), en uzun ${ms(g.enUzun)}`;
  const temizlendi = temizlenmeAni();
  return [
    'Lordlar Çağı — çizim ölçümü',
    `Tarayıcı: ${c.tarayici}`,
    `Ekran: ${c.ekran} · çekirdek ${c.cekirdek ?? '?'} · bellek ${c.bellek ?? '?'} GB`,
    `GPU: ${c.gpu} · GPU yolu ${c.gpuYolu ? 'açık' : 'kapalı (SVG)'}`,
    // Temizlenmişse sayılar o andan sonrası: önceki çizimler raporda yok.
    ...(temizlendi === null ? [] : [`Temizlendi: ${saniye(temizlendi)} (rapor bundan sonrası)`]),
    satir('Kayıttan', o.kayit),
    satir('Çizim', o.cizim),
    satir('Taslak', o.taslak),
    `Kesilme: ${o.kesilme}`,
    depoSatiri(depo),
    ortamSatiri(),
    `Takılma (${KARE_ESIGI} ms'yi aşan kare, uzun görev), ekran ekran:`,
    ...takilma.map(takilmaSatiri),
    'En uzun takılmalar:',
    ...enUzunlar.map(takilmaYazisi),
    `Ekran geçişleri: ${ekranGecisleri()
      .map((g) => `${g.ekran} ${saniye(g.an)}`)
      .join(' · ')}`,
    'Son takılmalar (en yenisi üstte):',
    ...sonTakilmalar.map(takilmaYazisi),
    'Son çizimler (en yenisi üstte):',
    ...[...kayitlar]
      .reverse()
      .slice(0, 60)
      .map(
        (k) =>
          `${kisaAd(k.anahtar)} · ${KAYNAK[k.kaynak]}${k.taslak ? ' (taslak)' : ''} · ${ms(k.toplam)}` +
          ` (çizimde ${ms(k.cizim)})${k.kesilme ? ` · ${k.kesilme} kez kesildi` : ''}` +
          // Takılmalarla aynı saat: hangi çizim sürerken takıldığı okunsun.
          ` · ${saniye(k.bitti - k.toplam)}–${saniye(k.bitti)}` +
          (k.evreler && k.cizim >= EVRE_ESIGI ? `\n  aşamalar: ${evreSatiri(k.evreler)}` : ''),
      ),
  ].join('\n');
}

/**
 * Bundan uzun süren çizimin aşamaları da yazılıyor (ms). Dördüncü raporda
 * ekran zemininin 395 ms'lik taslağı aşamasız kaldı; taslakların tek GPU
 * işi telefonu 244–409 ms bekletiyordu.
 */
const EVRE_ESIGI = 300;

/** Aşamaların okunur adları, çizim sırasıyla (`CizimSonucu.evreler`). */
const EVRE_ADI: [string, string][] = [
  ['hazirlik', 'hazırlık'],
  ['golge', 'gölge'],
  ['yukleme', 'gölge ve yükleme (GPU)'],
  ['ana', 'ana geçiş'],
  ['coz', 'kenar ve çözme'],
  ['png', 'bulanıklık ve PNG'],
  ['katman', 'katmanlar'],
  ['kareKur', 'kare geometrisi'],
  ['atlasCiz', 'canlı kareler: çizim'],
  ['atlasCoz', 'çözme'],
  ['atlasPng', 'kare PNG'],
  // Tek seferde GPU'ya giden en uzun iş: ekran en çok bu kadar bekledi.
  ['enUzunDurak', 'en uzun GPU işi'],
  // Tek satırlık şeridin süresi: geometri ve GPU'nun sırası (`seritle`).
  ['seritSabiti', 'şerit sabiti'],
];

function evreSatiri(e: Record<string, number>): string {
  // Şeritsiz (küçük) çizimde GPU beklenmiyor: "en uzun GPU işi 0 ms" ölçülmedi demek.
  return EVRE_ADI.filter(([k]) => e[k] !== undefined && !(k === 'enUzunDurak' && !e[k]))
    .map(
      ([k, ad]) =>
        `${ad} ${ms(e[k]!)}${k === 'atlasCiz' && e.atlasKare ? ` (${e.atlasKare} kare)` : ''}`,
    )
    .join(' · ');
}

const KAYNAK: Record<CizimKaydi['kaynak'], string> = {
  kayit: 'kayıttan',
  cizim: 'çizildi',
  yok: 'gelmedi',
};

export function CizimOlcumPaneli() {
  const [, yenile] = useState(0);
  const [acikMi, setAcikMi] = useState(false);
  const [gorunur, setGorunur] = useState(true);
  const [kopyaDurumu, setKopyaDurumu] = useState<'yok' | 'oldu' | 'olmadi'>('yok');
  useEffect(() => olcumuDinle(() => yenile((n) => n + 1)), []);
  useEffect(takilmaIzle, []);
  // Cihaz bilgisi bir kez (GPU'ya sormak bir bağlam açıyor).
  const c = useMemo(cihaz, []);
  // Cihaz kaydı açılışta ve pano açıkken birkaç saniyede bir.
  const [depo, setDepo] = useState<KaliciDurum | null>(null);
  useEffect(() => {
    let bitti = false;
    const al = () => void kaliciDurumu().then((d) => !bitti && setDepo(d));
    al();
    const z = acikMi ? setInterval(al, 5000) : undefined;
    return () => {
      bitti = true;
      clearInterval(z);
    };
  }, [acikMi]);
  if (!gorunur) return null;
  const kayitlar = olcumKayitlari();
  const o = ozet(kayitlar);
  const takilma = takilmaOzeti(takilmalar(), izlenenKareler());
  const takilmaSayisi = takilma.reduce((a, t) => a + t.takilma + t.gorev, 0);
  const metin = rapor(kayitlar, takilma, c, depo);

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(metin);
      setKopyaDurumu('oldu');
    } catch {
      // Güvenli olmayan bağlam ya da izin yok: metin aşağıda seçilebilir duruyor.
      setKopyaDurumu('olmadi');
    }
  };

  return (
    <div
      className="fixed left-2 z-[70] max-w-[calc(100vw-16px)] rounded-xl border border-kenar bg-gece/95 text-[12px] text-parsomen shadow-lg"
      style={{ bottom: 'calc(var(--alt-bar) + var(--omurga-serit) + 8px)' }}
      data-cizim-olcumu=""
    >
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left"
        aria-expanded={acikMi}
        onClick={() => setAcikMi((a) => !a)}
      >
        <span className="font-bold text-altin">Ölçüm</span>
        <span className="tabular text-solgun">
          {`${o.cizim.sayi} çizim · ort ${ms(o.cizim.ortalama)} · en uzun ${ms(o.cizim.enUzun)} · takılma ${takilmaSayisi}`}
        </span>
      </button>
      {acikMi && (
        <div className="max-h-[60vh] w-[min(360px,calc(100vw-16px))] overflow-auto border-t border-kenar px-3 py-2">
          <p className="text-solgun">{`GPU: ${c.gpu}`}</p>
          <p className="text-solgun">
            {`${c.ekran} · çekirdek ${c.cekirdek ?? '?'} · GPU yolu ${c.gpuYolu ? 'açık' : 'kapalı'}`}
          </p>
          {!c.gpuYolu && (
            <p className="mt-1 text-turuncu">
              GPU yolu kapalı: çizimler eski yoldan (SVG) yapılıyor, burada ölçülmüyor.
            </p>
          )}
          <ul className="tabular mt-2 space-y-0.5">
            <li>{`Kayıttan: ${o.kayit.sayi} · ort ${ms(o.kayit.ortalama)}`}</li>
            <li>{`Çizim: ${o.cizim.sayi} · ort ${ms(o.cizim.ortalama)} · en uzun ${ms(o.cizim.enUzun)}`}</li>
            <li>{`Taslak: ${o.taslak.sayi} · ort ${ms(o.taslak.ortalama)}`}</li>
            <li>{`Kesilme: ${o.kesilme}`}</li>
            <li>{depoSatiri(depo)}</li>
          </ul>
          <p className="mt-2 font-bold text-altin">Takılma</p>
          <ul className="tabular space-y-0.5">
            {takilma.length === 0 && <li className="text-solgun">Henüz yok.</li>}
            {takilma.map((t) => (
              <li key={t.ekran}>{takilmaSatiri(t)}</li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-[44px] rounded-lg bg-altin px-3 font-bold text-gece"
              onClick={() => void kopyala()}
            >
              Kopyala
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-kenar px-3"
              onClick={olcumuTemizle}
            >
              Temizle
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-kenar px-3"
              onClick={() => {
                olcumuKapat();
                setGorunur(false);
              }}
            >
              Ölçümü kapat
            </button>
          </div>
          {kopyaDurumu === 'oldu' && <p className="mt-1 text-yesil">Kopyalandı.</p>}
          {kopyaDurumu === 'olmadi' && (
            <p className="mt-1 text-turuncu">Kopyalanamadı; aşağıdaki metni seçip kopyala.</p>
          )}
          <textarea
            readOnly
            aria-label="Ölçüm raporu"
            className="tabular mt-2 h-40 w-full rounded-lg border border-kenar bg-derin p-2 text-[11px] text-parsomen"
            value={metin}
          />
        </div>
      )}
    </div>
  );
}
