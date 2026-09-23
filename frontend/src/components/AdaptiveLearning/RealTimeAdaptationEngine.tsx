'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Brain, Eye, Settings, Activity, Layers, Target, Sparkles } from 'lucide-react';
import { LearningStyle } from './LearningStyleDetector';
import { LayoutConfiguration } from './DynamicLayoutAdapter';
import { AccessibilityMode } from './AccessibilityAutoSwitch';
import { DifficultyLevel } from './DifficultyAdjustmentEngine';

export type AdaptationTrigger = 'performance' | 'preference' | 'context' | 'accessibility' | 'difficulty' | 'interaction';
export type AdaptationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AdaptationEvent {
  id: string;
  timestamp: string;
  trigger: AdaptationTrigger;
  component: string;
  previousState: any;
  newState: any;
  priority: AdaptationPriority;
  confidence: number;
  applied: boolean;
  success: boolean;
  userFeedback?: 'positive' | 'negative' | 'neutral';
}

export interface AdaptationRule {
  id: string;
  name: string;
  description: string;
  trigger: AdaptationTrigger;
  condition: (metrics: any) => boolean;
  action: (context: any) => void;
  priority: AdaptationPriority;
  enabled: boolean;
  cooldown: number; // milliseconds
  lastApplied?: number;
}

export interface AdaptationContext {
  userId: string;
  learningStyle: LearningStyle;
  currentLayout: LayoutConfiguration;
  accessibilityMode: AccessibilityMode;
  difficultyLevel: DifficultyLevel;
  performanceMetrics: {
    engagement: number;
    accuracy: number;
    speed: number;
    frustration: number;
    retention: number;
  };
  interactionPatterns: {
    clickFrequency: number;
    scrollBehavior: string;
    keyboardUsage: number;
    helpRequests: number;
  };
  environment: {
    deviceType: 'mobile' | 'tablet' | 'desktop';
    screenSize: { width: number; height: number };
    connectionSpeed: 'slow' | 'medium' | 'fast';
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  };
}

interface RealTimeAdaptationEngineProps {
  context: AdaptationContext;
  onAdaptationApplied?: (event: AdaptationEvent) => void;
  onRuleTriggered?: (rule: AdaptationRule) => void;
  enableRealTimeAdaptation?: boolean;
  adaptationSpeed?: 'fast' | 'normal' | 'slow';
  maxAdaptationsPerMinute?: number;
  showAdaptationLog?: boolean;
}

const DEFAULT_RULES: AdaptationRule[] = [
  {
    id: 'performance-based-layout',
    name: 'Performance-Based Layout Adjustment',
    description: 'Adjust layout based on user performance metrics',
    trigger: 'performance',
    condition: (metrics) => metrics.engagement < 0.5 || metrics.accuracy < 0.6,
    action: (context) => {
      console.log('Adjusting layout for low performance');
      // Would trigger layout simplification
    },
    priority: 'high',
    enabled: true,
    cooldown: 30000
  },
  {
    id: 'accessibility-auto-switch',
    name: 'Accessibility Mode Auto-Switch',
    description: 'Automatically switch accessibility modes based on behavior',
    trigger: 'accessibility',
    condition: (metrics) => metrics.helpRequests > 5 || metrics.speed < 0.3,
    action: (context) => {
      console.log('Switching to enhanced accessibility mode');
      // Would trigger accessibility mode change
    },
    priority: 'critical',
    enabled: true,
    cooldown: 10000
  },
  {
    id: 'difficulty-adjustment',
    name: 'Dynamic Difficulty Adjustment',
    description: 'Adjust difficulty based on performance patterns',
    trigger: 'difficulty',
    condition: (metrics) => metrics.accuracy > 0.9 || metrics.accuracy < 0.4,
    action: (context) => {
      console.log('Adjusting difficulty level');
      // Would trigger difficulty change
    },
    priority: 'medium',
    enabled: true,
    cooldown: 45000
  },
  {
    id: 'interaction-optimization',
    name: 'Interaction Pattern Optimization',
    description: 'Optimize UI based on interaction patterns',
    trigger: 'interaction',
    condition: (metrics) => metrics.keyboardUsage > 0.7 || metrics.clickFrequency > 10,
    action: (context) => {
      console.log('Optimizing for interaction patterns');
      // Would trigger interaction optimization
    },
    priority: 'medium',
    enabled: true,
    cooldown: 20000
  },
  {
    id: 'environmental-adaptation',
    name: 'Environmental Adaptation',
    description: 'Adapt to environmental factors',
    trigger: 'context',
    condition: (metrics) => metrics.deviceType === 'mobile' || metrics.connectionSpeed === 'slow',
    action: (context) => {
      console.log('Adapting to environmental constraints');
      // Would trigger environmental adaptations
    },
    priority: 'low',
    enabled: true,
    cooldown: 60000
  }
];

