/**
 * Reporting Service
 * Comprehensive reporting and analytics for enrollment and payment data
 */

import { 
  Enrollment, 
  EnrollmentStatus, 
  PaymentStatus, 
  PaymentMethod,
  EnrollmentAnalytics,
  CourseEnrollmentSummary,
  UserEnrollmentHistory
} from '../models/Enrollment';
import { 
  PaymentAnalytics,
  RefundAnalytics
} from '../models/Payment';

export interface ReportRequest {
  type: 'enrollment' | 'payment' | 'course' | 'user' | 'financial' | 'learning';
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: {
    status?: string[];
    courseId?: string;
    userId?: string;
    paymentMethod?: string[];
    category?: string;
  };
  format?: 'json' | 'csv' | 'xlsx' | 'pdf';
  includeCharts?: boolean;
  groupBy?: 'day' | 'week' | 'month' | 'year';
}

export interface ReportData {
  summary: ReportSummary;
  details: any[];
  charts?: ChartData[];
  metadata: {
    generatedAt: Date;
    generatedBy?: string;
    type: string;
    dateRange?: any;
    filters?: any;
  };
}

export interface ReportSummary {
  totalRecords: number;
  keyMetrics: Record<string, any>;
  trends: Record<string, any>;
  insights: string[];
  recommendations?: string[];
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: any[];
  xAxis?: string;
  yAxis?: string;
}

export interface EnrollmentReport {
  totalEnrollments: number;
  statusBreakdown: Record<EnrollmentStatus, number>;
  completionMetrics: {
    averageCompletionTime: number;
    completionRate: number;
    averageProgress: number;
  };
  revenueMetrics: {
    totalRevenue: number;
    averageRevenuePerEnrollment: number;
    revenueByPaymentMethod: Record<PaymentMethod, number>;
  };
  timeSeriesData: Array<{
    date: string;
    enrollments: number;
    completions: number;
    revenue: number;
  }>;
  coursePerformance: Array<{
    courseId: string;
    courseTitle: string;
    enrollments: number;
    completions: number;
    revenue: number;
    rating: number;
  }>;
}

export interface PaymentReport {
  totalTransactions: number;
  totalRevenue: number;
  successRate: number;
  averageTransactionValue: number;
  paymentMethodBreakdown: Record<PaymentMethod, {
    count: number;
    revenue: number;
    successRate: number;
  }>;
  refundMetrics: {
    totalRefunds: number;
    totalRefundAmount: number;
    refundRate: number;
    averageRefundAmount: number;
    refundReasons: Record<string, number>;
  };
  currencyBreakdown: Record<string, {
    count: number;
    revenue: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    transactions: number;
    revenue: number;
    refunds: number;
  }>;
}

export interface CourseReport {
  courseId: string;
  courseTitle: string;
  enrollmentMetrics: {
    totalEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    waitlistCount: number;
    completionRate: number;
    averageCompletionTime: number;
  };
  financialMetrics: {
    totalRevenue: number;
    averageRevenuePerEnrollment: number;
    revenueByPaymentMethod: Record<PaymentMethod, number>;
    refundMetrics: {
      totalRefunds: number;
      totalRefundAmount: number;
      refundRate: number;
    };
  };
  studentDemographics: {
    geographicDistribution: Record<string, number>;
    experienceLevelDistribution: Record<string, number>;
    enrollmentTrends: Array<{
      date: string;
      count: number;
    }>;
  };
  performanceMetrics: {
    averageRating: number;
    averageCompletionTime: number;
    studentSatisfaction: number;
    engagementMetrics: {
      averageLoginFrequency: number;
      averageSessionDuration: number;
      averageLessonsPerWeek: number;
    };
  };
}

