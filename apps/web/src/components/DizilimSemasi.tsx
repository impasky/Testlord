/**
 * İdeal dizilim şeması — öğreticideki 4x4 dersi.
 *
 * "Mızrakçı 1. satır, süvari 2., okçu 3., mancınık 4." cümlesi doğru ama
 * okunmuyor: dört ayrı sayı gibi duruyor ve aradaki DERİN görünmüyor —
 * yakın dövüş önde, atış arkada. Oyuncunun bildirdiği hata da tam buydu:
 * mancınığı en öne koymak.
 *
 * Şema bunu tek bakışta veriyor. Kareler `balance.json`'daki ideal
 * satırlardan çiziliyor; dengede bir birimin yeri değişirse şema da
 * değişir. Bu, öğreticinin geri kalanıyla aynı ilke (ogretici.ts başı).
 *
 * KarsiCemberi gibi saf çizim: görsel dosya yok, tıklanmıyor, durum
 * tutmuyor. Gerçek dizilim ekranı DizilimIzgarasi; burası yalnız resim.
 */
import { B, unitName, type UnitType } from '@lordlar/shared';
import { BirimIkonu } from './Ikonlar';

const D = B.dizilim;

export function DizilimSemasi() {
  const satirlar = Array.from({ length: D.satir }, (_, n) => n + 1);
  // Her satırda ideal yeri orası olan birimler. Boş satır da olabilir —
  // uydurup doldurmak şemayı yanlış yapardı.
  const satirBirimleri = (satir: number): UnitType[] =>
    (Object.keys(D.birim_yerlesimi) as UnitType[]).filter(
      (t) => D.birim_yerlesimi[t].ideal_satir === satir,
    );

  return (
    <div className="oyuk rounded-xl p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="baslik text-[11px] text-parsomen">İdeal dizilim</span>
        <span className="text-[10px] text-sonuk">↑ düşman bu yönde</span>
      </div>

      <div className="space-y-1">
        {satirlar.map((satir) => {
          const birimler = satirBirimleri(satir);
          return (
            <div key={satir} className="flex items-center gap-2">
              <span className="tabular w-4 shrink-0 text-[10px] text-sonuk">{satir}</span>
              <div className="flex flex-1 gap-1">
                {Array.from({ length: D.sutun }, (_, s) => {
                  // Satırdaki birimler sütunlara sırayla dağılıyor; iki
                  // birim varsa ikisi de görünüyor, biri varsa tekrarlıyor.
                  const t = birimler.length > 0 ? birimler[s % birimler.length]! : null;
                  return (
                    <span
                      key={s}
                      className={`flex h-8 flex-1 items-center justify-center rounded-md border ${
                        t ? 'border-kenar bg-derin text-parsomen' : 'border-kenar/40 text-sonuk'
                      }`}
                    >
                      {t ? <BirimIkonu tip={t} boyut={16} /> : null}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-sonuk">
        {satirlar
          .map((satir) => {
            const b = satirBirimleri(satir);
            return b.length > 0 ? `${satir}. ${b.map(unitName).join(' ve ')}` : null;
          })
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}