export function RealTimeAdaptationEngine({
  context,
  onAdaptationApplied,
  onRuleTriggered,
  enableRealTimeAdaptation = true,
  adaptationSpeed = 'normal',
  maxAdaptationsPerMinute = 5,
  showAdaptationLog = true
}: RealTimeAdaptationEngineProps) {
  const [adaptationHistory, setAdaptationHistory] = useState<AdaptationEvent[]>([]);
  const [activeRules, setActiveRules] = useState<AdaptationRule[]>(DEFAULT_RULES);
  const [isAdapting, setIsAdapting] = useState(false);
  const [adaptationRate, setAdaptationRate] = useState(0);
  const [recentAdaptations, setRecentAdaptations] = useState<AdaptationEvent[]>([]);

  // Track adaptation rate
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recentCount = adaptationHistory.filter(event => 
        new Date(event.timestamp).getTime() > oneMinuteAgo
      ).length;
      
      setAdaptationRate(recentCount);
    }, 5000);

    return () => clearInterval(interval);
  }, [adaptationHistory]);

  // Real-time adaptation monitoring
  useEffect(() => {
    if (!enableRealTimeAdaptation) return;

    const monitorAndAdapt = () => {
      // Check if we're exceeding the adaptation rate limit
      if (adaptationRate >= maxAdaptationsPerMinute) {
        console.log('Adaptation rate limit reached, skipping this cycle');
        return;
      }

      setIsAdapting(true);

      // Evaluate all enabled rules
      const triggeredRules: AdaptationRule[] = [];
      
      activeRules.forEach(rule => {
        if (!rule.enabled) return;

        // Check cooldown
        const now = Date.now();
        if (rule.lastApplied && (now - rule.lastApplied) < rule.cooldown) {
          return;
        }

        // Evaluate condition
        const metrics = getMetricsForTrigger(rule.trigger, context);
        if (rule.condition(metrics)) {
          triggeredRules.push(rule);
        }
      });

      // Apply adaptations based on priority
      const sortedRules = triggeredRules.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Apply highest priority adaptation
      if (sortedRules.length > 0) {
        const ruleToApply = sortedRules[0];
        applyAdaptation(ruleToApply);
      }

      setTimeout(() => setIsAdapting(false), 1000);
    };

    const adaptationInterval = getAdaptationInterval(adaptationSpeed);
    const interval = setInterval(monitorAndAdapt, adaptationInterval);

    return () => clearInterval(interval);
  }, [enableRealTimeAdaptation, adaptationSpeed, maxAdaptationsPerMinute, adaptationRate, activeRules, context]);

  // Get metrics for specific trigger
  const getMetricsForTrigger = useCallback((trigger: AdaptationTrigger, ctx: AdaptationContext) => {
    switch (trigger) {
      case 'performance':
        return ctx.performanceMetrics;
      case 'accessibility':
        return {
          helpRequests: ctx.interactionPatterns.helpRequests,
          speed: ctx.performanceMetrics.speed,
          engagement: ctx.performanceMetrics.engagement
        };
      case 'difficulty':
        return {
          accuracy: ctx.performanceMetrics.accuracy,
          speed: ctx.performanceMetrics.speed,
          frustration: ctx.performanceMetrics.frustration
        };
      case 'interaction':
        return ctx.interactionPatterns;
      case 'context':
        return ctx.environment;
      default:
        return ctx.performanceMetrics;
    }
  }, []);

  // Apply adaptation
  const applyAdaptation = useCallback((rule: AdaptationRule) => {
    const now = Date.now();
    
    const adaptationEvent: AdaptationEvent = {
      id: `${rule.id}-${now}`,
      timestamp: new Date().toISOString(),
      trigger: rule.trigger,
      component: 'UI',
      previousState: context,
      newState: { ...context }, // Would be updated with actual changes
      priority: rule.priority,
      confidence: 0.8,
      applied: true,
      success: true
    };

    // Apply the rule action
    try {
      rule.action(context);
      
      // Update rule's last applied time
      setActiveRules(prev => prev.map(r => 
        r.id === rule.id ? { ...r, lastApplied: now } : r
      ));

      // Record adaptation
      setAdaptationHistory(prev => [...prev.slice(-100), adaptationEvent]);
      setRecentAdaptations(prev => [adaptationEvent, ...prev.slice(-4)]);
      
      onAdaptationApplied?.(adaptationEvent);
      onRuleTriggered?.(rule);
      
      console.log(`Applied adaptation: ${rule.name}`);
    } catch (error) {
      console.error(`Failed to apply adaptation ${rule.name}:`, error);
      
      const failedEvent = { ...adaptationEvent, success: false };
      setAdaptationHistory(prev => [...prev.slice(-100), failedEvent]);
    }
  }, [context, onAdaptationApplied, onRuleTriggered]);

  // Get adaptation interval based on speed
  const getAdaptationInterval = (speed: string): number => {
    switch (speed) {
      case 'fast': return 2000;
      case 'normal': return 5000;
      case 'slow': return 10000;
      default: return 5000;
    }
  };

  // Toggle rule
  const toggleRule = useCallback((ruleId: string) => {
    setActiveRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  }, []);

  // Manual adaptation trigger
  const triggerManualAdaptation = useCallback((trigger: AdaptationTrigger) => {
    const applicableRules = activeRules.filter(rule => 
      rule.trigger === trigger && rule.enabled
    );
    
    if (applicableRules.length > 0) {
      const rule = applicableRules[0];
      applyAdaptation(rule);
    }
  }, [activeRules, applyAdaptation]);

  // Calculate adaptation statistics
  const adaptationStats = useMemo(() => {
    const total = adaptationHistory.length;
    const successful = adaptationHistory.filter(a => a.success).length;
    const byTrigger = adaptationHistory.reduce((acc, event) => {
      acc[event.trigger] = (acc[event.trigger] || 0) + 1;
      return acc;
    }, {} as Record<AdaptationTrigger, number>);
    
    return {
      total,
      successful,
      successRate: total > 0 ? successful / total : 0,
      byTrigger,
      rate: adaptationRate
    };
  }, [adaptationHistory, adaptationRate]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Real-Time Adaptation Engine
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isAdapting ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isAdapting ? 'Adapting' : 'Monitoring'}
          </span>
        </div>
      </div>

      {/* Adaptation Status */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {adaptationStats.total}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Total Adaptations
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(adaptationStats.successRate * 100)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Success Rate
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {adaptationStats.rate}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Per Minute
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {activeRules.filter(r => r.enabled).length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Active Rules
            </div>
          </div>
        </div>
      </div>

      {/* Active Rules */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Adaptation Rules
        </h4>
        <div className="space-y-2">
          {activeRules.map((rule) => (
            <div key={rule.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`w-4 h-4 rounded ${
                      rule.enabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {rule.name}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {rule.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    rule.priority === 'critical' ? 'bg-red-100 text-red-800' :
                    rule.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    rule.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {rule.priority}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {rule.trigger}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Triggers */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Manual Triggers
        </h4>
        <div className="flex flex-wrap gap-2">
          {(['performance', 'accessibility', 'difficulty', 'interaction', 'context'] as AdaptationTrigger[]).map(trigger => (
            <button
              key={trigger}
              onClick={() => triggerManualAdaptation(trigger)}
              className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200 transition-colors"
            >
              Trigger {trigger}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Adaptations */}
      {showAdaptationLog && recentAdaptations.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Recent Adaptations
          </h4>
          <div className="space-y-2">
            {recentAdaptations.map((event, index) => (
              <motion.div
                key={event.id}
                className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      {event.trigger} adaptation applied
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      event.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      event.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      event.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {event.priority}
                    </span>
                    <span className="text-xs text-green-600 dark:text-green-400">
                      {Math.round(event.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Adaptation Settings */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Settings
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Adaptation Speed
            </label>
            <select 
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm"
              value={adaptationSpeed}
              onChange={(e) => {
                // This would be handled by parent component
                console.log('Adaptation speed changed to:', e.target.value);
              }}
            >
              <option value="fast">Fast (2s)</option>
              <option value="normal">Normal (5s)</option>
              <option value="slow">Slow (10s)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Adaptations/Min
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={maxAdaptationsPerMinute}
              onChange={(e) => {
                console.log('Max adaptations changed to:', e.target.value);
              }}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm"
            />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enableRealTimeAdaptation}
                onChange={(e) => {
                  console.log('Real-time adaptation:', e.target.checked);
                }}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Enable Real-Time Adaptation
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              System Status: <span className="text-green-600 font-medium">Active</span>
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            Learning Style: {context.learningStyle} | 
            Accessibility: {context.accessibilityMode} | 
            Difficulty: {context.difficultyLevel}
          </div>
        </div>
      </div>
    </div>
  );
}
