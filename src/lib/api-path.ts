/**
 * The path prefix this app is served under, as the browser sees it.
 *
 * On bkesari.com the hub forwards `/ladwani/` to this app without stripping
 * the prefix, so every URL the app builds for itself has to carry it.
 *
 * Next's `basePath` does that for `next/link`, `useRouter` and asset URLs — but
 * NOT for `fetch()`, because the argument is an ordinary runtime string the
 * compiler never looks inside. Verified rather than assumed: a build made with
 * `BASE_PATH=/ladwani` puts `/ladwani/_next/...` in 67 chunks while the same
 * chunks still contain a bare `"/api/members/`. Left alone, every data call in
 * the app would go to the hub's root instead of to this app.
 *
 * So the app's own API URLs are written `` `${BASE_PATH}/api/...` ``. When the
 * app is served from the root of its own hostname this is the empty string and
 * the URLs are exactly what they were.
 *
 * Inlined at build time from `NEXT_PUBLIC_BASE_PATH`, which `next.config.js`
 * sets from the same `BASE_PATH` it gives to `basePath` — one value, so the
 * routes the server serves and the URLs the browser calls cannot disagree.
 */
export const BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
