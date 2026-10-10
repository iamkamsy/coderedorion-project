import { z } from "zod";
import { GeminiUnavailableError, explainConcept } from "@/ai/gemini";
import { STUDIO_MODULES } from "@/audio/rackSpec";
import { jsonError } from "@/lib/requestOwner";
import { getTutorial } from "@/tutorials";

const BodySchema = z.object({
  question: z.string().trim().min(2).max(300),
  /** Tutorial slug, so the answer is about that lesson's effects. */
  tutorial: z.string().max(60).optional(),
});

/** Beginner question -> short plain-text explanation. Not stored. */
export async function POST(request: Request) {
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "Ask a question in a few words.");

  const tutorial = body.data.tutorial ? getTutorial(body.data.tutorial) : undefined;
  const context = tutorial
    ? { title: tutorial.title, idea: tutorial.idea, modules: tutorial.modules }
    : { title: "Free play", idea: "Shaping sound with audio effects.", modules: STUDIO_MODULES };

  try {
    return Response.json({ answer: await explainConcept(body.data.question, context) });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) return jsonError(503, "The AI service is not configured.");
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
      return jsonError(504, "The AI took too long. Try again.");
    return jsonError(502, "The AI could not answer right now.");
  }
}
