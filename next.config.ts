import type { NextConfig } from "next";

function parseServerActionAllowedOrigins(
  value: string | undefined
): string[] | undefined {
  if (!value?.trim()) return undefined;

  const origins = value
    .split(",")
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean);

  const hostnamePattern =
    /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?::\d{1,5})?$/;

  const invalid = origins.find(
    (origin) => !hostnamePattern.test(origin)
  );

  if (invalid) {
    throw new Error(
      "SERVER_ACTION_ALLOWED_ORIGINS must contain comma-separated hostnames only."
    );
  }

  return [...new Set(origins)];
}

const allowedOrigins = parseServerActionAllowedOrigins(
  process.env.SERVER_ACTION_ALLOWED_ORIGINS
);

const buildId = process.env.COOLCASE_BUILD_ID?.trim();

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  output: "standalone",

  ...(buildId
    ? {
        generateBuildId: async () => buildId,
      }
    : {}),

  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
      ...(allowedOrigins ? { allowedOrigins } : {}),
    },
  },

  images: {
    // CloudFront serves /assets and /media directly from S3 in the AWS image.
    unoptimized: process.env.COOLCASE_AWS_BUILD === "true",

    localPatterns: [
      {
        pathname: "/assets/**",
      },
      {
        pathname: "/media/**",
      },
    ],

    remotePatterns: [
      {
        protocol: "https",
        hostname: "jitfuuusxwocjfdkaigr.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
