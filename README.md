# BAJAA · Just let it play

Compulsory Google sign-in, four room questions, automatic DJ-style music, and listening history. Vanilla JavaScript and a static frontend on Vercel; same-domain Better Auth and server-only Neon Postgres history API.

## Run

Node 22.12+ and Chrome are required for tests.

```sh
npm install
neon env pull
node scripts/migrate.cjs
node scripts/migrate-auth.cjs
npm run build
npm run dev
```

Open http://localhost:8000. If it is busy, use `PORT=8001 npm run dev`. Build serves an explicit dist allowlist; .env files, tests and server source are never public. Neon uses .env.local. `DATABASE_URL` is only used on the server; the managed auth URL is public.

## Verify

```sh
npm run check
npm test
npm run test:a11y
npm run test:queue
npm run test:proxy
node tests/neon-e2e.cjs
node tests/auth-gate.cjs
node tests/account-token.cjs
```

`BAJAA_TEST_URL` selects a running server. Browser tests use a deterministic YouTube stub, so they prove controls and recovery, not music availability. neon-e2e uses synthetic identities in an isolated local test handler against the real database; it proves CRUD and ownership, and separately checks real JWT rejection. User confirmed Google login; real Neon-issued disposable sessions also verified production reload and cloud sync. Physical-device checks remain.

## Deploy

```sh
neon deploy
node scripts/migrate.cjs
vercel deploy --prod
```

Vercel project: bajaa. Production: https://bajaa.vercel.app. Required production environment: DATABASE_URL, BAJAA_AUTH_MODE=direct, BETTER_AUTH_URL=https://bajaa.vercel.app, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Older NEON_AUTH_* variables support managed-auth rollback. Creator defaults to SHIVANSH; support defaults to contact@interncell.com. PUBLIC_CREATOR_NAME and PUBLIC_CONTACT_EMAIL can override them. Google secret belongs only in Vercel server environment. Configure exact origins and callback from docs/LAUNCH.md.

## Limits

YouTube remains the current provider. The user requested hidden dual-deck playback matching NAUX; this carries developer-policy risk, may show ads and may block streams. There is no licensed audio-only provider configured. Google sign-in does not change that. No offline playback. No user-built playlists. Tuning suggestions remain local. Legacy guest history uses naux.sets to preserve prior sessions; current playback requires sign-in; account caches are scoped by verified user ID. Inherited metadata provenance, music rights/provenance and broader real-device testing remain launch work. History export and bulk deletion are available; managed account deletion is handled through contact@interncell.com. History requests have a durable per-account limit.

Latest checkpoint: all stock photographs were removed. The public catalogue uses text rows. Verified build, browser, accessibility, live auth denial and Neon storage results are in [docs/VALIDATION.md](docs/VALIDATION.md); the full remaining-work list is in [docs/PROJECT_REVIEW.md](docs/PROJECT_REVIEW.md).

Production health: /api/health. Functions deploy in Singapore (sin1). History saves retry quietly, serialize with deletion and stop on sign-out; signed-out auth checks avoid upstream queries. History saves retry automatically and report sync status on History. GitHub Actions runs the frontend/account/accessibility checks without real credentials. Apply additive database migrations before deploying schema changes.
