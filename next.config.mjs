/** @type {import('next').NextConfig} */
// cache-bust: login route deduplication fix
const nextConfig = {
   env: {
    "PORT": process.env.NEXT_PUBLIC_SERVICE_PORT || "3000",
    "ENVIRONMENT": process.env.NEXT_PUBLIC_ENVIRONMENT || "development"
  },
  images: {
    domains: ['localhost','isp.easypay.co.tz'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
