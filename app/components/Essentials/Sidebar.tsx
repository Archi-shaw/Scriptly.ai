"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Coins,
  CreditCard,
  Files,
  History,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Settings,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/app/components/ui/sidebar";
import Logo from "@/app/components/Essentials/Logo";
import { useMe } from "@/app/hooks/use-me";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavElement {
  title: string;
  href: string;
  icon: LucideIcon;
}

const workspace: NavElement[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "AI Writer", href: "/write", icon: WandSparkles },
  { title: "Templates", href: "/templates", icon: LayoutTemplate },
  { title: "My Documents", href: "/documents", icon: Files },
  { title: "History", href: "/history", icon: History },
];

const account: NavElement[] = [
  { title: "Credits & Billing", href: "/billing", icon: CreditCard },
  { title: "Settings", href: "/settings", icon: Settings },
];

function NavGroup({ label, items }: { label: string; items: NavElement[] }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="h-9">
                  <Link href={item.href} onClick={() => setOpenMobile(false)} aria-current={active ? "page" : undefined}>
                    <item.icon className={cn(active && "text-violet-300")} />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export default function AppSidebar() {
  const { data } = useMe();
  const credits = data?.user.credits ?? 0;
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3 group-data-[collapsible=icon]:px-2">
        <Logo href="/dashboard" className="group-data-[collapsible=icon]:[&>span]:hidden" />
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Workspace" items={workspace} />
        <NavGroup label="Account" items={account} />
      </SidebarContent>
      <SidebarFooter className="gap-3 p-3">
        <Link
          href="/billing"
          onClick={() => setOpenMobile(false)}
          className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 transition hover:border-violet-400/40 group-data-[collapsible=icon]:hidden"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-violet-300" aria-hidden /> Credits available
          </div>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", credits === 0 ? "text-amber-300" : "text-foreground")}>
            {formatNumber(credits)}
          </p>
          <p className="mt-1 text-xs font-medium text-violet-300">Buy more credits →</p>
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Log out" onClick={() => signOut({ callbackUrl: "/" })} className="h-9">
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
