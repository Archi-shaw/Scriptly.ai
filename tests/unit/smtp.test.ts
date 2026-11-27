import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SMTPServer } from "smtp-server";
import { getSmtpConfig } from "@/lib/config";
import { EmailDeliveryError, sendEmail } from "@/lib/email/mailer";

const received: string[] = [];
const message = { to: "user@example.com", subject: "Your code", html: "<p>123456</p>", text: "Your code: 123456" };

function startServer(options: Partial<ConstructorParameters<typeof SMTPServer>[0]>) {
  const server = new SMTPServer({
    authOptional: true,
    logger: false,
    onData(stream, _session, callback) {
      let data = "";
      stream.on("data", (chunk) => (data += chunk));
      stream.on("end", () => {
        received.push(data);
        callback();
      });
    },
    ...options,
  });
  return new Promise<{ server: SMTPServer; port: number }>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.server.address() as AddressInfo).port }));
  });
}

let plain: { server: SMTPServer; port: number };
let selfSigned: { server: SMTPServer; port: number } | null = null;

beforeAll(async () => {
  plain = await startServer({ disabledCommands: ["STARTTLS"] });
  try {
    const dir = mkdtempSync(join(tmpdir(), "scriptly-smtp-"));
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"), "-subj", "/CN=127.0.0.1", "-days", "1"], { stdio: "ignore" });
    selfSigned = await startServer({ key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) });
  } catch {
    selfSigned = null; // openssl not available
  }
});

afterAll(async () => {
  await new Promise<void>((r) => plain.server.close(() => r()));
  if (selfSigned) await new Promise<void>((r) => selfSigned!.server.close(() => r()));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function useServer(port: number, extra: Record<string, string> = {}) {
  vi.stubEnv("SMTP_HOST", "127.0.0.1");
  vi.stubEnv("SMTP_PORT", String(port));
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
}

describe("SMTP configuration", () => {
  it("requires TLS by default in production on STARTTLS ports, never in implicit-TLS mode", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_PORT", "587");
    expect(getSmtpConfig()).toMatchObject({ secure: false, requireTLS: true });
    vi.stubEnv("SMTP_PORT", "465");
    expect(getSmtpConfig()).toMatchObject({ secure: true, requireTLS: false });
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_REQUIRE_TLS", "false");
    expect(getSmtpConfig()?.requireTLS).toBe(false);
  });

  it("does not require TLS in development unless asked", () => {
    vi.stubEnv("SMTP_HOST", "localhost");
    vi.stubEnv("NODE_ENV", "development");
    expect(getSmtpConfig()?.requireTLS).toBe(false);
  });
});

describe("SMTP delivery", () => {
  it("refuses to send over plaintext when TLS is required (downgrade protection)", async () => {
    useServer(plain.port, { SMTP_REQUIRE_TLS: "true" });
    const before = received.length;
    await expect(sendEmail({ ...message, subject: "TLS required" })).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(received.length).toBe(before);
  });

  it("delivers when TLS is explicitly not required (local test servers)", async () => {
    useServer(plain.port, { SMTP_REQUIRE_TLS: "false" });
    await sendEmail({ ...message, subject: "Plain allowed" });
    expect(received.at(-1)).toContain("Subject: Plain allowed");
    expect(received.at(-1)).toContain("Your code: 123456");
  });

  it("rejects servers presenting an untrusted TLS certificate", async (ctx) => {
    if (!selfSigned) ctx.skip();
    useServer(selfSigned!.port, { SMTP_REQUIRE_TLS: "true" });
    const before = received.length;
    await expect(sendEmail({ ...message, subject: "Self-signed" })).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(received.length).toBe(before);
  });
});
