-- Base tables, audit columns, and the RLS-restricted application role.
-- Route handlers connect with DATABASE_URL, then `SET LOCAL ROLE gesture_app` and
-- `set_config('app.owner_id', ...)` per transaction (src/db/client.ts).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gesture_app') THEN
    CREATE ROLE gesture_app NOLOGIN;
  END IF;
  EXECUTE format('GRANT gesture_app TO %I', current_user);
END
$$;

GRANT USAGE ON SCHEMA public TO gesture_app;

CREATE OR REPLACE FUNCTION app_owner_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.owner_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

-- profiles ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  owner_id      uuid PRIMARY KEY,
  display_name  text,
  data_consent  boolean NOT NULL DEFAULT false,
  consented_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  deleted_at    timestamptz
);

-- mappings ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mappings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL,
  name        text NOT NULL,
  intent      text,
  mapping     jsonb NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS mappings_owner_idx ON mappings (owner_id, created_at DESC) WHERE deleted_at IS NULL;

-- semantic_notes (opt-in only; written only when profiles.data_consent is true) --
CREATE TABLE IF NOT EXISTS semantic_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL,
  plugin       text NOT NULL,
  param        text NOT NULL,
  value_min    double precision,
  value_max    double precision,
  intent       text,
  description  text,
  tags         text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  deleted_at   timestamptz
);

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS mappings_updated_at ON mappings;
CREATE TRIGGER mappings_updated_at BEFORE UPDATE ON mappings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS semantic_notes_updated_at ON semantic_notes;
CREATE TRIGGER semantic_notes_updated_at BEFORE UPDATE ON semantic_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: every row belongs to exactly one owner ------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_owner ON profiles;
CREATE POLICY profiles_owner ON profiles TO gesture_app
  USING (owner_id = app_owner_id()) WITH CHECK (owner_id = app_owner_id());

DROP POLICY IF EXISTS mappings_owner ON mappings;
CREATE POLICY mappings_owner ON mappings TO gesture_app
  USING (owner_id = app_owner_id()) WITH CHECK (owner_id = app_owner_id());

DROP POLICY IF EXISTS semantic_notes_owner ON semantic_notes;
CREATE POLICY semantic_notes_owner ON semantic_notes TO gesture_app
  USING (owner_id = app_owner_id())
  WITH CHECK (
    owner_id = app_owner_id()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.owner_id = app_owner_id() AND p.data_consent)
  );

-- No DELETE grant: soft deletes only (set deleted_at).
GRANT SELECT, INSERT, UPDATE ON profiles, mappings, semantic_notes TO gesture_app;
