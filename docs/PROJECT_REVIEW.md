# BAJAA engineering review · 7 November 2026

BAJAA is deployed at https://bajaa.vercel.app. Its final requested behavior is compulsory Google sign-in, four room questions, automatic DJ-style playback and automatically saved listening history. The long marketing page and playlist editor are gone.

## What changed

- Removed all four repeated stock photographs and the old icon file; excluded their paths from the production build. Removed obsolete screenshots, preserving current sign-in, setup, player and catalogue screenshots. Catalogue uses text rows.
- Rebranded visible UI, metadata, fonts, colors and favicon. Paper/ink/vermilion Swiss poster direction, sharp geometry, restrained brutalism.
- Removed tracklist review/reorder/remove, next-song picker and playlist naming. Mood choice adjusts future music.
- Added protected Google sign-in using managed Neon Auth; restored sessions are checked on the server against signed JWTs and an active Neon Auth user. No local-storage identity is trusted.
- Added Vercel history, session and music-library endpoints. Postgres pool uses pg with Vercel Fluid pool attachment. Owner is always server-verified; input never supplies user_id. Music video IDs are omitted from public dist and returned only after auth.
- Added bajaa_history table and recent-history index, using additive migration. No existing tables were replaced. Account local caches are scoped by user ID; legacy guest sessions migrate on sign-in. Failed history writes are retained for retry on startup/sign-in.
- User explicitly requested NAUX-style playback after reviewing the sequential visible-player alternative. Final engine uses two hidden YouTube IFrame API decks, muted preloading and 1.5-second equal-power crossfades; iOS uses direct cuts. Stops/mutes both on session end, clears timers and recovers blocked playback via a tap action.
- Static output allowlist prevents public exposure of secrets, tests, docs and source infrastructure. CSP, no-store API responses and referrer headers added.

## Candid remaining problems

1. Hidden YouTube playback and simultaneous crossfading carry YouTube developer-policy risk. The user explicitly chose this behavior. This is not a licensed audio service and is not suitable to describe as a compliant commercial streaming product. YouTube ads, blocked embeds, geography and autoplay restrictions remain outside BAJAA's control. A permitted audio source is the durable solution.
2. Automated tests prove signed-out denial, database CRUD/ownership, browser behavior and accessibility. Google redirects to the correct consent/sign-in page. Completion, account session restoration and sync between two real signed-in browsers still need a human Google account test. Do not claim full OAuth acceptance until that passes.
3. Existing catalogue has 933 structurally valid cues; it has not been comprehensively verified for availability, cue accuracy, licensing or source-code/data provenance. Ranking is heuristic, not beat-matching or AI analysis.
4. No durable shared rate limiter or usage quota. Per-request body and count limits exist, and history reads are bounded. Add abuse controls before substantial public traffic.
5. No self-service account deletion/export or automatic retention cleanup. Public support email and creator name are missing. Privacy copy must be reviewed against actual operator/legal requirements.
6. Account history caches survive sign-out on this device, separated by user ID. Shared-device browser storage is not encrypted. Deletion failures do not falsely report cloud success.
7. No Git repository exists. Local baseline is /tmp/bajaa-rebrand/baseline; Git/versioned rollback and CI should be established. Vercel deployment rollback exists independently.
8. A low-severity development tooling advisory was observed; production dependency audit reported zero vulnerabilities. neon-env is deprecated but installed for CLI config compatibility.
9. The requested neon init installed plugins, user-level skills and MCP configurations into several agents, and minted account-wide MCP key id 3507556. That scope is broader than this one project; inspect/revoke it when no longer needed. The app itself never uses it.
10. A Google secret was pasted into chat. It was sent to Neon through a mode-0600 temporary file then removed, never bundled or committed. Rotate it and update Neon after testing.

## Verification evidence

Final checkpoint rerun passed on 7 November 2026. Production deployment dpl_GeHELBTNrAL7eQ5NhkZz5ijtD61k is Ready and aliased to https://bajaa.vercel.app. Exact check output and limitations are in VALIDATION.md.

