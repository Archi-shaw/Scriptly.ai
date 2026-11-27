import { createHmac, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL!;
const INBOX = process.env.E2E_INBOX_URL!;
const OPENAI = process.env.E2E_OPENAI_MOCK_URL!;
const WEBHOOK_SECRET = process.env.E2E_WEBHOOK_SECRET!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Minimal browser-like client: cookie jar, per-client IP, no automatic redirects. */
class Client {
  private cookies = new Map<string, string>();
  constructor(private ip: string) {}

  hasCookie(fragment: string) {
    return [...this.cookies.keys()].some((name) => name.includes(fragment));
  }

  private store(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair, ...attributes] = raw.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const expired =
        attributes.some((a) => /^\s*max-age=0\s*$/i.test(a)) ||
        attributes.some((a) => {
          const match = a.trim().match(/^expires=(.+)$/i);
          return match ? new Date(match[1]).getTime() < Date.now() : false;
        });
      if (expired || value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async request(path: string, init: { method?: string; json?: unknown; form?: Record<string, string>; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { "x-forwarded-for": this.ip, ...init.headers };
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    let body: string | undefined;
    if (init.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(init.json);
    } else if (init.form) {
      headers["content-type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(init.form).toString();
    }
    const res = await fetch(BASE + path, { method: init.method ?? (body ? "POST" : "GET"), headers, body, redirect: "manual" });
    this.store(res);
    const text = await res.text();
    let data: Json = text;
    try {
      data = JSON.parse(text);
    } catch {
      // HTML or empty body
    }
    return { status: res.status, data, headers: res.headers };
  }

  /** Stage 2: exchange an emailed code for a session through NextAuth's "otp" provider. */
  async verifyOtp(challengeToken: string, code: string) {
    const csrf = await this.request("/api/auth/csrf");
    const res = await this.request("/api/auth/callback/otp", {
      form: { csrfToken: csrf.data.csrfToken, challengeToken, code, json: "true", callbackUrl: `${BASE}/dashboard` },
    });
    const url: string | null = typeof res.data === "object" && res.data?.url ? res.data.url : res.headers.get("location");
    return { status: res.status, error: url ? new URL(url, BASE).searchParams.get("error") : null };
  }
}

let ipCounter = 1;
const newClient = () => new Client(`10.77.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`);

async function latestCode(email: string, after: number): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const messages: Json[] = await (await fetch(`${INBOX}/messages?to=${encodeURIComponent(email)}`)).json();
    const message = messages.filter((m) => m.receivedAt >= after && m.code).at(-1);
    if (message) return message.code;
    await sleep(200);
  }
  throw new Error(`No verification email for ${email}`);
}

async function inboxCount(email: string): Promise<number> {
  return ((await (await fetch(`${INBOX}/messages?to=${encodeURIComponent(email)}`)).json()) as Json[]).length;
}

const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

async function signUp(name: string, email: string, password: string) {
  const client = newClient();
  const t = Date.now();
  const start = await client.request("/api/auth/signup", { json: { name, email, password, confirmPassword: password } });
  expect(start.status).toBe(201);
  const result = await client.verifyOtp(start.data.data.challengeToken, await latestCode(email, t));
  expect(result.error).toBeNull();
  return client;
}

async function logIn(email: string, password: string, client = newClient()) {
  const t = Date.now();
  const start = await client.request("/api/auth/login", { json: { email, password } });
  expect(start.status).toBe(200);
  const result = await client.verifyOtp(start.data.data.challengeToken, await latestCode(email, t));
  expect(result.error).toBeNull();
  return client;
}

let db: mongoose.Connection;
const users = () => db.collection("users");

beforeAll(async () => {
  db = await mongoose.createConnection(process.env.E2E_MONGODB_URI!).asPromise();
});
afterAll(async () => {
  await db?.close();
});

const PASSWORD = "Sup3rSecret!";
const alice = { name: "Alice Writer", email: `alice-${randomUUID().slice(0, 8)}@example.com` };
const bob = { name: "Bob Reader", email: `bob-${randomUUID().slice(0, 8)}@example.com` };
let aliceClient: Client;
let bobClient: Client;

describe("public site and route protection", () => {
  it("serves the landing page and live pricing data", async () => {
    const client = newClient();
    const home = await client.request("/");
    expect(home.status).toBe(200);
    expect(home.data).toContain("Scriptly");
    const packages = await client.request("/api/packages");
    expect(packages.status).toBe(200);
    expect(packages.data.data.packages.map((p: Json) => p.slug)).toEqual(["starter", "pro", "business"]);
    expect(packages.data.data.signupBonus).toBe(10);
    const templates = await client.request("/api/templates?q=email");
    expect(templates.data.data.total).toBeGreaterThan(3);
    expect(JSON.stringify(templates.data)).not.toContain("Instructions");
  });

  it("redirects signed-out visitors and rejects unauthenticated API calls", async () => {
    const client = newClient();
    for (const path of ["/dashboard", "/write", "/documents", "/history", "/billing", "/settings"]) {
      const res = await client.request(path);
      expect(res.status, path).toBe(307);
      expect(res.headers.get("location")).toContain(`/login?callbackUrl=${encodeURIComponent(path)}`);
    }
    for (const path of ["/api/me", "/api/documents", "/api/history", "/api/credits", "/api/dashboard"]) {
      const res = await client.request(path);
      expect(res.status, path).toBe(401);
      expect(res.data.error.code).toBe("UNAUTHENTICATED");
    }
  });
});

describe("content security policy", () => {
  it("serves every page with a fresh nonce that all of its scripts carry", async () => {
    const client = newClient();
    const nonces = new Set<string>();
    for (const path of ["/", "/login", "/signup", "/forgot-password", "/terms", "/privacy", "/does-not-exist"]) {
      const res = await client.request(path);
      const policy = res.headers.get("content-security-policy") ?? "";
      const nonce = policy.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
      expect(nonce, path).toBeTruthy();
      expect(policy, path).toContain("'strict-dynamic'");
      expect(policy, path).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
      expect(policy, path).toContain("frame-ancestors 'none'");
      nonces.add(nonce!);

      const html = String(res.data);
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      expect(scripts.length, path).toBeGreaterThan(0);
      for (const tag of scripts) expect(tag, `${path}: ${tag}`).toContain(`nonce="${nonce}"`);
    }
    expect(nonces.size).toBe(7);
  });

  it("leaves JSON APIs alone", async () => {
    const res = await newClient().request("/api/packages");
    expect(res.headers.get("content-security-policy")).toBeNull();
  });
});

describe("signup with email verification", () => {
  it("validates input and creates no account before the email is verified", async () => {
    const client = newClient();
    const bad = await client.request("/api/auth/signup", { json: { name: "", email: "nope", password: "short", confirmPassword: "x" } });
    expect(bad.status).toBe(400);
    expect(bad.data.error.details.fields).toHaveProperty("email");

    const t = Date.now();
    const start = await client.request("/api/auth/signup", { json: { ...alice, password: PASSWORD, confirmPassword: PASSWORD } });
    expect(start.status).toBe(201);
    expect(start.data.data.challengeToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await users().countDocuments({ email: alice.email })).toBe(0);

    const code = await latestCode(alice.email, t);
    const challenge = await db.collection("authchallenges").findOne({ email: alice.email });
    expect(JSON.stringify(challenge)).not.toContain(code);
    expect(challenge?.payload?.passwordHash).toMatch(/^\$2[aby]\$12\$/);

    const wrong = await client.verifyOtp(start.data.data.challengeToken, wrongCode(code));
    expect(wrong.error).toBe("CODE_INVALID:4");
    expect(await users().countDocuments({ email: alice.email })).toBe(0);

    const ok = await client.verifyOtp(start.data.data.challengeToken, code);
    expect(ok.error).toBeNull();
    expect(client.hasCookie("next-auth.session-token")).toBe(true);
    aliceClient = client;

    const me = await client.request("/api/me");
    expect(me.status).toBe(200);
    expect(me.data.data.user).toMatchObject({ email: alice.email, name: alice.name, emailVerified: true, credits: 10, hasPassword: true });

    // The code is single-use.
    const replay = await newClient().verifyOtp(start.data.data.challengeToken, code);
    expect(replay.error).toBe("CODE_USED");
  });

  it("prevents duplicate accounts", async () => {
    const res = await newClient().request("/api/auth/signup", { json: { ...alice, password: PASSWORD, confirmPassword: PASSWORD } });
    expect(res.status).toBe(409);
    expect(res.data.error.code).toBe("EMAIL_TAKEN");
  });

  it("creates a second user", async () => {
    bobClient = await signUp(bob.name, bob.email, PASSWORD);
    expect((await bobClient.request("/api/me")).data.data.user.credits).toBe(10);
  });
});

describe("login with email-based 2FA", () => {
  it("never creates a session from the password alone", async () => {
    const client = newClient();
    const bad = await client.request("/api/auth/login", { json: { email: alice.email, password: "wrong-password1" } });
    expect(bad.status).toBe(401);
    expect(bad.data.error.code).toBe("INVALID_CREDENTIALS");
    const unknown = await client.request("/api/auth/login", { json: { email: "ghost@example.com", password: "whatever1" } });
    expect(unknown.data.error).toEqual(bad.data.error);

    const stage1 = await client.request("/api/auth/login", { json: { email: alice.email, password: PASSWORD } });
    expect(stage1.status).toBe(200);
    expect(client.hasCookie("session-token")).toBe(false);
    expect((await client.request("/api/me")).status).toBe(401);
  });

  it("requires a valid, unexpired code to sign in", async () => {
    const client = newClient();
    let t = Date.now();
    const first = await client.request("/api/auth/login", { json: { email: alice.email, password: PASSWORD } });
    const code = await latestCode(alice.email, t);
    await db.collection("authchallenges").updateOne({ purpose: "login", email: alice.email, consumedAt: null }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await client.verifyOtp(first.data.data.challengeToken, code)).error).toBe("CODE_EXPIRED");

    t = Date.now();
    const second = await client.request("/api/auth/login", { json: { email: alice.email, password: PASSWORD } });
    const resend = await client.request("/api/auth/otp/resend", { json: { challengeToken: second.data.data.challengeToken } });
    expect(resend.status).toBe(429);
    expect(resend.data.error.code).toBe("RESEND_COOLDOWN");
    const result = await client.verifyOtp(second.data.data.challengeToken, await latestCode(alice.email, t));
    expect(result.error).toBeNull();
    expect((await client.request("/api/me")).data.data.user.email).toBe(alice.email);
  });

  it("locks a code after repeated wrong guesses", async () => {
    const client = newClient();
    const t = Date.now();
    const start = await client.request("/api/auth/login", { json: { email: bob.email, password: PASSWORD } });
    const code = await latestCode(bob.email, t);
    const errors: (string | null)[] = [];
    for (let i = 0; i < 5; i++) errors.push((await client.verifyOtp(start.data.data.challengeToken, wrongCode(code))).error);
    expect(errors).toEqual(["CODE_INVALID:4", "CODE_INVALID:3", "CODE_INVALID:2", "CODE_INVALID:1", "TOO_MANY_ATTEMPTS"]);
    expect((await client.verifyOtp(start.data.data.challengeToken, code)).error).toBe("TOO_MANY_ATTEMPTS");
    expect((await client.request("/api/me")).status).toBe(401);
  });

  it("rate-limits repeated password attempts", async () => {
    const client = newClient();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await client.request("/api/auth/login", { json: { email: "target@example.com", password: `guess-${i}x` } })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("AI generation, credits and history", () => {
  let generationId = "";

  it("generates template content in the selected language and deducts credits server-side", async () => {
    await fetch(`${OPENAI}/__requests`, { method: "DELETE" });
    const res = await aliceClient.request("/api/generate", {
      json: {
        templateId: "blog-post",
        inputs: { topic: "Remote team rituals", keywords: "remote work" },
        settings: { language: "es", tone: "friendly", length: "medium", framework: "aida", creativity: "balanced" },
        requestId: "e2e-gen-0001",
      },
    });
    expect(res.status).toBe(200);
    expect(res.data.data.generation).toMatchObject({ status: "completed", templateId: "blog-post", language: "es", creditsUsed: 3 });
    expect(res.data.data.generation.output).toContain("Mock result");
    expect(res.data.data.credits).toBe(7);
    generationId = res.data.data.generation.id;

    const [sent] = (await (await fetch(`${OPENAI}/__requests`)).json()) as Json[];
    const prompt = sent.messages[1].content as string;
    expect(prompt).toContain("Write everything in Spanish (Español).");
    expect(prompt).toContain("Tone: Friendly");
    expect(prompt).toContain("Remote team rituals");
    expect(prompt).not.toContain("Copywriting framework"); // blog posts don't use frameworks
    expect(sent.model).toBe("mock-model");
  });

  it("applies AIDA, PAS and BAB to the prompt", async () => {
    await fetch(`${OPENAI}/__requests`, { method: "DELETE" });
    for (const [templateId, framework, expected] of [
      ["facebook-ad", "pas", "PAS — Problem"],
      ["landing-page", "bab", "BAB — Before"],
      ["aida-copywriter", "none", "AIDA — Attention"],
    ] as const) {
      const res = await bobClient.request("/api/generate", {
        json: {
          templateId,
          inputs: { productName: "Lumen lamp", description: "Glare-free desk lamp" },
          settings: { language: "en-US", tone: "persuasive", length: "short", framework, creativity: "balanced" },
          requestId: `e2e-fw-${templateId}`,
        },
      });
      expect(res.status, templateId).toBe(200);
      const requests = (await (await fetch(`${OPENAI}/__requests`)).json()) as Json[];
      expect(requests.at(-1).messages[1].content).toContain(expected);
    }
  });

  it("treats a retried request id as the same generation (no double charge)", async () => {
    const before = (await aliceClient.request("/api/credits")).data.data.balance;
    const res = await aliceClient.request("/api/generate", {
      json: {
        templateId: "blog-post",
        inputs: { topic: "Remote team rituals" },
        settings: { language: "es", tone: "friendly", length: "medium", creativity: "balanced" },
        requestId: "e2e-gen-0001",
      },
    });
    expect(res.data.data.reused).toBe(true);
    expect((await aliceClient.request("/api/credits")).data.data.balance).toBe(before);
  });

  it("refunds credits when the AI provider fails", async () => {
    const before = (await aliceClient.request("/api/credits")).data.data.balance;
    const res = await aliceClient.request("/api/generate", {
      json: {
        templateId: "instagram-caption",
        inputs: { description: "Launch day [[mock:500]]" },
        settings: { language: "en-US", tone: "friendly", length: "short", creativity: "balanced" },
        requestId: "e2e-fail-0001",
      },
    });
    expect(res.status).toBe(502);
    expect(res.data.error.message).toMatch(/refunded/);
    expect((await aliceClient.request("/api/credits")).data.data.balance).toBe(before);
    const history = await aliceClient.request("/api/history?status=refunded");
    expect(history.data.data.items[0]).toMatchObject({ status: "refunded", creditsRefunded: 1 });
  });

  it("validates template inputs", async () => {
    const res = await aliceClient.request("/api/generate", {
      json: { templateId: "blog-post", inputs: {}, settings: { language: "xx", tone: "friendly", length: "medium" }, requestId: "e2e-bad-0001" },
    });
    expect(res.status).toBe(400);
    const missing = await aliceClient.request("/api/generate", {
      json: { templateId: "blog-post", inputs: { topic: " " }, settings: { language: "en-US", tone: "friendly", length: "medium" }, requestId: "e2e-bad-0002" },
    });
    expect(missing.status).toBe(400);
    expect(missing.data.error.details.fields.topic).toMatch(/required/);
    const unknown = await aliceClient.request("/api/generate", {
      json: { templateId: "nope", inputs: {}, settings: { language: "en-US", tone: "friendly", length: "medium" }, requestId: "e2e-bad-0003" },
    });
    expect(unknown.status).toBe(404);
  });

  it("runs editor AI actions and charges for them", async () => {
    const before = (await aliceClient.request("/api/credits")).data.data.balance;
    const improve = await aliceClient.request("/api/refine", { json: { action: "improve", content: "Some text to improve.", language: "en-US", requestId: "e2e-ref-0001" } });
    expect(improve.status).toBe(200);
    expect(improve.data.data.output).toBe("Refined content from the mock model.");
    const variants = await aliceClient.request("/api/refine", { json: { action: "variants", content: "Some text.", requestId: "e2e-ref-0002" } });
    expect(variants.data.data.variants).toHaveLength(3);
    const tone = await aliceClient.request("/api/refine", { json: { action: "tone", content: "Hi.", requestId: "e2e-ref-0003" } });
    expect(tone.status).toBe(400);
    expect((await aliceClient.request("/api/credits")).data.data.balance).toBe(before - 3);
  });

  it("shows history, the dashboard and the credit ledger from real data", async () => {
    const history = await aliceClient.request("/api/history");
    expect(history.data.data.items.map((i: Json) => i.id)).toContain(generationId);
    expect(history.data.data.items[0].output).toBeUndefined();
    const item = await aliceClient.request(`/api/history/${generationId}`);
    expect(item.data.data.generation.output).toContain("Mock result");

    const dashboard = await aliceClient.request("/api/dashboard");
    expect(dashboard.data.data.stats).toMatchObject({ generations: 1, documents: 0 });
    expect(dashboard.data.data.usage).toHaveLength(14);

    const ledger = await aliceClient.request("/api/credits/transactions?limit=50");
    const types = ledger.data.data.items.map((t: Json) => t.type);
    expect(types).toContain("bonus");
    expect(types).toContain("usage");
    expect(types).toContain("refund");
    const balance = (await aliceClient.request("/api/credits")).data.data.balance;
    expect(ledger.data.data.items[0].balanceAfter).toBe(balance);
  });

  it("blocks generation without enough credits and never goes negative", async () => {
    const client = await signUp("Poor User", `poor-${randomUUID().slice(0, 8)}@example.com`, PASSWORD);
    const attempts = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        client.request("/api/generate", {
          json: {
            templateId: "blog-post",
            inputs: { topic: `Parallel ${i}` },
            settings: { language: "en-US", tone: "friendly", length: "medium" },
            requestId: `e2e-par-${i}-0000`,
          },
        }),
      ),
    );
    const ok = attempts.filter((a) => a.status === 200).length;
    expect(ok).toBe(3); // 10 credits / 3 per post
    expect(attempts.filter((a) => a.status === 402)).toHaveLength(3);
    const credits = (await client.request("/api/credits")).data.data.balance;
    expect(credits).toBe(1);
  });
});

describe("documents and ownership", () => {
  let docId = "";
  let updatedAt = "";

  it("saves, edits, renames, reopens, duplicates and deletes documents", async () => {
    const history = await aliceClient.request("/api/history");
    const generation = history.data.data.items.find((i: Json) => i.status === "completed");
    const created = await aliceClient.request("/api/documents", { json: { content: "# My Doc\n\nHello world", generationId: generation.id } });
    expect(created.status).toBe(201);
    expect(created.data.data.document).toMatchObject({ title: "My Doc", category: "blog", wordCount: 4 });
    docId = created.data.data.document.id;
    updatedAt = created.data.data.document.updatedAt;

    const edited = await aliceClient.request(`/api/documents/${docId}`, { method: "PATCH", json: { content: "# My Doc\n\nEdited text here", baseUpdatedAt: updatedAt } });
    expect(edited.status).toBe(200);
    const stale = await aliceClient.request(`/api/documents/${docId}`, { method: "PATCH", json: { content: "stale tab", baseUpdatedAt: updatedAt } });
    expect(stale.status).toBe(409);
    expect(stale.data.error.details.document.content).toContain("Edited text here");

    const renamed = await aliceClient.request(`/api/documents/${docId}`, { method: "PATCH", json: { title: "Renamed doc" } });
    expect(renamed.data.data.document.title).toBe("Renamed doc");
    const reopened = await aliceClient.request(`/api/documents/${docId}`);
    expect(reopened.data.data.document).toMatchObject({ title: "Renamed doc", content: "# My Doc\n\nEdited text here" });

    const list = await aliceClient.request("/api/documents?q=edited");
    expect(list.data.data.total).toBe(1);
    const copy = await aliceClient.request(`/api/documents/${docId}/duplicate`, { method: "POST" });
    expect(copy.data.data.document.title).toBe("Copy of Renamed doc");
    const sorted = await aliceClient.request("/api/documents?sort=title&order=asc");
    expect(sorted.data.data.items.map((d: Json) => d.title)).toEqual(["Copy of Renamed doc", "Renamed doc"]);

    const removed = await aliceClient.request(`/api/documents/${copy.data.data.document.id}`, { method: "DELETE" });
    expect(removed.status).toBe(200);
    expect((await aliceClient.request(`/api/documents/${copy.data.data.document.id}`)).status).toBe(404);
  });

  it("hides other users' documents and history (no IDOR)", async () => {
    expect((await bobClient.request(`/api/documents/${docId}`)).status).toBe(404);
    expect((await bobClient.request(`/api/documents/${docId}`, { method: "PATCH", json: { title: "pwned" } })).status).toBe(404);
    expect((await bobClient.request(`/api/documents/${docId}`, { method: "DELETE" })).status).toBe(404);
    expect((await bobClient.request(`/api/documents/${docId}/duplicate`, { method: "POST" })).status).toBe(404);
    expect((await bobClient.request("/api/documents")).data.data.items.some((d: Json) => d.id === docId)).toBe(false);
    const aliceHistory = await aliceClient.request("/api/history");
    expect((await bobClient.request(`/api/history/${aliceHistory.data.data.items[0].id}`)).status).toBe(404);
    expect((await bobClient.request("/api/documents/not-an-id")).status).toBe(404);
    expect((await aliceClient.request(`/api/documents/${docId}`)).data.data.document.title).toBe("Renamed doc");
  });

  it("cannot be manipulated into changing credits or bypassing CSRF checks", async () => {
    const before = (await aliceClient.request("/api/me")).data.data.user.credits;
    const tamper = await aliceClient.request("/api/me", { method: "PATCH", json: { name: "Alice", availableCredits: 99999 } });
    expect(tamper.status).toBe(400);
    expect((await aliceClient.request("/api/me")).data.data.user.credits).toBe(before);
    const injected = await aliceClient.request("/api/auth/login", { json: { email: { $ne: null }, password: { $ne: null } } });
    expect(injected.status).toBe(400);
    const crossSite = await aliceClient.request("/api/documents", { json: { content: "x" }, headers: { origin: "https://evil.example" } });
    expect(crossSite.status).toBe(403);
  });
});

describe("workspace pages", () => {
  it("server-renders every workspace page for a signed-in user, with its title", async () => {
    const pages: [string, string][] = [
      ["/dashboard", "Dashboard"],
      ["/write?template=blog-post", "AI Writer"],
      ["/templates", "Templates"],
      ["/documents", "My Documents"],
      ["/history", "History"],
      ["/billing", "Credits &amp; Billing"],
      ["/settings", "Settings"],
    ];
    for (const [path, title] of pages) {
      const res = await aliceClient.request(path);
      expect(res.status, path).toBe(200);
      expect(String(res.data), path).toContain(`<title>${title} · Scriptly.ai</title>`);
    }
    const docs = await aliceClient.request("/api/documents");
    const doc = await aliceClient.request(`/documents/${docs.data.data.items[0].id}`);
    expect(doc.status).toBe(200);
    expect(String((await newClient().request("/login")).data)).toContain("<title>Log in · Scriptly.ai</title>");
    // Signed-in users are sent from the auth pages to their dashboard.
    expect((await aliceClient.request("/login")).headers.get("location")).toContain("/dashboard");
  });
});

describe("profile, password and account management", () => {
  it("updates the profile name", async () => {
    const res = await aliceClient.request("/api/me", { method: "PATCH", json: { name: "Alice Updated" } });
    expect(res.data.data.user.name).toBe("Alice Updated");
  });

  it("changes email only after verifying the new address", async () => {
    const newEmail = `alice-new-${randomUUID().slice(0, 6)}@example.com`;
    const wrong = await aliceClient.request("/api/me/email", { json: { newEmail, password: "not-it-123" } });
    expect(wrong.status).toBe(403);
    const taken = await aliceClient.request("/api/me/email", { json: { newEmail: bob.email, password: PASSWORD } });
    expect(taken.status).toBe(409);

    const t = Date.now();
    const start = await aliceClient.request("/api/me/email", { json: { newEmail, password: PASSWORD } });
    expect(start.status).toBe(201);
    expect((await aliceClient.request("/api/me")).data.data.user.email).toBe(alice.email);
    // Bob cannot complete Alice's email change.
    const code = await latestCode(newEmail, t);
    expect((await bobClient.request("/api/me/email/verify", { json: { challengeToken: start.data.data.challengeToken, code } })).status).toBe(400);
    const t2 = Date.now();
    const restart = await aliceClient.request("/api/me/email", { json: { newEmail, password: PASSWORD } });
    const verified = await aliceClient.request("/api/me/email/verify", { json: { challengeToken: restart.data.data.challengeToken, code: await latestCode(newEmail, t2) } });
    expect(verified.status).toBe(200);
    expect(verified.data.data.user.email).toBe(newEmail);
    alice.email = newEmail;
  });

  it("revokes every session when the password changes", async () => {
    const otherDevice = await logIn(alice.email, PASSWORD);
    const res = await aliceClient.request("/api/me/password", { json: { currentPassword: PASSWORD, newPassword: "N3wPassword!", confirmPassword: "N3wPassword!" } });
    expect(res.status).toBe(200);
    expect((await aliceClient.request("/api/me")).data.error.code).toBe("SESSION_EXPIRED");
    expect((await otherDevice.request("/api/me")).status).toBe(401);
    expect((await newClient().request("/api/auth/login", { json: { email: alice.email, password: PASSWORD } })).status).toBe(401);
    aliceClient = await logIn(alice.email, "N3wPassword!");
  });

  it("resets a forgotten password without revealing which emails exist", async () => {
    const ghost = `ghost-${randomUUID().slice(0, 6)}@example.com`;
    const unknown = await newClient().request("/api/auth/password/forgot", { json: { email: ghost } });
    const known = await newClient().request("/api/auth/password/forgot", { json: { email: bob.email } });
    expect(unknown.status).toBe(200);
    expect(Object.keys(unknown.data.data).sort()).toEqual(Object.keys(known.data.data).sort());
    await sleep(500);
    expect(await inboxCount(ghost)).toBe(0);
    const decoy = await newClient().request("/api/auth/password/reset", {
      json: { challengeToken: unknown.data.data.challengeToken, code: "123456", password: "Another1pass", confirmPassword: "Another1pass" },
    });
    expect(decoy.data.error.code).toBe("CODE_INVALID");

    const t = Date.now();
    const client = newClient();
    const start = await client.request("/api/auth/password/forgot", { json: { email: bob.email } });
    const code = await latestCode(bob.email, t);
    const reset = await client.request("/api/auth/password/reset", {
      json: { challengeToken: start.data.data.challengeToken, code, password: "B0bReset!pass", confirmPassword: "B0bReset!pass" },
    });
    expect(reset.status).toBe(200);
    expect((await bobClient.request("/api/me")).status).toBe(401);
    bobClient = await logIn(bob.email, "B0bReset!pass");
  });

  it("signs out everywhere", async () => {
    const second = await logIn(bob.email, "B0bReset!pass");
    expect((await second.request("/api/me/sessions", { method: "DELETE" })).status).toBe(200);
    expect((await second.request("/api/me")).status).toBe(401);
    expect((await bobClient.request("/api/me")).status).toBe(401);
    bobClient = await logIn(bob.email, "B0bReset!pass");
  });
});

describe("payments", () => {
  function signed(body: unknown) {
    const raw = JSON.stringify(body);
    return { raw, signature: createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex") };
  }

  async function post(raw: string, signature?: string) {
    const res = await fetch(`${BASE}/api/webhooks/razorpay`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(signature ? { "x-razorpay-signature": signature } : {}) },
      body: raw,
    });
    return res.status;
  }

  it("credits a package only after a signed, matching payment confirmation — exactly once", async () => {
    const bobDoc = await users().findOne({ email: bob.email });
    const pkg = await db.collection("creditpackages").findOne({ slug: "pro" });
    const providerOrderId = `order_e2e_${randomUUID().slice(0, 8)}`;
    await db.collection("orders").insertOne({
      userId: bobDoc!._id,
      packageId: pkg!._id,
      packageSnapshot: { slug: "pro", name: "Pro", credits: pkg!.credits, bonusCredits: pkg!.bonusCredits },
      amount: pkg!.priceMinor,
      currency: pkg!.currency,
      receipt: `rcpt_${providerOrderId}`,
      provider: "razorpay",
      providerOrderId,
      status: "created",
      fulfillmentStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const before = (await bobClient.request("/api/credits")).data.data.balance;
    const event = (amount: number) => ({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_e2e_1", order_id: providerOrderId, status: "captured", amount, currency: pkg!.currency } } },
    });

    const unsigned = signed(event(pkg!.priceMinor));
    expect(await post(unsigned.raw)).toBe(401);
    expect(await post(unsigned.raw, "0".repeat(64))).toBe(401);
    const mismatch = signed(event(100));
    expect(await post(mismatch.raw, mismatch.signature)).toBe(200);
    expect((await bobClient.request("/api/credits")).data.data.balance).toBe(before);

    const valid = signed(event(pkg!.priceMinor));
    expect(await post(valid.raw, valid.signature)).toBe(200);
    expect(await post(valid.raw, valid.signature)).toBe(200); // provider retry
    const after = (await bobClient.request("/api/credits")).data.data.balance;
    expect(after).toBe(before + pkg!.credits + pkg!.bonusCredits);
    const orders = await bobClient.request("/api/orders");
    expect(orders.data.data.items[0]).toMatchObject({ status: "paid", fulfillmentStatus: "fulfilled" });
  });

  it("reconciles refunds from signed webhooks: takes the credits back once and marks the order refunded", async () => {
    const order = await db.collection("orders").findOne({ providerPaymentId: "pay_e2e_1" });
    const credits = order!.packageSnapshot.credits + order!.packageSnapshot.bonusCredits;
    const before = (await bobClient.request("/api/credits")).data.data.balance;
    const refundEvent = (event: string) => ({
      event,
      contains: ["refund", "payment"],
      payload: {
        refund: { entity: { id: "rfnd_e2e_1", payment_id: "pay_e2e_1", amount: order!.amount, currency: order!.currency, status: "processed" } },
        payment: { entity: { id: "pay_e2e_1", order_id: order!.providerOrderId, status: "refunded", amount: order!.amount, currency: order!.currency } },
      },
    });

    const forged = signed(refundEvent("refund.processed"));
    expect(await post(forged.raw, "0".repeat(64))).toBe(401);
    expect((await bobClient.request("/api/credits")).data.data.balance).toBe(before);

    for (const name of ["refund.created", "refund.processed", "refund.processed"]) {
      const valid = signed(refundEvent(name));
      expect(await post(valid.raw, valid.signature)).toBe(200);
    }
    expect((await bobClient.request("/api/credits")).data.data.balance).toBe(before - Math.min(before, credits));
    const orders = await bobClient.request("/api/orders");
    expect(orders.data.data.items.find((o: Json) => o.id === order!._id.toString())).toMatchObject({
      status: "refunded",
      refundedAmount: order!.amount,
    });
    const ledger = await bobClient.request("/api/credits/transactions?type=reversal");
    expect(ledger.data.data.items).toHaveLength(1);

    // A late capture retry can't re-credit the refunded order.
    const capture = signed({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_e2e_1", order_id: order!.providerOrderId, status: "captured", amount: order!.amount, currency: order!.currency } } },
    });
    expect(await post(capture.raw, capture.signature)).toBe(200);
    expect((await bobClient.request("/api/credits")).data.data.balance).toBe(before - Math.min(before, credits));
  });

  it("never credits from the client: bogus checkout signatures are rejected", async () => {
    const order = await db.collection("orders").findOne({ providerPaymentId: "pay_e2e_1" });
    const res = await bobClient.request(`/api/orders/${order!._id}/verify`, {
      json: { razorpay_payment_id: "pay_fake", razorpay_order_id: order!.providerOrderId, razorpay_signature: "f".repeat(64) },
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe("INVALID_SIGNATURE");
    const foreign = await aliceClient.request(`/api/orders/${order!._id}/verify`, {
      json: { razorpay_payment_id: "pay_fake", razorpay_order_id: order!.providerOrderId, razorpay_signature: "f".repeat(64) },
    });
    expect(foreign.status).toBe(404);
  });
});

describe("account deletion", () => {
  it("requires the password and removes the account and its content", async () => {
    expect((await aliceClient.request("/api/me", { method: "DELETE", json: { confirmation: "DELETE", password: "wrong-pass1" } })).status).toBe(403);
    expect((await aliceClient.request("/api/me", { method: "DELETE", json: { confirmation: "nope", password: "N3wPassword!" } })).status).toBe(400);
    const res = await aliceClient.request("/api/me", { method: "DELETE", json: { confirmation: "DELETE", password: "N3wPassword!" } });
    expect(res.status).toBe(200);
    expect((await aliceClient.request("/api/me")).status).toBe(401);
    expect(await users().countDocuments({ email: alice.email })).toBe(0);
    expect((await newClient().request("/api/auth/login", { json: { email: alice.email, password: "N3wPassword!" } })).status).toBe(401);
  });
});
