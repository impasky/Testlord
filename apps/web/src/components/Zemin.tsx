/**
 * Ekran zemini — her sekmenin tepesindeki manzara şeridi.
 *
 * Oyuncunun geri bildirimi tek cümlede toplanıyordu: "sadece rakamlara
 * bakıyor gibi hissediyorum". Sorun sayıların kendisi değildi; sayıların
 * hiçbir YERDE durmamasıydı. Kışla bir liste, Demirhane başka bir liste,
 * Malikâne üçüncü bir listeydi — hepsi aynı boş zeminin üstünde.
 *
 * Bu şerit ekranı bir mekâna oturtuyor: Kışla bir talim avlusu, Demirhane
 * ocağın başı, Generaller harita masası oluyor. Alt kenarı sayfa zeminine
 * eritiliyor ki afiş kesilmiş bir kart gibi durmasın, ekranın kendisi
 * oradan başlıyormuş gibi olsun. (docs/08 İ11)
 *
 * Manzara koddan çiziliyor (cizim/zeminler.ts, docs/24): ekranın şehirdeki
 * binası ve önünde o ekranın insanları. Dosya beklemiyor. İlk açılışta
 * çizim bir kare sonra geliyor (`Sahne` `ertele`): binlerce yüzlük bir
 * sahne, ekranın düğmelerinden önce hesaplanıp onları geciktirmesin.
 * Şeridin yüksekliği sabit olduğu için bu bekleme hiçbir şeyi kaydırmıyor.
 * Çizimi olmayan ekran sade bir başlıkla açılıyor.
 */
import type { ReactNode } from 'react';
import { BolgeCizimi, CIZILEN_ZEMINLER, ZeminCizimi } from '../cizim/Cizimler';

/** Giriş ekranının manzarası: gelişmiş bir kale bölgesi. */
const GIRIS_SAHNESI = 'kale_5';

/** Şeridin yüksekliği. Görsel gelse de gelmese de DEĞİŞMİYOR. */
const BOY = 150;

export function Zemin({
  ad,
  baslik,
  altyazi,
}: {
  /** Zemin sahnesinin adı (cizim/zeminler.ts `ZEMIN_ADLARI`). */
  ad: string;
  baslik: string;
  /** Tek satırlık "burası neresi" cümlesi. */
  altyazi?: ReactNode;
}) {
  const gorselVar = CIZILEN_ZEMINLER.has(ad);

  // Görseli olmayan ekran: koca boş bir bant yerine sade bir başlık.
  // Yüksekliği yine SABİT — hiçbir şey beklemediği için zıplayacak bir şey
  // de yok.
  if (!gorselVar) {
    return (
      <div className="pt-3 pb-1">
        <h1 className="baslik text-[20px] leading-tight text-parsomen">{baslik}</h1>
        {altyazi && <p className="text-[12px] text-solgun">{altyazi}</p>}
      </div>
    );
  }

  return (
    <div
      // -mx-3: kabuğun yatay dolgusundan taşıp tam genişlik kaplar. Kenardan
      // kenara gitmeyen bir manzara, manzara değil resimdir.
      //
      // YÜKSEKLİK SABİT ve bu, oyuncunun "görsel kaymalar var" şikâyetinin
      // asıl sebebinin düzeltilmesi. Önceden şerit görsel yüklenene kadar
      // 12px, yüklendikten sonra 150px oluyordu: sayfa her açılışta 138
      // piksel aşağı zıplıyordu ve altındaki her düğme yer değiştiriyordu.
      // Ölçüldü — açılış CLS'i 0,179'du (Chrome'un "iyi" eşiği 0,1).
      //
      // Görsel YOKSA da şerit duruyor: altındaki degrade zaten başlığın
      // arkasında ve şerit başlıklı bir kapak gibi okunuyor. Eskiden bu
      // durumda şerit tamamen kayboluyordu; şimdi ekranlar birbiriyle
      // tutarlı ve dosya sonradan konduğunda hazır kutuya yerleşiyor.
      className="relative -mx-3 overflow-hidden"
      style={{ height: BOY }}
    >
      <ZeminCizimi ad={ad} className="h-full w-full" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-gece via-gece/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5">
        <h1
          className="baslik text-[20px] leading-tight text-parsomen"
          style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
        >
          {baslik}
        </h1>
        {altyazi && (
          <p
            className="text-[12px] text-solgun"
            style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
          >
            {altyazi}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Tam ekran zemin — giriş ekranı için.
 *
 * Giriş, oyuncunun gördüğü İLK ekran ve şu an boş bir zeminde duran bir
 * formdan ibaret. Oyunun ne olduğuna dair ilk izlenim buradan başlıyor:
 * arkada bir diyar varsa form bir kapı olur, yoksa form sadece formdur.
 *
 * Şerit değil tam ekran: burada arayüz sayfayı doldurmuyor, ortada duran
 * tek bir kart var; şerit koysak kartın üstünde asılı kalırdı.
 *
 * `z-0`, `-z-10` DEĞİL. Negatif z ile denendi ve görsel hiç görünmedi:
 * boyama sırasında negatif z katmanı kök öğenin arka planının üstünde ama
 * `body`nin arka planının ALTINDA kalıyor; styles.css `body`ye de opak bir
 * zemin verdiği için görseli tamamen örtüyordu. `z-0` konumlanmış öğeleri
 * blok arka planlarından sonra boyatıyor. Karşılığı: içeriğin `relative`
 * olması gerekiyor, yoksa zemin onun üstüne biner.
 */
export function TamZemin({ ad: _ad }: { ad: string }) {
  return (
    <>
      {/* Giriş manzarası: gelişmiş bir kale bölgesi, telefonun boyuna
          kırpılmış (kale ortada kalıyor). Koddan çiziliyor (docs/24). */}
      <div className="fixed inset-0 z-0" aria-hidden>
        <BolgeCizimi ad={GIRIS_SAHNESI} alt="" className="h-full w-full" />
      </div>
      {/* Perde: manzara okunaklı kalsın ama metnin kontrastını yemesin. */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--color-gece) 45%, transparent) 0%, color-mix(in srgb, var(--color-gece) 78%, transparent) 45%, color-mix(in srgb, var(--color-gece) 94%, transparent) 100%)',
        }}
      />
    </>
  );
}
