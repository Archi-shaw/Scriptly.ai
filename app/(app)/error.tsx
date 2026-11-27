"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/app/components/ui/button";

/** Keeps the sidebar/header usable when a workspace page crashes. */
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-destructive/15 text-red-300">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">This page hit a problem</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something unexpected happened. Your documents and credits are safe — try again or go back to the dashboard.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCw aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
