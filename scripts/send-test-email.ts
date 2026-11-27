/**
 * Sends one test email through the app's real mailer, with the production TLS
 * rules (STARTTLS required on non-465 ports unless SMTP_REQUIRE_TLS=false).
 * Use it to check SMTP credentials, TLS and inbox placement before launch.
 *
 *   npm run email:test -- you@example.com
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
// Mirror production: refuse plaintext unless explicitly allowed.
process.env.SMTP_REQUIRE_TLS ??= "true";

async function main() {
  const to = process.argv[2]?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
    console.error("Usage: npm run email:test -- <recipient email>");
    process.exit(1);
  }

  const { getSmtpConfig } = await import("@/lib/config");
  const { sendEmail } = await import("@/lib/email/mailer");
  const { securityNoticeEmail } = await import("@/lib/email/templates");

  const smtp = getSmtpConfig();
  if (!smtp) {
    console.error("SMTP_HOST is not set. Configure SMTP_* in .env.local (or the environment) first.");
    process.exit(1);
  }
  console.log(
    `Sending via ${smtp.host}:${smtp.port} (${smtp.secure ? "implicit TLS" : smtp.requireTLS ? "STARTTLS required" : "STARTTLS optional"}) from ${smtp.from}…`,
  );

  const started = Date.now();
  await sendEmail(
    securityNoticeEmail({
      to,
      subject: "Scriptly.ai SMTP test",
      title: "SMTP test",
      message: `This is a test email from your Scriptly.ai deployment, sent at ${new Date().toISOString()}. If it reached your inbox (not spam), email delivery is working.`,
    }),
  );
  console.log(`Accepted by the SMTP server in ${Date.now() - started} ms. Check the inbox (and spam folder) of ${to}.`);
}

main().catch((error) => {
  console.error("Sending failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
