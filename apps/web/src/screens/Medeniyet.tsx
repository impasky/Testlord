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
  const [altin, setAltin] = useState('');
  const [demir, setDemir] = useState('');
  const [erzak, setErzak] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

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
      </DurumSiridi>

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

      <Bolum baslik="Çekirdekler" id="cekirdekler">
        <p className="mb-2 text-[12px] leading-snug text-sonuk">
          Çekirdekler ele geçirilemez; yalnız geliştirilir. Bonus{' '}
          <span className="text-parsomen">medeniyetin herkesine</span> işliyor — bağış yapmayana da.
          Bağışın karşılığı fayda puanı.
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
