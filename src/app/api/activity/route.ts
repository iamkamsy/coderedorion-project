import { DbUnavailableError, withOwner } from "@/db/client";
import { getRequestOwner, jsonError } from "@/lib/requestOwner";

const WINDOW_MINUTES = 60;

/** Per-minute parameter activity for the dashboard. Reads only the continuous aggregate. */
export async function GET(request: Request) {
  const ownerId = getRequestOwner(request);
  if (!ownerId) return jsonError(400, "Missing owner id");
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);

  try {
    const rows = await withOwner(ownerId, (tx) => tx`select * from owner_param_activity(${since})`);
    return Response.json({
      rows: rows.map((r) => ({
        bucket: new Date(r.bucket).toISOString(),
        plugin: r.plugin,
        param: r.param,
        avg: Number(r.avg_value),
        min: Number(r.min_value),
        max: Number(r.max_value),
        n: Number(r.n),
      })),
    });
  } catch (err) {
    if (err instanceof DbUnavailableError) return jsonError(503, "Database not configured");
    return jsonError(500, "Could not load activity");
  }
}
