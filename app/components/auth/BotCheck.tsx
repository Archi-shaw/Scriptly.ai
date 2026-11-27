"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget for the auth forms. The site key comes from the
 * server at request time (see app/(auth)/layout.tsx); without one, nothing is
 * rendered and forms submit as usual. Tokens are single-use, so callers reset
 * the widget after every submission.
 */

interface TurnstileRenderOptions {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

const SiteKeyContext = createContext<string | null>(null);

export function BotCheckProvider({ siteKey, children }: { siteKey: string | null; children: React.ReactNode }) {
  return <SiteKeyContext.Provider value={siteKey}>{children}</SiteKeyContext.Provider>;
}

function TurnstileWidget({
  siteKey,
  action,
  onToken,
  resetSignal,
}: {
  siteKey: string;
  action: string;
  onToken: (token: string | null) => void;
  resetSignal: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          theme: "dark",
          size: "flexible",
          callback: (token) => {
            setError(null);
            onToken(token);
          },
          "expired-callback": () => onToken(null),
          "error-callback": () => {
            onToken(null);
            setError("The security check couldn't complete. It will retry automatically — or refresh the page.");
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError("The security check couldn't load. Check your connection or disable content blockers, then refresh.");
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, action, onToken]);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [resetSignal]);

  return (
    <div>
      <div ref={container} className="min-h-[65px]" data-testid="bot-check" />
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export interface BotCheck {
  /** Turnstile is configured for this deployment. */
  enabled: boolean;
  /** A token is available (always true when Turnstile is off). */
  ready: boolean;
  /** Send this with the form (undefined when Turnstile is off). */
  token: string | undefined;
  /** Discard the used token and get a fresh one. */
  reset: () => void;
  /** The widget to render inside the form (null when Turnstile is off). */
  widget: React.ReactNode;
}

export function useBotCheck(action: "signup" | "login" | "forgot_password"): BotCheck {
  const siteKey = useContext(SiteKeyContext);
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const reset = useCallback(() => {
    setToken(null);
    setResetSignal((n) => n + 1);
  }, []);

  return {
    enabled: Boolean(siteKey),
    ready: !siteKey || Boolean(token),
    token: token ?? undefined,
    reset,
    widget: siteKey ? <TurnstileWidget siteKey={siteKey} action={action} onToken={setToken} resetSignal={resetSignal} /> : null,
  };
}
