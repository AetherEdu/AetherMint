/**
 * useSkillAcquisition Hook
 * Custom React hook for managing skill transfer through nanotechnology
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getLearningProtocolService,
  type LearningProtocolService
} from '../services/nanotech/learningProtocol';
import {
  getSkillTrackerService,
  type SkillTrackerService
} from '../services/nanotech/skillTracker';
import type { Skill, SkillTracking, NanobotSwarm, UseSkillAcquisitionReturn } from '../types/nanotech';

export function useSkillAcquisition(userId: string): UseSkillAcquisitionReturn {
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null);
  const [tracking, setTracking] = useState<SkillTracking | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [swarmStatus, setSwarmStatus] = useState<NanobotSwarm | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const protocolRef = useRef<LearningProtocolService | null>(null);
  const trackerRef = useRef<SkillTrackerService | null>(null);
  const unsubscribeRef = useRef<(() => void)[] | null>(null);

  // Initialize services
  useEffect(() => {
    protocolRef.current = getLearningProtocolService(userId);
    trackerRef.current = getSkillTrackerService(userId);

    return () => {
      // Services persist for reuse
    };
  }, [userId]);

  // Setup event listeners
  useEffect(() => {
    if (!protocolRef.current || !trackerRef.current) return;

    const subscriptions: (() => void)[] = [];

    const protocol = protocolRef.current;
    const tracker = trackerRef.current;

    // Listen to session start
    const unsubStart = protocol.on('sessionStarted', (data: { sessionId: string; skillId: string }) => {
      console.log(`Skill acquisition started: ${data.skillId}`);
      setIsTransferring(true);
      setError(null);
    });
    subscriptions.push(unsubStart);

    // Listen to progress updates
    const unsubProgress = protocol.on(
      'knowledgeTransferProgress',
      (data: { progress: number; knowledgeTransferred: number }) => {
        // Update tracking display
        if (tracking) {
          setTracking({
            ...tracking,
            acquisitionProgress: data.progress
          });
        }
      }
    );
    subscriptions.push(unsubProgress);

    // Listen to session completion
    const unsubComplete = protocol.on(
      'sessionCompleted',
      (data: { duration: number; skillProgress: number; neuroplasticityGain?: number }) => {
        setIsTransferring(false);
        console.log(`Skill acquisition completed: ${data.skillProgress}% progress`);
      }
    );
    subscriptions.push(unsubComplete);

    // Listen to tracker progress
    const unsubTracker = tracker.on('progressUpdated', (data: { skillId: string; progress: number }) => {
      if (tracking && tracking.skillId === data.skillId) {
        setTracking({
          ...tracking,
          acquisitionProgress: data.progress
        });
      }
    });
    subscriptions.push(unsubTracker);

    // Listen to skill mastery
    const unsubMastery = tracker.on(
      'skillMastered',
      (data: { skillId: string; masteryLevel: number; certificateId: string }) => {
        if (tracking && tracking.skillId === data.skillId) {
          setTracking({
            ...tracking,
            verified: true,
            masteryLevel: data.masteryLevel,
            certificateId: data.certificateId
          });
        }
      }
    );
    subscriptions.push(unsubMastery);

    unsubscribeRef.current = subscriptions;

    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, [tracking]);

  /**
   * Initiate skill acquisition/transfer
   */
  const initiateTransfer = useCallback(
    async (skillId: string, skillData?: Skill) => {
      if (!protocolRef.current || !trackerRef.current) {
        throw new Error('Services not initialized');
      }

      try {
        setError(null);

        // Create mock skill if not provided
        const skill: Skill = skillData || {
          id: skillId,
          name: `Skill ${skillId}`,
          category: 'cognitive',
          difficulty: 3,
          prerequisiteSkills: [],
          estimatedLearningTime: 60000,
          knowledgeBlocks: [],
          totalKnowledge: 0,
          testQuestions: [],
          masteryThreshold: 80
        };

        setCurrentSkill(skill);

        // Start learning session through protocol
        const session = await protocolRef.current.startLearningSession(skill, {
          difficulty: skill.difficulty
        });

        // Get tracker for this skill
        const skillTracking = trackerRef.current.getSkillTracking(skill.id);
        if (skillTracking) {
          setTracking(skillTracking);
        }

        setIsTransferring(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsTransferring(false);
        throw error;
      }
    },
    []
  );

  /**
   * Stop transfer (pause or cancel)
   */
  const stopTransfer = useCallback(async () => {
    if (!protocolRef.current) {
      throw new Error('Service not initialized');
    }

    try {
      setError(null);
      await protocolRef.current.abortSession('User paused transfer');
      setIsTransferring(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, []);

  /**
   * Get progress percentage
   */
  const getProgress = useCallback(() => {
    if (!protocolRef.current) return 0;

    const session = protocolRef.current.getActiveSession();
    if (!session) return 0;

    return session.skillProgress;
  }, []);

  return {
    currentSkill,
    tracking,
    isTransferring,
    swarmStatus,
    error,
    initiateTransfer,
    stopTransfer,
    getProgress
  };
}
