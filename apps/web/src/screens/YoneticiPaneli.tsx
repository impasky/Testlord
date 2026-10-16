/**
 * YÖNETİCİ PANELİ — oyuncuyu ARAYIP bakmak.
 *
 * Şikâyet kuyruğu (Moderasyon ekranı) bir SIRA: kim şikâyet edildiyse o
 * görünüyor. Bu ekran bir ARAMA: bot hesabını, hile yapanı, aynı kişinin
 * açtığı yirmi hesabı kimse şikâyet etmiyor ve kuyrukta hiç görünmüyorlar.
 *
 * ── Ekranın omurgası: TEK OYUNCU, TEK KARAR ─────────────────────────
 *
 * Ara → oyuncuyu seç → dosyası açılır → karar ver. Liste ve dosya aynı
 * anda durmuyor: karar verilirken ekranda o oyuncudan başka bir şey
 * olmamalı, yoksa yanlış satıra basmak bir dokunuş uzaklıkta.
 *
 * Dosya karar için gerekeni yan yana koyuyor: hesabın ÖTEKİ lordları
 * (aynı kişi mi), moderasyon geçmişi (bu kaçıncı), son mesajlar (bağlam).
 *
 * ── Yasak iki dokunuş istiyor ───────────────────────────────────────
 *
 * Susturma geri alınabilir ve sohbete dokunuyor; yasak oyuna dokunuyor ve
 * oyuncu hiç giremiyor. Kalıcı yasakta onay ayrıca soruluyor: geri
 * alınabilir olması, yanlışlıkla basılabilir olmasını mazur göstermez.
 *
 * Sebep ZORUNLU. Neden giremediğini bilmeyen oyuncu davranışını
 * değiştiremez; sebep hem oyuncuya gösteriliyor hem kayda giriyor.
 */
import { YAYIN_ELLE, YAYIN_METNI, yerel, type YayinDurumu } from '@lordlar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type CokluHesapLordu, type YoneticiOyuncuDto } from '../api/client';
import { BosHal } from '../components/BosHal';
import { ts } from '../lib/dil';
import {
  Bolum,
  Buton,
  EngelNotu,
  Iskelet,
  Kart,
  Rozet,
  formatGecen,
  formatSayi,
} from '../components/ui';

export function YoneticiPaneli() {
  const [terim, setTerim] = useState('');
  const [sorgu, setSorgu] = useState('');
  const [secili, setSecili] = useState<string | null>(null);

  const ayarlar = useQuery({ queryKey: ['yonetici-ayarlar'], queryFn: api.yoneticiAyarlari });
  const arama = useQuery({
    queryKey: ['yonetici-ara', sorgu],
    queryFn: () => api.yoneticiAra(sorgu),
    enabled: sorgu.length >= 2,
  });

  if (secili) {
    return <OyuncuDosyasi lordId={secili} onGeri={() => setSecili(null)} sureler={ayarlar.data} />;
  }

  return (
    <div className="space-y-3">
      <Bolum baslik="Oyuncu ara">
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setSorgu(terim.trim());
          }}
        >
          <input
            value={terim}
            onChange={(e) => setTerim(e.target.value)}
            placeholder="Lord adı"
            aria-label="Lord adı"
            className="min-w-0 flex-1 rounded-lg border border-kenar oyuk px-3 py-2 text-[13px]"
          />
          {/* `type="submit"`: Buton varsayılanı "button" ve o hâliyle
              formu göndermiyor — Enter çalışıyor, düğme çalışmıyordu. */}
          <Buton type="submit" tur="anahat" disabled={terim.trim().length < 2}>
            Ara
          </Buton>
        </form>
        <p className="mt-1.5 text-[11px] leading-snug text-sonuk">
          Ada göre aranıyor; en az iki harf. Panel bir adres defteri değil, e-postayla arama yok.
        </p>
      </Bolum>

      {sorgu.length >= 2 && (
        <Bolum baslik="Sonuçlar">
          {!arama.data ? (
            <Iskelet satir={3} tur="liste" />
          ) : arama.data.sonuclar.length === 0 ? (
            <BosHal mesaj="Kimse bulunamadı. Adın tamamını değil, bir parçasını yaz." />
          ) : (
            <div className="space-y-1.5">
              {arama.data.sonuclar.map((s) => (
                <Kart key={s.lordId} className="p-2.5">
                  <button
                    type="button"
                    className="bas flex w-full items-center gap-2 text-left"
                    onClick={() => setSecili(s.lordId)}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{s.ad}</span>
                    {s.yasakli && <Rozet renk="var(--color-kirmizi)">YASAKLI</Rozet>}
                    {s.susturulmus && <Rozet renk="var(--color-turuncu)">SUSTURULMUŞ</Rozet>}
                    <span className="shrink-0 text-[11px] text-sonuk">
                      {`Sv ${s.seviye} · ${s.diyar}`}
                    </span>
                  </button>
                  <p className="mt-0.5 text-[11px] text-sonuk">
                    {`Son görülme: ${formatGecen(s.sonGorulme)}`}
                  </p>
                </Kart>
              ))}
            </div>
          )}
        </Bolum>
      )}

      <CokluHesap onSec={setSecili} />
      <OlcumPanosu />
      <YayinKontrolu />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Çoklu hesap şüphesi (docs/14 "Çoklu hesap").
 *
 * Bir hesabın ötekini BESLEMESİ: tek yönlü sevkiyat, aynı lorda
 * tekrarlanan takviye, pazarda aynı çiftin tekrar tekrar buluşması. Ağ
 * izi yok (gizlilik metninin sözü), otomatik ceza yok: arkadaşlar da
 * birbirine yardım eder. Kart iki dosyaya da tek dokunuşla açılıyor —
 * karar orada, iki hesabın geçmişine bakarak veriliyor.
 */
