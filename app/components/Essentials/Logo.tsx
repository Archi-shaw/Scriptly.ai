import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  className?: string;
  showWordmark?: boolean;
  size?: number;
}

const Logo = ({ href = "/", className, showWordmark = true, size = 30 }: LogoProps) => {
  return (
    <Link
      href={href}
      aria-label="Scriptly.ai home"
      className={cn(
        "inline-flex items-center gap-2 rounded-md font-semibold tracking-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Image src="/logo-mark.png" alt="" width={size} height={size} priority className="shrink-0 drop-shadow-[0_0_12px_rgba(139,92,246,0.45)]" />
      {showWordmark && (
        <span className="text-lg leading-none">
          Scriptly<span className="text-violet-300">.ai</span>
        </span>
      )}
    </Link>
  );
};

export default Logo;
