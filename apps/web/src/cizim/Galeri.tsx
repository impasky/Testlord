/**
 * Çizim galerisi: koddan çizilen her görsel tek sayfada (docs/24).
 *
 * Yalnız geliştirmede açılıyor (`#/cizim-galerisi`). Çizimler burada
 * yan yana görülüp ekran görüntüsüyle denetleniyor: aynı ışık, aynı
 * palet, aynı ölçek tutuyor mu?
 *
 * Kalıcı (`kalici.ts`): çizimler cihazda, kendi `galeri` grubunda — sayfa
 * yeniden açılınca yüz yetmişi aşkın çizim yeniden çizilmiyor, oyunun
 * kayıtları da atılmıyor. Tarifi olan çizim oyundaki gibi tariften
 * (`Sahne.tarif`): GPU varken çokgen hiç kurulmuyor, model işçide. Tarifsiz
 * çizimde (galeriye özgü talim ve deneme) resim gelene kadar binlerce
 * çokgen DOM'a yazılıp siliniyordu — yeniden açılışın 4,6 sn'si oydu.
 */
import { BINA_ADLARI, BINA_KUTUSU, binaModeli } from './binalar';
import {
  BIRLIK_ADLARI,
  DUSMAN_ADLARI,
  EKIPMAN_ADLARI,
  birlikModeli,
  dusmanModeli,
  ekipmanModeli,
} from './birlikler';
import { BOLGE_KUTUSU, BOLGE_SAHNELERI, bolgeModeli } from './bolgeler';
import {
  GENERAL_ADLARI,
  LORD_ADLARI,
  PORTRE_ADLARI,
  PORTRE_KUTUSU,
  generalModeli,
  lordModeli,
  portreModeli,
} from './kisiler';
import { DIYAR_ADLARI, HARITA_KUTUSU, KAPAK_KUTUSU, diyarModeli } from './diyarlar';
import { dunyaUcgenleri } from './dunya';
import { ZEMIN_ADLARI, ZEMIN_KUTUSU, zeminModeli } from './zeminler';
import { BolgeCizimi, DiyarCizimi, ZeminCizimi } from './Cizimler';
import { Sahne } from './Sahne';
import { YERLESIM_KADEMELERI, YERLESIM_KUTUSU, yerlesimModeli } from './yerlesim';
import { P } from './renk';
import {
  besikCati,
  birlestir,
  katmanla,
  kirmaCati,
  kutu,
  mazgal,
  silindir,
  koni,
  tasi,
  type Model,
} from './uc';
import {
  DEMET_KARE,
  DEMET_SURE,
  DUELLO_KARE,
  DUELLO_SURE,
  MIZRAK_KARE,
  MIZRAK_SURE,
  OKCU_KARE,
  OKCU_SURE,
  ORAK_KARE,
  ORAK_SURE,
  SABAN_KARE,
  SABAN_SURE,
  canlandir,
  demetYigini,
  demetciPoz,
  duelloAlani,
  duelloPoz,
  mizrakciPoz,
  okHedefi,
  okcuPoz,
  orakciPoz,
  sabanPoz,
} from './canli';

function denemeEvi() {
  return birlestir(
    kutu(0, 0, 0, 10, 8, 0.6, P.koyuTas),
    kutu(0.5, 0.5, 0.6, 9, 7, 5, { ust: P.siva, yan: P.siva }),
    besikCati(0.5, 0.5, 5.6, 9, 7, 3.5, 'x', P.kiremit, P.siva),
  );
}

function denemeKule() {
  return birlestir(
    silindir(0, 0, 0, 3, 12, P.tas, 10),
    koni(0, 0, 12, 3.6, 5, P.arduvaz, 10),
    kirmaCati(6, -3, 0, 4, 4, 3, P.saman, 0.3),
    kutu(6, -3, -4, 4, 4, 4, P.tahta),
    mazgal(-8, -3, 4, 10, 1, 'x', P.tas),
    kutu(-8, -3, 0, 10, 1, 4, P.tas),
  );
}

