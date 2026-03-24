/**
 * Search Service
 * Handles course search, filtering, and search analytics
 * Enhanced with AI-powered search capabilities
 */

import {
  Course,
  SearchFilter,
  SearchResult,
  SearchAnalytics,
  CourseCategory,
} from '../models/Course';
import logger from '../utils/logger';
import { AISearchService } from './search/AISearchService';

interface CourseDatabase {
  [id: string]: Course;
}

interface AnalyticsStore {
  [id: string]: SearchAnalytics;
}

export class SearchService {
  private courseDatabase: CourseDatabase;
  private analyticsStore: AnalyticsStore;
  private categoryIndex: Map<string, CourseCategory>;
  private aiSearchService: AISearchService;

  constructor() {
    this.courseDatabase = {};
    this.analyticsStore = {};
    this.categoryIndex = new Map();
    this.aiSearchService = new AISearchService();
    this.initializeSampleData();
  }

  /**
   * Initialize with sample course data for demonstration
   */
  private initializeSampleData(): void {
    // This would be replaced with actual database queries
    // For now, we'll set up the infrastructure
  }

  /**
   * Search courses with query and filters
   * Returns relevant courses sorted by relevance
   * Now integrated with AI-powered search
   */
  async searchCourses(
    query: string,
    filters: SearchFilter,
    sessionId: string,
    userId?: string,
    enableAISearch: boolean = true
  ): Promise<SearchResult> {
    try {
      logger.info(`Search initiated - Query: ${query}, AI: ${enableAISearch}, Filters:`, filters);

      // Use AI search if enabled and available
      if (enableAISearch && this.shouldUseAISearch(query, filters)) {
        try {
          const aiRequest = {
            query,
            filters,
            userId,
            sessionId,
            enableAIFeatures: true
          };

          const aiResponse = await this.aiSearchService.search(aiRequest);
          
          // Convert AI search results to standard format
          const searchResult: SearchResult = {
            courses: aiResponse.results.courses,
            total: aiResponse.results.total,
            page: aiResponse.results.page,
            limit: aiResponse.results.limit,
            hasMore: aiResponse.results.hasMore
          };

          // Record analytics with AI metadata
          await this.recordSearchAnalytics({
            id: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            query: query.toLowerCase().trim(),
            filters,
            resultCount: searchResult.total,
            timestamp: new Date(),
            userId,
            sessionId,
            resultsClicked: []
          });

          logger.info(`AI search completed - Found ${searchResult.total} courses`);
          return searchResult;

        } catch (aiError) {
          logger.warn('AI search failed, falling back to traditional search:', aiError);
          // Fall back to traditional search
        }
      }

      // Traditional search implementation
      return await this.performTraditionalSearch(query, filters, sessionId, userId);

    } catch (error) {
      logger.error('Error in searchCourses', error);
      throw error;
    }
  }

  /**
   * Determine if AI search should be used
   */
  private shouldUseAISearch(query: string, filters: SearchFilter): boolean {
    // Use AI search for complex queries or when AI features are beneficial
    const queryLength = query.split(' ').length;
    const hasComplexTerms = /\b(how to|learn|compare|vs|best|recommend|find)\b/i.test(query);
    
    return queryLength >= 2 || hasComplexTerms;
  }

  /**
   * Perform traditional search (fallback)
   */
  private async performTraditionalSearch(
    query: string,
    filters: SearchFilter,
    sessionId: string,
    userId?: string
  ): Promise<SearchResult> {
    // Normalize query
    const normalizedQuery = query.toLowerCase().trim();

    // Get all courses and apply filters
    let results = Object.values(this.courseDatabase);

    // Apply text search
    if (normalizedQuery) {
      results = this.applyTextSearch(results, normalizedQuery);
    }

    // Apply filters
    if (filters) {
      results = this.applyFilters(results, filters);
    }

    // Calculate relevance scores
    results = this.rankByRelevance(results, normalizedQuery, filters);

    // Apply sorting
    results = this.sortResults(results, filters.sortBy || 'relevance');

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const start = (page - 1) * limit;
    const end = start + limit;

    const paginatedResults = results.slice(start, end);
    const total = results.length;

    // Record analytics
    await this.recordSearchAnalytics({
      id: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query: normalizedQuery,
      filters,
      resultCount: total,
      timestamp: new Date(),
      userId,
      sessionId,
      resultsClicked: []
    });

    logger.info(`Traditional search completed - Found ${total} courses, returning page ${page}`);

    return {
      courses: paginatedResults,
      total,
      page,
      limit,
      hasMore: end < total,
    };
  }

