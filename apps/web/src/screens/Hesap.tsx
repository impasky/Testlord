/**
 * Hesap — parola değiştirme ve hesap silme.
 *
 * İkisi de aynı ekranda ama görsel olarak ayrılmış: silme geri alınamaz bir
 * işlem ve yanlışlıkla tetiklenmemeli. Parola ve birebir yazılan bir onay
 * metni isteniyor; tek dokunuşla silinen bir hesap, kaza demek.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api, type LordState } from '../api/client';
import { Alan, Bolum, Buton, EngelNotu, Input, Kart } from '../components/ui';
import { BildirimKarti } from '../components/BildirimKarti';
import { DILLER, type Kapi } from '@lordlar/shared';
import { useDil } from '../lib/dil';

export function Hesap({
  lord,
  onCikis,
  onOgreticiyiAc,
  onKapiAc,
}: {
  lord: LordState;
  onCikis: () => void;
  /** Öğreticiyi yeniden açar. */
  onOgreticiyiAc: () => void;
  onKapiAc: (k: Kapi) => void;
}) {
  /**
   * Yöneticilik ve susturma durumu.
   *
   * Şikâyet kuyruğunun girişi burada, bir menüde değil: yetkili olmayan
   * için düğme HİÇ ÇİZİLMİYOR ve sunucu da uçları ayrıca koruyor.
   * Susturulmuşsan sebebini burada da görüyorsun — sohbete girip
   * yazamadığını keşfetmen gerekmesin.
   */
  const { dil, degistir } = useDil();

  const gonder = useMutation({ mutationFn: api.dogrulamaGonder });
  const moderasyon = useQuery({
    queryKey: ['moderasyon-durum'],
    queryFn: api.moderasyonDurumu,
    staleTime: 60_000,
  });
  const [mevcut, setMevcut] = useState('');
  const [yeni, setYeni] = useState('');
  const [parolaBilgi, setParolaBilgi] = useState<string | null>(null);
  const [parolaHata, setParolaHata] = useState<string | null>(null);

  const [silmeAcik, setSilmeAcik] = useState(false);
  const [silmeParola, setSilmeParola] = useState('');
  const [silmeOnay, setSilmeOnay] = useState('');
  const [silmeHata, setSilmeHata] = useState<string | null>(null);

  const parolaMut = useMutation({
    mutationFn: () => api.parolaDegistir(mevcut, yeni),
    onSuccess: () => {
      setParolaHata(null);
      setParolaBilgi('Parolan değişti. Diğer cihazlarda yeniden giriş yapman gerekebilir.');
      setMevcut('');
      setYeni('');
    },
    onError: (e) => {
      setParolaBilgi(null);
      setParolaHata(e instanceof ApiError ? e.message : 'Parola değiştirilemedi.');
    },
  });

  // Bir kere gösterilip bir daha açılamayan öğretici, unutulduğu anda
  // kaybolmuş demektir. Sunucudaki damga siliniyor, sonra App öğreticiyi
  // yeniden açıyor.
  const ogreticiMut = useMutation({
    mutationFn: api.ogreticiSifirla,
    onSuccess: onOgreticiyiAc,
  });

  const silmeMut = useMutation({
    mutationFn: () => api.hesabiSil(silmeParola),
    onSuccess: onCikis,
    onError: (e) => setSilmeHata(e instanceof ApiError ? e.message : 'Hesap silinemedi.'),
  });

  const parolaEngeli =
    mevcut.length === 0
      ? { kisa: 'Mevcut parolanı gir', uzun: 'Değişikliği doğrulamak için gerekiyor.' }
      : yeni.length < 8
        ? { kisa: 'Yeni parola çok kısa', uzun: 'En az 8 karakter olmalı.' }
        : null;

  const silmeEngeli =
    silmeParola.length === 0
      ? { kisa: 'Parolanı gir', uzun: 'Silme işlemini doğrulamak için gerekiyor.' }
      : silmeOnay !== 'HESABIMI SIL'
        ? { kisa: 'Onay metnini yaz', uzun: 'Kutuya birebir HESABIMI SIL yazman gerekiyor.' }
        : null;

  return (
    <div className="space-y-4 pt-3">
      {/* Başlıksız: panelin kendi adı zaten "Hesap"; içinde bir de
          "HESAP" bölümü aynı sözün tekrarıydı. */}
      <Bolum>
        <Kart className="p-3">
          <p className="text-[13px] text-solgun">
            Lordun <span className="font-bold text-parsomen">{lord.name}</span> · Seviye{' '}
            {lord.level}
          </p>
        </Kart>
        <a
          href="#/gizlilik"
          // py-2: dokunma hedefi 24px'in altına düşmesin (WCAG 2.5.8 AA,
          // tools/erisim-denetim.mjs ölçüyor). Yalın bir bağlantı 18px.
          className="bas mt-1 block py-2 text-[12px] text-sonuk underline decoration-dotted underline-offset-2"
        >
          Hangi veriyi tutuyoruz
        </a>
        <a
          href="#/kosullar"
          className="bas block py-2 text-[12px] text-sonuk underline decoration-dotted underline-offset-2"
        >
          Kullanım koşulları
        </a>
      </Bolum>

      {moderasyon.data?.susturulmus && (
        <Bolum baslik="Susturma">
          <Kart className="p-3">
            <p className="text-[13px] text-turuncu">{moderasyon.data.susturmaMetni}</p>
            <p className="mt-1 text-[12px] text-sonuk">
              Süre dolunca ittifak sohbetine yeniden yazabilirsin. Oyunun geri kalanı açık.
            </p>
          </Kart>
        </Bolum>
      )}

      {/*
        E-POSTA DOĞRULAMA — doğrulanmışsa hiçbir şey çizilmiyor.
        Doğrulanmış bir hesaba "doğrulandı" yazmak, ekranı hiç
        okunmayacak bir satırla uzatmak olurdu.
      */}
      {moderasyon.data && !moderasyon.data.epostaDogrulandi && (
        <Bolum baslik="E-posta">
          <Kart className="p-3" vurgu="var(--color-turuncu)">
            <p className="text-[13px] text-turuncu">{moderasyon.data.dogrulamaMetni}</p>
            <p className="mt-1 text-[11.5px] leading-snug text-sonuk">
              Doğrulanmadan ittifak sohbetine yazamaz ve kaynak gönderemezsin. Postayı bulamıyorsan
              spam klasörüne bak.
            </p>
            <Buton
              className="mt-2"
              tur="anahat"
              boy="kucuk"
              disabled={gonder.isPending}
              onClick={() => gonder.mutate()}
            >
              {gonder.isSuccess ? 'Gönderildi' : 'Doğrulama bağlantısı gönder'}
            </Buton>
            {gonder.isError && (
              <p className="mt-1.5 text-[11.5px] text-kirmizi">
                {gonder.error instanceof ApiError ? gonder.error.message : 'Gönderilemedi.'}
              </p>
            )}
          </Kart>
        </Bolum>
      )}

      {moderasyon.data?.yonetici && (
        <Bolum baslik="Yönetim">
          <Kart className="p-3">
            <p className="mb-2 text-[13px] text-solgun">
              {moderasyon.data.bekleyen > 0
                ? `${moderasyon.data.bekleyen} şikâyet karar bekliyor.`
                : 'Bekleyen şikâyet yok.'}
            </p>
            {/* İKİ KAPI, iki ayrı iş: kuyruk şikâyet edileni sıraya
                diziyor, panel oyuncuyu arıyor. Bot hesabını kimse
                şikâyet etmiyor ve kuyrukta hiç görünmüyor. */}
            <div className="flex flex-wrap gap-1.5">
              <Buton tur="anahat" boy="kucuk" onClick={() => onKapiAc('moderasyon')}>
                Şikâyet kuyruğu
              </Buton>
              <Buton tur="anahat" boy="kucuk" onClick={() => onKapiAc('yoneticiPaneli')}>
                Yönetici paneli
              </Buton>
            </div>
          </Kart>
        </Bolum>
      )}

      <Bolum baslik="Dil">
        <Kart className="p-3">
          <div className="flex gap-1.5">
            {DILLER.map((d) => (
              <button
                key={d.kod}
                onClick={() => degistir(d.kod)}
                aria-pressed={dil === d.kod}
                lang={d.kod}
                className={`bas flex-1 rounded-lg border px-3 py-2.5 text-[13px] ${
                  dil === d.kod ? 'border-altin bg-altin/15 text-altin' : 'border-kenar text-solgun'
                }`}
              >
                {d.ad}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-sonuk">
            Seçim bu cihazda kalır, hesabına bağlı değil. Dil değişince oyun bir kez yenilenir.
          </p>
        </Kart>
      </Bolum>

      <Bolum baslik="Bildirimler">
        <BildirimKarti />
      </Bolum>

      <Bolum baslik="Öğretici">
        <Kart className="p-3">
          <p className="mb-2.5 text-[12px] leading-snug text-solgun">
            Oyunun ne olduğunu, nasıl savaşıldığını ve seni koruyan kuralları baştan okumak istersen
            öğreticiyi tekrar açabilirsin.
          </p>
          <Buton
            tur="anahat"
            className="w-full"
            onClick={() => ogreticiMut.mutate()}
            disabled={ogreticiMut.isPending}
          >
            {ogreticiMut.isPending ? 'Açılıyor…' : 'Öğreticiyi tekrar oku'}
          </Buton>
        </Kart>
      </Bolum>

      <Bolum baslik="Parola Değiştir">
        <Kart className="p-3">
          <Alan etiket="Mevcut parola">
            <Input
              type="password"
              value={mevcut}
              onChange={(e) => setMevcut(e.target.value)}
              autoComplete="current-password"
            />
          </Alan>
          <div className="mt-2.5">
            <Alan etiket="Yeni parola" ipucu="En az 8 karakter">
              <Input
                type="password"
                value={yeni}
                onChange={(e) => setYeni(e.target.value)}
                autoComplete="new-password"
              />
            </Alan>
          </div>

          <Buton
            className="mt-3"
            tam
            onClick={() => parolaMut.mutate()}
            disabled={parolaMut.isPending || parolaEngeli !== null}
          >
            {parolaMut.isPending ? 'Gönderiliyor…' : 'Parolayı değiştir'}
          </Buton>

          {parolaEngeli && <EngelNotu kisa={parolaEngeli.kisa} uzun={parolaEngeli.uzun} />}
          {parolaHata && <p className="mt-1.5 text-[12px] text-kirmizi">{parolaHata}</p>}
          {parolaBilgi && <p className="mt-1.5 text-[12px] text-yesil">{parolaBilgi}</p>}
        </Kart>
      </Bolum>

      <Engelliler />

      <Bolum baslik="Hesabı Sil">
        <Kart className="border-kirmizi/40 p-3">
          <p className="text-[12px] text-solgun">
            Hesabın, lordun, ordun ve ekipmanın kalıcı olarak silinir.{' '}
            <span className="text-kirmizi">Bu işlem geri alınamaz.</span> Bölgelerin sahipsiz kalır
            ve başkaları tarafından yeniden fethedilebilir.
          </p>

          {!silmeAcik ? (
            <Buton tur="kirmizi" className="mt-3" tam onClick={() => setSilmeAcik(true)}>
              Hesabımı silmek istiyorum
            </Buton>
          ) : (
            <div className="mt-3">
              <Alan etiket="Parolan">
                <Input
                  type="password"
                  value={silmeParola}
                  onChange={(e) => setSilmeParola(e.target.value)}
                  autoComplete="current-password"
                />
              </Alan>
              <div className="mt-2.5">
                <Alan etiket="Onay" ipucu="Kutuya HESABIMI SIL yaz">
                  <Input
                    value={silmeOnay}
                    onChange={(e) => setSilmeOnay(e.target.value)}
                    placeholder="HESABIMI SIL"
                    autoCapitalize="characters"
                  />
                </Alan>
              </div>

              <div className="mt-3 flex gap-2">
                <Buton
                  tur="anahat"
                  className="flex-1"
                  onClick={() => {
                    setSilmeAcik(false);
                    setSilmeParola('');
                    setSilmeOnay('');
                    setSilmeHata(null);
                  }}
                >
                  Vazgeç
                </Buton>
                <Buton
                  tur="kirmizi"
                  className="flex-1"
                  onClick={() => silmeMut.mutate()}
                  disabled={silmeMut.isPending || silmeEngeli !== null}
                >
                  {silmeMut.isPending ? 'Siliniyor…' : 'Kalıcı olarak sil'}
                </Buton>
              </div>

              {silmeEngeli && <EngelNotu kisa={silmeEngeli.kisa} uzun={silmeEngeli.uzun} />}
              {silmeHata && <p className="mt-1.5 text-[12px] text-kirmizi">{silmeHata}</p>}
            </div>
          )}
        </Kart>
      </Bolum>
    </div>
  );
}

/**
 * Engellediğin lordlar ve engeli kaldırma.
 *
 * Engel sohbetten konuluyor (⊘); kaldırmanın yeri burası. Kaldıramadığın
 * bir engel, yanlışlıkla basılmış bir düğmenin kalıcı cezası olurdu.
 */
function Engelliler() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['engeller'], queryFn: api.engeller });
  const kaldir = useMutation({
    mutationFn: (lordId: string) => api.engelKaldir(lordId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['engeller'] });
      void qc.invalidateQueries({ queryKey: ['ittifak-sohbet'] });
    },
  });
  const liste = q.data?.engelliler ?? [];
  return (
    <Bolum baslik="Engellediklerin" sakin={liste.length === 0}>
      <Kart className="p-3">
        {liste.length === 0 ? (
          <p className="text-[12px] text-solgun">
            Kimseyi engellemedin. Sohbette bir mesajın yanındaki ⊘ ile o lordun mesajlarını
            görmemeyi seçebilirsin.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {liste.map((e) => (
              <li key={e.lordId} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] text-parsomen">{e.ad}</span>
                <Buton
                  tur="anahat"
                  boy="kucuk"
                  onClick={() => kaldir.mutate(e.lordId)}
                  disabled={kaldir.isPending}
                >
                  Engeli kaldır
                </Buton>
              </li>
            ))}
          </ul>
        )}
      </Kart>
    </Bolum>
  );
}
