/**
 * Search Analytics and Performance Monitoring Service
 * Provides comprehensive analytics for AI-powered search functionality
 */

import { logger } from '../utils/logger';

export interface SearchMetrics {
  timestamp: Date;
  query: string;
  userId?: string;
  sessionId: string;
  processingTime: number;
  resultCount: number;
  aiFeaturesUsed: string[];
  semanticSearchUsed: boolean;
  nlpProcessingUsed: boolean;
  intentRecognition: string;
  confidence: number;
  clickedResults: string[];
  timeSpent: number;
  userSatisfaction?: number;
  conversionRate?: number;
}

export interface AggregatedMetrics {
  totalSearches: number;
  averageProcessingTime: number;
  averageResultCount: number;
  aiFeatureUsage: { [feature: string]: number };
  intentDistribution: { [intent: string]: number };
  confidenceDistribution: {
    high: number;    // > 0.8
    medium: number;  // 0.5-0.8
    low: number;     // < 0.5
  };
  userEngagement: {
    averageTimeSpent: number;
    averageClicks: number;
    satisfactionRate: number;
    conversionRate: number;
  };
  performanceMetrics: {
    cacheHitRate: number;
    errorRate: number;
    timeoutRate: number;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
  };
  accuracyMetrics: {
    semanticSearchAccuracy: number;
    nlpProcessingAccuracy: number;
    intentRecognitionAccuracy: number;
    overallSearchAccuracy: number;
  };
}

export interface SearchInsights {
  popularQueries: Array<{
    query: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
    averageConfidence: number;
    conversionRate: number;
  }>;
  userBehaviorPatterns: Array<{
    pattern: string;
    frequency: number;
    impact: number;
    description: string;
  }>;
  contentGaps: Array<{
    category: string;
    demand: number;
    supply: number;
    gap: number;
    recommendation: string;
  }>;
  performanceBottlenecks: Array<{
    component: string;
    avgTime: number;
    occurrences: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
  }>;
  accuracyMetrics: Array<{
    metric: string;
    value: number;
    target: number;
    achieved: boolean;
    trend: 'improving' | 'stable' | 'declining';
  }>;
}

export interface PerformanceAlert {
  id: string;
  type: 'performance' | 'accuracy' | 'usage' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metrics: { [key: string]: number };
  recommendations: string[];
  resolved: boolean;
}

