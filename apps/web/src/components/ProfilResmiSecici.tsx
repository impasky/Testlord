/**
 * Profil resmi seçici — Lord ekranından açılıyor.
 *
 * Oyuncunun isteği: "Profil resmi seçme ve yükleme olsun; resimler bir
 * denetimden geçmeli, +18 ve benzeri içerik engellenmeli."
 *
 * İki yol:
 *   - HAZIR: arma ya da oyunun kendi portrelerinden biri. Denetim yok —
 *     hepsini biz çizdik. Anında değişiyor.
 *   - YÜKLE: oyuncunun kendi resmi. Sunucuda küçültülüp yeniden
 *     kodlanıyor (konum dahil üstveri siliniyor) ve bir görüntü
 *     sınıflandırıcısından geçiyor: açık içerik anında reddediliyor,
 *     emin olunamayan bir yöneticinin onayına gidiyor, temiz olan hemen
 *     görünüyor. Oyuncuya hangisinin olduğu SÖYLENİYOR — "neden resmim
 *     değişmedi" sorusu cevapsız kalmamalı.
 *
 * Yüklemeden önce resim tarayıcıda küçültülüyor: telefon kamerasının 4 MB
 * fotoğrafını olduğu gibi göndermek yavaş bağlantıda yarım dakika demek.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { HAZIR_PORTRELER, type ProfilResmi } from '@lordlar/shared';
import { ApiError, api, type ArmaDto, type ResimYuklemeDto } from '../api/client';
import { hisOnay, hisRet } from './hisGeriBildirimi';
import { IkonFotograf } from './Ikonlar';
import { ProfilGorseli } from './ProfilGorseli';
import { Buton, EngelNotu } from './ui';

/** Tarayıcıda küçültme: uzun kenar en fazla bu kadar piksel. */
const ISTEMCI_KENAR = 768;

async function kucult(dosya: File): Promise<string> {
  const adres = URL.createObjectURL(dosya);
  try {
    const img = new Image();
    img.src = adres;
    await img.decode();
    const olcek = Math.min(1, ISTEMCI_KENAR / Math.max(img.naturalWidth, img.naturalHeight));
    const tuval = document.createElement('canvas');
    tuval.width = Math.max(1, Math.round(img.naturalWidth * olcek));
    tuval.height = Math.max(1, Math.round(img.naturalHeight * olcek));
    tuval.getContext('2d')!.drawImage(img, 0, 0, tuval.width, tuval.height);
    return tuval.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(adres);
  }
}

function ayni(a: ProfilResmi, b: ProfilResmi): boolean {
  if (a.tur !== b.tur) return false;
  if (a.tur === 'hazir' && b.tur === 'hazir') return a.key === b.key;
  if (a.tur === 'yuklenen' && b.tur === 'yuklenen') return a.id === b.id;
  return true;
}

