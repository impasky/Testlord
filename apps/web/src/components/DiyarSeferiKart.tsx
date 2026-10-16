/**
 * Hafta sonu diyar seferi kartı (docs/09 §2.6).
 *
 * Haftalık sefer kartının ortak eşi: çubuk oyuncunun değil DİYARIN.
 * "Senin katkın" ayrıca yazıyor ki oyuncu ortak çubuğa kendi elinin
 * değdiğini görsün. Sıralama yok: hedefe varılınca katılan herkes alıyor.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { IkonAltin, IkonDemir, IkonErzak } from './Ikonlar';
import { Bolum, Buton, Ilerleme, Kart, formatKalan, formatSayi } from './ui';

export function DiyarSeferiKart() {
  const q = useQuery({
    queryKey: ['diyar-etkinligi'],
    queryFn: api.diyarEtkinligi,
    staleTime: 60_000,
  });
  const qc = useQueryClient();
  const al = useMutation({
    mutationFn: api.diyarEtkinligiOdul,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['diyar-etkinligi'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
  if (!q.data) return null;

  const { etkinlik: e, hedef, toplam, katkim, odul } = q.data;
  const tuttu = toplam >= hedef;
  const renk = tuttu ? 'var(--color-yesil)' : 'var(--color-mor)';
  const simdi = Date.now();
  const zaman =
    e.durum === 'yaklasiyor'
      ? `Cumartesi başlıyor · ${formatKalan(new Date(e.bas).getTime() - simdi)}`
      : e.durum === 'acik'
        ? `${formatKalan(new Date(e.son).getTime() - simdi)} kaldı`
        : 'Bitti · ödül bugün alınabilir';

  return (
    <Bolum baslik="Hafta Sonu Diyar Seferi">
      <Kart className="p-3" vurgu={renk}>
        <div data-diyar-seferi={e.durum}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="baslik text-[13px] text-parsomen">{e.ad}</h3>
            <span className="tabular shrink-0 text-[11px] text-solgun">{zaman}</span>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-sonuk">{e.aciklama}</p>

          {e.durum !== 'yaklasiyor' && (
            <>
              <div className="mt-2 flex items-center gap-2">
                <span className="tabular shrink-0 text-[12px] text-parsomen">
                  {`${formatSayi(toplam)}/${formatSayi(hedef)}`}{' '}
                  <span className="text-solgun">{e.birim}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <Ilerleme
                    deger={Math.min(1, toplam / Math.max(1, hedef))}
                    max={1}
                    renk={renk}
                    boy="ince"
                  />
                </div>
              </div>
              <p className="mt-1 text-[11px] text-solgun">
                {`Diyarın hep birlikte · senin katkın: ${formatSayi(katkim)}`}
              </p>
            </>
          )}
          {e.durum === 'yaklasiyor' && (
            <p className="mt-2 text-[11px] text-solgun">
              {`Hedef diyarın nüfusuyla ölçülüyor: şimdilik ${formatSayi(hedef)} ${e.birim}. Hafta sonu bütün lordlar aynı çubuğu dolduruyor.`}
            </p>
          )}

          <div className="mt-2.5 border-t border-kenar/70 pt-2.5">
            <span className="baslik text-[11px] text-solgun">Katılan herkese ödül</span>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <span className="flex items-center gap-1">
                <span className="text-altin">
                  <IkonAltin boyut={13} />
                </span>
                <span className="tabular font-bold">{formatSayi(odul.kaynak.altin)}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-mavi">
                  <IkonDemir boyut={13} />
                </span>
                <span className="tabular font-bold">{formatSayi(odul.kaynak.demir)}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-yesil">
                  <IkonErzak boyut={13} />
                </span>
                <span className="tabular font-bold">{formatSayi(odul.kaynak.erzak)}</span>
              </span>
            </div>

            {odul.alindi ? (
              <p className="mt-2 text-[12px] text-yesil">Ödülünü aldın. Diyar seni andı.</p>
            ) : odul.hakEdildi ? (
              <>
                <Buton
                  tur="altin"
                  tam
                  className="mt-2"
                  onClick={() => al.mutate()}
                  disabled={al.isPending}
                >
                  {al.isPending ? 'Alınıyor…' : 'Diyar ödülünü al'}
                </Buton>
                {al.data?.kirpildi && (
                  <p className="mt-1.5 text-[11px] text-turuncu">
                    Deponun bir kısmı doluydu; sığan kadarı verildi.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-[12px] text-sonuk">
                {odul.engel === 'kapali'
                  ? 'Hafta sonu başlıyor; o zamana kadar ordunu hazırla.'
                  : odul.engel === 'katki'
                    ? 'Diyar hedefe vardı. Sen de katkı yap, ödül senin de.'
                    : `Hedefe ${formatSayi(Math.max(0, hedef - toplam))} kaldı — diyarın hep birlikte.`}
              </p>
            )}
          </div>
        </div>
      </Kart>
    </Bolum>
  );
}
