"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";

/** Rendered when the session cookie is valid but was revoked server-side; clears it and returns to login. */
export default function SessionRevoked() {
  useEffect(() => {
    void signOut({ callbackUrl: "/login?reason=session-expired" });
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
      <span className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Signing you out…
      </span>
    </div>
  );
}
