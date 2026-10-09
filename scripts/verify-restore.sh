#!/bin/sh
# P6 — compare row counts of every table between two databases (live vs restored copy).
# sh scripts/verify-restore.sh <source_db> <restored_db>
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
[ -f "$HERE/.backup.env" ] && . "$HERE/.backup.env"
: "${DB_HOST:=localhost}" "${DB_USER:?DB_USER missing}" "${DB_PASS:?DB_PASS missing}"
SRC=${1:?source db}; DST=${2:?restored db}
q() { mysql --host="$DB_HOST" --user="$DB_USER" --password="$DB_PASS" -N -e "$1"; }
FAIL=0
for t in $(q "SELECT table_name FROM information_schema.tables WHERE table_schema='$SRC' ORDER BY table_name"); do
  a=$(q "SELECT COUNT(*) FROM \`$SRC\`.\`$t\`"); b=$(q "SELECT COUNT(*) FROM \`$DST\`.\`$t\`" 2>/dev/null || echo missing)
  [ "$a" = "$b" ] || { echo "MISMATCH $t: $a vs $b"; FAIL=1; }
done
[ $FAIL = 0 ] && echo "restore verified: every table matches" || exit 1
