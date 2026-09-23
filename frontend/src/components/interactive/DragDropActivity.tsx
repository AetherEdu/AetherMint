import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DragDropActivityProps {
  activityType: 'matching' | 'sorting' | 'categorization' | 'sequencing' | 'labeling';
  title: string;
  instructions: string;
  items: DragDropItem[];
  targets: DropTarget[];
  onActivityComplete: (results: ActivityResults) => void;
  showFeedback?: boolean;
  accessibilityMode?: boolean;
}

export interface DragDropItem {
  id: string;
  content: string;
  image?: string;
  audio?: string;
  correctTarget?: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface DropTarget {
  id: string;
  label: string;
  accepts?: string[];
  multipleItems?: boolean;
  position?: { x: number; y: number };
}

export interface ActivityResults {
  correct: number;
  total: number;
  accuracy: number;
  timeSpent: number;
  attempts: number;
  items: ItemResult[];
}

export interface ItemResult {
  itemId: string;
  correct: boolean;
  attempts: number;
  timeSpent: number;
}

const DragDropLearningActivity: React.FC<DragDropActivityProps> = ({
  activityType,
  title,
  instructions,
  items,
  targets,
  onActivityComplete,
  showFeedback = true,
  accessibilityMode = false
}) => {
  const [draggedItem, setDraggedItem] = useState<DragDropItem | null>(null);
  const [droppedItems, setDroppedItems] = useState<Map<string, DragDropItem[]>>(new Map());
  const [attempts, setAttempts] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [itemAttempts, setItemAttempts] = useState<Map<string, number>>(new Map());
  const [itemStartTimes, setItemStartTimes] = useState<Map<string, number>>(new Map());
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<ActivityResults | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize empty arrays for each target
    const initialDropped = new Map<string, DragDropItem[]>();
    targets.forEach(target => {
      initialDropped.set(target.id, []);
    });
    setDroppedItems(initialDropped);
  }, [targets]);

  const handleDragStart = (e: React.DragEvent, item: DragDropItem) => {
    setDraggedItem(item);
    setItemStartTimes(prev => new Map(prev.set(item.id, Date.now())));
    
    if (accessibilityMode) {
      // For screen readers, announce what's being dragged
      const announcement = `Dragging item: ${item.content}`;
      announceToScreenReader(announcement);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverTarget(targetId);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = (e: React.DragEvent, target: DropTarget) => {
    e.preventDefault();
    setDragOverTarget(null);

    if (!draggedItem) return;

    const currentDropped = new Map(droppedItems);
    const targetItems = currentDropped.get(target.id) || [];

    // Check if target accepts this item
    if (target.accepts && !target.accepts.includes(draggedItem.category || '')) {
      if (showFeedback) {
        showTemporaryFeedback('This item doesn\'t belong here!', 'error');
      }
      return;
    }

    // Remove item from previous target if it exists
    let removedFrom = '';
    currentDropped.forEach((items, targetId) => {
      const filtered = items.filter(item => item.id !== draggedItem.id);
      currentDropped.set(targetId, filtered);
      if (items.length > filtered.length) {
        removedFrom = targetId;
      }
    });

    // Add to new target
    if (!target.multipleItems) {
      currentDropped.set(target.id, [draggedItem]);
    } else {
      currentDropped.set(target.id, [...targetItems, draggedItem]);
    }

    setDroppedItems(currentDropped);
    setDraggedItem(null);

    // Update attempts
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    const currentItemAttempts = (itemAttempts.get(draggedItem.id) || 0) + 1;
    setItemAttempts(prev => new Map(prev.set(draggedItem.id, currentItemAttempts)));

    // Check if activity is complete
    checkActivityComplete(currentDropped, newAttempts);

    if (showFeedback) {
      const isCorrect = draggedItem.correctTarget === target.id;
      showTemporaryFeedback(
        isCorrect ? 'Correct!' : 'Not quite right, try again!',
        isCorrect ? 'success' : 'warning'
      );
    }
  };

  const checkActivityComplete = (currentDropped: Map<string, DragDropItem[]>, currentAttempts: number) => {
    const totalDropped = Array.from(currentDropped.values()).flat().length;
    
    if (totalDropped === items.length) {
      const activityResults = calculateResults(currentDropped, currentAttempts);
      setResults(activityResults);
      setShowResults(true);
      onActivityComplete(activityResults);
    }
  };

  const calculateResults = (currentDropped: Map<string, DragDropItem[]>, currentAttempts: number): ActivityResults => {
    let correct = 0;
    const itemResults: ItemResult[] = [];

    items.forEach(item => {
      let isCorrect = false;
      let targetId = '';

      currentDropped.forEach((droppedItems, dropTargetId) => {
        const found = droppedItems.find(droppedItem => droppedItem.id === item.id);
        if (found) {
          targetId = dropTargetId;
          isCorrect = item.correctTarget === dropTargetId;
        }
      });

      if (isCorrect) correct++;

      const itemTimeSpent = itemStartTimes.get(item.id) 
        ? Date.now() - itemStartTimes.get(item.id)!
        : 0;

      itemResults.push({
        itemId: item.id,
        correct: isCorrect,
        attempts: itemAttempts.get(item.id) || 0,
        timeSpent: itemTimeSpent
      });
    });

    const totalTime = Date.now() - startTime;
    const accuracy = items.length > 0 ? (correct / items.length) * 100 : 0;

    return {
      correct,
      total: items.length,
      accuracy,
      timeSpent: totalTime,
      attempts: currentAttempts,
      items: itemResults
    };
  };

  const showTemporaryFeedback = (message: string, type: 'success' | 'error' | 'warning') => {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.className = `fixed top-4 right-4 p-4 rounded-lg text-white font-semibold z-50 ${
      type === 'success' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 'bg-yellow-500'
    }`;
    feedback.textContent = message;
    document.body.appendChild(feedback);

    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 2000);
  };

  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  const resetActivity = () => {
    const initialDropped = new Map<string, DragDropItem[]>();
    targets.forEach(target => {
      initialDropped.set(target.id, []);
    });
    setDroppedItems(initialDropped);
    setAttempts(0);
    setStartTime(Date.now());
    setItemAttempts(new Map());
    setItemStartTimes(new Map());
    setShowResults(false);
    setResults(null);
  };

  const getAvailableItems = () => {
    const droppedItemIds = Array.from(droppedItems.values()).flat().map(item => item.id);
    return items.filter(item => !droppedItemIds.includes(item.id));
  };

  const renderDraggableItem = (item: DragDropItem) => (
    <motion.div
      key={item.id}
      draggable
      onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, item)}
      onDragEnd={handleDragEnd}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`p-4 m-2 bg-white border-2 border-blue-300 rounded-lg cursor-move shadow-md hover:shadow-lg transition-shadow ${
        draggedItem?.id === item.id ? 'opacity-50' : ''
      }`}
      role="button"
      tabIndex={0}
      aria-label={`Draggable item: ${item.content}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          // For keyboard accessibility, we could implement a different interaction
          announceToScreenReader(`Selected item: ${item.content}. Use Tab to navigate to drop targets.`);
        }
      }}
    >
      {item.image && (
        <img src={item.image} alt={item.content} className="w-16 h-16 mx-auto mb-2 rounded" />
      )}
      <p className="text-center font-medium text-gray-800">{item.content}</p>
    </motion.div>
  );

  const renderDropTarget = (target: DropTarget) => {
    const targetItems = droppedItems.get(target.id) || [];
    const isActive = dragOverTarget === target.id;

    return (
      <motion.div
        key={target.id}
        onDragOver={(e) => handleDragOver(e, target.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, target)}
        whileHover={{ scale: 1.02 }}
        className={`p-6 m-2 border-3 border-dashed rounded-lg min-h-[120px] transition-all ${
          isActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 bg-gray-50'
        }`}
        role="region"
        aria-label={`Drop target: ${target.label}`}
      >
        <h3 className="font-semibold text-gray-700 mb-3">{target.label}</h3>
        
        <div className="space-y-2">
          <AnimatePresence>
            {targetItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-2 bg-white border border-gray-200 rounded shadow-sm"
              >
                <p className="text-sm text-gray-700">{item.content}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {targetItems.length === 0 && (
          <p className="text-gray-400 text-center italic">Drop items here</p>
        )}
      </motion.div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600">{instructions}</p>
      </div>

      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Progress</span>
          <span className="text-sm text-gray-600">
            {Array.from(droppedItems.values()).flat().length} / {items.length} items placed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className="bg-blue-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ 
              width: `${(Array.from(droppedItems.values()).flat().length / items.length) * 100}%` 
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Main content */}
      {!showResults ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Draggable items */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Items to Place</h3>
            <div className="flex flex-wrap justify-center">
              {getAvailableItems().map(renderDraggableItem)}
            </div>
            {getAvailableItems().length === 0 && (
              <p className="text-center text-gray-500 italic">All items have been placed!</p>
            )}
          </div>

          {/* Drop targets */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Drop Targets</h3>
            <div className="space-y-4">
              {targets.map(renderDropTarget)}
            </div>
          </div>
        </div>
      ) : (
        /* Results screen */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Activity Complete!</h3>
            
            {results && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{results.correct}/{results.total}</p>
                  <p className="text-sm text-gray-600">Correct</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{results.accuracy.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600">Accuracy</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{results.attempts}</p>
                  <p className="text-sm text-gray-600">Attempts</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{Math.round(results.timeSpent / 1000)}s</p>
                  <p className="text-sm text-gray-600">Time</p>
                </div>
              </div>
            )}

            {/* Item-by-item feedback */}
            {showFeedback && results && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3">Item Feedback:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {results.items.map(itemResult => {
                    const item = items.find(i => i.id === itemResult.itemId);
                    return (
                      <div
                        key={itemResult.itemId}
                        className={`p-3 rounded-lg border-2 ${
                          itemResult.correct 
                            ? 'bg-green-50 border-green-300' 
                            : 'bg-red-50 border-red-300'
                        }`}
                      >
                        <p className="font-medium text-gray-800">{item?.content}</p>
                        <p className="text-sm text-gray-600">
                          {itemResult.correct ? '✓ Correct' : '✗ Incorrect'} 
                          {itemResult.attempts > 1 && ` (${itemResult.attempts} attempts)`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={resetActivity}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Try Again
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Instructions for accessibility */}
      {accessibilityMode && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Accessibility Instructions:</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Use Tab to navigate between items and drop targets</li>
            <li>• Press Enter or Space to select an item</li>
            <li>• Navigate to a drop target and press Enter to place the item</li>
            <li>• Screen reader will announce actions and feedback</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default DragDropLearningActivity;
