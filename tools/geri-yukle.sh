#!/usr/bin/env bash
#
# Lordlar Çağı — yedekten geri yükleme (docs/05 §4).
#
# `tools/yedekle.sh`in aldığı custom-format dump'ı bir veritabanına
# yükler ve yüklenenin sağlam olduğunu DOĞRULAR: tablo sayısı dump'la
# aynı mı, migration geçmişi yerinde mi, temel tablolarda kaç satır var.
#
# KULLANIM
#   HEDEF_URL=postgresql://... tools/geri-yukle.sh yedek/lordlar-2026-10-16-0317.dump
#   HEDEF_URL=postgresql://... tools/geri-yukle.sh <dump> --uzerine-yaz
#
# İKİ EMNİYET
#
#   1. Hedef AÇIKÇA veriliyor (HEDEF_URL). `DATABASE_URL` bilerek
#      okunmuyor: yedekle.sh'ı çalıştıran kabukta duran adres canlı
#      veritabanıdır ve bir kopyala-yapıştır hatası onun üstüne yazardı.
#   2. Hedef DOLUYSA (tablo varsa) betik durur; üstüne yazmak için
#      `--uzerine-yaz` gerekir. Gerçek bir kurtarmada doğru sıra: önce
#      hedefin kendisini yedekle, sonra üstüne yaz.
#
# Yükleme TEK İŞLEM (--single-transaction): yarıda kalan bir yükleme
# yarım bir veritabanı bırakmıyor — ya hepsi ya hiçbiri.
#
# Adres hiçbir yere yazılmıyor; ekranda yalnız sunucu ve veritabanı adı
# görünüyor (parola maskeli).

set -euo pipefail

DOSYA="${1:-}"
BAYRAK="${2:-}"

hata() {
  echo "HATA: $*" >&2
  exit 2
}

[[ -n "$DOSYA" ]] || hata "dump dosyası ver: tools/geri-yukle.sh yedek/lordlar-....dump"
[[ -f "$DOSYA" ]] || hata "dosya yok: $DOSYA"
[[ -n "${HEDEF_URL:-}" ]] ||
  hata "HEDEF_URL ver. DATABASE_URL bilerek okunmuyor: yanlışlıkla canlı veritabanının üstüne yazılmasın."

# postgresql://kullanici:parola@sunucu:5432/vt?x=y  ->  sunucu:5432/vt
maskeli="$(sed -E 's#^[a-z]+://([^@]*@)?([^/?]*)(/[^?]*)?.*#\2\3#' <<<"$HEDEF_URL")"
echo "Hedef: $maskeli"

# Dump okunuyor mu? Bozuk ya da yarım dosya burada durur, hedefe dokunmadan.
DUMP_TABLO="$(pg_restore --list "$DOSYA" | grep -c ' TABLE DATA ' || true)"
[[ "$DUMP_TABLO" -gt 0 ]] || hata "dump'ta tablo verisi yok ya da dosya okunamadı: $DOSYA"
echo "Dump: $DOSYA ($(du -h "$DOSYA" | cut -f1), $DUMP_TABLO tablo verisi)"

# psql'in kullanıcının ~/.psqlrc'sini okumaması için -X; sessiz ve düz çıktı.
sorgu() { psql -X -q -At -v ON_ERROR_STOP=1 "$HEDEF_URL" -c "$1"; }

DOLU="$(sorgu "select count(*) from information_schema.tables where table_schema = 'public'")"
if [[ "$DOLU" -gt 0 && "$BAYRAK" != "--uzerine-yaz" ]]; then
  hata "hedefte $DOLU tablo var. Üstüne yazmak için --uzerine-yaz ekle — önce HEDEFİN kendisini yedekle."
fi

BASLA="$(date +%s)"
pg_restore --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error \
  -d "$HEDEF_URL" "$DOSYA"
SURE="$(($(date +%s) - BASLA))"
echo "Yüklendi: ${SURE} sn"

# --- Doğrulama -------------------------------------------------------
TABLO="$(sorgu "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'")"
MIGRATION="$(sorgu 'select count(*) from "_prisma_migrations" where finished_at is not null')"
SON_MIGRATION="$(sorgu 'select migration_name from "_prisma_migrations" where finished_at is not null order by migration_name desc limit 1')"
echo "Tablo: $TABLO · migration: $MIGRATION (son: $SON_MIGRATION)"
for t in User Lord World Region Battle; do
  printf '  %-8s %s satır\n' "$t" "$(sorgu "select count(*) from \"$t\"")"
done

# Dump'taki her tablo verisi bir tabloya yüklenmiş olmalı. Fazlası
# olabilir (boş tablolar da TABLE DATA taşır) ama eksiği bozukluktur.
if [[ "$TABLO" -lt "$DUMP_TABLO" ]]; then
  hata "dump $DUMP_TABLO tablo verisi taşıyor, hedefte $TABLO tablo var"
fi
echo "GERİ YÜKLEME TAMAM"
