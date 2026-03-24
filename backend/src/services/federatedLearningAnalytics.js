const EventEmitter = require('events');

class FederatedLearningAnalyticsService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.metricsHistory = [];
    this.realTimeMetrics = new Map();
    this.dashboardConfig = {
      updateInterval: options.updateInterval || 5000, // 5 seconds
      retentionPeriod: options.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      maxDataPoints: options.maxDataPoints || 1000
    };
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  // Start real-time monitoring
  startMonitoring() {
    try {
      if (this.isMonitoring) {
        console.log('📊 Analytics monitoring is already running');
        return;
      }

      this.isMonitoring = true;
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
        this.updateRealTimeData();
        this.cleanupOldData();
      }, this.dashboardConfig.updateInterval);

      console.log('📊 Federated Learning Analytics monitoring started');
      this.emit('monitoringStarted');
    } catch (error) {
      console.error('❌ Failed to start analytics monitoring:', error);
      throw error;
    }
  }

  // Stop monitoring
  stopMonitoring() {
    try {
      if (!this.isMonitoring) {
        console.log('📊 Analytics monitoring is not running');
        return;
      }

      this.isMonitoring = false;
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      console.log('📊 Federated Learning Analytics monitoring stopped');
      this.emit('monitoringStopped');
    } catch (error) {
      console.error('❌ Failed to stop analytics monitoring:', error);
      throw error;
    }
  }

  // Collect metrics from federated learning system
  collectMetrics() {
    try {
      const timestamp = new Date();
      
      // In a real implementation, this would collect actual metrics from the FL system
      const metrics = {
        timestamp,
        systemMetrics: this.collectSystemMetrics(),
        modelMetrics: this.collectModelMetrics(),
        participantMetrics: this.collectParticipantMetrics(),
        privacyMetrics: this.collectPrivacyMetrics(),
        performanceMetrics: this.collectPerformanceMetrics(),
        securityMetrics: this.collectSecurityMetrics()
      };

      this.metricsHistory.push(metrics);
      
      // Keep only the most recent data points
      if (this.metricsHistory.length > this.dashboardConfig.maxDataPoints) {
        this.metricsHistory = this.metricsHistory.slice(-this.dashboardConfig.maxDataPoints);
      }

      this.emit('metricsCollected', metrics);
    } catch (error) {
      console.error('❌ Failed to collect metrics:', error);
    }
  }

  // Collect system metrics
  collectSystemMetrics() {
    return {
      activeRounds: Math.floor(Math.random() * 5),
      totalRounds: Math.floor(Math.random() * 100) + 50,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      networkLatency: Math.random() * 100 + 10,
      errorRate: Math.random() * 0.05
    };
  }

  // Collect model metrics
  collectModelMetrics() {
    return {
      globalModelAccuracy: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
      modelAccuracyTrend: this.calculateTrend('accuracy'),
      modelConvergenceRate: Math.random() * 0.1 + 0.05,
      modelSize: Math.random() * 10000000 + 1000000, // 1MB to 11MB
      modelUpdateFrequency: Math.random() * 10 + 5,
      modelVersion: Math.floor(Math.random() * 100),
      trainingLoss: Math.random() * 0.5 + 0.1,
      validationLoss: Math.random() * 0.5 + 0.1
    };
  }

  // Collect participant metrics
  collectParticipantMetrics() {
    return {
      totalParticipants: Math.floor(Math.random() * 50) + 10,
      activeParticipants: Math.floor(Math.random() * 30) + 5,
      participantDistribution: this.getParticipantDistribution(),
      averageContributionTime: Math.random() * 300 + 60, // 1-6 minutes
      participantRetentionRate: Math.random() * 0.3 + 0.7, // 70-100%
      newParticipants: Math.floor(Math.random() * 5),
      dropoutRate: Math.random() * 0.1
    };
  }

  // Collect privacy metrics
  collectPrivacyMetrics() {
    return {
      epsilonBudget: Math.random() * 2 + 0.5, // 0.5 to 2.5
      remainingBudget: Math.random() * 2,
      privacyLossRate: Math.random() * 0.01,
      dpNoiseLevel: Math.random() * 0.1,
      encryptionStrength: 'high',
      privacyGuarantees: {
        differentialPrivacy: true,
        secureAggregation: true,
        homomorphicEncryption: true
      },
      privacyViolations: 0
    };
  }

  // Collect performance metrics
  collectPerformanceMetrics() {
    return {
      aggregationTime: Math.random() * 1000 + 100, // 100-1100ms
      communicationOverhead: Math.random() * 1000000 + 100000, // 100KB-1.1MB
      throughput: Math.random() * 1000 + 100, // requests per second
      latency: {
        average: Math.random() * 100 + 20,
        p95: Math.random() * 200 + 50,
        p99: Math.random() * 500 + 100
      },
      scalability: Math.random() * 0.3 + 0.7, // 70-100%
      resourceUtilization: Math.random() * 0.4 + 0.3 // 30-70%
    };
  }

  // Collect security metrics
  collectSecurityMetrics() {
    return {
      authenticationAttempts: Math.floor(Math.random() * 1000) + 100,
      failedAuthentications: Math.floor(Math.random() * 10),
      securityIncidents: 0,
      signatureVerifications: Math.floor(Math.random() * 10000) + 1000,
      failedVerifications: Math.floor(Math.random() * 5),
      encryptionOperations: Math.floor(Math.random() * 50000) + 10000,
      secureComputations: Math.floor(Math.random() * 100) + 10,
      threatLevel: 'low'
    };
  }

  // Get participant distribution by region
  getParticipantDistribution() {
    return {
      'North America': Math.floor(Math.random() * 20) + 5,
      'Europe': Math.floor(Math.random() * 15) + 3,
      'Asia': Math.floor(Math.random() * 25) + 8,
      'South America': Math.floor(Math.random() * 10) + 2,
      'Africa': Math.floor(Math.random() * 8) + 1,
      'Oceania': Math.floor(Math.random() * 5) + 1
    };
  }

  // Calculate trend for a metric
  calculateTrend(metricType) {
    if (this.metricsHistory.length < 2) {
      return 'stable';
    }

    const recent = this.metricsHistory.slice(-5);
    const values = recent.map(m => m.modelMetrics[`globalModel${metricType.charAt(0).toUpperCase() + metricType.slice(1)}`] || 0);
    
    if (values.length < 2) return 'stable';

    const trend = values[values.length - 1] - values[0];
    
    if (trend > 0.01) return 'improving';
    if (trend < -0.01) return 'declining';
    return 'stable';
  }

  // Update real-time data
  updateRealTimeData() {
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    if (!latestMetrics) return;

    this.realTimeMetrics.set('systemHealth', this.calculateSystemHealth(latestMetrics));
    this.realTimeMetrics.set('modelPerformance', this.calculateModelPerformance(latestMetrics));
    this.realTimeMetrics.set('privacyStatus', this.calculatePrivacyStatus(latestMetrics));
    this.realTimeMetrics.set('securityStatus', this.calculateSecurityStatus(latestMetrics));
  }

  // Calculate system health score
  calculateSystemHealth(metrics) {
    const systemScore = (
      (1 - metrics.systemMetrics.errorRate) * 0.3 +
      (metrics.participantMetrics.activeParticipants / metrics.participantMetrics.totalParticipants) * 0.3 +
      (1 - metrics.participantMetrics.dropoutRate) * 0.2 +
      (metrics.performanceMetrics.throughput / 1000) * 0.2
    );

    return {
      score: Math.min(1, Math.max(0, systemScore)),
      status: systemScore > 0.8 ? 'healthy' : systemScore > 0.6 ? 'warning' : 'critical',
      issues: this.identifySystemIssues(metrics)
    };
  }

  // Calculate model performance score
  calculateModelPerformance(metrics) {
    const performanceScore = (
      metrics.modelMetrics.globalModelAccuracy * 0.4 +
      (1 - metrics.modelMetrics.trainingLoss) * 0.3 +
      (1 - metrics.modelMetrics.validationLoss) * 0.3
    );

    return {
      score: Math.min(1, Math.max(0, performanceScore)),
      accuracy: metrics.modelMetrics.globalModelAccuracy,
      trend: metrics.modelMetrics.modelAccuracyTrend,
      convergence: metrics.modelMetrics.modelConvergenceRate
    };
  }

  // Calculate privacy status
  calculatePrivacyStatus(metrics) {
    const privacyScore = (
      (metrics.privacyMetrics.remainingBudget / metrics.privacyMetrics.epsilonBudget) * 0.4 +
      (1 - metrics.privacyMetrics.privacyLossRate) * 0.3 +
      (1 - metrics.privacyMetrics.dpNoiseLevel) * 0.3
    );

    return {
      score: Math.min(1, Math.max(0, privacyScore)),
      budgetRemaining: metrics.privacyMetrics.remainingBudget,
      budgetUsed: metrics.privacyMetrics.epsilonBudget - metrics.privacyMetrics.remainingBudget,
      guarantees: metrics.privacyMetrics.privacyGuarantees,
      violations: metrics.privacyMetrics.privacyViolations
    };
  }

  // Calculate security status
  calculateSecurityStatus(metrics) {
    const securityScore = (
      (1 - metrics.securityMetrics.failedAuthentications / metrics.securityMetrics.authenticationAttempts) * 0.4 +
      (1 - metrics.securityMetrics.failedVerifications / metrics.securityMetrics.signatureVerifications) * 0.3 +
      (metrics.securityMetrics.threatLevel === 'low' ? 1 : 0.5) * 0.3
    );

    return {
      score: Math.min(1, Math.max(0, securityScore)),
      threatLevel: metrics.securityMetrics.threatLevel,
      incidents: metrics.securityMetrics.securityIncidents,
      authentications: metrics.securityMetrics.authenticationAttempts,
      verifications: metrics.securityMetrics.signatureVerifications
    };
  }

  // Identify system issues
  identifySystemIssues(metrics) {
    const issues = [];

    if (metrics.systemMetrics.errorRate > 0.05) {
      issues.push({
        type: 'high_error_rate',
        severity: 'high',
        description: 'High system error rate detected'
      });
    }

    if (metrics.participantMetrics.dropoutRate > 0.1) {
      issues.push({
        type: 'high_dropout_rate',
        severity: 'medium',
        description: 'High participant dropout rate'
      });
    }

    if (metrics.performanceMetrics.latency.average > 200) {
      issues.push({
        type: 'high_latency',
        severity: 'medium',
        description: 'High average latency'
      });
    }

    return issues;
  }

  // Clean up old data
  cleanupOldData() {
    const cutoffTime = Date.now() - this.dashboardConfig.retentionPeriod;
    
    this.metricsHistory = this.metricsHistory.filter(
      metrics => metrics.timestamp.getTime() > cutoffTime
    );
  }

  // Get dashboard data
  getDashboardData(timeRange = '1h') {
    try {
      const now = new Date();
      let startTime;

      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
      }

      const filteredMetrics = this.metricsHistory.filter(
        metrics => metrics.timestamp >= startTime
      );

      return {
        timeRange,
        dataPoints: filteredMetrics.length,
        summary: this.generateSummary(filteredMetrics),
        realTime: Object.fromEntries(this.realTimeMetrics),
        charts: this.generateChartData(filteredMetrics)
      };
    } catch (error) {
      console.error('❌ Failed to get dashboard data:', error);
      throw error;
    }
  }

  // Generate summary statistics
  generateSummary(metrics) {
    if (metrics.length === 0) {
      return {
        message: 'No data available for the selected time range'
      };
    }

    const latest = metrics[metrics.length - 1];
    const summary = {
      systemHealth: this.realTimeMetrics.get('systemHealth'),
      modelPerformance: this.realTimeMetrics.get('modelPerformance'),
      privacyStatus: this.realTimeMetrics.get('privacyStatus'),
      securityStatus: this.realTimeMetrics.get('securityStatus'),
      keyMetrics: {
        totalParticipants: latest.participantMetrics.totalParticipants,
        activeParticipants: latest.participantMetrics.activeParticipants,
        modelAccuracy: latest.modelMetrics.globalModelAccuracy,
        privacyBudgetUsed: latest.privacyMetrics.epsilonBudget - latest.privacyMetrics.remainingBudget,
        aggregationTime: latest.performanceMetrics.aggregationTime
      }
    };

    return summary;
  }

  // Generate chart data
  generateChartData(metrics) {
    if (metrics.length === 0) {
      return {};
    }

    const timestamps = metrics.map(m => m.timestamp.toISOString());
    
    return {
      accuracy: {
        labels: timestamps,
        data: metrics.map(m => m.modelMetrics.globalModelAccuracy)
      },
      participants: {
        labels: timestamps,
        data: metrics.map(m => m.participantMetrics.activeParticipants)
      },
      privacyBudget: {
        labels: timestamps,
        data: metrics.map(m => m.privacyMetrics.remainingBudget)
      },
      latency: {
        labels: timestamps,
        data: metrics.map(m => m.performanceMetrics.latency.average)
      },
      systemHealth: {
        labels: timestamps,
        data: metrics.map(m => {
          const score = (
            (1 - m.systemMetrics.errorRate) * 0.3 +
            (m.participantMetrics.activeParticipants / m.participantMetrics.totalParticipants) * 0.3 +
            (1 - m.participantMetrics.dropoutRate) * 0.2 +
            (m.performanceMetrics.throughput / 1000) * 0.2
          );
          return Math.min(1, Math.max(0, score));
        })
      }
    };
  }

  // Get detailed analytics report
  getAnalyticsReport(reportType = 'comprehensive') {
    try {
      const report = {
        timestamp: new Date(),
        type: reportType,
        data: this.metricsHistory,
        summary: this.generateSummary(this.metricsHistory),
        insights: this.generateInsights(),
        recommendations: this.generateRecommendations(),
        trends: this.analyzeTrends()
      };

      return report;
    } catch (error) {
      console.error('❌ Failed to generate analytics report:', error);
      throw error;
    }
  }

  // Generate insights from metrics
  generateInsights() {
    const insights = [];
    const latest = this.metricsHistory[this.metricsHistory.length - 1];

    if (!latest) return insights;

    // Model performance insights
    if (latest.modelMetrics.globalModelAccuracy > 0.9) {
      insights.push({
        type: 'performance',
        level: 'positive',
        message: 'Model accuracy is excellent (>90%)'
      });
    } else if (latest.modelMetrics.globalModelAccuracy < 0.7) {
      insights.push({
        type: 'performance',
        level: 'negative',
        message: 'Model accuracy needs improvement (<70%)'
      });
    }

    // Privacy insights
    if (latest.privacyMetrics.remainingBudget < latest.privacyMetrics.epsilonBudget * 0.2) {
      insights.push({
        type: 'privacy',
        level: 'warning',
        message: 'Privacy budget is running low (<20% remaining)'
      });
    }

    // Participant insights
    if (latest.participantMetrics.activeParticipants < latest.participantMetrics.totalParticipants * 0.5) {
      insights.push({
        type: 'participation',
        level: 'warning',
        message: 'Low participant engagement (<50% active)'
      });
    }

    return insights;
  }

  // Generate recommendations
  generateRecommendations() {
    const recommendations = [];
    const latest = this.metricsHistory[this.metricsHistory.length - 1];

    if (!latest) return recommendations;

    // Performance recommendations
    if (latest.modelMetrics.globalModelAccuracy < 0.8) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        action: 'Consider increasing model complexity or training epochs',
        expectedImpact: 'improved_accuracy'
      });
    }

    // Privacy recommendations
    if (latest.privacyMetrics.remainingBudget < 1.0) {
      recommendations.push({
        category: 'privacy',
        priority: 'medium',
        action: 'Adjust epsilon parameter or implement privacy budget management',
        expectedImpact: 'extended_privacy_budget'
      });
    }

    // Participation recommendations
    if (latest.participantMetrics.dropoutRate > 0.1) {
      recommendations.push({
        category: 'participation',
        priority: 'medium',
        action: 'Improve participant incentives or reduce communication overhead',
        expectedImpact: 'higher_retention'
      });
    }

    return recommendations;
  }

  // Analyze trends
  analyzeTrends() {
    if (this.metricsHistory.length < 10) {
      return { message: 'Insufficient data for trend analysis' };
    }

    const recent = this.metricsHistory.slice(-10);
    const trends = {};

    // Accuracy trend
    const accuracyValues = recent.map(m => m.modelMetrics.globalModelAccuracy);
    trends.accuracy = this.calculateTrendDirection(accuracyValues);

    // Participant trend
    const participantValues = recent.map(m => m.participantMetrics.activeParticipants);
    trends.participants = this.calculateTrendDirection(participantValues);

    // Privacy budget trend
    const privacyValues = recent.map(m => m.privacyMetrics.remainingBudget);
    trends.privacyBudget = this.calculateTrendDirection(privacyValues);

    // Latency trend
    const latencyValues = recent.map(m => m.performanceMetrics.latency.average);
    trends.latency = this.calculateTrendDirection(latencyValues, true); // Reverse for latency (lower is better)

    return trends;
  }

  // Calculate trend direction
  calculateTrendDirection(values, reverse = false) {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (reverse) {
      // For metrics where lower is better (like latency)
      if (change < -0.05) return 'improving';
      if (change > 0.05) return 'declining';
    } else {
      // For metrics where higher is better
      if (change > 0.05) return 'improving';
      if (change < -0.05) return 'declining';
    }

    return 'stable';
  }

  // Export analytics data
  exportAnalyticsData(format = 'json') {
    try {
      const data = {
        timestamp: new Date(),
        metricsHistory: this.metricsHistory,
        realTimeMetrics: Object.fromEntries(this.realTimeMetrics),
        config: this.dashboardConfig
      };

      switch (format.toLowerCase()) {
        case 'json':
          return JSON.stringify(data, null, 2);
        case 'csv':
          return this.convertToCSV(data.metricsHistory);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('❌ Failed to export analytics data:', error);
      throw error;
    }
  }

  // Convert metrics to CSV format
  convertToCSV(metrics) {
    if (metrics.length === 0) return '';

    const headers = [
      'timestamp',
      'globalModelAccuracy',
      'totalParticipants',
      'activeParticipants',
      'remainingBudget',
      'aggregationTime',
      'averageLatency'
    ];

    const rows = metrics.map(m => [
      m.timestamp.toISOString(),
      m.modelMetrics.globalModelAccuracy,
      m.participantMetrics.totalParticipants,
      m.participantMetrics.activeParticipants,
      m.privacyMetrics.remainingBudget,
      m.performanceMetrics.aggregationTime,
      m.performanceMetrics.latency.average
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  // Get monitoring status
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      updateInterval: this.dashboardConfig.updateInterval,
      dataPoints: this.metricsHistory.length,
      oldestDataPoint: this.metricsHistory.length > 0 ? this.metricsHistory[0].timestamp : null,
      newestDataPoint: this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1].timestamp : null
    };
  }

  // Update dashboard configuration
  updateConfig(newConfig) {
    this.dashboardConfig = { ...this.dashboardConfig, ...newConfig };
    
    // Restart monitoring if interval changed
    if (newConfig.updateInterval && this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }

    console.log('🔧 Dashboard configuration updated');
  }
}

module.exports = FederatedLearningAnalyticsService;
