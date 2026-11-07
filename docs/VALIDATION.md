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
