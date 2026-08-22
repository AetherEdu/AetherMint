import type { Metadata } from 'next';
import LabClient from './LabClient';

export const metadata: Metadata = {
  title: 'Virtual Science Laboratory — AetherMint',
  description:
    'Interactive virtual lab for experiments with 3D equipment, guided steps, safety warnings, and collaboration.',
};

/**
 * The /lab route renders a thin client-side wrapper so the heavy
 * `VirtualScienceLab` bundle (Three.js, physics simulators, hooks)
 * lands in its own chunk and never enters the initial server payload.
 * See AetherEdu/AetherMint issue #141.
 */
export default function LabPage() {
  return <LabClient />;
}
