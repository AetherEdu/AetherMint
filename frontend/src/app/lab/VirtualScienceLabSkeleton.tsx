/**
 * Skeleton placeholder for the Virtual Science Lab page while the
 * underlying component (and its 3D scene + physics simulators) is
 * being fetched as a separate chunk.
 *
 * The shape approximates the three columns of the lab UI (3D scene
 * | data panel, guidance/collaboration, safety log). Once the dynamic
 * chunk resolves, the real `VirtualScienceLab` swap-in is layout-stable
 * because the wrapper uses the same vertical rhythm.
 */

'use client';

import Skeleton from '@/components/Skeleton';

export function VirtualScienceLabSkeleton() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#fdf7ec_0%,_#f8fbff_45%,_#eef6ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Skeleton variant="text" lines={2} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton variant="text" lines={1} lastLineWidth="32%" />
              <Skeleton variant="text" lines={1} lastLineWidth="40%" />
              <Skeleton variant="text" lines={1} lastLineWidth="40%" />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton variant="card" imageAspectRatio="16/9" lines={2} hasFooter />
              <Skeleton variant="card" imageAspectRatio="16/9" lines={2} hasFooter />
            </div>
            <Skeleton variant="card" lines={4} />
            <Skeleton variant="card" lines={6} />
          </div>
          <div className="space-y-6">
            <Skeleton variant="card" lines={5} />
            <Skeleton variant="card" lines={3} />
            <Skeleton variant="card" lines={4} />
          </div>
        </section>
      </div>
    </div>
  );
}
