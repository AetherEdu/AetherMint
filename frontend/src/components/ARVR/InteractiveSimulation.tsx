'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCw, Settings, Atom, Beaker, Zap, Activity, Clock, Award, BookOpen, Lightbulb, Target } from 'lucide-react';
import { Flask } from '@/utils/missingIcons';

export type SimulationType = 'physics' | 'chemistry' | 'biology' | 'mathematics' | 'engineering' | 'astronomy';
export type ExperimentState = 'idle' | 'running' | 'paused' | 'completed' | 'error';
export type InteractionMode = 'observe' | 'interact' | 'measure' | 'record';

interface SimulationParameter {
  id: string;
  name: string;
  type: 'number' | 'boolean' | 'string' | 'range';
  value: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  description: string;
}

interface SimulationObject {
  id: string;
  name: string;
  type: 'particle' | 'force' | 'field' | 'instrument' | 'container';
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  acceleration: { x: number; y: number; z: number };
  mass: number;
  charge?: number;
  temperature?: number;
  color: string;
  size: number;
  visible: boolean;
  interactive: boolean;
  properties: Record<string, any>;
}

interface SimulationResult {
  id: string;
  timestamp: number;
  data: Record<string, any>;
  measurements: {
    [key: string]: {
      value: number;
      unit: string;
      timestamp: number;
    };
  };
  observations: string[];
  score?: number;
  completed: boolean;
}

interface SimulationExperiment {
  id: string;
  title: string;
  description: string;
  type: SimulationType;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  objectives: string[];
  parameters: SimulationParameter[];
  initialObjects: SimulationObject[];
  expectedResults: SimulationResult[];
  instructions: string[];
  safety: {
    warnings: string[];
    equipment: string[];
  };
  learning: {
    concepts: string[];
    skills: string[];
    outcomes: string[];
  };
}

interface InteractiveSimulationProps {
  experiment: SimulationExperiment;
  onSimulationStart?: (experiment: SimulationExperiment) => void;
  onSimulationComplete?: (result: SimulationResult) => void;
  onParameterChange?: (parameter: SimulationParameter, value: any) => void;
  onObjectInteraction?: (object: SimulationObject, action: string) => void;
  enableRecording?: boolean;
  enableMeasurements?: boolean;
  showControls?: boolean;
  showInstructions?: boolean;
  autoStart?: boolean;
}

