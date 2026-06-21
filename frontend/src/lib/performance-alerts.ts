import { getPerformanceMonitor, PerformanceAlert } from './performance-monitor';

const performanceMonitor =
  typeof window !== 'undefined' ? getPerformanceMonitor() : null;

export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    cls: { warning: number; critical: number };
    fid: { warning: number; critical: number };
    fcp: { warning: number; critical: number };
    lcp: { warning: number; critical: number };
    ttfb: { warning: number; critical: number };
  };
  notifications: {
    console: boolean;
    toast: boolean;
    external: boolean;
  };
  cooldown: number; // milliseconds between same alert types
}

class PerformanceAlertService {
  private config: AlertConfig = {
    enabled: true,
    thresholds: {
      cls: { warning: 0.1, critical: 0.25 },
      fid: { warning: 100, critical: 300 },
      fcp: { warning: 1800, critical: 3000 },
      lcp: { warning: 2500, critical: 4000 },
      ttfb: { warning: 800, critical: 1800 },
    },
    notifications: {
      console: true,
      toast: true,
      external: false,
    },
    cooldown: 30000, // 30 seconds
  };

  private lastAlertTimes: Map<string, number> = new Map();
  private alertHistory: PerformanceAlert[] = [];

  constructor() {
    // Only run browser-specific setup in browser environment
    if (typeof window !== 'undefined') {
      this.loadConfig();
      this.setupAlertListeners();
    }
  }

  private loadConfig() {
    try {
      if (typeof window === 'undefined') return;
      const stored = localStorage.getItem('performance-alert-config');
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load alert config:', error);
    }
  }

  private saveConfig() {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem('performance-alert-config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save alert config:', error);
    }
  }

  private setupAlertListeners() {
    // Listen for performance alerts from the monitor
    setInterval(() => {
      const alerts = performanceMonitor.getAlerts();
      const newAlerts = alerts.filter(alert => 
        !this.alertHistory.some(existing => 
          existing.metric === alert.metric && 
          existing.timestamp === alert.timestamp
        )
      );

      newAlerts.forEach(alert => this.processAlert(alert));
    }, 5000);
  }

  private processAlert(alert: PerformanceAlert) {
    if (!this.config.enabled) return;

    const alertKey = `${alert.metric}-${alert.url}`;
    const now = Date.now();
    const lastAlert = this.lastAlertTimes.get(alertKey);

    if (lastAlert && (now - lastAlert) < this.config.cooldown) {
      return; // Skip due to cooldown
    }

    this.lastAlertTimes.set(alertKey, now);
    this.alertHistory.push(alert);

    // Keep only last 100 alerts in history
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(-100);
    }

    this.sendNotifications(alert);
  }

  private sendNotifications(alert: PerformanceAlert) {
    const message = this.formatAlertMessage(alert);
    const severity = this.determineSeverity(alert);

    if (this.config.notifications.console) {
      this.sendConsoleNotification(alert, message, severity);
    }

    if (this.config.notifications.toast) {
      this.sendToastNotification(alert, message, severity);
    }

    if (this.config.notifications.external) {
      this.sendExternalNotification(alert, message, severity);
    }
  }

  private formatAlertMessage(alert: PerformanceAlert): string {
    const metricNames = {
      cls: 'Cumulative Layout Shift',
      fid: 'First Input Delay',
      fcp: 'First Contentful Paint',
      lcp: 'Largest Contentful Paint',
      ttfb: 'Time to First Byte',
    };

    const metricName = metricNames[alert.metric as keyof typeof metricNames] || String(alert.metric).toUpperCase();
    const unit = alert.metric === 'cls' ? '' : 'ms';
    const value = alert.metric === 'cls' ? alert.value.toFixed(3) : Math.round(alert.value);

    return `${metricName} is ${value}${unit} (threshold: ${alert.threshold}${unit})`;
  }

  private determineSeverity(alert: PerformanceAlert): 'info' | 'warning' | 'error' {
    const threshold = this.config.thresholds[alert.metric as keyof AlertConfig['thresholds']];
    if (!threshold) return 'warning';

    if (alert.value >= threshold.critical) return 'error';
    if (alert.value >= threshold.warning) return 'warning';
    return 'info';
  }

  private sendConsoleNotification(alert: PerformanceAlert, message: string, severity: string) {
    const style = this.getConsoleStyle(severity);
    console.log(`%c🚨 Performance Alert: ${message}`, style);
  }

  private getConsoleStyle(severity: string): string {
    switch (severity) {
      case 'error':
        return 'color: #ef4444; font-weight: bold; background: #fef2f2; padding: 4px 8px; border-radius: 4px;';
      case 'warning':
        return 'color: #f59e0b; font-weight: bold; background: #fffbeb; padding: 4px 8px; border-radius: 4px;';
      default:
        return 'color: #3b82f6; font-weight: bold; background: #eff6ff; padding: 4px 8px; border-radius: 4px;';
    }
  }

  private sendToastNotification(alert: PerformanceAlert, message: string, severity: string) {
    // This would integrate with a toast notification system
    // For now, we'll use a simple browser notification if available
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Performance Alert', {
        body: message,
        icon: '/favicon.ico',
        tag: `performance-${alert.metric}`,
      });
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  private async sendExternalNotification(alert: PerformanceAlert, message: string, severity: string) {
    try {
      await fetch('/api/performance/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert,
          message,
          severity,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      console.warn('Failed to send external notification:', error);
    }
  }

  public updateConfig(newConfig: Partial<AlertConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  public getConfig(): AlertConfig {
    return { ...this.config };
  }

  public getAlertHistory(): PerformanceAlert[] {
    return [...this.alertHistory];
  }

  // The performanceMonitor may be `null` in SSR. Capture the typed ref
  // once per tick; we also coerce any numeric/string metric keys through
  // `String(...)` so the indexing works for both string and numeric
  // identifiers (some browser typings include timestamps as numeric keys).
  private safeMonitor() {
    return performanceMonitor;
  }

  public clearAlertHistory() {
    this.alertHistory = [];
    this.lastAlertTimes.clear();
  }

  public testAlert(metric: keyof AlertConfig['thresholds']) {      const testAlert: PerformanceAlert = {
      metric: metric as unknown as PerformanceAlert['metric'],
      value: this.config.thresholds[metric].critical,
      threshold: this.config.thresholds[metric].warning,
      severity: 'high',
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    if (typeof window === 'undefined') return;
    this.processAlert(testAlert);
  }

  public enableAlerts() {
    this.config.enabled = true;
    this.saveConfig();
  }

  public disableAlerts() {
    this.config.enabled = false;
    this.saveConfig();
  }

  public isAlertsEnabled(): boolean {
    return this.config.enabled;
  }
}

export const performanceAlertService = new PerformanceAlertService();
