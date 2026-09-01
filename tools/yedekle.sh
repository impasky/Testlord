#!/usr/bin/env bash
#
# Lordlar Çağı — veritabanı yedeği.
#
# Neden custom format (-Fc): düz SQL'e göre küçük, paralel geri yüklenebilir
# ve tek tablo seçilerek kurtarılabilir. Kaza sonrası "her şeyi geri yükle"
# nadiren istenen şeydir.
#
# KULLANIM
#   tools/yedekle.sh                      # DATABASE_URL'den okur
#   YEDEK_DIZIN=/mnt/yedek tools/yedekle.sh
#   SAKLA_GUN=14 tools/yedekle.sh
#
# GERİ YÜKLEME
#   pg_restore --clean --if-exists -d "$DATABASE_URL" yedek/lordlar-2026-09-01.dump
#
# ZAMANLAMA
#   Günlük, gecenin trafiği en düşük saatinde. Örnek crontab satırı:
#     17 3 * * *  cd /srv/lordlar && tools/yedekle.sh >> /var/log/lordlar-yedek.log 2>&1
#   Render ücretsiz katmanında cron yok; yedeği kendi makinenden ya da
#   ücretsiz bir zamanlayıcıdan DATABASE_URL'in dış adresiyle al.
#
# ÖNEMLİ: Yedeği veritabanıyla aynı diskte tutmak yedek değildir. Aynı
# makine gidince ikisi birden gider. Başka bir yere kopyalanmalı.

set -euo pipefail

YEDEK_DIZIN="${YEDEK_DIZIN:-yedek}"
SAKLA_GUN="${SAKLA_GUN:-7}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  # apps/api/.env içinden okumayı dene
  ENV_DOSYA="$(dirname "$0")/../apps/api/.env"
  if [[ -f "$ENV_DOSYA" ]]; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_DOSYA" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL tanımlı değil ve apps/api/.env içinde bulunamadı." >&2
  exit 2
fi

mkdir -p "$YEDEK_DIZIN"
DOSYA="$YEDEK_DIZIN/lordlar-$(date +%Y-%m-%d-%H%M).dump"

echo "Yedek alınıyor: $DOSYA"
pg_dump --format=custom --no-owner --no-acl --file="$DOSYA" "$DATABASE_URL"

BOYUT="$(du -h "$DOSYA" | cut -f1)"
echo "Tamam: $DOSYA ($BOYUT)"

# Boş bir dump sessizce başarılı görünür; küçük dosya uyarı sebebidir.
BAYT="$(stat -c%s "$DOSYA")"
if [[ "$BAYT" -lt 10240 ]]; then
  echo "UYARI: yedek 10 KB altinda ($BAYT bayt). Veritabani gercekten bos mu?" >&2
fi

# Rotasyon
ESKI="$(find "$YEDEK_DIZIN" -name 'lordlar-*.dump' -mtime "+$SAKLA_GUN" -print -delete | wc -l)"
if [[ "$ESKI" -gt 0 ]]; then
  echo "$ESKI eski yedek silindi (>$SAKLA_GUN gün)."
fi

echo "Yedekteki tablolar:"
pg_restore --list "$DOSYA" | grep -c 'TABLE DATA' | xargs printf '  %s tablo verisi\n'