function CokluHesap({ onSec }: { onSec: (lordId: string) => void }) {
  const q = useQuery({ queryKey: ['coklu-hesap'], queryFn: api.cokluHesap });
  const d = q.data;
  const lordDugmesi = (l: CokluHesapLordu) => (
    <button
      type="button"
      onClick={() => onSec(l.lordId)}
      className="bas min-w-0 truncate text-left text-[13px] font-bold text-altin underline decoration-altin/40"
    >
      {l.ad}
    </button>
  );
  return (
    <Bolum
      baslik={d ? `Çoklu hesap şüphesi: ${d.baglar.length}` : 'Çoklu hesap şüphesi'}
      katlanir
      sakin={!!d && d.baglar.length === 0}
    >
      {!d ? (
        <Iskelet satir={3} tur="liste" />
      ) : (
        <div className="space-y-1.5" data-coklu-hesap="">
          {d.baglar.length === 0 ? (
            <BosHal mesaj={`Son ${d.pencereGun} günde dikkat çeken bir bağ yok.`} />
          ) : (
            d.baglar.map((b) => (
              <Kart key={`${b.besleyen.lordId}>${b.alan.lordId}`} className="p-2.5">
                <div className="flex items-center gap-1.5">
                  {lordDugmesi(b.besleyen)}
                  <span className="shrink-0 text-sonuk" aria-label="besliyor">
                    →
                  </span>
                  {lordDugmesi(b.alan)}
                  {b.besleyen.ittifak && (
                    <span className="ml-auto shrink-0 text-[11px] text-sonuk">
                      {`[${b.besleyen.ittifak}]`}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {b.isaretler.includes('sevkiyat') && (
                    <Rozet renk="var(--color-turuncu)">
                      {`Sevkiyat ${formatSayi(b.sevkiyat)} · geri ${formatSayi(b.geriSevkiyat)}`}
                    </Rozet>
                  )}
                  {b.isaretler.includes('takviye') && (
                    <Rozet renk="var(--color-turuncu)">{`Takviye ${b.takviye} kez`}</Rozet>
                  )}
                  {b.isaretler.includes('pazar') && (
                    <Rozet renk="var(--color-turuncu)">{`Pazarda ${b.pazar} işlem`}</Rozet>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-sonuk">
                  {`${b.besleyen.ad}: ${b.besleyen.hesapYasiGun} günlük, Sv ${b.besleyen.seviye}`}
                  {b.besleyen.genc && <span className="text-turuncu"> · yeni açılmış hesap</span>}
                  {` · ${b.alan.ad}: Sv ${b.alan.seviye}`}
                </p>
              </Kart>
            ))
          )}
          <p className="pt-1 text-[11px] leading-snug text-sonuk">
            {`Son ${d.pencereGun} gün. Yalnız oyunun kendi izleri: sevkiyat, takviye, pazar — ağ adresi tutulmuyor. Otomatik ceza yok; arkadaşlar da birbirine yardım eder. İki dosyaya da bakıp karar ver.`}
          </p>
        </div>
      )}
    </Bolum>
  );
}

/* ------------------------------------------------------------------ */

const yuzde = (o: number | null) => (o === null ? '—' : `%${Math.round(o * 100)}`);
/** UTC gün numarası → "14 Eki". */
const gunMetni = (gun: number) =>
  new Date(gun * 86_400_000).toLocaleDateString(yerel(), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/**
 * Ölçüm panosu (docs/05 §7): yayından sonra karar sayıyla verilsin.
 *
 * Dört soru, yukarıdan aşağı: bugün kaç kişi oynuyor, oyun alışkanlık
 * mı (yapışkanlık), yeni gelen ertesi gün ve bir hafta sonra dönüyor mu
 * (tutundurma), ve bu son günlerde değişti mi (kohortlar). Katlı
 * açılıyor; başlık bugünkü aktifi taşıyor, açmadan görülsün.
 */
function OlcumPanosu() {
  const q = useQuery({ queryKey: ['olcum-panosu'], queryFn: api.olcumPanosu });
  const d = q.data;
  const enCok = Math.max(1, ...(d?.gunluk.map((g) => g.aktif) ?? []));
  const kohortlar = d?.kohortlar.filter((k) => k.kayit > 0).slice(0, 14) ?? [];
  return (
    <Bolum baslik={d ? `Ölçüm: bugün ${d.ozet.bugunAktif} aktif` : 'Ölçüm'} katlanir sakin>
      {!d ? (
        <Iskelet satir={4} />
      ) : (
        <div className="space-y-3" data-olcum-panosu="">
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[
              { ad: 'Bugün', n: d.ozet.bugunAktif },
              { ad: 'Dün', n: d.ozet.dunAktif },
              { ad: '7 gün', n: d.ozet.haftalikAktif },
              { ad: '30 gün', n: d.ozet.aylikAktif },
            ].map((x) => (
              <Kart key={x.ad} className="px-1 py-2">
                <div className="tabular text-[17px] leading-tight font-bold">{x.n}</div>
                <div className="text-[10px] text-sonuk">{x.ad}</div>
              </Kart>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-sonuk">
            {`Yapışkanlık (dün ÷ 30 gün): ${yuzde(d.ozet.yapiskanlik)}. Aynı kişiler her gün dönüyorsa yükselir.`}
          </p>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { ad: '1. gün tutundurma', t: d.tutundurma.d1 },
              { ad: '7. gün tutundurma', t: d.tutundurma.d7 },
            ].map((x) => (
              <Kart key={x.ad} className="p-2.5">
                <div className="text-[11px] font-bold">{x.ad}</div>
                <div className="tabular text-[20px] leading-tight font-bold text-altin">
                  {yuzde(x.t.oran)}
                </div>
                <div className="text-[10px] text-sonuk">{`${x.t.donen} / ${x.t.kohort} oyuncu`}</div>
              </Kart>
            ))}
          </div>

          {/* Son 30 gün: sütun günlük aktif, yeşil payı o gün kaydolan. */}
          <div>
            <div
              className="flex h-20 items-end gap-px"
              role="img"
              aria-label={`Son 30 günün günlük aktif oyuncusu; en çok ${enCok}`}
            >
              {d.gunluk.map((g) => (
                <div
                  key={g.gun}
                  title={`${gunMetni(g.gun)}: ${g.aktif} aktif, ${g.yeni} yeni`}
                  className="relative flex-1 rounded-t-sm bg-altin/70"
                  style={{ height: `${(g.aktif / enCok) * 100}%`, minHeight: g.aktif > 0 ? 2 : 0 }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-sm bg-yesil"
                    style={{
                      height: g.aktif > 0 ? `${(Math.min(g.yeni, g.aktif) / g.aktif) * 100}%` : 0,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] text-sonuk">
              <span>{gunMetni(d.gunluk[0]!.gun)}</span>
              <span>Yeşil: o gün kaydolan</span>
              <span>{gunMetni(d.bugun)}</span>
            </div>
          </div>

          {kohortlar.length > 0 && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-sonuk">
                  <th className="py-1 font-bold">Kayıt günü</th>
                  <th className="py-1 text-right font-bold">Kayıt</th>
                  <th className="py-1 text-right font-bold">1. gün</th>
                  <th className="py-1 text-right font-bold">7. gün</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {kohortlar.map((k) => (
                  <tr key={k.gun} className="border-t border-kenar/60">
                    <td className="py-1">{gunMetni(k.gun)}</td>
                    <td className="py-1 text-right">{k.kayit}</td>
                    <td className="py-1 text-right">{yuzde(k.d1)}</td>
                    <td className="py-1 text-right">{yuzde(k.d7)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] leading-snug text-sonuk">
            Gün UTC'ye göre. Oran, o gün bitmeden yazılmıyor (—). NPC lordlar sayılmıyor.
          </p>
        </div>
      )}
    </Bolum>
  );
}

const YAYIN_RENGI: Record<YayinDurumu, string> = {
  eksik: 'var(--color-kirmizi)',
  uyari: 'var(--color-turuncu)',
  tamam: 'var(--color-yesil)',
};
const YAYIN_ETIKETI: Record<YayinDurumu, string> = {
  eksik: 'EKSİK',
  uyari: 'UYARI',
  tamam: 'TAMAM',
};
const YAYIN_SIRASI: Record<YayinDurumu, number> = { eksik: 0, uyari: 1, tamam: 2 };

/**
 * Yayın kontrolü (docs/05 §6): sunucu hangi ayarın eksik olduğunu
 * kendisi söylüyor. Katlı açılıyor — panelin asıl işi moderasyon; ama
 * başlık eksik sayısını taşıyor, açmadan görülsün.
 */
function YayinKontrolu() {
  const q = useQuery({ queryKey: ['yayin-kontrolu'], queryFn: api.yayinKontrolu });
  const d = q.data;
  const baslik = !d
    ? 'Yayın kontrolü'
    : d.eksik + d.uyari === 0
      ? 'Yayın kontrolü: hepsi tamam'
      : `Yayın kontrolü: ${d.eksik} eksik, ${d.uyari} uyarı`;
  return (
    <Bolum baslik={baslik} katlanir sakin={!!d && d.eksik === 0}>
      {!d ? (
        <Iskelet satir={4} />
      ) : (
        <div className="space-y-1.5">
          {[...d.bulgular]
            .sort((a, b) => YAYIN_SIRASI[a.durum] - YAYIN_SIRASI[b.durum])
            .map((b) => (
              <Kart key={b.ad} className="p-2.5">
                <div className="flex items-center gap-2">
                  {/* Ad sunucudan: ayar adları olduğu gibi, "yönetici" çevriliyor. */}
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{ts(b.ad)}</span>
                  <Rozet renk={YAYIN_RENGI[b.durum]}>{YAYIN_ETIKETI[b.durum]}</Rozet>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-sonuk">{YAYIN_METNI[b.neden]}</p>
              </Kart>
            ))}
          <p className="pt-1 text-[11px] font-bold">Sunucunun bilemediği, elle denenecek:</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-sonuk">
            {YAYIN_ELLE.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </Bolum>
  );
}

/* ------------------------------------------------------------------ */

function OyuncuDosyasi({
  lordId,
  onGeri,
  sureler,
}: {
  lordId: string;
  onGeri: () => void;
  sureler:
    | {
        susturmaSureleri: { saat: number; metin: string }[];
        yasakSureleri: { saat: number; metin: string }[];
        kaliciYasak: boolean;
      }
    | undefined;
}) {
  const qc = useQueryClient();
  const [sebep, setSebep] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [onay, setOnay] = useState(false);

  const q = useQuery({
    queryKey: ['yonetici-oyuncu', lordId],
    queryFn: () => api.yoneticiOyuncu(lordId),
  });

  const tazele = () => {
    void qc.invalidateQueries({ queryKey: ['yonetici-oyuncu', lordId] });
    void qc.invalidateQueries({ queryKey: ['yonetici-ara'] });
  };
  /*
   * Beş ayrı çengel, beşi de KOŞULSUZ ve hep aynı sırada: React'in
   * çengel kuralı bunu istiyor. Sarmalayıcıyı bir yardımcı işlevden
   * çağırmak daha kısa görünüyordu ama çengeli GÖRÜNMEZ kılıyordu —
   * ilerde biri onu bir koşulun içine soktuğunda sessizce bozulurdu.
   */
  const sustur = useMutationBenzeri(
    (saat: number) => api.yoneticiSustur(lordId, saat, sebep),
    'Susturulamadı.',
    tazele,
    setHata,
  );
  const susturmaKaldir = useMutationBenzeri(
    () => api.yoneticiSusturmaKaldir(lordId),
    'Susturma kaldırılamadı.',
    tazele,
    setHata,
  );
  const yasakla = useMutationBenzeri(
    (saat: number | null) => api.yoneticiYasakla(lordId, saat, sebep),
    'Yasaklanamadı.',
    tazele,
    setHata,
  );
  const yasakKaldir = useMutationBenzeri(
    () => api.yoneticiYasakKaldir(lordId),
    'Yasak kaldırılamadı.',
    tazele,
    setHata,
  );
  const mesajKaldir = useMutationBenzeri(
    (mesajId: string) => api.yoneticiMesajKaldir(mesajId),
    'Mesaj kaldırılamadı.',
    tazele,
    setHata,
  );

  if (!q.data) return <Iskelet satir={6} />;
  const o: YoneticiOyuncuDto = q.data;

  return (
    <div className="space-y-3">
      <Buton tur="sessiz" boy="kucuk" onClick={onGeri}>
        ‹ Aramaya dön
      </Buton>

      <Kart className="p-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{o.ad}</span>
          {o.yasak.aktif && <Rozet renk="var(--color-kirmizi)">YASAKLI</Rozet>}
          {o.susturma.aktif && <Rozet renk="var(--color-turuncu)">SUSTURULMUŞ</Rozet>}
        </div>
        <p className="mt-1 text-[11.5px] text-solgun">
          {`Sv ${o.seviye} · ${o.diyar} · son görülme ${formatGecen(o.sonGorulme)}`}
        </p>
        <p className="mt-0.5 text-[11.5px] text-sonuk">
          {`Hesap: ${o.hesap.eposta}${o.hesap.yonetici ? ' · yönetici' : ''}`}
        </p>
        {o.hesap.lordlar.length > 1 && (
          <p className="mt-0.5 text-[11.5px] text-sonuk">
            {`Aynı hesapta ${o.hesap.lordlar.length} lord: ${o.hesap.lordlar
              .map((l) => `${l.ad} (${l.diyar})`)
              .join(', ')}`}
          </p>
        )}
        {o.yasak.aktif && (
          <p className="mt-1 text-[12px] text-kirmizi">
            {o.yasak.kalici
              ? `Kalıcı yasak — ${o.yasak.sebep ?? 'sebep yok'}`
              : `Yasak ${o.yasak.bitis ? new Date(o.yasak.bitis).toLocaleString() : ''} tarihine kadar — ${o.yasak.sebep ?? 'sebep yok'}`}
          </p>
        )}
      </Kart>

      {hata && <EngelNotu kisa={hata} uzun="İşlem uygulanmadı; sayfayı tazeleyip tekrar dene." />}

      <Bolum baslik="Karar">
        <input
          value={sebep}
          onChange={(e) => setSebep(e.target.value)}
          placeholder="Sebep (oyuncuya gösterilir)"
          aria-label="Sebep"
          className="w-full rounded-lg border border-kenar oyuk px-3 py-2 text-[13px]"
        />

        <p className="mt-2.5 mb-1 text-[11px] text-sonuk">SOHBETTE SUSTUR</p>
        <div className="flex flex-wrap gap-1.5">
          {(sureler?.susturmaSureleri ?? []).map((s) => (
            <Buton
              key={s.saat}
              tur="anahat"
              boy="kucuk"
              etiket={`Sohbette sustur — ${s.metin}`}
              onClick={() => sustur.calistir(s.saat)}
            >
              {s.metin}
            </Buton>
          ))}
          {o.susturma.aktif && (
            <Buton
              tur="sessiz"
              boy="kucuk"
              onClick={() => susturmaKaldir.calistir(undefined as never)}
            >
              Susturmayı kaldır
            </Buton>
          )}
        </div>

        <p className="mt-3 mb-1 text-[11px] text-sonuk">HESABI YASAKLA</p>
        <div className="flex flex-wrap gap-1.5">
          {(sureler?.yasakSureleri ?? []).map((s) => (
            <Buton
              key={s.saat}
              tur="anahat"
              boy="kucuk"
              etiket={`Hesabı yasakla — ${s.metin}`}
              onClick={() => yasakla.calistir(s.saat)}
              disabled={sebep.trim().length < 3}
            >
              {s.metin}
            </Buton>
          ))}
          {sureler?.kaliciYasak && (
            <Buton
              tur={onay ? 'altin' : 'sessiz'}
              boy="kucuk"
              disabled={sebep.trim().length < 3}
              onClick={() => {
                if (!onay) {
                  setOnay(true);
                  return;
                }
                setOnay(false);
                yasakla.calistir(null);
              }}
            >
              {onay ? 'Evet, kalıcı yasakla' : 'Kalıcı'}
            </Buton>
          )}
          {o.yasak.aktif && (
            <Buton
              tur="sessiz"
              boy="kucuk"
              onClick={() => yasakKaldir.calistir(undefined as never)}
            >
              Yasağı kaldır
            </Buton>
          )}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-sonuk">
          Susturma sohbete, yasak oyuna dokunur. Yasak için sebep zorunlu; ikisi de geri alınabilir
          ve ikisi de kayda geçer.
        </p>
      </Bolum>

      <Bolum baslik="Moderasyon geçmişi">
        {o.gecmis.length === 0 ? (
          <p className="text-[12px] text-sonuk">Kayıt yok — bu ilk.</p>
        ) : (
          <ul className="space-y-1">
            {o.gecmis.map((g, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[12px]">
                <span className="min-w-0 flex-1 text-solgun">{g.ozet}</span>
                <span className="shrink-0 text-[11px] text-sonuk">{formatGecen(g.an)}</span>
              </li>
            ))}
          </ul>
        )}
      </Bolum>

      <Bolum baslik="Son mesajları">
        {o.mesajlar.length === 0 ? (
          <p className="text-[12px] text-sonuk">Hiç mesaj yazmamış.</p>
        ) : (
          <div className="space-y-1.5">
            {o.mesajlar.map((m) => (
              <Kart key={m.id} className="p-2.5">
                <p className="text-[12.5px] leading-snug text-parsomen">{m.metin}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] text-sonuk">
                    {`${m.kanal === 'genel' ? 'Genel' : 'İttifak'} · ${formatGecen(m.an)}`}
                  </span>
                  {m.silinmis ? (
                    <Rozet renk="var(--color-sonuk)">KALDIRILDI</Rozet>
                  ) : (
                    <Buton tur="sessiz" boy="kucuk" onClick={() => mesajKaldir.calistir(m.id)}>
                      Mesajı kaldır
                    </Buton>
                  )}
                  {m.gizli && <Rozet renk="var(--color-turuncu)">GİZLİ</Rozet>}
                </div>
              </Kart>
            ))}
          </div>
        )}
      </Bolum>
    </div>
  );
}

/**
 * Tek satırlık mutasyon sarmalayıcı.
 *
 * Altı ayrı `useMutation` bloğu, altı kez aynı `onSuccess`/`onError`
 * demekti; ayrışan bir hata mesajı da ekranın yarısını sessiz bırakırdı.
 */
function useMutationBenzeri<T>(
  fn: (v: T) => Promise<unknown>,
  dusen: string,
  tazele: () => void,
  setHata: (s: string | null) => void,
) {
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      setHata(null);
      tazele();
    },
    onError: (e: unknown) => setHata(e instanceof ApiError ? e.message : dusen),
  });
  return { calistir: (v: T) => m.mutate(v), bekliyor: m.isPending };
}
