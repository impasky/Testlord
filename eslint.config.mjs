// @ts-check
/**
 * Kök lint yapılandırması.
 *
 * package.json'da `lint` betiği vardı ama yapılandırma dosyası yoktu: komut
 * ilk satırda "ESLint couldn't find an eslint.config.js" diyerek ölüyordu.
 * Çalışmayan bir betik, olmayan betikten kötüdür — kimse koşturmuyorsa
 * kontrol edilmiş sanılan şey hiç kontrol edilmiyor demektir.
 *
 * Kurallar bilinçli olarak dar: tip denetimini `pnpm typecheck` zaten yapıyor,
 * biçimi `prettier` yapıyor. Buradaki iş, ikisinin de yakalayamadığı sessiz
 * hatalar — kullanılmayan değişken, kaçak `debugger`, `case` sızıntısı.
 */
import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';

export default ts.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'apps/api/prisma/migrations/**',
      'ekran-goruntuleri/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Kullanılmayan değişken çoğu zaman yarım kalmış bir düzenlemenin izi.
      // Başına alt çizgi koymak "bunu bilerek bıraktım" demenin yolu.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // `any` bu depoda birkaç yerde bilinçli (Prisma JSON alanları). Uyarı
      // kalsın ki görünsün, ama koşuyu kırmasın.
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-debugger': 'error',
      'no-fallthrough': 'error',
    },
  },
  {
    // Test araçları düz Node betiği; tarayıcı testleri `page.evaluate` içinde
    // tarayıcı global'lerini kullanıyor.
    files: ['tools/**/*.mjs'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
);
