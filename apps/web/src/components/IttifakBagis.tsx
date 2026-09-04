/**
 * İttifak bağışı ve seviyesi (docs/09 B1e).
 *
 * İttifak kurulduktan sonra BİRLİKTE büyüyecek hiçbir şey yoktu: üyeler
 * katılıyor, birbirine saldıramıyor, kaynak gönderiyor — ama ittifakın
 * kendisi hiç ilerlemiyordu.
 *
 * Kart iki soruyu birden cevaplıyor ve ikincisi asıl olan:
 *  - Ne veriyorum? (maliyet, kalan hak, bana dönen)
 *  - Ne İÇİN veriyorum? (sonraki seviyede NE değişiyor)
 *
 * İkincisi olmadan bağış boş bir düğme: oyuncu kaynağını neye verdiğini
 * bilmeden vermez. O yüzden "sonraki seviyede" satırı sadece süs değil,
 * kartın gerekçesi.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type IttifakAyricalikDto } from '../api/client';
import { IkonAltin, IkonDemir, IkonErzak } from './Ikonlar';
import { hisOnay, hisRet } from './hisGeriBildirimi';
import { Bolum, Buton, EngelNotu, Hap, Ilerleme, Kart, formatSayi } from './ui';

/** Ayrıcalıkları okunur satırlara çeviriyor. */
function ayricalikSatirlari(a: IttifakAyricalikDto): { ad: string; deger: string }[] {
  return [
    { ad: 'Günlük kaynak gönderme', deger: formatSayi(a.ticaretTavani) },
    { ad: 'Takviye hızı', deger: `+%${Math.round(a.takviyeHizi * 100)}` },
    { ad: 'Keşif indirimi', deger: `%${Math.round(a.kesifIndirimi * 100)}` },
    { ad: 'Pakt hakkı', deger: `${a.paktSlotu}` },
  ];
}

