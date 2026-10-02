/**
 * Yakınlaştırma düğmesi: dünya haritasında ve Şehir'in yerleşkesinde.
 * Parmakla kıstırmanın düğmeli karşılığı (fare, ekran okuyucu).
 */
export function YakinlikDugmesi({
  etiket,
  isaret,
  onTikla,
  disabled,
}: {
  etiket: string;
  isaret: string;
  onTikla: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTikla}
      disabled={disabled}
      aria-label={etiket}
      title={etiket}
      // 44px: dokunma hedefi alt sınırı (tools/gorsel-denetim.mjs ölçüyor).
      className="bas flex h-11 w-11 items-center justify-center text-[18px] leading-none text-parsomen disabled:text-sonuk"
    >
      {isaret}
    </button>
  );
}
