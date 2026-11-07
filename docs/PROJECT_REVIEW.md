# BAJAA engineering review · 7 November 2026

BAJAA: https://bajaa.vercel.app · Source: https://github.com/TattvaAI/bajaa
Creator SHIVANSH · support contact@interncell.com

## User-reported problems and fixes

| Problem | Final change | Verification and limits |
| --- | --- | --- |
| Wants an original identity with a little brutalism | BAJAA branding, paper/ink/vermilion, self-hosted type, printed tickets and Hindi maker mark | Desktop/mobile views inspected; trademark/domain ownership not checked |
| Buttons hard to find | Filled surfaces, ink borders, 44px+ targets, explicit selected markers and pressed feedback | WCAG scans and responsive browser checks; colors switch together to preserve contrast during state changes |
| Repetitive photographs | Removed stock photos and image injection; text catalogue and CSS record surface | Production catalogue has zero images; public dist has zero raster images |
| Too many playlist decisions | Mandatory sign-in, four room questions, automatic music; no queue editor, song picker or playlist naming | Complete browser flow passes |
| Visible video at the side | Removed visible video panel; hidden source decks | UI is music-only, but the underlying provider remains YouTube |
| Tracks fail, player jitters | Preloading, alternate-source/track recovery, tap recovery, watchdog; removed waveform/layout animation | Recovery tests pass; availability/ads and device restrictions remain provider-dependent |
| Wants DJ-style music and NAUX catalogue | 1.5-second equal-power crossfades, cue timings, artist spacing and full matching mix; 1,128 unique metadata records, 1,118 valid entries | Real production stream advanced in earlier check; all sources and physical devices not exhaustively tested; iOS uses direct cuts |
| Google button returned HTTP 404 | Same-origin Neon proxy with explicit Vercel nested-route rewrite | Production social endpoint and Google redirect tested; user confirmed consent/login works |
| Session could not be verified | Fixed Neon 0.8.2 cached session JWT integration | Installed SDK regression and valid Neon-issued production sessions passed |
| Slow sign-in and sign-out | Combined room verification/library request; Singapore functions; signed-out check skips upstream; signed session cache 300 seconds; room locks immediately on sign-out | Pre-fix session checks varied 245–4,718ms; sign-out 269ms in one run. No speed guarantee; upstream cold starts remain |
| Repeated local-only history alert | Quiet retry queue with backoff/online recovery; status appears on History | Exact original failed request was not recovered from logs. Limits, token handling and overlapping writes were fixed |
| Deleted history can return / offline saves lost | One operation chain, owner/session generation checks, matching-payload acknowledgements and deletion barriers | Deferred-fetch regressions cover retry/save, individual/bulk deletion, sign-out and cross-tab token race |
| Mobile support | Responsive wrapping, large controls and reduced motion | Widths 360/390/768/1024/1440 and WCAG at 390/1440 pass; physical-device testing remains |
| Deploy/push and production hardening | Vercel, GitHub CI, health endpoint, JWT/owner checks, secure cookies, CSP, public-file allowlist, history request quota, export/bulk deletion | Build/runtime audit and browser/API checks; GitHub and deployed status recorded in VALIDATION.md |

## Architecture judgment

The supplied stack document is a proposal, not a requirement. Its useful principles are simplicity, minimal client JavaScript and measured bottlenecks. Adding React/Next.js, Redis, jobs and AI infrastructure would not remove managed OAuth round trips. Keep the current static frontend, Vercel Node functions and Neon Postgres/Auth while measuring auth latency. Server-Timing now exposes auth processing duration without identity or token data.

The Google account chooser uses the Neon callback domain and currently displays neon.tech. The flow was checked to use the user's own Google client ID. Google controls chooser branding; Google Auth Platform branding/publication and possibly a verified custom callback domain or a separately planned auth migration are required for further branding control. Do not promise a CSS/appName change fixes that screen. A working IdP should not be casually replaced.

## Remaining launch limitations

1. Hidden YouTube playback/crossfading has developer-policy and music-rights risk. The app is not a licensed audio service. Reference catalogue metadata provenance also needs review before commercial launch.
2. All 1,118 sources, long listening sessions, ads, Bluetooth/background playback and real iPhone/Android behavior need broader testing.
3. Rotate the Google secret supplied in chat, update Neon, and finish Google consent-screen branding/publication. Review the account-wide MCP credential created by Neon CLI init; the app does not use it.
4. Managed identity deletion remains a manual support process. History export and individual/bulk history deletion are implemented. Operator retention/deletion handling must be maintained.
5. Upstream auth latency varies; sign-in still requires Google/Neon. Signed JWTs can remain valid briefly after sign-out; sign-out locks the app and clears its server session, but immediate JWT revocation is not claimed.
6. Cross-device deletes during simultaneous active listening can still be followed by a new session update from that other device. Local deletion barriers cover this browser's queued/in-flight work; global cancellation requires server-side deletion versions.

These limits prevent an unconditional commercial production-ready claim.

## Delegation and independent review

Earlier completed fallback audits: yeta/deepseek-v4.1-flash-uncensored, auth 38.738s (24,142 input / 1,617 output reported) and controls 20.623s (19,532 input / 1,216 output). Findings independently reviewed; no worker code integrated.

Release race audit: yeta/deepseek-v4.1-flash timed out at 90.154s (12,939 input / 3,552 output / 2,390 reasoning reported). A partial file described the same races independently found by Codex, but no completed handoff or edits accepted. Permitted fallback yeta/deepseek-v4.1-flash-uncensored timed out at 45.139s (11,702 input / 146 output / 67 reasoning). Codex implemented/reviewed and ran regression checks directly. Logs remain in isolated /tmp worker folders, outside the repository. Billing and coordinator token savings are not verified; review overhead was not separately timed.
