/**
 * Ordu sahnesi — lordun arkasındaki kalabalık.
 *
 * Oyuncu: *"lord kısmında oyuncu kendi lordunu görse ve kendi karakterinin
 * arkasında ordusunu görse."* Bu, o isteğin ordu yarısı. Lord figürü için
 * ayrı bir görsel gerekiyor (bkz. docs/08 İ12); ordu ise elimizdeki beş
 * birim illüstrasyonuyla, hiç yeni görsel olmadan çizilebiliyor.
 *
 * Neden değerli: Kışla'da "okçu 42" yazısı bir satır. Burada kırk iki
 * okçunun oluşturduğu kalabalık bir ŞEY. Ordu büyüdükçe sahne doluyor,
 * bileşim değiştikçe sahnenin görüntüsü değişiyor. Oyuncunun ilk oturumda
 * "asker ürettim, eee ne oldu" dediği yerin karşılığı bu.
 */
import {
  UNIT_TYPES,
  armySlots,
  kusamSeviyesi,
  unit,
  unitName,
  type Army,
  type UnitType,
} from '@lordlar/shared';
import { useEffect, useRef, useState } from 'react';
import { Gorsel } from './Gorsel';
import { BirimIkonu } from './Ikonlar';

/**
 * Sahnede çizilecek toplam figür sayısı.
 *
 * Bin milis çizilemez ve çizilse okunmaz. Sabit bir bütçe ordunun
 * BİLEŞİMİNİ gösteriyor ("ordum çoğunlukla okçu"), sayıyı değil — sayı
 * zaten altındaki şeritte yazıyor.
 */
const BUTCE = 13;

/**
 * Arkadan öne üç sıra; her sıranın ölçeği, dikey yeri ve solgunluğu.
 *
 * Derinlik payı ölçülü: ilk denemede arka sıra %55 opaklık ve 1.2px
 * bulanıklıktaydı ve süvari orada tamamen kayboluyordu — ordunun en
 * etkileyici birimi görünmez oluyordu. Derinlik hissi için bu kadarı
 * yetiyor, fazlası bilgi siliyor.
 */
const SIRALAR = [
  { olcek: 0.66, alt: 42, opak: 0.72, bulanik: 0.7, kayma: -20 },
  { olcek: 0.83, alt: 20, opak: 0.88, bulanik: 0.25, kayma: 16 },
  { olcek: 1, alt: 0, opak: 1, bulanik: 0, kayma: 0 },
];

/** Ön sıradaki figürün yüksekliği; arka sıralar bunun ölçeğiyle küçülür. */
const FIGUR_BOYU = 132;

/**
 * Ordu bileşimini figür sayılarına çevirir.
 *
 * Ağırlık adet değil KOMUTA YERİ (`yer`): bir süvari üç, bir mancınık beş
 * milis kadar yer tutuyor. Sahnede de öyle görünmeli — yoksa beş mancınığı
 * olan bir oyuncunun sahnesi neredeyse boş kalırdı.
 *
 * Var olan her birimden en az bir figür çizilir: "üç süvarim var" bilgisi,
 * oranı küçük diye kaybolmamalı.
 */
function figurDagilimi(army: Army): { tur: UnitType; adet: number }[] {
  const varOlan = UNIT_TYPES.filter((t) => (army[t] ?? 0) > 0);
  if (varOlan.length === 0) return [];

  const agirlik = varOlan.map((t) => (army[t] ?? 0) * unit(t).yer);
  const toplam = agirlik.reduce((a, b) => a + b, 0);

  // Önce herkese bir figür, kalanı ağırlığa göre dağıt.
  const kalan = Math.max(0, BUTCE - varOlan.length);
  const pay = agirlik.map((a) => (a / toplam) * kalan);

  // Tam sayıya inerken artıkları en büyükten dağıtıyoruz; aşağı yuvarlamak
  // bütçenin bir kısmını boşa harcıyordu.
  const taban = pay.map(Math.floor);
  const artik = pay
    .map((p, i) => ({ i, fark: p - taban[i]! }))
    .sort((a, b) => b.fark - a.fark);
  let eksik = kalan - taban.reduce((a, b) => a + b, 0);
  for (const { i } of artik) {
    if (eksik <= 0) break;
    taban[i]!++;
    eksik--;
  }

  return varOlan.map((t, i) => ({ tur: t, adet: 1 + taban[i]! }));
}

