/**
 * Renk sınıfları TANIMLI renklerle yazılmalı.
 *
 * Tailwind tanımadığı bir renk adına (`border-cerceve`, `text-metin`,
 * `bg-koyu2`) hata vermiyor: sınıf hiç üretilmiyor ve öğe sessizce
 * varsayılana düşüyor. Kenarlık için varsayılan METİN RENGİ — Pazar'ın
 * seçim düğmeleri bu yüzden Demirhane'dekilerden farklı, beyaz çerçeveli
 * çiziliyordu; dizilim ızgarasının hücreleri zeminsiz kalıyordu. Sekiz
 * dosyada yirmi beş yerde böyleydi ve hiçbir denetim görmedi: okunurluk
 * denetimi kontrastı ölçüyor, kenarlığın hangi renkte olduğunu değil.
 *
 * Bu sınama kaynağı tarıyor: renk alan her sınıfın adı ya `styles.css`
 * içindeki bir `--color-*` token'ı ya da Tailwind'in yerleşik bir rengi
 * olmalı.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Bu sınama `test/` altında, `src/` altında değil: kaynağı Node ile
 * okuyor ve web projesinin tip denetimi Node tiplerini bilmiyor —
 * bilmemeli de, yoksa tarayıcı kodunda `process.env` gibi bir hata
 * derleyiciden geçerdi. (`import.meta.glob` ile `?raw` denendi: Vitest
 * CSS'i işlemediği için stil dosyası boş dönüyor.)
 */
const KOK = fileURLToPath(new URL('../src/', import.meta.url));

function dosyalar(dizin: string): string[] {
  return readdirSync(dizin).flatMap((f) => {
    const yol = join(dizin, f);
    if (statSync(yol).isDirectory()) return dosyalar(yol);
    return /\.tsx?$/.test(f) && !f.endsWith('.test.ts') ? [yol] : [];
  });
}

const css = readdirSync(KOK)
  .filter((f) => f.endsWith('.css'))
  .map((f) => readFileSync(join(KOK, f), 'utf8'))
  .join('\n');
const TANIMLI = new Set([...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]!));

/** Tailwind'in kendi renkleri ve özel değerler. */
const YERLESIK = new Set([
  'black',
  'white',
  'transparent',
  'current',
  'inherit',
  'red',
  'green',
  'blue',
  'yellow',
  'gray',
  'slate',
  'zinc',
  'neutral',
  'stone',
  'amber',
  'orange',
  'emerald',
  'sky',
  'indigo',
  'violet',
  'purple',
  'pink',
  'rose',
  'lime',
  'teal',
  'cyan',
  'fuchsia',
]);

/**
 * Aynı öneklerle yazılan ama RENK olmayan sınıflar: boyut, hizalama,
 * çizgi biçimi, degrade yönü… (`text-center`, `border-dashed`,
 * `bg-gradient-to-t`, `shadow-inner`).
 */
const RENK_OLMAYAN = new Set([
  'xs',
  'sm',
  'base',
  'md',
  'lg',
  'xl',
  'left',
  'right',
  'center',
  'justify',
  'start',
  'end',
  'top',
  'bottom',
  'wrap',
  'nowrap',
  'balance',
  'pretty',
  'ellipsis',
  'clip',
  'none',
  'solid',
  'dashed',
  'dotted',
  'double',
  'hidden',
  'collapse',
  'separate',
  'gradient',
  'linear',
  'radial',
  'conic',
  'cover',
  'contain',
  'fixed',
  'local',
  'scroll',
  'repeat',
  'no',
  'origin',
  'inner',
  'inset',
  'offset',
  'auto',
  'x',
  'y',
  't',
  'b',
  'l',
  'r',
]);

const ONEK =
  '(?:bg|text|border(?:-[trblxy])?|from|to|via|ring|fill|stroke|outline|decoration|divide|accent|caret|placeholder|shadow)';
const SINIF = new RegExp(
  `(?<![\\w-])${ONEK}-([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)(?:/[0-9.]+|/\\[[^\\]]+\\])?(?![\\w-])`,
  'g',
);

describe('renk sınıfları', () => {
  it('styles.css renk token’ları okunuyor', () => {
    // Sınamanın kendisi boşa dönmesin: token listesi boşsa her şey "tanımsız" çıkardı.
    expect(TANIMLI.size).toBeGreaterThan(10);
    expect(TANIMLI.has('kenar')).toBe(true);
  });

  it('her renk sınıfı tanımlı bir renge ait', () => {
    const liste = dosyalar(KOK);
    // Taranacak bir şey yoksa sınama boşa geçerdi.
    expect(liste.length).toBeGreaterThan(50);
    const tanimsiz: string[] = [];
    for (const dosya of liste) {
      for (const m of readFileSync(dosya, 'utf8').matchAll(SINIF)) {
        const ad = m[1]!;
        const kok = ad.split('-')[0]!;
        if (TANIMLI.has(ad) || YERLESIK.has(kok) || RENK_OLMAYAN.has(kok)) continue;
        // `2xl` gibi rakamla başlayanlar deseni zaten geçmiyor; kalan her şey renk.
        tanimsiz.push(`${dosya.slice(KOK.length)}: ${m[0]}`);
      }
    }
    expect(tanimsiz).toEqual([]);
  });
});
