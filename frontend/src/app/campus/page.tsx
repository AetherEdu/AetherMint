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
  return <CampusClient />;
}
