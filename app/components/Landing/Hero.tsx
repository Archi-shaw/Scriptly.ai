import React from "react";
import Link from "next/link";
import { ArrowRight, Check, Facebook, Globe, Sparkles, Target, Wand2 } from "lucide-react";
import { LANGUAGES } from "@/lib/templates/options";
import { TEMPLATES } from "@/lib/templates/registry";

const Hero = () => {
  return (
    <section className="relative px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <a
          href="#features"
          className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-100 transition hover:bg-violet-500/20 sm:text-sm"
        >
          <Sparkles className="size-4 text-violet-300" aria-hidden />
          AIDA, PAS &amp; BAB frameworks · {LANGUAGES.length}+ languages
        </a>

        <h1 className="animate-fade-up text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
          <span className="text-gradient">Generate content,</span>
          <br />
          <span className="text-gradient">copy &amp; scripts with AI</span>
        </h1>

        <p className="animate-fade-up mt-6 max-w-3xl text-lg leading-relaxed text-white/75 sm:text-xl">
          Scriptly.ai turns a few details into publish-ready blog posts, ads, emails, product descriptions and video
          scripts — in your tone, your language and your brand&apos;s voice. Then edit, refine and export in one place.
        </p>

        <div className="animate-fade-up mt-10 flex w-full flex-col justify-center gap-4 sm:w-auto sm:flex-row">
          <Link
            href="/signup"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-black shadow-xl shadow-violet-950/40 transition hover:-translate-y-0.5 hover:shadow-2xl"
          >
            Start creating
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <a
            href="#templates"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/40 px-8 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:border-violet-400/60 hover:bg-black/60"
          >
            Explore templates
          </a>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/65">
          {["Free credits when you sign up", "No credit card required", `${TEMPLATES.length} expert templates`].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="size-4 text-violet-300" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <ProductPreview />
    </section>
  );
};

/** Illustration of the generator workspace (static example). */
function ProductPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl" aria-label="Example of the Scriptly.ai writer" role="img">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-violet-600/20 blur-3xl" aria-hidden />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0a18]/90 text-left shadow-2xl shadow-black/60 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="size-3 rounded-full bg-white/15" />
          <span className="size-3 rounded-full bg-white/15" />
          <span className="size-3 rounded-full bg-white/15" />
          <span className="ml-3 rounded-md bg-white/5 px-3 py-1 text-xs text-white/50">scriptly.ai/write</span>
        </div>
        <div className="grid md:grid-cols-[300px_1fr]">
          <div className="space-y-4 border-b border-white/10 p-5 md:border-b-0 md:border-r">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-violet-500/15 text-violet-300">
                <Facebook className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Facebook Ad Copy</p>
                <p className="text-xs text-white/50">Advertising</p>
              </div>
            </div>
            <PreviewField label="Product" value="Lumen focus desk lamp" />
            <PreviewField label="Target audience" value="Remote workers & students" />
            <div className="flex flex-wrap gap-2">
              <PreviewChip icon={<Wand2 className="size-3" />} label="Persuasive" />
              <PreviewChip icon={<Globe className="size-3" />} label="English (US)" />
              <PreviewChip icon={<Target className="size-3" />} label="PAS" />
            </div>
            <div className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white">
              <Sparkles className="size-4" /> Generate · 2 credits
            </div>
          </div>
          <div className="p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">Generated</span>
              <span className="text-xs text-white/40">96 words</span>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-white/80">
              <p className="font-semibold text-white">Primary text</p>
              <p>
                <strong className="text-white">Squinting at your screen by 4 pm?</strong> Harsh overhead light quietly drains your
                focus — and your evenings pay the price.
              </p>
              <p>
                Lumen&apos;s glare-free, adaptive light follows the sun so your eyes stay fresh from the first call to the last
                deadline. One touch. Zero flicker.
              </p>
              <p>👉 Light your best work. Try Lumen risk-free for 30 days.</p>
              <p className="pt-1 font-semibold text-white">Headline</p>
              <p>Focus longer. Strain less.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {["Improve", "Shorten", "Change tone", "Export"].map((action) => (
                <span key={action} className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-white/60">
                  {action}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-white/50">{label}</p>
      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/85">{value}</p>
    </div>
  );
}

function PreviewChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70">
      {icon}
      {label}
    </span>
  );
}

export default Hero;
