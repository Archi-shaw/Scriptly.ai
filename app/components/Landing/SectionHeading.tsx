import { cn } from "@/lib/utils";

export default function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-3xl text-center", className)}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">{eyebrow}</p>
      <h2 className="text-gradient text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{title}</h2>
      {description && <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">{description}</p>}
    </div>
  );
}
