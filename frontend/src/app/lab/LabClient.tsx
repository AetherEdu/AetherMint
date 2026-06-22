'use client';

/**
 * Thin client-side wrapper for the `/lab` route.
 *
 * Why this exists (see AetherEdu/AetherMint issue #141):
 *   - `frontend/src/app/lab/page.tsx` is a server component so it can
 *     export `metadata` for SEO. Server components cannot use
 *     `next/dynamic` directly because dynamic chunks are client-only.
 *   - Pulling `VirtualScienceLab` directly in the page ships its 3D
 *     dependencies (`three`, `@react-three/{fiber,drei}`, simulator
 *     code, hooks) into the initial route chunk.
 *   - This wrapper acts as the boundary that the App Router page can
 *     render. Inside, `next/dynamic` is free to lazy-load the lab and
 *     keeps the server bundle free of WebXR / physics code.
 *
 * The internal `next/dynamic`s inside `VirtualScienceLab` for
 * `LabScene3D` and `LabReactionSim` are preserved (they were already
 * present before issue #141) so we don't double-wrap them — only the
 * outer shell becomes a separate chunk.
 */

import dynamic from 'next/dynamic';
import { LoadingFallback } from '@/components/LoadingFallback';
import { VirtualScienceLabSkeleton } from './VirtualScienceLabSkeleton';

const VirtualScienceLab = dynamic(
  () =>
    import('@/components/Lab/VirtualScienceLab').then((m) => ({
      default: m.VirtualScienceLab,
    })),
  {
    ssr: false,
    loading: () => <VirtualScienceLabSkeleton />,
  },
);

export default function LabClient() {
  return (
    <div className="relative min-h-screen">
      {/*
       * The LoadingFallback is rendered first as a low-cost placeholder
       * during the dynamic import, before the heavier skeleton mounts.
       */}
      <noscript>
        <LoadingFallback message="Enable JavaScript to use the Virtual Science Lab" />
      </noscript>
      <VirtualScienceLab />
    </div>
  );
}