export interface UserReport {
  userId: string;
  enrollmentHistory: {
    totalEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    totalSpent: number;
    averageCompletionTime: number;
    completionRate: number;
    favoriteCategories: Array<{ category: string; count: number }>;
    learningStreak: {
      current: number;
      longest: number;
    };
  };
  learningAnalytics: {
    totalLearningHours: number;
    averageSessionDuration: number;
    courseProgress: Array<{
      courseId: string;
      courseTitle: string;
      progress: number;
      timeSpent: number;
      lastAccessed: Date;
    }>;
    skillDevelopment: Array<{
      skill: string;
      level: number;
      improvements: number;
    }>;
    engagementMetrics: {
      loginFrequency: number;
      averageSessionsPerWeek: number;
      averageLessonsPerSession: number;
      peakLearningHours: number[];
    };
  };
  financialSummary: {
    totalSpent: number;
    spendingByMonth: Array<{ month: string; amount: number }>;
    spendingByCategory: Array<{ category: string; amount: number }>;
    paymentMethods: Record<PaymentMethod, { count: number; amount: number }>;
  };
}

export class ReportingService {
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes

  /**
   * Generate comprehensive report
   */
  async generateReport(request: ReportRequest): Promise<ReportData> {
    const cacheKey = this.generateCacheKey(request);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let data: any;
    let summary: ReportSummary;

    switch (request.type) {
      case 'enrollment':
        data = await this.generateEnrollmentReport(request);
        summary = this.generateEnrollmentSummary(data);
        break;
      case 'payment':
        data = await this.generatePaymentReport(request);
        summary = this.generatePaymentSummary(data);
        break;
      case 'course':
        data = await this.generateCourseReport(request);
        summary = this.generateCourseSummary(data);
        break;
      case 'user':
        data = await this.generateUserReport(request);
        summary = this.generateUserSummary(data);
        break;
      case 'financial':
        data = await this.generateFinancialReport(request);
        summary = this.generateFinancialSummary(data);
        break;
      case 'learning':
        data = await this.generateLearningReport(request);
        summary = this.generateLearningSummary(data);
        break;
      default:
        throw new Error(`Unsupported report type: ${request.type}`);
    }

    const reportData: ReportData = {
      summary,
      details: Array.isArray(data) ? data : [data],
      metadata: {
        generatedAt: new Date(),
        type: request.type,
        dateRange: request.dateRange,
        filters: request.filters
      }
    };

    if (request.includeCharts) {
      reportData.charts = this.generateCharts(data, request.type);
    }

    this.cache.set(cacheKey, reportData);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

    return reportData;
  }

  /**
   * Generate enrollment report
   */
  private async generateEnrollmentReport(request: ReportRequest): Promise<EnrollmentReport> {
    // Mock data - in production, this would query the database
    const report: EnrollmentReport = {
      totalEnrollments: 1250,
      statusBreakdown: {
        [EnrollmentStatus.PENDING]: 45,
        [EnrollmentStatus.CONFIRMED]: 125,
        [EnrollmentStatus.ACTIVE]: 850,
        [EnrollmentStatus.COMPLETED]: 180,
        [EnrollmentStatus.CANCELLED]: 25,
        [EnrollmentStatus.SUSPENDED]: 5,
        [EnrollmentStatus.REFUNDED]: 15,
        [EnrollmentStatus.EXPIRED]: 5
      } as any,
      completionMetrics: {
        averageCompletionTime: 28,
        completionRate: 14.4,
        averageProgress: 65
      },
      revenueMetrics: {
        totalRevenue: 285000,
        averageRevenuePerEnrollment: 228,
        revenueByPaymentMethod: {
          [PaymentMethod.STELLAR]: 142500,
          [PaymentMethod.STRIPE]: 114000,
          [PaymentMethod.CREDIT_CARD]: 0,
          [PaymentMethod.BANK_TRANSFER]: 28500,
          [PaymentMethod.CRYPTO]: 0,
          [PaymentMethod.INSTALLMENT]: 0
        }
      },
      timeSeriesData: [
        { date: '2024-01', enrollments: 180, completions: 25, revenue: 45000 },
        { date: '2024-02', enrollments: 210, completions: 30, revenue: 52000 },
        { date: '2024-03', enrollments: 195, completions: 28, revenue: 48000 },
        { date: '2024-04', enrollments: 240, completions: 35, revenue: 61000 },
        { date: '2024-05', enrollments: 220, completions: 32, revenue: 58000 },
        { date: '2024-06', enrollments: 260, completions: 40, revenue: 67000 }
      ],
      coursePerformance: [
        { courseId: 'course1', courseTitle: 'Web Development', enrollments: 425, completions: 60, revenue: 85000, rating: 4.5 },
        { courseId: 'course2', courseTitle: 'Data Science', enrollments: 350, completions: 50, revenue: 70000, rating: 4.7 },
        { courseId: 'course3', courseTitle: 'Blockchain', enrollments: 300, completions: 40, revenue: 60000, rating: 4.3 },
        { courseId: 'course4', courseTitle: 'Mobile Development', enrollments: 280, completions: 35, revenue: 70000, rating: 4.6 }
      ]
    };

    return report;
  }

