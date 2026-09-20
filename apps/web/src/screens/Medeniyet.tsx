/**
 * MEDENİYET EKRANI (docs/16 §7, §9).
 *
 * Oyuncunun tarafını GÖRDÜĞÜ tek yer. Fraksiyon savaşının bütün değeri
 * "benim tarafım nerede duruyor" sorusunun cevaplanabilir olmasında:
 * cevap yoksa medeniyet, kayıt ekranında atanan bir etiketten ibaret
 * kalır.
 *
 * Üç şey anlatıyor:
 *   - Tarafın kim: ad, renk, nüfus, toprak ve dört medeniyetin sıralaması.
 *   - Çekirdekler: dört bonus, seviyeleri ve bir sonraki seviyenin bedeli.
 *   - Bağış: kişisel kasadan ortak olana akıtmanın tek yolu.
 *
 * FAYDA PUANI burada duruyor ama hiçbir şey SATIN ALMIYOR (§9). Bu
 * bilerek: puanla güç satılsaydı çok oynayan daha güçlü olur, daha çok
 * puan kazanır ve kartopu bireysel ölçekte freni olmadan geri dönerdi.
 * Puanın karşılığı kimlik ve içerik — ikisi de sonraki adımların işi.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type CekirdekDto } from '../api/client';
import { Zemin } from '../components/Zemin';
import { BosHal } from '../components/BosHal';
import { Cumle } from '../components/Cumle';
import { hisOnay, hisRet } from '../components/hisGeriBildirimi';
import { IkonAltin, IkonDemir, IkonErzak, IkonKale, IkonSohret } from '../components/Ikonlar';
import {
  Bolum,
  Buton,
  DurumSiridi,
  EngelNotu,
  Hap,
  Input,
  Iskelet,
  Kart,
  formatSayi,
} from '../components/ui';

/** Bonusun oyuncuya ne kattığını tek cümlede söyleyen karşılıklar. */
const BONUS_CUMLESI: Record<string, string> = {
  ambar: 'Medeniyetin herkesinin depo tavanı büyüyor.',
  talimgah: 'Medeniyetin herkesi askerini daha hızlı eğitiyor.',
  sur: 'Medeniyetin tuttuğu bölgeler daha zor alınıyor.',
  ocak: 'Medeniyetin tuttuğu bölgeler daha çok üretiyor.',
};

