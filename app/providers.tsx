"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { Toaster } from "@/app/components/ui/sonner";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { fetcher } from "@/lib/client/api";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus>
      <SWRConfig value={{ fetcher, revalidateOnFocus: true, shouldRetryOnError: false, dedupingInterval: 2000 }}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="top-right" />
        </TooltipProvider>
      </SWRConfig>
    </SessionProvider>
  );
}