  /**
   * Generate payment report
   */
  private async generatePaymentReport(request: ReportRequest): Promise<PaymentReport> {
    const report: PaymentReport = {
      totalTransactions: 1250,
      totalRevenue: 285000,
      successRate: 95.2,
      averageTransactionValue: 228,
      paymentMethodBreakdown: {
        [PaymentMethod.STELLAR]: {
          count: 650,
          revenue: 142500,
          successRate: 96.5
        },
        [PaymentMethod.STRIPE]: {
          count: 500,
          revenue: 114000,
          successRate: 94.8
        },
        [PaymentMethod.CREDIT_CARD]: {
          count: 0,
          revenue: 0,
          successRate: 0
        },
        [PaymentMethod.BANK_TRANSFER]: {
          count: 100,
          revenue: 28500,
          successRate: 92.0
        },
        [PaymentMethod.CRYPTO]: {
          count: 0,
          revenue: 0,
          successRate: 0
        },
        [PaymentMethod.INSTALLMENT]: {
          count: 0,
          revenue: 0,
          successRate: 0
        }
      },
      refundMetrics: {
        totalRefunds: 25,
        totalRefundAmount: 15000,
        refundRate: 2.0,
        averageRefundAmount: 600,
        refundReasons: {
          'course_quality': 8,
          'technical_issues': 6,
          'change_of_mind': 5,
          'personal_reasons': 4,
          'other': 2
        }
      },
      currencyBreakdown: {
        'USD': { count: 900, revenue: 200000 },
        'EUR': { count: 300, revenue: 65000 },
        'XLM': { count: 50, revenue: 20000 }
      },
      timeSeriesData: [
        { date: '2024-01', transactions: 180, revenue: 45000, refunds: 5 },
        { date: '2024-02', transactions: 210, revenue: 52000, refunds: 3 },
        { date: '2024-03', transactions: 195, revenue: 48000, refunds: 4 },
        { date: '2024-04', transactions: 240, revenue: 61000, refunds: 6 },
        { date: '2024-05', transactions: 220, revenue: 58000, refunds: 4 },
        { date: '2024-06', transactions: 260, revenue: 67000, refunds: 3 }
      ]
    };

    return report;
  }

  /**
   * Generate course report
   */
  private async generateCourseReport(request: ReportRequest): Promise<CourseReport> {
    // Mock specific course data
    const report: CourseReport = {
      courseId: request.filters?.courseId || 'course1',
      courseTitle: 'Advanced Web Development',
      enrollmentMetrics: {
        totalEnrollments: 150,
        activeEnrollments: 95,
        completedEnrollments: 45,
        waitlistCount: 12,
        completionRate: 30,
        averageCompletionTime: 25
      },
      financialMetrics: {
        totalRevenue: 14985,
        averageRevenuePerEnrollment: 99.90,
        revenueByPaymentMethod: {
          [PaymentMethod.STELLAR]: 7492,
          [PaymentMethod.STRIPE]: 5994,
          [PaymentMethod.CREDIT_CARD]: 0,
          [PaymentMethod.BANK_TRANSFER]: 1499,
          [PaymentMethod.CRYPTO]: 0,
          [PaymentMethod.INSTALLMENT]: 0
        },
        refundMetrics: {
          totalRefunds: 3,
          totalRefundAmount: 299.70,
          refundRate: 2.0,
        }
      },
      studentDemographics: {
        geographicDistribution: {
          'United States': 80,
          'United Kingdom': 25,
          'Canada': 20,
          'Australia': 15,
          'Germany': 10
        },
        experienceLevelDistribution: {
          'beginner': 60,
          'intermediate': 50,
          'advanced': 40
        },
        enrollmentTrends: [
          { date: '2024-06-01', count: 5 },
          { date: '2024-06-02', count: 8 },
          { date: '2024-06-03', count: 12 },
          { date: '2024-06-04', count: 7 },
          { date: '2024-06-05', count: 15 },
          { date: '2024-06-06', count: 10 }
        ]
      },
      performanceMetrics: {
        averageRating: 4.5,
        averageCompletionTime: 25,
        studentSatisfaction: 4.3,
        engagementMetrics: {
          averageLoginFrequency: 5.2,
          averageSessionDuration: 45,
          averageLessonsPerWeek: 3.2
        }
      }
    };

    return report;
  }

