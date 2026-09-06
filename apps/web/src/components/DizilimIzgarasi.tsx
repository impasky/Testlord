/**
 * 4x4 savaş dizilimi — sürükle-bırak.
 *
 * Neden hem SÜRÜKLE hem DOKUN-DOKUN: telefonda 4x4 ızgaraya parmakla
 * sürüklemek küçük hedeflerde zor, üstelik HTML5 drag-and-drop mobil
 * tarayıcılarda çalışmıyor. Sürükleme Pointer Events ile elde yazıldı
 * (her yerde çalışıyor), ama tek dokunuş da bir birimi seçiyor ve ikinci
 * dokunuş kareye koyuyor. İkisi aynı state'i kullanıyor: sürüklemeyi
 * beceremeyen oyuncu yine de dizilim yapabilsin.
 *
 * Ekranın kendisi bir ÖĞRETMEN: satır etiketleri (ÖN HAT / ARKA) ve
 * canlı etki satırı, oyuncunun mancınığı öne koyduğu anda ne kaybettiğini
 * savaş bitmeden göstersin diye var. Ceza ancak görülebiliyorsa öğretir.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  B,
  KARE_SAYISI,
  UNIT_TYPES,
  birimKareleri,
  dizilimEtkisi,
  kareSatiri,
  kareyeDusenAdet,
  kanattaMi,
  taktikDurumlari,
  unitName,
  varsayilanDizilim,
  type Army,
  type Dizilim,
  type UnitType,
} from '@lordlar/shared';
import { Gorsel } from './Gorsel';
import { BirimIkonu } from './Ikonlar';
import { Buton, Kart } from './ui';
import { hisOnay, hisRet } from './hisGeriBildirimi';

/**
 * Kaç piksel oynayınca "sürükleme" sayılır.
 *
 * Parmak hiçbir zaman tam sabit durmuyor; eşiksiz her dokunuş sürükleme
 * sayılırdı. Sekiz piksel, kasıtsız titremeyi eleyip kasıtlı hareketi
 * geçiren aralık.
 */
const HAREKET_ESIGI = 8;

const SATIR = B.dizilim.satir;
const SUTUN = B.dizilim.sutun;

/** Satır adları: oyuncu "2. satır" değil "ön hat" diye düşünüyor. */
const SATIR_ADI: Record<number, string> = {
  1: 'ÖN HAT',
  2: 'İKİNCİ',
  3: 'ÜÇÜNCÜ',
  4: 'ARKA',
};

function yuzde(x: number): string {
  const n = Math.round(x * 100);
  return `${n > 0 ? '+' : ''}%${Math.abs(n)}`;
}

