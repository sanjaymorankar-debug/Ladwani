#!/bin/sh
# P6 — compare row counts of every table between two databases (live vs restored copy).
#   sh scripts/verify-restore.sh <source_database_url> <restored_database_url>
set -eu
SRC=${1:?source database URL}; DST=${2:?restored database URL}
SRC=${SRC%%\?schema=*}; DST=${DST%%\?schema=*}
FAIL=0
for t in $(psql "$SRC" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"); do
  a=$(psql "$SRC" -tAc "SELECT COUNT(*) FROM \"$t\""); b=$(psql "$DST" -tAc "SELECT COUNT(*) FROM \"$t\"" 2>/dev/null || echo missing)
  [ "$a" = "$b" ] || { echo "MISMATCH $t: $a vs $b"; FAIL=1; }
done
[ $FAIL = 0 ] && echo "restore verified: every table matches" || exit 1
