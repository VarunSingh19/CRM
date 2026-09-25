import { pingDatabase } from "../../config/database/database.js";
import { smtpHealth } from "../../config/smtp/smtp.js";
import { isDraining } from "../../utils/lifecycle/lifecycle.js";

/**
 * What the probes report: only whether the API works, and when that was
 * checked. Which services exist and how each is doing stays in the log;
 * a public probe must not map the backend for whoever calls it.
 *
 * The database decides the status: without it nothing works. Email does not:
 * the API keeps serving while it's down, and the relay's failure is logged
 * as an error instead.
 */
export interface ProbeReport {
  status: boolean;
  checkedAt: string;
}

export const healthService = {
  async health(): Promise<ProbeReport> {
    const database = await pingDatabase();
    // Not part of the status. The call starts a background recheck of the
    // relay once the last result is stale, and that check logs an error
    // when email goes down.
    smtpHealth();
    return { status: database.status === "up", checkedAt: new Date().toISOString() };
  },

  /** Safe to route traffic here: the database answers and the process isn't shutting down. */
  async readiness(): Promise<ProbeReport> {
    const database = await pingDatabase();
    return { status: !isDraining() && database.status === "up", checkedAt: new Date().toISOString() };
  },
};