  /**
   * Generate user report
   */
  private async generateUserReport(request: ReportRequest): Promise<UserReport> {
    const report: UserReport = {
      userId: request.filters?.userId || 'user1',
      enrollmentHistory: {
        totalEnrollments: 8,
        activeEnrollments: 3,
        completedEnrollments: 4,
        totalSpent: 799.92,
        averageCompletionTime: 22,
        completionRate: 50,
        favoriteCategories: [
          { category: 'Web Development', count: 3 },
          { category: 'Data Science', count: 2 },
          { category: 'Blockchain', count: 2 },
          { category: 'Mobile Development', count: 1 }
        ],
        learningStreak: {
          current: 15,
          longest: 45
        }
      },
      learningAnalytics: {
        totalLearningHours: 125,
        averageSessionDuration: 45,
        courseProgress: [
          {
            courseId: 'course1',
            courseTitle: 'Web Development',
            progress: 75,
            timeSpent: 30,
            lastAccessed: new Date()
          },
          {
            courseId: 'course2',
            courseTitle: 'Data Science',
            progress: 50,
            timeSpent: 20,
            lastAccessed: new Date(Date.now() - 86400000)
          }
        ],
        skillDevelopment: [
          { skill: 'JavaScript', level: 3, improvements: 2 },
          { skill: 'React', level: 2, improvements: 1 },
          { skill: 'Python', level: 2, improvements: 1 }
        ],
        engagementMetrics: {
          loginFrequency: 5.2,
          averageSessionsPerWeek: 8.5,
          averageLessonsPerSession: 3.2,
          peakLearningHours: [9, 14, 19, 20]
        }
      },
      financialSummary: {
        totalSpent: 799.92,
        spendingByMonth: [
          { month: '2024-01', amount: 199.99 },
          { month: '2024-02', amount: 299.99 },
          { month: '2024-03', amount: 149.99 },
          { month: '2024-04', amount: 149.95 }
        ],
        spendingByCategory: [
          { category: 'Web Development', amount: 399.98 },
          { category: 'Data Science', amount: 299.99 },
          { category: 'Blockchain', amount: 99.95 }
        ],
        paymentMethods: {
          [PaymentMethod.STELLAR]: { count: 4, amount: 399.96 },
          [PaymentMethod.STRIPE]: { count: 3, amount: 299.96 },
          [PaymentMethod.CREDIT_CARD]: { count: 0, amount: 0 },
          [PaymentMethod.BANK_TRANSFER]: { count: 1, amount: 100.00 },
          [PaymentMethod.CRYPTO]: { count: 0, amount: 0 },
          [PaymentMethod.INSTALLMENT]: { count: 0, amount: 0 }
        }
      }
    };

    return report;
  }

  /**
   * Generate financial report
   */
  private async generateFinancialReport(request: ReportRequest): Promise<any> {
    // This would be similar to payment report but with more financial analysis
    return await this.generatePaymentReport(request);
  }

  /**
   * Generate learning report
   */
  private async generateLearningReport(request: ReportRequest): Promise<any> {
    // This would focus on learning analytics and student performance
    return await this.generateUserReport(request);
  }

