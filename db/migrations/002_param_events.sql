-- High-frequency parameter stream as a TimescaleDB hypertable on `time`.
--
-- Exception to "RLS on every table": TimescaleDB refuses a continuous aggregate on a
-- hypertable with row security (and RLS on a columnstore hypertable), and the dashboard
-- needs param_events_1m. Owner isolation is enforced instead by:
--   * gesture_app gets INSERT only (no SELECT, UPDATE or DELETE),
--   * param_events_owner_guard rejects rows whose owner_id is not app.owner_id,
--   * reads go through owner_param_activity() in 004, which filters by app.owner_id.

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
  tsdb.enable_columnstore = false
);

CREATE INDEX IF NOT EXISTS param_events_owner_time_idx ON param_events (owner_id, time DESC);

DROP TRIGGER IF EXISTS param_events_updated_at ON param_events;
CREATE TRIGGER param_events_updated_at BEFORE UPDATE ON param_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION param_events_owner_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF app_owner_id() IS NULL OR NEW.owner_id IS DISTINCT FROM app_owner_id() THEN
    RAISE EXCEPTION 'param_events.owner_id must match app.owner_id' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS param_events_owner_guard ON param_events;
CREATE TRIGGER param_events_owner_guard BEFORE INSERT ON param_events FOR EACH ROW EXECUTE FUNCTION param_events_owner_guard();

GRANT INSERT ON param_events TO gesture_app;
