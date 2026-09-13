/**
 * Malikâne pazarı: fazla kaynağı eksiğe çevirir.
 *
 * Oyuncunun ölçülmüş şikâyeti: "kazançlar orantısız, altın deposu dolu
 * ama demir ve erzak yok." Sebep bölgelerin TEK kaynak üretmesi ve
 * Lv15'e kadar tek bölge tutulabilmesi — şehir alan oyuncunun demiri
 * saatlerce darboğaz kalırken altını taşıyor.
 *
 * Ekran tek bir soruyu cevaplıyor: "ne kadar verirsem ne kadar alırım?"
 * Sonuç, düğmeye basmadan önce yazılı.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KAYNAK_ADI,
  KAYNAK_TURLERI,
  takasEngeli,
  takasHesapla,
  type KaynakTuru,
} from '@lordlar/shared';

/** Başlık konumunda büyük harfle: "altın" -> "Altın". */
function buyukBasla(s: string): string {
  return s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);
}
import { api, ApiError } from '../api/client';
import { hisOnay, hisRet } from './hisGeriBildirimi';
import { IkonAltin, IkonDemir, IkonErzak } from './Ikonlar';
import { Buton, Input, Kart, formatSayi } from './ui';

function KaynakIkonu({ tur, boyut = 13 }: { tur: KaynakTuru; boyut?: number }) {
  if (tur === 'altin') return <IkonAltin boyut={boyut} />;
  if (tur === 'demir') return <IkonDemir boyut={boyut} />;
  return <IkonErzak boyut={boyut} />;
}

export function Pazar() {
  const qc = useQueryClient();
  const [veren, setVeren] = useState<KaynakTuru>('altin');
  const [alan, setAlan] = useState<KaynakTuru>('demir');
  const [miktar, setMiktar] = useState('');
  const [hata, setHata] = useState<string | null>(null);

  const durum = useQuery({ queryKey: ['pazar'], queryFn: api.pazar });

  const sayi = Number(miktar) || 0;
  const sonuc = useMemo(
    () => (veren === alan ? null : takasHesapla(veren, alan, sayi)),
    [veren, alan, sayi],
  );

  // Engel motordan: sunucu da aynı cümleyi kullanıyor, ikisi ayrışamıyor.
  const engel = durum.data
    ? takasEngeli({
        veren,
        alan,
        miktar: sayi,
        eldeki: durum.data.kaynaklar,
        bugunkuHacim: durum.data.gunluk.kullanilan,
        // Tavan SUNUCUDAN geliyor; arayüz onu yeniden hesaplamıyor.
        gunlukTavan: durum.data.gunluk.tavan,
      })
    : null;

  const takas = useMutation({
    mutationFn: () => api.pazarTakas(veren, alan, sayi),
    onSuccess: () => {
      hisOnay();
      setMiktar('');
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['pazar'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Takas yapılamadı.');
    },
  });

  if (!durum.data) return null;
  const { kaynaklar, gunluk, komisyon } = durum.data;

  /** Karşı tarafı da değiştiren seçim: aynı kaynak ikisinde birden duramaz. */
  function verenSec(t: KaynakTuru) {
    setVeren(t);
    if (alan === t) setAlan(KAYNAK_TURLERI.find((k) => k !== t)!);
  }
  function alanSec(t: KaynakTuru) {
    setAlan(t);
    if (veren === t) setVeren(KAYNAK_TURLERI.find((k) => k !== t)!);
  }

  return (
    <Kart className="p-3">
      <div className="flex items-baseline justify-between">
        {/* Ekranın doğrudan altında duran bir bölüm başlığı: h2.
            h3 bırakmak h1'den sonra bir seviye atlamak demekti ve
            ekran okuyucu kullanıcısının başlıklarla gezinmesini
            bozuyordu (erisim-denetim.mjs yakaladı). */}
        <h2 className="baslik text-[11px] text-solgun">Pazar</h2>
        <span className="text-[11px] text-sonuk">komisyon %{Math.round(komisyon * 100)}</span>
      </div>
      <p className="mt-0.5 text-[12px] leading-snug text-solgun">
        Elinde biriken kaynağı eksiğine çevir. Tüccar payını alır — doğru bölgeyi almak hâlâ daha
        kârlı.
      </p>

      <div className="mt-2.5 space-y-2">
        <div>
          <span className="baslik text-[10px] text-sonuk">VERECEĞİN</span>
          <div className="mt-1 flex gap-1.5">
            {KAYNAK_TURLERI.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => verenSec(t)}
                /*
                  Miktar KENDİ SATIRINDA ve kutu daralabiliyor (`min-w-0`).
                  Tek satırdayken üç kutu 390 pikseli aşıyordu: stok altı
                  haneye çıkınca ("108.166") üçüncüsü panelin kenarından
                  taşıp kesiliyordu — telefonda ölçüldü, "Erzak 103.51"
                  diye yarım yazıyordu.
                */
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-[12px] ${
                  veren === t ? 'border-altin bg-altin/15 text-altin' : 'border-cerceve text-metin'
                }`}
              >
                <span className="flex items-center gap-1">
                  <KaynakIkonu tur={t} />
                  {buyukBasla(KAYNAK_ADI[t])}
                </span>
                <span className="tabular w-full truncate text-center text-[11px] text-sonuk">
                  {formatSayi(kaynaklar[t])}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="baslik text-[10px] text-sonuk">ALACAĞIN</span>
          <div className="mt-1 flex gap-1.5">
            {KAYNAK_TURLERI.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => alanSec(t)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[12px] ${
                  alan === t ? 'border-yesil bg-yesil/15 text-yesil' : 'border-cerceve text-metin'
                }`}
              >
                <KaynakIkonu tur={t} />
                {buyukBasla(KAYNAK_ADI[t])}
              </button>
            ))}
          </div>
        </div>

        <Input
          type="number"
          inputMode="numeric"
          placeholder={`En az ${durum.data.enAzMiktar}`}
          value={miktar}
          onChange={(e) => setMiktar(e.target.value)}
        />

        {/* Sonuç düğmeye BASMADAN önce yazılı. */}
        {sonuc && sayi > 0 && (
          <p className="text-[13px]">
            <span className="text-altin">
              {formatSayi(sonuc.verilen)} {KAYNAK_ADI[veren]}
            </span>{' '}
            <span className="text-solgun">→</span>{' '}
            <span className="text-yesil">
              {formatSayi(sonuc.alinan)} {KAYNAK_ADI[alan]}
            </span>
          </p>
        )}

        <Buton
          tam
          disabled={takas.isPending || engel !== null || sayi <= 0}
          onClick={() => takas.mutate()}
        >
          {takas.isPending ? 'Takas ediliyor…' : 'Takas et'}
        </Buton>

        {(hata ?? engel?.mesaj) && sayi > 0 && (
          <p className="text-[12px] text-kirmizi">{hata ?? engel?.mesaj}</p>
        )}

        <p className="text-[11px] text-sonuk">
          Bugünkü pazar hakkın: {formatSayi(gunluk.kalan)} / {formatSayi(gunluk.tavan)} altın
          karşılığı.
        </p>
      </div>
    </Kart>
  );
}
