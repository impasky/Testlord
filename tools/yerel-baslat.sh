#!/usr/bin/env bash
# Yerel geliştirme yığınını ayağa kaldırır: PostgreSQL + API + worker + arayüz.
# Zaten çalışanları yeniden başlatmaz.
#
#   bash tools/yerel-baslat.sh
set -uo pipefail

VERI=${VERI:-/tmp/pgtest/data}
LOG=${LOG:-/tmp/pgtest}
PGBIN=/usr/lib/postgresql/16/bin
mkdir -p "$LOG"

hazir() { pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; }

if ! hazir; then
  echo "PostgreSQL başlatılıyor…"
  # initdb ve postgres root olarak çalışmayı reddediyor; postgres kullanıcısı şart.
  if [ ! -d "$VERI" ]; then
    mkdir -p "$(dirname "$VERI")" && chown postgres:postgres "$(dirname "$VERI")"
    su postgres -c "$PGBIN/initdb -D $VERI -U lordlar --auth=trust" >/dev/null
  fi
  su postgres -c "$PGBIN/pg_ctl -D $VERI -l $LOG/pg.log -o '-k /tmp -h 127.0.0.1 -p 5432' start" >/dev/null
  for _ in $(seq 20); do hazir && break; sleep 0.5; done
  hazir || { echo "PostgreSQL açılmadı, $LOG/pg.log'a bak"; exit 1; }
  psql -h 127.0.0.1 -U lordlar -d postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname='lordlar_cagi'" | grep -q 1 \
    || psql -h 127.0.0.1 -U lordlar -d postgres -c "CREATE DATABASE lordlar_cagi;" >/dev/null
fi

# Göç HER ZAMAN uygulanıyor, yalnızca veritabanı yeni açılırken değil.
#
# Önceden bu satır postgres'i başlatan bloğun içindeydi ve oturum ortasında
# eklenen bir göç hiç uygulanmıyordu: postgres zaten ayakta olduğu için blok
# atlanıyor, API eski şemayla açılıyor ve "column does not exist" veriyordu.
# migrate deploy zaten fikirsiz (idempotent) — her açılışta çalışması bedava.
pnpm --filter @lordlar/api exec prisma migrate deploy 2>&1 | tail -1
echo "PostgreSQL hazır."

ayakta() { curl -sf -o /dev/null --max-time 2 "$1"; }

if ! ayakta http://localhost:3000/api/dunya && ! curl -s --max-time 2 http://localhost:3000/api/dunya | grep -q .; then
  echo "API başlatılıyor…"
  (setsid nohup pnpm --filter @lordlar/api dev > "$LOG/api.log" 2>&1 < /dev/null &)
fi

# pgrep -f, bu betiği çalıştıran kabuğun kendi komut satırını da yakalıyor;
# bu yüzden yalnızca NODE süreçleri sayılıyor.
worker_calisiyor() {
  pgrep -f "src/worker.ts" 2>/dev/null | while read -r pid; do
    [ "$(ps -o comm= -p "$pid" 2>/dev/null)" = node ] && echo var
  done | grep -q var
}
if ! worker_calisiyor; then
  echo "Worker başlatılıyor…"
  (setsid nohup pnpm --filter @lordlar/api worker > "$LOG/worker.log" 2>&1 < /dev/null &)
  sleep 3
fi

if ! ayakta http://localhost:5173; then
  echo "Arayüz başlatılıyor…"
  (setsid nohup pnpm --filter @lordlar/web dev > "$LOG/web.log" 2>&1 < /dev/null &)
fi

for _ in $(seq 30); do
  curl -s --max-time 2 -o /dev/null http://localhost:3000/api/dunya && ayakta http://localhost:5173 && break
  sleep 1
done
echo "API:  $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/dunya)"
echo "Web:  $(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173)"
