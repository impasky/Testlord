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
import {
  UNIT_TYPES,
  savasSebepleri,
  unitName,
  type Army,
  type SavasSebebi,
  type UnitType,
} from '@lordlar/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api, type BattleDto, type GeneralKatkisiDto, type LordOzetiDto } from '../api/client';
import { BirimIkonu, IkonAltin, IkonDemir, IkonErzak, IkonKapali } from './Ikonlar';
import { Buton, Fark, Kart, Rozet, SonucSatiri, formatSayi, nadirlikRengi } from './ui';

function toplam(a: Army | undefined): number {
  return UNIT_TYPES.reduce((t, u) => t + (a?.[u] ?? 0), 0);
}

/**
 * "Bu savaş bana ne kazandırdı?"
 *
 * Rapor "ne oldu"yu (tur tur güç, kayıp/kalan) baştan beri anlatıyordu ama
 * sonucu anlatmıyordu: oyuncu bölgeyi alıyor, hiçbir sayının değiştiğini
 * görmüyor ve "eee ne oldu şimdi" diye soruyordu. Bu blok raporun EN
 * BAŞINDA durur, çünkü okunacak ilk şey odur. (docs/08 İ2)
 *
 * Değerler savaş anında kaydedilir; sonradan hesaplanmaz. Aradan geçen
 * zamanda şöhret değişmiş olabilir ve rapor o savaşın anlatısı olmalı.
 */
function SavasSonucu({ ozet }: { ozet: LordOzetiDto }) {
  const { oncesi, sonrasi } = ozet;
  const gelirDegisti =
    oncesi.gelir.altin !== sonrasi.gelir.altin ||
    oncesi.gelir.demir !== sonrasi.gelir.demir ||
    oncesi.gelir.erzak !== sonrasi.gelir.erzak;
  const hicDegismedi =
    oncesi.sohret === sonrasi.sohret &&
    oncesi.sira === sonrasi.sira &&
    oncesi.bolgeSayisi === sonrasi.bolgeSayisi &&
    oncesi.seviye === sonrasi.seviye &&
    !gelirDegisti;

  if (hicDegismedi) {
    return (
      <Kart className="p-3">
        <h3 className="baslik mb-1 text-[11px] text-solgun">Sende ne değişti</h3>
        <p className="text-[12px] text-solgun">
          Bu savaş sıralamanı ve gelirini değiştirmedi — kazanılan tek şey tecrübe oldu.
        </p>
      </Kart>
    );
  }

  return (
    <Kart className="p-3" vurgu="var(--color-altin)">
      <h3 className="baslik mb-1.5 text-[11px] text-solgun">Sende ne değişti</h3>
      <SonucSatiri etiket="Şöhretin" vurgu>
        <Fark oncesi={oncesi.sohret} sonrasi={sonrasi.sohret} />
      </SonucSatiri>
      <SonucSatiri etiket="Şöhret sıralaman" vurgu>
        <Fark
          oncesi={oncesi.sira}
          sonrasi={sonrasi.sira}
          birim="."
          tersYon
          bicim={(n) => String(Math.round(n))}
          farkMetni={(f, iyi) => `${f} sıra ${iyi ? 'yukarı' : 'aşağı'}`}
        />
      </SonucSatiri>
      {oncesi.bolgeSayisi !== sonrasi.bolgeSayisi && (
        <SonucSatiri etiket="Bölgelerin">
          <Fark
            oncesi={oncesi.bolgeSayisi}
            sonrasi={sonrasi.bolgeSayisi}
            bicim={(n) => String(Math.round(n))}
          />
        </SonucSatiri>
      )}
      {gelirDegisti && (
        <div className="mt-1 border-t border-kenar/60 pt-1">
          {(['altin', 'demir', 'erzak'] as const).map((k) =>
            oncesi.gelir[k] !== sonrasi.gelir[k] ? (
              <SonucSatiri key={k} etiket={`Saatlik ${GELIR_ADI[k]}`}>
                <Fark oncesi={oncesi.gelir[k]} sonrasi={sonrasi.gelir[k]} />
              </SonucSatiri>
            ) : null,
          )}
        </div>
      )}
      {oncesi.seviye !== sonrasi.seviye && (
        <p className="mt-1.5 text-[12px] font-bold text-altin">
          Seviye atladın: {oncesi.seviye} → {sonrasi.seviye}
        </p>
      )}
    </Kart>
  );
}

const GELIR_ADI = { altin: 'altın', demir: 'demir', erzak: 'erzak' } as const;

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