export function ProfilResmiSecici({ arma, onKapat }: { arma: ArmaDto; onKapat: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['profil-resmim'], queryFn: api.profilResmim });
  const dosyaGirdisi = useRef<HTMLInputElement | null>(null);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<ResimYuklemeDto | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const tazele = () => {
    void qc.invalidateQueries({ queryKey: ['profil-resmim'] });
    void qc.invalidateQueries({ queryKey: ['me'] });
    void qc.invalidateQueries({ queryKey: ['genel-sohbet'] });
  };

  const sec = useMutation({
    mutationFn: (r: ProfilResmi) => api.profilResmiSec(r),
    onSuccess: () => {
      hisOnay();
      setHata(null);
      tazele();
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Resim seçilemedi.');
    },
  });

  const yukle = useMutation({
    mutationFn: (veri: string) => api.profilResmiYukle(veri),
    onSuccess: (s) => {
      if (s.durum === 'red') hisRet();
      else hisOnay();
      setSonuc(s);
      setOnizleme(null);
      setHata(null);
      tazele();
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Resim yüklenemedi.');
    },
  });

  const secili = q.data?.secili ?? { tur: 'arma' as const };
  const kalan = q.data?.kalanYukleme ?? 0;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/70"
        onClick={onKapat}
        aria-label="Profil resmi seçiciyi kapat"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profil resmi"
        data-profil-resmi-secici
        className="fixed inset-x-0 bottom-0 z-[61] mx-auto max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t-2 border-kenar-acik bg-derin px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-kenar-acik" aria-hidden />
        <h2 className="baslik text-[16px] text-altin">Profil resmi</h2>
        <p className="mt-1 text-[12px] leading-snug text-solgun">
          Sohbette ve profil kartında herkes bunu görür.
        </p>

        {/* ---- Kendi resmin ---- */}
        <h3 className="baslik mt-4 mb-2 text-[12px] text-sonuk">KENDİ RESMİN</h3>
        <input
          ref={dosyaGirdisi}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          data-resim-dosyasi
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setSonuc(null);
            try {
              setOnizleme(await kucult(f));
              setHata(null);
            } catch {
              setHata('Bu dosya açılamadı. JPEG, PNG ya da WebP bir resim seç.');
            }
          }}
        />
        {onizleme ? (
          <div className="flex items-center gap-3">
            <img
              src={onizleme}
              alt="Yüklenecek resim"
              className="h-20 w-20 rounded-full border border-kenar-acik object-cover"
            />
            <div className="flex flex-1 flex-col gap-2">
              <Buton onClick={() => yukle.mutate(onizleme)} disabled={yukle.isPending}>
                {yukle.isPending ? 'Denetleniyor…' : 'Yükle'}
              </Buton>
              <Buton tur="anahat" boy="kucuk" onClick={() => setOnizleme(null)}>
                Vazgeç
              </Buton>
            </div>
          </div>
        ) : (
          <Buton
            tur="anahat"
            tam
            onClick={() => dosyaGirdisi.current?.click()}
            disabled={kalan <= 0}
          >
            <span className="inline-flex items-center gap-2">
              <IkonFotograf boyut={16} />
              Resim yükle
            </span>
          </Buton>
        )}
        <p className="mt-1.5 text-[11px] leading-snug text-sonuk">
          {kalan > 0
            ? `Resimler otomatik denetimden geçer; +18, şiddet ve nefret içeren resimler reddedilir, kuralı çiğneyen hesap kısıtlanır. Bugün ${kalan} yükleme hakkın var.`
            : 'Bugünlük yükleme hakkın bitti. Yarın yeniden deneyebilirsin.'}
        </p>
        {sonuc && (
          <p
            data-yukleme-sonucu={sonuc.durum}
            className={`mt-2 text-[12px] ${
              sonuc.durum === 'red'
                ? 'text-kirmizi'
                : sonuc.durum === 'inceleme'
                  ? 'text-turuncu'
                  : 'text-yesil'
            }`}
          >
            {sonuc.metin}
          </p>
        )}

        {(q.data?.yuklemeler.length ?? 0) > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2.5">
            {q.data!.yuklemeler.map((y) => {
              const r: ProfilResmi = { tur: 'yuklenen', id: y.id };
              const seciliMi = ayni(secili, r);
              return (
                <li key={y.id} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => sec.mutate(r)}
                    disabled={y.durum !== 'onayli' || sec.isPending}
                    aria-pressed={seciliMi}
                    aria-label={
                      y.durum === 'onayli' ? 'Yüklediğin resmi kullan' : 'İncelemedeki resim'
                    }
                    className={`bas rounded-full border-2 disabled:opacity-60 ${
                      seciliMi ? 'border-altin' : 'border-transparent'
                    }`}
                  >
                    <img src={y.adres} alt="" className="h-14 w-14 rounded-full object-cover" />
                  </button>
                  {y.durum === 'inceleme' && (
                    <span className="text-[10px] text-turuncu">İncelemede</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* ---- Hazır ---- */}
        <h3 className="baslik mt-5 mb-2 text-[12px] text-sonuk">HAZIR PORTRELER</h3>
        <ul className="grid grid-cols-5 gap-2">
          <li>
            <button
              type="button"
              onClick={() => sec.mutate({ tur: 'arma' })}
              disabled={sec.isPending}
              aria-pressed={secili.tur === 'arma'}
              aria-label="Armanı kullan"
              className={`bas block w-full rounded-full border-2 ${
                secili.tur === 'arma' ? 'border-altin' : 'border-transparent'
              }`}
            >
              <ProfilGorseli resim={{ tur: 'arma' }} arma={arma} boyut={56} className="mx-auto" />
            </button>
          </li>
          {HAZIR_PORTRELER.map((p) => {
            const r: ProfilResmi = { tur: 'hazir', key: p.key };
            const seciliMi = ayni(secili, r);
            return (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => sec.mutate(r)}
                  disabled={sec.isPending}
                  aria-pressed={seciliMi}
                  aria-label={p.ad}
                  title={p.ad}
                  className={`bas block w-full rounded-full border-2 ${
                    seciliMi ? 'border-altin' : 'border-transparent'
                  }`}
                >
                  <ProfilGorseli resim={r} arma={arma} boyut={56} className="mx-auto" />
                </button>
              </li>
            );
          })}
        </ul>

        {hata && <EngelNotu kisa={hata} uzun="Biraz sonra yeniden dene." />}
        <Buton tur="anahat" tam className="mt-4" onClick={onKapat}>
          Kapat
        </Buton>
      </div>
    </>
  );
}
