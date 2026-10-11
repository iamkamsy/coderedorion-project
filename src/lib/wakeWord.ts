/**
 * Listens for "Hey Gesture Labs" with the browser's built-in speech recognition (Chrome and Edge).
 * Chrome sends the microphone audio to Google's speech service to recognize it; nothing is stored by us.
 */

/**
 * "Gesture labs" with or without the "hey", plus the ways recognizers mishear it: "gestures lab",
 * "gestural labs", "jester labs", "just your labs", "gesture lapse", "gesture lab's", "gesturelabs".
 */
const WAKE = /\b(?:gestures?|gestural|jesters?|jesture|just your)\W*(?:labs?|lab's|laps?|lapse|lads?)\b/i;

export function isWakePhrase(transcript: string): boolean {
  return WAKE.test(transcript);
}

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  /** Chrome accepts a mic track to listen to; older browsers ignore the argument and use the default mic. */
  start(track?: MediaStreamTrack): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function wakeWordSupported(): boolean {
  return recognitionCtor() !== null;
}

/** Calls `onWake` once when the phrase is heard, then stops. Returns a function that stops listening. */
export function listenForWakeWord(onWake: () => void, onBlocked: () => void): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    onBlocked();
    return () => {};
  }
  let stopped = false;
  /** Echo-cancelled mic: Chrome subtracts the page's own music, so the phrase is heard over the test loop. */
  let track: MediaStreamTrack | null = null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  // The recognizer's runner-up guesses often contain the phrase when its top guess does not.
  rec.maxAlternatives = 5;
  /** Set after a real error, so a failing recognizer is not restarted in a tight loop. */
  let backoff = false;
  const stop = () => {
    stopped = true;
    rec.abort();
    track?.stop();
  };
  rec.onresult = (e) => {
    // "Hey" and "gesture labs" can land in separate results, so also check the last few joined.
    const from = Math.max(0, e.results.length - 3);
    const tail = Array.from({ length: e.results.length - from }, (_, k) => e.results[from + k][0].transcript).join(" ");
    const candidates = [tail];
    for (let i = e.resultIndex; i < e.results.length; i++) {
      for (let j = 0; j < e.results[i].length; j++) candidates.push(e.results[i][j].transcript);
    }
    if (candidates.some(isWakePhrase)) {
      stop();
      onWake();
    }
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      stop();
      onBlocked();
    } else if (e.error !== "no-speech" && e.error !== "aborted") {
      backoff = true;
    }
  };
  // Chrome ends "continuous" recognition after a stretch of silence. Start again right away, since
  // anything said in the gap is lost; wait a moment only after a real error (for example network).
  rec.onend = () => {
    if (stopped) return;
    const delay = backoff ? 1000 : 0;
    backoff = false;
    setTimeout(() => !stopped && rec.start(track ?? undefined), delay);
  };
  navigator.mediaDevices
    .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    .then((stream) => {
      track = stream.getAudioTracks()[0] ?? null;
      if (stopped) track?.stop();
      else rec.start(track ?? undefined);
    })
    // No stream (for example permission refused): let the recognizer try the default mic and report it.
    .catch(() => !stopped && rec.start());
  return stop;
}
