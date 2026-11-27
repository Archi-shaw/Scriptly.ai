import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Logo from "@/app/components/Essentials/Logo";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@scriptly.ai";

const columns = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#works" },
      { label: "Features", href: "/#features" },
      { label: "Templates", href: "/#templates" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Popular templates",
    links: [
      { label: "Blog Post Generator", href: "/write?template=blog-post" },
      { label: "Facebook Ad Copy", href: "/write?template=facebook-ad" },
      { label: "Product Description", href: "/write?template=product-description" },
      { label: "Cold Outreach Email", href: "/write?template=cold-outreach-email" },
      { label: "YouTube Video Script", href: "/write?template=youtube-script" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact us", href: `mailto:${supportEmail}` },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Log in", href: "/login" },
      { label: "Sign up", href: "/signup" },
    ],
  },
];

export default function Footer() {
  return (
    <div className="relative">
      <section className="px-4 py-24">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/25 via-violet-900/20 to-transparent p-10 text-center sm:p-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Boost your writing productivity</p>
          <h2 className="text-gradient mb-5 text-3xl font-bold tracking-tight sm:text-4xl">End writer&apos;s block today</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/75">
            It&apos;s like having a team of expert copywriters on call — writing in your voice, in seconds.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-lg font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Start writing for free <ArrowRight className="size-5" aria-hidden />
          </Link>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-white/70">
            {["80+ templates to explore", "No credit card required", "Credits never expire"].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-violet-400" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-14">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 text-sm font-semibold text-white">Save time. Get inspired.</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">
              Generate blog articles, website copy, ads, emails and video scripts for your business in seconds — then
              edit and export them in one place.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/90">{column.title}</h3>
              <ul className="space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-white/60 transition hover:text-violet-300">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Scriptly.ai. All rights reserved.</p>
          <p>Built by GannaG TechVentures</p>
        </div>
      </footer>
    </div>
  );
}
