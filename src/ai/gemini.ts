import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { MAPPABLE_SPECS } from "@/audio/paramSchema";
import { CURVES, GESTURES, MAX_TARGETS_PER_GESTURE, type Mapping } from "@/mapping/types";
import { validateMapping } from "@/mapping/validate";

const TIMEOUT_MS = 15000;
const DEFAULT_MODEL = "gemini-flash-latest";

const ParamKeyEnum = z.enum(MAPPABLE_SPECS.map((s) => `${s.plugin}.${s.param}`) as [string, ...string[]]);

/** What we ask Gemini for. Narrower than the contract so the model cannot invent params. */
const ModelOutputSchema = z.object({
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

const RESPONSE_JSON_SCHEMA = z.toJSONSchema(ModelOutputSchema);

const SYSTEM_PROMPT = `You map a music producer's intent onto hand gestures that control an audio effects rack.
The rack is: input -> low-pass filter -> feedback delay -> reverb -> limiter.
Gestures: "pinch_right" and "pinch_left". Each produces 0 (thumb and index touching) to 1 (fully open).
For each target, "min" is the value at 0 and "max" is the value at 1. min may be greater than max to invert the direction.
Use only these parameters, and keep values inside the given ranges:
${MAPPABLE_SPECS.map((s) => `- ${s.plugin}.${s.param}: ${s.min} to ${s.max}${s.unit ? " " + s.unit : ""}. ${s.description}`).join("\n")}
Prefer pinch_right unless the user asks for two hands. Use 1 to 3 targets per gesture.
Use "exp" for frequency and time parameters, "linear" otherwise unless the intent suggests a different feel.
Never output parameters that are not in the list.`;

export type MappingProposal = { mapping: Mapping; summary: string };

export class GeminiUnavailableError extends Error {}

export async function proposeMapping(intent: string, preferences: string[] = []): Promise<MappingProposal> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured");

  const ai = new GoogleGenAI({ apiKey });
  const prefs = preferences.length ? `\nThis producer's remembered preferences:\n${preferences.map((p) => `- ${p}`).join("\n")}` : "";

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents: `Intent: ${intent}${prefs}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
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
  const result = validateMapping(candidate);
  if (!result.ok) throw new Error(`Gemini proposed an invalid mapping: ${result.error}`);
  return { mapping: result.mapping, summary: parsed.data.summary };
}
