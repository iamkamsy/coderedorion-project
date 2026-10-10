const KEY = "gesture-rack.owner-id";

let cached: string | null = null;

/**
 * Anonymous owner id (CLAUDE.md section 7). Stored in localStorage and sent as the
 * x-owner-id header. This is per-browser isolation, not authentication.
 */
export function getOwnerId(): string {
  if (cached) return cached;
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return (cached = existing);
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return (cached = id);
  } catch {
    return (cached = crypto.randomUUID());
  }
}

export function ownerHeaders(): Record<string, string> {
  return { "content-type": "application/json", "x-owner-id": getOwnerId() };
}
