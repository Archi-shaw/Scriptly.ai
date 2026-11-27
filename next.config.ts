import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Routes from the earlier prototype now live inside the authenticated workspace.
  async redirects() {
    return [
      { source: "/alltools", destination: "/templates", permanent: true },
      { source: "/mycontent", destination: "/documents", permanent: true },
      { source: "/aiarticlewriter", destination: "/write?template=article-generator", permanent: true },
      { source: "/activate", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
