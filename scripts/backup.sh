#!/bin/sh
# P6 — nightly backup for shared hosting (hPanel → Cron Jobs, once a day):
#   sh /home/<user>/app/scripts/backup.sh
# Needs: DB_HOST DB_USER DB_PASS DB_NAME, UPLOAD_DIR, BACKUP_DIR (env or .backup.env next to this script).
# Writes <BACKUP_DIR>/ladwani-<date>.sql.gz and uploads-<date>.tar.gz, keeps KEEP_DAYS (default 14).
# The ID_PROOF_KEY is NOT in the backup: keep it separately and safely —
# without it the encrypted ID proofs and certificates cannot be read.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$HERE/.backup.env" ] && . "$HERE/.backup.env"
: "${DB_HOST:=localhost}" "${DB_USER:?DB_USER missing}" "${DB_PASS:?DB_PASS missing}" "${DB_NAME:?DB_NAME missing}"
: "${BACKUP_DIR:?BACKUP_DIR missing}" "${UPLOAD_DIR:=./uploads}" "${KEEP_DAYS:=14}"
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$BACKUP_DIR"
umask 077
# --single-transaction: consistent without locking the site; --no-tablespaces: no PROCESS privilege on shared hosting.
mysqldump --host="$DB_HOST" --user="$DB_USER" --password="$DB_PASS" --single-transaction --routines --triggers --no-tablespaces --default-character-set=utf8mb4 "$DB_NAME" \
  | gzip > "$BACKUP_DIR/ladwani-$STAMP.sql.gz"
if [ -d "$UPLOAD_DIR" ]; then tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"; fi
find "$BACKUP_DIR" -name 'ladwani-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $BACKUP_DIR/ladwani-$STAMP.sql.gz"
