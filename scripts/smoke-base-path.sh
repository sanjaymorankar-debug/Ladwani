#!/usr/bin/env bash
#
# Smoke-tests a running build of this app under its base path.
#
#   bash scripts/smoke-base-path.sh http://127.0.0.1:3103/ladwani
#
# The app must be started with `next start` (as `npm start` does, without -H)
# against a database that has had `npm run db:seed` and `npm run db:seed:uat`,
# because the probes sign in as the UAT accounts (password TestPass@123).
# Every probe goes through the prefix, the way the bkesari.com hub forwards
# requests. Prints one line per probe; exits 1 if any failed.
set -uo pipefail

URL="${1:?usage: smoke-base-path.sh <base URL, e.g. http://127.0.0.1:3103/ladwani>}"
URL="${URL%/}"
PREFIX="/$(printf '%s' "$URL" | sed -E 's#^[a-z]+://[^/]+/?##')"
PREFIX="${PREFIX%/}"
ORIGIN="${URL%"$PREFIX"}"
PASSWORD="${SMOKE_PASSWORD:-TestPass@123}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0
ok()  { pass=$((pass + 1)); printf 'ok    %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL  %s\n      %s\n' "$1" "$2"; }

# probe <name> <jar|-> <path> <expected status> [<string the body must contain>]
probe() {
  local name="$1" jar="$2" path="$3" want="$4" needle="${5:-}" code
  local args=(-s -o "$WORK/body" -w '%{http_code}')
  [ "$jar" != - ] && args+=(-b "$WORK/$jar")
  code=$(curl "${args[@]}" "$URL$path") || code=000
  if [ "$code" != "$want" ]; then bad "$name" "GET $PREFIX$path: HTTP $code, expected $want"; return; fi
  if [ -n "$needle" ] && ! grep -qF -- "$needle" "$WORK/body"; then
    bad "$name" "GET $PREFIX$path: body does not contain '$needle'"; return
  fi
  ok "$name"
}

# redirect <name> <jar|-> <path> <expected path+query of Location>
# Location may be relative or absolute; only its path and query are compared,
# and they must stay under the prefix.
redirect() {
  local name="$1" jar="$2" path="$3" want="$4" loc
  local args=(-s -o /dev/null -D "$WORK/headers")
  [ "$jar" != - ] && args+=(-b "$WORK/$jar")
  curl "${args[@]}" "$URL$path" || true
  loc=$(grep -i '^location:' "$WORK/headers" | head -1 | sed -E 's/^[Ll]ocation: *//; s/\r$//')
  local rel
  rel=$(printf '%s' "$loc" | sed -E 's#^[a-z]+://[^/]+##')
  if [ "$rel" = "$want" ]; then ok "$name"; else bad "$name" "GET $PREFIX$path: Location '$loc', expected '$want'"; fi
}

# login <jar> <identifier> : next-auth's credentials flow through the prefix.
login() {
  local jar="$WORK/$1" csrf code
  csrf=$(curl -s -c "$jar" -b "$jar" "$URL/api/auth/csrf" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).csrfToken)}catch{}})')
  code=$(curl -s -c "$jar" -b "$jar" -o /dev/null -w '%{http_code}' -X POST "$URL/api/auth/callback/credentials" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "csrfToken=$csrf" --data-urlencode "identifier=$2" \
    --data-urlencode "password=${3:-$PASSWORD}" --data-urlencode "callbackUrl=$URL/dashboard" \
    --data-urlencode "json=true")
  printf '%s' "$code"
}

enc() { node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1"; }

echo "Smoke: $URL (prefix $PREFIX)"

# ── Public pages, served under the prefix and not at the root ─────────────
probe "landing page"                  - ""                 200 "Ladwani"
probe "login page"                    - "/login"           200 "$PREFIX/_next/static/"
probe "register page"                 - "/register"        200
probe "privacy and terms"             - "/terms"           200
asset=$(curl -s "$URL/login" | grep -oE "$PREFIX/_next/static/[^\"]+\.js" | head -1)
if [ -n "$asset" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN$asset")" = 200 ]; then
  ok "a page's JS chunk loads from $PREFIX/_next/static"
else
  bad "a page's JS chunk loads from $PREFIX/_next/static" "asset '$asset' did not return 200"
fi
if [ -n "$PREFIX" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN/login")
  [ "$code" = 404 ] && ok "not served at the root (/login is 404)" || bad "not served at the root (/login is 404)" "HTTP $code"
fi
probe "auth API answers under the prefix" - "/api/auth/csrf" 200 "csrfToken"

# ── Anonymous visitors are kept out, and sent to THIS app's login ──────────
redirect "anonymous /dashboard -> $PREFIX/login" - "/dashboard" "$PREFIX/login?callbackUrl=$(enc "$PREFIX/dashboard")"
redirect "anonymous API call -> $PREFIX/login" - "/api/members" "$PREFIX/login?callbackUrl=$(enc "$PREFIX/api/members")"

# ── Sign in through the prefix, against the database ──────────────────────
code=$(login bad member01@uat.test 'not-the-password')
[ "$code" = 401 ] && ok "a wrong password is refused" || bad "a wrong password is refused" "callback HTTP $code"
for who in member operator admin; do
  code=$(login "$who" "${who}01@uat.test")
  [ "$code" = 200 ] && ok "$who signs in" || bad "$who signs in" "callback HTTP $code"
done
probe "member session carries the role"   member   "/api/auth/session" 200 '"roles":["MEMBER"]'
probe "member dashboard renders"           member   "/dashboard"        200 "Dashboard"
probe "member reads an API route"          member   "/api/post-types"   200 '"code"'
redirect "member opening /admin -> $PREFIX/dashboard" member "/admin" "$PREFIX/dashboard"
probe "member is refused the admin API"    member   "/api/admin/stats"  403
probe "operator reaches /admin"            operator "/admin"            200 "Operator Dashboard"
redirect "operator on an admin-only page -> $PREFIX/dashboard" operator "/admin/users" "$PREFIX/dashboard"
probe "admin reads the admin API"          admin    "/api/admin/stats"  200
# Signed in, so the middleware lets the request through to Next's router:
# files outside public/ must not exist as URLs. (Anonymous, the middleware
# answers first with a redirect to the login page.)
probe "nothing private is served (.env)"          member "/.env"                 404
probe "nothing private is served (prisma/schema)" member "/prisma/schema.prisma" 404
probe "nothing private is served (package.json)"  member "/package.json"         404

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
