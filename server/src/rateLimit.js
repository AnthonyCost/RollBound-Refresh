/**
 * Allows up to `max` events per key (an IP address) in each `windowMs`. Returns
 * allow(key), true when this one is within the limit (and counts it).
 * shortcut: counts live in this process's memory; with more than one server process, keep them in Postgres.
 */
export function rateLimit(max, windowMs) {
  const seen = new Map();
  return (key) => {
    const now = Date.now();
    // Forget keys with nothing recent now and then, so the map can't grow forever.
    if (seen.size > 10_000) for (const [k, times] of seen) if (times.every((t) => now - t >= windowMs)) seen.delete(k);
    const times = (seen.get(key) ?? []).filter((t) => now - t < windowMs);
    if (times.length >= max) return false;
    seen.set(key, [...times, now]);
    return true;
  };
}
