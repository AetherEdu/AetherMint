'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Map } from 'lucide-react';
import { Skeleton, ErrorDisplay, EmptyState } from '../../components/LoadingFallback';

// Dynamically import MetaverseCampus to avoid SSR issues with Three.js
const MetaverseCampus = dynamic(
  () => import('../../components/Metaverse').then(m => ({ default: m.MetaverseCampus })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-950 p-6 space-y-4">
        <Skeleton className="h-12 w-64 bg-slate-800" />
        <Skeleton className="h-[calc(100vh-120px)] w-full bg-slate-800 rounded-xl" />
      </div>
    ),
  }
);
import type { Metadata } from 'next';
import CampusClient from './CampusClient';

export const metadata: Metadata = {
  title: 'Metaverse Campus — AetherMint',
  description:
    'Immersive virtual learning campus with classrooms, social spaces, and avatar interaction.',
};

/**
 * The /campus route renders a thin client-side wrapper so the heavy
 * `MetaverseCampus` bundle (Three.js, R3F/drei, campus scene state,
 * hooks) lands in its own chunk and never enters the initial server
 * payload. The campus page itself remains a server component so we
 * keep `export const metadata` for SEO.
 * See AetherEdu/AetherMint issue #141.
 */
export default function CampusPage() {
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for WebGL support (required for the 3D campus)
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setSupported(!!gl);
    } catch {
      setSupported(false);
    }
  }, []);

  if (supported === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <EmptyState
          icon={<Map className="h-8 w-8" />}
          title="3D Campus not supported"
          description="Your browser or device does not support WebGL, which is required for the metaverse campus. Try a modern browser like Chrome or Firefox."
          className="text-slate-300 [&_h3]:text-white [&_p]:text-slate-400"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <ErrorDisplay
          title="Campus failed to load"
          message={error}
          onRetry={() => { setError(null); }}
          className="max-w-md w-full"
        />
      </div>
    );
  }

  return <MetaverseCampus />;
  return <CampusClient />;
}
