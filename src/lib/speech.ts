import { useSyncExternalStore } from "react";

const PREF_KEY = "gesture-rack.coach-voice";

/* --- Voice preference: on by default, shared by every coach card and remembered across visits --- */

const prefListeners = new Set<() => void>();

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

/** The stored preference, read directly. Effects use this: during hydration the hook briefly reports the default. */
export function isCoachVoiceOn(): boolean {
  return readPref();
}

export function setCoachVoice(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {}
  if (!on) stopSpeaking();
  prefListeners.forEach((cb) => cb());
}

export function useCoachVoice(): boolean {
  return useSyncExternalStore(
    (cb) => {
      prefListeners.add(cb);
      return () => prefListeners.delete(cb);
    },
    readPref,
    () => true,
  );
}

/* --- Playback: one voice at a time; a new line replaces whatever is speaking --- */

const clips = new Map<string, Promise<string>>();
const speakingListeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let current = 0;
let speaking = false;
let pendingUnlock: (() => void) | null = null;
let playing: Promise<void> = Promise.resolve();

function setSpeaking(v: boolean) {
  if (speaking === v) return;
  speaking = v;
  speakingListeners.forEach((cb) => cb());
}

/** Fetch (once per page) the spoken audio for `text` as an object URL. */
function clipFor(text: string): Promise<string> {
  let clip = clips.get(text);
  if (!clip) {
    clip = fetch("/api/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(20000),
    }).then(async (res) => {
      if (!res.ok) throw new Error("voice unavailable");
      return URL.createObjectURL(await res.blob());
    });
    clip.catch(() => clips.delete(text));
    clips.set(text, clip);
  }
  return clip;
}

/**
 * Say `text` in the coach's voice. Resolves when it finishes, is replaced, or fails; the
 * voice is a nice-to-have, so failures are silent. If the browser blocks audio before the
 * first click, it plays on the next click instead.
 */
export function speak(text: string): Promise<void> {
  playing = play(text);
  return playing;
}

/**
 * Say `text` once whatever is speaking now has finished, instead of cutting it off. Dropped
 * if something else is said (or speech is stopped) in the meantime.
 */
export async function speakAfter(text: string): Promise<void> {
  const id = current;
  await playing;
  if (id === current) await speak(text);
}

async function play(text: string): Promise<void> {
  const id = ++current;
  audio?.pause();
  pendingUnlock = null;
  setSpeaking(true);
  try {
    const url = await clipFor(text);
    if (id !== current) return;
    audio ??= new Audio();
    audio.src = url;
    await new Promise<void>((resolve) => {
      const el = audio!;
      const done = () => {
        el.onended = el.onerror = el.onpause = null;
        resolve();
      };
      el.onended = el.onerror = el.onpause = done;
      el.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          pendingUnlock = () => void el.play().catch(done);
          return;
        }
        done();
      });
    });
  } catch {
    // Voice unavailable: the card text is still on screen.
  } finally {
    if (id === current) setSpeaking(false);
  }
}

export function stopSpeaking() {
  current++;
  pendingUnlock = null;
  audio?.pause();
  setSpeaking(false);
}

export function useSpeaking(): boolean {
  return useSyncExternalStore(
    (cb) => {
      speakingListeners.add(cb);
      return () => speakingListeners.delete(cb);
    },
    () => speaking,
    () => false,
  );
}

// Browsers block audio until the first click; replay a blocked line at that moment.
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    () => {
      pendingUnlock?.();
      pendingUnlock = null;
    },
    { capture: true },
  );
}
