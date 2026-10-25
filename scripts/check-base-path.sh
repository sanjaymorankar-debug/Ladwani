#!/usr/bin/env bash
#
# Every URL this app builds for itself must carry BASE_PATH.
#
# The hub at bkesari.com serves this app under /ladwani/ and does not strip the
# prefix. Next's `basePath` covers next/link, useRouter and assets, but NOT
# fetch() — the argument is an ordinary runtime string. So a newly added
# `fetch('/api/...')` compiles, typechecks, passes every test, and then calls
# the hub's root in production instead of this app. Nothing else catches it,
# which is why this exists.
#
# Run with: bash scripts/check-base-path.sh

set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

# middleware.ts is the one legitimate exception: Next strips the prefix before
# middleware runs, so its pathname comparisons must NOT carry it. Verified —
# /ladwani/login reaches its allow-list and returns 200.
offenders=$(grep -rnE "[\`'\"]/api/" src/ \
  | grep -v 'BASE_PATH' \
  | grep -v '^src/lib/api-path.ts:' \
  | grep -v '^src/middleware.ts:' || true)

if [ -n "$offenders" ]; then
  fail=1
  echo "These build an API URL without BASE_PATH, so they would call the hub's"
  echo "root rather than this app once it is served under a prefix:"
  echo
  echo "$offenders" | sed 's/^/  /'
  echo
  echo "Write it as \`\${BASE_PATH}/api/...\` and import BASE_PATH from"
  echo "'@/lib/api-path'. In a JSX attribute it needs braces:"
  echo "  basePath={\`\${BASE_PATH}/api/auth\`}"
fi

# next.config.js must keep handing the value to the browser, or every one of
# those template literals silently resolves to the unprefixed path again.
if ! grep -q 'NEXT_PUBLIC_BASE_PATH' next.config.js; then
  fail=1
  echo "next.config.js no longer sets NEXT_PUBLIC_BASE_PATH, so BASE_PATH is"
  echo "empty in the browser and every API URL loses its prefix."
fi

if [ "$fail" -eq 0 ]; then
  echo "All of this app's API URLs carry BASE_PATH."
fi
exit "$fail"
