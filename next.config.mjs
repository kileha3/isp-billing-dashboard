/** @type {import('next').NextConfig} */
// cache-bust: login route deduplication fix
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