- npm run build: Built 19 song lists from 933 valid tracks. BAJAA production build complete. Public files in dist/.
- Live Neon additive migration passed. HTTP history API persisted/read/updated/deleted synthetic sessions; a second identity could not read/delete the first; malformed input rejected. Test-only identity injection was not deployed.
- No-auth/forged API calls return 401; /seed.js returns 404. Signed-out browser loads zero songs and creates zero YouTube frames.
- Mock browser checks cover four questions, two decks, cuts/crossfade, skip/pause/resume/full, mood dialog, history/replay/recovery and responsive routes at 360/390/768/1024/1440.
- Axe WCAG A/AA scans at 390/1440, including setup/player/mood/summary and signed-out sign-in, passed.
- Real production sequential stream was measured at 142.93s and 146.94s four seconds apart, YT state 1. Final dual-deck local test played deck A then deck B (Tareefan, 16.91s) after skip. Broader real-device tests remain necessary.

## Delegation metrics

- yeta/deepseek-v4.1-flash audit: 44.036s, 50,676 input / 2,016 output / 944 reasoning reported, handoff reviewed and accepted for inspection only.
- Account adapter worker same model: timed out 180.137s, 24,403 input / 6,339 output reported; partial files not integrated.
- Allowed fallback yeta/deepseek-v4.1-flash-uncensored: timed out 120.132s, 14,011 input / 2,746 output reported; no final handoff accepted. Coordinator finished directly, then scope changed from Supabase to Neon.
- Workers reported cost 0; billing is not independently verified. Coordinator review/corrections occurred throughout; elapsed review overhead and token savings were not separately measured.

## Complaints addressed and practical limits

| User complaint | Change | Evidence / limit |
| --- | --- | --- |
| Repeated photographs do not fit | Removed four stock files, image injection, obsolete icon and old screenshots; text catalogue | Production /songs/ has zero img elements; dist has zero raster images; /assets/ 404 |
| Looks like NAUX / wants own brand | BAJAA identity, self-hosted typography, warm paper/ink/red and sharp edges across app | Current desktop/mobile screenshots visually reviewed; domain/trademark unverified |
| Too complex; users should relax | Mandatory sign-in → four questions → automatic music; removed playlist review/edit/name and song picker | Browser flow passes; public mood catalogue remains informational |
| Video showing on right | Removed visible video panel; hidden source decks behind calm disc surface | Mock UI check passes; current source remains YouTube |
| Songs sometimes fail | Muted preload, fallback video/track recovery, blocked-playback tap and watchdog | Automated recovery passes; real YouTube availability still variable |
| Lag/jitter | Removed waveform animation, moving deck UI, repeated title fitting/layout work | Responsive/control checks pass; no measured performance guarantee across all devices |
| Wants a DJ feeling | Two decks, 1.5-second equal-power ramp and cue-based transitions; iOS direct cuts | Mock volume-ramp checks and prior local real-stream test; final signed-in production listening pending |
| Must require sign-in | Server-verified user and protected library/history/session; sign-out stops player | Production routes gated, forged/missing tokens 401, seed 404, zero signed-out frames |
| Synced history at launch | Neon Postgres per-account history, automatic save, failed-write retry and replay | Live database persistence/ownership passes; real two-browser OAuth sync acceptance pending |
| Mobile must work | Responsive controls, wrapping titles, touch targets and reduced motion | Five widths 360–1440 without overflow; axe at 390/1440; physical iPhone/Android testing pending |

Remaining priority order: real Google login/restoration and two-device sync; real-device playback and catalogue availability; public operator/support identity and consent-screen publication; music/provider policy and provenance review; abuse limits, account deletion/export, retention, and versioned CI/rollback. Small categories such as Haryanvi/Bhojpuri and Tamil/Telugu need more verified tracks before being presented as ready. The current setup marks them coming soon.

Final review delegation: regular yeta/deepseek-v4.1-flash timed out after 90.193s (27,612 input / 957 output reported); permitted fallback yeta/deepseek-v4.1-flash-uncensored timed out after 60.142s (12,028 input / 203 output reported). Neither produced a final handoff; no worker edits were integrated. Coordinator completed independent inspection and verification. Review overhead and token savings were not separately measured.

