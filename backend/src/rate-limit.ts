import type { NextFunction, Request, Response } from 'express';

const buckets = new Map<string, { count: number; resetsAt: number }>();
const WINDOW_MS = 60_000;
const configuredLimit = Number(process.env.RATE_LIMIT_PER_MINUTE);
const MAX_REQUESTS = Number.isInteger(configuredLimit) && configuredLimit >= 30 ? configuredLimit : 180;

export function rateLimit(request: Request, response: Response, next: NextFunction): void {
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetsAt <= now
    ? { count: 0, resetsAt: now + WINDOW_MS }
    : existing;
  bucket.count += 1;
  buckets.set(key, bucket);
  response.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
  response.setHeader('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - bucket.count)));
  response.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetsAt / 1000)));
  if (bucket.count > MAX_REQUESTS) {
    response.setHeader('Retry-After', String(Math.ceil((bucket.resetsAt - now) / 1000)));
    response.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试。' } });
    return;
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetsAt <= now) buckets.delete(key);
  }
}, WINDOW_MS).unref();
