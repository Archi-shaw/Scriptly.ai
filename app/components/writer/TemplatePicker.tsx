"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import TemplateIcon from "@/app/components/app/TemplateIcon";
import { TEMPLATE_CATEGORIES, searchTemplates } from "@/lib/templates/registry";
import { cn } from "@/lib/utils";

export default function TemplatePicker({
  open,
  onOpenChange,
  currentId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentId: string;
  onSelect: (templateId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchTemplates(query), [query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border p-5 pb-4">
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>Search by name, format or use case.</DialogDescription>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates…" className="h-10 pl-9" autoFocus aria-label="Search templates" />
          </div>
        </DialogHeader>
        <div className="overflow-y-auto p-3">
          {results.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">No templates match “{query}”.</p>
          ) : (
            TEMPLATE_CATEGORIES.map((category) => {
              const items = results.filter((t) => t.category === category.id);
              if (items.length === 0) return null;
              return (
                <div key={category.id} className="mb-3">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.name}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onSelect(t.id);
                          onOpenChange(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-accent",
                          t.id === currentId && "bg-primary/15 ring-1 ring-violet-400/40",
                        )}
                      >
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-violet-300">
                          <TemplateIcon name={t.icon} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{t.name}</span>
                          <span className="line-clamp-2 block text-xs text-muted-foreground">{t.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
