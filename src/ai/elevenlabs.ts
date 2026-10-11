import "server-only";

const API = "https://api.elevenlabs.io";
/** Lowest-latency ElevenLabs voice model, and half the character cost of the multilingual ones. */
const TTS_MODEL = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_64";
const TIMEOUT_MS = 15000;
/** Coach lines repeat across visits; caching them avoids paying for the same characters twice. */
const CACHE_LIMIT = 64;

export class ElevenLabsUnavailableError extends Error {}

const cache = new Map<string, ArrayBuffer>();
let voiceId: Promise<string> | null = null;

function config() {
  const key = process.env.ELEVENLABS_API_KEY;
  const agent = process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agent) throw new ElevenLabsUnavailableError("ElevenLabs is not configured");
  return { key, agent };
}

/** The voice configured on our ElevenLabs agent, so the coach sounds like the agent. Looked up once. */
function agentVoiceId(key: string, agent: string): Promise<string> {
  voiceId ??= (async () => {
    const res = await fetch(`${API}/v1/convai/agents/${encodeURIComponent(agent)}`, {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Agent lookup failed (${res.status})`);
    const id = (await res.json())?.conversation_config?.tts?.voice_id;
    if (typeof id !== "string" || !id) throw new Error("The agent has no voice configured");
    return id;
  })().catch((err) => {
    voiceId = null;
    throw err;
  });
  return voiceId;
}

/** Speak `text` in the agent's voice. Returns MP3 bytes. */
export async function synthesize(text: string): Promise<ArrayBuffer> {
  const hit = cache.get(text);
  if (hit) {
    cache.delete(text);
    cache.set(text, hit);
    return hit;
  }
  const { key, agent } = config();
  const voice = await agentVoiceId(key, agent);
  const res = await fetch(`${API}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${OUTPUT_FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: TTS_MODEL }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Text to speech failed (${res.status})`);
  const audio = await res.arrayBuffer();
  cache.set(text, audio);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return audio;
}

/**
 * Short-lived signed URL that lets the browser open one voice conversation with our agent over a
 * WebSocket. The API key stays here. (WebSocket rather than WebRTC: the WebRTC transport logs a
 * console error every time a call ends.)
 */
export async function conversationUrl(): Promise<string> {
  const { key, agent } = config();
  const res = await fetch(`${API}/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent)}`, {
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Signed URL failed (${res.status})`);
  const url = (await res.json())?.signed_url;
  if (typeof url !== "string" || !url) throw new Error("No signed URL returned");
  return url;
}
