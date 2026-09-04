/**
 * Boş hâl — "yapacak bir şey yok" demeyen ekran.
 *
 * Türe yapılan en yaygın şikâyetlerden biri sonu gelmeyen bekleme
 * (docs/09 §3.2): oyuncu oyunu açıyor, ekran "bekle" diyor, oyuncu
 * kapatıyor. Kural olarak yazdık: **hiçbir ekran, hiçbir durumda
 * "şu an yapacak bir şey yok" demez** — boş hâl bir sonraki işi gösterir.
 *
 * Bu bileşen o kuralı zorunlu kılıyor: boş hâl yazmak için `eylemler`
 * vermek gerekiyor. Vermeden de kullanılabilir ama o zaman tek satırlık
 * bir metin olur ve gözden kaçmaz — kural bir bileşene gömülünce
 * yeni ekranlar da onu miras alıyor.
 */
import type { ReactNode } from 'react';
import { Buton, Kart } from './ui';

export interface BosHalEylemi {
  etiket: string;
  ikon?: ReactNode;
  onTikla: () => void;
}

export function BosHal({
  mesaj,
  eylemler = [],
  ikon,
}: {
  mesaj: ReactNode;
  /** En az bir eylem vermek kural — boş bırakmak istisna olmalı. */
  eylemler?: BosHalEylemi[];
  /**
   * Boş hâlin simgesi.
   *
   * Burada duruyor çünkü çağıranlar simgeyi göstermek için boş hâli BİR
   * KART DAHA içine sarıyordu ve iki iç içe kart çıkıyordu. Simge boş
   * hâlin parçası olunca sarmalamaya gerek kalmıyor.
   */
  ikon?: ReactNode;
}) {
  return (
    // Boş hâl SAKİN bir kart: dolu bir bölümle aynı ağırlıkta durması,
    // ekranı kaydıran oyuncuyu her seferinde okumaya zorluyordu
    // (docs/11 §2.3 G4).
    <Kart sakin className={`p-4 ${ikon ? 'text-center' : ''}`}>
      {ikon && (
        <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-altin/15 text-altin">
          {ikon}
        </span>
      )}
      <p className="text-[13px] text-solgun">{mesaj}</p>
      {eylemler.length > 0 && (
        <div className={`mt-3 flex flex-wrap gap-2 ${ikon ? 'justify-center' : ''}`}>
          {eylemler.map((e) => (
            <Buton key={e.etiket} tur="sessiz" boy="kucuk" onClick={e.onTikla}>
              {e.ikon && <span className="mr-1.5 inline-block align-[-2px]">{e.ikon}</span>}
              {e.etiket}
            </Buton>
          ))}
        </div>
      )}
    </Kart>
  );
}
