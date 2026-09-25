import { z } from "zod";
import { logger } from "../../config/logger/logger.js";
import { deliver, describeSmtpError, isSmtpEnabled, MAX_RECIPIENTS } from "../../config/smtp/smtp.js";
import { AppError } from "../../utils/errors/AppError.js";

/**
 * The one way the app sends email. Other services call it; no controller
 * or route touches SMTP. Every email is sent from FROM_EMAIL.
 */
const recipients = z.union([z.email(), z.array(z.email()).min(1).max(MAX_RECIPIENTS)]);

const mailMessage = z.object({
  to: recipients,
  // A line break in a header could smuggle in another header (Bcc: …).
  subject: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[^\r\n]*$/, "must be a single line"),
  text: z.string().min(1).max(100_000),
  html: z.string().max(500_000).optional(),
  replyTo: z.email().optional(),
});

export type MailMessage = z.input<typeof mailMessage>;

export const mailService = {
  /**
   * Sends one email. Returns its message id, or null when email is switched
   * off (no SMTP_HOST, development only). Throws 503 EMAIL_UNAVAILABLE when
   * the relay can't be reached or refuses it, so the caller can tell the
   * user to try again. Recipients and content are never logged.
   */
  async send(input: MailMessage): Promise<{ messageId: string } | null> {
    // Invalid input is a bug in the caller (the route's validator should have
    // caught it), so it surfaces as a 500 with the detail in the log.
    const message = mailMessage.parse(input);
    const count = Array.isArray(message.to) ? message.to.length : 1;

    if (!isSmtpEnabled()) {
      logger.warn({ recipients: count }, "email not sent: SMTP_HOST is empty, so email is switched off");
      return null;
    }

    try {
      const info = await deliver(message);
      logger.info({ messageId: info.messageId, recipients: count, rejected: info.rejected.length }, "email sent");
      return { messageId: info.messageId };
    } catch (err) {
      logger.error({ err: describeSmtpError(err), recipients: count }, "email not sent");
      throw new AppError(503, "EMAIL_UNAVAILABLE", "The email could not be sent. Please try again later.");
    }
  },
};