export function IttifakBagis() {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const [mujde, setMujde] = useState<string | null>(null);

  const q = useQuery({ queryKey: ['bagis'], queryFn: api.bagisDurumu, staleTime: 15_000 });
  const bagis = useMutation({
    mutationFn: api.bagisYap,
    onSuccess: (r) => {
      hisOnay();
      setHata(null);
      setMujde(
        r.seviyeAtladi
          ? `İttifakın ${r.seviye.seviye}. seviyeye çıktı!`
          : `+${formatSayi(r.xp)} ittifak XP · sana +${r.odul.xp} lord XP`,
      );
      void qc.invalidateQueries({ queryKey: ['bagis'] });
      void qc.invalidateQueries({ queryKey: ['ittifak'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['ticaret'] });
    },
    onError: (e) => {
      hisRet();
      setMujde(null);
      setHata(e instanceof ApiError ? e.message : 'Bağış yapılamadı.');
    },
  });

  const d = q.data;
  if (!d) return null;

  const yetersiz =
    d.kaynaklarim.altin < d.maliyet.altin ||
    d.kaynaklarim.demir < d.maliyet.demir ||
    d.kaynaklarim.erzak < d.maliyet.erzak;
  const hakBitti = d.kalanHak <= 0;
  const engel = hakBitti
    ? { kisa: 'Bugünlük bağış hakkın bitti', uzun: `Her gün ${d.gunlukHak} bağış hakkın var.` }
    : yetersiz
      ? { kisa: 'Kaynağın yetmiyor', uzun: 'Bağış için gereken kaynağı toplaman gerekiyor.' }
      : null;

  const simdiki = ayricalikSatirlari(d.ayricaliklar);
  const sonraki = d.sonrakiAyricaliklar ? ayricalikSatirlari(d.sonrakiAyricaliklar) : null;

  return (
    <Bolum
      baslik={`İttifak Seviyesi · ${d.seviye.seviye}`}
      yan={
        <span className="tabular text-[11px] text-sonuk">
          {d.kalanHak}/{d.gunlukHak} bağış hakkı
        </span>
      }
    >
      <Kart className="p-3" vurgu="var(--color-altin)">
        {/* Seviye çubuğu: ortak emeğin nerede olduğunu tek bakışta
            söylüyor. Azami seviyede eşik yok, çubuk dolu kalıyor. */}
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="baslik text-[13px] text-altin">{d.seviye.seviye}. Seviye</span>
          <span className="tabular text-[11px] text-solgun">
            {d.seviye.sonrakiEsik === null
              ? 'en üst seviye'
              : `${formatSayi(d.seviye.seviyedeXp)} / ${formatSayi(d.seviye.sonrakiEsik)}`}
          </span>
        </div>
        <Ilerleme
          deger={d.seviye.sonrakiEsik === null ? 1 : d.seviye.seviyedeXp}
          max={d.seviye.sonrakiEsik ?? 1}
          renk="var(--color-altin)"
        />

        <div className="mt-3 border-t border-kenar/70 pt-2.5">
          <p className="baslik mb-1.5 text-[10px] text-sonuk">BİR BAĞIŞ</p>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Hap
              ikon={<IkonAltin boyut={13} />}
              renk={d.kaynaklarim.altin < d.maliyet.altin ? 'var(--color-kirmizi)' : undefined}
            >
              {formatSayi(d.maliyet.altin)}
            </Hap>
            <Hap
              ikon={<IkonDemir boyut={13} />}
              renk={d.kaynaklarim.demir < d.maliyet.demir ? 'var(--color-kirmizi)' : undefined}
            >
              {formatSayi(d.maliyet.demir)}
            </Hap>
            <Hap
              ikon={<IkonErzak boyut={13} />}
              renk={d.kaynaklarim.erzak < d.maliyet.erzak ? 'var(--color-kirmizi)' : undefined}
            >
              {formatSayi(d.maliyet.erzak)}
            </Hap>
          </div>
          <p className="mb-2.5 text-[11.5px] text-solgun">
            İttifaka <strong className="text-altin">+{formatSayi(d.kazandiracakXp)} XP</strong>,
            sana <strong className="text-yesil">+{d.odul.xp} lord XP</strong>.
          </p>

          {engel ? (
            <EngelNotu kisa={engel.kisa} uzun={engel.uzun} />
          ) : (
            <Buton className="w-full" onClick={() => bagis.mutate()} disabled={bagis.isPending}>
              {bagis.isPending ? 'Bağışlanıyor…' : 'Bağış yap'}
            </Buton>
          )}
          {mujde && <p className="mt-2 text-center text-[12px] text-yesil">{mujde}</p>}
          {hata && <p className="mt-2 text-center text-[12px] text-kirmizi">{hata}</p>}
        </div>
      </Kart>

      {/* Seviyenin KARŞILIĞI. Bu tablo olmadan bağış boş bir düğme:
          oyuncu kaynağını neye verdiğini bilmeden vermez. */}
      <Kart className="mt-2 p-3">
        <p className="baslik mb-2 text-[10px] text-sonuk">
          {sonraki ? 'ŞİMDİ / SONRAKİ SEVİYEDE' : 'SEVİYENİN GETİRDİKLERİ'}
        </p>
        <ul className="space-y-1.5">
          {simdiki.map((s, i) => {
            const yeni = sonraki?.[i];
            const degisiyor = yeni && yeni.deger !== s.deger;
            return (
              <li key={s.ad} className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="text-solgun">{s.ad}</span>
                <span className="tabular shrink-0">
                  <span className={degisiyor ? 'text-sonuk' : 'text-parsomen'}>{s.deger}</span>
                  {degisiyor && <span className="text-yesil"> → {yeni.deger}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2.5 border-t border-kenar/70 pt-2 text-[11px] text-sonuk">
          Seviye savaş gücüne ve gelire dokunmaz — yalnız birlikte oynamayı kolaylaştırır.
        </p>
      </Kart>
    </Bolum>
  );
}