  /**
   * Generate report summary
   */
  private generateEnrollmentSummary(data: EnrollmentReport): ReportSummary {
    return {
      totalRecords: data.totalEnrollments,
      keyMetrics: {
        totalEnrollments: data.totalEnrollments,
        activeEnrollments: data.statusBreakdown[EnrollmentStatus.ACTIVE],
        completionRate: data.completionMetrics.completionRate,
        totalRevenue: data.revenueMetrics.totalRevenue,
        averageCompletionTime: data.completionMetrics.averageCompletionTime
      },
      trends: {
        enrollmentGrowth: 12.5, // percentage growth
        completionTrend: 8.3, // percentage improvement
        revenueGrowth: 15.2 // percentage growth
      },
      insights: [
        `Total enrollments: ${data.totalEnrollments}`,
        `Completion rate: ${data.completionMetrics.completionRate}%`,
        `Average completion time: ${data.completionMetrics.averageCompletionTime} days`,
        `Total revenue: $${data.revenueMetrics.totalRevenue.toLocaleString()}`
      ],
      recommendations: [
        'Focus on courses with higher completion rates',
        'Improve onboarding to reduce average completion time',
        'Optimize pricing for better revenue per enrollment'
      ]
    };
  }

  private generatePaymentSummary(data: PaymentReport): ReportSummary {
    return {
      totalRecords: data.totalTransactions,
      keyMetrics: {
        totalTransactions: data.totalTransactions,
        totalRevenue: data.totalRevenue,
        successRate: data.successRate,
        averageTransactionValue: data.averageTransactionValue,
        refundRate: data.refundMetrics.refundRate
      },
      trends: {
        revenueGrowth: 15.2,
        transactionVolume: 8.5,
        paymentMethodPreference: {
          mostPopular: 'stellar',
          leastPopular: 'bank_transfer'
        }
      },
      insights: [
        `Total revenue: $${data.totalRevenue.toLocaleString()}`,
        `Success rate: ${data.successRate}%`,
        `Average transaction value: $${data.averageTransactionValue}`,
        `Refund rate: ${data.refundMetrics.refundRate}%`
      ],
      recommendations: [
        'Optimize payment processing to improve success rate',
        'Analyze refund reasons to reduce refund rate',
        'Promote payment methods with higher success rates'
      ]
    };
  }

  private generateCourseSummary(data: CourseReport): ReportSummary {
    return {
      totalRecords: data.enrollmentMetrics.totalEnrollments,
      keyMetrics: {
        totalEnrollments: data.enrollmentMetrics.totalEnrollments,
        completionRate: data.enrollmentMetrics.completionRate,
        averageRating: data.performanceMetrics.averageRating,
        waitlistCount: data.enrollmentMetrics.waitlistCount
      },
      trends: {
        enrollmentTrend: 'increasing',
        studentSatisfaction: data.performanceMetrics.studentSatisfaction,
        geographicDistribution: Object.keys(data.studentDemographics.geographicDistribution).length
      },
      insights: [
        `Completion rate: ${data.enrollmentMetrics.completionRate}%`,
        `Average rating: ${data.performanceMetrics.averageRating}`,
        `Waitlist size: ${data.enrollmentMetrics.waitlistCount}`,
        `Students from ${Object.keys(data.studentDemographics.geographicDistribution).length} countries`
      ],
      recommendations: [
        'Improve course content to increase completion rate',
        'Address student feedback to improve satisfaction',
        'Expand marketing to underrepresented geographic regions'
      ]
    };
  }

  private generateUserSummary(data: UserReport): ReportSummary {
    return {
      totalRecords: data.enrollmentHistory.totalEnrollments,
      keyMetrics: {
        totalEnrollments: data.enrollmentHistory.totalEnrollments,
        completionRate: data.enrollmentHistory.completionRate,
        totalSpent: data.financialSummary.totalSpent,
        currentStreak: data.enrollmentHistory.learningStreak.current
      },
      trends: {
        learningConsistency: 'regular',
        categoryPreference: 'Web Development',
        paymentMethodPreference: 'stellar'
      },
      insights: [
        `Total enrollments: ${data.enrollmentHistory.totalEnrollments}`,
        `Completion rate: ${data.enrollmentHistory.completionRate}%`,
        `Total spent: $${data.financialSummary.totalSpent}`,
        `Current learning streak: ${data.enrollmentHistory.learningStreak.current} days`
      ],
      recommendations: [
        'Focus on completing enrolled courses',
        'Explore courses in preferred categories',
        'Maintain learning consistency'
      ]
    };
  }

