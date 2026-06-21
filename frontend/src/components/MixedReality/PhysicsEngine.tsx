'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Play, Pause, RotateCw, Zap, Target, Wind, Magnet } from 'lucide-react';
import { Weight } from '@/utils/missingIcons';

export type PhysicsEngineType = 'cannon' | 'ammo' | 'custom' | 'rapier';
export type ForceType = 'gravity' | 'magnetic' | 'electric' | 'wind' | 'spring' | 'friction';
export type CollisionType = 'sphere' | 'box' | 'plane' | 'mesh' | 'compound';

interface PhysicsObject {
  id: string;
  type: CollisionType;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  mass: number;
  friction: number;
  restitution: number;
  damping: number;
  angularDamping: number;
  isStatic: boolean;
  isKinematic: boolean;
  material: {
    density: number;
    friction: number;
    restitution: number;
    color: string;
    emissive: string;
  };
  forces: AppliedForce[];
  constraints: Constraint[];
  userData: any;
}

interface AppliedForce {
  id: string;
  type: ForceType;
  magnitude: number;
  direction: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  duration?: number;
  startTime: number;
  active: boolean;
}

interface Constraint {
  id: string;
  type: 'fixed' | 'hinge' | 'slider' | 'spring' | 'ball-socket';
  objectA: string;
  objectB?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  limits?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  stiffness?: number;
  damping?: number;
  motor?: {
    velocity: number;
    force: number;
  };
}

interface CollisionEvent {
  objectA: string;
  objectB: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  impulse: number;
  timestamp: number;
}

interface PhysicsSettings {
  engineType: PhysicsEngineType;
  gravity: { x: number; y: number; z: number };
  timeStep: number;
  maxSubSteps: number;
  broadphase: 'naive' | 'sap' | 'grid' | 'tree';
  solver: 'gs' | 'split' | 'sequential';
  iterations: number;
  warmStarting: boolean;
  enableSleeping: boolean;
  enableFriction: boolean;
  enableCollision: boolean;
}

interface PhysicsEngineProps {
  objects: PhysicsObject[];
  settings: PhysicsSettings;
  onCollision?: (collision: CollisionEvent) => void;
  onObjectUpdate?: (object: PhysicsObject) => void;
  onSimulationStep?: (deltaTime: number) => void;
  enableDebugVisualization?: boolean;
  performanceMode?: 'speed' | 'accuracy' | 'balanced';
  targetFPS?: number;
}

const DEFAULT_SETTINGS: PhysicsSettings = {
  engineType: 'custom',
  gravity: { x: 0, y: -9.81, z: 0 },
  timeStep: 1/60,
  maxSubSteps: 3,
  broadphase: 'grid',
  solver: 'gs',
  iterations: 10,
  warmStarting: true,
  enableSleeping: true,
  enableFriction: true,
  enableCollision: true
};

