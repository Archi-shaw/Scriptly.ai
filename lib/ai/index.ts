import "server-only";
import { getOpenAIConfig } from "@/lib/config";
import { createOpenAIProvider } from "@/lib/ai/openai";
import { AIError, type AIProvider } from "@/lib/ai/types";

/**
 * Returns the configured AI provider. To add another provider, implement
 * `AIProvider` and select it here via the AI_PROVIDER environment variable.
 */
export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? "openai").trim().toLowerCase();
  switch (provider) {
    case "openai":
      return createOpenAIProvider(getOpenAIConfig());
    default:
      throw new AIError("AI_NOT_CONFIGURED", `Unsupported AI_PROVIDER "${provider}".`, 503);
  }
}

export function isAIConfigured(): boolean {
  try {
    getAIProvider();
    return true;
  } catch {
    return false;
  }
}

export { AIError };
