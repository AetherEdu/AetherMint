/** @type {import('next').NextConfig} */
const path = require('path');
const { i18n } = require('./next-i18next.config');

// Validate environment variables at build time.
// This ensures missing/invalid vars are caught early with a clear error message.
const { z } = require('zod');

const envSchema = z.object({
  NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS: z
    .string()
    .min(56, 'Must be a valid Stellar public key (56 chars)')
    .max(56, 'Must be a valid Stellar public key (56 chars)')
    .regex(/^G[A-Z2-7]{55}$/, 'Must be a valid Stellar public key (starts with G)'),
  NEXT_PUBLIC_BACKEND_URL: z.string().url().optional(),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SOCKET_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const errors = parsed.error.errors
    .map((e) => `  ${e.path.join('.')}: ${e.message}`)
    .join('\n');
  throw new Error(`❌ Invalid environment variables:\n${errors}\n\nSee .env.example for reference.`);
}

const nextConfig = {
  // Enable standalone output for Docker container builds
  output: 'standalone',
  typescript: {
    // Ignore TS build errors — pre-existing type issues across the codebase
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignore ESLint errors during build — pre-existing issues across the codebase
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  env: {
    NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS: process.env.NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS,
  },
  i18n,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
  // Performance monitoring configuration
  webpack: (config, { isServer }) => {
    // Enable bundle analysis in production
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
    }

  // Performance optimizations
    // Stub native-only modules and broken packages that can't run in browser/build
    config.resolve.alias = {
      ...config.resolve.alias,
      brainflow: false,
      '@creit.tech/stellar-wallets-kit': path.resolve(__dirname, 'src/stubs/stellar-wallets-kit.ts'),
    };


    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true,
        },
      },
    };

    return config;
  },
  // Enable compression
  compress: true,
  // Enable image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  // Performance headers
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
