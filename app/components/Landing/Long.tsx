import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";

const benefits = [
  "Go from a one-line idea to a structured 1,000+ word draft",
  "Generate titles, outlines, intros, sections or conclusions on their own",
  "Keep a consistent brand voice with saved brand details",
  "Refine any paragraph: improve, expand, shorten or fix grammar",
];

const LongForm = () => {
  return (
    <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
      <div className="rounded-2xl bg-white p-4 shadow-2xl shadow-black/40" aria-hidden>
        <div className="mb-4 rounded-xl bg-gray-100 p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-700">Blog post · Conversational</p>
          <h4 className="mb-3 text-lg font-bold text-gray-900">How to build a content calendar that actually works</h4>
          <p className="mb-4 text-sm leading-relaxed text-gray-700">
            Most content calendars fail for the same reason: they plan topics, not outcomes. Before you fill a single
            cell, decide what each piece should do for your reader — and for your business.
          </p>
          <h5 className="mb-2 font-semibold text-gray-900">1. Start from your audience&apos;s questions</h5>
          <p className="mb-4 text-sm leading-relaxed text-gray-700">
            Collect the questions customers ask in sales calls, support tickets and comments. Each one is a ready-made
            topic with built-in demand.
          </p>
          <h5 className="mb-2 font-semibold text-gray-900">2. Batch by theme, not by date</h5>
          <p className="text-sm leading-relaxed text-gray-700">
            Group related pieces into monthly themes so every post supports the next…
          </p>
        </div>
        <div className="flex gap-3">
          <span className="rounded-lg bg-[#4D2C7D] px-5 py-2.5 text-sm font-semibold text-white">Generate</span>
          <span className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700">Continue writing</span>
        </div>
      </div>

      <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Why write with AI</p>
        <h2 className="text-gradient mb-6 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Long-form AI content writer</h2>
        <p className="mb-6 max-w-xl text-lg leading-relaxed text-white/75">
          Turn a short description into a complete, well-structured article. Scriptly plans the structure, writes every
          section in your tone and language, and hands you an editable draft — so you spend your time on ideas, not on
          the blank page.
        </p>
        <ul className="mb-8 space-y-3 text-left">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-white/80">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-violet-500/20">
                <Check className="size-3.5 text-violet-300" aria-hidden />
              </span>
              {benefit}
            </li>
          ))}
        </ul>
        <Link
          href="/signup"
          className="rounded-xl bg-white px-8 py-4 text-lg font-semibold text-black shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          Get started for free
        </Link>
      </div>
    </div>
  );
};

export default LongForm;
