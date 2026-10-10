import "server-only";
import { z } from "zod";

const OwnerId = z.uuid();

/** Read and validate the anonymous owner id header. Returns null if missing or malformed. */
export function getRequestOwner(request: Request): string | null {
  const parsed = OwnerId.safeParse(request.headers.get("x-owner-id"));
  return parsed.success ? parsed.data : null;
}

export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}