/**
 * Figürleri sıralara dağıtır.
 *
 * Sıralar SIRAYLA değil DÖNÜŞÜMLÜ dolduruluyor. İlkinde sırayla
 * dolduruluyordu ve sonuç yanlış bir tablo veriyordu: 18 milis + 6 okçuluk
 * bir orduda milisler diziye önce girdiği için arka sıralara düşüyor, ön
 * sıra baştan sona okçu oluyordu. Oyuncu ordusuna bakıp "okçu ordusu"
 * görüyordu, oysa üçte biri okçu.
 *
 * Dizi önce `yer` değerine göre büyükten küçüğe sıralanıyor, sonra
 * 0,1,2,0,1,2… diye dağıtılıyor: hem her sıra ordunun bileşimini yansıtan
 * bir karışım alıyor, hem büyük birimler sıralara yayılıyor.
 */
function sahneyeDiz(dagilim: { tur: UnitType; adet: number }[]) {
  const figurler = dagilim
    .flatMap(({ tur, adet }) => Array.from({ length: adet }, () => tur))
    .sort((a, b) => unit(b).yer - unit(a).yer);

  const kovalar: UnitType[][] = [[], [], []];
  figurler.forEach((t, i) => kovalar[i % 3]!.push(t));

  return SIRALAR.map((sira, s) => ({ ...sira, birimler: kovalar[s]! }));
}

/**
 * Savaş naarası.
 *
 * Ekrana girince bir kez, sonra sahneye her dokunuşta tetiklenir. Tek bir
 * durum değişkeni yetiyor: `naara` sayacı artınca CSS animasyonları
 * yeniden başlıyor (key değişimiyle), süre dolunca sıfırlanmıyor —
 * animasyonlar kendi kendine bitiyor.
 *
 * `prefers-reduced-motion` saygı görüyor: hareket kısıtlıysa naara hiç
 * tetiklenmiyor. Bu bir süs değil erişilebilirlik gereği — sarsılan ekran
 * baş dönmesi yapabiliyor.
 */
function useNaara() {
  const [naara, setNaara] = useState(0);
  const kisitli = useRef(false);

  useEffect(() => {
    kisitli.current =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (kisitli.current) return;
    // Girişte kısa bir gecikme: sahne önce yerleşsin, sonra naara gelsin.
    const id = setTimeout(() => setNaara((n) => n + 1), 420);
    return () => clearTimeout(id);
  }, []);

  return {
    naara,
    naaraAt: () => {
      if (!kisitli.current) setNaara((n) => n + 1);
    },
  };
}

