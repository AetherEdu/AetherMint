import type { Metadata } from 'next';
import ProfilePageClient from './ProfilePageClient';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Manage your learning profile, achievements, and verified credentials on AetherMint.',
  alternates: {
    canonical: '/profile',
  },
  openGraph: {
    title: 'Your AetherMint Profile',
    description: 'Track your progress, credentials, and achievements in one place.',
    url: 'https://aethermint.edu/profile',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Your AetherMint Profile',
    description: 'Track your progress, credentials, and achievements in one place.',
  },
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
