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
 * Görsel yoksa hiçbir şey çizilmez — sadece bugünkü üst boşluk kalır.
 * Böylece `zeminler/kisla.webp` dosyası konduğu anda Kışla bir avluya
 * dönüşür, konmadığı sürece ekran bugünkü haliyle çalışır.
 */
import { useState, type ReactNode } from 'react';

/** Şeridin yüksekliği. Görsel gelse de gelmese de DEĞİŞMİYOR. */
const BOY = 150;

/**
 * Zemin görseli OLAN ekranlar.
 *
 * Neden elle yazılmış bir liste: görselin var olup olmadığını çalışma
 * anında öğrenmek (yükle, olmazsa küçült) sayfayı ZIPLATIYOR — oyuncunun
 * "görsel kaymalar var" şikâyetinin asıl sebebi buydu. Hangi dosyanın var
 * olduğu derleme zamanı bilinen bir şey; tahmin etmek yerine biliyoruz ve
 * ilk boyamada doğru yüksekliği veriyoruz.
 *
 * Listeyle klasörün ayrışmasını `tools/gorsel-denetim.mjs` yakalıyor:
 * dosya konur da liste güncellenmezse denetim kalıyor.
 */
const ZEMINI_OLAN = new Set([
  'malikane',
  'kisla',
  'demirhane',
  'generaller',
  'siralama',
  'gorevler',
  'olaylar',
]);

export function Zemin({
  ad,
  baslik,
  altyazi,
}: {
  /** `public/gorseller/zeminler/<ad>.webp` */
  ad: string;
  baslik: string;
  /** Tek satırlık "burası neresi" cümlesi. */
  altyazi?: ReactNode;
}) {
  const [yuklendi, setYuklendi] = useState(false);
  const gorselVar = ZEMINI_OLAN.has(ad);

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
      <img
        src={`/gorseller/zeminler/${ad}.webp`}
        alt=""
        aria-hidden
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          yuklendi ? 'opacity-100' : 'opacity-0'
        }`}
        // Üst yarıdan kırpar: 16:10 kaynakta ilgi çeken öğe (avlu, ocak,
        // masa) üstte, alt üçte biri arayüz için bilerek boş bırakılıyor.
        style={{ objectPosition: 'center 38%' }}
        loading="eager"
        decoding="async"
        onLoad={() => setYuklendi(true)}
      />
      {/* Görsel gelene kadar (ya da hiç gelmezse) şeridin zemini: boş bir
          delik değil, sakin bir kapak. */}
      {!yuklendi && (
        <div className="absolute inset-0 bg-gradient-to-b from-panel to-gece" aria-hidden />
      )}
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
export function TamZemin({ ad }: { ad: string }) {
  const [gorunur, setGorunur] = useState(false);

  return (
    <>
      <img
        src={`/gorseller/zeminler/${ad}.webp`}
        alt=""
        aria-hidden
        className="fixed inset-0 z-0 h-full w-full object-cover transition-opacity duration-700"
        style={{ opacity: gorunur ? 1 : 0 }}
        loading="eager"
        decoding="async"
        onLoad={() => setGorunur(true)}
      />
      {/* Perde: manzara okunaklı kalsın ama metnin kontrastını yemesin. */}
      {gorunur && (
        <div
          className="fixed inset-0 z-0"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--color-gece) 45%, transparent) 0%, color-mix(in srgb, var(--color-gece) 78%, transparent) 45%, color-mix(in srgb, var(--color-gece) 94%, transparent) 100%)',
          }}
        />
      )}
    </>
  );
}
