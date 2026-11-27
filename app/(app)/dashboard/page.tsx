"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, Coins, FileText, History, PartyPopper, Sparkles, TriangleAlert, Type, WandSparkles } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { EmptyState, ErrorState, PageContainer, PageHeader, StatusBadge } from "@/app/components/app/primitives";
import TemplateIcon from "@/app/components/app/TemplateIcon";
import UsageChart, { type UsagePoint } from "@/app/components/app/UsageChart";
import { useMe } from "@/app/hooks/use-me";
import { errorMessage } from "@/lib/client/api";
import { formatNumber, formatRelative } from "@/lib/format";
import { TEMPLATES, getTemplate } from "@/lib/templates/registry";
import type { SerializedDocument, SerializedGeneration, SerializedTransaction } from "@/lib/serializers";
import { cn } from "@/lib/utils";

interface DashboardResponse {
  stats: { credits: number; creditsUsed: number; documents: number; generations: number; words: number };
  recentGenerations: SerializedGeneration[];
  recentDocuments: SerializedDocument[];
  recentActivity: SerializedTransaction[];
  usage: UsagePoint[];
  topTemplates: { templateId: string; count: number }[];
}

function compact(value: number): string {
  return value >= 10_000 ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value) : formatNumber(value);
}

function StatTile({
  label,
  value,
  icon: Icon,
  footer,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-violet-300" aria-hidden />
      </div>
      {value === undefined ? <Skeleton className="mt-3 h-8 w-20" /> : <p className="mt-2 text-3xl font-semibold tracking-tight">{compact(value)}</p>}
      {footer && <div className="mt-2 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

function Card({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const { data: me } = useMe();
  const { data, error, isLoading, mutate } = useSWR<DashboardResponse>("/api/dashboard");
  const firstName = me?.user.name.split(" ")[0] ?? "there";

  const quickStart = (() => {
    const used = (data?.topTemplates ?? []).map((t) => getTemplate(t.templateId)).filter(Boolean);
    const popular = TEMPLATES.filter((t) => t.popular);
    const merged = [...used, ...popular].filter((t, i, all) => t && all.findIndex((x) => x?.id === t.id) === i);
    return merged.slice(0, 6) as typeof TEMPLATES;
  })();

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's what's happening in your workspace."
        actions={
          <Button asChild>
            <Link href="/write">
              <WandSparkles /> Start writing
            </Link>
          </Button>
        }
      />

      {welcome && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-violet-400/30 bg-violet-500/10 p-5 sm:flex-row sm:items-center">
          <PartyPopper className="size-6 shrink-0 text-violet-300" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Your account is ready!</p>
            <p className="text-sm text-muted-foreground">
              You have {formatNumber(me?.user.credits ?? 0)} free credits. Pick a template below to create your first piece of content.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/templates">Browse templates</Link>
          </Button>
        </div>
      )}

      {me && !me.features.ai && (
        <div role="status" className="mb-6 flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <TriangleAlert className="size-5 shrink-0 text-amber-300" aria-hidden />
          <p>
            AI generation isn&apos;t configured on this server yet, so generating is disabled. An administrator needs to set{" "}
            <code className="rounded bg-black/30 px-1">OPENAI_API_KEY</code>. Your documents and history are still available.
          </p>
        </div>
      )}

      {error ? (
        <ErrorState message={errorMessage(error, "We couldn't load your dashboard.")} onRetry={() => mutate()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Credits available"
              value={data?.stats.credits ?? me?.user.credits}
              icon={Coins}
              footer={
                <Link href="/billing" className="font-medium text-violet-300 hover:underline">
                  Buy credits →
                </Link>
              }
            />
            <StatTile label="Documents" value={data?.stats.documents} icon={FileText} footer="Saved in My Documents" />
            <StatTile label="Generations" value={data?.stats.generations} icon={Sparkles} footer="Completed with templates" />
            <StatTile label="Words generated" value={data?.stats.words} icon={Type} footer={`${formatNumber(data?.stats.creditsUsed ?? 0)} credits used`} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="rounded-2xl border border-border bg-card p-5">
                {isLoading || !data ? <Skeleton className="h-60 w-full" /> : <UsageChart data={data.usage} />}
              </section>

              <Card
                title="Recent generations"
                action={
                  <Link href="/history" className="text-xs font-medium text-violet-300 hover:underline">
                    View history
                  </Link>
                }
              >
                {isLoading || !data ? (
                  <ListSkeleton />
                ) : data.recentGenerations.length === 0 ? (
                  <EmptyState
                    icon={Sparkles}
                    title="No generations yet"
                    description="Pick a template, add a few details and generate your first piece of content."
                    action={
                      <Button asChild size="sm">
                        <Link href="/templates">Browse templates</Link>
                      </Button>
                    }
                    className="py-10"
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recentGenerations.map((g) => (
                      <li key={g.id}>
                        <Link href={`/write?generation=${g.id}`} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition hover:bg-accent/50">
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-violet-300">
                            <TemplateIcon name={getTemplate(g.templateId)?.icon ?? "Sparkles"} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{g.templateName}</span>
                              {g.status !== "completed" && <StatusBadge status={g.status} />}
                            </span>
                            <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">
                              {g.preview || g.errorMessage || "No output"}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(g.createdAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card
                title="Quick start"
                action={
                  <Link href="/templates" className="text-xs font-medium text-violet-300 hover:underline">
                    All templates
                  </Link>
                }
              >
                <div className="grid gap-2">
                  {quickStart.map((t) => (
                    <Link
                      key={t.id}
                      href={`/write?template=${t.id}`}
                      className="group flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition hover:border-violet-400/40 hover:bg-accent/40"
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-violet-300">
                        <TemplateIcon name={t.icon} />
                      </span>
                      <span className="flex-1 text-sm font-medium">{t.name}</span>
                      <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
                    </Link>
                  ))}
                </div>
              </Card>

              <Card
                title="Recent activity"
                action={
                  <Link href="/billing" className="text-xs font-medium text-violet-300 hover:underline">
                    Credit history
                  </Link>
                }
              >
                {isLoading || !data ? (
                  <ListSkeleton rows={3} />
                ) : data.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No credit activity yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.recentActivity.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate">{t.description}</span>
                          <span className="text-xs text-muted-foreground">{formatRelative(t.createdAt)}</span>
                        </span>
                        <span className={cn("shrink-0 font-medium tabular-nums", t.amount > 0 ? "text-emerald-300" : "text-foreground")}>
                          {t.amount > 0 ? "+" : "−"}
                          {formatNumber(Math.abs(t.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card
                title="Recent documents"
                action={
                  <Link href="/documents" className="text-xs font-medium text-violet-300 hover:underline">
                    My Documents
                  </Link>
                }
              >
                {isLoading || !data ? (
                  <ListSkeleton rows={3} />
                ) : data.recentDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Documents you save will appear here.</p>
                ) : (
                  <ul className="space-y-1">
                    {data.recentDocuments.map((d) => (
                      <li key={d.id}>
                        <Link href={`/documents/${d.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-accent/50">
                          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-sm">{d.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(d.updatedAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <History className="size-3.5" aria-hidden /> Usage is shown in UTC days.
      </p>
    </PageContainer>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
