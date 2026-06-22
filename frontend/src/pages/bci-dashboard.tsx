import React from 'react';
import dynamic from 'next/dynamic';
import { LoadingFallback } from '@/components/LoadingFallback';

/**
 * The BCI dashboard is a multi-tab React surface that pulls in icons,
 * lucide-react subcomponents and a number of feature components
 * (CognitiveDashboard, HandsFreeNavigation, AttentionTracker,
 * AdaptiveDifficulty, NeurofeedbackTraining). For AetherEdu/AetherMint
 * issue #141 we lazy-load the entire dashboard so its dependencies
 * land in a separate chunk that is only fetched on this route.
 */
const BCIDashboard = dynamic(
  () =>
    import('../components/BCI/BCIDashboard').then((m) => ({
      default: m.BCIDashboard,
    })),
  {
    ssr: false,
    loading: () => (
      <LoadingFallback message="Loading brain-computer interface…" size="lg" />
    ),
  },
);

const BCIDashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <BCIDashboard />
    </div>
  );
};

export default BCIDashboardPage;
