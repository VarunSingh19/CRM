import { Router } from "express";
import { healthController } from "../../controllers/health/controller.js";

/**
 * Mounted at the root, outside /api: probes need no session, no rate limit
 * and no custom header. Documented in src/docs/openapi.yml under "Health".
 *
 *   /live     the process is up (restart probe; no I/O)
 *   /health   the process + database + email (uptime monitors, people)
 *   /ready    safe to send traffic here (load balancer)
 */
export const healthRouter = Router();

healthRouter.get("/live", healthController.live);
healthRouter.get("/health", healthController.health);
healthRouter.get("/ready", healthController.ready);