/** Pasif etkinin okunur adı. Ham anahtar ("ordu_saldiri") oyuncuya bir şey söylemez. */
const ETKI_ADI: Record<string, string> = {
  ordu_saldiri: 'ordu saldırısı',
  ordu_savunma: 'ordu savunması',
  ordu_can: 'ordu canı',
  savunmada_ordu_savunma: 'savunmada ordu savunması',
  okcu_saldiri: 'okçu saldırısı',
  suvari_saldiri: 'süvari saldırısı',
  mizrakci_savunma: 'mızrakçı savunması',
  kusatma_tahkimat: 'kuşatma tahkimat hasarı',
  yagma_bonusu: 'yağma',
  bakim_indirimi: 'bakım indirimi',
  egitim_hizi: 'eğitim hızı',
  uretim_hizi: 'üretim hızı',
};

/**
 * Sahadaki generallerin savaşa ne kattığı.
 *
 * Yetenekler savaş motorunda gerçekten çalışıyordu ama raporda görünmüyordu:
 * oyuncu generali sahaya sürüyor, XP kazandığını görüyor, savaşa ne kattığını
 * göremiyordu. Güçlenme hissinin en görünür olması gereken yer burası.
 */
function GeneralKatkilari({
  generaller,
  taraf,
}: {
  generaller: GeneralKatkisiDto[];
  taraf: string;
}) {
  if (generaller.length === 0) return null;

  return (
    <Kart className="p-3">
      <h3 className="baslik mb-2 text-[11px] text-solgun">{taraf} generalleri</h3>
      <ul className="space-y-2.5">
        {generaller.map((g) => {
          const renk = nadirlikRengi(g.nadirlik);
          return (
            <li key={g.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-bold" style={{ color: renk }}>
                  {g.ad}
                </span>
                <span className="tabular shrink-0 text-[11px] text-solgun">Sv{g.level}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-solgun">
                <span className="text-parsomen">{g.pasifAd}</span> — %
                {Math.round(g.pasifDeger * 100)} {ETKI_ADI[g.pasifEtki] ?? g.pasifEtki}
              </p>
              {g.yetenekAd && (
                <p className="mt-0.5 text-[11px] text-altin">
                  {g.yetenekAd}
                  {g.yetenekAciklama && (
                    <span className="text-solgun"> — {g.yetenekAciklama}</span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Kart>
  );
}


/**
 * "Neden böyle oldu" kartı.
 *
 * Raporun geri kalanı NE olduğunu anlatıyor; bu kart NEDEN olduğunu.
 * Oyuncu neden kaybettiğini bilmiyorsa öğrenemiyor, öğrenemiyorsa oyun
 * stratejiden kumara dönüyor (docs/09 §3.7).
 *
 * Yeni veri istemedi: savaşa giren ordular kayıp + kurtulan toplamından
 * çıkıyor, güç oranı tur tur güçlerden. Tek eklenen alan tahkimat, çünkü
 * bölge sonradan gelişebileceği için geriye dönük hesaplanamıyordu.
 */
function NedenKarti({ savas, saldiranBenim }: { savas: BattleDto; saldiranBenim: boolean }) {
  const l = savas.log;
  const saldiranOrdu = topla(l.attackerLosses, l.attackerSurvivors);
  const savunanOrdu = topla(l.defenderLosses, l.defenderSurvivors);

  const sebepler = savasSebepleri({
    bakis: saldiranBenim ? 'saldiran' : 'savunan',
    saldiranOrdu,
    savunanOrdu,
    turlar: l.rounds,
    saldiranKazandi: savas.result === 'attacker_win',
    eleGecirdi: savas.captured,
    // Eski savaşlarda alan yok; 0 vermek "tahkimat sebep değildi" demek
    // ve o eski raporlar için doğru olan da bu — yanlış bir sayı
    // uydurmaktan iyi.
    tahkimatBonusu: l.tahkimatBonusu ?? 0,
  });

  if (sebepler.length === 0) return null;

  return (
    <Kart className="p-3">
      <h3 className="baslik mb-2 text-[11px] text-solgun">Neden Böyle Oldu</h3>
      <ul className="space-y-1.5">
        {sebepler.map((s, i) => (
          <li key={i} className="flex gap-2 text-[13px]">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background: s.lehte ? 'var(--color-yesil)' : 'var(--color-kirmizi)',
              }}
            />
            <span className="min-w-0 text-solgun">{sebepCumlesi(s)}</span>
          </li>
        ))}
      </ul>
    </Kart>
  );
}

/** İki orduyu toplar: kayıp + kurtulan = savaşa giren. */
function topla(a: Army, b: Army): Army {
  const t: Army = {};
  for (const k of UNIT_TYPES) {
    const n = (a[k] ?? 0) + (b[k] ?? 0);
    if (n > 0) t[k] = n;
  }
  return t;
}

/**
 * Sebebi cümleye çevirir.
 *
 * Cümle burada, `packages/shared`da değil: aynı yapıyı önizlemede ve
 * raporda farklı kiplerde ("kazanırsan" / "kazandın") göstermek
 * isteyebiliriz. Paylaşılan katman veriyi taşıyor, dil arayüzde.
 */
function sebepCumlesi(s: SavasSebebi): ReactNode {
  const g = (x: string) => <strong className="text-parsomen">{x}</strong>;
  switch (s.tur) {
    case 'guc':
      return s.lehte ? (
        <>Gücün savunanın {g(`${s.deger!.toFixed(1)} katıydı`)}.</>
      ) : (
        <>Karşı taraf {g(`${(1 / s.deger!).toFixed(1)} kat`)} güçlüydü.</>
      );
    case 'dar_zafer':
      return (
        <>
          Savaş kazanıldı ama güç payı {g(`%${Math.round(s.deger! * 100)}`)} eşiğine
          ulaşmadı — bölge el değiştirmedi, yalnızca yağma alındı.
        </>
      );
    case 'tahkimat':
      return s.lehte ? (
        <>Tahkimatın savunmaya {g(`+%${Math.round(s.deger! * 100)}`)} kattı.</>
      ) : (
        <>Hedefin tahkimatı savunmaya {g(`+%${Math.round(s.deger! * 100)}`)} kattı.</>
      );
    case 'karsi':
      return s.lehte ? (
        <>
          {g(unitName(s.benim!))} birliklerin {g(unitName(s.onun!))} karşısında{' '}
          {g(`×${s.deger}`)} vurdu.
        </>
      ) : (
        <>
          {g(unitName(s.benim!))} birliklerin {g(unitName(s.onun!))} karşısında{' '}
          {g(`×${s.deger}`)} yedi.
        </>
      );
    case 'kusatma_iyi':
      return <>Mancınıklar tahkimata karşı iki katı iş yaptı.</>;
    case 'kusatma_bosa':
      return (
        <>
          Tahkimat olmadığı için mancınıklar canlı orduya {g('yarım')} vurdu — o
          kaynak boşa gitti.
        </>
      );
  }
}

export function SavasRaporu({
  battleId,
  benimId,
  onKapat,
  onKarsiSaldiri,
}: {
  battleId: string;
  benimId: string;
  onKapat: () => void;
  /** Savunan taraftaysan doğrudan o bölgeye saldırmak için. */
  onKarsiSaldiri?: (regionId: number) => void;
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
  // Rapor okuyanın kendi tarafı: saldıran ve savunan farklı şeyler kazanır.
  const benimOzet = saldiranBenim
    ? (savas?.log.sonuc?.saldiran ?? null)
    : (savas?.log.sonuc?.savunan ?? null);

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
              {/* Sonuç en başta: okunacak ilk şey "bu bana ne kazandırdı".
                  Tur tur güç ve kayıp dökümü "neden oldu"yu anlatır ve
                  aşağıda kalır. */}
              {benimOzet && <SavasSonucu ozet={benimOzet} />}

              {/* "Neden" sonucun hemen altında: oyuncu ne kazandığını
                  gördükten sonra soracağı ilk soru bu. Tur tur güç ve
                  kayıp dökümü kanıtı, bu kart ise okuması. */}
              <NedenKarti savas={savas} saldiranBenim={saldiranBenim} />

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

              <GeneralKatkilari generaller={savas.log.attackerGenerals ?? []} taraf="Saldıran" />
              <GeneralKatkilari generaller={savas.log.defenderGenerals ?? []} taraf="Savunan" />

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

              {/* Karşı saldırı yalnızca savunandayken: saldıran zaten oraya
                  nasıl gideceğini biliyor, savunan ise raporu okuyup
                  haritada bölgeyi elle aramak zorunda kalıyordu. */}
              {!saldiranBenim && onKarsiSaldiri && (
                <Buton tam onClick={() => onKarsiSaldiri(savas.regionId)}>
                  {savas.log.regionName} bölgesine karşı saldır
                </Buton>
              )}

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
