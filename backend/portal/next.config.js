/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  env: {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000/api'
  }
}

module.exports = nextConfig;
