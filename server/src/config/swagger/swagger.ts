import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";
import { env } from "../env/env.js";

/**
 * The API contract lives in src/docs/openapi.yml, written by hand and kept
 * next to the code it describes. The build copies it to dist/docs, so this
 * path resolves the same way from src/ (tsx) and from dist/ (node).
 */
const SPEC_PATH = fileURLToPath(new URL("../../docs/openapi.yml", import.meta.url));

/** The minimum an OpenAPI document must have for Swagger UI to render it. */
const specShape = z.object({
  openapi: z.string().regex(/^3\.[01]\.\d+$/, "must be an OpenAPI 3.0.x or 3.1.x version"),
  info: z.object({ title: z.string().min(1), version: z.string().min(1) }),
  paths: z.record(z.string().startsWith("/", "path keys must start with /"), z.unknown()),
});

export type OpenApiSpec = Record<string, unknown>;

/**
 * Reads and checks the spec. Called once at startup when the docs are
 * enabled, so a broken file stops the boot with the reason instead of
 * serving an empty or half-rendered page.
 */
export function loadOpenApiSpec(path: string = SPEC_PATH): OpenApiSpec {
  let doc: unknown;
  try {
    doc = parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`OpenAPI spec ${path} could not be read: ${(err as Error).message}`);
  }
  const checked = specShape.safeParse(doc);
  if (!checked.success) {
    const problems = checked.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`OpenAPI spec ${path} is invalid:\n${problems}`);
  }
  return withRuntimeSettings(doc as OpenApiSpec);
}

/**
 * Settings that live in the environment, not the YAML: the custom header's
 * name, and a note on the scheme when the check is switched off.
 */
function withRuntimeSettings(spec: OpenApiSpec): OpenApiSpec {
  const copy = structuredClone(spec);
  const components = copy.components as { securitySchemes?: Record<string, Record<string, unknown>> } | undefined;
  const scheme = components?.securitySchemes?.customHeader;
  if (scheme) {
    scheme.name = env.CUSTOM_HEADER_NAME;
    if (!env.CUSTOM_HEADER_ENABLED) {
      scheme.description = `${String(scheme.description ?? "")} (Currently OFF: CUSTOM_HEADER_ENABLED=false.)`;
    }
  }
  return copy;
}
