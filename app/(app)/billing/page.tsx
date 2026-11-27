"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Check, Coins, CreditCard, Info, Loader2, Receipt, ShieldCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { EmptyState, ErrorState, PageContainer, PageHeader, Pagination } from "@/app/components/app/primitives";
import { useMe } from "@/app/hooks/use-me";
import { api, errorMessage } from "@/lib/client/api";
import { loadRazorpay, openRazorpay, type RazorpaySuccess } from "@/lib/client/razorpay";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { SerializedPackage } from "@/lib/packages";
import type { SerializedTransaction } from "@/lib/serializers";
import { cn } from "@/lib/utils";

interface CreditsResponse {
  balance: number;
  totalEarned: number;
  totalUsed: number;
  costs: { generation: { label: string; credits: number }[]; editor: { label: string; credits: number }[] };
}

interface PackagesResponse {
  packages: SerializedPackage[];
  signupBonus: number;
  paymentsEnabled: boolean;
}

interface Paged<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

interface OrderItem {
  id: string;
  packageName: string;
  credits: number;
  amount: number;
  currency: string;
  status: string;
  fulfillmentStatus: string;
  refundedAmount: number;
  createdAt: string;
}

interface CreateOrderResponse {
  orderId: string;
  checkout: { provider: "razorpay"; keyId: string; providerOrderId: string; amount: number; currency: string };
  package: { name: string; credits: number };
  prefill: { name: string; email: string };
}

const TYPE_LABELS: Record<string, string> = {
  bonus: "Bonus",
  purchase: "Purchase",
  usage: "Usage",
  refund: "Refund",
  reversal: "Payment refund",
  adjustment: "Adjustment",
};

