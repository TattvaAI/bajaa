# BAJAA release validation · 7 November 2026

Production: https://bajaa.vercel.app · GitHub: https://github.com/TattvaAI/bajaa
Final GitHub/Vercel status is recorded after release below.

## Latest local checks

Node 26.4 locally; GitHub CI uses Node 22. App started with PORT=8005 npm run dev.

```text
npm run check: exit 0
npm run build: exit 0
Built 19 song lists from 1118 valid tracks.
BAJAA production build complete. Public files in dist/.
npm audit --omit=dev: found 0 vulnerabilities
```

Browser smoke passed four questions → automatic playback, two preloaded decks, equal-power volume ramp, skip/pause/resume/full song, mood shift, session end/history/replay, unavailable-video and blocked-playback recovery, sign-out gate, no browser exceptions and 360/390/768/1024/1440px routes.

24 axe WCAG A/AA scans passed routes, setup, preparation, player, mood dialog and summary at 390/1440px. Tests explicitly use no-preference motion, covering the Linux CI contrast failure. A real intermediate color failure was reproduced: white text over the fading disabled background. Semantic colors now switch together; motion feedback remains on transform/shadow.

```text
PASS real Neon SDK cached session supplies JWT to repeated authorization, library and history requests
PASS real SDK sign-out locks History and shows sign-in before delayed upstream response
PASS deferred retry preserves and eventually syncs the newest offline save
PASS single session deletion cannot be undone by an in-flight save or retry
PASS bulk history deletion cannot be undone by an in-flight save or retry
PASS sign-out immediately locks the room and invalidates late writes and timers
PASS cross-tab sign-out cancels writes still waiting for a token
PASS signed-out session check performs zero upstream auth requests
PASS OAuth verifier and challenge are forwarded rather than mistaken for signed-out visitors
```

Fixtures only stub network/auth/media in tests, excluded from production. Queue tests execute the actual adapter with deferred requests. Proxy tests execute the actual handler and ensure OAuth query/challenge paths remain intact.

Live Neon end-to-end storage passed API → database persistence, update without duplicates, owner isolation/deletion, malformed input rejection, JWKS availability and real running-app forged-JWT denial. Synthetic test records are removed after each run. Earlier real Neon-issued disposable sessions passed production reload, two independent contexts/cloud sync, bulk deletion and sign-out. User confirmed Google consent/login. A production stream advanced 18.027 →20.910 seconds in 3 seconds at YouTube state 1; this is one playback sample.

## Failure history and fixes

GitHub run 42293322471 failed legal link affordance; underlines corrected. Run 42293856706 failed preparation-button contrast at 1440; the transient color problem was reproduced with motion enabled and corrected in CSS. Neither failed run was treated as green. Tests now preserve normal motion preferences across platforms.

Pre-fix production timings: unsigned session check 245ms and 4,718ms, sign-out 269ms in single samples; cold health request 1,037ms. The signed-out shortcut avoids upstream auth entirely; a signed cookie cache lasts 300 seconds and is still verified by the SDK/server secret. Protected APIs still verify signed JWT and active owner. These are measurements, not latency guarantees.

Google redirect verified accounts.google.com with the supplied custom client ID and exact Neon callback domain. No provider secret is stored in this document, repository or build. Google's chooser domain is independent of frontend styling.

## Practical boundaries

See PROJECT_REVIEW.md for music rights/provider policies, device/catalogue coverage, consent/secret rotation, manual managed-account deletion and cross-device active-save limits. No claim is made of full commercial music clearance or exhaustive device/source availability.

## Release verification follow-up

Application commit d09b9cf passed GitHub CI run 42362228382 on Ubuntu/Node22 and deployed automatically through the connected Vercel Git repository (dpl_BWTAichUPYtyhoms5b1aqQnAar5d, Ready). Production auth-gate checks all passed. Signed-out get-session warm samples measured 156/188/131ms (first request 1,071ms). A real Neon-issued production room opened in 1,671ms; cloud save/second-browser read passed.

The first live bulk-delete check caught stale cache merging in a second browser. Successful cloud reads now replace the cache and merge only pending unsynced writes; account caches are no longer reimported as fresh guest history. A deferred-fetch regression covers remote deletion. The failed run cleaned its disposable user/data. This check was not treated as a successful release acceptance; follow-up results are recorded below.

## Accepted application release

Commit 6487e7569acd1d73245a3e2db3236663c6136c42 is pushed to main and passed https://github.com/TattvaAI/bajaa/actions/runs/42362431095. Vercel automatic production deployment dpl_5uWFw3RiXdatiADii5NsmSPLadzd is Ready and aliased to https://bajaa.vercel.app.

```text
PASS live Neon-issued session opens production room in 3362ms
PASS live production history save and second-browser read
PASS live production owner bulk delete and second-browser cloud read
PASS live production immediate sign-out screen and signed-out reload
```

The temporary acceptance runner's cleanup initially failed with a database connection timeout after all functional checks passed. Cleanup retry succeeded: one remaining disposable release account and its data removed; remaining disposable auth users: 0. No production secrets were printed. Room entry varied 1,671–3,362ms across these samples. Signed-out warm session checks were 131–188ms; cold starts and upstream variability remain. Tests use upstream-issued disposable sessions, while the user independently completed Google consent.

Public assets, health, authentication denial, nested Google route/challenge and origin/admin restrictions passed production checks. The original repetitive photos remain removed. Current setup/player screenshots were refreshed with deterministic fixtures and visually reviewed. Final documentation commits may create newer equivalent deployments; this ID identifies the verified application revision.

## Same-domain authentication · 7 November 2026

BAJAA now hosts Better Auth 1.7.18 on Vercel with Google callback https://bajaa.vercel.app/api/auth/callback/google. User confirmed Google redirect registration. Separate auth tables preserve existing user IDs/Google subject bindings/history, without copying managed sessions, passwords or provider tokens. Managed Neon tables remain available for rollback. Additive migration ran twice on an isolated branch and then successfully on production. Nine existing identity IDs matched; zero old disposable managed test accounts remained.

Focused checks passed: syntax/build, real Google callback handler with mocked Google token/cert responses on live isolated Neon DB, preserved identity, actual Better Auth browser client room/history save/read with HttpOnly cookie, database session revocation on sign-out and invalid state rejection before token exchange. This tests the real app auth flow while keeping external Google test responses out of production. The invalid-state diagnostic was expected. Public Google chooser wording remains controlled by Google; the deployed request's callback host is checked separately. Runtime audit: zero vulnerabilities. Existing Neon adapter is retained only for explicit managed rollback and its prior regression checks remain in CI.

Everyone signs in once again after cutover; history IDs remain unchanged. Google consent completion for the new callback needs the user's account. Physical device/music-source licensing limits remain in PROJECT_REVIEW.md.