  private generateFinancialSummary(data: any): ReportSummary {
    return this.generatePaymentSummary(data);
  }

  private generateLearningSummary(data: any): ReportSummary {
    return this.generateUserSummary(data);
  }

  /**
   * Generate charts for report
   */
  private generateCharts(data: any, reportType: string): ChartData[] {
    const charts: ChartData[] = [];

    switch (reportType) {
      case 'enrollment':
        charts.push(
          {
            type: 'line',
            title: 'Enrollment Trends',
            data: data.timeSeriesData,
            xAxis: 'date',
            yAxis: 'enrollments'
          },
          {
            type: 'pie',
            title: 'Enrollment Status Breakdown',
            data: Object.entries(data.statusBreakdown).map(([status, count]) => ({
              status,
              count
            }))
          },
          {
            type: 'bar',
            title: 'Course Performance',
            data: data.coursePerformance
          }
        );
        break;
      case 'payment':
        charts.push(
          {
            type: 'line',
            title: 'Payment Trends',
            data: data.timeSeriesData,
            xAxis: 'date',
            yAxis: 'revenue'
          },
          {
            type: 'pie',
            title: 'Payment Method Distribution',
            data: Object.entries(data.paymentMethodBreakdown).map(([method, item]: [string, any]) => ({
              method,
              count: item.count
            }))
          }
        );
        break;
    }

    return charts;
  }

  /**
   * Export report to specified format
   */
  async exportReport(reportData: ReportData, format: string): Promise<Buffer> {
    switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(reportData, null, 2));
      
      case 'csv':
        return this.convertToCSV(reportData);
      
      case 'xlsx':
        return this.convertToXLSX(reportData);
      
      case 'pdf':
        return this.convertToPDF(reportData);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert to CSV format
   */
  private convertToCSV(reportData: ReportData): Buffer {
    const csvData = [];
    
    // Add headers
    csvData.push(Object.keys(reportData.summary).join(','));
    
    // Add summary data
    csvData.push(Object.values(reportData.summary).join(','));
    
    // Add details data
    if (reportData.details.length > 0) {
      const detailHeaders = Object.keys(reportData.details[0]);
      csvData.push(detailHeaders.join(','));
      
      reportData.details.forEach((detail: any) => {
        csvData.push(Object.values(detail).join(','));
      });
    }

    return Buffer.from(csvData.join('\n'));
  }

  /**
   * Convert to XLSX format
   */
  private convertToXLSX(reportData: ReportData): Buffer {
    // Mock implementation - would use a library like xlsx in production
    const xlsxData = {
      summary: reportData.summary,
      details: reportData.details,
      metadata: reportData.metadata
    };
    
    return Buffer.from(JSON.stringify(xlsxData, null, 2));
  }

  /**
   * Convert to PDF format
   */
  private convertToPDF(reportData: ReportData): Buffer {
    // Mock implementation - would use a library like pdfkit in production
    const pdfContent = `
      Report Type: ${reportData.metadata.type}
      Generated At: ${reportData.metadata.generatedAt}
      
      Summary:
      ${JSON.stringify(reportData.summary, null, 2)}
      
      Details:
      ${JSON.stringify(reportData.details, null, 2)}
    `;
    
    return Buffer.from(pdfContent);
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(request: ReportRequest): string {
    const keyParts = [
      request.type,
      request.dateRange?.start?.toISOString(),
      request.dateRange?.end?.toISOString(),
      JSON.stringify(request.filters || {}),
      request.format,
      request.groupBy
    ];

    return keyParts.join('|');
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hitRate: 0.85 // Mock hit rate
    };
  }
}
