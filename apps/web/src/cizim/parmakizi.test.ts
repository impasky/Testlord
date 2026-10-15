/**
 * Görsel bozulma testi (docs/24): her çizimin parmak izi kayıtlı izle
 * karşılaştırılıyor. Bilerek değişen çizimde izler yeniden yazılır:
 *
 *   PARMAKIZI_YAZ=1 pnpm test -- parmakizi
 *
 * ve `parmakizi.json`daki değişiklik incelemede görünür.
 */
import { describe, expect, it } from 'vitest';
import { BINA_ADLARI, binaModeli } from './binalar';
import {
  BIRLIK_ADLARI,
  DUSMAN_ADLARI,
  EKIPMAN_ADLARI,
  birlikModeli,
  dusmanModeli,
  ekipmanModeli,
} from './birlikler';
import { BOLGE_SAHNELERI, BOLGE_TIPLERI, bolgeModeli } from './bolgeler';
import { DIYAR_ADLARI, diyarModeli } from './diyarlar';
import { GENERAL_ADLARI, LORD_ADLARI, generalModeli, lordModeli } from './kisiler';
import { karsilastir, parmakIzi, type ParmakIzi } from './parmakizi';
import { savasAnahtari, savasModeli } from './savas';
import type { Model } from './uc';
import { ZEMIN_ADLARI, zeminModeli } from './zeminler';

/*
 * Dosya Node'un `fs`iyle okunuyor; web paketinin tiplerinde Node yok
 * (arayüz tarayıcıda koşuyor), o yüzden dinamik ve elle tiplenmiş.
 */
type Fs = {
  existsSync(p: string): boolean;
  readFileSync(p: string, k: 'utf8'): string;
  writeFileSync(p: string, v: string): void;
};
const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as Fs;
const { fileURLToPath } = (await import(/* @vite-ignore */ 'node:' + 'url')) as {
  fileURLToPath(u: URL): string;
};
const ortam = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
  ?.env;
const DOSYA = fileURLToPath(new URL('./parmakizi.json', import.meta.url));

/** Denetlenen çizimler: oyunun gösterdiği her aile. */
function katalog(): [string, () => Model | null][] {
  const k: [string, () => Model | null][] = [];
  for (const ad of BINA_ADLARI) k.push([`bina:${ad}`, () => binaModeli(ad)]);
  for (const ad of BIRLIK_ADLARI) k.push([`birlik:${ad}`, () => birlikModeli(ad)]);
  for (const ad of DUSMAN_ADLARI) k.push([`dusman:${ad}`, () => dusmanModeli(ad)]);
  for (const ad of EKIPMAN_ADLARI) k.push([`ekipman:${ad}`, () => ekipmanModeli(ad)]);
  for (const ad of GENERAL_ADLARI) k.push([`general:${ad}`, () => generalModeli(ad)]);
  for (const ad of LORD_ADLARI) k.push([`lord:${ad}`, () => lordModeli(ad)]);
  for (const kod of ['000000', '111111', '333333', '555555', '340254'])
    k.push([`lord:giy-${kod}`, () => lordModeli(`giy-${kod}`)]);
  for (const ad of BOLGE_SAHNELERI) k.push([`bolge:${ad}`, () => bolgeModeli(ad)]);
  for (const t of BOLGE_TIPLERI)
    for (const v of ['b', 'c']) k.push([`bolge:${t}_3_${v}`, () => bolgeModeli(`${t}_3_${v}`)]);
  for (const ad of ZEMIN_ADLARI) k.push([`zemin:${ad}`, () => zeminModeli(ad)]);
  for (const ad of DIYAR_ADLARI)
    for (const kadraj of ['kapak', 'harita'] as const)
      k.push([`diyar:${ad}:${kadraj}`, () => diyarModeli(ad, kadraj)]);
  for (const [i, tip] of ['tarla', 'kale'].entries()) {
    const a = savasAnahtari({
      tip,
      saldiran: { kalan: { mizrakci: 40, okcu: 25, suvari: 10 }, kayip: { mizrakci: 12 } },
      savunan: { kalan: { okcu: 4 }, kayip: { milis: 30, mizrakci: 15 } },
      saldiranKazandi: i === 0,
      tahkimat: i === 1,
    });
    k.push([a, () => savasModeli(a.slice('savas:'.length))]);
  }
  return k;
}

describe('görsel bozulma testi (parmak izi)', () => {
  const izler = Object.fromEntries(
    katalog().map(([ad, uret]) => [ad, parmakIzi(uret() ?? [])] as const),
  ) as Record<string, ParmakIzi>;

  if (ortam?.PARMAKIZI_YAZ) {
    fs.writeFileSync(DOSYA, JSON.stringify(izler, null, 1) + '\n');
  }

  it('her çizimin kayıtlı bir izi var ve izi tutuyor', () => {
    expect(fs.existsSync(DOSYA), 'parmakizi.json yok: PARMAKIZI_YAZ=1 pnpm test').toBe(true);
    const kayitli = JSON.parse(fs.readFileSync(DOSYA, 'utf8')) as Record<string, ParmakIzi>;
    const bozulan: string[] = [];
    for (const [ad, iz] of Object.entries(izler)) {
      const eski = kayitli[ad];
      if (!eski) {
        bozulan.push(`${ad}: kayıtlı izi yok (yeni çizim mi? PARMAKIZI_YAZ=1)`);
        continue;
      }
      const f = karsilastir(eski, iz);
      if (f.length) bozulan.push(`${ad}: ${f.join('; ')}`);
    }
    for (const ad of Object.keys(kayitli))
      if (!izler[ad]) bozulan.push(`${ad}: çizim artık yok (PARMAKIZI_YAZ=1)`);
    expect(bozulan, bozulan.join('\n')).toEqual([]);
  });

  it('boş ya da bozuk çizim yok', () => {
    for (const [ad, iz] of Object.entries(izler)) {
      expect(iz.n, ad).toBeGreaterThan(10);
      expect(Number.isFinite(iz.alan) && iz.alan > 0, ad).toBe(true);
      expect(iz.merkez.every(Number.isFinite), ad).toBe(true);
    }
  });
});

describe('parmak izi karşılaştırması', () => {
  const temel: ParmakIzi = {
    n: 1000,
    alan: 500,
    merkez: [0, 0],
    kutu: [-10, -10, 20, 20],
    renk: { '#aa0000': 60, '#00aa00': 40 },
  };
  it('küçük gürültü aynı çizim', () => {
    expect(karsilastir(temel, { ...temel, n: 1004, alan: 501, merkez: [0.05, 0] })).toEqual([]);
  });
  it('kaybolan parça, kayma ve renk değişimi yakalanıyor', () => {
    expect(karsilastir(temel, { ...temel, alan: 450 }).join()).toMatch(/alan/);
    expect(karsilastir(temel, { ...temel, merkez: [1, 0] }).join()).toMatch(/merkez/);
    expect(karsilastir(temel, { ...temel, renk: { '#aa0000': 50, '#00aa00': 50 } }).join()).toMatch(
      /renk/,
    );
    expect(karsilastir(temel, { ...temel, n: 900 }).join()).toMatch(/çokgen/);
  });
});