const ORDER_STATUS: Record<string, string> = {
  created: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Groups editor actions by price, e.g. "Editor AI actions (7 tools)" → 1 credit. */
function editorRows(editor: { label: string; credits: number }[]) {
  const groups = new Map<number, string[]>();
  for (const action of editor) groups.set(action.credits, [...(groups.get(action.credits) ?? []), action.label]);
  return [...groups].map(([credits, labels]) => ({
    label: labels.length > 2 ? `Editor AI actions (${labels.length} tools)` : labels.join(", "),
    credits,
  }));
}

export default function BillingPage() {
  const { mutate } = useSWRConfig();
  const { data: me } = useMe();
  const [txType, setTxType] = useState("all");
  const [txPage, setTxPage] = useState(1);
  const [buying, setBuying] = useState<string | null>(null);

  const credits = useSWR<CreditsResponse>("/api/credits");
  const packages = useSWR<PackagesResponse>("/api/packages");
  const transactions = useSWR<Paged<SerializedTransaction>>(`/api/credits/transactions?type=${txType}&page=${txPage}&limit=10`, {
    keepPreviousData: true,
  });
  const orders = useSWR<Paged<OrderItem>>("/api/orders?limit=5");

  const refreshAll = () => {
    void mutate("/api/me");
    void credits.mutate();
    void transactions.mutate();
    void orders.mutate();
    void mutate("/api/dashboard");
  };

  async function buy(pkg: SerializedPackage) {
    setBuying(pkg.id);
    let orderId: string | null = null;
    try {
      const order = await api<CreateOrderResponse>("/api/orders", { body: { packageId: pkg.id } });
      orderId = order.orderId;
      await loadRazorpay();
      openRazorpay(
        {
          key: order.checkout.keyId,
          amount: order.checkout.amount,
          currency: order.checkout.currency,
          order_id: order.checkout.providerOrderId,
          name: "Scriptly.ai",
          description: `${order.package.name} · ${formatNumber(order.package.credits)} credits`,
          prefill: order.prefill,
          theme: { color: "#7c3aed" },
          handler: (response: RazorpaySuccess) => {
            void (async () => {
              try {
                await api(`/api/orders/${order.orderId}/verify`, { body: response });
                toast.success(`Payment confirmed — ${formatNumber(order.package.credits)} credits added.`);
              } catch (err) {
                toast.error(errorMessage(err, "We couldn't confirm the payment yet. Credits are added automatically once it's confirmed."));
              } finally {
                setBuying(null);
                refreshAll();
              }
            })();
          },
          modal: {
            ondismiss: () => {
              setBuying(null);
              if (orderId) void api(`/api/orders/${orderId}/cancel`, { method: "POST" }).then(() => orders.mutate()).catch(() => undefined);
            },
          },
        },
        (message) => toast.error(message),
      );
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't start the checkout."));
      setBuying(null);
      void orders.mutate();
    }
  }

  const balance = credits.data?.balance ?? me?.user.credits ?? 0;
  const paymentsEnabled = packages.data?.paymentsEnabled ?? false;

  return (
    <PageContainer>
      <PageHeader title="Credits & Billing" description="Buy credits when you need them. Credits never expire and there's no subscription." />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-600/25 to-transparent p-6 md:col-span-1">
          <p className="flex items-center gap-2 text-sm text-violet-100">
            <Coins className="size-4" aria-hidden /> Available credits
          </p>
          <p className="mt-2 text-5xl font-semibold tracking-tight">{formatNumber(balance)}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {formatNumber(credits.data?.totalEarned ?? me?.user.totalCreditsEarned ?? 0)} received ·{" "}
            {formatNumber(credits.data?.totalUsed ?? me?.user.totalCreditsUsed ?? 0)} used
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 md:col-span-2">
          <p className="mb-3 text-sm font-semibold">What credits buy</p>
          {credits.data ? (
            <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {[...credits.data.costs.generation, ...editorRows(credits.data.costs.editor)].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {row.credits} cr
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" aria-hidden /> Failed generations are refunded automatically.
          </p>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="packages-heading">
        <h2 id="packages-heading" className="mb-1 text-lg font-semibold">
          Credit packages
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">One-time purchases. Prices include all templates, languages and editor tools.</p>

        {!paymentsEnabled && packages.data && (
          <div role="status" className="mb-4 flex gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Online payments aren&apos;t enabled on this server yet, so packages can&apos;t be purchased right now. An administrator
              needs to configure the Razorpay keys (see the README).
            </p>
          </div>
        )}

        {packages.error ? (
          <ErrorState message={errorMessage(packages.error, "Couldn't load packages.")} onRetry={() => packages.mutate()} />
        ) : !packages.data ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {packages.data.packages.map((pkg) => (
              <div
                key={pkg.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6",
                  pkg.isPopular ? "border-violet-400/60 shadow-lg shadow-violet-950/40" : "border-border",
                )}
              >
                {pkg.isPopular && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">Best value</span>
                )}
                <p className="font-semibold">{pkg.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight">{formatMoney(pkg.priceMinor, pkg.currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(pkg.totalCredits)} credits · {formatMoney(Math.round(pkg.priceMinor / pkg.totalCredits), pkg.currency)} per credit
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={pkg.isPopular ? "default" : "secondary"} disabled={!paymentsEnabled || buying !== null} onClick={() => void buy(pkg)}>
                  {buying === pkg.id ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
                  {paymentsEnabled ? `Buy ${pkg.name}` : "Payments unavailable"}
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden /> Payments are processed securely by Razorpay. Credits are added only after the payment is confirmed.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="ledger-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="ledger-heading" className="text-lg font-semibold">
              Credit history
            </h2>
            <p className="text-sm text-muted-foreground">Every change to your balance.</p>
          </div>
          <Select
            value={txType}
            onValueChange={(v) => {
              setTxType(v);
              setTxPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-44" aria-label="Filter transactions">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activity</SelectItem>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {transactions.error ? (
          <ErrorState message={errorMessage(transactions.error, "Couldn't load your credit history.")} onRetry={() => transactions.mutate()} />
        ) : !transactions.data ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : transactions.data.items.length === 0 ? (
          <EmptyState icon={Receipt} title="No credit activity" description="Credit changes will appear here." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Credits</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className={cn("tabular-nums", transactions.isLoading && "opacity-60")}>
                  {transactions.data.items.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(t.createdAt)}</td>
                      <td className="px-4 py-3">{t.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[t.type] ?? t.type}</td>
                      <td className={cn("px-4 py-3 text-right font-medium", t.amount > 0 ? "text-emerald-300" : "text-foreground")}>
                        {t.amount > 0 ? "+" : "−"}
                        {formatNumber(Math.abs(t.amount))}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatNumber(t.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={transactions.data.page} totalPages={transactions.data.totalPages} onPageChange={setTxPage} />
          </>
        )}
      </section>

      {orders.data && orders.data.items.length > 0 && (
        <section className="mt-10" aria-labelledby="orders-heading">
          <h2 id="orders-heading" className="mb-4 text-lg font-semibold">
            Recent orders
          </h2>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {orders.data.items.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{o.packageName}</span>
                  <span className="text-muted-foreground"> · {formatNumber(o.credits)} credits · {formatDateTime(o.createdAt)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{formatMoney(o.amount, o.currency)}</span>
                  {o.status !== "refunded" && o.refundedAmount > 0 && (
                    <span className="text-xs text-muted-foreground">{formatMoney(o.refundedAmount, o.currency)} refunded</span>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs ring-1 ring-inset",
                      o.status === "paid" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20" : "bg-muted text-muted-foreground ring-border",
                    )}
                  >
                    {ORDER_STATUS[o.status] ?? o.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
