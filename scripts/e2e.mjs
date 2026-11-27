#!/usr/bin/env node
// End-to-end test runner: starts a mock OpenAI server and an SMTP sink, runs the
// production build of the app against a disposable MongoDB database, then runs
// tests/e2e against it over real HTTP.
//
//   E2E_MONGODB_URI="mongodb://127.0.0.1:27017/scriptly_e2e" npm run test:e2e
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import mongoose from "mongoose";

const mongoUri = process.env.E2E_MONGODB_URI;
if (!mongoUri) {
  console.error("Set E2E_MONGODB_URI to a disposable database whose name contains 'e2e'.");
  process.exit(1);
}
const dbName = new URL(mongoUri).pathname.replace(/^\//, "");
if (!/e2e/i.test(dbName)) {
  console.error(`Refusing to use database "${dbName}" — its name must contain "e2e" (it will be dropped).`);
  process.exit(1);
}

const ports = {
  app: process.env.E2E_APP_PORT ?? "3107",
  openai: process.env.MOCK_OPENAI_PORT ?? "4107",
  smtp: process.env.MAIL_SINK_SMTP_PORT ?? "2527",
  inbox: process.env.MAIL_SINK_HTTP_PORT ?? "4108",
};
const baseUrl = `http://localhost:${ports.app}`;
const children = [];

function start(name, command, args, env = {}) {
  // Each child leads its own process group so cleanup also stops grandchildren
  // (e.g. the next-server process spawned by `next start`).
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  const prefix = `[${name}] `;
  child.stdout.on("data", (d) => process.env.E2E_VERBOSE && process.stdout.write(prefix + d));
  child.stderr.on("data", (d) => process.stderr.write(prefix + d));
  children.push(child);
  return child;
}

async function waitFor(url, label, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

function cleanup() {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // already exited
    }
  }
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`Port ${port} is already in use — stop the process using it (a previous test run?) and retry.`)));
    probe.once("listening", () => probe.close(resolve));
    probe.listen(Number(port));
  });
}
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("exit", cleanup);

let exitCode = 1;
try {
  if (!existsSync(".next/BUILD_ID")) {
    console.log("No production build found — running `next build`…");
    await new Promise((resolve, reject) => {
      const build = spawn("npx", ["next", "build"], { stdio: "inherit" });
      build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build failed"))));
    });
  }

  for (const port of Object.values(ports)) await assertPortFree(port);

  console.log(`Resetting database ${dbName}…`);
  await mongoose.connect(mongoUri);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  start("mock-openai", "node", ["tests/mocks/openai-server.mjs"], { MOCK_OPENAI_PORT: ports.openai });
  start("mail-sink", "node", ["tests/mocks/mail-sink.mjs"], { MAIL_SINK_SMTP_PORT: ports.smtp, MAIL_SINK_HTTP_PORT: ports.inbox });
  await waitFor(`http://127.0.0.1:${ports.openai}/__requests`, "mock OpenAI");
  await waitFor(`http://127.0.0.1:${ports.inbox}/messages`, "mail sink");

  start("app", "node_modules/.bin/next", ["start", "-p", ports.app], {
    MONGODB_URI: mongoUri,
    NEXTAUTH_SECRET: "e2e-secret-not-for-production-0123456789abcdef",
    NEXTAUTH_URL: baseUrl,
    APP_URL: baseUrl,
    OPENAI_API_KEY: "test-openai-key",
    OPENAI_BASE_URL: `http://127.0.0.1:${ports.openai}/v1`,
    OPENAI_MODEL: "mock-model",
    OPENAI_TIMEOUT_MS: "10000",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: ports.smtp,
    SMTP_SECURE: "false",
    // The local test sink has no TLS; production requires STARTTLS by default.
    SMTP_REQUIRE_TLS: "false",
    SMTP_FROM: "Scriptly.ai <no-reply@scriptly.test>",
    SIGNUP_BONUS_CREDITS: "10",
    RAZORPAY_KEY_ID: "rzp_test_e2e",
    RAZORPAY_KEY_SECRET: "e2e-key-secret",
    RAZORPAY_WEBHOOK_SECRET: "e2e-webhook-secret",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  });
  await waitFor(`${baseUrl}/api/packages`, "Scriptly app");
  console.log(`App ready at ${baseUrl}; running end-to-end tests…`);

  exitCode = await new Promise((resolve) => {
    const tests = spawn("npx", ["vitest", "run", "--config", "vitest.e2e.config.mts"], {
      stdio: "inherit",
      env: {
        ...process.env,
        E2E_BASE_URL: baseUrl,
        E2E_INBOX_URL: `http://127.0.0.1:${ports.inbox}`,
        E2E_OPENAI_MOCK_URL: `http://127.0.0.1:${ports.openai}`,
        E2E_MONGODB_URI: mongoUri,
        E2E_WEBHOOK_SECRET: "e2e-webhook-secret",
      },
    });
    tests.on("exit", (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error);
} finally {
  cleanup();
}
process.exit(exitCode);
