/**
 * CÜMLE — vurgulu sözcük taşıyan bir cümleyi TEK metin olarak tutar.
 *
 * ── Sorun ───────────────────────────────────────────────────────────
 *
 * JSX'te bir cümlenin ortasına renk koymak onu üçe bölüyor:
 *
 *     <p>
 *       Yalnız <span className="text-parsomen">nüfusu az</span> bir
 *       medeniyete geçebilirsin — kazanan tarafa geçiş yok.
 *     </p>
 *
 * Çeviri eklentisi her JSX metnini ayrı ayrı sarıyor, yani çevirmene
 * `"Yalnız"`, `"nüfusu az"` ve `"bir medeniyete geçebilirsin — kazanan
 * tarafa geçiş yok."` diye üç satır gidiyor. İlki ve sonuncusu tek
 * başına ÇEVRİLEMEZ: bağlamı yok, üstelik İngilizcede sözcük sırası
 * değişince parça yanlış yere düşer. `ceviri-liste.mjs` bu yüzden
 * onları "cümle parçası" diye ayırıyor ve listeye hiç koymuyor —
 * sonuç olarak oyun İngilizceyken o satırlar Türkçe kalıyordu.
 *
 * ── Çözüm ───────────────────────────────────────────────────────────
 *
 *     <Cumle
 *       metin="Yalnız {0} bir medeniyete geçebilirsin — kazanan tarafa geçiş yok."
 *       parca={[<span className="text-parsomen">nüfusu az</span>]}
 *     />
 *
 * Cümle tek bir dizge; eklenti onu bütün olarak sarıyor, çevirmen
 * bütün olarak görüyor ve `{0}` çeviride İSTEDİĞİ YERE gidiyor.
 * Vurgulanan sözcük kendi başına da çevrilebilir bir ibare olduğu için
 * ayrıca sözlüğe giriyor — ikisi bağımsız.
 *
 * Yer tutucu `t()`nin kullandığıyla aynı (`{0}`, `{1}`): biri sayı,
 * öteki React düğümü taşıdığı için işlev ayrı, dil aynı.
 */
import { cogulSec } from '@lordlar/shared';
import { Fragment, type ReactNode } from 'react';

export function Cumle({ metin, parca }: { metin: string; parca: readonly ReactNode[] }) {
  /*
   * ÇOĞUL: eklenti `metin`i `__t("…")` ile sarıyor ama ARGÜMANSIZ
   * çağırıyor, yani motor hangi sayıdan söz edildiğini göremiyor.
   * Sayı burada, parçaların içinde: doğrudan sayı verilmiş parçalardan
   * okunuyor (`parca={[3]}` gibi). Parça bir React düğümüyse sayı
   * bulunamıyor ve çoğul biçim seçiliyor — İngilizcede genel hâl.
   */
  const kalip = cogulSec(metin, parca as readonly unknown[]);
  /*
   * Yer tutucusu OLMAYAN metin de geçerli: koşullu bir cümlenin bir
   * kolu vurgusuz olabiliyor. Bölme zaten tek parça döndürüyor.
   *
   * Karşılığı olmayan yer tutucu OLDUĞU GİBİ kalıyor — `yerlestir()`
   * ile aynı davranış: eksik bir argüman cümleyi sessizce kısaltmasın,
   * görünür kalsın ki fark edilsin.
   */
  return (
    <>
      {kalip.split(/(\{\d+\})/).map((p, i) => {
        const y = /^\{(\d+)\}$/.exec(p);
        if (!y) return <Fragment key={i}>{p}</Fragment>;
        const d = parca[Number(y[1])];
        return <Fragment key={i}>{d === undefined || d === null ? p : d}</Fragment>;
      })}
    </>
  );
}
