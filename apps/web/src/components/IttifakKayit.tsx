/**
 * İttifak kayıt defteri: "ben yokken ne oldu".
 *
 * Sohbetten farkı akıp gitmemesi ve konuşma olmaması: sohbet insanların
 * yazdığı şey, defter ittifağın BAŞINA GELEN şey. İkisi tek listede
 * olsaydı "kim ayrıldı" sorusu üç günlük muhabbetin arasında kaybolurdu.
 *
 * Satırların çoğu türetiliyor (bağış, pakt, başvuru kararı); yalnız başka
 * hiçbir yerde izi kalmayanlar saklanıyor. Sunucu tarafında birleşiyorlar,
 * burada yalnız çiziliyorlar.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { BosHal } from './BosHal';
import { Bolum, Kart, formatGecen } from './ui';

/**
 * Satırın rengi türünden geliyor: okumadan önce tonu veriyor.
 * Olaylar ekranıyla aynı fikir (docs/11 §2.3).
 */
const RENK: Record<string, string> = {
  uye_katildi: 'var(--color-yesil)',
  basvuru_kabul: 'var(--color-yesil)',
  pakt: 'var(--color-yesil)',
  bagis: 'var(--color-altin)',
  rutbe: 'var(--color-altin)',
  arma: 'var(--color-altin)',
  hedef: 'var(--color-mavi)',
  duyuru: 'var(--color-mavi)',
  kapi: 'var(--color-mavi)',
  uye_ayrildi: 'var(--color-solgun)',
  basvuru_ret: 'var(--color-solgun)',
  uye_cikarildi: 'var(--color-turuncu)',
  pakt_fesih: 'var(--color-turuncu)',
};

export function IttifakKayit() {
  const q = useQuery({
    queryKey: ['ittifak-kayit'],
    queryFn: api.ittifakKayit,
    staleTime: 20_000,
  });

  const kayitlar = q.data?.kayitlar ?? [];

  return (
    <Bolum baslik="Kayıt Defteri" sakin={kayitlar.length === 0}>
      {kayitlar.length === 0 ? (
        <BosHal
          mesaj="Defter henüz boş. Katılanlar, bağışlar, paktlar ve kararlar buraya yazılır."
          eylemler={[]}
        />
      ) : (
        <ul className="space-y-1.5">
          {kayitlar.map((k, i) => (
            <li key={`${k.an}-${i}`}>
              <Kart sakin className="p-2.5" vurgu={RENK[k.kind]}>
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 text-[12px]">{k.mesaj}</span>
                  <span className="tabular shrink-0 text-[11px] text-solgun">
                    {formatGecen(k.an)}
                  </span>
                </div>
              </Kart>
            </li>
          ))}
        </ul>
      )}
    </Bolum>
  );
}
