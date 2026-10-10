-- High-frequency parameter stream as a TimescaleDB hypertable on `time`.

CREATE TABLE IF NOT EXISTS param_events (
  time        timestamptz NOT NULL,
  owner_id    uuid NOT NULL,
  session_id  uuid NOT NULL,
  plugin      text NOT NULL,
  param       text NOT NULL,
  value       double precision NOT NULL,
  gesture     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  deleted_at  timestamptz
) WITH (
  tsdb.hypertable,
  tsdb.partition_column = 'time',
  tsdb.segmentby = 'owner_id',
  tsdb.orderby = 'time DESC'
);

CREATE INDEX IF NOT EXISTS param_events_owner_time_idx ON param_events (owner_id, time DESC);

DROP TRIGGER IF EXISTS param_events_updated_at ON param_events;
CREATE TRIGGER param_events_updated_at BEFORE UPDATE ON param_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE param_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS param_events_owner ON param_events;
CREATE POLICY param_events_owner ON param_events TO gesture_app
  USING (owner_id = app_owner_id()) WITH CHECK (owner_id = app_owner_id());

GRANT SELECT, INSERT ON param_events TO gesture_app;
