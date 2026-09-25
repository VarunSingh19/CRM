import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../../config/env/env.js";
import { AppError } from "../../utils/errors/AppError.js";

/**
 * Compared as SHA-256 digests with timingSafeEqual: the time taken never
 * reveals how much of a guess was right, and equal-length digests mean the
 * key's length is not leaked either.
 */
const digest = (value: string) =>
  createHash("sha256").update(value, "utf8").digest();
const expected = env.CUSTOM_HEADER_VALUE
  ? digest(env.CUSTOM_HEADER_VALUE)
  : null;

/**
 * Every /api request must carry CUSTOM_HEADER_NAME (default `x-api-key`)
 * with the shared value CUSTOM_HEADER_VALUE: it tells our own frontend or
 * service apart from anything else that finds the API. It identifies the
 * calling *app*, not a user — sign-in stays separate.
 *
 * Bypassed when CUSTOM_HEADER_ENABLED=false (e.g. local development). A value
 * sent from a browser is visible in its dev tools, so for a web frontend the
 * header is best added server-side (the Next.js server or proxy).
 */
export const customHeaderCheck: RequestHandler = (req, _res, next) => {
  if (!env.CUSTOM_HEADER_ENABLED) return next();

  const provided = req.get(env.CUSTOM_HEADER_NAME);
  if (
    !expected ||
    typeof provided !== "string" ||
    !timingSafeEqual(digest(provided), expected)
  ) {
    throw new AppError(
      401,
      "INVALID_API_KEY",
      `Missing or invalid ${env.CUSTOM_HEADER_NAME} header.`,
    );
  }
  next();
};
