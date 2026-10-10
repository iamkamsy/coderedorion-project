import type { ParamChange } from "@/mapping/engine";
import type { ParamEvent } from "@/lib/events";
import { ownerHeaders } from "./ownerId";

const FLUSH_MS = 1000;
/** Keep at most one event per parameter per this interval. */
const MIN_GAP_MS = 100;
const MIN_DELTA = 0.002;
const MAX_BUFFER = 500;

export type BatcherStatus = "idle" | "ok" | "offline";

/**
 * Downsamples parameter changes and posts them to /api/events about once per second.
 * If the database is unavailable it backs off and reports "offline"; the rack keeps working.
 */
export class EventBatcher {
  private buffer: ParamEvent[] = [];
  private last = new Map<string, { t: number; v: number }>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private backoffUntil = 0;

  constructor(
    private sessionId: string,
    private onStatus: (s: BatcherStatus) => void,
  ) {}

  start() {
    this.timer ??= setInterval(() => void this.flush(), FLUSH_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.flush();
  }

  push(changes: ParamChange[]) {
    const now = Date.now();
    for (const c of changes) {
      const key = `${c.plugin}.${c.param}`;
      const prev = this.last.get(key);
      if (prev && (now - prev.t < MIN_GAP_MS || Math.abs(prev.v - c.value) < MIN_DELTA)) continue;
      this.last.set(key, { t: now, v: c.value });
      this.buffer.push({ time: new Date(now).toISOString(), plugin: c.plugin, param: c.param, value: c.value, gesture: c.gesture });
    }
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
  }

  private async flush() {
    if (this.buffer.length === 0 || Date.now() < this.backoffUntil) return;
    const events = this.buffer;
    this.buffer = [];
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({ sessionId: this.sessionId, events }),
        keepalive: true,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(String(res.status));
      this.onStatus("ok");
    } catch {
      this.backoffUntil = Date.now() + 15000;
      this.onStatus("offline");
    }
  }
}
