/*
 * dil.js EN ÜSTTE ve bu sıra ÖNEMLİ.
 *
 * Derleme eklentisi metin taşıyan her modüle `t()` çağrısı koyuyor ve
 * bazı modüllerde bu çağrı MODÜL DÜZEYİNDE çalışıyor (`const TABLAR =
 * [{ ad: t('Şöhret') }]`). dil.js sonda olsaydı o çağrı, tuttuğu
 * durum daha ilklenmeden yapılır ve "Cannot access before
 * initialization" ile patlardı — gerçekten patladı.
 */
export * from './dil.js';
export * from './types.js';
export * from './balance.js';
export * from './rng.js';
export * from './economy.js';
export * from './progression.js';
export * from './equipment.js';
export * from './generals.js';
export * from './bolge-adi.js';
export * from './etki-adi.js';
export * from './combat.js';
export * from './duzen.js';
export * from './arastirma.js';
export * from './pazar.js';
export * from './hastane.js';
export * from './karsi.js';
export * from './sebep.js';
export * from './basarim.js';
export * from './casus.js';
export * from './gunluk.js';
export * from './sefer.js';
export * from './ittifak.js';
export * from './ittifakSeviye.js';
export * from './ittifakBasvuru.js';
export * from './pakt.js';
export * from './takviye.js';
export * from './kimlik.js';
export * from './ogretici.js';
export * from './rehber.js';
export * from './ipuclari.js';
export * from './ticaret.js';
export * from './harita.js';
export * from './tarama.js';
export * from './akin.js';
export * from './bina.js';
export * from './march.js';
export * from './odul.js';
export * from './birlesme.js';
export * from './moderasyon.js';
