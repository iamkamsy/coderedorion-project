import { z } from "zod";
import { GeminiBusyError, GeminiUnavailableError, streamExplanation } from "@/ai/gemini";
import { STUDIO_MODULES } from "@/audio/rackSpec";
import { jsonError } from "@/lib/requestOwner";
import { getTutorial } from "@/tutorials";

const BodySchema = z.object({
  question: z.string().trim().min(2).max(300),
  /** Tutorial slug, so the answer is about that lesson's effects. */
  tutorial: z.string().max(60).optional(),
});

/**
 * Beginner question -> short plain-text explanation, streamed as it is written. Errors
 * before the first word come back as JSON with a status; a stream that breaks midway just
 * ends, and the client trims the answer to its last full sentence. Not stored.
 */
export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "Ask a question in a few words.");

  const tutorial = body.data.tutorial ? getTutorial(body.data.tutorial) : undefined;
  const context = tutorial
    ? { title: tutorial.title, idea: tutorial.idea, modules: tutorial.modules }
    : { title: "Free play", idea: "Shaping sound with audio effects.", modules: STUDIO_MODULES };

  try {
    const chunks = await streamExplanation(body.data.question, context);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await chunks.next();
          if (done) controller.close();
          else controller.enqueue(encoder.encode(value));
        } catch {
          controller.close();
        }
      },
      async cancel() {
        await chunks.return(undefined);
      },
    });
    return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) return jsonError(503, "The AI service is not configured.");
    if (err instanceof GeminiBusyError) return jsonError(503, "Gemini is busy or rate limited right now. Try again in a moment.");
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
      return jsonError(504, "The AI took too long. Try again.");
    return jsonError(502, "The AI could not answer right now.");
  }
}
