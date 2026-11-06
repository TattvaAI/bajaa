# BAJAA final checkpoint · 7 November 2026

Production: https://bajaa.vercel.app
Deployment: dpl_GeHELBTNrAL7eQ5NhkZz5ijtD61k; Vercel status Ready.

## Build and local running app

`npm run check && npm run build` exited 0:

```text
Built 19 song lists from 933 valid tracks.
BAJAA production build complete. Public files in dist/.
```

`PORT=8002 npm run dev`:

```text
BAJAA running at http://localhost:8002
```

`BAJAA_TEST_URL=http://localhost:8002 npm test` exited 0:

```text
PASS both deck volumes ramp during crossfade
PASS four questions → automatic playback; two preloaded decks and music-only UI; skip, pause, resume, full song; no queue editor
PASS mood shift, end session stops playback, automatic history
PASS preserved legacy storage and automatic session replay
PASS unavailable-video recovery
PASS blocked playback tap recovery
PASS responsive routes and playback at 360, 390, 768, 1024, 1440px
PASS no browser exceptions
PASS sign-out destroys player and locks listening
```

Browser smoke uses deterministic auth/YouTube fixtures, excluded from production. It proves app behavior; it does not prove live music reliability.

## Neon end-to-end storage

`BAJAA_TEST_URL=http://localhost:8002 node tests/neon-e2e.cjs` exited 0:

```text
PASS history API rejects unauthenticated requests
PASS API → live Neon Postgres → persisted history; second identity cannot read it
PASS session updates do not duplicate history
PASS owner-only deletion and read-back from Neon
PASS malformed history rejected
PASS live Neon Auth JWKS reachable
PASS running app rejects forged Neon access token
```

Uses an isolated test HTTP handler with synthetic identities against the real database. Test records are deleted afterward. The live user/JWT acceptance path is not covered by those synthetic identities.

## Production gate and assets

`BAJAA_TEST_URL=https://bajaa.vercel.app node tests/auth-gate.cjs` exited 0:

```text
PASS compulsory sign-in and zero YouTube frames at 390px
PASS compulsory sign-in and zero YouTube frames at 1440px
PASS /api/library denies missing/forged token
PASS /api/session denies missing/forged token
PASS /api/history denies missing/forged token
PASS music source not public
PASS all repeated photos removed
```

Separate HTTP checks: / and /songs/ 200; /favicon.svg 200; /seed.js and /assets/ 404; all three unauthenticated APIs 401. CSP present, history Cache-Control private/no-store. Public dist raster image count: 0.

A real production Google-button click reached https://accounts.google.com. Completion of consent, session restoration, authenticated playback and history sync between two real browsers still require a human account test.

## Accessibility and dependencies

`BAJAA_TEST_URL=http://localhost:8002 npm run test:a11y` exited 0: 24 axe WCAG A/AA scans across public routes, questions, preparation, player, mood dialog and summary at 390/1440. Production signed-out gate scans passed too. Production CSP blocked initial axe injection; only the test harness now bypasses CSP for tool injection. Deployment policy remains enabled and was checked separately.

`npm audit --omit=dev`: found 0 vulnerabilities. Prior low development-tool advisory remains documented in PROJECT_REVIEW.md.

Current sign-in, catalogue, setup and player screenshots are in screenshots/. Sign-in/catalogue captures use production; setup/player use deterministic fixtures. They were visually inspected; obsolete screenshots removed. Physical-device performance and all 933 music sources have not been verified.

## Failures and corrections

- Lost process handles after interruption: inspected Vercel and reran final checks instead of treating unknown sessions as successful.
- Vercel CLI absent from shell PATH: used npx vercel; inspection succeeded.
- Worker launch initially required AGENTS.md: supplied isolated contract file, then ran both permitted models. Both timed out without handoffs; no worker edits accepted.
- Production accessibility harness initially failed with axe undefined because CSP blocked injection. Test-only bypass corrected; rerun passed.
- Neon test hardcoded an obsolete local port: changed it to honor BAJAA_TEST_URL; real DB test passed on current running app.
- Earlier init invalid_grant and deployment dependency race were resolved by login and retry; final provision/migration passed.

No claim is made that Google consent completion, real cross-device sync, all devices, or commercial music compliance is finished.

## Follow-up sign-in regression · 7 November

Deployment dpl_7cobjhTU1TMfQW9eg3wYCZaLC3XF Ready, aliased to https://bajaa.vercel.app.

Build: 19 song lists from 1,118 valid tracks; exited 0. Browser smoke and 24 axe scans rerun successfully. Real installed SDK regression (tests/account-token.cjs) passed repeated authorization, library and history with the cached-session JWT. No production auth fixture is deployed.

Real Neon-issued test session checks on production:

```text
PASS production real Neon session opens room in two independent contexts
PASS production session restoration
PASS production cloud history sync
PASS production sign-out
PASS production sign-in button reaches Google; secure first-party challenge true
```

Test accounts are synthetic disposable identities, with valid upstream-issued sessions and real production APIs/DB. The browser cookie was seeded for acceptance; human Google consent has not been completed by the coordinator. Earlier failure to verify sign-in was an actual app/SDK integration bug, not a proven user connection failure. Nested-route 404 was also reproduced and fixed via Vercel rewrite. Regression tests now check sign-in/social returns Google URL and challenge cookies.

Catalogue mix checks across available languages and all four moods produced non-empty queues with zero duplicate song IDs. Library records are from the NAUX reference; 10 structurally invalid cues remain excluded. Full-source availability and physical-device testing remain incomplete.

## Production candidate validation

Deployment dpl_6xiMLSGAAjSARSkR8yfWdP4TDv38 Ready. Build, syntax, mock playback smoke, installed-SDK regression, 24 WCAG scans, live Neon CRUD/ownership and production auth-gate checks passed. Production dependency audit: zero vulnerabilities. Nested Google route/challenge and cross-origin denial are now permanent regression checks. User confirmed Google sign-in works.

Staged secret-pattern scan passed; .env.local, .neon, .vercel, account.bundle.js and dist are ignored. New CI checks build, syntax, runtime dependency audit, smoke, real SDK regression and axe on Ubuntu/Node22 with no production credentials.

History request quota migration applied additively. Account bulk deletion uses verified ownership; full managed-identity deletion handled through support. New history queue retries quietly; no claim that the user's exact earlier failure was traced from logs.