export function InteractiveSimulation({
  experiment,
  onSimulationStart,
  onSimulationComplete,
  onParameterChange,
  onObjectInteraction,
  enableRecording = true,
  enableMeasurements = true,
  showControls = true,
  showInstructions = true,
  autoStart = false
}: InteractiveSimulationProps) {
  const [simulationState, setSimulationState] = useState<ExperimentState>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [parameters, setParameters] = useState<SimulationParameter[]>(experiment.parameters);
  const [objects, setObjects] = useState<SimulationObject[]>(experiment.initialObjects);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [currentResult, setCurrentResult] = useState<SimulationResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedData, setRecordedData] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<Record<string, any>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [score, setScore] = useState(0);

  const simulationRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize simulation
  useEffect(() => {
    if (autoStart && simulationState === 'idle') {
      startSimulation();
    }
  }, [autoStart]);

  // Simulation loop
  useEffect(() => {
    if (simulationState === 'running') {
      simulationLoop();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [simulationState]);

  // Timer
  useEffect(() => {
    if (simulationState === 'running' && startTimeRef.current) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [simulationState]);

  // Start simulation
  const startSimulation = useCallback(() => {
    setSimulationState('running');
    setCurrentStep(0);
    setResults([]);
    setCurrentResult(null);
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    
    if (enableRecording) {
      startRecording();
    }
    
    onSimulationStart?.(experiment);
    console.log('Simulation started:', experiment.title);
  }, [experiment, enableRecording, onSimulationStart]);

  // Pause simulation
  const pauseSimulation = useCallback(() => {
    setSimulationState('paused');
    
    if (isRecording) {
      pauseRecording();
    }
    
    console.log('Simulation paused');
  }, [isRecording]);

  // Resume simulation
  const resumeSimulation = useCallback(() => {
    setSimulationState('running');
    
    if (isRecording && !recordedData.length) {
      resumeRecording();
    }
    
    console.log('Simulation resumed');
  }, [isRecording, recordedData]);

  // Reset simulation
  const resetSimulation = useCallback(() => {
    setSimulationState('idle');
    setCurrentStep(0);
    setParameters(experiment.parameters);
    setObjects(experiment.initialObjects);
    setResults([]);
    setCurrentResult(null);
    setElapsedTime(0);
    setScore(0);
    startTimeRef.current = null;
    
    if (isRecording) {
      stopRecording();
    }
    
    console.log('Simulation reset');
  }, [experiment, isRecording]);

  // Complete simulation
  const completeSimulation = useCallback(() => {
    setSimulationState('completed');
    
    const finalResult: SimulationResult = {
      id: `result-${Date.now()}`,
      timestamp: Date.now(),
      data: {
        duration: elapsedTime,
        score,
        steps: currentStep,
        parameters: parameters.reduce((acc, param) => ({ ...acc, [param.id]: param.value }), {}),
        objects: objects.length
      },
      measurements,
      observations: [
        `Simulation completed in ${elapsedTime} seconds`,
        `Final score: ${score}`,
        `Objects processed: ${objects.length}`
      ],
      score,
      completed: true
    };
    
    setCurrentResult(finalResult);
    setResults(prev => [...prev, finalResult]);
    
    if (isRecording) {
      stopRecording();
    }
    
    onSimulationComplete?.(finalResult);
    console.log('Simulation completed:', finalResult);
  }, [elapsedTime, score, currentStep, parameters, objects, measurements, isRecording, onSimulationComplete]);

  // Simulation loop
  const simulationLoop = useCallback(() => {
    if (simulationState !== 'running') return;
    
    const deltaTime = 0.016; // 60 FPS
    
    // Update physics simulation
    updatePhysics(deltaTime);
    
    // Update measurements
    if (enableMeasurements) {
      updateMeasurements();
    }
    
    // Record data
    if (isRecording) {
      recordFrame();
    }
    
    // Check completion conditions
    checkCompletion();
    
    animationFrameRef.current = requestAnimationFrame(simulationLoop);
  }, [simulationState, enableMeasurements, isRecording]);

  // Update physics
  const updatePhysics = (deltaTime: number) => {
    const updatedObjects = objects.map(obj => {
      let newObject = { ...obj };
      
      // Apply forces based on simulation type
      switch (experiment.type) {
        case 'physics':
          newObject = applyPhysicsForces(newObject, deltaTime);
          break;
        case 'chemistry':
          newObject = applyChemistryReactions(newObject, deltaTime);
          break;
        case 'biology':
          newObject = applyBiologyProcesses(newObject, deltaTime);
          break;
        case 'mathematics':
          newObject = applyMathematicalTransformations(newObject, deltaTime);
          break;
        case 'engineering':
          newObject = applyEngineeringPrinciples(newObject, deltaTime);
          break;
        case 'astronomy':
          newObject = applyAstronomicalPhysics(newObject, deltaTime);
          break;
      }
      
      return newObject;
    });
    
    setObjects(updatedObjects);
  };

  // Apply physics forces
  const applyPhysicsForces = (obj: SimulationObject, deltaTime: number): SimulationObject => {
    const gravity = parameters.find(p => p.id === 'gravity')?.value || 9.8;
    const friction = parameters.find(p => p.id === 'friction')?.value || 0.1;
    
    // Apply gravity
    obj.acceleration.y -= gravity;
    
    // Apply friction
    obj.velocity.x *= (1 - friction * deltaTime);
    obj.velocity.z *= (1 - friction * deltaTime);
    
    // Update velocity and position
    obj.velocity.x += obj.acceleration.x * deltaTime;
    obj.velocity.y += obj.acceleration.y * deltaTime;
    obj.velocity.z += obj.acceleration.z * deltaTime;
    
    obj.position.x += obj.velocity.x * deltaTime;
    obj.position.y += obj.velocity.y * deltaTime;
    obj.position.z += obj.velocity.z * deltaTime;
    
    // Boundary collision
    if (obj.position.y < 0) {
      obj.position.y = 0;
      obj.velocity.y *= -0.8; // Bounce
    }
    
    return obj;
  };

  // Apply chemistry reactions
  const applyChemistryReactions = (obj: SimulationObject, deltaTime: number): SimulationObject => {
    const temperature = parameters.find(p => p.id === 'temperature')?.value || 25;
    const concentration = parameters.find(p => p.id === 'concentration')?.value || 1.0;
    
    // Simulate molecular motion based on temperature
    const motionScale = Math.sqrt(temperature / 25);
    
    obj.velocity.x += (Math.random() - 0.5) * motionScale * deltaTime;
    obj.velocity.y += (Math.random() - 0.5) * motionScale * deltaTime;
    obj.velocity.z += (Math.random() - 0.5) * motionScale * deltaTime;
    
    // Update position
    obj.position.x += obj.velocity.x * deltaTime;
    obj.position.y += obj.velocity.y * deltaTime;
    obj.position.z += obj.velocity.z * deltaTime;
    
    // Container boundaries
    const containerSize = 5;
    if (Math.abs(obj.position.x) > containerSize) {
      obj.position.x = Math.sign(obj.position.x) * containerSize;
      obj.velocity.x *= -0.9;
    }
    if (Math.abs(obj.position.y) > containerSize) {
      obj.position.y = Math.sign(obj.position.y) * containerSize;
      obj.velocity.y *= -0.9;
    }
    if (Math.abs(obj.position.z) > containerSize) {
      obj.position.z = Math.sign(obj.position.z) * containerSize;
      obj.velocity.z *= -0.9;
    }
    
    return obj;
  };

  // Apply biology processes
  const applyBiologyProcesses = (obj: SimulationObject, deltaTime: number): SimulationObject => {
    const growthRate = parameters.find(p => p.id === 'growthRate')?.value || 0.1;
    const metabolism = parameters.find(p => p.id === 'metabolism')?.value || 1.0;
    
    // Simulate cell growth
    obj.size *= (1 + growthRate * deltaTime * metabolism);
    
    // Simulate movement (Brownian motion)
    obj.velocity.x += (Math.random() - 0.5) * 0.5 * deltaTime;
    obj.velocity.y += (Math.random() - 0.5) * 0.5 * deltaTime;
    
    obj.position.x += obj.velocity.x * deltaTime;
    obj.position.y += obj.velocity.y * deltaTime;
    
    return obj;
  };

  // Apply mathematical transformations
  const applyMathematicalTransformations = (obj: SimulationObject, deltaTime: number): SimulationObject => {
    const frequency = parameters.find(p => p.id === 'frequency')?.value || 1.0;
    const amplitude = parameters.find(p => p.id === 'amplitude')?.value || 1.0;
    
    // Sinusoidal motion
    const time = elapsedTime;
    obj.position.x = amplitude * Math.sin(frequency * time);
    obj.position.y = amplitude * Math.cos(frequency * time * 0.7);
    
    // Circular motion
    const angle = frequency * time;
    obj.position.z = amplitude * Math.sin(angle) * Math.cos(angle);
    
    return obj;
  };

  // Apply engineering principles
  const applyEngineeringPrinciples = (obj: SimulationObject, deltaTime: number): SimulationObject => {
    const stress = parameters.find(p => p.id === 'stress')?.value || 0;
    const strain = parameters.find(p => p.id === 'strain')?.value || 0;
    
    // Apply stress-strain relationship
    const deformation = stress * (1 + strain);
    
    obj.position.x += deformation * deltaTime;
    obj.position.y += deformation * deltaTime * 0.5;
    
    // Simulate vibration
    const vibration = Math.sin(elapsedTime * 10) * 0.1;
    obj.position.z += vibration;
    
    return obj;
  };

  // Apply astronomical physics
  const applyAstronomicalPhysics = (obj: SimulationObject, deltaTime: number): SimulationObject => {
    const gravitationalConstant = parameters.find(p => p.id === 'G')?.value || 6.67e-11;
    const centralMass = parameters.find(p => p.id === 'centralMass')?.value || 1e30;
    
    // Orbital motion
    const distance = Math.sqrt(obj.position.x ** 2 + obj.position.y ** 2 + obj.position.z ** 2);
    const force = gravitationalConstant * centralMass * obj.mass / (distance ** 2);
    
    // Apply centripetal force
    const angle = Math.atan2(obj.position.y, obj.position.x);
    obj.acceleration.x = -force * Math.cos(angle) / obj.mass;
    obj.acceleration.y = -force * Math.sin(angle) / obj.mass;
    
    // Update velocity and position
    obj.velocity.x += obj.acceleration.x * deltaTime;
    obj.velocity.y += obj.acceleration.y * deltaTime;
    
    obj.position.x += obj.velocity.x * deltaTime;
    obj.position.y += obj.velocity.y * deltaTime;
    
    return obj;
  };

  // Update measurements
  const updateMeasurements = () => {
    const newMeasurements = { ...measurements };
    
    // Calculate common measurements
    const totalKineticEnergy = objects.reduce((sum, obj) => {
      const speed = Math.sqrt(obj.velocity.x ** 2 + obj.velocity.y ** 2 + obj.velocity.z ** 2);
      return sum + 0.5 * obj.mass * speed ** 2;
    }, 0);
    
    const totalMomentum = objects.reduce((sum, obj) => {
      return sum + obj.mass * Math.sqrt(obj.velocity.x ** 2 + obj.velocity.y ** 2 + obj.velocity.z ** 2);
    }, 0);
    
    const centerOfMass = objects.reduce((sum, obj) => {
      return {
        x: sum.x + obj.position.x * obj.mass,
        y: sum.y + obj.position.y * obj.mass,
        z: sum.z + obj.position.z * obj.mass
      };
    }, { x: 0, y: 0, z: 0 });
    
    const totalMass = objects.reduce((sum, obj) => sum + obj.mass, 0);
    
    newMeasurements.kineticEnergy = {
      value: totalKineticEnergy,
      unit: 'J',
      timestamp: Date.now()
    };
    
    newMeasurements.momentum = {
      value: totalMomentum,
      unit: 'kg·m/s',
      timestamp: Date.now()
    };
    
    newMeasurements.centerOfMass = {
      value: Math.sqrt(centerOfMass.x ** 2 + centerOfMass.y ** 2 + centerOfMass.z ** 2) / totalMass,
      unit: 'm',
      timestamp: Date.now()
    };
    
    setMeasurements(newMeasurements);
  };

  // Record frame data
  const recordFrame = () => {
    const frameData = {
      timestamp: Date.now(),
      objects: objects.map(obj => ({
        id: obj.id,
        position: { ...obj.position },
        velocity: { ...obj.velocity },
        properties: { ...obj.properties }
      })),
      measurements: { ...measurements },
      parameters: parameters.reduce((acc, param) => ({ ...acc, [param.id]: param.value }), {})
    };
    
    setRecordedData(prev => [...prev, frameData]);
  };

  // Check completion conditions
  const checkCompletion = () => {
    // Check if objectives are met
    const objectivesMet = experiment.objectives.every(objective => {
      // Simplified objective checking
      if (objective.includes('time') && elapsedTime >= experiment.duration * 60) {
        return true;
      }
      if (objective.includes('measure') && Object.keys(measurements).length > 0) {
        return true;
      }
      return false;
    });
    
    if (objectivesMet || elapsedTime >= experiment.duration * 60) {
      completeSimulation();
    }
  };

  // Recording functions
  const startRecording = () => {
    setIsRecording(true);
    setRecordedData([]);
    console.log('Recording started');
  };

  const pauseRecording = () => {
    setIsRecording(false);
    console.log('Recording paused');
  };

  const resumeRecording = () => {
    setIsRecording(true);
    console.log('Recording resumed');
  };

  const stopRecording = () => {
    setIsRecording(false);
    console.log('Recording stopped. Total frames:', recordedData.length);
  };

  // Handle parameter change
  const handleParameterChange = (parameter: SimulationParameter, value: any) => {
    const updatedParameters = parameters.map(p => 
      p.id === parameter.id ? { ...p, value } : p
    );
    
    setParameters(updatedParameters);
    onParameterChange?.(parameter, value);
  };

  // Handle object interaction
  const handleObjectInteraction = (object: SimulationObject, action: string) => {
    const updatedObjects = objects.map(obj => {
      if (obj.id === object.id) {
        switch (action) {
          case 'select':
            return { ...obj, properties: { ...obj.properties, selected: !obj.properties.selected } };
          case 'delete':
            return { ...obj, visible: false };
          case 'reset':
            return { ...obj, position: experiment.initialObjects.find(o => o.id === obj.id)?.position || obj.position };
          default:
            return obj;
        }
      }
      return obj;
    });
    
    setObjects(updatedObjects.filter(obj => obj.visible));
    onObjectInteraction?.(object, action);
  };

  // Get simulation icon
  const getSimulationIcon = (type: SimulationType) => {
    const icons = {
      'physics': Atom,
      'chemistry': Flask,
      'biology': Beaker,
      'mathematics': Target,
      'engineering': Zap,
      'astronomy': Lightbulb
    };
    return icons[type] || Atom;
  };

  // Get simulation color
  const getSimulationColor = (type: SimulationType) => {
    const colors = {
      'physics': 'text-blue-400',
      'chemistry': 'text-green-400',
      'biology': 'text-purple-400',
      'mathematics': 'text-orange-400',
      'engineering': 'text-red-400',
      'astronomy': 'text-indigo-400'
    };
    return colors[type] || 'text-gray-400';
  };

  // Format time
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!experiment) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Experiment Selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Choose an experiment to start the simulation
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-lg overflow-hidden">
      {/* Simulation Canvas */}
      <div className="absolute inset-0 bg-black/50">
        {/* 3D Visualization Area */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full max-w-4xl max-h-4xl">
            {/* Simulation Objects */}
            {objects.map((obj, index) => (
              <motion.div
                key={obj.id}
                className="absolute"
                style={{
                  left: `${50 + obj.position.x * 10}%`,
                  top: `${50 - obj.position.y * 10}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.1 }}
                onClick={() => obj.interactive && handleObjectInteraction(obj, 'select')}
              >
                <div
                  className="w-8 h-8 rounded-full border-2 shadow-lg cursor-pointer"
                  style={{
                    backgroundColor: obj.color,
                    borderColor: obj.properties.selected ? '#fbbf24' : 'transparent',
                    boxShadow: `0 0 20px ${obj.color}50`
                  }}
                >
                  {/* Object type indicator */}
                  <div className="w-full h-full rounded-full flex items-center justify-center">
                    {(() => {
                      const IconComponent = getSimulationIcon(experiment.type);
                      return <IconComponent className="h-4 w-4 text-white" />;
                    })()}
                  </div>
                </div>
                
                {/* Velocity indicator */}
                {(Math.abs(obj.velocity.x) > 0.1 || Math.abs(obj.velocity.y) > 0.1) && (
                  <div
                    className="absolute top-1/2 left-1/2 w-4 h-0.5 bg-yellow-400 origin-left"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${Math.atan2(obj.velocity.y, obj.velocity.x) * 180 / Math.PI}deg)`,
                      width: `${Math.sqrt(obj.velocity.x ** 2 + obj.velocity.y ** 2) * 20}px`
                    }}
                  />
                )}
              </motion.div>
            ))}
            
            {/* Center indicator */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      {showControls && (
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-3 mb-4">
            {(() => {
              const IconComponent = getSimulationIcon(experiment.type);
              return <IconComponent className={`h-5 w-5 ${getSimulationColor(experiment.type)}`} />;
            })()}
            <h3 className="text-white font-semibold">{experiment.title}</h3>
          </div>

          {/* Experiment Info */}
          <div className="mb-4">
            <div className="text-white text-sm font-medium mb-1">{experiment.title}</div>
            <div className="text-gray-400 text-xs mb-2">{experiment.description}</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Type:</span>
              <span className={getSimulationColor(experiment.type)} capitalize>{experiment.type}</span>
              <span className="text-gray-400">•</span>
              <span className="text-yellow-300 capitalize">{experiment.difficulty}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Duration:</span>
              <span className="text-green-300">{experiment.duration} min</span>
              <span className="text-gray-400">•</span>
              <span className="text-blue-300">{formatTime(elapsedTime)}</span>
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              {simulationState === 'idle' ? (
                <button
                  onClick={startSimulation}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start
                </button>
              ) : simulationState === 'running' ? (
                <button
                  onClick={pauseSimulation}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors flex items-center gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </button>
              ) : simulationState === 'paused' ? (
                <button
                  onClick={resumeSimulation}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Resume
                </button>
              ) : (
                <button
                  onClick={resetSimulation}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <RotateCw className="h-4 w-4" />
                  Reset
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">State:</span>
              <span className={`capitalize ${
                simulationState === 'running' ? 'text-green-400' :
                simulationState === 'completed' ? 'text-blue-400' :
                simulationState === 'paused' ? 'text-yellow-400' :
                simulationState === 'error' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {simulationState}
              </span>
            </div>
          </div>

          {/* Parameters */}
          <div className="mb-4">
            <h4 className="text-white text-sm font-medium mb-2">Parameters</h4>
            <div className="space-y-2">
              {parameters.map((parameter) => (
                <div key={parameter.id} className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs min-w-20">{parameter.name}:</span>
                  {parameter.type === 'range' ? (
                    <input
                      type="range"
                      min={parameter.min}
                      max={parameter.max}
                      step={parameter.step}
                      value={parameter.value}
                      onChange={(e) => handleParameterChange(parameter, parseFloat(e.target.value))}
                      className="flex-1"
                    />
                  ) : parameter.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={parameter.value}
                      onChange={(e) => handleParameterChange(parameter, e.target.checked)}
                      className="rounded"
                    />
                  ) : (
                    <input
                      type="text"
                      value={parameter.value}
                      onChange={(e) => handleParameterChange(parameter, e.target.value)}
                      className="flex-1 px-2 py-1 bg-black/50 border border-gray-500/30 rounded text-white text-sm"
                    />
                  )}
                  {parameter.unit && (
                    <span className="text-gray-400 text-xs">{parameter.unit}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </div>
      )}

      {/* Measurements Panel */}
      {enableMeasurements && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30 max-w-xs">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="h-5 w-5 text-green-400" />
            <h3 className="text-white font-semibold">Measurements</h3>
          </div>

          <div className="space-y-2 text-sm">
            {Object.entries(measurements).map(([key, measurement]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-400 capitalize">{key}:</span>
                <span className="text-green-300 font-mono">
                  {measurement.value.toFixed(2)} {measurement.unit}
                </span>
              </div>
            ))}
            {Object.keys(measurements).length === 0 && (
              <div className="text-gray-400 text-center py-2">
                No measurements yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions Panel */}
      {showInstructions && experiment.instructions.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-purple-500/30 max-w-sm max-h-48 overflow-y-auto">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-5 w-5 text-purple-400" />
            <h3 className="text-white font-semibold">Instructions</h3>
          </div>

          <div className="space-y-2">
            {experiment.instructions.map((instruction, index) => (
              <div key={index} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-300 text-xs font-bold">
                  {index + 1}
                </div>
                <div className="text-white text-sm">{instruction}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objectives Panel */}
      {experiment.objectives.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-orange-500/30 max-w-sm">
          <div className="flex items-center gap-3 mb-4">
            <Target className="h-5 w-5 text-orange-400" />
            <h3 className="text-white font-semibold">Objectives</h3>
          </div>

          <div className="space-y-2">
            {experiment.objectives.map((objective, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 mt-1 flex-shrink-0" />
                <div className="text-white text-sm">{objective}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute bottom-20 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-500/30 w-80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <h3 className="text-white font-semibold mb-4">Simulation Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Recording</label>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`px-3 py-2 rounded text-sm transition-colors ${
                      isRecording 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </button>
                  {isRecording && (
                    <span className="text-white text-sm">
                      {recordedData.length} frames
                    </span>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Measurements</label>
                <div className="flex items-center gap-2 mt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enableMeasurements}
                      onChange={(e) => {
                        // Toggle measurements
                        console.log('Measurements:', e.target.checked);
                      }}
                      className="rounded"
                    />
                    <span className="text-gray-400 text-sm">Auto-measure</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Simulation Speed</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white text-sm">
                  <option value="0.5">0.5x</option>
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="5">5x</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Visualization</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white text-sm">
                  <option value="3d">3D View</option>
                  <option value="2d">2D View</option>
                  <option value="graph">Graph View</option>
                  <option value="data">Data View</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500/20 backdrop-blur-sm rounded-lg p-3 border border-red-500/50">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm font-medium">Recording Simulation</span>
            <span className="text-red-300 text-sm">{recordedData.length} frames</span>
          </div>
        </div>
      )}

      {/* Score Display */}
      {score > 0 && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-green-500/20 backdrop-blur-sm rounded-lg p-3 border border-green-500/50">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-green-400" />
            <span className="text-green-400 text-sm font-medium">Score: {score}</span>
          </div>
        </div>
      )}
    </div>
  );
}
