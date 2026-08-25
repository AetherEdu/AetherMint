'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type TourStep = {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
};

type TourContextType = {
  hasCompletedOnboarding: boolean;
  completeOnboarding: (data: any) => void;
  activeTour: string | null;
  startTour: (tourName: string) => void;
  endTour: () => void;
  dismissTour: (tourName: string) => void;
  isTourDismissed: (tourName: string) => boolean;
  currentStepIndex: number;
  nextStep: () => void;
  prevStep: () => void;
  setTourSteps: (steps: TourStep[]) => void;
  tourSteps: TourStep[];
};

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true); // default true to prevent flash
  const [dismissedTours, setDismissedTours] = useState<string[]>([]);
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [tourSteps, setTourSteps] = useState<TourStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const onboardingState = localStorage.getItem('aethermint_onboarding_completed');
    if (onboardingState !== 'true') {
      setHasCompletedOnboarding(false);
    }
    const dismissed = localStorage.getItem('aethermint_dismissed_tours');
    if (dismissed) {
      try {
        setDismissedTours(JSON.parse(dismissed));
      } catch (e) {}
    }
  }, []);

  const completeOnboarding = (data: any) => {
    // In a real app, save data to backend API here
    localStorage.setItem('aethermint_onboarding_completed', 'true');
    setHasCompletedOnboarding(true);
  };

  const startTour = (tourName: string) => {
    if (dismissedTours.includes(tourName)) return;
    setActiveTour(tourName);
    setCurrentStepIndex(0);
  };

  const endTour = () => {
    setActiveTour(null);
    setCurrentStepIndex(0);
    setTourSteps([]);
  };

  const dismissTour = (tourName: string) => {
    const newDismissed = [...dismissedTours, tourName];
    setDismissedTours(newDismissed);
    localStorage.setItem('aethermint_dismissed_tours', JSON.stringify(newDismissed));
    if (activeTour === tourName) {
      endTour();
    }
  };

  const isTourDismissed = (tourName: string) => {
    return dismissedTours.includes(tourName);
  };

  const nextStep = () => {
    if (currentStepIndex < tourSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      if (activeTour) dismissTour(activeTour);
      endTour();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Always render the provider so children that call useTour() during SSR
  // (prerendering) receive a valid context instead of throwing.
  return (
    <TourContext.Provider
      value={{
        hasCompletedOnboarding,
        completeOnboarding,
        activeTour,
        startTour,
        endTour,
        dismissTour,
        isTourDismissed,
        currentStepIndex,
        nextStep,
        prevStep,
        setTourSteps,
        tourSteps,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
