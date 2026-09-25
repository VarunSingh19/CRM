import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import type { OpenApiSpec } from "../../config/swagger/swagger.js";

/**
 * Swagger UI for the spec in src/docs/openapi.yml, and the raw spec as JSON
 * for tools (Postman import, client generators). Mounted at /api-docs only
 * when SWAGGER_ENABLED is on (see routes/index.ts).
 */
export function createDocsRouter(spec: OpenApiSpec): Router {
  const router = Router();

  router.get("/openapi.json", (_req, res) => {
    res.json(spec);
  });
  router.use(
    "/",
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: "Onference CRM API",
      swaggerOptions: { persistAuthorization: false, displayRequestDuration: true },
    }),
  );

  return router;
}
