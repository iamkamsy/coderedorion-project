/**
 * Turns "this pose is showing" into "this pose was held on purpose": fires once when the pose
 * has been held for `ms`. The pose must be released before it can fire again. A break shorter
 * than `graceMs` (a dropped or misread camera frame) does not restart the hold.
 */
export class HoldTimer {
  private readonly ms: number;
  private readonly graceMs: number;
  private since: number | null = null;
  private lastActive = 0;
  private fired = false;

  constructor(ms: number, graceMs = 0) {
    this.ms = ms;
    this.graceMs = graceMs;
  }

  /** Feed one frame. Returns true on the frame the hold completes. */
  update(active: boolean, now: number): boolean {
    if (active) {
      this.lastActive = now;
    } else if (this.since === null || now - this.lastActive > this.graceMs) {
      this.reset();
      return false;
    }
    this.since ??= now;
    if (this.fired || !active || now - this.since < this.ms) return false;
    this.fired = true;
    return true;
  }

  /** True while the pose is being held but the hold has not completed yet. */
  get pending(): boolean {
    return this.since !== null && !this.fired;
  }

  /** How long the pose has actually been showing, up to the last frame it was seen. */
  get heldMs(): number {
    return this.since === null ? 0 : this.lastActive - this.since;
  }

  /** How far through the hold the pose is, from 0 to 1. */
  progress(now: number): number {
    if (this.since === null) return 0;
    return this.fired ? 1 : Math.min(1, (now - this.since) / this.ms);
  }

  reset() {
    this.since = null;
    this.fired = false;
  }
}
