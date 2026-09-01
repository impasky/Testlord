/**
 * Savaş raporu — alt sayfa olarak açılan modal.
 *
 * Ekran değil modal: docs/01 §9'da yedi ekran sayılı ve savaş raporu onlardan
 * biri değil. Harita ve Malikâne'den açılır, kendi sekmesi yoktur.
 *
 * Rapor iki soruya cevap vermeli: "ne oldu" ve "neden oldu". Sonuç rozeti
 * ilkini, tur tur güç çubukları ikincisini anlatır — savaşı kaybettiysen
 * hangi turda üstünlüğü kaybettiğini görürsün. Kayıp/kalan dökümü de
 * birimlerin ucuzdan pahalıya öldüğünü gözle doğrulatır.
 */
import { UNIT_TYPES, unitName, type Army, type UnitType } from '@lordlar/shared';
import { useQuery } from '@tanstack/react-query';
import { api, type BattleDto } from '../api/client';
import { BirimIkonu, IkonAltin, IkonDemir, IkonErzak, IkonKapali } from './Ikonlar';
import { Kart, Rozet, formatSayi } from './ui';

function toplam(a: Army | undefined): number {
  return UNIT_TYPES.reduce((t, u) => t + (a?.[u] ?? 0), 0);
}

/** Tur tur güç çubukları: savaşın nerede döndüğünü gösterir. */
function TurCubuklari({ turlar }: { turlar: BattleDto['log']['rounds'] }) {
  const enBuyuk = Math.max(1, ...turlar.flatMap((t) => [t.saldiranGuc, t.savunanGuc]));

  return (
    <div className="space-y-2.5">
      {turlar.map((t) => {
        const saldiranOnde = t.saldiranGuc >= t.savunanGuc;
        return (
          <div key={t.tur}>
            <div className="mb-1 flex items-baseline justify-between text-[10px] text-sonuk">
              <span className="baslik">TUR {t.tur}</span>
              <span className="tabular">
                {formatSayi(Math.round(t.saldiranGuc))} — {formatSayi(Math.round(t.savunanGuc))}
              </span>
            </div>
            {/* İki çubuk aynı ölçekte: yan yana bakınca hangi taraf önde belli olur */}
            <div className="space-y-1">
              <div className="oyuk h-2 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${saldiranOnde ? 'bg-altin' : 'bg-altin/45'}`}
                  style={{ width: `${(t.saldiranGuc / enBuyuk) * 100}%` }}
                />
              </div>
              <div className="oyuk h-2 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${saldiranOnde ? 'bg-kirmizi/45' : 'bg-kirmizi'}`}
                  style={{ width: `${(t.savunanGuc / enBuyuk) * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Bir tarafın birim dökümü: kaybettiği ve sağ kalan. */
function TarafKarti({
  baslik,
  ad,
  kayip,
  kalan,
  vurgu,
}: {
  baslik: string;
  ad: string;
  kayip: Army;
  kalan: Army;
  vurgu?: string;
}) {
  const gorunen = UNIT_TYPES.filter((u) => (kayip[u] ?? 0) > 0 || (kalan[u] ?? 0) > 0);

  return (
    <Kart className="p-3" vurgu={vurgu}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="baslik text-[11px] text-solgun">{baslik}</h3>
        <span className="min-w-0 truncate text-[12px] font-bold">{ad}</span>
      </div>

      {gorunen.length === 0 ? (
        <p className="text-[12px] text-solgun">Birlik yok.</p>
      ) : (
        <>
          <div className="mb-1 flex items-baseline gap-2 text-[10px] text-sonuk">
            <span className="flex-1" />
            <span className="baslik w-12 text-right">KAYIP</span>
            <span className="baslik w-12 text-right">KALAN</span>
          </div>
          <ul className="space-y-1">
            {gorunen.map((u) => (
              <li key={u} className="flex items-center gap-2 text-[13px]">
                <span className="text-altin/70">
                  <BirimIkonu tip={u} boyut={16} />
                </span>
                <span className="min-w-0 flex-1 truncate">{unitName(u as UnitType)}</span>
                <span className="tabular w-12 text-right text-kirmizi">
                  {kayip[u] ? `−${kayip[u]}` : '—'}
                </span>
                <span className="tabular w-12 text-right font-bold">{kalan[u] ?? 0}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Kart>
  );
}

export function SavasRaporu({
  battleId,
  benimId,
  onKapat,
}: {
  battleId: string;
  benimId: string;
  onKapat: () => void;
}) {
  const { data: savas, isError } = useQuery({
    queryKey: ['battle', battleId],
    queryFn: () => api.battle(battleId),
  });

  // Rapor bakanın gözünden okunur: aynı savaş saldıran için zafer,
  // savunan için yenilgidir. Sabit "saldıran kazandı" ifadesi, savunan
  // oyuncuya kendi yenilgisini zafer gibi gösterirdi.
  const saldiranBenim = savas?.attackerLordId === benimId;
  const kazandim = savas ? (savas.result === 'attacker_win') === saldiranBenim : false;
  const yagma = savas?.log.loot;
  const yagmaVar = yagma && (yagma.altin || yagma.demir || yagma.erzak);

  return (
    <>
      <button className="fixed inset-0 z-40 bg-black/70" onClick={onKapat} aria-label="Kapat" />
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[86dvh] max-w-lg overflow-y-auto rounded-t-2xl border-t border-kenar bg-panel"
        style={{ paddingBottom: 'calc(var(--alt-bar) + 12px)' }}
      >
        <div className="sticky top-0 z-10 border-b border-kenar bg-panel px-4 pt-3 pb-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-kenar" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="baslik truncate text-[15px]">
                {savas ? savas.log.regionName : 'Savaş Raporu'}
              </h2>
              <p className="text-[11px] text-solgun">
                {savas
                  ? new Date(savas.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'yükleniyor…'}
              </p>
            </div>
            <button onClick={onKapat} className="bas shrink-0 text-solgun" aria-label="Kapat">
              <IkonKapali boyut={20} />
            </button>
          </div>

          {savas && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Rozet renk={kazandim ? 'var(--color-yesil)' : 'var(--color-kirmizi)'}>
                {kazandim ? 'ZAFER' : 'YENİLGİ'}
              </Rozet>
              <Rozet renk="var(--color-mavi)">{saldiranBenim ? 'SALDIRAN' : 'SAVUNAN'}</Rozet>
              {savas.captured && <Rozet renk="var(--color-altin)">BÖLGE EL DEĞİŞTİRDİ</Rozet>}
            </div>
          )}
        </div>

        <div className="space-y-3 px-4 pt-3">
          {isError && (
            <Kart className="p-4">
              <p className="text-[13px] text-solgun">Rapor açılamadı.</p>
            </Kart>
          )}

          {savas && (
            <>
              <Kart className="p-3">
                <h3 className="baslik mb-2.5 text-[11px] text-solgun">
                  Tur Tur Güç · {savas.log.rounds.length} tur
                </h3>
                <TurCubuklari turlar={savas.log.rounds} />
                <p className="mt-2.5 text-[10px] text-sonuk">
                  Üstteki çubuk saldıran, alttaki savunan.
                </p>
              </Kart>

              <TarafKarti
                baslik="SALDIRAN"
                ad={savas.attacker.name}
                kayip={savas.log.attackerLosses}
                kalan={savas.log.attackerSurvivors}
                vurgu={saldiranBenim ? 'var(--color-altin)' : undefined}
              />
              <TarafKarti
                baslik="SAVUNAN"
                ad={savas.defender?.name ?? 'Garnizon'}
                kayip={savas.log.defenderLosses}
                kalan={savas.log.defenderSurvivors}
                vurgu={!saldiranBenim ? 'var(--color-altin)' : undefined}
              />

              {yagmaVar ? (
                <Kart className="p-3">
                  <h3 className="baslik mb-2 text-[11px] text-solgun">Yağma</h3>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
                    <span className="flex items-center gap-1.5">
                      <span className="text-altin">
                        <IkonAltin boyut={15} />
                      </span>
                      <span className="tabular font-bold">
                        {formatSayi(Math.round(yagma.altin ?? 0))}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-mavi">
                        <IkonDemir boyut={15} />
                      </span>
                      <span className="tabular font-bold">
                        {formatSayi(Math.round(yagma.demir ?? 0))}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-yesil">
                        <IkonErzak boyut={15} />
                      </span>
                      <span className="tabular font-bold">
                        {formatSayi(Math.round(yagma.erzak ?? 0))}
                      </span>
                    </span>
                  </div>
                </Kart>
              ) : null}

              <p className="pb-1 text-center text-[10px] text-sonuk">
                Toplam {formatSayi(toplam(savas.log.attackerLosses) + toplam(savas.log.defenderLosses))}{' '}
                birim öldü · tohum {savas.seed.slice(0, 12)}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
