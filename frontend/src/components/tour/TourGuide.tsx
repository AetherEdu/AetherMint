'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useTour } from '@/lib/tour/TourContext';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function TourGuide() {
  const { activeTour, tourSteps, currentStepIndex, nextStep, prevStep, dismissTour, endTour } = useTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!activeTour || tourSteps.length === 0) return;

    const currentStep = tourSteps[currentStepIndex];
    if (!currentStep) return;

    const updatePosition = () => {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        // Bring into view
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    // Small delay to allow element rendering/transitions
    const timer = setTimeout(updatePosition, 100);

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize);
    window.addEventListener('resize', handleScrollOrResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeTour, tourSteps, currentStepIndex]);

  if (!activeTour || tourSteps.length === 0 || !targetRect) return null;

  const currentStep = tourSteps[currentStepIndex];
  const position = currentStep.position || 'bottom';

  let top = 0;
  let left = 0;

  // Very basic positioning logic
  const spacing = 16;
  if (position === 'bottom') {
    top = targetRect.bottom + spacing;
    left = targetRect.left + (targetRect.width / 2) - 150; // Center 300px width tooltip
  } else if (position === 'top') {
    top = targetRect.top - spacing - 200; // approximate height
    left = targetRect.left + (targetRect.width / 2) - 150;
  } else if (position === 'right') {
    top = targetRect.top + (targetRect.height / 2) - 100;
    left = targetRect.right + spacing;
  } else if (position === 'left') {
    top = targetRect.top + (targetRect.height / 2) - 100;
    left = targetRect.left - spacing - 300;
  }

  // Boundary checks (simple)
  left = Math.max(10, Math.min(left, window.innerWidth - 310));
  top = Math.max(10, top);

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-black/10 pointer-events-auto"
        onClick={() => {}} // Could be used to click outside to dismiss or similar
      />
      {/* Target highlight ring */}
      <div 
        className="fixed z-40 pointer-events-none ring-4 ring-blue-500 rounded-md transition-all duration-300 ease-in-out"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
        }}
      />
      <div 
        className="fixed z-50 w-[300px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-5 transition-all duration-300 ease-in-out animate-in fade-in zoom-in-95"
        style={{ top, left }}
        role="dialog"
        aria-label="Tour Guide"
      >
        <button 
          onClick={() => dismissTour(activeTour)} 
          className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          aria-label="Close tour"
        >
          <X size={16} />
        </button>
        
        <h3 className="font-semibold text-lg pr-6 mb-2">{currentStep.title}</h3>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4 leading-relaxed">
          {currentStep.content}
        </p>

        <div className="flex items-center justify-between mt-4">
          <div className="text-xs font-medium text-zinc-500">
            Step {currentStepIndex + 1} of {tourSteps.length}
          </div>
          <div className="space-x-2">
            {currentStepIndex > 0 && (
              <Button variant="outline" size="sm" onClick={prevStep}>Back</Button>
            )}
            <Button size="sm" onClick={nextStep}>
              {currentStepIndex === tourSteps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
