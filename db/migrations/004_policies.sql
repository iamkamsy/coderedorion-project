-- Refresh, compression and access for the continuous aggregate.
-- Continuous aggregates do not support RLS, so gesture_app reads it only through
-- owner_param_activity(), which filters on the transaction's app.owner_id.

SELECT add_continuous_aggregate_policy('param_events_1m',
  start_offset      => INTERVAL '2 hours',
  end_offset        => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute',
  if_not_exists     => true);

-- Columnstore is enabled by the tsdb.segmentby option in 002; this compresses old chunks.
SELECT add_compression_policy('param_events', INTERVAL '7 days', if_not_exists => true);

CREATE OR REPLACE FUNCTION owner_param_activity(since timestamptz)
RETURNS TABLE (bucket timestamptz, plugin text, param text, avg_value double precision,
               min_value double precision, max_value double precision, n bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT bucket, plugin, param, avg_value, min_value, max_value, n
  FROM param_events_1m
  WHERE owner_id = app_owner_id() AND bucket >= since
  ORDER BY bucket
$$;

REVOKE ALL ON FUNCTION owner_param_activity(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION owner_param_activity(timestamptz) TO gesture_app;
