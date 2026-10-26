#!/bin/sh
# P6 — nightly backup (PostgreSQL). Run once a day from cron, or a CI job:
#   sh scripts/backup.sh
# Needs: BACKUP_DATABASE_URL (the DIRECT connection string — on Neon, the
# non-pooler host), UPLOAD_DIR, BACKUP_DIR (env or .backup.env next to this
# script), and pg_dump (PostgreSQL client 16+) on PATH. Hostinger shared
# hosting may not provide pg_dump; run it from a machine that has it.
# Writes <BACKUP_DIR>/ladwani-<date>.dump (pg_dump custom format) and
# uploads-<date>.tar.gz, keeps KEEP_DAYS (default 14).
# Neon also keeps its own point-in-time history (the project's retention
# window); this file is the copy you hold yourself.
# The ID_PROOF_KEY is NOT in the backup: keep it separately and safely —
# without it the encrypted ID proofs and certificates cannot be read.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$HERE/.backup.env" ] && . "$HERE/.backup.env"
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL missing (direct connection string)}"
: "${BACKUP_DIR:?BACKUP_DIR missing}" "${UPLOAD_DIR:=./uploads}" "${KEEP_DAYS:=14}"
URL=${BACKUP_DATABASE_URL%%\?schema=*} # pg_dump does not understand Prisma's ?schema=
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$BACKUP_DIR"
umask 077
# Custom format: compressed, and pg_restore can restore it selectively. One
# consistent snapshot without locking the site.
pg_dump --format=custom --no-owner --no-privileges --file="$BACKUP_DIR/ladwani-$STAMP.dump" "$URL"
if [ -d "$UPLOAD_DIR" ]; then tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"; fi
find "$BACKUP_DIR" -name 'ladwani-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $BACKUP_DIR/ladwani-$STAMP.dump"
