-- Additive migration. Existing Neon tables and auth users are untouched.
CREATE TABLE IF NOT EXISTS public.bajaa_history (
  user_id text NOT NULL,
  id text NOT NULL,
  created_at timestamptz NOT NULL,
  name text NOT NULL DEFAULT '' CHECK (length(name)<=100),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers)='object'),
  songs jsonb NOT NULL CHECK (jsonb_typeof(songs)='array'),
  PRIMARY KEY (user_id,id)
);
CREATE INDEX IF NOT EXISTS bajaa_history_recent ON public.bajaa_history(user_id,created_at DESC);
REVOKE ALL ON public.bajaa_history FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.bajaa_request_limits (
 user_id text NOT NULL,
 minute timestamptz NOT NULL,
 hits integer NOT NULL,
 PRIMARY KEY (user_id,minute)
);
REVOKE ALL ON public.bajaa_request_limits FROM PUBLIC;
