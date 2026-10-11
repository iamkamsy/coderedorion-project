import { ElevenLabsUnavailableError, conversationUrl } from "@/ai/elevenlabs";
import { jsonError } from "@/lib/requestOwner";

/** A signed URL for one "Hey Gesture Labs" voice conversation with the ElevenLabs agent. */
export async function GET() {
  try {
    return Response.json({ signedUrl: await conversationUrl() }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ElevenLabsUnavailableError) return jsonError(503, "The voice assistant is not configured.");
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
      return jsonError(504, "The voice assistant took too long to connect.");
    return jsonError(502, "The voice assistant is unavailable right now.");
  }
}
