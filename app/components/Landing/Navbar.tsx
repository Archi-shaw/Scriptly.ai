"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Menu, X } from "lucide-react";
import Logo from "@/app/components/Essentials/Logo";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "How it works", href: "#works" },
  { label: "Features", href: "#features" },
  { label: "Templates", href: "#templates" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { status } = useSession();
  const signedIn = status === "authenticated";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled || isMenuOpen ? "border-b border-white/10 bg-[#0a0714]/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Logo />

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-full px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500"
              >
                Start creating
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 lg:hidden"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            <span className="sr-only">{isMenuOpen ? "Close menu" : "Open menu"}</span>
            {isMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-white/10 px-4 pb-6 pt-3 lg:hidden">
          <div className="space-y-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block rounded-xl px-4 py-3 text-base font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </div>
          {!signedIn && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link href="/login" className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-medium text-white hover:bg-white/5">
                Log in
              </Link>
              <Link href="/signup" className="rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-violet-500">
                Sign up free
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
