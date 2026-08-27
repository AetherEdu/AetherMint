import type { Metadata } from 'next';
import DashboardPageClient from './DashboardPageClient';

export const metadata: Metadata = {
  title: 'Learning Dashboard',
  description: 'Track course progress, achievements, credentials, skills, and recommended next steps.',
  alternates: {
    canonical: '/dashboard',
  },
};

export default function DashboardPage() {
  return <DashboardPageClient />;
}
