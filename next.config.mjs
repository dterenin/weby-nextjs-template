// next.config.mjs (dterenin/weby-nextjs-template)
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
  },
  swcMinify: true,
};

export default nextConfig;