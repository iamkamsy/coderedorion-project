import { HoldTimer } from "./hold";

/** How long the pinky must be up before the hand locks. */
export const LOCK_HOLD_MS = 500;
/** How long a rock sign must be held before the hand unlocks. */
export const UNLOCK_HOLD_MS = 1000;
/** A pinky seen for at least this long counts as meant if the hand then leaves the frame. */
const MEANT_MS = 150;
/** A pose may vanish for this long (a dropped or misread camera frame) without restarting its hold. */
const GLITCH_MS = 150;

export interface LockPose {
  /** The pinky is stuck out (and the hand is not a flat open palm). */
  pinky: boolean;
  /** Index and pinky up, middle and ring folded. */
  rock: boolean;
}

/**
 * One hand's lock. Holding the pinky out locks the hand's pinch where it is, and it stays locked
 * after the pinky goes back down or the hand leaves the frame. Holding a rock sign unlocks it.
 *
 * A pinching hand with the pinky out can look exactly like a rock sign, so the two are told apart
 * by the lock's state: any raised pinky locks an unlocked hand, and only a rock sign unlocks a
 * locked one. After either change the pinky must come down before the next one can start.
 */
export class HandLock {
  locked = false;
  private lockTimer = new HoldTimer(LOCK_HOLD_MS, GLITCH_MS);
  private unlockTimer = new HoldTimer(UNLOCK_HOLD_MS, GLITCH_MS);
  private downTimer = new HoldTimer(GLITCH_MS);
  /** False from a lock or unlock until the pinky has come down. */
  private armed = true;

  /** Feed one camera frame, or null when the hand is not in it. Returns the change on the frame the hand locks or unlocks. */
  update(pose: LockPose | null, now: number): "locked" | "unlocked" | null {
    // Dropping the hand out of view with the pinky up is a lock, not a cancel.
    const leftWithPinkyUp = pose === null && !this.locked && this.lockTimer.pending && this.lockTimer.heldMs >= MEANT_MS;
    const pinky = pose?.pinky ?? false;
    const rock = pose?.rock ?? false;
    if (this.downTimer.update(!pinky && !rock, now)) this.armed = true;
    const lockNow = this.lockTimer.update(this.armed && (pinky || rock) && !this.locked, now) || leftWithPinkyUp;
    const unlockNow = this.unlockTimer.update(this.armed && rock && this.locked, now);
    if (lockNow) this.locked = true;
    if (unlockNow) this.locked = false;
    if (lockNow || unlockNow) this.armed = false;
    return lockNow ? "locked" : unlockNow ? "unlocked" : null;
  }

  /** True while a raised pinky is counting toward a lock. */
  get seen(): boolean {
    return this.lockTimer.pending;
  }

  /** True while a rock sign is counting toward an unlock. */
  get unlocking(): boolean {
    return this.unlockTimer.pending;
  }

  /** How far the raised pinky is toward locking, from 0 to 1. */
  progress(now: number): number {
    return this.lockTimer.pending ? this.lockTimer.progress(now) : 0;
  }

  /** Unlock at once and forget any hold in progress. */
  release() {
    this.locked = false;
    this.armed = true;
    this.lockTimer.reset();
    this.unlockTimer.reset();
  }
}
