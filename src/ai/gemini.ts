import "server-only";
import { ApiError, GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { z } from "zod";
import { PARAM_SPECS, PLUGINS, type ParamSpec } from "@/audio/paramSchema";
import { STUDIO_MODULES, rackPlugins, type EffectId } from "@/audio/rackSpec";
import { CURVES, GESTURES, MAX_TARGETS_PER_GESTURE, type Mapping } from "@/mapping/types";
import { validateMapping } from "@/mapping/validate";

const TIMEOUT_MS = 15000;
/** Fast and light on free-tier rate limits: about 1.5 s to transcribe a short clip, under 1 s for text. */
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
/** Free-tier quota is per model, so when the main model is out of quota this one usually still answers. */
const FALLBACK_MODEL = "gemini-flash-lite-latest";

/** What we ask Gemini for. Narrower than the contract so the model cannot invent params. */
function outputSchema(specs: readonly ParamSpec[]) {
  const ParamKeyEnum = z.enum(specs.map((s) => `${s.plugin}.${s.param}`) as [string, ...string[]]);
  return z.object({
    summary: z.string().describe("One sentence, in plain words, describing what the pinch will now do."),
    mappings: z
      .array(
        z.object({
          gesture: z.enum(GESTURES),
          targets: z
            .array(
              z.object({
                target: ParamKeyEnum.describe("plugin.param"),
                min: z.number().describe("Value when the fingers are closed"),
                max: z.number().describe("Value when the fingers are fully open"),
                curve: z.enum(CURVES),
              }),
            )
            .min(1)
            .max(MAX_TARGETS_PER_GESTURE),
        }),
      )
      .min(1)
      .max(GESTURES.length),
  });
}

function systemPrompt(modules: readonly EffectId[], specs: readonly ParamSpec[]) {
  const chain = ["input", ...modules.map((m) => PLUGINS.find((p) => p.id === m)?.label.toLowerCase() ?? m), "limiter"].join(" -> ");
  return `You map a music producer's intent onto hand gestures that control an audio effects rack.
The rack is: ${chain}.
Gestures: "pinch_right" and "pinch_left". Each produces 0 (thumb and index touching) to 1 (fully open).
For each target, "min" is the value at 0 and "max" is the value at 1. min may be greater than max to invert the direction.
Use only these parameters, and keep values inside the given ranges:
${specs.map((s) => `- ${s.plugin}.${s.param}: ${s.min} to ${s.max}${s.unit ? " " + s.unit : ""}. ${s.description}`).join("\n")}
Prefer pinch_right unless the user asks for two hands. Use 1 to 3 targets per gesture.
Use "exp" for frequency and time parameters, "linear" otherwise unless the intent suggests a different feel.
Never output parameters that are not in the list.`;
}

export type MappingProposal = { mapping: Mapping; summary: string };

export class GeminiUnavailableError extends Error {}

/** Every model we tried answered 503 (overloaded) or 429 (out of quota). */
export class GeminiBusyError extends Error {}

const RETRY_DELAY_MS = 800;

function isTransient(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.status === 503 || err.status === 429);
}

/**
 * Run a Gemini call on the configured model, then on FALLBACK_MODEL. A 503 (briefly overloaded)
 * gets one retry on the same model; a 429 moves straight on, because free-tier quotas are per
 * model and per day, so retrying the same model only burns another request.
 */
async function withFallback<T>(call: (model: string) => Promise<T>): Promise<T> {
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  for (const model of primary === FALLBACK_MODEL ? [primary] : [primary, FALLBACK_MODEL]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await call(model);
      } catch (err) {
        if (!isTransient(err)) throw err;
        if (err.status === 429) break;
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  throw new GeminiBusyError("Gemini is overloaded or out of quota");
}

function generate(ai: GoogleGenAI, params: Omit<GenerateContentParameters, "model">) {
  return withFallback((model) => ai.models.generateContent({ ...params, model }));
}

/**
 * @param modules effects loaded in the user's rack. The prompt, response schema and
 * validation only allow parameters of these effects.
 */
export async function proposeMapping(
  intent: string,
  modules: readonly EffectId[] = STUDIO_MODULES,
  preferences: string[] = [],
): Promise<MappingProposal> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured");

  const allowed = new Set<string>(rackPlugins(modules));
  const specs = PARAM_SPECS.filter((s) => allowed.has(s.plugin));
  if (specs.length === 0) throw new Error("This rack has no parameters a gesture can control.");
  const ModelOutputSchema = outputSchema(specs);

  const ai = new GoogleGenAI({ apiKey });
  const prefs = preferences.length ? `\nThis producer's remembered preferences:\n${preferences.map((p) => `- ${p}`).join("\n")}` : "";

  const response = await generate(ai, {
    contents: `Intent: ${intent}${prefs}`,
    config: {
      systemInstruction: systemPrompt(modules, specs),
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(ModelOutputSchema),
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    },
  });

  let json: unknown;
  try {
    json = JSON.parse(response.text ?? "");
  } catch {
    throw new Error("Gemini returned malformed JSON");
  }

  const parsed = ModelOutputSchema.safeParse(json);
  if (!parsed.success) throw new Error("Gemini output did not match the expected shape");

  const candidate = {
    mappings: parsed.data.mappings.map((m) => ({
      gesture: m.gesture,
      targets: m.targets.map((t) => {
        const [plugin, param] = t.target.split(".");
        return { plugin, param, min: t.min, max: t.max, curve: t.curve };
      }),
    })),
  };
  const result = validateMapping(candidate, { plugins: modules });
  if (!result.ok) throw new Error(`Gemini proposed an invalid mapping: ${result.error}`);
  return { mapping: result.mapping, summary: parsed.data.summary };
}