/** Talim ve tarla aktörleri: düz bir çimenin üstünde, tek başına. */
function canliDeneme(ad: string): Model {
  // Zemin aktörün çevresi kadar: çizim ona oturuyor, aktör yakından görünsün.
  const zemin = (x0: number, y0: number, x1: number, y1: number) =>
    katmanla(kutu(x0, y0, -1, x1 - x0, y1 - y0, 1, '#5e7a3a'), -2);
  switch (ad) {
    case 'okcu':
      return birlestir(
        zemin(-7, -5, 7, 29),
        canlandir(okcuPoz, OKCU_KARE, OKCU_SURE, [0, 0, 0]),
        okHedefi(),
      );
    case 'mizrakci':
      return birlestir(
        zemin(-6, -5, 7, 16),
        canlandir(mizrakciPoz, MIZRAK_KARE, MIZRAK_SURE, [0, 0, 0]),
      );
    case 'duello':
      return birlestir(
        zemin(-40, -12, 36, 12),
        canlandir(duelloPoz, DUELLO_KARE, DUELLO_SURE, [0, 0, 0], true),
        duelloAlani(),
      );
    case 'saban':
      return birlestir(
        zemin(-30, -9, 30, 9),
        canlandir(sabanPoz, SABAN_KARE, SABAN_SURE, [0, 0, 0], true),
      );
    default:
      return birlestir(
        zemin(-6, -5, 18, 8),
        canlandir(orakciPoz, ORAK_KARE, ORAK_SURE, [0, 0, 0]),
        tasi(canlandir(demetciPoz, DEMET_KARE, DEMET_SURE, [1, 0, 0]), [10, 0, 0]),
        tasi(demetYigini(), [10, 0, 0]),
      );
  }
}

