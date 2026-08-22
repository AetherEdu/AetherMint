'use client';

/**
 * Thin client-side wrapper for the `/campus` route.
 *
 * See AetherEdu/AetherMint issue #141: the App Router page is a server
 * component (so it can export `metadata`); this wrapper provides the
 * `next/dynamic` boundary that lets the Three.js / R3F / drei bundle
 * land in its own chunk instead of being eagerly included by the page.
 */

import dynamic from 'next/dynamic';
import { LoadingFallback } from '@/components/LoadingFallback';

const MetaverseCampus = dynamic(
  () =>
    import('@/components/Metaverse').then((m) => ({
      default: m.MetaverseCampus,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400">
        <LoadingFallback message="Loading metaverse campus…" size="lg" />
      </div>
    ),
  },
);

export default function CampusClient() {
  return <MetaverseCampus />;
}
