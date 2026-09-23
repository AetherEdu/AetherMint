import { performanceMonitor, PerformanceMetrics, PerformanceAlert, PerformanceMetricKey } from '@/lib/performance-monitor';

export interface PerformanceReport {
  timestamp: number;
  url: string;
  metrics: Partial<PerformanceMetrics>;
  alerts: PerformanceAlert[];
  score: number;
  recommendations: string[];
}

export interface BundleAnalysis {
  totalSize: number;
  chunks: Array<{
    name: string;
    size: number;
    modules: number;
  }>;
  largestAssets: Array<{
    name: string;
    size: number;
  }>;
  recommendations: string[];
}

class PerformanceReportingService {
  private readonly PERFORMANCE_SCORE_WEIGHTS = {
    cls: 0.25,
    fid: 0.20,
    fcp: 0.15,
    lcp: 0.25,
    ttfb: 0.15,
  };

  private readonly PERFORMANCE_THRESHOLDS = {
    cls: { excellent: 0.1, good: 0.25, poor: 0.5 },
    fid: { excellent: 100, good: 300, poor: 600 },
    fcp: { excellent: 1800, good: 3000, poor: 4000 },
    lcp: { excellent: 2500, good: 4000, poor: 6000 },
    ttfb: { excellent: 800, good: 1800, poor: 3000 },
  };

  public generateReport(): PerformanceReport {
    const metrics = performanceMonitor.getAverageMetrics();
    const alerts = performanceMonitor.getAlerts();
    const score = this.calculatePerformanceScore(metrics);
    const recommendations = this.generateRecommendations(metrics, alerts);

    return {
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      metrics,
      alerts,
      score,
      recommendations,
    };
  }

  private calculatePerformanceScore(metrics: Partial<PerformanceMetrics>): number {
    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(this.PERFORMANCE_SCORE_WEIGHTS).forEach(([metric, weight]) => {
      const key = metric as PerformanceMetricKey;
      const value = metrics[key];
      if (typeof value === 'number') {
        const score = this.getMetricScore(key, value);
        totalScore += score * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  private getMetricScore(metric: PerformanceMetricKey, value: number): number {
    const thresholds = this.PERFORMANCE_THRESHOLDS[metric];
    
    if (value <= thresholds.excellent) return 100;
    if (value <= thresholds.good) return 80;
    if (value <= thresholds.poor) return 60;
    return 40;
  }

  private generateRecommendations(
    metrics: Partial<PerformanceMetrics>,
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Core Web Vitals recommendations
    if (metrics.cls && metrics.cls > 0.1) {
      recommendations.push('Reduce Cumulative Layout Shift by including size attributes on images and videos');
      recommendations.push('Avoid inserting new content above existing content unless in response to user interaction');
    }

    if (metrics.fid && metrics.fid > 100) {
      recommendations.push('Reduce First Input Delay by breaking up long tasks and optimizing JavaScript execution');
      recommendations.push('Consider code splitting to reduce initial JavaScript bundle size');
    }

    if (metrics.fcp && metrics.fcp > 1800) {
      recommendations.push('Improve First Contentful Paint by optimizing server response time and resource loading');
      recommendations.push('Remove render-blocking resources and optimize critical CSS');
    }

    if (metrics.lcp && metrics.lcp > 2500) {
      recommendations.push('Optimize Largest Contentful Paint by compressing images and using modern formats');
      recommendations.push('Implement preloading for critical resources');
    }

    if (metrics.ttfb && metrics.ttfb > 800) {
      recommendations.push('Reduce Time to First Byte by optimizing server performance and using CDN');
      recommendations.push('Enable compression and caching headers');
    }

    // Alert-specific recommendations
    alerts.forEach(alert => {
      switch (alert.metric) {
        case 'cls':
          recommendations.push(`High CLS detected (${alert.value.toFixed(3)}): Reserve space for dynamic content`);
          break;
        case 'fid':
          recommendations.push(`High FID detected (${alert.value.toFixed(0)}ms): Minimize main thread work`);
          break;
        case 'fcp':
          recommendations.push(`Slow FCP detected (${alert.value.toFixed(0)}ms): Optimize critical rendering path`);
          break;
        case 'lcp':
          recommendations.push(`Slow LCP detected (${alert.value.toFixed(0)}ms): Optimize largest content element`);
          break;
        case 'ttfb':
          recommendations.push(`Slow TTFB detected (${alert.value.toFixed(0)}ms): Improve server response time`);
          break;
      }
    });

    return recommendations;
  }

  public async analyzeBundle(): Promise<BundleAnalysis> {
    try {
      const response = await fetch('/__webpack_analyze__');
      if (!response.ok) {
        throw new Error('Bundle analysis not available');
      }
      
      const bundleData = await response.json();
      return this.processBundleData(bundleData);
    } catch (error) {
      console.warn('Bundle analysis failed:', error);
      return this.getFallbackBundleAnalysis();
    }
  }

  private processBundleData(bundleData: any): BundleAnalysis {
    const chunks = bundleData.chunks || [];
    const totalSize = chunks.reduce((sum: number, chunk: any) => sum + chunk.size, 0);
    
    const largestAssets = chunks
      .sort((a: any, b: any) => b.size - a.size)
      .slice(0, 10)
      .map((chunk: any) => ({
        name: chunk.name,
        size: chunk.size,
      }));

    const recommendations = this.generateBundleRecommendations(chunks, totalSize);

    return {
      totalSize,
      chunks: chunks.map((chunk: any) => ({
        name: chunk.name,
        size: chunk.size,
        modules: chunk.modules?.length || 0,
      })),
      largestAssets,
      recommendations,
    };
  }

  private generateBundleRecommendations(chunks: any[], totalSize: number): string[] {
    const recommendations: string[] = [];

    if (totalSize > 1024 * 1024) { // 1MB
      recommendations.push('Consider implementing code splitting to reduce initial bundle size');
    }

    const largeChunks = chunks.filter(chunk => chunk.size > 200 * 1024); // 200KB
    if (largeChunks.length > 0) {
      recommendations.push('Large chunks detected. Consider dynamic imports for rarely used features');
    }

    const vendorChunk = chunks.find(chunk => chunk.name.includes('vendor'));
    if (vendorChunk && vendorChunk.size > 300 * 1024) {
      recommendations.push('Large vendor bundle detected. Consider tree shaking and removing unused dependencies');
    }

    return recommendations;
  }

  private getFallbackBundleAnalysis(): BundleAnalysis {
    return {
      totalSize: 0,
      chunks: [],
      largestAssets: [],
      recommendations: [
        'Run "npm run analyze" to get detailed bundle analysis',
        'Consider using webpack-bundle-analyzer for deeper insights',
      ],
    };
  }

  public exportReport(report: PerformanceReport): string {
    return JSON.stringify(report, null, 2);
  }

  public async sendReportToService(report: PerformanceReport): Promise<void> {
    try {
      await fetch('/api/performance/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });
    } catch (error) {
      console.warn('Failed to send performance report:', error);
    }
  }

  public getHistoricalReports(): PerformanceReport[] {
    try {
      const stored = localStorage.getItem('performance-reports');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load historical reports:', error);
      return [];
    }
  }

  public saveReport(report: PerformanceReport): void {
    try {
      const reports = this.getHistoricalReports();
      reports.push(report);
      
      // Keep only last 50 reports
      if (reports.length > 50) {
        reports.splice(0, reports.length - 50);
      }
      
      localStorage.setItem('performance-reports', JSON.stringify(reports));
    } catch (error) {
      console.warn('Failed to save performance report:', error);
    }
  }
}

export const performanceReporting = new PerformanceReportingService();
