-- Continuous aggregate for the dashboard. Kept as a single statement: continuous
-- aggregates cannot be created inside a transaction block.
CREATE MATERIALIZED VIEW IF NOT EXISTS param_events_1m
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('1 minute', time) AS bucket,
       owner_id,
       plugin,
       param,
       avg(value) AS avg_value,
       min(value) AS min_value,
       max(value) AS max_value,
       count(*)   AS n
FROM param_events
WHERE deleted_at IS NULL
GROUP BY 1, 2, 3, 4
WITH NO DATA;
