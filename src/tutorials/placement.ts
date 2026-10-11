export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export type Side = "below" | "above";

/**
 * The part of `target` that is actually on screen: intersected with the viewport and with
 * every clipping ancestor (scroll columns, collapsible panels). Null when nothing is visible.
 */
export function visibleRect(target: Rect, clips: readonly Rect[], viewport: { width: number; height: number }): Rect | null {
  // Copy fields explicitly: a DOMRect keeps them on its prototype, so spreading it gives {}.
  let r: Rect = { top: target.top, left: target.left, right: target.right, bottom: target.bottom };
  for (const c of [...clips, { top: 0, left: 0, right: viewport.width, bottom: viewport.height }]) {
    r = {
      top: Math.max(r.top, c.top),
      left: Math.max(r.left, c.left),
      right: Math.min(r.right, c.right),
      bottom: Math.min(r.bottom, c.bottom),
    };
  }
  return r.right - r.left >= 1 && r.bottom - r.top >= 1 ? r : null;
}

/**
 * Where the coach card goes next to a highlighted rect. Keeps the side it already uses as
 * long as the card still fits there, so scrolling never makes it flip back and forth.
 */
export function placeCard(
  target: Rect,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
  side: Side,
  gap: number,
): { top: number; left: number; side: Side } {
  const fitsBelow = target.bottom + gap + card.height <= viewport.height - gap;
  const fitsAbove = target.top - gap - card.height >= gap;
  const next: Side = side === "below" ? (fitsBelow || !fitsAbove ? "below" : "above") : fitsAbove || !fitsBelow ? "above" : "below";
  const rawTop = next === "below" ? target.bottom + gap : target.top - gap - card.height;
  const top = Math.min(Math.max(gap, rawTop), viewport.height - card.height - gap);
  const centered = (target.left + target.right) / 2 - card.width / 2;
  const left = Math.min(Math.max(gap, centered), viewport.width - card.width - gap);
  return { top, left, side: next };
}
