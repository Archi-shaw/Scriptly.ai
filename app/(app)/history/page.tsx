"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Copy, Eye, History as HistoryIcon, MoreHorizontal, PenLine, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { ConfirmDialog, EmptyState, ErrorState, PageContainer, PageHeader, Pagination, StatusBadge } from "@/app/components/app/primitives";
import TemplateIcon from "@/app/components/app/TemplateIcon";
import MarkdownPreview from "@/app/components/editor/MarkdownPreview";
import { useMe } from "@/app/hooks/use-me";
import { api, errorMessage, newRequestId } from "@/lib/client/api";
import { copyToClipboard } from "@/lib/client/export";
import { formatDateTime, formatNumber } from "@/lib/format";
import { findLanguage, findTone, REFINE_ACTIONS } from "@/lib/templates/options";
import { TEMPLATE_CATEGORIES, getGenerationCost, getTemplate } from "@/lib/templates/registry";
import type { SerializedGeneration } from "@/lib/serializers";

interface ListResponse {
  items: SerializedGeneration[];
  page: number;
  totalPages: number;
  total: number;
}

function canRegenerate(g: SerializedGeneration) {
  return g.kind === "generate" && Boolean(getTemplate(g.templateId));
}

function regenerateCost(g: SerializedGeneration) {
  const template = getTemplate(g.templateId);
  return template ? getGenerationCost(template, (g.length as "short" | "medium" | "long") ?? template.defaults.length) : 0;
}

