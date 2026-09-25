import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../../utils/errors/AppError.js";

interface RequestSchemas {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

/**
 * Parses params, query and body against their schemas (from validators/) and
 * replaces them with the parsed values, so the controller behind it only ever
 * sees validated, stripped, defaulted input. Unknown body keys are dropped,
 * which is also what stops mass assignment.
 *
 * Returns an untyped handler on purpose: it is shape-agnostic, and a concrete
 * type here would fight Express's inference of the controller's types.
 *
 *   router.post("/", validate({ body: createUserBody }), controller.create);
 */
// biome-ignore lint/suspicious/noExplicitAny: shape-agnostic by design (see above); each controller declares its own types
export function validate(schemas: RequestSchemas): RequestHandler<any, any, any, any> {
  return (req, _res, next) => {
    const details: { path: string; message: string }[] = [];
    const parsed: Partial<Record<keyof RequestSchemas, unknown>> = {};

    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      // Express 5 leaves req.body undefined when no JSON was sent.
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        parsed[part] = result.data;
        continue;
      }
      for (const issue of result.error.issues) {
        details.push({ path: [part, ...issue.path.map(String)].join("."), message: issue.message });
      }
    }

    const [first] = details;
    if (first) {
      // `error` is what the UI shows; lead with the field, not the request part.
      const field = first.path.split(".").slice(1).join(".");
      throw new AppError(400, "VALIDATION_ERROR", field ? `${field}: ${first.message}` : first.message, details);
    }

    if (parsed.params !== undefined) req.params = parsed.params;
    if (parsed.body !== undefined) req.body = parsed.body;
    // Express 5 made req.query a getter; shadow it on this request instead.
    if (parsed.query !== undefined) {
      Object.defineProperty(req, "query", {
        value: parsed.query,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    next();
  };
}
