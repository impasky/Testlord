import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Virgülle ayrılmış liste. localhost ve 127.0.0.1 FARKLI origin sayılır —
  // ikisi de olmazsa tarayıcı isteği CORS'ta düşer.
  WEB_ORIGIN: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Ortam değişkenleri geçersiz:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  webOrigins: parsed.data.WEB_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
