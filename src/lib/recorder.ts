import { encodeWav, toBase64 } from "./wav";

/** Long enough for a spoken request, short enough to stay well under the 4.5 MB request limit. */
export const MAX_RECORDING_MS = 15000;
const TARGET_RATE = 16000;

export interface Recording {
  /** Stop and get the clip as base64 WAV (16 kHz mono). */
  stop: () => Promise<string>;
  /** Stop and throw the clip away. */
  cancel: () => void;
}

/**
 * Record a short voice clip from the microphone with speech processing on. The clip is
 * resampled to 16 kHz mono WAV in the browser and is never stored.
 */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  const release = () => stream.getTracks().forEach((t) => t.stop());
  recorder.start();

  return {
    async stop() {
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      release();
      const blob = new Blob(chunks, { type: recorder.mimeType });
      return toBase64(encodeWav(await decodeToMono(await blob.arrayBuffer()), TARGET_RATE));
    },
    cancel() {
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

async function decodeToMono(data: ArrayBuffer): Promise<Float32Array> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(data);
    const length = Math.ceil(decoded.duration * TARGET_RATE);
    if (length === 0) throw new Error("The recording was empty.");
    // Mixes to mono and resamples to 16 kHz in one offline render.
    const offline = new OfflineAudioContext(1, length, TARGET_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    return (await offline.startRendering()).getChannelData(0);
  } finally {
    void ctx.close();
  }
}
