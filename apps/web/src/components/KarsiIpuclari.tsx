/**
 * Karşı-birim ipuçları kartı.
 *
 * Ordu seçicinin ALTINDA ve önizlemenin ÜSTÜNDE duruyor. Yeri önemli:
 * ipucunun işi oyuncunun seçimini değiştirmek. Sonucun altında dursa
 * "olan oldu" bilgisi olurdu; burada "süvarisi var, mızrakçı gönder"
 * diyen bir tavsiye oluyor.
 *
 * Hesap istemcide yapılıyor ve sunucu değişikliği gerektirmiyor: karşı
 * çarpanları `packages/shared`'da, garnizon ve tahkimat da bölge
 * verisinde zaten var. Sunucu yetkili, istemci aynı saf fonksiyonla
 * önizliyor — deponun baştan beri kurduğu düzen. (docs/09 §3.3)
 */
import {
  karsiIpuclari,
  kusatmaCarpanlari,
  kusatmaDurumu,
  unitName,
  type Army,
} from '@lordlar/shared';
import { BirimIkonu } from './Ikonlar';

export function KarsiIpuclari({
  benim,
  garnizon,
  garnizonGorunur,
  tahkimatBonusu,
}: {
  benim: Army;
  garnizon: Army;
  /** Garnizon bilinmiyorsa birim eşleşmesi gösterilmez — yanlış tavsiye
      hiç tavsiye vermemekten kötü. Mancınık uyarısı yine gösterilir,
      çünkü o tahkimata bağlı ve tahkimat her zaman görünür. */
  garnizonGorunur: boolean;
  tahkimatBonusu: number;
}) {
  const ipuclari = garnizonGorunur ? karsiIpuclari(benim, garnizon) : [];
  const kusatma = kusatmaDurumu(benim, garnizon, tahkimatBonusu);
  const carpan = kusatmaCarpanlari();

  if (ipuclari.length === 0 && !kusatma) return null;

  return (
    <div className="oyuk mt-3 rounded-xl p-2.5">
      <h4 className="baslik mb-1.5 text-[11px] text-solgun">Birim eşleşmesi</h4>
      <ul className="space-y-1">
        {ipuclari.map((i) => {
          const iyi = i.yon === 'guclu';
          const renk = iyi ? 'var(--color-yesil)' : 'var(--color-kirmizi)';
          return (
            <li key={`${i.yon}-${i.benim}-${i.onun}`} className="flex items-center gap-1.5 text-[12px]">
              <span className="shrink-0" style={{ color: renk }}>
                <BirimIkonu tip={i.benim} boyut={14} />
              </span>
              <span className="min-w-0">
                <strong className="text-parsomen">{unitName(i.benim)}</strong>
                <span className="text-solgun">{iyi ? ' kırıyor: ' : ' zayıf: '}</span>
                <strong className="text-parsomen">{unitName(i.onun)}</strong>
              </span>
              <span
                className="tabular baslik ml-auto shrink-0 text-[11px]"
                style={{ color: renk }}
              >
                ×{i.carpan}
              </span>
            </li>
          );
        })}

        {kusatma === 'kaleye_iyi' && (
          <li className="flex items-center gap-1.5 text-[12px]">
            <span className="shrink-0 text-yesil">
              <BirimIkonu tip="kusatma" boyut={14} />
            </span>
            <span className="text-solgun">
              Mancınık tahkimata karşı <strong className="text-parsomen">×{carpan.kale}</strong>
            </span>
          </li>
        )}
        {kusatma === 'bosa_gidiyor' && (
          <li className="flex items-center gap-1.5 text-[12px]">
            <span className="shrink-0 text-kirmizi">
              <BirimIkonu tip="kusatma" boyut={14} />
            </span>
            <span className="text-solgun">
              Tahkimat yok — mancınık canlı orduya{' '}
              <strong className="text-kirmizi">×{carpan.birim}</strong> vuruyor
            </span>
          </li>
        )}
      </ul>

      {!garnizonGorunur && (
        <p className="mt-1.5 text-[11px] text-sonuk">
          Garnizonu görmüyorsun; eşleşme tahmini yapılamıyor.
        </p>
      )}
    </div>
  );
}
