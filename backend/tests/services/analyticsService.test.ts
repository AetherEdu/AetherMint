import { AnalyticsService } from '../../src/services/analyticsService';
import { DataAggregationService } from '../../src/services/dataAggregation';
import { TrendAnalysisService } from '../../src/services/trendAnalysis';
import { ReportService } from '../../src/services/reportService';

// Mock dependencies
jest.mock('../../src/services/dataAggregation');
jest.mock('../../src/services/trendAnalysis');
jest.mock('../../src/services/reportService');
jest.mock('../../src/utils/redis', () => ({
  redisClient: {
    isOpen: true,
    get: jest.fn(),
    setEx: jest.fn(),
  }
}));

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCourseAnalytics', () => {
    it('should return cached data when available', async () => {
      const mockData = { completionRate: 0.85, lastUpdated: '2024-01-01' };
      const { redisClient } = require('../../src/utils/redis');
      redisClient.get.mockResolvedValue(JSON.stringify(mockData));

      const result = await AnalyticsService.getCourseAnalytics('course-123');
      
      expect(result).toEqual(mockData);
      expect(DataAggregationService.getCourseCompletionStats).not.toHaveBeenCalled();
    });

    it('should fetch fresh data when cache is empty', async () => {
      const { redisClient } = require('../../src/utils/redis');
      redisClient.get.mockResolvedValue(null);
      
      const mockStats = { completionRate: 0.75, totalStudents: 100 };
      (DataAggregationService.getCourseCompletionStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await AnalyticsService.getCourseAnalytics('course-123');
      
      expect(result).toMatchObject(mockStats);
      expect(redisClient.setEx).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const { redisClient } = require('../../src/utils/redis');
      redisClient.get.mockRejectedValue(new Error('Redis error'));
      
      const mockStats = { completionRate: 0.75 };
      (DataAggregationService.getCourseCompletionStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await AnalyticsService.getCourseAnalytics('course-123');
      
      expect(result).toMatchObject(mockStats);
    });
  });

  describe('getUserInsights', () => {
    it('should return user insights with trend', async () => {
      const mockActivity = [
        { date: '2024-01-01', lessons_completed: 2, quiz_score: 0 },
        { date: '2024-01-02', lessons_completed: 5, quiz_score: 0 },
      ];
      (DataAggregationService.getUserDailyActivity as jest.Mock).mockResolvedValue(mockActivity);
      (TrendAnalysisService.calculateTrend as jest.Mock).mockReturnValue({ direction: 'up', percentage: 150 });

      const result = await AnalyticsService.getUserInsights('user-123');
      
      expect(result.userId).toBe('user-123');
      expect(result.learningTrend.direction).toBe('up');
    });

    it('should handle insufficient activity data', async () => {
      (DataAggregationService.getUserDailyActivity as jest.Mock).mockResolvedValue([]);

      const result = await AnalyticsService.getUserInsights('user-123');
      
      expect(result.learningTrend).toEqual({ direction: 'flat', percentage: 0 });
    });
  });

  describe('generateReport', () => {
    it('should generate course report', async () => {
      const mockReport = { courseId: 'course-123', students: 50 };
      (ReportService.generateCoursePerformanceReport as jest.Mock).mockResolvedValue(mockReport);

      const result = await AnalyticsService.generateReport('course', 'course-123');
      
      expect(result).toEqual(mockReport);
    });

    it('should generate user report', async () => {
      const mockReport = { userId: 'user-123', progress: 75 };
      (ReportService.generateUserProgressReport as jest.Mock).mockResolvedValue(mockReport);

      const result = await AnalyticsService.generateReport('user', 'user-123');
      
      expect(result).toEqual(mockReport);
    });

    it('should throw error for invalid report type', async () => {
      await expect(AnalyticsService.generateReport('invalid' as any, 'id')).rejects.toThrow('Invalid report type');
    });
  });
});