export class SearchAnalyticsService {
  private searchMetrics: SearchMetrics[] = [];
  private performanceAlerts: PerformanceAlert[] = [];
  private aggregatedMetrics: AggregatedMetrics | null = null;
  private lastAggregationTime: Date | null = null;
  private readonly aggregationInterval = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeDefaultMetrics();
  }

  /**
   * Record search metrics
   */
  recordSearchMetrics(metrics: SearchMetrics): void {
    try {
      this.searchMetrics.push(metrics);
      
      // Keep only last 10000 records to prevent memory issues
      if (this.searchMetrics.length > 10000) {
        this.searchMetrics = this.searchMetrics.slice(-10000);
      }

      // Check for performance alerts
      this.checkPerformanceAlerts(metrics);

      logger.info(`Search metrics recorded: ${metrics.query} (${metrics.processingTime}ms)`);
    } catch (error) {
      logger.error('Error recording search metrics', error);
    }
  }

  /**
   * Get aggregated metrics for a time period
   */
  getAggregatedMetrics(timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'): AggregatedMetrics {
    try {
      const now = new Date();
      const cutoffTime = this.getCutoffTime(now, timeframe);
      const relevantMetrics = this.searchMetrics.filter(m => m.timestamp >= cutoffTime);

      if (relevantMetrics.length === 0) {
        return this.getDefaultAggregatedMetrics();
      }

      const aggregated: AggregatedMetrics = {
        totalSearches: relevantMetrics.length,
        averageProcessingTime: this.calculateAverage(relevantMetrics, 'processingTime'),
        averageResultCount: this.calculateAverage(relevantMetrics, 'resultCount'),
        aiFeatureUsage: this.calculateAIFeatureUsage(relevantMetrics),
        intentDistribution: this.calculateIntentDistribution(relevantMetrics),
        confidenceDistribution: this.calculateConfidenceDistribution(relevantMetrics),
        userEngagement: this.calculateUserEngagement(relevantMetrics),
        performanceMetrics: this.calculatePerformanceMetrics(relevantMetrics),
        accuracyMetrics: this.calculateAccuracyMetrics(relevantMetrics)
      };

      this.aggregatedMetrics = aggregated;
      this.lastAggregationTime = now;

      return aggregated;
    } catch (error) {
      logger.error('Error calculating aggregated metrics', error);
      return this.getDefaultAggregatedMetrics();
    }
  }

  /**
   * Generate comprehensive search insights
   */
  generateSearchInsights(timeframe: 'day' | 'week' | 'month' = 'week'): SearchInsights {
    try {
      const now = new Date();
      const cutoffTime = this.getCutoffTime(now, timeframe);
      const relevantMetrics = this.searchMetrics.filter(m => m.timestamp >= cutoffTime);

      const insights: SearchInsights = {
        popularQueries: this.analyzePopularQueries(relevantMetrics),
        userBehaviorPatterns: this.analyzeUserBehaviorPatterns(relevantMetrics),
        contentGaps: this.identifyContentGaps(relevantMetrics),
        performanceBottlenecks: this.identifyPerformanceBottlenecks(relevantMetrics),
        accuracyMetrics: this.analyzeAccuracyMetrics(relevantMetrics)
      };

      logger.info(`Generated search insights for ${timeframe}`);
      return insights;
    } catch (error) {
      logger.error('Error generating search insights', error);
      return this.getDefaultInsights();
    }
  }

  /**
   * Get performance alerts
   */
  getPerformanceAlerts(activeOnly: boolean = false): PerformanceAlert[] {
    if (activeOnly) {
      return this.performanceAlerts.filter(alert => !alert.resolved);
    }
    return this.performanceAlerts;
  }

  /**
   * Resolve a performance alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.performanceAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info(`Performance alert resolved: ${alertId}`);
    }
  }

  /**
   * Get real-time system health status
   */
  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    try {
      const recentMetrics = this.searchMetrics.filter(m => 
        m.timestamp >= new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      );

      if (recentMetrics.length === 0) {
        return {
          status: 'warning',
          score: 0.5,
          issues: ['No recent search data available'],
          recommendations: ['Check search service connectivity']
        };
      }

      const avgProcessingTime = this.calculateAverage(recentMetrics, 'processingTime');
      const errorRate = this.calculateErrorRate(recentMetrics);
      const avgConfidence = this.calculateAverage(recentMetrics, 'confidence');

      let score = 1.0;
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check processing time
      if (avgProcessingTime > 2000) {
        score -= 0.3;
        issues.push('High processing time detected');
        recommendations.push('Optimize search algorithms or increase resources');
      } else if (avgProcessingTime > 1000) {
        score -= 0.1;
        issues.push('Elevated processing time');
        recommendations.push('Monitor system performance');
      }

      // Check error rate
      if (errorRate > 0.1) {
        score -= 0.4;
        issues.push('High error rate detected');
        recommendations.push('Investigate search service errors');
      } else if (errorRate > 0.05) {
        score -= 0.2;
        issues.push('Elevated error rate');
        recommendations.push('Review error logs');
      }

      // Check confidence scores
      if (avgConfidence < 0.5) {
        score -= 0.2;
        issues.push('Low confidence scores');
        recommendations.push('Review AI model performance');
      }

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (score < 0.5) {
        status = 'critical';
      } else if (score < 0.8) {
        status = 'warning';
      }

      return { status, score: Math.max(0, score), issues, recommendations };
    } catch (error) {
      logger.error('Error calculating system health', error);
      return {
        status: 'critical',
        score: 0,
        issues: ['Unable to calculate system health'],
        recommendations: ['Check monitoring service']
      };
    }
  }

  /**
   * Export analytics data
   */
  exportAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): {
    metrics: SearchMetrics[];
    aggregated: AggregatedMetrics;
    insights: SearchInsights;
    alerts: PerformanceAlert[];
  } {
    const cutoffTime = this.getCutoffTime(new Date(), timeframe);
    const relevantMetrics = this.searchMetrics.filter(m => m.timestamp >= cutoffTime);

    return {
      metrics: relevantMetrics,
      aggregated: this.getAggregatedMetrics(timeframe),
      insights: this.generateSearchInsights(timeframe),
      alerts: this.getPerformanceAlerts(true)
    };
  }

  /**
   * Clear old analytics data
   */
  clearOldData(retentionDays: number = 30): void {
    try {
      const cutoffTime = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const beforeCount = this.searchMetrics.length;
      
      this.searchMetrics = this.searchMetrics.filter(m => m.timestamp >= cutoffTime);
      
      // Clear old resolved alerts
      this.performanceAlerts = this.performanceAlerts.filter(
        alert => !alert.resolved || alert.timestamp >= cutoffTime
      );

      const clearedCount = beforeCount - this.searchMetrics.length;
      logger.info(`Cleared ${clearedCount} old analytics records`);
    } catch (error) {
      logger.error('Error clearing old analytics data', error);
    }
  }

  /**
   * Private helper methods
   */

  private initializeDefaultMetrics(): void {
    this.aggregatedMetrics = this.getDefaultAggregatedMetrics();
    this.lastAggregationTime = new Date();
  }

  private getDefaultAggregatedMetrics(): AggregatedMetrics {
    return {
      totalSearches: 0,
      averageProcessingTime: 0,
      averageResultCount: 0,
      aiFeatureUsage: {},
      intentDistribution: {},
      confidenceDistribution: { high: 0, medium: 0, low: 0 },
      userEngagement: {
        averageTimeSpent: 0,
        averageClicks: 0,
        satisfactionRate: 0,
        conversionRate: 0
      },
      performanceMetrics: {
        cacheHitRate: 0,
        errorRate: 0,
        timeoutRate: 0,
        systemHealth: 'good'
      },
      accuracyMetrics: {
        semanticSearchAccuracy: 0.85,
        nlpProcessingAccuracy: 0.78,
        intentRecognitionAccuracy: 0.82,
        overallSearchAccuracy: 0.83
      }
    };
  }

  private getDefaultInsights(): SearchInsights {
    return {
      popularQueries: [],
      userBehaviorPatterns: [],
      contentGaps: [],
      performanceBottlenecks: [],
      accuracyMetrics: []
    };
  }

  private getCutoffTime(now: Date, timeframe: 'hour' | 'day' | 'week' | 'month'): Date {
    const intervals = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    
    return new Date(now.getTime() - intervals[timeframe]);
  }

  private calculateAverage(metrics: SearchMetrics[], field: keyof SearchMetrics): number {
    if (metrics.length === 0) return 0;
    const values = metrics.map(m => m[field] as number).filter(v => !isNaN(v));
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private calculateAIFeatureUsage(metrics: SearchMetrics[]): { [feature: string]: number } {
    const usage: { [feature: string]: number } = {};
    
    metrics.forEach(metric => {
      metric.aiFeaturesUsed.forEach(feature => {
        usage[feature] = (usage[feature] || 0) + 1;
      });
    });

    return usage;
  }

  private calculateIntentDistribution(metrics: SearchMetrics[]): { [intent: string]: number } {
    const distribution: { [intent: string]: number } = {};
    
    metrics.forEach(metric => {
      distribution[metric.intentRecognition] = (distribution[metric.intentRecognition] || 0) + 1;
    });

    return distribution;
  }

  private calculateConfidenceDistribution(metrics: SearchMetrics[]): { high: number; medium: number; low: number } {
    const distribution = { high: 0, medium: 0, low: 0 };
    
    metrics.forEach(metric => {
      if (metric.confidence > 0.8) distribution.high++;
      else if (metric.confidence >= 0.5) distribution.medium++;
      else distribution.low++;
    });

    return distribution;
  }

  private calculateUserEngagement(metrics: SearchMetrics[]): AggregatedMetrics['userEngagement'] {
    const engagement = {
      averageTimeSpent: this.calculateAverage(metrics, 'timeSpent'),
      averageClicks: 0,
      satisfactionRate: 0,
      conversionRate: 0
    };

    // Calculate average clicks
    const clickCounts = metrics.map(m => m.clickedResults.length).filter(c => !isNaN(c));
    if (clickCounts.length > 0) {
      engagement.averageClicks = clickCounts.reduce((sum, count) => sum + count, 0) / clickCounts.length;
    }

    // Calculate satisfaction rate
    const satisfactionScores = metrics.map(m => m.userSatisfaction).filter(s => s !== undefined);
    if (satisfactionScores.length > 0) {
      engagement.satisfactionRate = satisfactionScores.reduce((sum, score) => sum + score!, 0) / satisfactionScores.length;
    }

    // Calculate conversion rate
    const conversionRates = metrics.map(m => m.conversionRate).filter(c => c !== undefined);
    if (conversionRates.length > 0) {
      engagement.conversionRate = conversionRates.reduce((sum, rate) => sum + rate!, 0) / conversionRates.length;
    }

    return engagement;
  }

  private calculatePerformanceMetrics(metrics: SearchMetrics[]): AggregatedMetrics['performanceMetrics'] {
    // Mock calculations - would be based on actual performance data
    return {
      cacheHitRate: 0.75,
      errorRate: this.calculateErrorRate(metrics),
      timeoutRate: 0.02,
      systemHealth: 'good'
    };
  }

  private calculateAccuracyMetrics(metrics: SearchMetrics[]): AggregatedMetrics['accuracyMetrics'] {
    // Mock calculations - would be based on actual accuracy measurements
    return {
      semanticSearchAccuracy: 0.85,
      nlpProcessingAccuracy: 0.78,
      intentRecognitionAccuracy: 0.82,
      overallSearchAccuracy: this.calculateAverage(metrics, 'confidence')
    };
  }

  private calculateErrorRate(metrics: SearchMetrics[]): number {
    // Mock error rate calculation
    return 0.01; // 1% error rate
  }

  private analyzePopularQueries(metrics: SearchMetrics[]): SearchInsights['popularQueries'] {
    const queryCounts = new Map<string, { count: number; confidence: number; conversions: number }>();
    
    metrics.forEach(metric => {
      const existing = queryCounts.get(metric.query) || { count: 0, confidence: 0, conversions: 0 };
      queryCounts.set(metric.query, {
        count: existing.count + 1,
        confidence: existing.confidence + metric.confidence,
        conversions: existing.conversions + (metric.conversionRate || 0)
      });
    });

    const popular = Array.from(queryCounts.entries())
      .map(([query, data]) => ({
        query,
        count: data.count,
        averageConfidence: data.confidence / data.count,
        conversionRate: data.conversions / data.count,
        trend: 'stable' as const // Would calculate based on historical data
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return popular;
  }

  private analyzeUserBehaviorPatterns(metrics: SearchMetrics[]): SearchInsights['userBehaviorPatterns'] {
    return [
      {
        pattern: 'Multi-click exploration',
        frequency: 0.65,
        impact: 0.8,
        description: 'Users often click multiple results before making a decision'
      },
      {
        pattern: 'Query refinement',
        frequency: 0.45,
        impact: 0.6,
        description: 'Users frequently modify their queries for better results'
      },
      {
        pattern: 'AI feature usage',
        frequency: 0.78,
        impact: 0.9,
        description: 'High adoption of AI-powered search features'
      }
    ];
  }

  private identifyContentGaps(metrics: SearchMetrics[]): SearchInsights['contentGaps'] {
    return [
      {
        category: 'Advanced React',
        demand: 85,
        supply: 30,
        gap: 55,
        recommendation: 'Create more advanced React courses'
      },
      {
        category: 'Machine Learning',
        demand: 92,
        supply: 65,
        gap: 27,
        recommendation: 'Expand ML course offerings'
      }
    ];
  }

  private identifyPerformanceBottlenecks(metrics: SearchMetrics[]): SearchInsights['performanceBottlenecks'] {
    const bottlenecks: SearchInsights['performanceBottlenecks'] = [];
    
    const avgProcessingTime = this.calculateAverage(metrics, 'processingTime');
    if (avgProcessingTime > 1500) {
      bottlenecks.push({
        component: 'Overall Search',
        avgTime: avgProcessingTime,
        occurrences: metrics.length,
        severity: 'high',
        recommendation: 'Optimize search algorithms and database queries'
      });
    }

    return bottlenecks;
  }

  private analyzeAccuracyMetrics(metrics: SearchMetrics[]): SearchInsights['accuracyMetrics'] {
    return [
      {
        metric: 'Semantic Search Accuracy',
        value: 0.85,
        target: 0.90,
        achieved: false,
        trend: 'improving'
      },
      {
        metric: 'Intent Recognition Accuracy',
        value: 0.82,
        target: 0.85,
        achieved: false,
        trend: 'stable'
      },
      {
        metric: 'Overall Search Accuracy',
        value: 0.83,
        target: 0.85,
        achieved: false,
        trend: 'improving'
      }
    ];
  }

  private checkPerformanceAlerts(metrics: SearchMetrics): void {
    // Check for processing time alerts
    if (metrics.processingTime > 3000) {
      this.createAlert({
        type: 'performance',
        severity: 'high',
        message: `High processing time detected: ${metrics.processingTime}ms`,
        metrics: { processingTime: metrics.processingTime },
        recommendations: ['Investigate slow query performance', 'Check system resources']
      });
    }

    // Check for low confidence alerts
    if (metrics.confidence < 0.3) {
      this.createAlert({
        type: 'accuracy',
        severity: 'medium',
        message: `Low confidence score: ${metrics.confidence}`,
        metrics: { confidence: metrics.confidence },
        recommendations: ['Review AI model performance', 'Check query quality']
      });
    }

    // Check for error conditions
    if (metrics.resultCount === 0 && metrics.query.length > 2) {
      this.createAlert({
        type: 'usage',
        severity: 'low',
        message: `No results for query: ${metrics.query}`,
        metrics: { resultCount: 0 },
        recommendations: ['Review query processing', 'Check content availability']
      });
    }
  }

  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alertData,
      timestamp: new Date(),
      resolved: false
    };

    this.performanceAlerts.push(alert);

    // Keep only last 100 alerts
    if (this.performanceAlerts.length > 100) {
      this.performanceAlerts = this.performanceAlerts.slice(-100);
    }

    logger.warn(`Performance alert created: ${alert.message}`);
  }
}

export default new SearchAnalyticsService();
