/**
 * Taş-kağıt-makas çemberi — öğreticideki tek somut strateji dersi.
 *
 * Metin olarak "Mızrakçı → Süvari ×1.5, Okçu → Mızrakçı ×1.5, Süvari →
 * Okçu ×1.5" yazmak doğru ama okunmuyor: üç eşleşme üç ayrı cümle gibi
 * duruyor ve aralarındaki HALKA görünmüyor. Halkayı görmeyen oyuncu
 * "mızrakçı iyidir" diye ezberliyor, oysa ders "her birimin bir avcısı
 * var".
 *
 * Çember bunu tek bakışta veriyor. Üç düğüm, aralarında oklar; okun
 * üstünde çarpan. Hiçbir görsel dosya yok — saf SVG, oyunun geri kalanı
 * gibi (docs/10 §1.1).
 *
 * Veri motordan geliyor (`karsiHalkasi()`), bu yüzden dengedeki bir çarpan
 * değişirse çember de değişir. Üç düğümden farklı bir halka gelirse çizim
 * yapılmıyor: yanlış bir şema, şema olmamasından kötü.
 */
import { karsiHalkasi, unitName } from '@lordlar/shared';
import { BirimIkonu } from './Ikonlar';

/** Üç düğümün merkezleri — üstte bir, altta iki. */
const DUGUMLER = [
  { x: 50, y: 16 },
  { x: 84, y: 76 },
  { x: 16, y: 76 },
];

export function KarsiCemberi() {
  const halka = karsiHalkasi();
  if (halka.length !== 3) return null;

  // Halkayı sırala: ilk eşleşmenin hedefi ikinci eşleşmenin saldıranı olsun.
  // Sırasız çizersek oklar birbirini keser ve çember çember gibi durmaz.
  const sirali = [halka[0]!];
  while (sirali.length < 3) {
    const son = sirali[sirali.length - 1]!;
    const sonraki = halka.find((k) => k.saldiran === son.hedef);
    if (!sonraki) return null;
    sirali.push(sonraki);
  }

  return (
    <div className="oyuk rounded-xl p-3">
      <div className="relative mx-auto aspect-square w-full max-w-[240px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <marker
              id="karsi-ok"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-altin)" />
            </marker>
          </defs>
          {sirali.map((k, i) => {
            const a = DUGUMLER[i]!;
            const b = DUGUMLER[(i + 1) % 3]!;
            // Okları düğümlerin kenarında başlatıp bitiriyoruz: merkezden
            // merkeze çizilen bir ok ikonun altında kaybolur.
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const uz = Math.hypot(dx, dy);
            const bosluk = 21;
            return (
              <line
                key={`${k.saldiran}-${k.hedef}`}
                x1={a.x + (dx / uz) * bosluk}
                y1={a.y + (dy / uz) * bosluk}
                x2={b.x - (dx / uz) * bosluk}
                y2={b.y - (dy / uz) * bosluk}
                stroke="var(--color-altin)"
                strokeWidth="1.4"
                strokeLinecap="round"
                markerEnd="url(#karsi-ok)"
                opacity="0.75"
              />
            );
          })}
        </svg>

        {sirali.map((k, i) => {
          const d = DUGUMLER[i]!;
          return (
            <div
              key={k.saldiran}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
              style={{ left: `${d.x}%`, top: `${d.y}%` }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-altin/50 bg-panel text-altin">
                <BirimIkonu tip={k.saldiran} boyut={24} />
              </span>
              <span className="baslik text-[11px] whitespace-nowrap text-solgun">
                {unitName(k.saldiran)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-1 text-center text-[11px] text-sonuk">
        Ok, kimin kimi kırdığını gösterir — her eşleşmede ×{sirali[0]!.carpan} hasar.
      </p>
    </div>
  );
}
