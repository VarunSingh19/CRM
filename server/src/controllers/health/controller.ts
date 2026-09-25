import type { Request, Response } from "express";
import { healthService } from "../../services/health/service.js";

/**
 * Unauthenticated probes for the orchestrator, the load balancer and uptime
 * monitors. Controllers only handle HTTP: call the service, pick the status
 * code, send the body.
 */
export const healthController = {
  /**
   * Liveness: the process is up and serving. No I/O, so point the
   * orchestrator's restart probe here: a database outage must never get
   * healthy processes restarted.
   */
  live(_req: Request, res: Response) {
    res.json({ status: "ok" });
  },

  /**
   * Health: the process and its dependencies, for uptime monitors and people.
   * 503 when the database doesn't answer; 200 "degraded" when only email is
   * down, since the API still works without it.
   */
  async health(_req: Request, res: Response) {
    const report = await healthService.health();
    res.status(report.status === "down" ? 503 : 200).json(report);
  },

  /**
   * Readiness: safe to route traffic here. 503 while the database doesn't
   * answer, and from the moment shutdown begins, so the load balancer drains
   * this instance first.
   */
  async ready(_req: Request, res: Response) {
    const report = await healthService.readiness();
    res.status(report.status === "ready" ? 200 : 503).json(report);
  },
};
