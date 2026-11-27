import "server-only";
import type { OpenAIConfig } from "@/lib/config";
import { AIError, type AIProvider, type AIRequest, type AIResult } from "@/lib/ai/types";

type Capabilities = { noTemperature?: boolean; legacyMaxTokens?: boolean; noReasoningEffort?: boolean };

// Learned per model: some models reject optional parameters (e.g. reasoning
// models only accept the default temperature). We adapt once and remember.
const capabilities = new Map<string, Capabilities>();

interface OpenAIErrorBody {
  error?: { message?: string; type?: string; code?: string | null; param?: string | null };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/** Removes a code fence wrapping the whole answer (some models add one). */
function cleanOutput(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

function buildBody(config: OpenAIConfig, request: AIRequest, caps: Capabilities): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: "system", content: request.system },
      { role: "user", content: request.prompt },
    ],
  };
  body[caps.legacyMaxTokens ? "max_tokens" : "max_completion_tokens"] = request.maxOutputTokens;
  if (request.temperature !== undefined && !caps.noTemperature) body.temperature = request.temperature;
  if (config.reasoningEffort && !caps.noReasoningEffort) body.reasoning_effort = config.reasoningEffort;
  return body;
}

function mapHttpError(status: number, body: OpenAIErrorBody | null): AIError {
  const code = body?.error?.code ?? "";
  if (status === 401 || status === 403) {
    return new AIError("AI_AUTH_FAILED", "The AI service rejected the server's credentials. Please contact support.", 503);
  }
  if (status === 404) {
    return new AIError("AI_PROVIDER_ERROR", "The configured AI model is not available. Please contact support.", 503);
  }
  if (status === 429 && code === "insufficient_quota") {
    return new AIError("AI_QUOTA_EXCEEDED", "The AI service quota is exhausted. Please try again later.", 503);
  }
  if (status === 429) {
    return new AIError("AI_RATE_LIMITED", "The AI service is busy right now. Please try again in a moment.", 429);
  }
  if (status === 400 && (code === "context_length_exceeded" || /maximum context length/i.test(body?.error?.message ?? ""))) {
    return new AIError("AI_INPUT_TOO_LONG", "Your input is too long for the AI model. Please shorten it and try again.", 413);
  }
  if (status >= 500) {
    return new AIError("AI_PROVIDER_ERROR", "The AI service is temporarily unavailable. Please try again.", 502);
  }
  return new AIError("AI_PROVIDER_ERROR", "The AI service could not process this request.", 502);
}

export function createOpenAIProvider(config: OpenAIConfig, fetchImpl: typeof fetch = fetch): AIProvider {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new AIError(
      "AI_NOT_CONFIGURED",
      "AI generation is not configured on this server yet. Ask the administrator to set OPENAI_API_KEY.",
      503,
    );
  }

  return {
    name: "openai",
    model: config.model,
    async generate(request: AIRequest): Promise<AIResult> {
      const caps = capabilities.get(config.model) ?? {};
      let adaptations = 0;
      let retried = false;

      for (;;) {
        const body = buildBody(config, request, caps);
        const started = Date.now();
        const timeout = AbortSignal.timeout(config.timeoutMs);
        const signal = request.signal ? AbortSignal.any([timeout, request.signal]) : timeout;

        let response: Response;
        try {
          response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            signal,
          });
        } catch (error) {
          if (isAbortError(error)) {
            throw new AIError("AI_TIMEOUT", "The AI took too long to respond. Please try again.", 504);
          }
          if (!retried) {
            retried = true;
            await sleep(800);
            continue;
          }
          console.error("[ai:openai] network error:", error instanceof Error ? error.message : error);
          throw new AIError("AI_PROVIDER_ERROR", "Couldn't reach the AI service. Please try again.", 502);
        }

        if (!response.ok) {
          const errorBody = (await readJson(response)) as OpenAIErrorBody | null;
          const param = errorBody?.error?.param ?? "";
          const message = errorBody?.error?.message ?? "";

          if (response.status === 400 && adaptations < 3) {
            if ((param === "temperature" || /temperature/i.test(message)) && body.temperature !== undefined) {
              caps.noTemperature = true;
            } else if ((param === "max_completion_tokens" || /max_completion_tokens/.test(message)) && !caps.legacyMaxTokens) {
              caps.legacyMaxTokens = true;
            } else if ((param === "reasoning_effort" || /reasoning_effort/.test(message)) && body.reasoning_effort) {
              caps.noReasoningEffort = true;
            } else {
              console.error("[ai:openai] request rejected:", response.status, errorBody?.error?.code, message.slice(0, 300));
              throw mapHttpError(response.status, errorBody);
            }
            adaptations += 1;
            capabilities.set(config.model, caps);
            continue;
          }

          const retryAfter = Number(response.headers.get("retry-after") ?? "1");
          const transient =
            response.status >= 500 ||
            (response.status === 429 && errorBody?.error?.code !== "insufficient_quota" && retryAfter <= 5);
          if (transient && !retried) {
            retried = true;
            await sleep(response.status === 429 ? Math.max(1, retryAfter) * 1000 : 1000);
            continue;
          }
          console.error("[ai:openai] request failed:", response.status, errorBody?.error?.code, message.slice(0, 300));
          throw mapHttpError(response.status, errorBody);
        }

        const data = (await readJson(response)) as {
          model?: string;
          choices?: { message?: { content?: unknown; refusal?: unknown }; finish_reason?: string }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        } | null;

        const choice = data?.choices?.[0];
        if (!choice) {
          throw new AIError("AI_BAD_RESPONSE", "The AI service returned an unexpected response. Please try again.", 502);
        }
        if (choice.finish_reason === "content_filter" || (typeof choice.message?.refusal === "string" && choice.message.refusal)) {
          throw new AIError(
            "AI_CONTENT_FILTERED",
            "The AI declined to write this. Please rephrase your request and try again.",
            422,
          );
        }
        const text = typeof choice.message?.content === "string" ? cleanOutput(choice.message.content) : "";
        if (!text) {
          throw new AIError(
            "AI_BAD_RESPONSE",
            choice.finish_reason === "length"
              ? "The AI ran out of room before writing anything. Try a shorter length."
              : "The AI returned an empty response. Please try again.",
            502,
          );
        }

        return {
          text,
          model: data?.model ?? config.model,
          finishReason: choice.finish_reason,
          truncated: choice.finish_reason === "length",
          usage: { inputTokens: data?.usage?.prompt_tokens, outputTokens: data?.usage?.completion_tokens },
          durationMs: Date.now() - started,
        };
      }
    },
  };
}
