#!/bin/sh
# P6 — restore a backup made by backup.sh INTO A NEW, EMPTY database
# (never over the live one):
#   sh scripts/restore.sh <dump> <target_database_url> [uploads.tar.gz] [target_upload_parent]
# On Neon, make an empty database (or branch) for it first. Then check it
# with scripts/verify-restore.sh before pointing the site at it.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$HERE/.backup.env" ] && . "$HERE/.backup.env"
DUMP=${1:?dump file}
TARGET=${2:?target database URL}
TARGET=${TARGET%%\?schema=*}
LIVE=${BACKUP_DATABASE_URL:-}
LIVE=${LIVE%%\?schema=*}
if [ -n "$LIVE" ] && [ "$TARGET" = "$LIVE" ]; then echo "Refusing to restore over the live database. Use a new, empty database." >&2; exit 1; fi
TABLES=$(psql "$TARGET" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
if [ "$TABLES" != "0" ]; then echo "Target database is not empty ($TABLES tables). Refusing." >&2; exit 1; fi
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$TARGET" "$DUMP"
if [ "${3:-}" ]; then mkdir -p "${4:?target upload parent dir}"; tar -xzf "$3" -C "$4"; fi
echo "restored into the target database"
