import "server-only";
import { FinishReason, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { MAPPABLE_SPECS, PLUGINS, type ParamSpec } from "@/audio/paramSchema";
import { STUDIO_MODULES, type EffectId } from "@/audio/rackSpec";
import { CURVES, GESTURES, MAX_TARGETS_PER_GESTURE, type Mapping } from "@/mapping/types";
import { validateMapping } from "@/mapping/validate";
import { toLastSentence } from "@/lib/text";

const TIMEOUT_MS = 15000;
const DEFAULT_MODEL = "gemini-flash-latest";

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

  const allowed = new Set<string>(modules);
  const specs = MAPPABLE_SPECS.filter((s) => allowed.has(s.plugin));
  if (specs.length === 0) throw new Error("This rack has no parameters a gesture can control.");
  const ModelOutputSchema = outputSchema(specs);

  const ai = new GoogleGenAI({ apiKey });
  const prefs = preferences.length ? `\nThis producer's remembered preferences:\n${preferences.map((p) => `- ${p}`).join("\n")}` : "";

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
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

/** A short, beginner-friendly answer to a question about the effects in the user's rack. */
export async function explainConcept(question: string, context: ExplainContext): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured");

  const allowed = new Set<string>(context.modules);
  const params = MAPPABLE_SPECS.filter((s) => allowed.has(s.plugin))
    .map((s) => `- ${PLUGINS.find((p) => p.id === s.plugin)?.label} ${s.label}: ${s.description}`)
    .join("\n");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
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
  });

  let answer = (response.text ?? "").trim();
  if (!answer) throw new Error("Gemini returned an empty answer");
  const truncated = response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS || answer.length > EXPLAIN_MAX_CHARS;
  if (truncated) answer = toLastSentence(answer.slice(0, EXPLAIN_MAX_CHARS));
  return answer;
}