export function OrduSahnesi({
  army,
  komutaTavani,
  kusanilan,
}: {
  army: Army;
  komutaTavani: number;
  /** Lord figürünü ve savurulan silahı seçer. */
  kusanilan: { slot: string; tier: number }[];
}) {
  const dagilim = figurDagilimi(army);
  const kullanilan = armySlots(army);
  const siralar = sahneyeDiz(dagilim);
  const seviye = kusamSeviyesi(kusanilan);
  const silah = kusanilan.find((i) => i.slot === 'silah');
  const { naara, naaraAt } = useNaara();

  return (
    <div
      onClick={naaraAt}
      role="img"
      aria-label={`Ordun: ${kullanilan}/${komutaTavani} komuta yeri dolu`}
      key={naara}
      className={`sahne relative -mx-3 h-[172px] overflow-hidden ${naara > 0 ? 'sahne-naara' : ''}`}
      style={{
        background:
          'linear-gradient(180deg, var(--color-derin) 0%, #2b1f17 55%, #241a13 100%)',
      }}
    >
      {/* Zemin şeridi — figürler havada durmasın. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[70px]"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.45))' }}
      />

      {dagilim.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 pb-6 text-center">
          <span className="baslik text-[13px] text-solgun">Ordun yok</span>
          <span className="text-[11px] text-sonuk">Kışla'da asker eğit, burası dolsun.</span>
        </div>
      ) : (
        siralar.map((sira, s) => (
          // kayma: sıralar yatayda kaydırılmasa hepsi ortalandığı için
          // figürler üst üste hizalanıyor ve kalabalık değil, aynı figürün
          // çift basılmış hali gibi görünüyor.
          <div
            key={s}
            className="absolute inset-x-0"
            style={{ bottom: sira.alt, transform: `translateX(${sira.kayma}px)` }}
          >
            <div className="flex items-end justify-center">
              {sira.birimler.map((tur, i) => (
                <div
                  key={`${tur}-${i}`}
                  className="figur"
                  // Negatif kenar boşluğu bilerek: figürler hafif üst üste
                  // binince sıra bir kalabalık gibi okunuyor, dizilmiş
                  // ikonlar gibi değil.
                  //
                  // Gecikme sıraya ve yere göre: ordu tek parça zıplamıyor,
                  // arkadan öne bir dalga geçiyor. Naara o dalgayla okunuyor.
                  //
                  // Gecikmeler kısa: ilk denemede sıra başına 90ms, figür
                  // başına 45ms verilmişti ve sahnenin dolması ~900ms
                  // sürüyordu — ekrana girip yarım saniye boş bir alana
                  // bakmak, animasyonun kazandırdığından fazlasını
                  // kaybettiriyor.
                  style={{
                    marginLeft: i === 0 ? 0 : -26 * sira.olcek,
                    opacity: sira.opak,
                    filter: sira.bulanik ? `blur(${sira.bulanik}px)` : undefined,
                    animationDelay: `${s * 60 + i * 25}ms`,
                  }}
                >
                  <Gorsel
                    tur="birimler"
                    ad={tur}
                    alt={unitName(tur)}
                    boyut={Math.round(FIGUR_BOYU * sira.olcek)}
                    yedek={
                      <span className="text-solgun">
                        <BirimIkonu tip={tur} boyut={Math.round(40 * sira.olcek)} />
                      </span>
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Lord — ordunun önünde, hafif sağda. Görseli yoksa hiçbir şey
          çizilmiyor: yerine bir siluet koymak, olmayan bir şeyi varmış gibi
          göstermek olurdu. (docs/08 İ13) */}
      <div className="lord absolute bottom-0 left-1/2 -translate-x-1/2">
        <Gorsel
          tur="lord"
          ad={`lord_${seviye}`}
          alt={`Lordun — kuşam ${seviye}`}
          boyut={168}
          className="h-[168px] w-auto"
          yedek={<></>}
        />
      </div>

      {/* Savurulan silah: oyuncunun GERÇEKTEN kuşandığı kılıç. Ayrı bir
          animasyon karesi gerekmiyor, elimizdeki ikonu yayla geçiriyoruz. */}
      {silah && (
        <div className="savurma pointer-events-none absolute bottom-[26px] left-1/2">
          <Gorsel
            tur="ekipman"
            ad={`${silah.slot}_t${silah.tier}`}
            alt=""
            boyut={96}
            yedek={<></>}
          />
        </div>
      )}

      {/* Alt şerit: sahnenin söylemediği tek şey, gerçek sayılar. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gece via-gece/85 to-transparent px-3 pt-4 pb-1.5">
        <div className="flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
            {UNIT_TYPES.filter((t) => (army[t] ?? 0) > 0).map((t) => (
              <span key={t} className="flex shrink-0 items-center gap-1 text-[11px]">
                <span className="text-solgun">
                  <BirimIkonu tip={t} boyut={12} />
                </span>
                <span className="tabular font-bold text-parsomen">{army[t]}</span>
              </span>
            ))}
          </div>
          <span className="tabular shrink-0 text-[11px] text-solgun">
            {kullanilan}/{komutaTavani} komuta
          </span>
        </div>
      </div>
    </div>
  );
}
