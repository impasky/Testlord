/**
 * Pazar kapısı (docs/19): eşya pazarı ve kaynak takası.
 *
 * Eşya pazarı oyuncular arası ama ANONİM: kimse kiminle alışveriş
 * ettiğini görmüyor. Ekranın cevapladığı tek soru her yerde aynı:
 * "bu fiyata ne olur?" — hemen mi satılır, sıraya mı girer, kuyruğa mı
 * girer, kasana ne kadar düşer. Cevap düğmeye BASMADAN önce yazılı.
 *
 * Dört sekme, dört iş: al, sat, emirlerim, kaynak takası. Takas
 * Malikâne'de de duruyor — Pazar binası dikilmemiş lord onu oradan buluyor.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { EQUIP_SLOTS, NADIRLIK_ADI, RARITIES, YUVA_ADI, type EquipSlot } from '@lordlar/shared';
import {
  ApiError,
  api,
  type EsyaPazariDto,
  type PazarEmriDto,
  type UrunDefteriDto,
  type UrunDto,
} from '../api/client';
import { Cumle } from '../components/Cumle';
import { hisOnay, hisRet } from '../components/hisGeriBildirimi';
import { Pazar } from '../components/Pazar';
import {
  AltSekmeler,
  Bolum,
  Buton,
  GeriSayim,
  Iskelet,
  Kart,
  Rozet,
  formatSayi,
  nadirlikRengi,
} from '../components/ui';

type PazarSekmesi = 'al' | 'sat' | 'emirler' | 'takas';

const anahtar = (u: UrunDto) => `${u.slot}:${u.tier}:${u.rarity}:${u.upgradeLevel}`;

function hataMetni(e: unknown, yedek: string): string {
  return e instanceof ApiError ? e.message : yedek;
}

export function EsyaPazari({ lordSeviyesi }: { lordSeviyesi: number }) {
  const [sekme, setSekme] = useState<PazarSekmesi>('al');
  const veri = useQuery({ queryKey: ['esyaPazari'], queryFn: api.esyaPazari });

  if (!veri.data) return <Iskelet satir={5} />;
  const d = veri.data;
  const emirSayisi = d.ilanlarim.length + d.siparislerim.length;

  return (
    <div className="space-y-4">
      <Kasa d={d} />
      <AltSekmeler
        sekmeler={[
          { key: 'al', ad: 'Al' },
          { key: 'sat', ad: 'Sat' },
          { key: 'emirler', ad: 'Emirlerim', sayi: emirSayisi },
          { key: 'takas', ad: 'Takas' },
        ]}
        etkin={sekme}
        onSec={setSekme}
      />
      {sekme === 'al' && <AlSekmesi d={d} lordSeviyesi={lordSeviyesi} />}
      {sekme === 'sat' && <SatSekmesi d={d} />}
      {sekme === 'emirler' && <Emirlerim d={d} />}
      {sekme === 'takas' && <Pazar />}
    </div>
  );
}

/* ── Kasa ────────────────────────────────────────────────────────── */

/**
 * Satıştan gelen altın önce KASAYA giriyor: depo doluysa silinmesin.
 * Oyuncu yer açınca alıyor; ön sipariş verirken de önce kasadan ödeniyor.
 */
