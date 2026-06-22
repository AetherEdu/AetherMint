'use client';

import dynamic from 'next/dynamic';
import { LoadingFallback } from '@/components/LoadingFallback';
import { AvatarCustomizer } from './AvatarCustomizer';
import { BuildingInterior } from './BuildingInterior';
import { CampusHUD } from './CampusHUD';
import { useMetaverseCampus } from '../../hooks/useMetaverseCampus';

// Dynamically import the 3D scene to avoid SSR issues with Three.js.
// Issue #141: standardised on the global `LoadingFallback` so every
// heavy 3D chunk in the app renders the same placeholder shape —
// keeps lighthouse CLS low and avoids one-off inline styles.
const CampusScene = dynamic(
  () => import('./CampusScene').then(m => ({ default: m.CampusScene })),
  {
    ssr: false,
    // The campus uses a dark slate background. `LoadingFallback` paints
    // its visible text on an inner `<span>` whose own colour classes
    // override anything set on the outer wrapper, so we instead scope the
    // dark text colour to the container and let the spinner inherit it
    // via Tailwind's CSS variable cascade. We keep the inline `bg-slate-950
    // text-slate-400` pair (matches the original inline placeholder) so
    // the resulting CLS-friendly wrapper stays legible.
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-950 text-slate-400">
        <LoadingFallback message="Loading 3D campus…" size="lg" />
      </div>
    ),
  }
);

export function MetaverseCampus() {
  const { state, initUser, enterBuilding, exitBuilding } = useMetaverseCampus();

  const activeBuilding = state.buildings.find(b => b.id === state.activeBuilding) ?? null;

  // Step 1: avatar creation
  if (!state.localUser) {
    return <AvatarCustomizer onConfirm={initUser} />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950">
      <CampusScene
        buildings={state.buildings}
        users={state.users}
        localUser={state.localUser}
        onEnterBuilding={enterBuilding}
      />

      <CampusHUD
        totalOnline={state.totalOnline}
        buildings={state.buildings}
        onEnterBuilding={enterBuilding}
      />

      {activeBuilding && (
        <BuildingInterior building={activeBuilding} onExit={exitBuilding} />
      )}
    </div>
  );
}
