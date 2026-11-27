"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { SWRConfig } from "swr";
import { Coins, CreditCard, LayoutDashboard, LogOut, Plus, Settings } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/app/components/ui/sidebar";
import { Separator } from "@/app/components/ui/separator";
import { Button } from "@/app/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import AppSidebar from "@/app/components/Essentials/Sidebar";
import { useMe, type MeResponse } from "@/app/hooks/use-me";
import { formatNumber, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const TITLES: [string, string][] = [
  ["/dashboard", "Dashboard"],
  ["/write", "AI Writer"],
  ["/templates", "Templates"],
  ["/documents", "My Documents"],
  ["/history", "History"],
  ["/billing", "Credits & Billing"],
  ["/settings", "Settings"],
];

function UserMenu() {
  const { data } = useMe();
  const user = data?.user;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
        >
          <Avatar className="size-9 border border-border">
            {user?.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className="bg-violet-600/30 text-sm font-semibold text-violet-100">{initials(user?.name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard /> Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/billing">
            <CreditCard /> Credits & Billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppHeader() {
  const pathname = usePathname();
  const { data } = useMe();
  const credits = data?.user.credits ?? 0;
  const title = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? "Scriptly";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-xl sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <p className="truncate text-sm font-medium text-foreground">{title}</p>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/billing"
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums transition hover:bg-accent",
            credits === 0 ? "border-amber-400/40 text-amber-200" : "border-border text-foreground",
          )}
          aria-label={`${credits} credits available. Open billing.`}
        >
          <Coins className="size-4 text-violet-300" aria-hidden />
          {formatNumber(credits)}
          <span className="hidden text-muted-foreground sm:inline">credits</span>
        </Link>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/write">
            <Plus /> New content
          </Link>
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}

export default function AppShell({ initialMe, children }: { initialMe: MeResponse; children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fallback: { "/api/me": initialMe } }}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <AppHeader />
          <div className="flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </SWRConfig>
  );
}
