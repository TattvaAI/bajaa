-- Additive BAJAA Better Auth 1.7.18 migration; managed Neon tables remain intact.
BEGIN;
create table if not exists "bajaa_auth_user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table if not exists "bajaa_auth_session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "bajaa_auth_user" ("id") on delete cascade);

create table if not exists "bajaa_auth_account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "bajaa_auth_user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table if not exists "bajaa_auth_verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table if not exists "bajaa_auth_rate_limit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);

create index if not exists "bajaa_auth_session_userId_idx" on "bajaa_auth_session" ("userId");

create index if not exists "bajaa_auth_account_userId_idx" on "bajaa_auth_account" ("userId");

create index if not exists "bajaa_auth_verification_identifier_idx" on "bajaa_auth_verification" ("identifier");
ALTER TABLE bajaa_auth_user ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS bajaa_auth_provider_account ON bajaa_auth_account("providerId","accountId");
REVOKE ALL ON bajaa_auth_user,bajaa_auth_session,bajaa_auth_account,bajaa_auth_verification,bajaa_auth_rate_limit FROM PUBLIC;
-- Copy identity and verified Google subject bindings, never old sessions/passwords/provider tokens.
INSERT INTO bajaa_auth_user(id,name,email,"emailVerified",image,"createdAt","updatedAt",banned)
 SELECT id::text,name,email,"emailVerified",image,"createdAt","updatedAt",COALESCE(banned,false) FROM neon_auth."user"
 ON CONFLICT(id) DO NOTHING;
INSERT INTO bajaa_auth_account(id,"accountId","providerId","userId","createdAt","updatedAt")
 SELECT id::text,"accountId","providerId","userId"::text,"createdAt","updatedAt" FROM neon_auth.account WHERE "providerId"='google'
 ON CONFLICT DO NOTHING;
COMMIT;
