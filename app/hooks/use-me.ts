"use client";

import useSWR from "swr";
import type { SerializedUser } from "@/lib/auth/session";
import type { FeatureFlags } from "@/lib/features";

export interface MeResponse {
  user: SerializedUser;
  features: FeatureFlags;
}

/** Current user + feature flags. Seeded by the (app) layout, revalidated on focus and after mutations. */
export function useMe() {
  return useSWR<MeResponse>("/api/me");
}
