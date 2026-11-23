'use client';

import React from 'react';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { PerformanceMetricsOverview } from '@/components/performance/PerformanceMetricsOverview';
import PerformanceAlerts from '@/components/performance/PerformanceAlerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/Skeleton';
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  Download, 
  RefreshCw,
  Play,
  Pause,
  Trash2
} from 'lucide-react';

const PerformanceDashboard: React.FC = () => {
  const {
    metrics,
    alerts,
    currentReport,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    generateReport,
    clearData,
    averageMetrics,
  } = usePerformanceMonitoring();

  const handleExportReport = () => {
    if (currentReport) {
      const dataStr = JSON.stringify(currentReport, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  };

  const getPerformanceScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const isLoading = metrics.length === 0 && !currentReport;

  const PerformanceDashboardSkeleton: React.FC = () => (
    <div
      className="space-y-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading performance data"
    >
      <span className="sr-only">Loading performance data…</span>

      {/* Score overview skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="text-center space-y-2">
                <Skeleton className="h-10 w-20 mx-auto" />
                <Skeleton className="h-4 w-24 mx-auto" />
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Web Vitals metrics grid skeleton */}
      <div>
        <Skeleton className="h-8 w-56 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Alerts list skeleton */}
      <div>
        <Skeleton className="h-8 w-52 mb-4" />
        <Card>
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Performance Monitoring
          </h1>
          <p className="text-muted-foreground mt-2">
            Real-time monitoring of Core Web Vitals and application performance
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={isMonitoring ? 'bg-green-50 text-green-700 border-green-200' : ''}
          >
            {isMonitoring ? 'Monitoring' : 'Paused'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className="flex items-center gap-2"
          >
            {isMonitoring ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isMonitoring ? 'Pause' : 'Start'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={generateReport}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Generate Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearData}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>

      {isLoading ? (
        <PerformanceDashboardSkeleton />
      ) : (
        <>
      {/* Performance Score Overview */}
      {currentReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Performance Score
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportReport}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Report
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getPerformanceScoreColor(currentReport.score).split(' ')[0]}`}>
                  {currentReport.score}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-semibold text-blue-600">
                  {metrics.length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Data Points</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-semibold text-orange-600">
                  {alerts.length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Active Alerts</p>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="font-medium mb-3">Quick Stats</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">LCP:</span>
                  <span className="ml-2 font-medium">{Math.round(averageMetrics.lcp || 0)}ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground">FID:</span>
                  <span className="ml-2 font-medium">{Math.round(averageMetrics.fid || 0)}ms</span>
                </div>
                <div>
                  <span className="text-muted-foreground">CLS:</span>
                  <span className="ml-2 font-medium">{(averageMetrics.cls || 0).toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">FCP:</span>
                  <span className="ml-2 font-medium">{Math.round(averageMetrics.fcp || 0)}ms</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Core Web Vitals */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Core Web Vitals
        </h2>
        <PerformanceMetricsOverview metrics={averageMetrics} />
      </div>

      {/* Alerts Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6" />
          Performance Alerts
        </h2>
        <PerformanceAlerts 
          alerts={alerts} 
          onClearAlerts={() => {
            // Clear alerts logic would go here
            console.log('Clear alerts clicked');
          }}
        />
      </div>

      {/* Recommendations */}
      {currentReport && currentReport.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Optimization Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentReport.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Data */}
      {metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Performance Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {metrics.slice(-10).reverse().map((metric, index) => (
                <div key={index} className="flex items-center justify-between p-2 border-b text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </span>
                    <span>LCP: {Math.round(metric.lcp)}ms</span>
                    <span>FID: {Math.round(metric.fid)}ms</span>
                    <span>CLS: {metric.cls.toFixed(3)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
};

export default PerformanceDashboard;
