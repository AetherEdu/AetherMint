# CDN and Static Asset Delivery

This document explains how AetherMint serves frontend static assets, how to put
them behind a CDN, the caching and invalidation strategy, and how to measure the
latency improvement. It supports issue #290.

## Goals

- Serve frontend static assets and media through a CDN with edge caching.
- Keep cache invalidation simple and correct on every deploy.
- Provide a repeatable way to measure latency improvements.

## What is implemented in this change

- The Next.js build now honours an ASSET_PREFIX environment variable. When it is
  set, Next.js rewrites the URLs of built assets under /_next/static to load
  them from that origin (a CDN), using the built-in assetPrefix option. When it
  is empty, behaviour is unchanged, so local development and existing deploys
  are not affected.
- ASSET_PREFIX is documented in frontend/.env.example.

Long-lived cache headers for built assets already exist in
frontend/next.config.js: responses under /_next/static are served with
Cache-Control public, max-age=31536000, immutable, and API responses are marked
no-cache. This change adds the CDN origin hook in front of those assets.

## How to point assets at a CDN

1. Provision a CDN distribution whose origin is the deployed frontend (for
   example a CloudFront, Fastly, or Cloudflare distribution).
2. Set ASSET_PREFIX to the CDN base URL in the production environment, for
   example https://cdn.aethermint.example.
3. Rebuild and redeploy the frontend. Next.js will emit asset URLs that point at
   the CDN, and browsers will fetch them from the nearest edge location.

## Caching strategy

| Asset type                      | Cache-Control                                              | Notes                                   |
| ------------------------------- | --------------------------------------------------------- | --------------------------------------- |
| Built assets under _next/static | public, max-age=31536000, immutable                       | Filenames are content-hashed by Next.js |
| API responses                   | no-cache, no-store, must-revalidate                       | Always fresh                            |
| Public media and fonts          | recommended: public, max-age=86400, stale-while-revalidate | Not content-hashed; see below           |

## Cache invalidation strategy

- Built assets under _next/static are content-hashed. A new build produces new
  filenames, so a deploy naturally invalidates old assets with no manual purge.
- For non-hashed files in the public folder (favicons, static images, fonts),
  use a shorter max-age with stale-while-revalidate, or trigger a CDN purge for
  the changed paths as part of the deploy pipeline.
- Course media and IPFS content should be addressed by content hash or a
  versioned path so they are safe to cache at the edge for long periods.

## Custom domain, SSL, and edge caching (maintainer infrastructure)

These require cloud accounts and DNS access that are outside the scope of a code
change, so they are recorded here as the plan:

- Point a custom domain such as cdn.aethermint.example at the CDN distribution.
- Issue and attach a TLS certificate for that domain.
- Enable edge caching for course media and IPFS gateway responses at the CDN
  layer, honouring the Cache-Control headers above.

## Measuring latency improvement

To produce the benchmark the acceptance criteria ask for:

1. Pick a representative built asset, for example a large chunk under
   /_next/static.
2. Measure time to first byte and total download time from several regions,
   both directly from the origin and through the CDN, using a timing-enabled
   HTTP client or a synthetic monitoring tool.
3. Record the median and 95th percentile for origin versus CDN, and summarise
   the improvement as a percentage reduction in latency.

## References

- Issue #290: Configure CDN for static assets and content delivery.
- frontend/next.config.js
- frontend/.env.example