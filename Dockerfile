# Lordlar Çağı — tek servis imajı: API + arayüz + worker (docs/05 §3).
#
# NEDEN DOCKERFILE: platformların kendi Node derleyicileri geliştirme
# bağımlılıklarını derlemeden sonra silebiliyor. O zaman açılıştaki
# migration (`prisma migrate deploy`) ve sunucu konsolundaki komutlar
# (`pnpm yonetici ver …`, `pnpm yayin-kontrolu`) çalışmaz — ve bunu ilk
# yayında öğrenmek pahalı. İmaj her yerde aynı: DigitalOcean App Platform,
# bir Droplet ya da kendi makinen. CI her gönderimde derleyip çalıştırıyor.
#
# İki aşama: `derle` her şeyi kurup arayüzü ve API'yi derliyor; çalışma
# imajı yalnız API'nin üretim bağımlılıklarını (prisma CLI ve tsx dahil:
# ikisi de çalışma anında kullanılıyor) ve derlenmiş çıktıyı taşıyor.

FROM node:22-bookworm-slim AS taban
# Prisma'nın motoru OpenSSL istiyor; slim imajda yok.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV COREPACK_HOME=/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    CI=true
WORKDIR /uygulama
# pnpm sürümü package.json'daki packageManager'dan.
COPY package.json ./
RUN corepack enable && corepack install && chmod -R a+rX /corepack

FROM taban AS derle
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM taban AS calis
ENV NODE_ENV=production \
    PORT=3000
COPY . .
# Yalnız API ve bağımlılıkları (@lordlar/shared); arayüz derlenmiş geliyor.
RUN pnpm install --frozen-lockfile --prod --filter "@lordlar/api..."
COPY --from=derle /uygulama/apps/api/dist apps/api/dist
COPY --from=derle /uygulama/apps/web/dist apps/web/dist
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
