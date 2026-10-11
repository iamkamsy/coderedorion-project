-- Tutorial sessions and idempotent event ingest (docs/plans/tutorials.md).

-- tutorial_sessions ---------------------------------------------------------
-- One row per visit to a tutorial. `id` is the client-generated session id that
-- also tags that visit's rows in param_events, so each tutorial's data stays separate.
CREATE TABLE IF NOT EXISTS tutorial_sessions (
  id               uuid PRIMARY KEY,
  owner_id         uuid NOT NULL,
  tutorial_id      text NOT NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  completed_steps  text[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  deleted_at       timestamptz,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX IF NOT EXISTS tutorial_sessions_owner_idx
  ON tutorial_sessions (owner_id, tutorial_id, started_at DESC) WHERE deleted_at IS NULL;

-- ingest_batches -------------------------------------------------------------
-- One row per uploaded event batch, inserted in the same transaction as the batch's
-- param_events rows. A retried batch hits the primary key and is skipped, so the
-- client queue can resend safely.
CREATE TABLE IF NOT EXISTS ingest_batches (
  batch_id     uuid PRIMARY KEY,
  owner_id     uuid NOT NULL,
  session_id   uuid NOT NULL,
  event_count  integer NOT NULL CHECK (event_count >= 0),
  received_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  deleted_at   timestamptz
);
CREATE INDEX IF NOT EXISTS ingest_batches_session_idx ON ingest_batches (owner_id, session_id);

DROP TRIGGER IF EXISTS tutorial_sessions_updated_at ON tutorial_sessions;
CREATE TRIGGER tutorial_sessions_updated_at BEFORE UPDATE ON tutorial_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS ingest_batches_updated_at ON ingest_batches;
CREATE TRIGGER ingest_batches_updated_at BEFORE UPDATE ON ingest_batches FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tutorial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutorial_sessions_owner ON tutorial_sessions;
CREATE POLICY tutorial_sessions_owner ON tutorial_sessions TO gesture_app
  USING (owner_id = app_owner_id()) WITH CHECK (owner_id = app_owner_id());

DROP POLICY IF EXISTS ingest_batches_owner ON ingest_batches;
CREATE POLICY ingest_batches_owner ON ingest_batches TO gesture_app
  USING (owner_id = app_owner_id()) WITH CHECK (owner_id = app_owner_id());

-- Soft deletes only: no DELETE grants. Batches are append-only.
GRANT SELECT, INSERT, UPDATE ON tutorial_sessions TO gesture_app;
GRANT SELECT, INSERT ON ingest_batches TO gesture_app;