## Sign-in and catalogue follow-up

Root cause independently reproduced: Neon Auth 0.8.2 maps token() into the getSession cache hook. After getSession(), token().data contains session/user instead of token. BAJAA now reads session.token (signed JWT), checks expiry and uses a fresh own-origin /api/auth/token fallback. All protected requests share this helper.

Auth now uses the installed @neon/auth/server proxy toolkit on BAJAA’s own origin with secure HttpOnly SameSite=Lax cookies and a server-only signing secret. Four routes are allowlisted: get-session, token, sign-in/social, sign-out. Cross-origin mutation requests are rejected and admin/signup routes are not exposed. A Vercel catch-all route failed nested sign-in/social with 404; replaced with explicit rewrite to api/auth.mjs. Production nested-route regression added.

Real Neon-issued test sessions passed protected production access, reload, save/read/delete and cloud sync between independent browser contexts. Test identities use email/password only for isolated acceptance; public BAJAA remains Google-only. This validates the real server/SDK/session integration but does not substitute for the user finishing Google consent. Google-button redirect and first-party challenge cookies pass production checks.

Creator SHIVANSH, contact@interncell.com, Instagram/LinkedIn whyshivanshbansal, GitHub TattvaAI (verified through authenticated gh profile) now configured. These supersede earlier missing-operator notes.

Catalogue refreshed from the current publicly shipped NAUX reference: 1,128 unique records, 1,118 structurally valid playback entries. Original local catalogue had 935 records; 193 reference entries were missing. Updated common source/cue metadata; normalised five full-song null entry times to zero. Excluded raster artwork and analysis arrays. Removed 45-minute artificial queue truncation. Room energy shaping, subtype/mood rules, artist spacing and familiar-track ranking retained. This is metadata/reference parity, not verified music licensing or all-source availability.

Delegation: regular yeta/deepseek-v4.1-flash timed out at 150.081s, 55,180 input / 3,701 output / 4,389 reasoning reported. Permitted fallback yeta/deepseek-v4.1-flash-uncensored completed a narrow cache audit in 38.738s, 24,142 input / 1,617 output / 1,388 reasoning reported. Handoff independently reproduced and accepted as audit evidence; no worker code integrated. Maximum reasoning variant was not forced because the allowlisted dispatcher exposes no variant option. Review overhead and savings not independently measured.

## Production hardening and control visibility

Added explicit button surfaces, 44px+ standalone targets, strong selected markers, separate Change mood action, larger full-song action, printed room ticket and small Hindi maker stamp. Mobile/desktop axe and smoke pass. Removed redundant serial session check before protected library load, delayed history import until room entry, and selected Vercel sin1 to align with Neon Singapore. No fixed speed guarantee; cold auth/database starts remain variable.

History writes are normalised (name <=100 characters, latest 500 tracks), serialised, locally queued and automatically retried with 5–60s backoff and online recovery. Repeated playback toast removed; sync state is visible on History. Available logs did not pinpoint the user’s exact failed write; name/payload limits, expired token handling and overlapping-save races were corrected as concrete weaknesses.

Added durable per-account 120/minute history request limit, owner-only bulk history deletion, JSON export, account deletion support route via contact email, no-store health endpoint, environment template and GitHub CI. Account deletion remains a supported manual operation; no self-service removal of managed identity is claimed.

Git repository initialised for TattvaAI/bajaa, ignored env/provider configs/build bundles, scanned staged text for secret patterns. User confirmed Google sign-in works after route correction. Remaining launch boundaries: music provider/policy/provenance rights, all-source availability, real physical device tests, Google secret rotation and consent-screen publication, operator handling of deletion requests.

Controls audit: regular DeepSeek timed out 90.081s (42,831 input / 2,993 output reported). Allowed fallback completed 20.623s (19,532 input / 1,216 output reported). Recommendations reviewed against implemented components; no worker code integrated.
