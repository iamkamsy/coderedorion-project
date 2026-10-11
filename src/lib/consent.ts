import { useSyncExternalStore } from "react";
import { ownerHeaders } from "./ownerId";

const KEY = "gesture-rack.data-consent";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    // Shared by default: only an explicit "false" (turned off on the dashboard) opts out.
    return localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function save(value: boolean) {
  fetch("/api/profile", {
    method: "PUT",
    headers: ownerHeaders(),
    body: JSON.stringify({ dataConsent: value }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

/** Turn data sharing on or off for this browser, locally and on the owner's profile. */
export function setDataConsent(value: boolean) {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {}
  listeners.forEach((cb) => cb());
  save(value);
}

/** Record the default (shared) on the profile the first time this browser visits. */
export function syncDefaultConsent() {
  try {
    if (localStorage.getItem(KEY) !== null) return;
    localStorage.setItem(KEY, "true");
  } catch {
    return;
  }
  save(true);
}

export function useDataConsent(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}