const EXPLAIN_MAX_CHARS = 1200;

export interface ExplainContext {
  title: string;
  idea: string;
  modules: readonly EffectId[];
}

/**
 * A short, beginner-friendly answer to a question about the effects in the user's rack,
 * streamed as it is generated. Streaming costs the same tokens as waiting for the whole
 * answer; the first words just arrive sooner. Stops after EXPLAIN_MAX_CHARS.
 */
export async function streamExplanation(question: string, context: ExplainContext): Promise<AsyncGenerator<string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured");

  const allowed = new Set<string>(rackPlugins(context.modules));
  const params = PARAM_SPECS.filter((s) => allowed.has(s.plugin))
    .map((s) => `- ${PLUGINS.find((p) => p.id === s.plugin)?.label} ${s.label}: ${s.description}`)
    .join("\n");

  const ai = new GoogleGenAI({ apiKey });
  // Retries cover the initial request, which is where 503 and 429 show up.
  const chunks = await withFallback((model) =>
    ai.models.generateContentStream({
      model,
      contents: question,
      config: {
        systemInstruction: `You are a friendly audio production teacher helping a beginner in a short interactive lesson called "${context.title}".
The lesson's idea: ${context.idea}
The rack in front of them has these controls:
${params}
Answer in at most 90 words of plain text, no markdown or lists. Use everyday words and one concrete listening tip that uses the controls above.
If the question is not about sound, music or these effects, say briefly that you can only help with this lesson.`,
        temperature: 0.5,
        // Generous on purpose: thinking models spend part of this budget before answering.
        // Length is held down by the prompt and EXPLAIN_MAX_CHARS instead.
        maxOutputTokens: 2048,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      },
    }),
  );

  return (async function* () {
    let sent = 0;
    for await (const chunk of chunks) {
      const text = chunk.text ?? "";
      if (!text) continue;
      const room = EXPLAIN_MAX_CHARS - sent;
      if (room <= 0) return;
      const piece = text.slice(0, room);
      sent += piece.length;
      yield piece;
    }
  })();
}

const TRANSCRIBE_MAX_CHARS = 500;
/** Audio takes noticeably longer than text, especially when Gemini is busy. */
const TRANSCRIBE_TIMEOUT_MS = 30000;
const TranscriptSchema = z.object({
  heardSpeech: z.boolean().describe("True only if a person is clearly speaking words in the clip"),
  text: z.string().describe("The spoken words, or an empty string"),
});
const TRANSCRIPT_JSON_SCHEMA = z.toJSONSchema(TranscriptSchema);

/**
 * Speech to text for the assistant's audio button. The clip is sent to Gemini only to be
 * transcribed and is not stored. Returns an empty string when nothing was said.
 */
export async function transcribeRequest(audioBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured");

  const ai = new GoogleGenAI({ apiKey });
  const response = await generate(ai, {
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: "Transcribe what the speaker says, word for word." }],
      },
    ],
    config: {
      systemInstruction: `You transcribe short spoken requests from a music producer using an audio effects app.
First decide whether a person is clearly speaking words. Tones, music, humming, noise and silence are not speech:
then set "heardSpeech" to false and "text" to an empty string. Never guess or invent words.
Otherwise set "heardSpeech" to true and put only the spoken words in "text", with normal punctuation.
Do not answer, summarize or add anything.`,
      // Structured output: plain text replies sometimes leak a stray "thought" line first.
      responseMimeType: "application/json",
      responseJsonSchema: TRANSCRIPT_JSON_SCHEMA,
      temperature: 0,
      maxOutputTokens: 1024,
      abortSignal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    },
  });
  const parsed = TranscriptSchema.safeParse(safeJson(response.text));
  if (!parsed.success) throw new Error("Gemini returned an unreadable transcript");
  return parsed.data.heardSpeech ? parsed.data.text.trim().slice(0, TRANSCRIBE_MAX_CHARS) : "";
}

function safeJson(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? "");
  } catch {
    return null;
  }
}