export function PhysicsEngine({
  objects,
  settings = DEFAULT_SETTINGS,
  onCollision,
  onObjectUpdate,
  onSimulationStep,
  enableDebugVisualization = true,
  performanceMode = 'balanced',
  targetFPS = 60
}: PhysicsEngineProps) {
  const [isRunning, setIsRunning] = useState(true);
  const [simulationTime, setSimulationTime] = useState(0);
  const [physicsObjects, setPhysicsObjects] = useState<PhysicsObject[]>(objects);
  const [collisionEvents, setCollisionEvents] = useState<CollisionEvent[]>([]);
  const [performanceStats, setPerformanceStats] = useState({
    fps: targetFPS,
    frameTime: 1000 / targetFPS,
    objects: objects.length,
    collisions: 0,
    constraints: 0,
    memoryUsage: 0
  });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedObject, setSelectedObject] = useState<PhysicsObject | null>(null);
  
  const animationFrameRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const collisionMatrixRef = useRef<Map<string, Set<string>>>(new Map());

  // Initialize physics engine
  useEffect(() => {
    initializePhysicsEngine();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Initialize physics engine
  const initializePhysicsEngine = () => {
    // Initialize collision matrix
    const collisionMatrix = new Map<string, Set<string>>();
    physicsObjects.forEach(obj => {
      collisionMatrix.set(obj.id, new Set());
    });
    collisionMatrixRef.current = collisionMatrix;
    
    console.log('Physics engine initialized with', physicsObjects.length, 'objects');
  };

  // Main physics simulation loop
  const simulate = useCallback(() => {
    if (!isRunning) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = currentTime;

    // Fixed timestep with accumulator for stable physics
    accumulatorRef.current += deltaTime;
    
    while (accumulatorRef.current >= settings.timeStep) {
      const stepStartTime = performance.now();
      
      // Physics simulation step
      physicsStep(settings.timeStep);
      
      const stepEndTime = performance.now();
      const stepTime = stepEndTime - stepStartTime;
      
      onSimulationStep?.(stepTime);
      accumulatorRef.current -= settings.timeStep;
    }

    // Update performance stats
    updatePerformanceStats(deltaTime);
    
    // Continue simulation loop
    animationFrameRef.current = requestAnimationFrame(simulate);
  }, [isRunning, settings, onSimulationStep]);

  // Physics simulation step
  const physicsStep = (deltaTime: number) => {
    const newObjects = [...physicsObjects];
    const newCollisionEvents: CollisionEvent[] = [];
    
    // Update forces and constraints
    updateForces(newObjects, deltaTime);
    updateConstraints(newObjects, deltaTime);
    
    // Integrate motion
    integrateMotion(newObjects, deltaTime);
    
    // Detect and resolve collisions
    if (settings.enableCollision) {
      const collisions = detectCollisions(newObjects);
      resolveCollisions(newObjects, collisions);
      newCollisionEvents.push(...collisions);
    }
    
    // Apply damping
    applyDamping(newObjects, deltaTime);
    
    // Update state
    setPhysicsObjects(newObjects);
    setCollisionEvents(prev => [...prev.slice(-100), ...newCollisionEvents]);
    setSimulationTime(prev => prev + deltaTime);
    
    // Notify of object updates
    newObjects.forEach(obj => {
      onObjectUpdate?.(obj);
    });
    
    // Notify of collisions
    newCollisionEvents.forEach(collision => {
      onCollision?.(collision);
    });
  };

  // Update forces
  const updateForces = (objects: PhysicsObject[], deltaTime: number) => {
    objects.forEach(obj => {
      if (obj.isStatic) return;
      
      // Apply gravity
      const gravityForce = {
        x: settings.gravity.x * obj.mass,
        y: settings.gravity.y * obj.mass,
        z: settings.gravity.z * obj.mass
      };
      
      obj.velocity.x += (gravityForce.x / obj.mass) * deltaTime;
      obj.velocity.y += (gravityForce.y / obj.mass) * deltaTime;
      obj.velocity.z += (gravityForce.z / obj.mass) * deltaTime;
      
      // Apply custom forces
      obj.forces.forEach(force => {
        if (force.active && (!force.duration || (Date.now() - force.startTime) < force.duration)) {
          obj.velocity.x += (force.direction.x * force.magnitude / obj.mass) * deltaTime;
          obj.velocity.y += (force.direction.y * force.magnitude / obj.mass) * deltaTime;
          obj.velocity.z += (force.direction.z * force.magnitude / obj.mass) * deltaTime;
        } else {
          force.active = false;
        }
      });
    });
  };

  // Update constraints
  const updateConstraints = (objects: PhysicsObject[], deltaTime: number) => {
    objects.forEach(obj => {
      obj.constraints.forEach(constraint => {
        switch (constraint.type) {
          case 'spring':
            applySpringConstraint(objects, constraint, deltaTime);
            break;
          case 'fixed':
            applyFixedConstraint(objects, constraint);
            break;
          case 'hinge':
            applyHingeConstraint(objects, constraint);
            break;
          case 'ball-socket':
            applyBallSocketConstraint(objects, constraint);
            break;
        }
      });
    });
  };

  // Apply spring constraint
  const applySpringConstraint = (objects: PhysicsObject[], constraint: Constraint, deltaTime: number) => {
    const objA = objects.find(o => o.id === constraint.objectA);
    const objB = constraint.objectB ? objects.find(o => o.id === constraint.objectB) : null;
    
    if (!objA) return;
    
    const stiffness = constraint.stiffness || 100;
    const damping = constraint.damping || 10;
    
    if (objB) {
      // Spring between two objects
      const dx = objB.position.x - objA.position.x;
      const dy = objB.position.y - objA.position.y;
      const dz = objB.position.z - objA.position.z;
      
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const restLength = 1.0; // Default rest length
      
      if (distance > 0) {
        const force = stiffness * (distance - restLength);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        const fz = (dz / distance) * force;
        
        // Apply forces to both objects
        objA.velocity.x += (fx / objA.mass) * deltaTime;
        objA.velocity.y += (fy / objA.mass) * deltaTime;
        objA.velocity.z += (fz / objA.mass) * deltaTime;
        
        objB.velocity.x -= (fx / objB.mass) * deltaTime;
        objB.velocity.y -= (fy / objB.mass) * deltaTime;
        objB.velocity.z -= (fz / objB.mass) * deltaTime;
      }
    } else {
      // Spring to fixed point
      const dx = constraint.position.x - objA.position.x;
      const dy = constraint.position.y - objA.position.y;
      const dz = constraint.position.z - objA.position.z;
      
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const restLength = 1.0;
      
      if (distance > 0) {
        const force = stiffness * (distance - restLength);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        const fz = (dz / distance) * force;
        
        objA.velocity.x += (fx / objA.mass) * deltaTime;
        objA.velocity.y += (fy / objA.mass) * deltaTime;
        objA.velocity.z += (fz / objA.mass) * deltaTime;
      }
    }
  };

  // Apply fixed constraint
  const applyFixedConstraint = (objects: PhysicsObject[], constraint: Constraint) => {
    const obj = objects.find(o => o.id === constraint.objectA);
    if (!obj || obj.isStatic) return;
    
    // Fix object to position
    obj.position.x = constraint.position.x;
    obj.position.y = constraint.position.y;
    obj.position.z = constraint.position.z;
    
    obj.rotation.x = constraint.rotation.x;
    obj.rotation.y = constraint.rotation.y;
    obj.rotation.z = constraint.rotation.z;
    
    obj.velocity = { x: 0, y: 0, z: 0 };
    obj.angularVelocity = { x: 0, y: 0, z: 0 };
  };

  // Apply hinge constraint
  const applyHingeConstraint = (objects: PhysicsObject[], constraint: Constraint) => {
    const obj = objects.find(o => o.id === constraint.objectA);
    if (!obj || obj.isStatic) return;
    
    // Limit rotation around hinge axis (simplified)
    const axis = constraint.rotation;
    const limits = constraint.limits;
    
    if (limits) {
      // Clamp rotation to limits
      obj.rotation.x = Math.max(limits.min.x, Math.min(limits.max.x, obj.rotation.x));
      obj.rotation.y = Math.max(limits.min.y, Math.min(limits.max.y, obj.rotation.y));
      obj.rotation.z = Math.max(limits.min.z, Math.min(limits.max.z, obj.rotation.z));
    }
  };

  // Apply ball-socket constraint
  const applyBallSocketConstraint = (objects: PhysicsObject[], constraint: Constraint) => {
    const obj = objects.find(o => o.id === constraint.objectA);
    if (!obj || obj.isStatic) return;
    
    // Keep object at constraint position
    obj.position.x = constraint.position.x;
    obj.position.y = constraint.position.y;
    obj.position.z = constraint.position.z;
  };

  // Integrate motion
  const integrateMotion = (objects: PhysicsObject[], deltaTime: number) => {
    objects.forEach(obj => {
      if (obj.isStatic || obj.isKinematic) return;
      
      // Verlet integration
      obj.position.x += obj.velocity.x * deltaTime;
      obj.position.y += obj.velocity.y * deltaTime;
      obj.position.z += obj.velocity.z * deltaTime;
      
      obj.rotation.x += obj.angularVelocity.x * deltaTime;
      obj.rotation.y += obj.angularVelocity.y * deltaTime;
      obj.rotation.z += obj.angularVelocity.z * deltaTime;
    });
  };

  // Detect collisions
  const detectCollisions = (objects: PhysicsObject[]): CollisionEvent[] => {
    const collisions: CollisionEvent[] = [];
    const collisionMatrix = collisionMatrixRef.current;
    
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const objA = objects[i];
        const objB = objects[j];
        
        // Skip if both are static
        if (objA.isStatic && objB.isStatic) continue;
        
        // Check if already colliding
        if (collisionMatrix.get(objA.id)?.has(objB.id)) continue;
        
        // Simple sphere-sphere collision detection
        const collision = checkSphereCollision(objA, objB);
        if (collision) {
          collisions.push(collision);
          collisionMatrix.get(objA.id)?.add(objB.id);
          collisionMatrix.get(objB.id)?.add(objA.id);
        } else {
          // Remove from collision matrix if no longer colliding
          collisionMatrix.get(objA.id)?.delete(objB.id);
          collisionMatrix.get(objB.id)?.delete(objA.id);
        }
      }
    }
    
    return collisions;
  };

  // Check sphere collision
  const checkSphereCollision = (objA: PhysicsObject, objB: PhysicsObject): CollisionEvent | null => {
    const dx = objB.position.x - objA.position.x;
    const dy = objB.position.y - objA.position.y;
    const dz = objB.position.z - objA.position.z;
    
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const radiusA = getBoundingSphereRadius(objA);
    const radiusB = getBoundingSphereRadius(objB);
    
    if (distance < radiusA + radiusB) {
      const normal = {
        x: dx / distance,
        y: dy / distance,
        z: dz / distance
      };
      
      return {
        objectA: objA.id,
        objectB: objB.id,
        position: {
          x: objA.position.x + normal.x * radiusA,
          y: objA.position.y + normal.y * radiusA,
          z: objA.position.z + normal.z * radiusA
        },
        normal,
        impulse: 0,
        timestamp: Date.now()
      };
    }
    
    return null;
  };

  // Get bounding sphere radius
  const getBoundingSphereRadius = (obj: PhysicsObject): number => {
    // Simplified radius calculation based on object type
    switch (obj.type) {
      case 'sphere':
        return 0.5; // Assuming unit sphere
      case 'box':
        return Math.sqrt(3 * 0.5 * 0.5); // Diagonal of unit box
      case 'plane':
        return 0.1; // Very thin
      default:
        return 0.5;
    }
  };

  // Resolve collisions
  const resolveCollisions = (objects: PhysicsObject[], collisions: CollisionEvent[]) => {
    collisions.forEach(collision => {
      const objA = objects.find(o => o.id === collision.objectA);
      const objB = objects.find(o => o.id === collision.objectB);
      
      if (!objA || !objB) return;
      
      // Calculate relative velocity
      const relativeVelocity = {
        x: objB.velocity.x - objA.velocity.x,
        y: objB.velocity.y - objA.velocity.y,
        z: objB.velocity.z - objA.velocity.z
      };
      
      // Calculate relative velocity along collision normal
      const velocityAlongNormal = 
        relativeVelocity.x * collision.normal.x +
        relativeVelocity.y * collision.normal.y +
        relativeVelocity.z * collision.normal.z;
      
      // Don't resolve if velocities are separating
      if (velocityAlongNormal > 0) return;
      
      // Calculate restitution
      const restitution = Math.min(objA.material.restitution, objB.material.restitution);
      
      // Calculate impulse scalar
      const impulseScalar = -(1 + restitution) * velocityAlongNormal;
      impulseScalar /= (1 / objA.mass) + (1 / objB.mass);
      
      // Apply impulse
      const impulse = {
        x: impulseScalar * collision.normal.x,
        y: impulseScalar * collision.normal.y,
        z: impulseScalar * collision.normal.z
      };
      
      if (!objA.isStatic) {
        objA.velocity.x -= (impulse.x / objA.mass);
        objA.velocity.y -= (impulse.y / objA.mass);
        objA.velocity.z -= (impulse.z / objA.mass);
      }
      
      if (!objB.isStatic) {
        objB.velocity.x += (impulse.x / objB.mass);
        objB.velocity.y += (impulse.y / objB.mass);
        objB.velocity.z += (impulse.z / objB.mass);
      }
      
      // Position correction to prevent sinking
      const percent = 0.2; // 20% penetration to solve
      const slop = 0.01; // 0.01m tolerance
      const maxPenetration = 0.1; // Maximum penetration
      
      const dx = objB.position.x - objA.position.x;
      const dy = objB.position.y - objA.position.y;
      const dz = objB.position.z - objA.position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      const penetration = (getBoundingSphereRadius(objA) + getBoundingSphereRadius(objB)) - distance;
      
      if (penetration > slop) {
        const correctionMagnitude = Math.max(penetration - slop, 0) / (1 / objA.mass + 1 / objB.mass) * percent;
        const correction = {
          x: collision.normal.x * correctionMagnitude,
          y: collision.normal.y * correctionMagnitude,
          z: collision.normal.z * correctionMagnitude
        };
        
        if (!objA.isStatic) {
          objA.position.x -= correction.x / objA.mass;
          objA.position.y -= correction.y / objA.mass;
          objA.position.z -= correction.z / objA.mass;
        }
        
        if (!objB.isStatic) {
          objB.position.x += correction.x / objB.mass;
          objB.position.y += correction.y / objB.mass;
          objB.position.z += correction.z / objB.mass;
        }
      }
    });
  };

  // Apply damping
  const applyDamping = (objects: PhysicsObject[], deltaTime: number) => {
    objects.forEach(obj => {
      if (obj.isStatic) return;
      
      // Linear damping
      obj.velocity.x *= Math.pow(1 - obj.damping, deltaTime);
      obj.velocity.y *= Math.pow(1 - obj.damping, deltaTime);
      obj.velocity.z *= Math.pow(1 - obj.damping, deltaTime);
      
      // Angular damping
      obj.angularVelocity.x *= Math.pow(1 - obj.angularDamping, deltaTime);
      obj.angularVelocity.y *= Math.pow(1 - obj.angularDamping, deltaTime);
      obj.angularVelocity.z *= Math.pow(1 - obj.angularDamping, deltaTime);
    });
  };

  // Update performance stats
  const updatePerformanceStats = (deltaTime: number) => {
    const fps = Math.round(1 / deltaTime);
    const frameTime = Math.round(deltaTime * 1000);
    const totalConstraints = physicsObjects.reduce((sum, obj) => sum + obj.constraints.length, 0);
    
    setPerformanceStats({
      fps,
      frameTime,
      objects: physicsObjects.length,
      collisions: collisionEvents.length,
      constraints: totalConstraints,
      memoryUsage: 0 // Would be calculated from actual memory usage
    });
  };

  // Start simulation
  useEffect(() => {
    if (isRunning) {
      lastFrameTimeRef.current = performance.now();
      simulate();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, simulate]);

  // Add force to object
  const addForce = useCallback((objectId: string, force: AppliedForce) => {
    setPhysicsObjects(prev => prev.map(obj => 
      obj.id === objectId 
        ? { ...obj, forces: [...obj.forces, force] }
        : obj
    ));
  }, []);

  // Remove force from object
  const removeForce = useCallback((objectId: string, forceId: string) => {
    setPhysicsObjects(prev => prev.map(obj => 
      obj.id === objectId 
        ? { ...obj, forces: obj.forces.filter(f => f.id !== forceId) }
        : obj
    ));
  }, []);

  // Reset simulation
  const resetSimulation = useCallback(() => {
    setPhysicsObjects(objects);
    setCollisionEvents([]);
    setSimulationTime(0);
    accumulatorRef.current = 0;
  }, [objects]);

  // Get physics icon
  const getPhysicsIcon = (type: ForceType) => {
    const icons = {
      'gravity': Weight,
      'magnetic': Magnet,
      'electric': Zap,
      'wind': Wind,
      'spring': Box,
      'friction': Target
    };
    return icons[type] || Zap;
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Physics Visualization */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
        {/* 3D Physics Space */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Box className="h-16 w-16 text-blue-400 mx-auto mb-4 animate-pulse" />
            <h3 className="text-white text-xl font-semibold mb-2">Physics Engine</h3>
            <p className="text-gray-400 text-sm">Real-time physics simulation</p>
          </div>
        </div>

        {/* Physics Objects Visualization */}
        {enableDebugVisualization && physicsObjects.map((obj, index) => (
          <motion.div
            key={obj.id}
            className="absolute"
            style={{
              left: `${50 + obj.position.x * 20}%`,
              top: `${50 - obj.position.y * 20}%`,
              transform: 'translate(-50%, -50%)'
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => setSelectedObject(obj)}
          >
            <div className="relative">
              {/* Object representation */}
              <div 
                className="w-8 h-8 rounded-full border-2 shadow-lg"
                style={{
                  backgroundColor: obj.material.color,
                  borderColor: obj.material.emissive,
                  boxShadow: `0 0 20px ${obj.material.emissive}`
                }}
              />
              
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
              
              {/* Object info */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded px-2 py-1 min-w-max">
                <div className="text-white text-xs font-medium">{obj.id}</div>
                <div className="text-gray-300 text-xs">{obj.type}</div>
                <div className="text-blue-300 text-xs">Mass: {obj.mass.toFixed(1)}</div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Collision indicators */}
        {collisionEvents.slice(-5).map((collision, index) => (
          <motion.div
            key={`${collision.objectA}-${collision.objectB}-${collision.timestamp}`}
            className="absolute w-4 h-4 bg-red-500 rounded-full animate-ping"
            style={{
              left: `${50 + collision.position.x * 20}%`,
              top: `${50 - collision.position.y * 20}%`,
              transform: 'translate(-50%, -50%)'
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1 }}
          />
        ))}
      </div>

      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
        <div className="flex items-center gap-3 mb-4">
          <Box className="h-5 w-5 text-blue-400" />
          <h3 className="text-white font-semibold">Physics Engine</h3>
        </div>

        {/* Simulation Controls */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`p-2 rounded transition-colors ${
                isRunning 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={resetSimulation}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Status:</span>
            <span className={isRunning ? 'text-green-400' : 'text-red-400'}>
              {isRunning ? 'Running' : 'Paused'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Time:</span>
            <span className="text-blue-400 font-mono">{simulationTime.toFixed(2)}s</span>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">FPS:</span>
            <span className={`font-mono ${performanceStats.fps >= targetFPS * 0.9 ? 'text-green-400' : 'text-yellow-400'}`}>
              {performanceStats.fps}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Frame Time:</span>
            <span className="text-blue-400 font-mono">{performanceStats.frameTime}ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Objects:</span>
            <span className="text-purple-400 font-mono">{performanceStats.objects}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Collisions:</span>
            <span className="text-red-400 font-mono">{performanceStats.collisions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Constraints:</span>
            <span className="text-green-400 font-mono">{performanceStats.constraints}</span>
          </div>
        </div>
      </div>

      {/* Object Properties */}
      {selectedObject && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-purple-500/30 max-w-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Object Properties</h3>
            <button
              onClick={() => setSelectedObject(null)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-400">ID:</span>
              <span className="text-white ml-2">{selectedObject.id}</span>
            </div>
            <div>
              <span className="text-gray-400">Type:</span>
              <span className="text-white ml-2">{selectedObject.type}</span>
            </div>
            <div>
              <span className="text-gray-400">Mass:</span>
              <span className="text-white ml-2">{selectedObject.mass.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-400">Position:</span>
              <span className="text-white ml-2 font-mono text-xs">
                ({selectedObject.position.x.toFixed(1)}, {selectedObject.position.y.toFixed(1)}, {selectedObject.position.z.toFixed(1)})
              </span>
            </div>
            <div>
              <span className="text-gray-400">Velocity:</span>
              <span className="text-white ml-2 font-mono text-xs">
                ({selectedObject.velocity.x.toFixed(1)}, {selectedObject.velocity.y.toFixed(1)}, {selectedObject.velocity.z.toFixed(1)})
              </span>
            </div>
            <div>
              <span className="text-gray-400">Forces:</span>
              <div className="mt-1 space-y-1">
                {selectedObject.forces.map(force => {
                  const IconComponent = getPhysicsIcon(force.type);
                  return (
                    <div key={force.id} className="flex items-center gap-2 text-xs">
                      <IconComponent className="h-3 w-3 text-blue-400" />
                      <span className="text-white">{force.type}</span>
                      <span className="text-gray-300">{force.magnitude.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute bottom-4 right-4 p-2 bg-black/80 backdrop-blur-md rounded-lg border border-gray-500/30 text-white hover:bg-black/90 transition-colors"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute bottom-16 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-500/30 w-80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <h3 className="text-white font-semibold mb-4">Physics Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Engine Type</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="custom">Custom</option>
                  <option value="cannon">Cannon.js</option>
                  <option value="ammo">Ammo.js</option>
                  <option value="rapier">Rapier</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Gravity</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <input
                    type="number"
                    step="0.1"
                    value={settings.gravity.x}
                    onChange={(e) => {
                      // Update gravity
                    }}
                    className="p-1 bg-black/50 border border-gray-500/30 rounded text-white text-sm"
                    placeholder="X"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={settings.gravity.y}
                    onChange={(e) => {
                      // Update gravity
                    }}
                    className="p-1 bg-black/50 border border-gray-500/30 rounded text-white text-sm"
                    placeholder="Y"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={settings.gravity.z}
                    onChange={(e) => {
                      // Update gravity
                    }}
                    className="p-1 bg-black/50 border border-gray-500/30 rounded text-white text-sm"
                    placeholder="Z"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Time Step</label>
                <input
                  type="number"
                  step="0.001"
                  value={settings.timeStep}
                  onChange={(e) => {
                    // Update time step
                  }}
                  className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white"
                />
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Performance Mode</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="speed">Speed</option>
                  <option value="accuracy">Accuracy</option>
                  <option value="balanced">Balanced</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableCollision}
                    onChange={(e) => {
                      // Toggle collision
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Enable Collision</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableFriction}
                    onChange={(e) => {
                      // Toggle friction
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Enable Friction</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableSleeping}
                    onChange={(e) => {
                      // Toggle sleeping
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Enable Sleeping</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
