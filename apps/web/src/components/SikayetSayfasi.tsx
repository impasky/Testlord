/**
 * Şikâyet sayfası — iki yerden açılan TEK kutu.
 *
 * Sıralamadan bir lordu, sohbetten bir mesajı şikâyet etmek aynı soruyu
 * soruyor: "neden". İki ayrı kutu yazmak, iki ayrı sebep listesinin
 * birbirinden sapması demekti; bu yüzden sebepler sunucudan geliyor ve
 * kutu tek.
 *
 * Boş bir metin kutusu yerine önce hazır sebepler var: "neden şikâyet
 * ediyorsun" sorusuna boş kutuyla cevap vermek oyuncuyu yazmaktan
 * vazgeçiriyor, yöneticiye de sıralanamayan bir yığın bırakıyor.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, api } from '../api/client';
import { hisRet } from './hisGeriBildirimi';
import { Buton, EngelNotu } from './ui';

export interface SikayetSayfasiProps {
  /** Kutunun başlığı — kimin/neyin şikâyet edildiği. */
  baslik: string;
  /** Şikâyet edilen içerik varsa gösterilir: neyi şikâyet ettiğini gör. */
  alinti?: string | null;
  onKapat: () => void;
  onGonderildi: (mesaj: string) => void;
  gonder: (sebep: string, aciklama: string) => Promise<unknown>;
}

export function SikayetSayfasi({
  baslik,
  alinti,
  onKapat,
  onGonderildi,
  gonder,
}: SikayetSayfasiProps) {
  const [sebep, setSebep] = useState<string | null>(null);
  const [aciklama, setAciklama] = useState('');
  const [hata, setHata] = useState<string | null>(null);

  const sebepler = useQuery({
    queryKey: ['sikayet-sebepleri'],
    queryFn: api.sikayetSebepleri,
    staleTime: Infinity,
  });

  const mut = useMutation({
    mutationFn: () => gonder(sebep ?? '', aciklama),
    onSuccess: () => {
      onGonderildi('Şikâyetin alındı. Bir yönetici inceleyecek.');
      onKapat();
    },
    onError: (e: unknown) => {
      hisRet();
      setHata(e instanceof ApiError ? e.message : 'Şikâyet gönderilemedi.');
    },
  });

  // "Başka bir sebep" tek başına yöneticiye hiçbir şey söylemiyor:
  // o seçilince açıklama zorunlu. Motorda da aynı kural var.
  const aciklamaZorunlu = sebep === 'diger';
  const gonderilebilir =
    sebep !== null && !mut.isPending && (!aciklamaZorunlu || aciklama.trim().length >= 3);

  return (
    <>
      <button className="fixed inset-0 z-40 bg-black/70" onClick={onKapat} aria-label="Kapat" />
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border-t border-kenar bg-panel p-4"
        style={{ paddingBottom: 'calc(var(--alt-bar) + 16px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-kenar" />
        <h2 className="baslik mb-1 text-[14px]">{baslik}</h2>
        <p className="mb-3 text-[12px] text-solgun">
          Otomatik bir ceza verilmez — şikâyetin bir yöneticinin önüne düşer, kararı insan verir.
        </p>

        {alinti && (
          <p className="oyuk mb-3 whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-[12px] text-solgun">
            {alinti}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {(sebepler.data?.sebepler ?? []).map((s) => {
            const secili = s.anahtar === sebep;
            return (
              <button
                key={s.anahtar}
                onClick={() => setSebep(s.anahtar)}
                aria-pressed={secili}
                className={`bas rounded-full border px-3 py-2 text-[12px] ${
                  secili ? 'border-altin bg-altin/15 text-altin' : 'border-kenar text-solgun'
                }`}
              >
                {s.metin}
              </button>
            );
          })}
        </div>

        <textarea
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder={
            aciklamaZorunlu ? 'Ne olduğunu kısaca yaz (zorunlu)' : 'Eklemek istediğin bir şey?'
          }
          className="oyuk mt-3 w-full rounded-lg px-3 py-2.5 text-[13px] text-parsomen"
        />

        <div className="mt-3 flex gap-2">
          <Buton tur="anahat" className="flex-1" onClick={onKapat}>
            Vazgeç
          </Buton>
          <Buton className="flex-1" onClick={() => mut.mutate()} disabled={!gonderilebilir}>
            {mut.isPending ? 'Gönderiliyor…' : 'Şikâyet et'}
          </Buton>
        </div>
        {hata && <EngelNotu kisa={hata} uzun="Sebebini gözden geçir ve tekrar dene." />}
      </div>
    </>
  );
}
