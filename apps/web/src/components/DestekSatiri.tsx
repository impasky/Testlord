/**
 * Destek adresi satırı — Kullanım Koşulları ve Aydınlatma Metni'nde.
 *
 * Adres sunucunun ortam değişkeninden (`DESTEK_EPOSTA`) geliyor, koda
 * gömülü değil: onu yalnız oyunun sahibi seçebilir. Tanımlı değilse
 * oyuncuya kayıt olduğu adresten yazabileceği söyleniyor — boş bir
 * "iletişim" başlığı bırakmak, hiç başlık koymamaktan kötü.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function DestekSatiri() {
  const q = useQuery({ queryKey: ['destek'], queryFn: api.destek, staleTime: Infinity });
  const eposta = q.data?.eposta ?? null;
  if (!eposta) {
    return <p>Bir sorun ya da talebin için oyun içindeki şikâyet düğmesini kullanabilirsin.</p>;
  }
  return (
    <p>
      Soru, talep ve itirazların için:{' '}
      <a
        href={`mailto:${eposta}`}
        className="text-parsomen underline decoration-dotted underline-offset-2"
      >
        {eposta}
      </a>
    </p>
  );
}
