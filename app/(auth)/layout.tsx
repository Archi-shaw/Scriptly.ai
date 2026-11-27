import { CheckCircle2 } from "lucide-react";
import { BotCheckProvider } from "@/app/components/auth/BotCheck";
import Logo from "@/app/components/Essentials/Logo";
import { getTurnstileConfig } from "@/lib/config";
import { LANGUAGES } from "@/lib/templates/options";
import { TEMPLATES } from "@/lib/templates/registry";

const highlights = [
  `${TEMPLATES.length} templates for blogs, ads, emails, product pages and scripts`,
  `Write natively in ${LANGUAGES.length}+ languages with 14 tones of voice`,
  "AIDA, PAS & BAB copywriting frameworks built in",
  "An editor that improves, shortens, rewrites and exports your drafts",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(480px,560px)]">
      <aside className="relative hidden overflow-hidden lg:block">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(147,51,234,0.35), transparent 45%), radial-gradient(circle at 80% 85%, rgba(76,29,149,0.55), transparent 50%), linear-gradient(140deg, #1a0b3d 0%, #0d0820 55%, #07050e 100%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div className="max-w-lg">
            <h1 className="text-gradient text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
              Your AI writing team, ready when you are.
            </h1>
            <ul className="mt-8 space-y-4">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/80">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-violet-300" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-white/45">© {new Date().getFullYear()} Scriptly.ai</p>
        </div>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            {/* Read per request, so enabling Turnstile needs no rebuild. */}
            <BotCheckProvider siteKey={getTurnstileConfig()?.siteKey ?? null}>{children}</BotCheckProvider>
          </div>
        </div>
      </main>
    </div>
  );
}
