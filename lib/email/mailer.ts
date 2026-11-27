import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getSmtpConfig, isProduction } from "@/lib/config";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("SMTP is not configured");
    this.name = "EmailNotConfiguredError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(cause?: unknown) {
    super("Email delivery failed", { cause });
    this.name = "EmailDeliveryError";
  }
}

let cached: { key: string; transporter: Transporter } | null = null;

function getTransporter(): Transporter | null {
  const config = getSmtpConfig();
  if (!config) return null;
  const key = JSON.stringify(config);
  if (cached?.key === key) return cached.transporter;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cached = { key, transporter };
  return transporter;
}

export function isEmailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

/**
 * Sends an email through SMTP. In development without SMTP settings the
 * message is printed to the server console instead (never in production).
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const config = getSmtpConfig();
  const transporter = getTransporter();

  if (!config || !transporter) {
    if (!isProduction()) {
      console.info(
        `\n──── [dev email] SMTP not configured; message not sent ────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n───────────────────────────────────────────────────────────\n`,
      );
      return;
    }
    throw new EmailNotConfiguredError();
  }

  try {
    await transporter.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch (error) {
    console.error("[email] delivery failed:", error instanceof Error ? error.message : error);
    throw new EmailDeliveryError(error);
  }
}
