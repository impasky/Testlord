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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type YoneticiOyuncuDto } from '../api/client';
import { BosHal } from '../components/BosHal';
import { Bolum, Buton, EngelNotu, Iskelet, Kart, Rozet, formatGecen } from '../components/ui';

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
            className="min-w-0 flex-1 rounded-lg border border-kenar bg-koyu2 px-3 py-2 text-[13px]"
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
            <Iskelet satir={3} />
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
    </div>
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
          className="w-full rounded-lg border border-kenar bg-koyu2 px-3 py-2 text-[13px]"
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
                  <span className="text-[11px] text-sonuk">{formatGecen(m.an)}</span>
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
