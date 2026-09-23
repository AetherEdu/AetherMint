'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout, Grid, List, Columns, Eye, EyeOff, Settings, Zap } from 'lucide-react';
import { LearningStyle } from './LearningStyleDetector';

export type LayoutType = 'grid' | 'list' | 'cards' | 'timeline' | 'mindmap' | 'flow';
export type DensityLevel = 'compact' | 'comfortable' | 'spacious';
export type ContentPriority = 'visual' | 'text' | 'interactive' | 'balanced';

export interface LayoutConfiguration {
  type: LayoutType;
  density: DensityLevel;
  contentPriority: ContentPriority;
  columns: number;
  sidebarPosition: 'left' | 'right' | 'none' | 'both';
  headerSize: 'small' | 'medium' | 'large';
  navigationStyle: 'tabs' | 'sidebar' | 'topbar' | 'floating' | 'minimal';
  animationSpeed: 'fast' | 'normal' | 'slow';
  colorScheme: 'light' | 'dark' | 'auto' | 'high-contrast';
}

interface AdaptationRule {
  id: string;
  learningStyle: LearningStyle;
  condition: 'performance' | 'preference' | 'context' | 'accessibility';
  trigger: string;
  layoutConfig: Partial<LayoutConfiguration>;
  priority: number;
  active: boolean;
}

interface PerformanceMetrics {
  completionRate: number;
  timeOnTask: number;
  errorRate: number;
  engagementScore: number;
  accessibilityScore: number;
}

interface DynamicLayoutAdapterProps {
  userId: string;
  learningStyle: LearningStyle;
  performanceMetrics: PerformanceMetrics;
  onLayoutChange?: (config: LayoutConfiguration) => void;
  onAdaptationApplied?: (rule: AdaptationRule) => void;
  enableAutoAdaptation?: boolean;
  adaptationThreshold?: number;
  children?: React.ReactNode;
}

const LEARNING_STYLE_LAYOUTS: Record<LearningStyle, Partial<LayoutConfiguration>> = {
  visual: {
    type: 'grid',
    density: 'comfortable',
    contentPriority: 'visual',
    columns: 3,
    sidebarPosition: 'right',
    headerSize: 'medium',
    navigationStyle: 'tabs',
    animationSpeed: 'normal',
    colorScheme: 'auto'
  },
  auditory: {
    type: 'list',
    density: 'comfortable',
    contentPriority: 'text',
    columns: 1,
    sidebarPosition: 'left',
    headerSize: 'large',
    navigationStyle: 'sidebar',
    animationSpeed: 'slow',
    colorScheme: 'auto'
  },
  reading: {
    type: 'list',
    density: 'spacious',
    contentPriority: 'text',
    columns: 1,
    sidebarPosition: 'none',
    headerSize: 'small',
    navigationStyle: 'topbar',
    animationSpeed: 'slow',
    colorScheme: 'light'
  },
  kinesthetic: {
    type: 'cards',
    density: 'comfortable',
    contentPriority: 'interactive',
    columns: 2,
    sidebarPosition: 'right',
    headerSize: 'medium',
    navigationStyle: 'floating',
    animationSpeed: 'fast',
    colorScheme: 'auto'
  },
  social: {
    type: 'grid',
    density: 'comfortable',
    contentPriority: 'balanced',
    columns: 2,
    sidebarPosition: 'both',
    headerSize: 'large',
    navigationStyle: 'tabs',
    animationSpeed: 'normal',
    colorScheme: 'auto'
  },
  solitary: {
    type: 'timeline',
    density: 'spacious',
    contentPriority: 'text',
    columns: 1,
    sidebarPosition: 'none',
    headerSize: 'small',
    navigationStyle: 'minimal',
    animationSpeed: 'slow',
    colorScheme: 'dark'
  },
  logical: {
    type: 'flow',
    density: 'compact',
    contentPriority: 'text',
    columns: 2,
    sidebarPosition: 'left',
    headerSize: 'medium',
    navigationStyle: 'sidebar',
    animationSpeed: 'normal',
    colorScheme: 'auto'
  },
  creative: {
    type: 'mindmap',
    density: 'comfortable',
    contentPriority: 'visual',
    columns: 3,
    sidebarPosition: 'right',
    headerSize: 'large',
    navigationStyle: 'floating',
    animationSpeed: 'fast',
    colorScheme: 'auto'
  }
};

const DEFAULT_LAYOUT: LayoutConfiguration = {
  type: 'grid',
  density: 'comfortable',
  contentPriority: 'balanced',
  columns: 2,
  sidebarPosition: 'right',
  headerSize: 'medium',
  navigationStyle: 'tabs',
  animationSpeed: 'normal',
  colorScheme: 'auto'
};

