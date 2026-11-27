import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import Logo from "@/app/components/Essentials/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Logo />
      <div className="grid flex-1 place-items-center">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-primary/15 text-violet-300">
            <Compass className="size-7" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-violet-300">404</p>
          <h1 className="mt-1 text-2xl font-semibold">Page not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
