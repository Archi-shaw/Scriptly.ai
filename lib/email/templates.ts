import "server-only";
import type { ChallengePurpose } from "@/models/AuthChallenge";
import type { EmailMessage } from "@/lib/email/mailer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f2fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b1630;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e3f3;">
          <tr><td style="background:linear-gradient(120deg,#2e1065,#6d28d9);padding:20px 28px;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Scriptly<span style="color:#c4b5fd;">.ai</span></span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#1b1630;">${escapeHtml(title)}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:16px 28px 24px;border-top:1px solid #f0edf7;font-size:12px;line-height:1.5;color:#7a7391;">
            You're receiving this email because of activity on your Scriptly.ai account.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const PURPOSE_COPY: Record<ChallengePurpose, { subject: string; title: string; intro: string }> = {
  signup: {
    subject: "Verify your email for Scriptly.ai",
    title: "Confirm your email address",
    intro: "Use this code to finish creating your Scriptly.ai account.",
  },
  login: {
    subject: "Your Scriptly.ai sign-in code",
    title: "Your sign-in code",
    intro: "Someone (hopefully you) just entered your password. Use this code to complete sign-in.",
  },
  password_reset: {
    subject: "Reset your Scriptly.ai password",
    title: "Reset your password",
    intro: "Use this code to choose a new password for your account.",
  },
  email_change: {
    subject: "Confirm your new Scriptly.ai email",
    title: "Confirm your new email address",
    intro: "Use this code to confirm this address as the new email for your Scriptly.ai account.",
  },
};

export function otpEmail(
  purpose: ChallengePurpose,
  code: string,
  options: { to: string; name?: string; ttlMinutes: number },
): EmailMessage {
  const copy = PURPOSE_COPY[purpose];
  // Signup and email-change codes go to addresses nobody has verified yet, so
  // they carry no user-typed text: otherwise the forms could be used to send
  // arbitrary messages (e.g. a spam link as the "name") to any inbox.
  const recipientVerified = purpose === "login" || purpose === "password_reset";
  const greeting = recipientVerified && options.name ? `Hi ${options.name},` : "Hi,";
  const html = layout(
    copy.title,
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${escapeHtml(copy.intro)}</p>
     <div style="font-size:32px;font-weight:700;letter-spacing:10px;text-align:center;padding:16px;border-radius:12px;background:#f5f3ff;color:#4c1d95;font-family:'SFMono-Regular',Menlo,Consolas,monospace;">${escapeHtml(code)}</div>
     <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#5b5570;">This code expires in ${options.ttlMinutes} minutes and can be used once. Never share it with anyone — Scriptly.ai staff will never ask for it.</p>
     <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#5b5570;">If you didn't request this, you can safely ignore this email.</p>`,
  );
  const text = `${greeting}

${copy.intro}

Your code: ${code}

This code expires in ${options.ttlMinutes} minutes and can be used once. Never share it with anyone.
If you didn't request this, you can safely ignore this email.

— Scriptly.ai`;
  return { to: options.to, subject: copy.subject, html, text };
}

export function securityNoticeEmail(options: {
  to: string;
  name?: string;
  subject: string;
  title: string;
  message: string;
}): EmailMessage {
  const greeting = options.name ? `Hi ${options.name},` : "Hi,";
  const html = layout(
    options.title,
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(options.message)}</p>
     <p style="margin:0;font-size:13px;line-height:1.6;color:#5b5570;">If this wasn't you, reset your password immediately and contact support.</p>`,
  );
  const text = `${greeting}

${options.message}

If this wasn't you, reset your password immediately and contact support.

— Scriptly.ai`;
  return { to: options.to, subject: options.subject, html, text };
}
