import { z } from "zod";
import { GeminiUnavailableError, proposeMapping } from "@/ai/gemini";
import { jsonError } from "@/lib/requestOwner";

const BodySchema = z.object({ intent: z.string().trim().min(2).max(500) });

/** Intent text -> validated, clamped mapping proposal. Never applied server side. */
export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "Describe what you want in a few words.");

  try {
    const proposal = await proposeMapping(body.data.intent);
    return Response.json(proposal);
  } catch (err) {
    if (err instanceof GeminiUnavailableError) return jsonError(503, "The AI service is not configured.");
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
      return jsonError(504, "The AI took too long. Try again.");
    return jsonError(502, err instanceof Error ? err.message : "The AI request failed.");
  }
}
