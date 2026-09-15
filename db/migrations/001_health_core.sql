CREATE TABLE IF NOT EXISTS health_profiles (
  user_id text PRIMARY KEY,
  display_name text,
  consent_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  captured_at timestamptz NOT NULL,
  observation jsonb,
  listening jsonb,
  inquiry jsonb,
  tongue jsonb,
  fusion jsonb,
  safety jsonb,
  recommendation jsonb,
  feature_vector jsonb,
  quality_score double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_baselines (
  user_id text PRIMARY KEY,
  session_count integer NOT NULL DEFAULT 0,
  feature_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_session_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_alerts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  session_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','watch','urgent')),
  code text NOT NULL,
  message text NOT NULL,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_sessions_user_time ON health_sessions (user_id, captured_at DESC);

ALTER TABLE health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_profiles_owner ON health_profiles FOR ALL USING (auth.user_id() = user_id) WITH CHECK (auth.user_id() = user_id);
CREATE POLICY health_sessions_owner ON health_sessions FOR ALL USING (auth.user_id() = user_id) WITH CHECK (auth.user_id() = user_id);
CREATE POLICY health_baselines_owner ON health_baselines FOR ALL USING (auth.user_id() = user_id) WITH CHECK (auth.user_id() = user_id);
CREATE POLICY health_alerts_owner ON health_alerts FOR ALL USING (auth.user_id() = user_id) WITH CHECK (auth.user_id() = user_id);
