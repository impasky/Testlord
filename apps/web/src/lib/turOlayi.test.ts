import { describe, expect, it } from 'vitest';
import { turOlayiniKes } from './turOlayi';

describe('turOlayiniKes', () => {
  it('animationiteration dinleyicisi eklenmiyor, ötekiler ekleniyor', () => {
    const kok = new EventTarget();
    turOlayiniKes(kok);
    const gelen: string[] = [];
    kok.addEventListener('animationiteration', () => gelen.push('tur'));
    kok.addEventListener('animationiteration', () => gelen.push('tur-yakala'), true);
    kok.addEventListener('animationend', () => gelen.push('son'));
    kok.addEventListener('click', { handleEvent: () => gelen.push('tık') }, { passive: true });
    for (const tur of ['animationiteration', 'animationend', 'click'])
      kok.dispatchEvent(new Event(tur));
    expect(gelen).toEqual(['son', 'tık']);
  });
});
