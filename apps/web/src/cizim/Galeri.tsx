/**
 * Çizim galerisi: koddan çizilen her görsel tek sayfada (docs/24).
 *
 * Yalnız geliştirmede açılıyor (`#/cizim-galerisi`). Çizimler burada
 * yan yana görülüp ekran görüntüsüyle denetleniyor: aynı ışık, aynı
 * palet, aynı ölçek tutuyor mu?
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
import { Sahne } from './Sahne';
import { YERLESIM_KADEMELERI, YERLESIM_KUTUSU, yerlesimModeli } from './yerlesim';
import { P } from './renk';
import { besikCati, birlestir, kirmaCati, kutu, mazgal, silindir, koni } from './uc';

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

const BOLUMLER: {
  baslik: string;
  ogeler: { ad: string; cizim: React.ReactNode; genis?: boolean; oran?: string }[];
}[] = [
  {
    baslik: 'Binalar',
    ogeler: BINA_ADLARI.map((ad) => ({
      ad,
      cizim: (
        <Sahne
          anahtar={'bina:' + ad}
          uret={() => binaModeli(ad)}
          kutu={BINA_KUTUSU}
          alt={ad}
          boyut={170}
        />
      ),
    })),
  },
  {
    baslik: 'Yerleşim',
    ogeler: YERLESIM_KADEMELERI.map((k) => ({
      ad: k,
      genis: true,
      cizim: (
        <Sahne
          anahtar={'yerlesim:' + k}
          uret={() => yerlesimModeli(k)}
          kutu={YERLESIM_KUTUSU}
          alt={k}
          className="h-full w-full"
        />
      ),
    })),
  },
  ...(
    [
      ['Birlikler', BIRLIK_ADLARI, birlikModeli],
      ['Düşmanlar', DUSMAN_ADLARI, dusmanModeli],
      ['Ekipman', EKIPMAN_ADLARI, ekipmanModeli],
      ['Generaller', GENERAL_ADLARI, generalModeli],
      ['Lord', LORD_ADLARI, lordModeli],
    ] as const
  ).map(([baslik, adlar, uret]) => ({
    baslik,
    ogeler: adlar.map((ad) => ({
      ad,
      cizim: (
        <Sahne anahtar={baslik + ':' + ad} uret={() => uret(ad) ?? []} alt={ad} boyut={170} kare />
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
          kutu={PORTRE_KUTUSU}
          alt={ad}
          boyut={170}
          className="rounded-full bg-[radial-gradient(circle_at_50%_40%,#3a2b1b,#1a120c)]"
        />
      ),
    })),
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
          kutu={BOLGE_KUTUSU}
          alt={ad}
          className="h-full w-full"
        />
      ),
    })),
  },
  {
    baslik: 'Deneme',
    ogeler: [
      {
        ad: 'ev',
        cizim: <Sahne anahtar="deneme-ev" uret={denemeEvi} alt="ev" boyut={180} />,
      },
      {
        ad: 'kule',
        cizim: <Sahne anahtar="deneme-kule" uret={denemeKule} alt="kule" boyut={180} />,
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
