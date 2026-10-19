/**
 * ÜLKEM PANELİ (docs/27) — başladığın ülke: başkenti (tahtı), hükümdarı
 * ve şehirlerin kaçının bir lordun elinde olduğu. Dünya ekranından açılıyor.
 */
import { useQuery } from '@tanstack/react-query';
import { B } from '@lordlar/shared';
import { api } from '../api/client';
import { Bolum, Buton, Hap, Iskelet, Kart, formatSayi } from '../components/ui';

export function Ulkem({ onGit }: { onGit?: (ekran: string) => void }) {
  const sorgu = useQuery({ queryKey: ['ulke'], queryFn: api.ulke });
  if (sorgu.isLoading) return <Iskelet satir={4} />;
  const u = sorgu.data?.ulke;
  if (!u) {
    return (
      <Kart className="p-4 text-[13px] text-solgun">
        Henüz bir ülke seçmedin. Oyunu yeniden açtığında seçim ekranı gelecek.
      </Kart>
    );
  }
  return (
    <div className="space-y-3" data-ulkem={u.kod}>
      <Kart className="space-y-2 p-4">
        <h2 className="baslik text-[18px] text-altin">{u.ad}</h2>
        <div className="flex flex-wrap gap-1.5">
          <Hap renk="var(--color-mavi)">{`${formatSayi(u.sehirSayisi)} şehir`}</Hap>
          <Hap renk="var(--color-yesil)">{`${formatSayi(u.lordSayisi)} lord burada başladı`}</Hap>
          <Hap renk="var(--color-altin)">{`${formatSayi(u.benim)} şehir senin`}</Hap>
        </div>
        <p className="text-[12px] text-solgun">
          {`Şehirlerin ${formatSayi(u.lordlarda)} tanesi bir lordun elinde, gerisi kendi muhafızlarında.`}
        </p>
      </Kart>
      {u.baskent && (
        <Bolum baslik="Başkent — taht">
          <Kart className="space-y-1 p-4">
            <p className="baslik text-[15px] text-parsomen">{u.baskent.ad}</p>
            <p className="text-[12px] text-solgun">
              {u.baskent.hukumdar
                ? `Hükümdar: ${u.baskent.hukumdar.name}`
                : 'Taht boş — ilk alan bu ülkenin hükümdarı olur.'}
            </p>
            <p className="text-[12px] text-solgun">
              {`Tahtı tutan lordun şöhreti %${Math.round(B.taht_kalesi.unvan_sohret_bonusu * 100)} büyür; taht bölge sınırına sayılmaz ve el değiştirince yalnız ${B.taht_kalesi.kaybetme_korumasi_saat} saat korunur.`}
            </p>
          </Kart>
        </Bolum>
      )}
      <Bolum baslik="Sınır kuralı">
        <Kart sakin className="p-4 text-[12px] text-solgun">
          Ülkenin her şehrine saldırabilirsin. Başka bir ülkenin şehrine ancak evinin ya da tuttuğun
          bir şehrin komşusuysa — kara sınırından ya da deniz yolundan.
        </Kart>
      </Bolum>
      {onGit && (
        <Buton tam onClick={() => onGit('harita')}>
          Haritada göster
        </Buton>
      )}
    </div>
  );
}
