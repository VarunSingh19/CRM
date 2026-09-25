import { type DatabaseCheck, pingDatabase } from "../../config/database/database.js";
import { smtpHealth } from "../../config/smtp/smtp.js";
import { isDraining } from "../../utils/lifecycle/lifecycle.js";

/**
 * What the probes report, and what counts as healthy. The database is
 * critical: without it nothing works. Email is not: the API keeps serving
 * while it's down, so that is "degraded", not "down".
 */
export interface HealthReport {
  status: "ok" | "degraded" | "down";
  checks: {
    database: DatabaseCheck;
    smtp: ReturnType<typeof smtpHealth>;
  };
}

export interface ReadinessReport {
  status: "ready" | "unavailable" | "shutting-down";
  checks: { database: DatabaseCheck };
}

export const healthService = {
  async health(): Promise<HealthReport> {
    const database = await pingDatabase();
    const smtp = smtpHealth();
    const status = database.status === "down" ? "down" : smtp.status === "down" ? "degraded" : "ok";
    return { status, checks: { database, smtp } };
  },

  /** Safe to route traffic here: the database answers and the process isn't shutting down. */
  async readiness(): Promise<ReadinessReport> {
    const database = await pingDatabase();
    const status = isDraining() ? "shutting-down" : database.status === "up" ? "ready" : "unavailable";
    return { status, checks: { database } };
  },
};
