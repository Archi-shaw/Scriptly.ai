"use client";

import { useEffect, useRef } from "react";

// Deterministic pseudo-random positions so server and client render the same markup.
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const rand = seeded(42);
const PARTICLES = Array.from({ length: 36 }, () => ({
  left: `${(rand() * 100).toFixed(2)}%`,
  top: `${(rand() * 100).toFixed(2)}%`,
  delay: `${(rand() * 3).toFixed(2)}s`,
  duration: `${(2 + rand() * 3).toFixed(2)}s`,
}));

/**
 * Purple gradient backdrop with a cursor-following glow. The glow is driven by
 * CSS variables updated in requestAnimationFrame, so moving the mouse never
 * re-renders React.
 */
export default function LandingBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${(e.clientX / window.innerWidth) * 100}%`);
        el.style.setProperty("--my", `${(e.clientY / window.innerHeight) * 100}%`);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ "--mx": "50%", "--my": "30%" } as React.CSSProperties}>
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(600px circle at var(--mx) var(--my), rgba(139, 92, 246, 0.16), transparent 60%),
            radial-gradient(circle at 20% 80%, rgba(46, 16, 101, 0.55) 0%, transparent 50%),
            radial-gradient(circle at 80% 15%, rgba(147, 51, 234, 0.28) 0%, transparent 45%),
            linear-gradient(125deg, #1a0b3d 0%, #12062e 30%, #0b0718 65%, #050409 100%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 20%, transparent 70%)",
        }}
      />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-purple-300/40 motion-safe:animate-pulse"
          style={{ left: p.left, top: p.top, animationDelay: p.delay, animationDuration: p.duration }}
        />
      ))}
    </div>
  );
}
