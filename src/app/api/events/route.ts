import { DbUnavailableError, withOwner } from "@/db/client";
import { EventBatchSchema } from "@/lib/events";
import { getRequestOwner, jsonError } from "@/lib/requestOwner";

/** Batch insert of downsampled parameter events into the param_events hypertable. */
export async function POST(request: Request) {
  const ownerId = getRequestOwner(request);
  if (!ownerId) return jsonError(400, "Missing owner id");

  const body = EventBatchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "Invalid event batch");

  const { sessionId, events } = body.data;
  const rows = events.map((e) => ({
    time: e.time,
    owner_id: ownerId,
    session_id: sessionId,
    plugin: e.plugin,
    param: e.param,
    value: e.value,
    gesture: e.gesture,
    created_by: ownerId,
  }));

  try {
    await withOwner(ownerId, (tx) => tx`insert into param_events ${tx(rows)}`);
    return Response.json({ inserted: rows.length });
  } catch (err) {
    if (err instanceof DbUnavailableError) return jsonError(503, "Database not configured");
    return jsonError(500, "Could not store events");
  }
}