export default function HistoryPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: me } = useMe();
  const [kind, setKind] = useState("generate");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<SerializedGeneration | null>(null);
  const [regenerating, setRegenerating] = useState<SerializedGeneration | null>(null);
  const [deleting, setDeleting] = useState<SerializedGeneration | null>(null);

  useEffect(() => setPage(1), [kind, status, category]);

  const params = new URLSearchParams({ kind, status, category, page: String(page), limit: "10" });
  const { data, error, isLoading, mutate: reload } = useSWR<ListResponse>(`/api/history?${params}`, { keepPreviousData: true });
  const { data: detail, isLoading: detailLoading } = useSWR<{ generation: SerializedGeneration }>(viewing ? `/api/history/${viewing.id}` : null);

  async function regenerate() {
    if (!regenerating) return;
    try {
      const response = await api<{ generation: SerializedGeneration }>("/api/generate", {
        body: {
          templateId: regenerating.templateId,
          inputs: regenerating.inputs,
          settings: {
            language: regenerating.language,
            tone: regenerating.tone ?? undefined,
            style: regenerating.style ?? undefined,
            length: regenerating.length ?? undefined,
            framework: regenerating.framework ?? undefined,
            creativity: regenerating.creativity ?? undefined,
            brandVoice: regenerating.brandVoice ?? undefined,
            instructions: regenerating.instructions ?? undefined,
          },
          requestId: newRequestId(),
        },
      });
      void mutate("/api/me");
      setRegenerating(null);
      toast.success("New version generated");
      router.push(`/write?template=${response.generation.templateId}&generation=${response.generation.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Regeneration failed."));
      void mutate("/api/me");
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api(`/api/history/${deleting.id}`, { method: "DELETE" });
      toast.success("Removed from history");
      setDeleting(null);
      if (data && data.items.length === 1 && page > 1) setPage(page - 1);
      void reload();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't remove this item."));
    }
  }

  const shown = detail?.generation ?? viewing;

  return (
    <PageContainer>
      <PageHeader
        title="History"
        description="Every generation and AI edit, with the inputs used. Reopen, regenerate or copy past results."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-10 w-full" aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="generate">Generations</SelectItem>
            <SelectItem value="refine">Editor AI actions</SelectItem>
            <SelectItem value="all">Everything</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-10 w-full" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {TEMPLATE_CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message={errorMessage(error, "We couldn't load your history.")} onRetry={() => reload()} />
      ) : isLoading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={kind === "refine" ? "No editor AI actions yet" : "Nothing here yet"}
          description="Your generations appear here automatically, so you can always come back to them."
          action={
            <Button asChild>
              <Link href="/templates">Generate something</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className={`space-y-3 transition-opacity ${isLoading ? "opacity-60" : ""}`}>
            {data?.items.map((g) => {
              const template = getTemplate(g.templateId);
              const actionLabel = g.action ? REFINE_ACTIONS.find((a) => a.id === g.action)?.label : null;
              return (
                <li key={g.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-violet-300">
                      <TemplateIcon name={template?.icon ?? "PenLine"} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{g.kind === "refine" ? `Editor · ${actionLabel ?? g.action}` : g.templateName}</h2>
                        <StatusBadge status={g.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(g.createdAt)} · {findLanguage(g.language)?.label ?? g.language}
                        {g.tone && ` · ${findTone(g.tone)?.label ?? g.tone}`}
                        {g.creditsUsed > 0 && ` · ${g.creditsUsed} credit${g.creditsUsed === 1 ? "" : "s"}`}
                        {g.creditsRefunded > 0 && " (refunded)"}
                        {g.wordCount > 0 && ` · ${formatNumber(g.wordCount)} words`}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {g.status === "completed" ? g.preview : g.errorMessage ?? "This generation did not complete."}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {g.status === "completed" && (
                        <Button variant="ghost" size="sm" onClick={() => setViewing(g)} className="hidden sm:inline-flex">
                          <Eye aria-hidden /> View
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label="History item actions">
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {g.status === "completed" && (
                            <DropdownMenuItem onSelect={() => setViewing(g)}>
                              <Eye aria-hidden /> View result
                            </DropdownMenuItem>
                          )}
                          {g.kind === "generate" && (
                            <DropdownMenuItem asChild>
                              <Link href={`/write?template=${g.templateId}&generation=${g.id}`}>
                                <PenLine aria-hidden /> Open in editor
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {canRegenerate(g) && (
                            <DropdownMenuItem onSelect={() => setRegenerating(g)} disabled={!me?.features.ai}>
                              <RefreshCw aria-hidden /> Regenerate ({regenerateCost(g)} cr)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(g)}>
                            <Trash2 aria-hidden /> Remove from history
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{shown?.kind === "refine" ? "Editor AI result" : shown?.templateName}</DialogTitle>
            <DialogDescription>{shown ? formatDateTime(shown.createdAt) : ""}</DialogDescription>
          </DialogHeader>
          {shown && Object.keys(shown.inputs ?? {}).length > 0 && shown.kind === "generate" && (
            <dl className="grid gap-2 rounded-xl bg-muted p-4 text-sm">
              {Object.entries(shown.inputs).map(([key, value]) => {
                const label = getTemplate(shown.templateId)?.fields.find((f) => f.name === key)?.label ?? key;
                return (
                  <div key={key} className="grid gap-1 sm:grid-cols-[160px_1fr]">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="whitespace-pre-wrap break-words">{value}</dd>
                  </div>
                );
              })}
            </dl>
          )}
          {detailLoading || !detail ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <div className="rounded-xl border border-border p-4">
              <MarkdownPreview content={detail.generation.output ?? ""} />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={!detail}
              onClick={async () => {
                try {
                  await copyToClipboard(detail?.generation.output ?? "");
                  toast.success("Copied to clipboard");
                } catch {
                  toast.error("Couldn't copy.");
                }
              }}
            >
              <Copy aria-hidden /> Copy
            </Button>
            {shown?.kind === "generate" && (
              <Button asChild>
                <Link href={`/write?template=${shown.templateId}&generation=${shown.id}`}>
                  <PenLine aria-hidden /> Open in editor
                </Link>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={regenerating !== null}
        onOpenChange={(open) => !open && setRegenerating(null)}
        title="Regenerate this content?"
        description={
          regenerating
            ? `Scriptly will run “${regenerating.templateName}” again with the same inputs and settings. This uses ${regenerateCost(regenerating)} credit${regenerateCost(regenerating) === 1 ? "" : "s"} (you have ${me?.user.credits ?? 0}).`
            : ""
        }
        confirmLabel="Regenerate"
        onConfirm={regenerate}
      >
        {regenerating && (me?.user.credits ?? 0) < regenerateCost(regenerating) && (
          <p className="text-sm text-amber-200">
            You don&apos;t have enough credits.{" "}
            <Link href="/billing" className="underline">
              Buy credits
            </Link>
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove from history?"
        description="This removes the item from your history. Saved documents are not affected, and credits are not returned."
        confirmLabel="Remove"
        destructive
        onConfirm={remove}
      />
    </PageContainer>
  );
}
