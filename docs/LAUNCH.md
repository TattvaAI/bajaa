# BAJAA launch configuration

Google OAuth app: Web application, name BAJAA.

Authorized JavaScript origins (no trailing slash):

- https://bajaa.vercel.app
- http://localhost:8000
- http://localhost:8001
- https://ep-lingering-truth-a1m58hd7.neonauth.ap-southeast-1.aws.neon.tech

Authorized redirect URI:

https://ep-lingering-truth-a1m58hd7.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth/callback/google

Neon project dark-art-65490836, production branch br-delicate-sun-a1argkfs, organization org-spring-art-95591008. Google provider has custom credentials. Store the client secret in Neon, never public config. The user supplied a secret in chat; rotate it in Google and update Neon after setup.

For Google app in Testing, add your own account to Test users. For public use, finish the consent screen, privacy/terms URLs and publishing requirements. Neon trusted domain includes https://bajaa.vercel.app; localhost is allowed by Neon defaults. Add custom domains before changing callbackURL.

Creator: SHIVANSH. Public support: contact@interncell.com. Instagram/LinkedIn: whyshivanshbansal. Verified GitHub account: TattvaAI. App auth now uses /api/auth on its own origin, with NEON_AUTH_COOKIE_SECRET on the server. Google redirect URI remains the Neon callback above. Real Neon sessions, production reload and two-browser cloud sync passed; completion with the user’s Google account still needs acceptance. Google consent-screen publishing remains an operator configuration step. Any licensed audio-only playback provider is a separate integration choice.
