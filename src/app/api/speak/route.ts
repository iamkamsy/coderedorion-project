import { z } from "zod";
import { ElevenLabsUnavailableError, synthesize } from "@/ai/elevenlabs";
import { jsonError } from "@/lib/requestOwner";

/** Coach steps and lesson answers are short; this also caps the characters billed per request. */
const BodySchema = z.object({ text: z.string().trim().min(1).max(1200) });

/** Text -> speech in the coach's voice (ElevenLabs). Keys stay on the server. */
export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "Nothing to say.");
  try {
    const audio = await synthesize(body.data.text);
    return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });
  } catch (err) {
    if (err instanceof ElevenLabsUnavailableError) return jsonError(503, "The voice is not configured.");
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
      return jsonError(504, "The voice took too long.");
    return jsonError(502, "The voice is unavailable right now.");
  }
}
