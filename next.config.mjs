/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse uses CJS internals incompatible with webpack's ESM bundler.
  // Mark it as external so Next.js uses Node's native require() instead.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