export function DynamicLayoutAdapter({
  userId,
  learningStyle,
  performanceMetrics,
  onLayoutChange,
  onAdaptationApplied,
  enableAutoAdaptation = true,
  adaptationThreshold = 0.7,
  children
}: DynamicLayoutAdapterProps) {
  const [currentLayout, setCurrentLayout] = useState<LayoutConfiguration>(DEFAULT_LAYOUT);
  const [adaptationHistory, setAdaptationHistory] = useState<AdaptationRule[]>([]);
  const [isAdapting, setIsAdapting] = useState(false);
  const [customRules, setCustomRules] = useState<AdaptationRule[]>([]);
  const [showControls, setShowControls] = useState(false);

  // Initialize layout based on learning style
  useEffect(() => {
    const styleBasedLayout = { ...DEFAULT_LAYOUT, ...LEARNING_STYLE_LAYOUTS[learningStyle] };
    setCurrentLayout(styleBasedLayout);
    onLayoutChange?.(styleBasedLayout);
  }, [learningStyle, onLayoutChange]);

  // Performance-based adaptation logic
  const analyzePerformanceNeeds = useCallback((): Partial<LayoutConfiguration> | null => {
    const adaptations: Partial<LayoutConfiguration> = {};

    // High error rate -> simplify layout
    if (performanceMetrics.errorRate > 0.3) {
      adaptations.type = 'list';
      adaptations.density = 'spacious';
      adaptations.columns = 1;
      adaptations.animationSpeed = 'slow';
    }

    // Low engagement -> add visual elements
    if (performanceMetrics.engagementScore < 0.4) {
      adaptations.contentPriority = 'visual';
      adaptations.animationSpeed = 'fast';
      adaptations.type = 'cards';
    }

    // Low completion rate -> reduce complexity
    if (performanceMetrics.completionRate < 0.5) {
      adaptations.columns = Math.max(1, currentLayout.columns - 1);
      adaptations.density = 'comfortable';
      adaptations.sidebarPosition = 'none';
    }

    // Fast completion but high errors -> add more guidance
    if (performanceMetrics.timeOnTask < 30 && performanceMetrics.errorRate > 0.2) {
      adaptations.headerSize = 'large';
      adaptations.navigationStyle = 'sidebar';
      adaptations.contentPriority = 'text';
    }

    // Accessibility needs
    if (performanceMetrics.accessibilityScore < 0.6) {
      adaptations.colorScheme = 'high-contrast';
      adaptations.density = 'spacious';
      adaptations.animationSpeed = 'slow';
    }

    return Object.keys(adaptations).length > 0 ? adaptations : null;
  }, [performanceMetrics, currentLayout]);

  // Apply layout adaptations
  const applyAdaptation = useCallback((adaptation: Partial<LayoutConfiguration>, trigger: string) => {
    setIsAdapting(true);
    
    const newLayout = { ...currentLayout, ...adaptation };
    const adaptationRule: AdaptationRule = {
      id: Date.now().toString(),
      learningStyle,
      condition: 'performance',
      trigger,
      layoutConfig: adaptation,
      priority: 1,
      active: true
    };

    setCurrentLayout(newLayout);
    setAdaptationHistory(prev => [...prev.slice(-10), adaptationRule]);
    onLayoutChange?.(newLayout);
    onAdaptationApplied?.(adaptationRule);

    // Simulate adaptation time
    setTimeout(() => setIsAdapting(false), 1000);
  }, [currentLayout, learningStyle, onLayoutChange, onAdaptationApplied]);

  // Auto-adaptation based on performance
  useEffect(() => {
    if (!enableAutoAdaptation) return;

    const performanceScore = (
      performanceMetrics.completionRate * 0.3 +
      (1 - performanceMetrics.errorRate) * 0.3 +
      performanceMetrics.engagementScore * 0.2 +
      performanceMetrics.accessibilityScore * 0.2
    );

    if (performanceScore < adaptationThreshold) {
      const adaptations = analyzePerformanceNeeds();
      if (adaptations) {
        applyAdaptation(adaptations, 'performance-threshold');
      }
    }
  }, [performanceMetrics, adaptationThreshold, enableAutoAdaptation, analyzePerformanceNeeds, applyAdaptation]);

  // Generate CSS classes based on layout configuration
  const generateLayoutClasses = useMemo(() => {
    const classes = [];

    // Layout type classes
    switch (currentLayout.type) {
      case 'grid':
        classes.push('grid', 'gap-4');
        classes.push(`grid-cols-${currentLayout.columns}`);
        break;
      case 'list':
        classes.push('flex', 'flex-col', 'space-y-4');
        break;
      case 'cards':
        classes.push('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-6');
        break;
      case 'timeline':
        classes.push('relative', 'space-y-8');
        break;
      case 'mindmap':
        classes.push('relative', 'overflow-auto');
        break;
      case 'flow':
        classes.push('flex', 'flex-col', 'space-y-6');
        break;
    }

    // Density classes
    switch (currentLayout.density) {
      case 'compact':
        classes.push('p-2', 'gap-2');
        break;
      case 'comfortable':
        classes.push('p-4', 'gap-4');
        break;
      case 'spacious':
        classes.push('p-6', 'gap-6');
        break;
    }

    // Animation speed classes
    switch (currentLayout.animationSpeed) {
      case 'fast':
        classes.push('transition-all', 'duration-200');
        break;
      case 'normal':
        classes.push('transition-all', 'duration-300');
        break;
      case 'slow':
        classes.push('transition-all', 'duration-500');
        break;
    }

    return classes.join(' ');
  }, [currentLayout]);

  // Generate inline styles for dynamic properties
  const generateLayoutStyles = useMemo(() => {
    const styles: React.CSSProperties = {};

    // Column layout for grid
    if (currentLayout.type === 'grid') {
      styles.gridTemplateColumns = `repeat(${currentLayout.columns}, minmax(0, 1fr))`;
    }

    // Color scheme
    if (currentLayout.colorScheme === 'high-contrast') {
      styles.filter = 'contrast(1.2)';
    }

    return styles;
  }, [currentLayout]);

  const handleManualLayoutChange = (property: keyof LayoutConfiguration, value: any) => {
    const adaptation = { [property]: value } as Partial<LayoutConfiguration>;
    applyAdaptation(adaptation, 'manual-adjustment');
  };

  const resetToDefault = () => {
    const defaultLayout = { ...DEFAULT_LAYOUT, ...LEARNING_STYLE_LAYOUTS[learningStyle] };
    setCurrentLayout(defaultLayout);
    onLayoutChange?.(defaultLayout);
  };

  return (
    <div className="relative">
      {/* Layout Controls */}
      <div className="fixed top-4 right-4 z-50">
        <motion.button
          onClick={() => setShowControls(!showControls)}
          className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </motion.button>

        <AnimatePresence>
          {showControls && (
            <motion.div
              className="absolute top-16 right-0 w-80 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 p-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Layout Controls
              </h3>

              {/* Layout Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Layout Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['grid', 'list', 'cards', 'timeline', 'mindmap', 'flow'] as LayoutType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => handleManualLayoutChange('type', type)}
                      className={`p-2 rounded text-xs font-medium transition-colors ${
                        currentLayout.type === type
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Density */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Density
                </label>
                <div className="flex gap-2">
                  {(['compact', 'comfortable', 'spacious'] as DensityLevel[]).map(density => (
                    <button
                      key={density}
                      onClick={() => handleManualLayoutChange('density', density)}
                      className={`flex-1 p-2 rounded text-xs font-medium transition-colors ${
                        currentLayout.density === density
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>

              {/* Columns */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Columns: {currentLayout.columns}
                </label>
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={currentLayout.columns}
                  onChange={(e) => handleManualLayoutChange('columns', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Animation Speed */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Animation Speed
                </label>
                <div className="flex gap-2">
                  {(['fast', 'normal', 'slow'] as const).map(speed => (
                    <button
                      key={speed}
                      onClick={() => handleManualLayoutChange('animationSpeed', speed)}
                      className={`flex-1 p-2 rounded text-xs font-medium transition-colors ${
                        currentLayout.animationSpeed === speed
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {speed}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-adaptation Toggle */}
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enableAutoAdaptation}
                    onChange={(e) => {
                      // This would be handled by parent component
                      console.log('Auto-adaptation:', e.target.checked);
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Enable Auto-adaptation
                  </span>
                </label>
              </div>

              {/* Reset Button */}
              <button
                onClick={resetToDefault}
                className="w-full p-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Reset to Default
              </button>

              {/* Adaptation Status */}
              {isAdapting && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-600 animate-pulse" />
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      Adapting layout...
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Adapted Content Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentLayout.type}-${currentLayout.density}`}
          className={generateLayoutClasses}
          style={generateLayoutStyles}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: currentLayout.animationSpeed === 'fast' ? 0.2 : currentLayout.animationSpeed === 'slow' ? 0.5 : 0.3 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Adaptation Indicator */}
      {adaptationHistory.length > 0 && (
        <div className="fixed bottom-4 left-4 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <Layout className="h-4 w-4 text-blue-600" />
            <span className="text-gray-600 dark:text-gray-400">
              {adaptationHistory.length} adaptations applied
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
