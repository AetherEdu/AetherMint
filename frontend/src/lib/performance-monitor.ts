import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

/** The numeric Core Web Vitals keys we track. */
export type PerformanceMetricKey = 'cls' | 'fid' | 'fcp' | 'lcp' | 'ttfb';

export interface PerformanceMetrics {
  cls: number;
  fid: number;
  fcp: number;
  lcp: number;
  ttfb: number;
  timestamp: number;
  url: string;
  userAgent: string;
  connectionType?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

export interface PerformanceAlert {
  metric: PerformanceMetricKey;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  url: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private observers: PerformanceObserver[] = [];
  private alertThresholds = {
    cls: { good: 0.1, needsImprovement: 0.25, poor: 0.5 },
    fid: { good: 100, needsImprovement: 300, poor: 600 },
    fcp: { good: 1800, needsImprovement: 3000, poor: 4000 },
    lcp: { good: 2500, needsImprovement: 4000, poor: 6000 },
    ttfb: { good: 800, needsImprovement: 1800, poor: 3000 },
  };

  constructor() {
    // Guard: skip browser-only initialization during SSR
    if (typeof window === 'undefined') return;
    this.initializeWebVitals();
    this.initializePerformanceObservers();
    this.trackResourceTiming();
    this.trackNavigationTiming();
  }

  private initializeWebVitals() {
    const handleMetric = (metric: Metric) => {
      const performanceData: Partial<PerformanceMetrics> = {
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType,
        deviceMemory: (navigator as any).deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
      };

      switch (metric.name) {
        case 'CLS':
          performanceData.cls = metric.value;
          break;
        case 'FID':
          performanceData.fid = metric.value;
          break;
        case 'FCP':
          performanceData.fcp = metric.value;
          break;
        case 'LCP':
          performanceData.lcp = metric.value;
          break;
        case 'TTFB':
          performanceData.ttfb = metric.value;
          break;
      }

      if (Object.keys(performanceData).length > 4) {
        this.addMetric(performanceData as PerformanceMetrics);
      }

      this.checkAlerts(metric.name as PerformanceMetricKey, metric.value);
    };

    getCLS(handleMetric);
    getFID(handleMetric);
    getFCP(handleMetric);
    getLCP(handleMetric);
    getTTFB(handleMetric);
  }

  private initializePerformanceObservers() {
    // Long Task Observer
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn('Long task detected:', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);

      // Layout Shift Observer
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            console.warn('Layout shift detected:', {
              value: (entry as any).value,
              sources: (entry as any).sources,
            });
          }
        }
      });
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(layoutShiftObserver);
    }
  }

  private trackResourceTiming() {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        const resources = list.getEntries();
        const slowResources = resources.filter(
          (entry) => entry.duration > 1000
        );
        
        if (slowResources.length > 0) {
          console.warn('Slow resources detected:', slowResources);
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    }
  }

  private trackNavigationTiming() {
    if ('PerformanceObserver' in window) {
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            const timingData = {
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
              loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
              domInteractive: navEntry.domInteractive - navEntry.startTime,
              firstPaint: this.getFirstPaint(),
              firstContentfulPaint: this.getFirstContentfulPaint(),
            };
            console.log('Navigation timing:', timingData);
          }
        });
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    }
  }

  private getFirstPaint(): number | null {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : null;
  }

  private getFirstContentfulPaint(): number | null {
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : null;
  }

  private checkAlerts(metric: PerformanceMetricKey, value: number) {
    const threshold = this.alertThresholds[metric];
    if (!threshold) return;

    let severity: 'low' | 'medium' | 'high' = 'low';
    
    if (value >= threshold.poor) {
      severity = 'high';
    } else if (value >= threshold.needsImprovement) {
      severity = 'medium';
    } else if (value >= threshold.good) {
      severity = 'low';
    }

    if (severity !== 'low') {
      const alert: PerformanceAlert = {
        metric,
        value,
        threshold: threshold.needsImprovement,
        severity,
        timestamp: Date.now(),
        url: window.location.href,
      };
      
      this.addAlert(alert);
      this.notifyAlert(alert);
    }
  }

  private notifyAlert(alert: PerformanceAlert) {
    // Send alert to monitoring service
    if (typeof window !== 'undefined') {
      console.warn('Performance Alert:', alert);
      
      // You can integrate with external monitoring services here
      // Example: Sentry, DataDog, New Relic, etc.
    }
  }

  private addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only last 100 metrics to prevent memory issues
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('performance-metrics', JSON.stringify(this.metrics));
    } catch (e) {
      console.warn('Failed to store metrics in localStorage:', e);
    }
  }

  private addAlert(alert: PerformanceAlert) {
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    // Store in localStorage
    try {
      localStorage.setItem('performance-alerts', JSON.stringify(this.alerts));
    } catch (e) {
      console.warn('Failed to store alerts in localStorage:', e);
    }
  }

  public getMetrics(): PerformanceMetrics[] {
    return this.metrics;
  }

  public getAlerts(): PerformanceAlert[] {
    return this.alerts;
  }

  public getAverageMetrics(): Partial<PerformanceMetrics> {
    if (this.metrics.length === 0) return {};

    const sum = this.metrics.reduce(
      (acc, metric) => ({
        cls: acc.cls + metric.cls,
        fid: acc.fid + metric.fid,
        fcp: acc.fcp + metric.fcp,
        lcp: acc.lcp + metric.lcp,
        ttfb: acc.ttfb + metric.ttfb,
      }),
      { cls: 0, fid: 0, fcp: 0, lcp: 0, ttfb: 0 }
    );

    const count = this.metrics.length;
    return {
      cls: sum.cls / count,
      fid: sum.fid / count,
      fcp: sum.fcp / count,
      lcp: sum.lcp / count,
      ttfb: sum.ttfb / count,
    };
  }

  public clearMetrics() {
    this.metrics = [];
    this.alerts = [];
    localStorage.removeItem('performance-metrics');
    localStorage.removeItem('performance-alerts');
  }

  public destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Guard against SSR: defer browser-only initialization
let _instance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!_instance) {
    _instance = new PerformanceMonitor();
  }
  return _instance;
}

// Export a singleton that is safe for SSR.
// The constructor has a guard for browser-only initialization.
export const performanceMonitor: PerformanceMonitor = new PerformanceMonitor();