export function DizilimIzgarasi({
  ordu,
  dizilim,
  taktik,
  onDegis,
  baslik = 'Dizilim',
}: {
  ordu: Army;
  dizilim: Dizilim;
  taktik: string | null;
  onDegis: (d: Dizilim, taktik: string | null) => void;
  baslik?: string;
}) {
  const [tutulan, setTutulan] = useState<UnitType | null>(null);
  /** Sürükleme sırasında parmağın üstünde durduğu kare. */
  const [hedefKare, setHedefKare] = useState<number | null>(null);
  const izgaraRef = useRef<HTMLDivElement>(null);
  /**
   * Basış NEREDE başladı: havuz rozetinde mi, bir karede mi, hiçbirinde mi.
   *
   * Bu ayrım olmadan SAYFAYI KAYDIRMAK sürükleme sayılıyordu: parmak
   * ekranın herhangi bir yerinden aşağı kayınca pointermove ateşleniyor,
   * pointerup ızgaranın dışına düşüyor ve seçim iptal ediliyordu.
   * Oyuncunun sözü: "okçu seçip ekranı aşağı kaydırınca seçim gidiyor."
   *
   * Daha kötüsü: parmak ızgaranın ÜSTÜNDEN kayarak kalkarsa birim
   * rastgele bir kareye yerleşiyordu. Kaydırma bir niyet değil; hiçbir
   * şey yapmamalı.
   */
  const basimNerede = useRef<'havuz' | 'kare' | null>(null);
  /** Basışın başladığı nokta; hareket eşiğini ölçmek için. */
  const basimNoktasi = useRef<{ x: number; y: number } | null>(null);
  const surukluyor = useRef(false);
  /**
   * pointerdown ANINDAKİ seçim.
   *
   * Tek dokunuşta olaylar pointerdown -> pointerup -> click sırasıyla
   * geliyor. Seçimi hem pointerdown'da hem click'te yönetmek, dokunuşun
   * kendi seçimini iptal etmesine yol açıyordu: pointerdown seçiyor,
   * click "zaten seçiliydi" deyip geri bırakıyordu. Artık tek karar
   * pointerup'ta veriliyor ve karşılaştırma bu ref'e göre yapılıyor.
   */
  const oncekiSecim = useRef<UnitType | null>(null);

  const eldeki = useMemo(() => UNIT_TYPES.filter((t) => (ordu[t] ?? 0) > 0), [ordu]);
  const etki = useMemo(() => dizilimEtkisi(dizilim, ordu), [dizilim, ordu]);
  const taktikler = useMemo(() => taktikDurumlari(ordu, dizilim), [ordu, dizilim]);

  // Seçili taktiğin koşulu dizilim değişince bozulabilir: kareyi
  // oynatınca sessizce etkisiz kalan bir taktik, oyuncuya sebebini
  // söylemeden gücünü alırdı.
  useEffect(() => {
    if (!taktik) return;
    const d = taktikler.find((x) => x.key === taktik);
    if (d && !d.uygun) onDegis(dizilim, null);
    // Bağımlılıkta onDegis YOK: her renderda yeni bir işlev geliyor,
    // listeye koymak sonsuz döngü kurardı.
  }, [taktik, taktikler]);

  function kareyeKoy(indeks: number, birim: UnitType | null) {
    const yeni = [...dizilim];
    yeni[indeks] = birim;
    onDegis(yeni, taktik);
  }

  /** Parmağın altındaki kareyi ekran koordinatından bulur. */
  function kareBul(x: number, y: number): number | null {
    const kok = izgaraRef.current;
    if (!kok) return null;
    const hucreler = kok.querySelectorAll('[data-kare]');
    for (const h of hucreler) {
      const r = h.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return Number((h as HTMLElement).dataset.kare);
      }
    }
    return null;
  }

  /**
   * BÜTÜN yerleştirme mantığı tek dinleyicide: pencerenin pointerup'ı.
   *
   * İki tur hata buradan çıktı ve ikisi de aynı sebeptendi — aynı işi iki
   * yerde yapmak:
   *  - İlk hâl `setPointerCapture` kullanıyordu. Masaüstünde çalıştı,
   *    dokunmatik öykünmesinde yakalama uygulanmayınca pointermove
   *    parmağın altındaki kareye gitti, kaynak düğme haber almadı ve
   *    sürükleme sessizce "dokunuş" sayıldı.
   *  - İkinci hâlde hem pencere pointerup hem karenin onClick'i vardı:
   *    pointerup birimi koyuyor, hemen ardından gelen click "dolu kareye
   *    dokunuldu" deyip siliyordu. Dokun-dokun hiç çalışmıyor gibiydi.
   *
   * Artık tek karar noktası burası. Sürükleme ile dokun-dokun aynı kodu
   * paylaşıyor: parmak nerede kalktıysa iş orada oluyor.
   */
  useEffect(() => {
    const tasi = (e: PointerEvent) => {
      // Basış havuzda başlamadıysa bu bir SÜRÜKLEME değil, kaydırmadır.
      if (basimNerede.current !== 'havuz') return;
      const b = basimNoktasi.current;
      if (b && Math.hypot(e.clientX - b.x, e.clientY - b.y) < HAREKET_ESIGI) return;
      surukluyor.current = true;
      setHedefKare(kareBul(e.clientX, e.clientY));
    };
    const birak = (e: PointerEvent) => {
      const nerede = basimNerede.current;
      const hedef = kareBul(e.clientX, e.clientY);
      const b = basimNoktasi.current;
      const oynadi = b ? Math.hypot(e.clientX - b.x, e.clientY - b.y) >= HAREKET_ESIGI : false;

      if (nerede === 'havuz' && surukluyor.current && hedef !== null && tutulan) {
        // Havuzdan sürükleyip kareye bıraktı.
        kareyeKoy(hedef, tutulan);
        hisOnay();
        setTutulan(null);
      } else if (nerede === 'havuz' && surukluyor.current) {
        // Sürükledi ama ızgara dışına bıraktı: seçim düşsün.
        setTutulan(null);
        hisRet();
      } else if (nerede === 'kare' && !oynadi && hedef !== null) {
        // Kareye DOKUNDU (kaydırmadı): elindekini koy ya da kareyi boşalt.
        if (tutulan) {
          kareyeKoy(hedef, tutulan);
          hisOnay();
          setTutulan(null);
        } else if (dizilim[hedef]) {
          kareyeKoy(hedef, null);
          hisRet();
        }
      }
      // nerede === null: basış havuzda da karede de başlamadı — sayfa
      // kaydırılıyor. Hiçbir şey yapma, SEÇİMİ DE BOZMA.

      setHedefKare(null);
      surukluyor.current = false;
      basimNerede.current = null;
      basimNoktasi.current = null;
    };
    window.addEventListener('pointermove', tasi);
    window.addEventListener('pointerup', birak);
    window.addEventListener('pointercancel', birak);
    return () => {
      window.removeEventListener('pointermove', tasi);
      window.removeEventListener('pointerup', birak);
      window.removeEventListener('pointercancel', birak);
    };
    // Bağımlılıkta kareyeKoy YOK: her renderda yeni bir işlev geliyor,
    // listeye koymak dinleyiciyi her karede yeniden kurar ve sürükleme
    // durumunu ortasında sıfırlardı.
  }, [tutulan, dizilim, taktik]);

  function tutmayaBasla(birim: UnitType, e: React.PointerEvent) {
    e.preventDefault();
    oncekiSecim.current = tutulan;
    surukluyor.current = false;
    basimNerede.current = 'havuz';
    basimNoktasi.current = { x: e.clientX, y: e.clientY };
    setTutulan(tutulan === birim ? null : birim);
  }

  /** Karenin üstünde başlayan basış. Kaydırmadan ayırt etmek için. */
  function kareyeBasla(e: React.PointerEvent) {
    basimNerede.current = 'kare';
    basimNoktasi.current = { x: e.clientX, y: e.clientY };
    surukluyor.current = false;
  }

  /** Parmağın altındaki kareyi ekran koordinatından bulur. */
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="baslik text-[11px] text-solgun">{baslik}</h3>
        <button
          type="button"
          className="text-[11px] text-altin underline underline-offset-2"
          onClick={() => {
            onDegis(varsayilanDizilim(ordu), taktik);
            hisOnay();
          }}
        >
          Önerilen düzen
        </button>
      </div>

      {/* Havuz: orduda olan birimler. Tutulan birim vurgulanıyor. */}
      <div className="flex flex-wrap gap-1.5">
        {eldeki.length === 0 && (
          <p className="text-[12px] text-solgun">Evde ordun yok — önce Kışla'da asker eğit.</p>
        )}
        {eldeki.map((t) => {
          const kareSayisi = dizilim.filter((k) => k === t).length;
          const secili = tutulan === t;
          return (
            <button
              key={t}
              type="button"
              data-birim={t}
              onPointerDown={(e) => tutmayaBasla(t, e)}
              className={`flex touch-none items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] transition ${
                secili
                  ? 'border-altin bg-altin/15 text-altin'
                  : 'border-cerceve bg-koyu2 text-metin'
              }`}
            >
              <Gorsel
                tur="birimler"
                ad={t}
                alt={unitName(t)}
                boyut={20}
                yedek={<BirimIkonu tip={t} boyut={20} />}
              />
              <span>{unitName(t)}</span>
              <span className="text-solgun">{ordu[t]}</span>
              {kareSayisi > 0 && (
                <span className="rounded bg-altin/20 px-1 text-[10px] text-altin">
                  {kareSayisi} kare
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* İpucu satırı HER ZAMAN yer kaplıyor, yalnız içeriği değişiyor.
          Koşullu render ederken birim seçilir seçilmez ızgara aşağı
          kayıyordu: parmak sürüklerken hedef karenin yeri değişiyor ve
          bırakma yanlış kareye düşüyordu. Zemin oynamamalı. */}
      <p className="min-h-[30px] text-[11px] leading-snug text-altin">
        {tutulan
          ? `${unitName(tutulan)} elinde — bir kareye sürükle ya da dokun. Dolu kareye elin boşken dokunursan boşalır.`
          : '\u00a0'}
      </p>

      {/* Izgara. Satır etiketi solda: "3. kare" demek bir şey ifade
          etmiyor, "ön hat" ediyor. */}
      <div ref={izgaraRef} className="flex gap-1.5">
        <div className="flex flex-col justify-around pr-0.5">
          {Array.from({ length: SATIR }, (_, s) => (
            <span key={s} className="baslik text-[9px] leading-none text-solgun">
              {SATIR_ADI[s + 1]}
            </span>
          ))}
        </div>
        <div
          className="grid flex-1 gap-1.5"
          style={{ gridTemplateColumns: `repeat(${SUTUN}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: KARE_SAYISI }, (_, i) => {
            const birim = dizilim[i] ?? null;
            const vurgu = hedefKare === i;
            const kanat = kanattaMi(i);
            return (
              <button
                key={i}
                type="button"
                data-kare={i}
                onPointerDown={kareyeBasla}
                className={`relative flex aspect-square touch-none flex-col items-center justify-center rounded-lg border text-[9px] transition ${
                  vurgu
                    ? 'border-altin bg-altin/20'
                    : birim
                      ? 'border-cerceve bg-koyu2'
                      : 'border-dashed border-cerceve/60 bg-koyu/40'
                }`}
                aria-label={`${kareSatiri(i)}. satır, ${i + 1}. kare${birim ? `, ${unitName(birim)}` : ', boş'}`}
              >
                {kanat && (
                  <span className="absolute right-0.5 top-0.5 text-[8px] text-solgun">⚑</span>
                )}
                {birim ? (
                  <>
                    <Gorsel
                      tur="birimler"
                      ad={birim}
                      alt={unitName(birim)}
                      boyut={22}
                      yedek={<BirimIkonu tip={birim} boyut={22} />}
                    />
                    <span className="mt-0.5 leading-none text-solgun">
                      {/* Artan baştaki karelere dağıtılıyor: 17 okçu iki
                          kareye bölününce 9 + 8 yazıyor, 8 + 8 değil.
                          Eski hâli 17. askeri ekrandan siliyordu. */}
                      {kareyeDusenAdet(
                        ordu[birim] ?? 0,
                        birimKareleri(dizilim, birim).length,
                        birimKareleri(dizilim, birim).indexOf(i),
                      )}
                    </span>
                  </>
                ) : (
                  <span className="text-solgun/50">{i + 1}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-solgun">⚑ kanat — süvariye yarar, okçu ve mancınığa zarar.</p>

      {/* Canlı etki: oyuncu kareyi oynatınca ne kazandığını/kaybettiğini
          savaş bitmeden görsün. */}
      <Kart className="p-2.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-solgun">Dizilimin etkisi</span>
          <span
            className={
              etki.saldiri > 0 ? 'text-yesil' : etki.saldiri < 0 ? 'text-kirmizi' : 'text-solgun'
            }
          >
            {yuzde(etki.saldiri)} saldırı · {yuzde(etki.savunma)} savunma
          </span>
        </div>
        {etki.satirlar.length > 0 && (
          <ul className="mt-1.5 space-y-1 border-t border-cerceve/50 pt-1.5">
            {etki.satirlar.map((s) => (
              <li key={s} className="text-[11px] leading-snug text-solgun">
                {s}
              </li>
            ))}
          </ul>
        )}
      </Kart>

      {/* Taktikler. Kilitli olan sebebini yazıyor: neden seçemediğini
          bilmeyen oyuncu taktik sistemini hiç öğrenemez. */}
      <div className="space-y-1.5">
        <h3 className="baslik text-[11px] text-solgun">Taktik</h3>
        {taktikler.map((t) => {
          const secili = taktik === t.key;
          return (
            <button
              key={t.key}
              type="button"
              disabled={!t.uygun}
              onClick={() => {
                onDegis(dizilim, secili ? null : t.key);
                hisOnay();
              }}
              className={`w-full rounded-lg border p-2.5 text-left transition ${
                secili
                  ? 'border-altin bg-altin/10'
                  : t.uygun
                    ? 'border-cerceve bg-koyu2'
                    : 'border-cerceve/40 bg-koyu/40 opacity-60'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-[13px] font-semibold ${secili ? 'text-altin' : 'text-metin'}`}
                >
                  {t.ad}
                </span>
                <span className="shrink-0 text-[11px] text-solgun">{t.ozet}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-solgun">
                {t.uygun ? t.aciklama : `Kilitli — ${t.engel}`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Saldırı panelinde açılıp kapanan sarmalayıcı: dizilim işi yer kaplıyor. */
export function DizilimKatlanir(props: React.ComponentProps<typeof DizilimIzgarasi>) {
  const [acik, setAcik] = useState(false);
  const etki = useMemo(() => dizilimEtkisi(props.dizilim, props.ordu), [props.dizilim, props.ordu]);
  const taktikAdi = props.taktik
    ? (taktikDurumlari(props.ordu, props.dizilim).find((t) => t.key === props.taktik)?.ad ?? null)
    : null;

  return (
    <div className="mt-3">
      <Buton tur="anahat" tam onClick={() => setAcik((a) => !a)} isaret="harita-dizilim">
        {acik ? 'Dizilimi kapat' : 'Dizilim ve taktik'}
        <span className="ml-1.5 text-[11px] text-solgun">
          {taktikAdi ? `· ${taktikAdi}` : ''} {etki.saldiri !== 0 ? `· ${yuzde(etki.saldiri)}` : ''}
        </span>
      </Buton>
      {acik && (
        <div className="mt-3">
          <DizilimIzgarasi {...props} />
        </div>
      )}
    </div>
  );
}
