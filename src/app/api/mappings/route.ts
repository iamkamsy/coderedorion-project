import { z } from "zod";
import { DbUnavailableError, withOwner } from "@/db/client";
import { validateMapping } from "@/mapping/validate";
import { getRequestOwner, jsonError } from "@/lib/requestOwner";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  intent: z.string().max(500).optional(),
  mapping: z.unknown(),
});

/** Save an approved mapping and make it the owner's active one. */
export async function POST(request: Request) {
  const ownerId = getRequestOwner(request);
  if (!ownerId) return jsonError(400, "Missing owner id");

  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "Invalid request");
  const valid = validateMapping(body.data.mapping);
  if (!valid.ok) return jsonError(400, valid.error);

  try {
    const [row] = await withOwner(ownerId, async (tx) => {
      await tx`update mappings set is_active = false where owner_id = ${ownerId} and is_active`;
      return tx`
        insert into mappings (owner_id, name, intent, mapping, is_active, created_by)
        values (${ownerId}, ${body.data.name}, ${body.data.intent ?? null}, ${tx.json(valid.mapping)}, true, ${ownerId})
        returning id`;
    });
    return Response.json({ id: row.id });
  } catch (err) {
    if (err instanceof DbUnavailableError) return jsonError(503, "Database not configured");
    return jsonError(500, "Could not save mapping");
  }
}

/** The owner's most recent active mapping, if any. */
export async function GET(request: Request) {
  const ownerId = getRequestOwner(request);
  if (!ownerId) return jsonError(400, "Missing owner id");
  try {
    const rows = await withOwner(
      ownerId,
      (tx) => tx`
        select name, intent, mapping from mappings
        where owner_id = ${ownerId} and is_active and deleted_at is null
        order by created_at desc limit 1`,
    );
    return Response.json({ active: rows[0] ?? null });
  } catch (err) {
    if (err instanceof DbUnavailableError) return jsonError(503, "Database not configured");
    return jsonError(500, "Could not load mappings");
  }
}
