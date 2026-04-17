type RateLimitRecord = { count: number; timestamp: number };

const store = new Map<string, RateLimitRecord>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { success: boolean; limit: number; remaining: number } {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record) {
    store.set(identifier, { count: 1, timestamp: now });
    return { success: true, limit: maxRequests, remaining: maxRequests - 1 };
  }

  const elapsed = now - record.timestamp;
  // If the window has passed, reset the count
  if (elapsed > windowMs) {
    store.set(identifier, { count: 1, timestamp: now });
    return { success: true, limit: maxRequests, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { success: false, limit: maxRequests, remaining: 0 };
  }

  record.count += 1;
  store.set(identifier, record);
  return { success: true, limit: maxRequests, remaining: maxRequests - record.count };
}