const BOLUMLER: {
  baslik: string;
  ogeler: { ad: string; cizim: React.ReactNode; genis?: boolean; oran?: string }[];
}[] = [
  {
    // Kare kare canlandırma (canli.ts): yalnız GPU'da oynuyor.
    baslik: 'Talim ve tarla',
    ogeler: ['okcu', 'mizrakci', 'duello', 'saban', 'orak'].map((ad) => ({
      ad: 'talim:' + ad,
      genis: true,
      cizim: (
        <Sahne
          anahtar={'talim:' + ad}
          uret={() => canliDeneme(ad)}
          alt={ad}
          className="h-full w-full"
          hareket
          kalici="galeri"
        />
      ),
    })),
  },
  {
    baslik: 'Binalar',
    ogeler: BINA_ADLARI.map((ad) => ({
      ad,
      cizim: (
        <Sahne
          anahtar={'bina:' + ad}
          uret={() => binaModeli(ad)}
          tarif
          kutu={BINA_KUTUSU}
          alt={ad}
          boyut={170}
          kalici="galeri"
        />
      ),
    })),
  },
  {
    baslik: 'Yerleşim',
    ogeler: YERLESIM_KADEMELERI.map((k) => ({
      ad: k,
      genis: true,
      oran: 'aspect-[24/25]',
      cizim: (
        <Sahne
          anahtar={'yerlesim:' + k}
          uret={() => yerlesimModeli(k)}
          tarif
          kutu={YERLESIM_KUTUSU}
          alt={k}
          className="h-full w-full"
          kalici="galeri"
        />
      ),
    })),
  },
  ...(
    [
      ['Birlikler', 'birimler', BIRLIK_ADLARI, birlikModeli],
      ['Düşmanlar', 'dusmanlar', DUSMAN_ADLARI, dusmanModeli],
      ['Ekipman', 'ekipman', EKIPMAN_ADLARI, ekipmanModeli],
      ['Generaller', 'generaller', GENERAL_ADLARI, generalModeli],
      ['Lord', 'lord', LORD_ADLARI, lordModeli],
    ] as const
  ).map(([baslik, tur, adlar, uret]) => ({
    baslik,
    ogeler: adlar.map((ad) => ({
      ad,
      cizim: (
        <Sahne
          anahtar={tur + ':' + ad}
          uret={() => uret(ad) ?? []}
          tarif
          alt={ad}
          boyut={170}
          kare
          kalici="galeri"
        />
      ),
    })),
  })),
  {
    baslik: 'Portreler',
    ogeler: PORTRE_ADLARI.map((ad) => ({
      ad,
      cizim: (
        <Sahne
          anahtar={'portre:' + ad}
          uret={() => portreModeli(ad) ?? []}
          tarif
          kutu={PORTRE_KUTUSU}
          alt={ad}
          boyut={170}
          className="rounded-full bg-[radial-gradient(circle_at_50%_40%,#3a2b1b,#1a120c)]"
          kalici="galeri"
        />
      ),
    })),
  },
  {
    baslik: 'Diyarlar',
    ogeler: DIYAR_ADLARI.flatMap((ad) =>
      (['kapak', 'harita'] as const).map((k) => ({
        ad: ad + ' · ' + k,
        genis: true,
        oran: k === 'kapak' ? 'aspect-[16/9]' : 'aspect-square',
        cizim: (
          <Sahne
            anahtar={'diyar:' + ad + ':' + k}
            uret={() => diyarModeli(ad, k) ?? []}
            tarif
            kutu={k === 'kapak' ? KAPAK_KUTUSU : HARITA_KUTUSU}
            alt={ad}
            className="h-full w-full"
            kalici="galeri"
          />
        ),
      })),
    ),
  },
  {
    baslik: 'Bölgeler',
    ogeler: BOLGE_SAHNELERI.map((ad) => ({
      ad,
      genis: true,
      oran: 'aspect-[3/2]',
      cizim: (
        <Sahne
          anahtar={'bolge:' + ad}
          uret={() => bolgeModeli(ad)}
          tarif
          kutu={BOLGE_KUTUSU}
          alt={ad}
          className="h-full w-full"
          kalici="galeri"
        />
      ),
    })),
  },
  {
    baslik: 'Ekran zeminleri',
    ogeler: ZEMIN_ADLARI.map((ad) => ({
      ad,
      genis: true,
      oran: 'aspect-[60/23]',
      cizim: (
        <Sahne
          anahtar={'zemin:' + ad}
          uret={() => zeminModeli(ad) ?? []}
          tarif
          kutu={ZEMIN_KUTUSU}
          alt={ad}
          className="h-full w-full"
          kalici="galeri"
        />
      ),
    })),
  },
  {
    baslik: 'Dünya',
    ogeler: [
      {
        ad: 'dunya',
        genis: true,
        oran: 'aspect-square',
        cizim: (
          <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
            {dunyaUcgenleri().map((u, i) => (
              <polygon
                key={i}
                points={u.n.join(' ')}
                fill={u.renk}
                stroke={u.renk}
                strokeWidth={0.05}
              />
            ))}
          </svg>
        ),
      },
    ],
  },
  {
    // Uygulamadaki gibi: su parıltısı, ışık titremesi, duman (yalnız GPU).
    baslik: 'Canlı sahneler',
    ogeler: [
      ...['koy_5', 'maden_5', 'kale_5'].map((ad) => ({
        ad: 'canli:' + ad,
        genis: true,
        cizim: <BolgeCizimi ad={ad} alt={ad} className="h-full w-full" kalici="galeri" />,
      })),
      ...['malikane', 'demirhane', 'akin'].map((ad) => ({
        ad: 'canli:' + ad,
        genis: true,
        oran: 'aspect-[60/23]',
        cizim: <ZeminCizimi ad={ad} className="h-full w-full" kalici="galeri" />,
      })),
      {
        ad: 'canli:kirik_sahil',
        genis: true,
        oran: 'aspect-video',
        cizim: (
          <DiyarCizimi ad="kirik_sahil" kadraj="kapak" className="h-full w-full" kalici="galeri" />
        ),
      },
    ],
  },
  {
    baslik: 'Deneme',
    ogeler: [
      {
        ad: 'ev',
        cizim: <Sahne anahtar="deneme-ev" uret={denemeEvi} alt="ev" boyut={180} kalici="galeri" />,
      },
      {
        ad: 'kule',
        cizim: (
          <Sahne anahtar="deneme-kule" uret={denemeKule} alt="kule" boyut={180} kalici="galeri" />
        ),
      },
    ],
  },
];

export function Galeri() {
  return (
    <div className="min-h-screen bg-gece p-4 text-parsomen" data-cizim-galerisi="">
      {BOLUMLER.map((b) => (
        <section key={b.baslik} className="mb-6">
          <h2 className="baslik mb-2 text-[14px] text-altin">{b.baslik}</h2>
          <div className="flex flex-wrap gap-3">
            {b.ogeler.map((o) => (
              <figure
                key={o.ad}
                className={`flex flex-col items-center gap-1 ${o.genis ? 'w-[360px]' : 'w-[180px]'}`}
              >
                <div
                  className={`flex items-center justify-center overflow-hidden rounded-lg bg-yuzey ${
                    o.genis ? `${o.oran ?? 'aspect-[4/3]'} w-[360px]` : 'h-[180px] w-[180px]'
                  }`}
                >
                  {o.cizim}
                </div>
                <figcaption className="text-[11px] text-solgun">{o.ad}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
