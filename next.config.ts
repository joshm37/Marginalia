import type { NextConfig } from "next";

const requiredProductionEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "DATABASE_URL",
] as const;

if (process.env.NODE_ENV === "production") {
  if (
    process.env.E2E_TEST_MODE === "true" ||
    process.env.NEXT_PUBLIC_E2E_TEST_MODE === "true"
  ) {
    throw new Error("E2E_TEST_MODE must never be enabled in production");
  }
  const missing = requiredProductionEnvironment.filter(
    (name) => !process.env[name],
  );
  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
  // Keep production compilation from overwriting a running dev server's
  // webpack module cache. Both commands otherwise write to `.next`.
  //distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
};

export default nextConfig;
