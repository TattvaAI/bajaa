# Current BAJAA Google sign-in configuration

BAJAA now hosts Better Auth on Vercel; Neon remains its Postgres database. This matches Interncell's authentication architecture. The old managed Neon proxy remains available only for an explicit rollback via BAJAA_AUTH_MODE=managed.

Google Authorized JavaScript origin: `https://bajaa.vercel.app`
Google Authorized redirect URI: `https://bajaa.vercel.app/api/auth/callback/google`

The user confirmed the new redirect registration. Keep the older Neon redirect temporarily for rollback. Set Google Auth Platform Branding to BAJAA and complete consent publication as applicable. Google controls the exact account-chooser text; the redirect now carries BAJAA's host rather than neon.tech.

Vercel production requires DATABASE_URL, BAJAA_AUTH_MODE=direct, BETTER_AUTH_URL=https://bajaa.vercel.app, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Google credentials and cookie secret are server-only. Rotate the previously exposed Google secret and update the Vercel secret environment variable. Do not reuse Interncell's credentials.

`node scripts/migrate-auth.cjs` applies versioned additive SQL. Existing user IDs and Google subject bindings are copied into BAJAA-owned auth tables; history ownership stays unchanged. Managed sessions are not imported, so users sign in again once. Managed Neon tables remain intact. Test migration on a branch before applying to production. Rollback: set BAJAA_AUTH_MODE=managed and redeploy; the older provider URL/secret variables and callback must remain available.

Creator SHIVANSH · contact@interncell.com. See PROJECT_REVIEW.md for music/device and operator limits.
