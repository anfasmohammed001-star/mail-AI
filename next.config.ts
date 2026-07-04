import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['nodemailer', 'imapflow', 'mailparser', '@prisma/client', 'prisma'],
  outputFileTracingIncludes: {
    '/**/*': ['./db/**/*'],
  },
};

export default nextConfig;
