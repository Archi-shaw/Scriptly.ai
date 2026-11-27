export interface AIRequest {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface AIResult {
  text: string;
  model: string;
  finishReason?: string;
  truncated: boolean;
  usage: { inputTokens?: number; outputTokens?: number };
  durationMs: number;
}

/** Implement this interface to plug in another model provider. */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generate(request: AIRequest): Promise<AIResult>;
}

export type AIErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_FAILED"
  | "AI_QUOTA_EXCEEDED"
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_PROVIDER_ERROR"
  | "AI_BAD_RESPONSE"
  | "AI_CONTENT_FILTERED"
  | "AI_INPUT_TOO_LONG";

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    /** HTTP status Scriptly returns to its own client. */
    public readonly status: number,
  ) {
    super(message);
    this.name = "AIError";
  }
}
