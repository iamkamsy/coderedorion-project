import { z } from "zod";
import { DbUnavailableError, withOwner } from "@/db/client";
import { getRequestOwner, jsonError } from "@/lib/requestOwner";

const BodySchema = z.object({ dataConsent: z.boolean() });

/** Record the opt-in data consent toggle (defaults to off). */
export async function PUT(request: Request) {
  const ownerId = getRequestOwner(request);
  if (!ownerId) return jsonError(400, "Missing owner id");
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "Invalid request");
  const consent = body.data.dataConsent;

  try {
    await withOwner(
      ownerId,
      (tx) => tx`
        insert into profiles (owner_id, data_consent, consented_at, created_by)
        values (${ownerId}, ${consent}, ${consent ? new Date() : null}, ${ownerId})
        on conflict (owner_id) do update
          set data_consent = excluded.data_consent, consented_at = excluded.consented_at`,
    );
    return Response.json({ dataConsent: consent });
  } catch (err) {
    if (err instanceof DbUnavailableError) return jsonError(503, "Database not configured");
    return jsonError(500, "Could not save consent");
  }
}
