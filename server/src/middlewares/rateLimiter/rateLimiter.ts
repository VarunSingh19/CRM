import type { RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../../config/env/env.js";
import { AppError } from "../../utils/errors/AppError.js";

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
}

const tooMany = (message: string) => new AppError(429, "RATE_LIMITED", message);

/**
 * The flood guard, mounted first on /api: per client address, it counts
 * requests that fail (4xx/5xx) — probing, forged origins, bad input — and
 * lets an address that keeps failing wait out the window.
 *
 * When sign-in arrives, count every request that is not a signed-in success
 * (`requestWasSuccessful: req.user !== undefined && status < 400`) and add
 * per-user and per-account limits, as server/src/middleware/rateLimiter.ts
 * does. In memory is right for this guard even with several instances: its
 * job is to keep junk away from the database, so it must not use it.
 */
export function ipRateLimiter(
  options: RateLimitOptions = { windowMs: env.RATE_LIMIT_IP_WINDOW_MS, limit: env.RATE_LIMIT_IP_MAX },
): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? "")}`,
    handler: (_req, _res, next) => next(tooMany("Too many requests from this address. Please wait a few minutes.")),
  });
}
