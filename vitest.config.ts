import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
    // styles.css metin olarak okunabilsin (`ortam.test.ts`: CSS ile ortam
    // tuvali aynı hareketi çiziyor mu); öbür CSS eskisi gibi boş.
    css: { include: [/styles\.css/] },
  },
});
