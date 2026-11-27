"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export default function GlobalSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-destructive/15 text-red-300">
          <TriangleAlert className="size-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error stopped this page from loading. Your saved work is safe. Please try again.
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>
            <RefreshCw aria-hidden /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
