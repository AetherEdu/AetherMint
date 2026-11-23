'use client';

/**
 * Thin client-side wrapper for the `/campus` route.
 *
 * See AetherEdu/AetherMint issue #141: the App Router page is a server
 * component (so it can export `metadata`); this wrapper provides the
 * `next/dynamic` boundary that lets the Three.js / R3F / drei bundle
 * land in its own chunk instead of being eagerly included by the page.
 *
 * See AetherEdu/AetherMint issue #268: while the WebGL / 3D bundle and
 * assets initialize, we render a layout-matching skeleton (header +
 * full-height canvas area) so the transition to the loaded scene is
 * graceful and free of layout shift.
 */

import dynamic from 'next/dynamic';
import { LoadingFallback } from '@/components/LoadingFallback';
import { Skeleton } from '@/components/Skeleton';

function CampusSkeleton() {
  return (
    <div
      className="flex h-screen w-full flex-col bg-slate-950"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading metaverse campus"
    >
      {/* Header placeholder */}
      <div className="flex w-full items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Full-height canvas area placeholder */}
      <div className="relative flex-1">
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingFallback message="Loading metaverse campus…" size="lg" />
        </div>
      </div>

      <span className="sr-only">Loading metaverse campus…</span>
    </div>
  );
}

const MetaverseCampus = dynamic(
  () =>
    import('@/components/Metaverse').then((m) => ({
      default: m.MetaverseCampus,
    })),
  {
    ssr: false,
    loading: () => <CampusSkeleton />,
  },
);

export default function CampusClient() {
  return <MetaverseCampus />;
}