import React from "react";
import { FileStack, Globe, Layers, ShieldCheck, SlidersHorizontal, Target, Wallet, WandSparkles } from "lucide-react";
import SectionHeading from "@/app/components/Landing/SectionHeading";
import { LANGUAGES, TONES } from "@/lib/templates/options";
import { TEMPLATES } from "@/lib/templates/registry";

const features = [
  {
    title: `${TEMPLATES.length} expert templates`,
    text: "Purpose-built prompts for blogs, SEO, social, ads, email, e-commerce, websites, business docs and video.",
    icon: Layers,
  },
  {
    title: "Copywriting frameworks",
    text: "Structure persuasive copy with AIDA, PAS or BAB — the frameworks professional copywriters rely on.",
    icon: Target,
  },
  {
    title: `${LANGUAGES.length}+ languages`,
    text: "Write natively in Spanish, Hindi, Japanese, Arabic and more — not just translated after the fact.",
    icon: Globe,
  },
  {
    title: "Tone & style control",
    text: `${TONES.length} tones, writing styles, creativity levels and length settings for exactly the copy you need.`,
    icon: SlidersHorizontal,
  },
  {
    title: "AI-powered editor",
    text: "Improve, expand, shorten, rewrite, change tone, fix grammar, continue writing or get alternative versions.",
    icon: WandSparkles,
  },
  {
    title: "Save, organise & export",
    text: "Keep every draft in My Documents and History, then export to Markdown, Word, HTML, text or PDF.",
    icon: FileStack,
  },
  {
    title: "Pay only for what you use",
    text: "Simple credits that never expire. Start free, top up when you need more — no subscription.",
    icon: Wallet,
  },
  {
    title: "Secure by design",
    text: "Email verification on signup and a one-time code on every sign-in keep your account and work protected.",
    icon: ShieldCheck,
  },
];

const Features = () => {
  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeading
        eyebrow="Everything you need to write faster"
        title="Write unique, human-like copy in seconds"
        description="Scriptly combines expert prompt engineering with leading language models, so every template produces content that fits its format."
      />
      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ title, text, icon: Icon }) => (
          <div
            key={title}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-violet-400/40 hover:bg-white/[0.06]"
          >
            <div className="mb-4 grid size-11 place-items-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20 transition group-hover:bg-violet-500/25">
              <Icon className="size-5" aria-hidden />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-white/65">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Features;
