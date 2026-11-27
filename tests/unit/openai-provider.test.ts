import { describe, expect, it, vi } from "vitest";
import { createOpenAIProvider } from "@/lib/ai/openai";
import { getAIProvider } from "@/lib/ai";
import { AIError } from "@/lib/ai/types";

const config = { apiKey: "sk-test", model: "test-model", baseUrl: "https://api.example/v1", timeoutMs: 5_000 };
const request = { system: "sys", prompt: "write", maxOutputTokens: 500, temperature: 0.7 };

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

const completion = (content: string, finish = "stop") => ({
  model: "test-model-2026",
  choices: [{ message: { content }, finish_reason: finish }],
  usage: { prompt_tokens: 10, completion_tokens: 20 },
});

describe("OpenAI provider", () => {
  it("refuses to start without an API key (clear configuration error)", () => {
    expect(() => createOpenAIProvider({ ...config, apiKey: undefined })).toThrowError(AIError);
    try {
      createOpenAIProvider({ ...config, apiKey: undefined });
    } catch (error) {
      expect((error as AIError).code).toBe("AI_NOT_CONFIGURED");
      expect((error as AIError).status).toBe(503);
    }
    delete process.env.OPENAI_API_KEY;
    expect(() => getAIProvider()).toThrowError(/OPENAI_API_KEY/);
  });

  it("sends a chat completion request server-side and returns cleaned text + usage", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, completion("```markdown\n# Title\n\nBody\n```")));
    const provider = createOpenAIProvider(config, fetchMock as unknown as typeof fetch);
    const result = await provider.generate(request);
    expect(result.text).toBe("# Title\n\nBody");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(result.model).toBe("test-model-2026");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body));
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.max_completion_tokens).toBe(500);
    expect(body.temperature).toBe(0.7);
  });

  it("adapts when a model rejects the temperature parameter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(400, { error: { message: "Unsupported value: 'temperature'", param: "temperature", code: "unsupported_value" } }))
      .mockResolvedValueOnce(jsonResponse(200, completion("ok")));
    const provider = createOpenAIProvider({ ...config, model: "reasoning-model" }, fetchMock as unknown as typeof fetch);
    expect((await provider.generate(request)).text).toBe("ok");
    expect(JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body)).temperature).toBeUndefined();
  });

  it("defaults to a supported model with reasoning disabled, configurable via env", async () => {
    const { getOpenAIConfig } = await import("@/lib/config");
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_REASONING_EFFORT;
    expect(getOpenAIConfig()).toMatchObject({ model: "gpt-6-luna", reasoningEffort: "none", baseUrl: "https://api.openai.com/v1" });
    process.env.OPENAI_REASONING_EFFORT = "auto";
    expect(getOpenAIConfig().reasoningEffort).toBeUndefined();
    process.env.OPENAI_REASONING_EFFORT = "low";
    process.env.OPENAI_MODEL = "my-model";
    expect(getOpenAIConfig()).toMatchObject({ model: "my-model", reasoningEffort: "low" });
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_REASONING_EFFORT;
  });

  it("drops reasoning_effort for models that reject it (e.g. older non-reasoning models)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(400, { error: { message: "Unrecognized request argument supplied: reasoning_effort", param: "reasoning_effort", code: "unsupported_parameter" } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, completion("ok")));
    const provider = createOpenAIProvider({ ...config, model: "legacy-model", reasoningEffort: "none" }, fetchMock as unknown as typeof fetch);
    expect((await provider.generate(request)).text).toBe("ok");
    const first = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    const second = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(first.reasoning_effort).toBe("none");
    expect(second.reasoning_effort).toBeUndefined();
  });

  it("retries a transient 5xx once, then succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(503, { error: { message: "overloaded" } })).mockResolvedValueOnce(jsonResponse(200, completion("ok")));
    const provider = createOpenAIProvider(config, fetchMock as unknown as typeof fetch);
    expect((await provider.generate(request)).text).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps provider failures to safe, specific errors", async () => {
    const cases: [Response, string, number][] = [
      [jsonResponse(401, { error: { message: "bad key" } }), "AI_AUTH_FAILED", 503],
      [jsonResponse(429, { error: { message: "quota", code: "insufficient_quota" } }), "AI_QUOTA_EXCEEDED", 503],
      [jsonResponse(429, { error: { message: "slow down" } }, { "retry-after": "60" }), "AI_RATE_LIMITED", 429],
      [jsonResponse(400, { error: { message: "too long", code: "context_length_exceeded" } }), "AI_INPUT_TOO_LONG", 413],
      [jsonResponse(404, { error: { message: "no model" } }), "AI_PROVIDER_ERROR", 503],
    ];
    for (const [response, code, status] of cases) {
      const provider = createOpenAIProvider(config, vi.fn(async () => response.clone()) as unknown as typeof fetch);
      await expect(provider.generate(request)).rejects.toMatchObject({ code, status });
    }
  });

  it("gives up after a second 5xx", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(500, { error: { message: "boom" } }));
    const provider = createOpenAIProvider(config, fetchMock as unknown as typeof fetch);
    await expect(provider.generate(request)).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR", status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects empty, malformed and filtered responses", async () => {
    const cases: [unknown, string][] = [
      [completion(""), "AI_BAD_RESPONSE"],
      [{ choices: [] }, "AI_BAD_RESPONSE"],
      [completion("partial", "content_filter"), "AI_CONTENT_FILTERED"],
      [{ choices: [{ message: { content: null, refusal: "I can't help with that" }, finish_reason: "stop" }] }, "AI_CONTENT_FILTERED"],
    ];
    for (const [body, code] of cases) {
      const provider = createOpenAIProvider(config, vi.fn(async () => jsonResponse(200, body)) as unknown as typeof fetch);
      await expect(provider.generate(request)).rejects.toMatchObject({ code });
    }
  });

  it("reports timeouts without retrying", async () => {
    const fetchMock = vi.fn(async () => {
      throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    });
    const provider = createOpenAIProvider(config, fetchMock as unknown as typeof fetch);
    await expect(provider.generate(request)).rejects.toMatchObject({ code: "AI_TIMEOUT", status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("flags truncated output", async () => {
    const provider = createOpenAIProvider(config, vi.fn(async () => jsonResponse(200, completion("half", "length"))) as unknown as typeof fetch);
    expect((await provider.generate(request)).truncated).toBe(true);
  });
});
