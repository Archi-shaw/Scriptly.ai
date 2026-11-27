"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import { Check, RefreshCw } from "lucide-react";
import SectionHeading from "@/app/components/Landing/SectionHeading";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PackagesResponse {
  packages: {
    id: string;
    name: string;
    description: string;
    credits: number;
    bonusCredits: number;
    totalCredits: number;
    priceMinor: number;
    currency: string;
    features: string[];
    isPopular: boolean;
  }[];
  signupBonus: number;
}

const creditGuide = [
  { credits: 1, label: "Caption, headline, tweet or tagline set" },
  { credits: 2, label: "Email, ad, product description" },
  { credits: "3–4", label: "Blog post, article or video script" },
];

/** Prices come from the live credit packages in the database (/api/packages). */
const PricingSection = () => {
  const { data, error, isLoading, mutate } = useSWR<PackagesResponse>("/api/packages");

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeading
        eyebrow="Pricing"
        title="Start free. Pay only for what you write."
        description="No subscriptions. Buy credits when you need them — they never expire."
      />

      {error ? (
        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-white/80">Pricing couldn&apos;t be loaded right now.</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
          >
            <RefreshCw className="size-4" aria-hidden /> Try again
          </button>
        </div>
      ) : (
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <PlanCard
            name="Free"
            price={formatMoney(0, data?.packages[0]?.currency ?? "INR")}
            caption="to get started"
            description="Everything you need to try Scriptly."
            features={[
              isLoading || !data ? "Free signup credits" : `${data.signupBonus} credits when you sign up`,
              "All templates & languages",
              "Editor, history & exports",
            ]}
            cta="Create free account"
          />
          {isLoading || !data
            ? Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-[420px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
              ))
            : data.packages.map((pkg) => (
                <PlanCard
                  key={pkg.id}
                  name={pkg.name}
                  price={formatMoney(pkg.priceMinor, pkg.currency)}
                  caption={`${formatNumber(pkg.totalCredits)} credits · ${formatMoney(Math.round(pkg.priceMinor / pkg.totalCredits), pkg.currency)}/credit`}
                  description={pkg.description}
                  features={pkg.features}
                  cta={`Get ${pkg.name}`}
                  highlighted={pkg.isPopular}
                />
              ))}
        </div>
      )}

      <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="mb-4 text-center text-sm font-semibold text-white">What does a credit buy?</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {creditGuide.map((row) => (
            <div key={row.label} className="rounded-xl bg-white/[0.03] p-4 text-center">
              <p className="text-2xl font-bold text-violet-300">{row.credits}</p>
              <p className="mt-1 text-sm text-white/65">{row.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-white/50">
          Editor actions such as improve, shorten or fix grammar cost 1 credit. Failed generations are refunded automatically.
        </p>
      </div>
    </div>
  );
};

function PlanCard({
  name,
  price,
  caption,
  description,
  features,
  cta,
  highlighted = false,
}: {
  name: string;
  price: string;
  caption: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl p-6 transition",
        highlighted
          ? "border-2 border-violet-400 bg-violet-950/40 shadow-2xl shadow-violet-900/40 lg:scale-[1.03]"
          : "border border-white/10 bg-white/[0.03]",
      )}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-3 py-1 text-xs font-semibold text-white">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="mt-1 min-h-10 text-sm text-white/60">{description}</p>
      <p className="mt-4 text-4xl font-bold tracking-tight text-white">{price}</p>
      <p className="mt-1 text-xs text-white/55">{caption}</p>
      <Link
        href="/signup"
        className={cn(
          "mt-6 rounded-lg px-4 py-3 text-center text-sm font-semibold transition",
          highlighted ? "bg-violet-600 text-white hover:bg-violet-500" : "bg-white/10 text-white hover:bg-white/15",
        )}
      >
        {cta}
      </Link>
      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-white/75">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PricingSection;