  /**
   * Apply text search across course fields
   */
  private applyTextSearch(courses: Course[], query: string): Course[] {
    return courses.filter((course) => {
      const searchableText = `
        ${course.title.toLowerCase()}
        ${course.description.toLowerCase()}
        ${course.shortDescription.toLowerCase()}
        ${course.tags.join(' ').toLowerCase()}
        ${course.skills.join(' ').toLowerCase()}
        ${course.instructor.name.toLowerCase()}
        ${course.category.name.toLowerCase()}
      `;

      // Check for exact phrase matches first
      if (searchableText.includes(query)) {
        return true;
      }

      // Check for word matches
      const queryWords = query.split(/\s+/);
      return queryWords.every((word) => searchableText.includes(word));
    });
  }

  /**
   * Apply category, level, price, and other filters
   */
  private applyFilters(courses: Course[], filters: SearchFilter): Course[] {
    return courses.filter((course) => {
      // Category filter
      if (filters.category && course.category.id !== filters.category) {
        return false;
      }

      // Level filter
      if (filters.level && course.metadata.level !== filters.level) {
        return false;
      }

      // Price range filter
      if (filters.priceRange) {
        const { min, max } = filters.priceRange;
        const price = course.price || 0;
        if (price < min || price > max) {
          return false;
        }
      }

      // Rating filter
      if (filters.rating && course.rating < filters.rating) {
        return false;
      }

      // Language filter
      if (filters.language && course.metadata.language !== filters.language) {
        return false;
      }

      // Instructor filter
      if (filters.instructor && course.instructor.id !== filters.instructor) {
        return false;
      }

      // Duration range filter
      if (filters.durationRange) {
        const { min, max } = filters.durationRange;
        const duration = course.metadata.duration;
        if (duration < min || duration > max) {
          return false;
        }
      }

      // Tags filter (course must have at least one matching tag)
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some((tag) =>
          course.tags.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate relevance scores for courses
   * Considers multiple factors: text match quality, popularity, rating
   */
  private rankByRelevance(
    courses: Course[],
    query: string,
    filters: SearchFilter
  ): Course[] {
    return courses.map((course) => {
      let score = 0;

      // Title match (highest priority)
      if (course.title.toLowerCase().includes(query)) {
        score += 100;
      }

      // Description match
      if (course.description.toLowerCase().includes(query)) {
        score += 50;
      }

      // Tag match
      if (query) {
        const matchingTags = course.tags.filter((tag) =>
          tag.toLowerCase().includes(query)
        ).length;
        score += matchingTags * 25;
      }

      // Popularity score (enrollment count)
      score += Math.log(course.enrollmentCount + 1) * 10;

      // Rating score
      score += course.rating * 5;

      // Recency bonus (assuming courses published recently get boost)
      const ageInDays =
        (new Date().getTime() - course.metadata.createdAt.getTime()) /
        (1000 * 60 * 60 * 24);
      if (ageInDays < 30) {
        score += 20; // Recent course bonus
      }

      course.searchScore = score;
      return course;
    });
  }

  /**
   * Sort results by the specified criteria
   */
  private sortResults(
    courses: Course[],
    sortBy: string
  ): Course[] {
    const sorted = [...courses];

    switch (sortBy) {
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'price-low':
        sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'newest':
        sorted.sort(
          (a, b) =>
            new Date(b.metadata.createdAt).getTime() -
            new Date(a.metadata.createdAt).getTime()
        );
        break;
      case 'popular':
        sorted.sort((a, b) => b.enrollmentCount - a.enrollmentCount);
        break;
      case 'relevance':
      default:
        sorted.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
    }

    return sorted;
  }

  /**
   * Record search analytics for insights
   */
  private async recordSearchAnalytics(analytics: SearchAnalytics): Promise<void> {
    try {
      this.analyticsStore[analytics.id] = analytics;

      logger.info(`Search analytics recorded: ${analytics.id}`);

      // In production, this would be saved to a database
      // and potentially used to improve search algorithms
    } catch (error) {
      logger.error('Error recording search analytics', error);
      // Don't throw - analytics failures shouldn't break search
    }
  }

  /**
   * Get all categories for filtering
   */
  async getCategories(): Promise<CourseCategory[]> {
    try {
      const categories = Array.from(this.categoryIndex.values());
      logger.info(`Retrieved ${categories.length} categories`);
      return categories;
    } catch (error) {
      logger.error('Error getting categories', error);
      throw error;
    }
  }

  /**
   * Get categories by parent category
   */
  async getCategoryTree(): Promise<CourseCategory[]> {
    try {
      const rootCategories = Array.from(this.categoryIndex.values()).filter(
        (cat) => !cat.parentCategory
      );
      return rootCategories;
    } catch (error) {
      logger.error('Error getting category tree', error);
      throw error;
    }
  }

  /**
   * Add or update a category
   */
  async upsertCategory(category: CourseCategory): Promise<CourseCategory> {
    try {
      this.categoryIndex.set(category.id, category);
      logger.info(`Category upserted: ${category.id}`);
      return category;
    } catch (error) {
      logger.error('Error upserting category', error);
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    try {
      this.categoryIndex.delete(categoryId);
      logger.info(`Category deleted: ${categoryId}`);
    } catch (error) {
      logger.error('Error deleting category', error);
      throw error;
    }
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      const suggestions = new Set<string>();

      // Suggest from course titles
      Object.values(this.courseDatabase).forEach((course) => {
        if (course.title.toLowerCase().includes(normalizedQuery)) {
          suggestions.add(course.title);
        }
      });

      // Suggest from tags
      Object.values(this.courseDatabase).forEach((course) => {
        course.tags.forEach((tag) => {
          if (tag.toLowerCase().includes(normalizedQuery)) {
            suggestions.add(tag);
          }
        });
      });

      // Suggest from categories
      Array.from(this.categoryIndex.values()).forEach((cat) => {
        if (cat.name.toLowerCase().includes(normalizedQuery)) {
          suggestions.add(cat.name);
        }
      });

      const result = Array.from(suggestions).slice(0, limit);
      logger.info(`Generated ${result.length} suggestions for query: ${query}`);

      return result;
    } catch (error) {
      logger.error('Error getting search suggestions', error);
      throw error;
    }
  }

  /**
   * Get popular searches for trending insights
   */
  async getPopularSearches(limit: number = 10): Promise<{ query: string; count: number }[]> {
    try {
      const searchMap = new Map<string, number>();

      Object.values(this.analyticsStore).forEach((analytics) => {
        const query = analytics.query;
        searchMap.set(query, (searchMap.get(query) || 0) + 1);
      });

      const popular = Array.from(searchMap.entries())
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      logger.info(`Retrieved ${popular.length} popular searches`);
      return popular;
    } catch (error) {
      logger.error('Error getting popular searches', error);
      throw error;
    }
  }

  /**
   * Get analytics for a specific query
   */
  async getSearchAnalytics(query: string): Promise<SearchAnalytics[]> {
    try {
      const analytics = Object.values(this.analyticsStore).filter(
        (a) => a.query === query.toLowerCase().trim()
      );
      logger.info(`Retrieved ${analytics.length} analytics records for query: ${query}`);
      return analytics;
    } catch (error) {
      logger.error('Error getting search analytics', error);
      throw error;
    }
  }

  /**
   * Get AI-powered search suggestions
   */
  async getAISuggestions(query: string, userId?: string, limit: number = 5): Promise<string[]> {
    try {
      return await this.aiSearchService.getSuggestions(query, userId, limit);
    } catch (error) {
      logger.error('Error getting AI suggestions', error);
      // Fallback to traditional suggestions
      return this.getSearchSuggestions(query, limit);
    }
  }

  /**
   * Get search insights and analytics
   */
  async getSearchInsights(timeframe: 'day' | 'week' | 'month' = 'week') {
    try {
      return await this.aiSearchService.getSearchInsights(timeframe);
    } catch (error) {
      logger.error('Error getting search insights', error);
      throw error;
    }
  }

  /**
   * Get personalized recommendations
   */
  async getPersonalizedRecommendations(userId: string, limit: number = 10): Promise<Course[]> {
    try {
      return await this.aiSearchService.getPersonalizedRecommendations(userId, limit);
    } catch (error) {
      logger.error('Error getting personalized recommendations', error);
      return [];
    }
  }

  /**
   * Find similar courses
   */
  async findSimilarCourses(courseId: string, limit: number = 5): Promise<Course[]> {
    try {
      return await this.aiSearchService.findSimilarCourses(courseId, limit);
    } catch (error) {
      logger.error('Error finding similar courses', error);
      return [];
    }
  }

  /**
   * Get search performance metrics
   */
  getSearchMetrics() {
    try {
      return this.aiSearchService.getPerformanceMetrics();
    } catch (error) {
      logger.error('Error getting search metrics', error);
      return {
        averageSearchTime: 0,
        cacheHitRate: 0,
        accuracyRate: 0,
        userSatisfaction: 0,
        conversionRate: 0,
        systemHealth: 'fair' as const
      };
    }
  }

  /**
   * Optimize search performance
   */
  async optimizeSearch(): Promise<void> {
    try {
      await this.aiSearchService.optimizeSearch();
      logger.info('Search optimization completed');
    } catch (error) {
      logger.error('Error during search optimization', error);
    }
  }
}

export default new SearchService();
