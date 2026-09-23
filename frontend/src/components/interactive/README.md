# Interactive Learning Components - Documentation & Examples

This comprehensive guide covers all interactive learning components developed for the AetherMint Education platform.

## 📚 Table of Contents

1. [Overview](#overview)
2. [Components](#components)
   - [Virtual Lab Simulations](#virtual-lab-simulations)
   - [Interactive Diagrams](#interactive-diagrams)
   - [Drag & Drop Activities](#drag--drop-activities)
   - [Gamification Engine](#gamification-engine)
   - [Interactive Timelines & Maps](#interactive-timelines--maps)
   - [Collaborative Whiteboard](#collaborative-whiteboard)
   - [Progress Visualization](#progress-visualization)
   - [Interactive Quizzes](#interactive-quizzes)
   - [Accessibility Provider](#accessibility-provider)
3. [Installation](#installation)
4. [Usage Examples](#usage-examples)
5. [API Reference](#api-reference)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## 🎯 Overview

The Interactive Learning Components suite provides a comprehensive set of tools for creating engaging, accessible, and effective educational experiences. These components are built with modern React patterns, TypeScript for type safety, and include extensive accessibility features.

### Key Features

- **🔬 Virtual Lab Simulations**: Interactive science experiments
- **📊 Interactive Diagrams**: Flowcharts, mind maps, and network diagrams
- **🎯 Drag & Drop Activities**: Matching, sorting, and categorization exercises
- **🏆 Gamification Engine**: Points, badges, leaderboards, and achievements
- **📈 Interactive Timelines & Maps**: Historical timelines and geographical visualizations
- **🎨 Collaborative Whiteboard**: Real-time collaborative drawing tools
- **📊 Progress Visualization**: Comprehensive progress tracking with animations
- **❓ Interactive Quizzes**: Multiple question types with immediate feedback
- **♿ Accessibility Provider**: Comprehensive accessibility features

## 🧩 Components

### Virtual Lab Simulations

Interactive science laboratory simulations for chemistry, physics, biology, and mathematics experiments.

#### Features

- **Multiple Lab Types**: Chemistry, Physics, Biology, Mathematics
- **Step-by-Step Experiments**: Guided experimental procedures
- **Real-time Animations**: Canvas-based visualizations
- **Interactive Controls**: Start, pause, reset functionality
- **Hint System**: Contextual hints for students
- **Accessibility**: Screen reader support and keyboard navigation

#### Example Usage

```tsx
import VirtualLabSimulation from './components/interactive/VirtualLabSimulation';

const ChemistryLab = () => {
  const handleExperimentComplete = (results) => {
    console.log('Experiment completed:', results);
  };

  return (
    <VirtualLabSimulation
      labType="chemistry"
      title="Chemical Reactions Lab"
      description="Explore chemical reactions and observe molecular interactions"
      onExperimentComplete={handleExperimentComplete}
      accessibilityMode={true}
    />
  );
};
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labType` | `'chemistry' \| 'physics' \| 'biology' \| 'mathematics'` | ✅ | Type of laboratory simulation |
| `title` | `string` | ✅ | Title of the experiment |
| `description` | `string` | ✅ | Description of the experiment |
| `onExperimentComplete` | `(results: any) => void` | ✅ | Callback when experiment completes |
| `accessibilityMode` | `boolean` | ❌ | Enable accessibility features |

### Interactive Diagrams

Create interactive flowcharts, mind maps, network diagrams, and more with canvas-based rendering.

#### Features

- **Multiple Diagram Types**: Flowcharts, mind maps, networks, hierarchies
- **Interactive Elements**: Clickable nodes and connections
- **Drag & Drop**: Repositionable elements
- **Zoom & Pan**: Navigate large diagrams
- **Export Options**: Save as image
- **Real-time Collaboration**: Multi-user editing support

#### Example Usage

```tsx
import InteractiveDiagram from './components/interactive/InteractiveDiagram';

const FlowchartExample = () => {
  const diagramData = {
    nodes: [
      { id: '1', label: 'Start', x: 100, y: 100, type: 'start' },
      { id: '2', label: 'Process', x: 200, y: 100, type: 'process' },
      { id: '3', label: 'End', x: 300, y: 100, type: 'end' },
    ],
    connections: [
      { id: 'c1', from: '1', to: '2', type: 'arrow' },
      { id: 'c2', from: '2', to: '3', type: 'arrow' },
    ],
  };

  const handleNodeClick = (node) => {
    console.log('Node clicked:', node);
  };

  return (
    <InteractiveDiagram
      diagramType="flowchart"
      title="Process Flow"
      data={diagramData}
      onNodeClick={handleNodeClick}
      editable={true}
    />
  );
};
```

### Drag & Drop Activities

Engaging drag-and-drop exercises for matching, sorting, categorization, and sequencing.

#### Features

- **Activity Types**: Matching, sorting, categorization, sequencing, labeling
- **Visual Feedback**: Immediate feedback on correct/incorrect placement
- **Progress Tracking**: Real-time progress updates
- **Accessibility**: Keyboard navigation and screen reader support
- **Analytics**: Track attempts, time spent, and accuracy

#### Example Usage

```tsx
import DragDropActivity from './components/interactive/DragDropActivity';

const MatchingActivity = () => {
  const items = [
    { id: 'item1', content: 'Apple', correctTarget: 'fruits' },
    { id: 'item2', content: 'Carrot', correctTarget: 'vegetables' },
    { id: 'item3', content: 'Banana', correctTarget: 'fruits' },
  ];

  const targets = [
    { id: 'fruits', label: 'Fruits' },
    { id: 'vegetables', label: 'Vegetables' },
  ];

  const handleActivityComplete = (results) => {
    console.log('Activity completed:', results);
  };

  return (
    <DragDropActivity
      activityType="matching"
      title="Food Categories"
      instructions="Drag each food item to the correct category"
      items={items}
      targets={targets}
      onActivityComplete={handleActivityComplete}
      showFeedback={true}
    />
  );
};
```

### Gamification Engine

Comprehensive gamification system with points, badges, leaderboards, and achievements.

#### Features

- **Points System**: Track and award points for various activities
- **Badges & Achievements**: Unlockable achievements with different rarities
- **Leaderboards**: Competitive rankings with real-time updates
- **Learning Streaks**: Motivate consistent learning habits
- **Progress Milestones**: Celebrate key achievements
- **Social Features**: Share achievements and compete with peers

#### Example Usage

```tsx
import GamificationEngine from './components/interactive/GamificationEngine';

const GamificationDashboard = () => {
  const handleAchievementUnlock = (achievement) => {
    console.log('New achievement:', achievement);
  };

  return (
    <GamificationEngine
      userId="user123"
      courseId="course456"
      showPoints={true}
      showBadges={true}
      showLeaderboard={true}
      showStreaks={true}
      onAchievementUnlock={handleAchievementUnlock}
      accessibilityMode={false}
    />
  );
};
```

### Interactive Timelines & Maps

Historical timelines and geographical maps with interactive elements.

#### Features

- **Timeline View**: Chronological event visualization
- **Map View**: Geographical location visualization
- **Hybrid View**: Combined timeline and map display
- **Interactive Navigation**: Zoom, pan, and filter capabilities
- **Event Details**: Rich information for each event/location
- **Playback Controls**: Animate through historical periods

#### Example Usage

```tsx
import InteractiveTimelineMap from './components/interactive/InteractiveTimelineMap';

const HistoricalTimeline = () => {
  const timelineData = {
    events: [
      {
        id: 'event1',
        title: 'Moon Landing',
        description: 'First humans land on the moon',
        date: new Date('1969-07-20'),
        category: 'Space',
        importance: 'critical',
      },
    ],
    categories: ['Space', 'Technology', 'Politics'],
    startDate: new Date('1960-01-01'),
    endDate: new Date('1970-12-31'),
  };

  const handleEventSelect = (event) => {
    console.log('Event selected:', event);
  };

  return (
    <InteractiveTimelineMap
      contentType="timeline"
      title="Space Race Timeline"
      description="Key events in the space race"
      data={timelineData}
      onEventSelect={handleEventSelect}
      showNavigation={true}
    />
  );
};
```

### Collaborative Whiteboard

Real-time collaborative drawing and annotation tools.

#### Features

- **Drawing Tools**: Pen, line, shapes, text, eraser
- **Real-time Collaboration**: Multi-user editing with cursors
- **Sticky Notes**: Add text annotations
- **Zoom & Pan**: Navigate large canvases
- **Export Options**: Save whiteboard as image
- **History**: Undo/redo functionality

#### Example Usage

```tsx
import CollaborativeWhiteboard from './components/interactive/CollaborativeWhiteboard';

const WhiteboardSession = () => {
  const handleWhiteboardUpdate = (data) => {
    console.log('Whiteboard updated:', data);
  };

  return (
    <CollaborativeWhiteboard
      whiteboardId="wb123"
      userId="user456"
      title="Collaborative Session"
      collaborationEnabled={true}
      onWhiteboardUpdate={handleWhiteboardUpdate}
      readOnly={false}
    />
  );
};
```

### Progress Visualization

Comprehensive progress tracking with animated visualizations and achievement celebrations.

#### Features

- **Overall Progress**: Visual representation of learning progress
- **Course Progress**: Individual course completion tracking
- **Skills Development**: Skill level progression
- **Time Analytics**: Detailed time spent analysis
- **Achievement Celebrations**: Animated milestone celebrations
- **Interactive Charts**: Dynamic data visualizations

#### Example Usage

```tsx
import ProgressVisualization from './components/interactive/ProgressVisualization';

const StudentProgress = () => {
  const progressData = {
    overallProgress: 75,
    courseProgress: [
      {
        courseId: 'course1',
        courseName: 'Introduction to React',
        progress: 85,
        completedLessons: 8,
        totalLessons: 10,
      },
    ],
    skillsProgress: [
      {
        skillName: 'React',
        category: 'Programming',
        currentLevel: 4,
        maxLevel: 5,
        progressPercentage: 80,
      },
    ],
    timeSpent: {
      totalTime: 3600,
      todayTime: 120,
      weekTime: 600,
    },
    streakData: {
      currentStreak: 7,
      longestStreak: 14,
    },
  };

  const achievements = [
    {
      id: 'first_lesson',
      title: 'First Steps',
      description: 'Complete your first lesson',
      icon: '🎯',
      rarity: 'common',
    },
  ];

  const handleMilestoneReached = (milestone) => {
    console.log('Milestone reached:', milestone);
  };

  return (
    <ProgressVisualization
      userId="user123"
      progressData={progressData}
      achievements={achievements}
      onMilestoneReached={handleMilestoneReached}
      showCelebrations={true}
    />
  );
};
```

### Interactive Quizzes

Comprehensive quiz system with multiple question types and immediate feedback.

#### Features

- **Question Types**: Multiple choice, true/false, fill-in-blank, matching, ordering, essay
- **Immediate Feedback**: Real-time feedback on answers
- **Timer Support**: Optional time limits for quizzes
- **Progress Tracking**: Monitor quiz completion progress
- **Review Mode**: Review answers after completion
- **Accessibility**: Full screen reader and keyboard support

#### Example Usage

```tsx
import InteractiveQuiz from './components/interactive/InteractiveQuiz';

const ScienceQuiz = () => {
  const questions = [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the chemical symbol for water?',
      options: ['H2O', 'CO2', 'O2', 'N2'],
      correctAnswer: 'H2O',
      explanation: 'Water is composed of two hydrogen atoms and one oxygen atom',
      difficulty: 'easy',
      category: 'Chemistry',
      points: 10,
    },
    {
      id: 'q2',
      type: 'true-false',
      question: 'The sun is a star',
      correctAnswer: 'true',
      difficulty: 'easy',
      category: 'Astronomy',
      points: 5,
    },
  ];

  const handleQuizComplete = (results) => {
    console.log('Quiz completed:', results);
  };

  return (
    <InteractiveQuiz
      quizId="quiz123"
      title="Science Fundamentals"
      description="Test your knowledge of basic science concepts"
      questions={questions}
      timeLimit={300} // 5 minutes
      onQuizComplete={handleQuizComplete}
      showCorrectAnswers={true}
      allowReview={true}
    />
  );
};
```

### Accessibility Provider

Comprehensive accessibility features for all interactive components.

#### Features

- **Text Adjustments**: Font size, spacing, dyslexia-friendly fonts
- **Visual Settings**: High contrast, color blind modes, reduced motion
- **Screen Reader Support**: Enhanced screen reader compatibility
- **Keyboard Navigation**: Full keyboard accessibility
- **Text-to-Speech**: Built-in text-to-speech functionality
- **Focus Management**: Enhanced focus indicators

#### Example Usage

```tsx
import AccessibilityProvider from './components/interactive/AccessibilityProvider';

const App = () => {
  const handleSettingsChange = (settings) => {
    console.log('Accessibility settings changed:', settings);
  };

  return (
    <AccessibilityProvider
      onSettingsChange={handleSettingsChange}
      initialSettings={{
        fontSize: 'large',
        highContrast: true,
        reducedMotion: true,
      }}
    >
      {/* Your app content here */}
      <div>
        <h1>Accessible Learning Platform</h1>
        <p>All content is fully accessible.</p>
      </div>
    </AccessibilityProvider>
  );
};
```

## 📦 Installation

### Prerequisites

- React 18+
- TypeScript 4.5+
- Node.js 16+
- Modern browser with ES6+ support

### Dependencies

```bash
npm install framer-motion react react-dom
npm install -D @types/react @types/react-dom
```

### Optional Dependencies

For enhanced functionality:

```bash
npm install three @react-three/fiber @react-three/drei
npm install fabric konva react-konva
npm install socket.io-client
npm install react-dnd react-dnd-html5-backend
```

## 💡 Usage Examples

### Complete Learning Module Example

```tsx
import React, { useState } from 'react';
import { AccessibilityProvider } from './components/interactive/AccessibilityProvider';
import VirtualLabSimulation from './components/interactive/VirtualLabSimulation';
import InteractiveQuiz from './components/interactive/InteractiveQuiz';
import ProgressVisualization from './components/interactive/ProgressVisualization';

const LearningModule = () => {
  const [currentStep, setCurrentStep] = useState('lab');
  const [progress, setProgress] = useState({});

  const handleLabComplete = (results) => {
    setProgress(prev => ({ ...prev, lab: results }));
    setCurrentStep('quiz');
  };

  const handleQuizComplete = (results) => {
    setProgress(prev => ({ ...prev, quiz: results }));
    setCurrentStep('progress');
  };

  return (
    <AccessibilityProvider>
      <div className="learning-module">
        <h1>Chemistry Fundamentals</h1>
        
        {currentStep === 'lab' && (
          <VirtualLabSimulation
            labType="chemistry"
            title="Chemical Reactions"
            description="Explore chemical reactions in our virtual lab"
            onExperimentComplete={handleLabComplete}
          />
        )}
        
        {currentStep === 'quiz' && (
          <InteractiveQuiz
            quizId="chem-quiz"
            title="Chemistry Quiz"
            description="Test your understanding of chemical reactions"
            questions={quizQuestions}
            onQuizComplete={handleQuizComplete}
          />
        )}
        
        {currentStep === 'progress' && (
          <ProgressVisualization
            userId="student123"
            progressData={progressData}
            achievements={achievements}
          />
        )}
      </div>
    </AccessibilityProvider>
  );
};
```

### Gamified Learning Path

```tsx
import React from 'react';
import GamificationEngine from './components/interactive/GamificationEngine';
import DragDropActivity from './components/interactive/DragDropActivity';

const GamifiedPath = () => {
  return (
    <div className="gamified-learning">
      <GamificationEngine
        userId="learner456"
        showPoints={true}
        showBadges={true}
        showLeaderboard={true}
      />
      
      <DragDropActivity
        activityType="matching"
        title="Element Matching"
        instructions="Match elements to their symbols"
        items={elementItems}
        targets={elementTargets}
        onActivityComplete={handleActivityComplete}
        showFeedback={true}
      />
    </div>
  );
};
```

## 📖 API Reference

### Common Props

Many components share common props for consistency:

#### Accessibility Props

```typescript
interface AccessibilityProps {
  accessibilityMode?: boolean;
  screenReaderMode?: boolean;
  keyboardNavigation?: boolean;
  highContrast?: boolean;
  reducedMotion?: boolean;
}
```

#### Event Handlers

```typescript
interface EventHandlers {
  onComplete?: (results: any) => void;
  onProgress?: (progress: any) => void;
  onError?: (error: Error) => void;
}
```

### Utility Hooks

#### useAccessibility

```typescript
import { useAccessibility } from './components/interactive/AccessibilityProvider';

const MyComponent = () => {
  const { announce, speak } = useAccessibility();
  
  const handleClick = () => {
    announce('Button clicked');
    speak('Button clicked');
  };
  
  return <button onClick={handleClick}>Click me</button>;
};
```

## 🎯 Best Practices

### 1. Accessibility First

- Always provide alt text for images
- Ensure keyboard navigation works
- Test with screen readers
- Use semantic HTML elements
- Provide sufficient color contrast

### 2. Performance Optimization

- Use React.memo for expensive components
- Implement proper loading states
- Optimize canvas rendering
- Use Web Workers for heavy computations

### 3. User Experience

- Provide clear instructions
- Give immediate feedback
- Show progress indicators
- Handle errors gracefully
- Mobile-responsive design

### 4. Data Management

- Validate user input
- Handle network errors
- Implement proper state management
- Use optimistic updates where appropriate

## 🔧 Troubleshooting

### Common Issues

#### Canvas Rendering Issues

**Problem**: Canvas not rendering or showing blank
**Solution**: Ensure proper useEffect cleanup and canvas context initialization

```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Your drawing logic here
  
  return () => {
    // Cleanup if needed
  };
}, []);
```

#### Animation Performance

**Problem**: Animations are laggy or slow
**Solution**: Use reduced motion preference and optimize rendering

```typescript
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

if (prefersReducedMotion) {
  // Use simpler animations or none
}
```

#### Accessibility Issues

**Problem**: Screen reader not announcing content
**Solution**: Use proper ARIA labels and live regions

```typescript
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {statusMessage}
</div>
```

### Debug Mode

Enable debug mode for detailed logging:

```typescript
const debugMode = process.env.NODE_ENV === 'development';

if (debugMode) {
  console.log('Debug info:', data);
}
```

## 📞 Support

For issues, questions, or contributions:

- **GitHub Issues**: [Create an issue](https://github.com/AetherEdu/AetherMint/issues)
- **Documentation**: [View docs](https://aethermint-education.org/docs)
- **Community**: [Join Discord](https://discord.gg/aethermint-education)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/AetherEdu/AetherMint.git
cd aethermint-education
npm install
npm run dev
```

### Testing

```bash
npm run test
npm run test:coverage
npm run test:e2e
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Happy Learning! 🎓**
