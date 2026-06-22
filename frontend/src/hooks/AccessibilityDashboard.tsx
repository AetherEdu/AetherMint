import React, { useState } from 'react';

interface AuditResult {
  id: string;
  category: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  element?: string;
}

export const AccessibilityDashboard: React.FC = () => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);
  const statusMessage = isAuditing
    ? 'Accessibility audit is running.'
    : results.length > 0
      ? `Accessibility audit complete. ${results.length} checks returned.`
      : 'Accessibility audit has not been run.';

  const runAudit = () => {
    setIsAuditing(true);
    // Simulated audit demonstration matching WCAG 2.1 AA testing needs
    setTimeout(() => {
      const mockResults: AuditResult[] = [
        { id: '1', category: 'Contrast', status: 'passed', message: 'All text meets WCAG AA 4.5:1 ratio.' },
        { id: '2', category: 'ARIA Labels', status: 'warning', message: 'Some interactive elements might need descriptive aria-labels.', element: 'button.close-btn' },
        { id: '3', category: 'Keyboard Nav', status: 'passed', message: 'No keyboard traps detected. Tab order is logical.' },
        { id: '4', category: 'Alt Text', status: 'warning', message: 'Ensure all newly uploaded course images include alt text.', element: 'img.course-thumbnail' },
        { id: '5', category: 'Screen Reader', status: 'passed', message: 'Live regions and ARIA landmarks are properly configured.' },
      ];
      setResults(mockResults);
      setIsAuditing(false);
    }, 1500);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md" role="region" aria-labelledby="accessibility-dashboard-title">
      <div className="flex justify-between items-center mb-6">
        <h2 id="accessibility-dashboard-title" className="text-2xl font-bold text-gray-900 dark:text-white">Accessibility Audit Dashboard</h2>
        <button
          onClick={runAudit}
          disabled={isAuditing}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 transition-all"
          aria-busy={isAuditing}
          aria-describedby="accessibility-dashboard-status"
        >
          {isAuditing ? 'Running Audit...' : 'Run WCAG Audit'}
        </button>
      </div>

      <p id="accessibility-dashboard-status" className="sr-only" aria-live="polite">
        {statusMessage}
      </p>

      <div className="space-y-4" aria-live="polite" role="list" aria-label="Accessibility audit results">
        {results.length === 0 && !isAuditing && (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No audit results yet. Click "Run WCAG Audit" to scan the interface.</p>
        )}
        
        {results.map(result => (
          <div 
            key={result.id} 
            role="listitem"
            className={`p-4 rounded-lg border-l-4 ${
              result.status === 'passed' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
              result.status === 'failed' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
              'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
            }`}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                  {result.category} - <span className="sr-only">Status: </span>{result.status}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{result.message}</p>
                {result.element && (
                  <code className="mt-2 block text-sm bg-black/10 dark:bg-white/10 p-2 rounded text-gray-800 dark:text-gray-200">
                    Selector: {result.element}
                  </code>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccessibilityDashboard;
