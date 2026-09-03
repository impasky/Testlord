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
}: {
  mesaj: ReactNode;
  /** En az bir eylem vermek kural — boş bırakmak istisna olmalı. */
  eylemler?: BosHalEylemi[];
}) {
  return (
    <Kart className="p-4">
      <p className="text-[13px] text-solgun">{mesaj}</p>
      {eylemler.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
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
