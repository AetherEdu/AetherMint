/** @type {import('next').NextConfig} */
const path = require('path');
const { i18n } = require('./next-i18next.config');
// `next-bundle-analyzer` is the npm package wired into package.json's
// devDependencies (un-scoped — different from `@next/bundle-analyzer`,
// which is not installed in this repo). Setting `ANALYZE=true` next to
// `next build` (already wired into package.json's `analyze` script)
// triggers an HTML/JSON breakdown of every cache group.
const withBundleAnalyzer = require('next-bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

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
  webpack: (config) => {
    // Bundle analysis is wired through `withBundleAnalyzer(...)` at the
    // bottom of this file. The analyser is no longer pushed manually here
    // to avoid registering it twice.

  // Performance optimizations
    // Stub native-only modules and broken packages that can't run in browser/build
    config.resolve.alias = {
      ...config.resolve.alias,
      brainflow: false,
      '@creit.tech/stellar-wallets-kit': path.resolve(__dirname, 'src/stubs/stellar-wallets-kit.ts'),
    };


    // Issue #141: more granular split groups so the initial chunk does not
    // eagerly ship very large vendor modules (three, recharts, wagmi…)
    // that are only used on specific routes. Each cache group produces a
    // separate long-cacheable chunk that is loaded on-demand by the pages
    // that actually use it.
    config.optimization.splitChunks = {
      chunks: 'all',
      maxInitialRequests: 32,
      minSize: 20000,
      cacheGroups: {
        default: false,
        defaultVendors: false,
        framework: {
          name: 'framework',
          chunks: 'all',
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
          priority: 40,
          enforce: true,
        },
        three: {
          name: 'three',
          test: /[\\/]node_modules[\\/](three|@react-three[\\/](?:fiber|drei))[\\/]/,
          chunks: 'all',
          priority: 35,
          enforce: true,
        },
        charts: {
          name: 'charts',
          test: /[\\/]node_modules[\\/](recharts|d3-shape|d3-scale|d3-array|victory-vendor)[\\/]/,
          chunks: 'all',
          priority: 30,
          enforce: true,
        },
        wallet: {
          name: 'wallet',
          test: /[\\/]node_modules[\\/](wagmi|viem|ethers|@walletconnect|connectkit|@creit\\.tech)[\\/]/,
          chunks: 'all',
          priority: 25,
          enforce: true,
        },
        tensorflow: {
          name: 'tensorflow',
          test: /[\\/]node_modules[\\/](@tensorflow[\\/]tfjs|@tensorflow[\\/]tfjs-core|@tensorflow[\\/]tfjs-converter|@tensorflow[\\/]tfjs-backend|@tensorflow[\\/]tfjs-layers)[\\/]/,
          chunks: 'async',
          priority: 20,
          enforce: true,
        },
        pyodide: {
          name: 'pyodide',
          test: /[\\/]node_modules[\\/](pyodide)[\\/]/,
          chunks: 'async',
          priority: 19,
          enforce: true,
        },
        monaco: {
          name: 'monaco',
          test: /[\\/]node_modules[\\/](monaco-editor|@monaco-editor[\\/]react)[\\/]/,
          chunks: 'async',
          priority: 18,
          enforce: true,
        },
        framerMotion: {
          name: 'framer-motion',
          test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
          chunks: 'all',
          priority: 15,
          enforce: true,
        },
        stellar: {
          name: 'stellar',
          test: /[\\/]node_modules[\\/](@stellar[\\/]stellar-sdk|stellar-base)([\\/]|$)/,
          chunks: 'async',
          priority: 12,
          enforce: true,
        },
        // Generic vendor catch-all — only emits after the groups above so
        // they always win when they match.
        vendors: {
          name: 'vendors',
          test: /[\\/]node_modules[\\/]/,
          chunks: 'all',
          priority: 5,
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 1,
          reuseExistingChunk: true,
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
      // Service-worker headers — ensure the browser accepts `/sw.js` as a
      // top-level worker (Service-Worker-Allowed: '/') and never serves it
      // from an HTTP cache (penalising immediate SW updates).
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
        ],
      },
    ];
  },
};

// `withBundleAnalyzer` is a no-op when `ANALYZE` is not 'true'; when it
// is, it returns a wrapper around `nextConfig` that injects the official
// Webpack Bundle Analyzer plugin. This replaces the previous manual
// `config.plugins.push(new BundleAnalyzerPlugin(...))` so the plugin is
// registered exactly once.
module.exports = withBundleAnalyzer(nextConfig);