function Kasa({ d }: { d: EsyaPazariDto }) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const al = useMutation({
    mutationFn: api.esyaKasaAl,
    onSuccess: () => {
      hisOnay();
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['esyaPazari'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => {
      hisRet();
      setHata(hataMetni(e, 'Kasadan alınamadı.'));
    },
  });

  return (
    <Kart className="p-3" sakin={d.kasa === 0}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="baslik text-[11px] text-solgun">Pazar kasası</h2>
          <div className="tabular text-[18px] leading-tight font-bold text-altin">
            {`${formatSayi(d.kasa)} altın`}
          </div>
        </div>
        <Buton
          boy="kucuk"
          disabled={d.kasa === 0 || d.depoBos === 0 || al.isPending}
          onClick={() => al.mutate()}
        >
          {al.isPending ? 'Alınıyor…' : 'Depoya al'}
        </Buton>
      </div>
      <p className="mt-1 text-[11px] text-sonuk">
        {d.kasa > 0 && d.depoBos === 0
          ? 'Deponda altın için yer yok. Kasadaki altın bekler, kaybolmaz.'
          : `Deponda ${formatSayi(d.depoBos)} altın yeri var. Emanette ${formatSayi(d.emanette)} altın.`}
      </p>
      {hata && <p className="mt-1 text-[12px] text-kirmizi">{hata}</p>}
    </Kart>
  );
}

/* ── Al ──────────────────────────────────────────────────────────── */

function AlSekmesi({ d, lordSeviyesi }: { d: EsyaPazariDto; lordSeviyesi: number }) {
  const [secili, setSecili] = useState<UrunDto | null>(null);
  const [slot, setSlot] = useState<EquipSlot>('silah');
  const [tier, setTier] = useState(1);
  const [rarity, setRarity] = useState('siradan');
  const [upgradeLevel, setUpgradeLevel] = useState(0);

  if (secili) {
    return <UrunEkrani urun={secili} yon="al" onGeri={() => setSecili(null)} />;
  }

  return (
    <div className="space-y-4">
      <Bolum baslik="Satışta" sakin={d.vitrin.length === 0}>
        {d.vitrin.length === 0 ? (
          <p className="text-[12px] text-sonuk">
            Diyarında şu an satışta eşya yok. Aşağıdan istediğin ürüne ön sipariş verebilirsin; biri
            o fiyata sattığında eşya senin olur.
          </p>
        ) : (
          <div className="space-y-1.5">
            {d.vitrin.map((v) => (
              <UrunSatiri
                key={anahtar(v.urun)}
                urun={v.urun}
                ad={v.ad}
                sag={
                  v.enUcuz !== null
                    ? `${formatSayi(v.enUcuz)} altından · ${v.adet}`
                    : `kayıt kuyruğunda · ${v.kuyrukta}`
                }
                onSec={() => setSecili(v.urun)}
              />
            ))}
          </div>
        )}
      </Bolum>

      <Bolum baslik="Ürün seç">
        <Kart className="space-y-2.5 p-3">
          <Secici
            etiket="YUVA"
            secenekler={EQUIP_SLOTS.map((s) => ({ key: s, ad: YUVA_ADI[s] }))}
            deger={slot}
            onSec={(s) => setSlot(s as EquipSlot)}
          />
          <Secici
            etiket="KADEME"
            secenekler={[1, 2, 3, 4, 5].map((t) => ({ key: String(t), ad: `T${t}` }))}
            deger={String(tier)}
            onSec={(t) => setTier(Number(t))}
          />
          <Secici
            etiket="NADİRLİK"
            secenekler={RARITIES.map((r) => ({
              key: r,
              ad: NADIRLIK_ADI[r],
              renk: nadirlikRengi(r),
            }))}
            deger={rarity}
            onSec={setRarity}
          />
          <div>
            <span className="baslik text-[10px] text-sonuk">YÜKSELTME</span>
            <div className="mt-1 flex items-center gap-2">
              <Buton
                boy="kucuk"
                tur="sessiz"
                etiket="Yükseltmeyi azalt"
                className="min-h-11 min-w-11"
                onClick={() => setUpgradeLevel((n) => Math.max(0, n - 1))}
              >
                −
              </Buton>
              <span className="tabular baslik w-10 text-center text-[14px]">{`+${upgradeLevel}`}</span>
              <Buton
                boy="kucuk"
                tur="sessiz"
                etiket="Yükseltmeyi artır"
                className="min-h-11 min-w-11"
                onClick={() => setUpgradeLevel((n) => Math.min(10, n + 1))}
              >
                +
              </Buton>
            </div>
          </div>
          <Buton tam onClick={() => setSecili({ slot, tier, rarity, upgradeLevel })}>
            Defteri aç
          </Buton>
          {lordSeviyesi < 10 && (
            <p className="text-[11px] text-sonuk">
              Pazardan yalnız seviyenin açtığı kademeyi alabilirsin — dövebildiğin kadarını.
            </p>
          )}
        </Kart>
      </Bolum>
    </div>
  );
}

function Secici({
  etiket,
  secenekler,
  deger,
  onSec,
}: {
  etiket: string;
  secenekler: { key: string; ad: string; renk?: string }[];
  deger: string;
  onSec: (k: string) => void;
}) {
  return (
    <div>
      <span className="baslik text-[10px] text-sonuk">{etiket}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {secenekler.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSec(s.key)}
            aria-pressed={deger === s.key}
            className={`min-h-10 min-w-10 rounded-lg border px-2.5 py-1.5 text-[12px] ${
              deger === s.key ? 'border-altin bg-altin/15 text-altin' : 'border-cerceve text-metin'
            }`}
            style={deger !== s.key && s.renk ? { color: s.renk } : undefined}
          >
            {s.ad}
          </button>
        ))}
      </div>
    </div>
  );
}