export function Medeniyet({ onGit }: { onGit?: (ekran: string) => void }) {
  const qc = useQueryClient();
  const sorgu = useQuery({ queryKey: ['medeniyet'], queryFn: api.medeniyet });
  const [acik, setAcik] = useState<number | null>(null);
  /** Taraf değiştirmede onay bekleyen medeniyet — geri dönüşü yok. */
  const [onay, setOnay] = useState<string | null>(null);
  const [altin, setAltin] = useState('');
  const [demir, setDemir] = useState('');
  const [erzak, setErzak] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  /*
   * TARAF DEĞİŞTİR (docs/16 §13 soru 3).
   *
   * Başarınca sayfanın TAMAMI tazeleniyor: medeniyet, harita rengi,
   * lord durumu ve fayda puanı hep birden değişiyor. Yalnız medeniyet
   * sorgusunu tazelemek, haritayı eski tarafın renginde bırakırdı.
   */
  const tarafDegistir = useMutation({
    mutationFn: (key: string) => api.medeniyetDegistir(key),
    onSuccess: (s) => {
      hisOnay();
      setOnay(null);
      setHata(null);
      setBilgi(`${s.medeniyet.ad} tarafına geçtin. ${s.tasinanBolge} bölgen seninle geldi.`);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => {
      setOnay(null);
      setHata(e.message);
    },
  });

  const bagis = useMutation({
    mutationFn: (p: { mapId: number; altin: number; demir: number; erzak: number }) =>
      api.cekirdegeBagisla(p.mapId, { altin: p.altin, demir: p.demir, erzak: p.erzak }),
    onSuccess: (s) => {
      hisOnay();
      setHata(null);
      setBilgi(
        s.atladi
          ? `Çekirdek ${s.seviye}. seviyeye çıktı. +${s.faydaPuani} fayda puanı.`
          : `Bağışın kasaya girdi. +${s.faydaPuani} fayda puanı.`,
      );
      setAltin('');
      setDemir('');
      setErzak('');
      void qc.invalidateQueries({ queryKey: ['medeniyet'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => {
      hisRet();
      setBilgi(null);
      setHata(e instanceof ApiError ? e.message : 'Bağış yapılamadı.');
    },
  });

  if (sorgu.isLoading) return <Iskelet satir={5} />;

  const m = sorgu.data?.medeniyet;
  if (!m) {
    return (
      <div className="space-y-4">
        <Zemin ad="malikane" baslik="Medeniyet" altyazi="Tarafın" />
        <BosHal
          mesaj="Bir medeniyete bağlı değilsin. Yeni açılan lordlar kayıtta bir medeniyete yazılıyor."
          eylemler={onGit ? [{ etiket: 'Haritaya git', onTikla: () => onGit('harita') }] : []}
        />
      </div>
    );
  }

  const gonder = (c: CekirdekDto) => {
    const a = Number(altin) || 0;
    const d = Number(demir) || 0;
    const e = Number(erzak) || 0;
    if (a + d + e <= 0) {
      setHata('Bağış için kaynak gir.');
      return;
    }
    bagis.mutate({ mapId: c.mapId, altin: a, demir: d, erzak: e });
  };

  return (
    <div className="space-y-4">
      <Zemin ad="malikane" baslik={m.ad} altyazi="Medeniyetin" />

      <DurumSiridi>
        <Hap ikon={<IkonKale boyut={13} />} renk={m.renk}>{`${m.bolgeSayisi} bölge`}</Hap>
        <Hap renk="var(--color-mavi)">{`${formatSayi(m.uyeSayisi)} lord`}</Hap>
        <Hap
          ikon={<IkonSohret boyut={13} />}
          renk="var(--color-altin)"
        >{`${formatSayi(m.faydaPuanim)} fayda`}</Hap>
        <Hap renk="var(--color-parsomen)">{m.rutbe.ad}</Hap>
      </DurumSiridi>

      {/*
        RÜTBE: fayda puanının karşılığı (docs/16 §9).

        Puan harcanmıyor, birikiyor ve rütbeye dönüşüyor. Bir dükkân
        açsaydık puanın karşılığı "ne aldın" olurdu; böyle "ne yaptın"
        oluyor — ve §9'un katı kuralı ("güç satın almaz") kendiliğinden
        korunuyor, çünkü rütbenin dokunacağı bir sayı yok.
      */}
      <Kart className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="baslik text-[13px] text-altin">{m.rutbe.ad}</span>
          <span className="tabular shrink-0 text-[11px] text-sonuk">
            {`${formatSayi(m.faydaPuanim)} fayda puanı`}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug text-solgun">{m.rutbe.aciklama}</p>
        {m.rutbe.sonrakiAd && (
          <p className="mt-1 text-[11px] text-sonuk">
            <Cumle
              metin="{0} sonra {1} olacaksın."
              parca={[
                <span className="text-parsomen">
                  {`${formatSayi(m.rutbe.sonrakiEsik! - m.faydaPuanim)} puan`}
                </span>,
                <span className="text-altin">{m.rutbe.sonrakiAd}</span>,
              ]}
            />
          </p>
        )}
      </Kart>

      {/*
        DÖRT TARAFIN SIRALAMASI. Oyuncu kendi medeniyetinin nerede
        durduğunu ancak ötekilere bakarak bilebilir; bu satır olmadan
        "212 bölge" bir şey ifade etmiyor.
      */}
      <Bolum baslik="Diyarın hâli" id="siralama">
        <div className="space-y-1.5">
          {m.siralama.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-gece"
                style={{ background: s.renk }}
                aria-hidden
              />
              <span
                className={`flex-1 text-[13px] ${s.id === m.id ? 'text-altin' : 'text-solgun'}`}
              >
                {s.ad}
                {s.id === m.id ? ' — senin' : ''}
              </span>
              <span className="tabular text-[13px] text-parsomen">{`${s.bolge} bölge`}</span>
            </div>
          ))}
        </div>
      </Bolum>

      {/*
        TARAF DEĞİŞTİRME (docs/16 §13 soru 3).

        Önce mekanizma HİÇ yoktu ve oyuncuya da söylenmiyordu: sessiz bir
        hayırdı, yani oyuncunun kafasında "belki vardır" sonsuza kadar
        yaşıyordu. Kural artık açık ve bedeli de açık.

        Seçenek listesi YALNIZ nüfusu ortalamanın altındaki medeniyetleri
        taşıyor: kazanan tarafa geçilemiyor, yani değişim kartopunu
        büyütemez.
      */}
      <Bolum baslik="Taraf değiştirmek" id="degisim">
        <p className="mb-2 text-[12px] leading-snug text-sonuk">
          <Cumle
            metin="Yalnız {0} bir medeniyete geçebilirsin — kazanan tarafa geçiş yok. Geçersen {1} (puan eski tarafa verdiğin hizmetin kaydı) ve {2} gün boyunca yeniden değiştiremezsin. Toprağın ve kampın seninle gelir."
            parca={[
              <span className="text-parsomen">nüfusu az</span>,
              <span className="text-parsomen">fayda puanın sıfırlanır</span>,
              m.degisim.beklemeGun,
            ]}
          />
        </p>

        {m.degisim.kalanGun > 0 ? (
          <EngelNotu
            kisa="Bekleme sürüyor"
            uzun={`${m.degisim.kalanGun} gün sonra yeniden taraf değiştirebilirsin.`}
          />
        ) : m.degisim.secenekler.length === 0 ? (
          <EngelNotu
            kisa="Şu an geçilebilecek taraf yok"
            uzun="Dört medeniyetin de nüfusu ortalamanın üstünde ya da eşit."
          />
        ) : (
          <div className="space-y-1.5">
            {m.degisim.secenekler.map((s) => (
              <div key={s.id} className="oyuk flex items-center gap-2.5 rounded-xl p-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-gece"
                  style={{ background: s.renk }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="baslik block truncate text-[12.5px] text-parsomen">{s.ad}</span>
                  <span className="block text-[11px] leading-snug text-sonuk">{s.ozet}</span>
                </span>
                <Buton
                  tur="anahat"
                  onClick={() => setOnay(onay === s.id ? null : s.id)}
                  disabled={tarafDegistir.isPending}
                >
                  {onay === s.id ? 'Vazgeç' : 'Geç'}
                </Buton>
              </div>
            ))}
            {/* Geri dönüşü olmayan karar iki dokunuş istiyor: fayda
                puanı sıfırlanıyor ve otuz gün kilitleniyor. */}
            {onay && (
              <Kart className="p-3" vurgu="var(--color-kirmizi)">
                <p className="mb-2 text-[12px] leading-snug text-parsomen">
                  {`${m.degisim.secenekler.find((x) => x.id === onay)?.ad} tarafına geçiyorsun. ${formatSayi(m.faydaPuanim)} fayda puanın silinecek ve ${m.degisim.beklemeGun} gün boyunca geri dönemeyeceksin.`}
                </p>
                <Buton
                  onClick={() => tarafDegistir.mutate(onay)}
                  disabled={tarafDegistir.isPending}
                >
                  Evet, taraf değiştir
                </Buton>
              </Kart>
            )}
          </div>
        )}
      </Bolum>

      <Bolum baslik="Çekirdekler" id="cekirdekler">
        <p className="mb-2 text-[12px] leading-snug text-sonuk">
          <Cumle
            metin="Çekirdekler ele geçirilemez; yalnız geliştirilir. Bonus {0} işliyor — bağış yapmayana da. Bağışın karşılığı fayda puanı."
            parca={[<span className="text-parsomen">medeniyetin herkesine</span>]}
          />
        </p>
        <div className="space-y-2">
          {m.cekirdekler.map((c) => (
            <Kart key={c.mapId} className="p-3">
              <div className="flex items-baseline gap-2">
                <span className="baslik flex-1 truncate text-[14px]">{c.ad}</span>
                <span className="tabular shrink-0 text-[12px] text-altin">
                  {`Sv ${c.seviye}/${c.azamiSeviye}`}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-solgun">
                {c.bonus
                  ? (BONUS_CUMLESI[c.bonus] ?? c.bonusAdi)
                  : 'Medeniyetin başkenti — bonus taşımıyor, kimlik taşıyor.'}
              </p>

              {c.bonus && c.maliyet && (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Hap ikon={<IkonAltin boyut={13} />} renk="var(--color-kaynak-altin)">
                      {`${formatSayi(c.biriken.altin)} / ${formatSayi(c.maliyet.altin)}`}
                    </Hap>
                    <Hap ikon={<IkonDemir boyut={13} />} renk="var(--color-kaynak-demir)">
                      {`${formatSayi(c.biriken.demir)} / ${formatSayi(c.maliyet.demir)}`}
                    </Hap>
                    <Hap ikon={<IkonErzak boyut={13} />} renk="var(--color-kaynak-erzak)">
                      {`${formatSayi(c.biriken.erzak)} / ${formatSayi(c.maliyet.erzak)}`}
                    </Hap>
                  </div>
                  <div className="mt-2">
                    <Buton
                      tur="sessiz"
                      onClick={() => {
                        setAcik(acik === c.mapId ? null : c.mapId);
                        setHata(null);
                        setBilgi(null);
                      }}
                    >
                      {acik === c.mapId ? 'Kapat' : 'Bağış yap'}
                    </Buton>
                  </div>
                </>
              )}

              {c.bonus && !c.maliyet && (
                <p className="mt-2 text-[12px] text-yesil">Azami seviyede — daha fazlası yok.</p>
              )}

              {acik === c.mapId && (
                <div className="mt-2 space-y-2 border-t border-kenar pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      aria-label="Altın bağışı"
                      placeholder="Altın"
                      value={altin}
                      onChange={(e) => setAltin(e.target.value)}
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      aria-label="Demir bağışı"
                      placeholder="Demir"
                      value={demir}
                      onChange={(e) => setDemir(e.target.value)}
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      aria-label="Erzak bağışı"
                      placeholder="Erzak"
                      value={erzak}
                      onChange={(e) => setErzak(e.target.value)}
                    />
                  </div>
                  <Buton onClick={() => gonder(c)} disabled={bagis.isPending} tam>
                    Gönder
                  </Buton>
                  {hata && (
                    <EngelNotu kisa={hata} uzun="Kaynağını ve bağış miktarını kontrol et." />
                  )}
                  {bilgi && <p className="text-[12px] text-yesil">{bilgi}</p>}
                </div>
              )}
            </Kart>
          ))}
        </div>
      </Bolum>
    </div>
  );
}
