"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Search, SearchX, X } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { EmptyState, PageContainer, PageHeader } from "@/app/components/app/primitives";
import TemplateIcon from "@/app/components/app/TemplateIcon";
import TemplateDetailsDialog from "@/app/components/app/TemplateDetailsDialog";
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  getCategory,
  getGenerationCost,
  searchTemplates,
  type TemplateDefinition,
} from "@/lib/templates/registry";
import { cn } from "@/lib/utils";

function TemplatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const category = searchParams.get("category") ?? "all";
  const [details, setDetails] = useState<TemplateDefinition | null>(null);

  const results = useMemo(() => searchTemplates(query, category), [query, category]);

  function setCategory(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("category");
    else params.set("category", next);
    router.replace(`/templates${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  return (
    <PageContainer>
      <PageHeader
        title="Templates"
        description={`${TEMPLATES.length} templates across ${TEMPLATE_CATEGORIES.length} categories. Each one is tuned for its format.`}
      />

      <div className="relative mb-4 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates — e.g. “email”, “youtube”, “product”"
          className="h-11 pl-10 pr-10"
          aria-label="Search templates"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <div className="flex w-max gap-2" role="group" aria-label="Filter by category">
          {[{ id: "all", name: "All" }, ...TEMPLATE_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={cn(
                "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition",
                category === c.id
                  ? "border-violet-400/60 bg-primary/20 text-foreground"
                  : "border-border text-muted-foreground hover:border-violet-400/30 hover:text-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {results.length} template{results.length === 1 ? "" : "s"}
        {category !== "all" && ` in ${getCategory(category)?.name ?? category}`}
        {query && ` matching “${query}”`}
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No templates found"
          description="Try a different search term or category — or describe exactly what you need with the free-form AI Writer."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Clear filters
              </Button>
              <Button asChild>
                <Link href="/write?template=ai-writer">Open AI Writer</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((t) => (
            <div
              key={t.id}
              className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-violet-400/40"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-violet-300">
                  <TemplateIcon name={t.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold leading-snug">
                    <Link href={`/write?template=${t.id}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring">
                      {t.name}
                    </Link>
                  </h3>
                  <p className="text-xs text-muted-foreground">{getCategory(t.category)?.name}</p>
                </div>
                {t.popular && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">Popular</span>}
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{t.description}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {getGenerationCost(t, "short") === getGenerationCost(t, "long")
                    ? `${getGenerationCost(t, "short")} credit${getGenerationCost(t, "short") === 1 ? "" : "s"}`
                    : `${getGenerationCost(t, "short")}–${getGenerationCost(t, "long")} credits`}
                </span>
                <button
                  type="button"
                  onClick={() => setDetails(t)}
                  className="relative z-10 inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-violet-300 hover:bg-accent"
                >
                  <Info className="size-3.5" aria-hidden /> Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateDetailsDialog template={details} open={details !== null} onOpenChange={(open) => !open && setDetails(null)} />
    </PageContainer>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesContent />
    </Suspense>
  );
}
