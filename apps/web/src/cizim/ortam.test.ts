import { describe, expect, it } from 'vitest';
import {
  CIMEN_SAYDAM,
  ISIK_A,
  ISIK_B,
  ISIK_TITRE,
  RUZGAR,
  SU_A,
  SU_B,
  SU_SAYDAM,
  isikSaydamligi,
  kayma,
} from './ortam';

/** styles.css metin olarak: tuval ve CSS katmanları aynı hareketi çizsin. */
const CSS = Object.values(
  import.meta.glob<string>('../styles.css', { query: '?raw', import: 'default', eager: true }),
)[0]!;

/** Seçicinin bütün kurallarının gövdesi (birleşik seçicidekiler de). */
function kural(secici: string): string {
  const govde: string[] = [];
  for (let i = CSS.indexOf(`${secici} {`); i >= 0; i = CSS.indexOf(`${secici} {`, i + 1))
    govde.push(CSS.slice(i, CSS.indexOf('}', i)));
  if (!govde.length) throw new Error(`styles.css'te yok: ${secici}`);
  return govde.join('\n');
}

describe('ortam katmanları', () => {
  it('ışığın titremesi anahtar karelerden geçiyor, tur başa sarıyor', () => {
    for (const [p, s] of ISIK_TITRE) expect(isikSaydamligi(p * 2.9, 2.9)).toBeCloseTo(s, 6);
    expect(isikSaydamligi(0.04 * 2.9, 2.9)).toBeCloseTo((0.55 + 0.3) / 2, 6);
    expect(isikSaydamligi(2.9 * 3 + 0.1, 2.9)).toBeCloseTo(isikSaydamligi(0.1, 2.9), 6);
    // Eksi gecikme turu önde başlatıyor (CSS `animation-delay: -1.3s`).
    expect(isikSaydamligi(0, ISIK_B.sure, ISIK_B.gecikme)).toBeCloseTo(
      isikSaydamligi(1.3, ISIK_B.sure),
      6,
    );
  });

  it('kayma tur başında sıfır, tur boyunca doğrusal', () => {
    expect(kayma(0, 12, [-640, 0])).toEqual([-0, 0]);
    expect(kayma(6, 12, [-640, 0])).toEqual([-320, 0]);
    expect(kayma(12, 12, [-640, 0])[0]).toBeCloseTo(0, 9);
    expect(kayma(-3, 12, [-640, 0])[0]).toBeCloseTo(-480, 9);
  });

  it('süreler ve saydamlıklar styles.css ile aynı', () => {
    expect(kural('.hareket-su-a')).toContain(`su-ak-a ${SU_A.sure}s linear infinite`);
    expect(kural('.hareket-su-a')).toContain(
      `background-size: ${SU_A.karo[0]}px ${SU_A.karo[1]}px`,
    );
    expect(CSS).toContain(`translate3d(${SU_A.kayma[0]}px, ${SU_A.kayma[1]}px, 0)`);
    expect(kural('.hareket-su-b')).toContain(`su-ak-b ${SU_B.sure}s linear infinite`);
    expect(kural('.hareket-su-b')).toContain(
      `background-size: ${SU_B.karo[0]}px ${SU_B.karo[1]}px`,
    );
    expect(kural('.hareket-su-b')).toContain(`opacity: ${SU_B.saydam}`);
    expect(kural('.hareket-su-b')).toContain('inset: 0 0 0 -176px');
    expect(kural('.hareket-su-b')).toContain('background-position: 60px 30px');
    expect(SU_B.baslangic).toEqual([-176 + 60, 30]);
    expect(kural('.hareket-su')).toContain(`opacity: ${SU_SAYDAM}`);
    expect(kural('.hareket-cimen')).toContain(`opacity: ${CIMEN_SAYDAM}`);
    expect(kural('.hareket-cimen-a')).toContain(`cimen-es ${RUZGAR.sure}s linear infinite`);
    expect(CSS).toContain(`translate3d(${RUZGAR.kayma[0]}px, 0, 0)`);
    expect(kural('.hareket-isik')).toContain(`isik-titre ${ISIK_A.sure}s linear infinite`);
    expect(kural('.hareket-isik-b')).toContain(`animation-duration: ${ISIK_B.sure}s`);
    expect(kural('.hareket-isik-b')).toContain(`animation-delay: ${ISIK_B.gecikme}s`);
    // Titremenin anahtar kareleri: her yüzde, aynı saydamlık.
    const k = CSS.slice(CSS.indexOf('@keyframes isik-titre'));
    for (const [p, s] of ISIK_TITRE.slice(1, -1))
      expect(k).toMatch(new RegExp(`${Math.round(p * 100)}% \\{\\s*opacity: ${s};`));
  });
});
