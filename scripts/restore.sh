#!/bin/sh
# P6 — restore a backup made by backup.sh INTO A NEW, EMPTY database
# (never over the live one): sh scripts/restore.sh <dump.sql.gz> <target_db> [uploads.tar.gz] [target_upload_parent]
# Then check it (scripts/verify-restore.sh) before pointing the site at it.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$HERE/.backup.env" ] && . "$HERE/.backup.env"
DUMP=${1:?dump file}
TARGET=${2:?target database name}
: "${DB_HOST:=localhost}" "${DB_USER:?DB_USER missing}" "${DB_PASS:?DB_PASS missing}"
if [ "$TARGET" = "${DB_NAME:-}" ]; then echo "Refusing to restore over the live database ($DB_NAME). Use a new database name." >&2; exit 1; fi
TABLES=$(mysql --host="$DB_HOST" --user="$DB_USER" --password="$DB_PASS" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TARGET'")
if [ "$TABLES" != "0" ]; then echo "Target database $TARGET is not empty ($TABLES tables). Refusing." >&2; exit 1; fi
gunzip -c "$DUMP" | mysql --host="$DB_HOST" --user="$DB_USER" --password="$DB_PASS" --default-character-set=utf8mb4 "$TARGET"
if [ "${3:-}" ]; then mkdir -p "${4:?target upload parent dir}"; tar -xzf "$3" -C "$4"; fi
echo "restored into $TARGET"
