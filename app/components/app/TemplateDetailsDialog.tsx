"use client";

import Link from "next/link";
import { Coins, ListChecks, Target, WandSparkles } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import TemplateIcon from "@/app/components/app/TemplateIcon";
import { FRAMEWORKS } from "@/lib/templates/options";
import { getCategory, getGenerationCost, type TemplateDefinition } from "@/lib/templates/registry";

const KIND_LABEL = { list: "Options / short list", short: "Short-form", medium: "Medium-form", long: "Long-form" } as const;

export default function TemplateDetailsDialog({
  template,
  open,
  onOpenChange,
}: {
  template: TemplateDefinition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!template) return null;
  const costs = (["short", "medium", "long"] as const).map((length) => ({
    length,
    label: template.lengthLabels?.[length] ?? length[0].toUpperCase() + length.slice(1),
    credits: getGenerationCost(template, length),
  }));
  const framework = template.fixedFramework ? FRAMEWORKS.find((f) => f.id === template.fixedFramework) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-violet-300">
              <TemplateIcon name={template.icon} className="size-5" />
            </span>
            <div className="text-left">
              <DialogTitle>{template.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">{getCategory(template.category)?.name}</p>
            </div>
          </div>
          <DialogDescription className="text-left">{template.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-2 flex items-center gap-2 font-medium">
              <ListChecks className="size-4 text-violet-300" aria-hidden /> What you&apos;ll provide
            </p>
            <ul className="space-y-1.5 text-muted-foreground">
              {template.fields.map((field) => (
                <li key={field.name} className="flex items-center justify-between gap-3">
                  <span>{field.label}</span>
                  <span className="text-xs">{field.required ? "Required" : "Optional"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{KIND_LABEL[template.kind]}</Badge>
            {framework ? (
              <Badge variant="secondary">
                <Target className="size-3" aria-hidden /> Uses {framework.label}
              </Badge>
            ) : template.supportsFramework ? (
              <Badge variant="secondary">
                <Target className="size-3" aria-hidden /> AIDA / PAS / BAB available
              </Badge>
            ) : null}
            <Badge variant="secondary">Any tone · 30+ languages</Badge>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 font-medium">
              <Coins className="size-4 text-violet-300" aria-hidden /> Credits per generation
            </p>
            <div className="grid grid-cols-3 gap-2">
              {costs.map((c) => (
                <div key={c.length} className="rounded-lg border border-border px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="font-semibold">{c.credits}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/write?template=${template.id}`}>
              <WandSparkles /> Use this template
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
