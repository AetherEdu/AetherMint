'use client';

import React, { useState, useEffect } from 'react';
import { useTour } from '@/lib/tour/TourContext';
import { Button } from '@/components/ui/button';

export function OnboardingModal() {
  const { hasCompletedOnboarding, completeOnboarding } = useTour();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState({
    role: '',
    goals: [] as string[],
  });

  useEffect(() => {
    if (!hasCompletedOnboarding) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [hasCompletedOnboarding]);

  if (!isOpen) return null;

  const handleComplete = () => {
    completeOnboarding(preferences);
    setIsOpen(false);
  };

  const toggleGoal = (goal: string) => {
    setPreferences(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="text-center space-y-2">
              <h2 id="onboarding-title" className="text-2xl font-bold tracking-tight">Welcome to AetherMint!</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Let's personalize your experience. How will you use the platform?</p>
            </div>
            
            <div className="grid gap-3">
              <button 
                onClick={() => setPreferences({ ...preferences, role: 'learner' })}
                className={`p-4 border rounded-lg text-left transition-all ${preferences.role === 'learner' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300'}`}
              >
                <div className="font-semibold">I'm a Learner</div>
                <div className="text-sm text-zinc-500">I want to take courses and earn credentials.</div>
              </button>
              <button 
                onClick={() => setPreferences({ ...preferences, role: 'instructor' })}
                className={`p-4 border rounded-lg text-left transition-all ${preferences.role === 'instructor' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300'}`}
              >
                <div className="font-semibold">I'm an Instructor</div>
                <div className="text-sm text-zinc-500">I want to create and manage courses.</div>
              </button>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={handleComplete}>Skip for now</Button>
              <Button 
                onClick={() => setStep(2)} 
                disabled={!preferences.role}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">What are your goals?</h2>
              <p className="text-zinc-500 dark:text-zinc-400">Select all that apply to help us recommend content.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {['Blockchain Basics', 'Smart Contracts', 'DeFi', 'NFTs', 'Web3 Development', 'Tokenomics'].map(goal => (
                <button
                  key={goal}
                  onClick={() => toggleGoal(goal)}
                  className={`p-3 border rounded-lg text-sm text-center transition-all ${preferences.goals.includes(goal) ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300'}`}
                >
                  {goal}
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleComplete}>Get Started</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
