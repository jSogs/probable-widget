const mem = new Map();

export async function getOrSet(key, fn, ttlSeconds) {
  const ttl = Number(ttlSeconds ?? process.env.CACHE_TTL_SECONDS ?? 300);
  const now = Date.now();

  const hit = mem.get(key);
  if (hit && hit.exp > now) return hit.val;

  const val = await fn();
  mem.set(key, { exp: now + ttl * 1000, val });
  return val;
}
