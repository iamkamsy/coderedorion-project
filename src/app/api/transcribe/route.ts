import { z } from "zod";
import { GeminiBusyError, GeminiUnavailableError, transcribeRequest } from "@/ai/gemini";
import { jsonError } from "@/lib/requestOwner";

/** About 20 s of 16 kHz mono WAV as base64; well under the 4.5 MB function body limit. */
const MAX_AUDIO_BASE64 = 900_000;

const BodySchema = z.object({
  audio: z.string().min(100).max(MAX_AUDIO_BASE64),
  mimeType: z.literal("audio/wav"),
});

/** Spoken request -> text. The clip goes to Gemini only to be transcribed and is never stored or logged. */
export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "That recording could not be used. Try a shorter clip.");

  try {
    const text = await transcribeRequest(body.data.audio, body.data.mimeType);
    if (!text) return jsonError(422, "I didn't catch that. Try again a little closer to the mic.");
    return Response.json({ text });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) return jsonError(503, "The AI service is not configured.");
    if (err instanceof GeminiBusyError) return jsonError(503, "Gemini is busy or rate limited right now. Try again in a moment.");
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
      return jsonError(504, "The AI took too long. Try again.");
    return jsonError(502, "Could not understand the recording right now.");
  }
}
