"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionHeading from "@/app/components/Landing/SectionHeading";
import TemplateIcon from "@/app/components/app/TemplateIcon";
import { TEMPLATES, TEMPLATE_CATEGORIES, templatesInCategory, type TemplateCategoryId } from "@/lib/templates/registry";
import { cn } from "@/lib/utils";

export default function TemplateShowcase() {
  const [active, setActive] = useState<TemplateCategoryId>("blog");
  const templates = templatesInCategory(active);

  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeading
        eyebrow="Template library"
        title={`${TEMPLATES.length} templates for every format`}
        description="Each template has its own inputs and expert instructions, so a product description reads like a product description — and a YouTube script sounds like one."
      />

      <div className="mt-12 -mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" role="tablist" aria-label="Template categories">
        <div className="mx-auto flex w-max gap-2">
          {TEMPLATE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={active === category.id}
              onClick={() => setActive(category.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition",
                active === category.id
                  ? "border-violet-400/60 bg-violet-500/20 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white",
              )}
            >
              <TemplateIcon name={category.icon} className="size-4" />
              {category.name}
              <span className="text-xs text-white/45">{templatesInCategory(category.id).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="tabpanel">
        {templates.map((template) => (
          <Link
            key={template.id}
            href={`/write?template=${template.id}`}
            className="group flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-white/[0.06]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
              <TemplateIcon name={template.icon} className="size-5" />
            </span>
            <span>
              <span className="flex items-center gap-2 font-semibold text-white">
                {template.name}
                {template.popular && (
                  <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                    Popular
                  </span>
                )}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-white/60">{template.description}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-violet-400/60 hover:bg-white/5"
        >
          Browse all templates
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