function UrunSatiri({
  urun,
  ad,
  sag,
  onSec,
}: {
  urun: UrunDto;
  ad: string;
  sag: string;
  onSec: () => void;
}) {
  return (
    <Kart className="px-3 py-2.5" vurgu={nadirlikRengi(urun.rarity)} onClick={onSec}>
      <div className="flex items-center justify-between gap-2">
        <span className="baslik truncate text-[13px]" style={{ color: nadirlikRengi(urun.rarity) }}>
          {ad}
        </span>
        <span className="tabular shrink-0 text-[12px] text-solgun">{sag}</span>
      </div>
    </Kart>
  );
}

/* ── Ürün ekranı: defter + fiyat + eylem ─────────────────────────── */

/**
 * Bir ürünün defteri ve ona verilecek emir.
 *
 * `yon`: al → ön sipariş / hemen al; sat → ilan / hemen sat (itemId ile).
 * Fiyat defterin satırına dokunarak seçiliyor: satır hem bilgi hem düğme.
 */
function UrunEkrani({
  urun,
  yon,
  itemId,
  onGeri,
}: {
  urun: UrunDto;
  yon: 'al' | 'sat';
  itemId?: string;
  onGeri: () => void;
}) {
  const qc = useQueryClient();
  const defter = useQuery({
    queryKey: ['esyaPazariUrun', anahtar(urun)],
    queryFn: () => api.esyaPazariUrun(urun),
  });
  const [basamak, setBasamak] = useState<number | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<string | null>(null);

  // Varsayılan fiyat: hemen gerçekleşecek en iyi fiyat, yoksa taban.
  useEffect(() => {
    if (!defter.data || basamak !== null) return;
    const df = defter.data;
    const karsi = yon === 'al' ? df.enUcuzIlan : df.enYuksekSiparis;
    setBasamak(karsi?.basamak ?? df.taban.basamak);
  }, [defter.data, basamak, yon]);

  const gonder = useMutation({
    mutationFn: async (): Promise<string> => {
      if (basamak === null) throw new Error('Fiyat seçilmedi.');
      if (yon === 'sat' && itemId) {
        const r = await api.esyaIlanVer(itemId, basamak);
        if (r.durum === 'satildi') {
          return `Satıldı: ${formatSayi(r.fiyat)} altın. Vergi ${formatSayi(r.vergi ?? 0)}, kasana ${formatSayi(r.net ?? 0)} altın girdi.`;
        }
        if (r.durum === 'kuyrukta') {
          return 'Kayıt kuyruğunda. Süre bitince bekleyen alıcılar arasında kura çekilir.';
        }
        return `İlana kondu: ${formatSayi(r.fiyat)} altın. Alıcı çıkınca kasana düşer.`;
      }
      const r = await api.esyaSiparisVer(urun, basamak);
      return r.durum === 'alindi'
        ? `Alındı: ${formatSayi(r.fiyat)} altın ödendi. Eşya envanterinde.`
        : `Ön sipariş verildi: ${formatSayi(r.fiyat)} altın emanette. Satan çıkınca eşya senin.`;
    },
    onSuccess: (metin) => {
      hisOnay();
      setHata(null);
      setSonuc(metin);
      void qc.invalidateQueries({ queryKey: ['esyaPazari'] });
      void qc.invalidateQueries({ queryKey: ['esyaPazariUrun'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (e) => {
      hisRet();
      setHata(hataMetni(e, 'Emir verilemedi.'));
    },
  });

  if (!defter.data) return <Iskelet satir={6} />;
  const df = defter.data;
  const secili = basamak ?? df.taban.basamak;
  const satir = df.defter.find((s) => s.basamak === secili);
  const fiyat = satir?.fiyat ?? df.taban.fiyat;

  return (
    <div className="space-y-3">
      <button type="button" onClick={onGeri} className="bas text-[12px] text-solgun">
        ← Geri
      </button>
      <Kart className="p-3" vurgu={nadirlikRengi(urun.rarity)}>
        <h2 className="baslik text-[14px]" style={{ color: nadirlikRengi(urun.rarity) }}>
          {df.ad}
        </h2>
        <p className="mt-0.5 text-[12px] text-solgun">
          {`Güç ${formatSayi(df.guc)} · taban ${formatSayi(df.taban.fiyat)} altın · demirhane ${formatSayi(df.npcDegeri)} verir`}
        </p>
        {df.kayitKuyrugu && (
          <p className="mt-1 text-[11px] text-sonuk">
            {`Değerli eşya: ilana girince ${df.kuyrukSuresiDk} dakika kayıt kuyruğunda bekler, sonra en yüksek fiyatı veren alıcılar arasında kura çekilir.`}
          </p>
        )}
        {df.kuyrukta.adet > 0 && df.kuyrukta.enErken && (
          <p className="mt-1 text-[11px] text-sonuk">
            <Cumle
              metin="{0} ilan kayıt kuyruğunda; ilk kura {1} sonra."
              parca={[df.kuyrukta.adet, <GeriSayim bitis={df.kuyrukta.enErken} kisa />]}
            />
          </p>
        )}
      </Kart>

      <Defter df={df} secili={secili} onSec={setBasamak} />

      <Kart className="space-y-2 p-3">
        <OnizlemeSatiri df={df} yon={yon} basamak={secili} fiyat={fiyat} />
        {yon === 'al' && df.kilit ? (
          <p className="text-[12px] text-kirmizi">
            {`T${urun.tier} eşya almak için ${df.kilit.gerekenSeviye}. seviye gerekiyor.`}
          </p>
        ) : (
          <Buton tam disabled={gonder.isPending} onClick={() => gonder.mutate()}>
            {gonder.isPending ? 'Gönderiliyor…' : eylemAdi(df, yon, secili, fiyat)}
          </Buton>
        )}
        {hata && <p className="text-[12px] text-kirmizi">{hata}</p>}
        {sonuc && <p className="text-[12px] text-yesil">{sonuc}</p>}
      </Kart>

      {df.sonIslemler.length > 0 && (
        <Bolum baslik="Son işlemler" katlanir>
          <Kart sakin className="space-y-1 p-3">
            {df.sonIslemler.map((i) => (
              <div key={i.createdAt} className="flex justify-between text-[12px]">
                <span className="text-solgun">
                  {i.kura
                    ? `${YUVA_ADI[i.slot as EquipSlot] ?? i.slot} · kurayla`
                    : (YUVA_ADI[i.slot as EquipSlot] ?? i.slot)}
                </span>
                <span className="tabular">{`${formatSayi(i.fiyat)} altın`}</span>
              </div>
            ))}
          </Kart>
        </Bolum>
      )}
    </div>
  );
}

/** Seçilen fiyatla ne olacak — düğmeye basmadan önce. */
function eylemAdi(df: UrunDefteriDto, yon: 'al' | 'sat', basamak: number, fiyat: number): string {
  if (yon === 'al') {
    return df.enUcuzIlan && df.enUcuzIlan.basamak <= basamak
      ? `Hemen al — ${formatSayi(df.enUcuzIlan.fiyat)} altın`
      : `Ön sipariş ver — ${formatSayi(fiyat)} altın`;
  }
  if (df.kayitKuyrugu) return `Kayıt kuyruğuna koy — ${formatSayi(fiyat)} altın`;
  return df.enYuksekSiparis && df.enYuksekSiparis.basamak >= basamak
    ? `Hemen sat — ${formatSayi(df.enYuksekSiparis.fiyat)} altın`
    : `İlana koy — ${formatSayi(fiyat)} altın`;
}

function OnizlemeSatiri({
  df,
  yon,
  basamak,
  fiyat,
}: {
  df: UrunDefteriDto;
  yon: 'al' | 'sat';
  basamak: number;
  fiyat: number;
}) {
  if (yon === 'al') {
    const hemen = df.enUcuzIlan && df.enUcuzIlan.basamak <= basamak;
    return (
      <p className="text-[12px] text-solgun">
        {hemen
          ? `En ucuz ilan ${formatSayi(df.enUcuzIlan!.fiyat)} altın: yazdığından azını ödersin, eşya hemen senin.`
          : `Satan yok. ${formatSayi(fiyat)} altın emanete alınır; biri bu fiyata ya da altına satınca eşya senin olur. İptal edersen kesintisiz geri döner.`}
      </p>
    );
  }
  const gecen = df.enYuksekSiparis && df.enYuksekSiparis.basamak >= basamak && !df.kayitKuyrugu;
  const satis = gecen ? df.enYuksekSiparis!.fiyat : fiyat;
  const net = Math.floor(satis * (1 - df.vergi) + 1e-9);
  return (
    <p className="text-[12px] text-solgun">
      {gecen
        ? `Bekleyen bir alıcı ${formatSayi(satis)} altın veriyor: hemen satılır.`
        : 'Alıcı çıkana kadar ilanda bekler; eşya o sırada kullanılamaz.'}{' '}
      <span className="text-altin">{`Vergi %${Math.round(df.vergi * 100)} — kasana ${formatSayi(net)} altın.`}</span>
    </p>
  );
}

/**
 * Emir defteri: bantın her basamağı, kaç satıcı, kaç alıcı.
 * Kim olduğu yok — pazar anonim. Satıra dokunmak o fiyatı seçiyor.
 */
function Defter({
  df,
  secili,
  onSec,
}: {
  df: UrunDefteriDto;
  secili: number;
  onSec: (b: number) => void;
}) {
  return (
    <Kart className="p-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-1.5 pb-1 text-[10px] text-sonuk">
        <span className="baslik">FİYAT</span>
        <span className="baslik w-12 text-right">SATAN</span>
        <span className="baslik w-12 text-right">ALAN</span>
      </div>
      <div role="radiogroup" aria-label="Fiyat seç">
        {df.defter.map((s) => (
          <button
            key={s.basamak}
            type="button"
            role="radio"
            aria-checked={s.basamak === secili}
            onClick={() => onSec(s.basamak)}
            className={`grid w-full grid-cols-[1fr_auto_auto] gap-x-3 rounded-md px-1.5 py-1 text-left text-[12px] ${
              s.basamak === secili ? 'bg-altin/20 text-altin' : ''
            }`}
          >
            <span className="tabular">
              {formatSayi(s.fiyat)}
              {s.taban && <span className="ml-1.5 text-[10px] text-sonuk">taban</span>}
            </span>
            <span className={`tabular w-12 text-right ${s.satici ? 'text-kirmizi' : 'text-sonuk'}`}>
              {s.satici || '·'}
            </span>
            <span className={`tabular w-12 text-right ${s.alici ? 'text-yesil' : 'text-sonuk'}`}>
              {s.alici || '·'}
            </span>
          </button>
        ))}
      </div>
    </Kart>
  );
}

/* ── Sat ─────────────────────────────────────────────────────────── */

function SatSekmesi({ d }: { d: EsyaPazariDto }) {
  const [secili, setSecili] = useState<{ urun: UrunDto; itemId: string } | null>(null);
  const arananlar = new Map(d.aranan.map((a) => [anahtar(a.urun), a]));

  if (secili) {
    return (
      <UrunEkrani
        urun={secili.urun}
        yon="sat"
        itemId={secili.itemId}
        onGeri={() => setSecili(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Bolum baslik="Eşyaların" sakin={d.esyalarim.length === 0}>
        {d.esyalarim.length === 0 ? (
          <p className="text-[12px] text-sonuk">
            Satılabilecek eşyan yok. Kuşandığın eşyayı satmak için önce çıkarman gerekiyor.
          </p>
        ) : (
          <div className="space-y-1.5">
            {d.esyalarim.map((e) => {
              const talep = arananlar.get(anahtar(e.urun));
              return (
                <Kart
                  key={e.id}
                  className="px-3 py-2.5"
                  vurgu={nadirlikRengi(e.urun.rarity)}
                  onClick={
                    e.yukseltiliyor ? undefined : () => setSecili({ urun: e.urun, itemId: e.id })
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="baslik truncate text-[13px]"
                      style={{ color: nadirlikRengi(e.urun.rarity) }}
                    >
                      {e.ad}
                    </span>
                    <span className="tabular shrink-0 text-[12px] text-solgun">{`güç ${formatSayi(e.guc)}`}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-sonuk">
                    {e.yukseltiliyor
                      ? 'Demirhanede yükseltiliyor — iş bitince satabilirsin.'
                      : talep
                        ? `${talep.adet} alıcı bekliyor · en yüksek ${formatSayi(talep.enYuksek)} altın`
                        : `Demirhane ${formatSayi(e.npcDegeri)} altın verir`}
                  </div>
                </Kart>
              );
            })}
          </div>
        )}
      </Bolum>

      {d.aranan.length > 0 && (
        <Bolum baslik="Aranan ürünler" katlanir>
          <div className="space-y-1.5">
            {d.aranan.map((a) => (
              <Kart key={anahtar(a.urun)} sakin className="px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate" style={{ color: nadirlikRengi(a.urun.rarity) }}>
                    {a.ad}
                  </span>
                  <span className="tabular shrink-0 text-solgun">{`${formatSayi(a.enYuksek)} altına kadar · ${a.adet}`}</span>
                </div>
              </Kart>
            ))}
          </div>
        </Bolum>
      )}
    </div>
  );
}

/* ── Emirlerim ───────────────────────────────────────────────────── */

function Emirlerim({ d }: { d: EsyaPazariDto }) {
  const bos = d.ilanlarim.length === 0 && d.siparislerim.length === 0;
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-sonuk">
        {`Aynı anda en fazla ${d.tavan.ilan} ilan ve ${d.tavan.siparis} ön sipariş. Bugün ${d.tavan.bugun}/${d.tavan.gunluk} yeni emir verdin. Emirlerin süresi dolmaz.`}
      </p>
      {bos && (
        <Kart sakin className="p-3">
          <p className="text-[12px] text-sonuk">Bekleyen emrin yok.</p>
        </Kart>
      )}
      {d.ilanlarim.length > 0 && (
        <Bolum baslik="İlanlarım">
          <div className="space-y-2">
            {d.ilanlarim.map((e) => (
              <EmirKarti key={e.id} emir={e} tur="ilan" />
            ))}
          </div>
        </Bolum>
      )}
      {d.siparislerim.length > 0 && (
        <Bolum baslik="Ön siparişlerim">
          <div className="space-y-2">
            {d.siparislerim.map((e) => (
              <EmirKarti key={e.id} emir={e} tur="siparis" />
            ))}
          </div>
        </Bolum>
      )}
    </div>
  );
}

/**
 * Bekleyen bir emir. Bant dışına düşen emir silinmiyor, EŞLEŞMİYOR —
 * tek dokunuşla bandın en yakın kenarına alınabiliyor.
 */
function EmirKarti({ emir, tur }: { emir: PazarEmriDto; tur: 'ilan' | 'siparis' }) {
  const qc = useQueryClient();
  const [hata, setHata] = useState<string | null>(null);
  const [duzenle, setDuzenle] = useState(false);
  const kuyrukta = tur === 'ilan' && !!emir.kuyrukBitis;
  const yenile = () => {
    void qc.invalidateQueries({ queryKey: ['esyaPazari'] });
    void qc.invalidateQueries({ queryKey: ['esyaPazariUrun'] });
    void qc.invalidateQueries({ queryKey: ['me'] });
    void qc.invalidateQueries({ queryKey: ['items'] });
  };
  const fiyat = useMutation({
    mutationFn: async (basamak: number): Promise<unknown> =>
      tur === 'ilan' ? api.esyaIlanFiyat(emir.id, basamak) : api.esyaSiparisFiyat(emir.id, basamak),
    onSuccess: () => {
      hisOnay();
      setHata(null);
      setDuzenle(false);
      yenile();
    },
    onError: (e) => {
      hisRet();
      setHata(hataMetni(e, 'Fiyat güncellenemedi.'));
    },
  });
  const kaldir = useMutation({
    mutationFn: async (): Promise<unknown> =>
      tur === 'ilan' ? api.esyaIlanGeriCek(emir.id) : api.esyaSiparisIptal(emir.id),
    onSuccess: () => {
      hisOnay();
      yenile();
    },
    onError: (e) => {
      hisRet();
      setHata(hataMetni(e, 'Emir kaldırılamadı.'));
    },
  });
  const enYakinKenar = emir.basamak > emir.bant.ust ? emir.bant.ust : emir.bant.alt;

  return (
    <Kart
      className="p-3"
      vurgu={emir.bantta ? nadirlikRengi(emir.urun.rarity) : 'var(--color-turuncu)'}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="baslik truncate text-[13px]"
            style={{ color: nadirlikRengi(emir.urun.rarity) }}
          >
            {emir.ad}
          </div>
          <div className="tabular text-[12px] text-solgun">
            {tur === 'siparis'
              ? `${formatSayi(emir.fiyat)} altın emanette`
              : `${formatSayi(emir.fiyat)} altın`}
          </div>
        </div>
        {kuyrukta ? (
          <Rozet renk="var(--color-mavi)">kayıt kuyruğu</Rozet>
        ) : !emir.bantta ? (
          <Rozet renk="var(--color-turuncu)">bant dışı</Rozet>
        ) : (
          <Rozet>bekliyor</Rozet>
        )}
      </div>
      {kuyrukta && emir.kuyrukBitis && (
        <p className="mt-1 text-[11px] text-sonuk">
          <Cumle
            metin="Kura {0} sonra. Kuyruktayken geri çekilemez."
            parca={[<GeriSayim bitis={emir.kuyrukBitis} kisa />]}
          />
        </p>
      )}
      {!emir.bantta && (
        <p className="mt-1 text-[11px] text-turuncu">
          {`Fiyat bandı kaydı (${formatSayi(emir.bant.altFiyat)}–${formatSayi(emir.bant.ustFiyat)} altın); bu hâliyle eşleşmez.`}
        </p>
      )}
      {!kuyrukta && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!emir.bantta && (
            <Buton
              boy="kucuk"
              disabled={fiyat.isPending}
              onClick={() => fiyat.mutate(enYakinKenar)}
            >
              Banda al
            </Buton>
          )}
          <Buton boy="kucuk" tur="sessiz" onClick={() => setDuzenle((x) => !x)}>
            Fiyatı değiştir
          </Buton>
          <Buton
            boy="kucuk"
            tur="sessiz"
            disabled={kaldir.isPending}
            onClick={() => kaldir.mutate()}
          >
            {tur === 'ilan' ? 'Geri çek' : 'İptal et'}
          </Buton>
        </div>
      )}
      {duzenle && (
        <div className="mt-2">
          <FiyatDuzenle
            urun={emir.urun}
            mevcut={emir.basamak}
            onSec={(b) => fiyat.mutate(b)}
            bekliyor={fiyat.isPending}
          />
        </div>
      )}
      {hata && <p className="mt-1 text-[12px] text-kirmizi">{hata}</p>}
    </Kart>
  );
}

/** Emrin fiyatını değiştirmek için ürünün defteri — satıra dokun, onayla. */
function FiyatDuzenle({
  urun,
  mevcut,
  onSec,
  bekliyor,
}: {
  urun: UrunDto;
  mevcut: number;
  onSec: (b: number) => void;
  bekliyor: boolean;
}) {
  const defter = useQuery({
    queryKey: ['esyaPazariUrun', anahtar(urun)],
    queryFn: () => api.esyaPazariUrun(urun),
  });
  const [secili, setSecili] = useState(mevcut);
  if (!defter.data) return <Iskelet satir={3} />;
  const satir = defter.data.defter.find((s) => s.basamak === secili);
  return (
    <div className="space-y-2">
      <Defter df={defter.data} secili={secili} onSec={setSecili} />
      <Buton
        tam
        boy="kucuk"
        disabled={bekliyor || secili === mevcut || !satir}
        onClick={() => onSec(secili)}
      >
        {satir ? `${formatSayi(satir.fiyat)} altına güncelle` : 'Bir fiyat seç'}
      </Buton>
    </div>
  );
}
