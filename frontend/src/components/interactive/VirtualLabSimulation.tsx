import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface VirtualLabProps {
  labType: 'chemistry' | 'physics' | 'biology' | 'mathematics';
  title: string;
  description: string;
  onExperimentComplete: (results: any) => void;
  accessibilityMode?: boolean;
}

export interface ExperimentStep {
  id: string;
  title: string;
  description: string;
  action: string;
  expectedResult?: any;
  hint?: string;
}

const VirtualLabSimulation: React.FC<VirtualLabProps> = ({
  labType,
  title,
  description,
  onExperimentComplete,
  accessibilityMode = false
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [experimentData, setExperimentData] = useState<any>({});
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showHint, setShowHint] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const experimentSteps: ExperimentStep[] = [
    {
      id: 'setup',
      title: 'Setup Equipment',
      description: 'Prepare the laboratory equipment and materials',
      action: 'setup',
      hint: 'Click on the equipment to set up your workspace'
    },
    {
      id: 'experiment',
      title: 'Conduct Experiment',
      description: 'Follow the procedure to conduct the experiment',
      action: 'experiment',
      hint: 'Follow the step-by-step instructions carefully'
    },
    {
      id: 'observe',
      title: 'Observe Results',
      description: 'Record your observations and measurements',
      action: 'observe',
      hint: 'Take detailed notes of what you observe'
    },
    {
      id: 'analyze',
      title: 'Analyze Data',
      description: 'Analyze your experimental data and draw conclusions',
      action: 'analyze',
      hint: 'Compare your results with expected outcomes'
    }
  ];

  const drawChemistryLab = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw beaker
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.lineTo(100, 200);
    ctx.lineTo(150, 200);
    ctx.lineTo(150, 100);
    ctx.stroke();
    
    // Draw liquid with animation
    const liquidLevel = 100 + Math.sin(time * 0.001) * 10;
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.fillRect(102, liquidLevel, 46, 200 - liquidLevel);
    
    // Draw bubbles
    for (let i = 0; i < 5; i++) {
      const bubbleY = 200 - (time * 0.1 + i * 20) % 100;
      const bubbleX = 125 + Math.sin(time * 0.002 + i) * 10;
      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.fill();
    }
  }, []);

  const drawPhysicsLab = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw pendulum
    const pivotX = ctx.canvas.width / 2;
    const pivotY = 50;
    const length = 150;
    const angle = Math.sin(time * 0.002) * Math.PI / 6;
    
    const bobX = pivotX + Math.sin(angle) * length;
    const bobY = pivotY + Math.cos(angle) * length;
    
    // Draw string
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    
    // Draw bob
    ctx.beginPath();
    ctx.arc(bobX, bobY, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    
    // Draw pivot
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#374151';
    ctx.fill();
  }, []);

  const drawBiologyLab = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw microscope
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 3;
    
    // Base
    ctx.beginPath();
    ctx.moveTo(100, 200);
    ctx.lineTo(200, 200);
    ctx.stroke();
    
    // Pillar
    ctx.beginPath();
    ctx.moveTo(150, 200);
    ctx.lineTo(150, 100);
    ctx.stroke();
    
    // Arm
    ctx.beginPath();
    ctx.moveTo(150, 100);
    ctx.lineTo(180, 100);
    ctx.stroke();
    
    // Eyepiece
    ctx.beginPath();
    ctx.arc(180, 100, 8, 0, Math.PI * 2);
    ctx.stroke();
    
    // Objective lens
    ctx.beginPath();
    ctx.arc(150, 180, 6, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw sample on stage
    const cellSize = 20;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const x = 130 + i * cellSize;
        const y = 190 + j * cellSize;
        const pulse = Math.sin(time * 0.003 + i + j) * 2;
        
        ctx.beginPath();
        ctx.arc(x, y, 5 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 197, 94, ${0.3 + pulse * 0.1})`;
        ctx.fill();
      }
    }
  }, []);

  const drawMathLab = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw coordinate system
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(50, 150);
    ctx.lineTo(250, 150);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(150, 50);
    ctx.lineTo(150, 250);
    ctx.stroke();
    
    // Draw function (sine wave)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let x = 50; x <= 250; x += 2) {
      const normalizedX = (x - 150) / 50;
      const y = 150 - Math.sin(normalizedX + time * 0.002) * 50;
      
      if (x === 50) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Draw points
    for (let x = 50; x <= 250; x += 25) {
      const normalizedX = (x - 150) / 50;
      const y = 150 - Math.sin(normalizedX + time * 0.002) * 50;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    }
  }, []);

  const animate = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    switch (labType) {
      case 'chemistry':
        drawChemistryLab(ctx, time);
        break;
      case 'physics':
        drawPhysicsLab(ctx, time);
        break;
      case 'biology':
        drawBiologyLab(ctx, time);
        break;
      case 'mathematics':
        drawMathLab(ctx, time);
        break;
    }
    
    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [labType, isRunning, drawChemistryLab, drawPhysicsLab, drawBiologyLab, drawMathLab]);

  useEffect(() => {
    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, animate]);

  const handleStepAction = () => {
    const step = experimentSteps[currentStep];
    
    switch (step.action) {
      case 'setup':
        setExperimentData({ ...experimentData, setup: true });
        break;
      case 'experiment':
        setIsRunning(true);
        setTimeout(() => {
          setIsRunning(false);
          setExperimentData({ ...experimentData, experiment: true, measurements: generateMockData() });
        }, 5000);
        break;
      case 'observe':
        setExperimentData({ ...experimentData, observations: 'Experiment completed successfully' });
        break;
      case 'analyze':
        const finalResults = {
          ...experimentData,
          analysis: 'Results match expected outcomes',
          success: true
        };
        setResults(finalResults);
        onExperimentComplete(finalResults);
        break;
    }
    
    if (currentStep < experimentSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const generateMockData = () => {
    return {
      temperature: 25 + Math.random() * 10,
      pressure: 1 + Math.random() * 0.5,
      time: Math.floor(Math.random() * 100) + 50,
      result: Math.random() > 0.5 ? 'Positive' : 'Negative'
    };
  };

  const resetExperiment = () => {
    setCurrentStep(0);
    setExperimentData({});
    setIsRunning(false);
    setResults(null);
    setShowHint(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600">{description}</p>
      </div>

      {/* Lab Visualization */}
      <div className="mb-6">
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="border border-gray-300 rounded-lg mx-auto"
          aria-label={`${labType} laboratory simulation`}
        />
      </div>

      {/* Experiment Steps */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Experiment Steps</h3>
        <div className="space-y-3">
          {experimentSteps.map((step, index) => (
            <motion.div
              key={step.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                index === currentStep
                  ? 'border-blue-500 bg-blue-50'
                  : index < currentStep
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800">{step.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                </div>
                <div className="ml-4">
                  {index < currentStep ? (
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : index === currentStep ? (
                    <div className="w-6 h-6 bg-blue-500 rounded-full animate-pulse" />
                  ) : (
                    <div className="w-6 h-6 bg-gray-300 rounded-full" />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStepAction}
          disabled={isRunning}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label={experimentSteps[currentStep]?.action}
        >
          {isRunning ? 'Running...' : experimentSteps[currentStep]?.action || 'Start'}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowHint(!showHint)}
          className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          aria-label="Show hint"
        >
          {showHint ? 'Hide Hint' : 'Show Hint'}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={resetExperiment}
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          aria-label="Reset experiment"
        >
          Reset
        </motion.button>
      </div>

      {/* Hint Display */}
      <AnimatePresence>
        {showHint && experimentSteps[currentStep]?.hint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
          >
            <p className="text-sm text-yellow-800">
              <strong>Hint:</strong> {experimentSteps[currentStep].hint}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Experiment Data */}
      {Object.keys(experimentData).length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Experiment Data</h3>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(experimentData, null, 2)}
          </pre>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-green-50 border border-green-200 rounded-lg"
          >
            <h3 className="text-lg font-semibold text-green-800 mb-2">Experiment Complete!</h3>
            <p className="text-green-700">{results.analysis}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VirtualLabSimulation;
