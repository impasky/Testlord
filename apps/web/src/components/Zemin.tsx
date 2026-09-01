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
  const [durum, setDurum] = useState<'bekliyor' | 'var' | 'yok'>('bekliyor');

  // Görsel yokken ekran bugünkü düzeniyle kalsın: sadece üst boşluk.
  if (durum === 'yok') return <div className="h-3" />;

  return (
    <div
      // -mx-3: kabuğun yatay dolgusundan taşıp tam genişlik kaplar. Kenardan
      // kenara gitmeyen bir manzara, manzara değil resimdir.
      className={`relative -mx-3 overflow-hidden ${durum === 'var' ? 'h-[150px]' : 'h-3'}`}
    >
      <img
        src={`/gorseller/zeminler/${ad}.webp`}
        alt=""
        aria-hidden
        className="h-full w-full object-cover"
        // Üst yarıdan kırpar: 16:10 kaynakta ilgi çeken öğe (avlu, ocak,
        // masa) üstte, alt üçte biri arayüz için bilerek boş bırakılıyor.
        style={{ objectPosition: 'center 38%' }}
        loading="eager"
        decoding="async"
        onLoad={() => setDurum('var')}
        onError={() => setDurum('yok')}
      />
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
