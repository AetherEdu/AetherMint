/**
 * AI Search Service
 * High-level service that orchestrates AI-powered search functionality
 */

import { Course, SearchFilter, SearchResult, SearchAnalytics as BaseSearchAnalytics } from '../../models/Course';
import { AISearchEngine, AISearchResult, AISearchOptions, SearchIntent } from '../search/AISearchEngine';
import { SemanticSearch } from '../search/SemanticSearch';
import { NaturalLanguageProcessor } from '../search/NaturalLanguageProcessor';
import { IntelligentRanking } from '../search/IntelligentRanking';
import logger from '../../utils/logger';

export interface AISearchRequest {
  query: string;
  filters?: SearchFilter;
  userId?: string;
  sessionId?: string;
  enableAIFeatures?: boolean;
  searchOptions?: Partial<AISearchOptions>;
}

export interface AISearchResponse {
  results: AISearchResult;
  suggestions?: string[];
  intent?: SearchIntent;
  analytics: AISearchAnalytics;
  performanceMetrics: PerformanceMetrics;
}

export interface AISearchAnalytics extends BaseSearchAnalytics {
  semanticSearchUsed: boolean;
  nlpProcessingUsed: boolean;
  intentRecognition: SearchIntent;
  processingTime: number;
  accuracy: number;
  userSatisfaction?: number;
  conversionRate?: number;
}

export interface PerformanceMetrics {
  totalProcessingTime: number;
  semanticSearchTime: number;
  nlpProcessingTime: number;
  rankingTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  queryComplexity: 'simple' | 'moderate' | 'complex';
  aiFeaturesUsed: string[];
}

export interface SearchInsights {
  popularQueries: Array<{ query: string; count: number; trend: 'up' | 'down' | 'stable' }>;
  userBehaviorPatterns: Array<{ pattern: string; frequency: number; impact: number }>;
  contentGaps: Array<{ category: string; demand: number; supply: number }>;
  performanceBottlenecks: Array<{ component: string; avgTime: number; occurrences: number }>;
  accuracyMetrics: Array<{ metric: string; value: number; target: number; achieved: boolean }>;
}

export interface UserSearchProfile {
  userId: string;
  searchHistory: Array<{
    query: string;
    timestamp: Date;
    resultsClicked: string[];
    timeSpent: number;
    satisfaction: number;
  }>;
  preferences: {
    categories: string[];
    levels: string[];
    priceRange: { min: number; max: number };
    languages: string[];
    instructors: string[];
  };
  skillInterests: string[];
  learningGoals: string[];
  searchPatterns: {
    averageQueryLength: number;
    preferredFilters: string[];
    typicalSessionDuration: number;
    conversionRate: number;
  };
}

export class AISearchService {
  private aiSearchEngine: AISearchEngine;
  private semanticSearch: SemanticSearch;
  private nlpProcessor: NaturalLanguageProcessor;
  private intelligentRanking: IntelligentRanking;
  private userProfiles: Map<string, UserSearchProfile>;
  private searchAnalytics: Map<string, AISearchAnalytics>;
  private performanceMetrics: Map<string, number[]>;
  private defaultOptions: AISearchOptions;

  constructor() {
    this.defaultOptions = {
      enableSemanticSearch: true,
      enableNLPProcessing: true,
      enableIntelligentRanking: true,
      enableMultilingualSupport: true,
      enableAutoSuggestions: true,
      searchAccuracyTarget: 0.85,
      maxResults: 50
    };

    this.aiSearchEngine = new AISearchEngine(this.defaultOptions);
    this.semanticSearch = new SemanticSearch();
    this.nlpProcessor = new NaturalLanguageProcessor();
    this.intelligentRanking = new IntelligentRanking();
    this.userProfiles = new Map();
    this.searchAnalytics = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Perform AI-powered search
   */
  async search(request: AISearchRequest): Promise<AISearchResponse> {
    const startTime = Date.now();
    const sessionId = request.sessionId || this.generateSessionId();

    try {
      logger.info(`AI search initiated - Query: "${request.query}", User: ${request.userId || 'anonymous'}`);

      // Get or create user profile
      const userProfile = request.userId ? this.getUserProfile(request.userId) : undefined;

      // Merge search options with defaults
      const searchOptions = { ...this.defaultOptions, ...request.searchOptions };

      // Get all courses (in production, this would come from database)
      const courses = await this.getAllCourses();

      // Perform AI search
      const results = await this.aiSearchEngine.search(
        request.query,
        request.filters || {},
        courses,
        request.userId,
        sessionId
      );

      // Generate suggestions if enabled
      let suggestions: string[] = [];
      if (searchOptions.enableAutoSuggestions) {
        suggestions = await this.generateSuggestions(request.query, courses);
      }

      // Create analytics record
      const analytics = await this.createSearchAnalytics(request, results, startTime);

      // Calculate performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(results, startTime);

      // Update user profile
      if (userProfile) {
        this.updateUserProfile(userProfile, request, results);
      }

      // Store analytics
      this.storeAnalytics(analytics);

      logger.info(`AI search completed - Results: ${results.total}, Time: ${Date.now() - startTime}ms`);

      return {
        results,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        intent: results.intent,
        analytics,
        performanceMetrics
      };
    } catch (error) {
      logger.error('Error in AI search service', error);
      throw error;
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query: string, userId?: string, limit: number = 5): Promise<string[]> {
    try {
      const courses = await this.getAllCourses();
      const suggestions = await this.generateSuggestions(query, courses, limit);
      
      logger.info(`Generated ${suggestions.length} suggestions for query: "${query}"`);
      return suggestions;
    } catch (error) {
      logger.error('Error generating suggestions', error);
      return [];
    }
  }

  /**
   * Recognize search intent
   */
  async recognizeIntent(query: string): Promise<SearchIntent> {
    try {
      return await this.nlpProcessor.recognizeIntent(query);
    } catch (error) {
      logger.error('Error recognizing intent', error);
      throw error;
    }
  }

  /**
   * Get search insights and analytics
   */
  async getSearchInsights(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<SearchInsights> {
    try {
      const insights = await this.generateSearchInsights(timeframe);
      logger.info(`Generated search insights for timeframe: ${timeframe}`);
      return insights;
    } catch (error) {
      logger.error('Error generating search insights', error);
      throw error;
    }
  }

  /**
   * Update user search profile
   */
  async updateUserSearchProfile(userId: string, profileData: Partial<UserSearchProfile>): Promise<void> {
    try {
      const existingProfile = this.getUserProfile(userId);
      const updatedProfile = { ...existingProfile, ...profileData, userId };
      this.userProfiles.set(userId, updatedProfile);
      
      logger.info(`Updated search profile for user: ${userId}`);
    } catch (error) {
      logger.error('Error updating user search profile', error);
      throw error;
    }
  }

  /**
   * Get personalized recommendations
   */
  async getPersonalizedRecommendations(userId: string, limit: number = 10): Promise<Course[]> {
    try {
      const userProfile = this.getUserProfile(userId);
      const courses = await this.getAllCourses();
      
      // Use intelligent ranking for personalization
      const rankedCourses = await this.intelligentRanking.rankResults(
        courses,
        '', // Empty query for general recommendations
        undefined,
        userId
      );

      const recommendations = rankedCourses.slice(0, limit);
      
      logger.info(`Generated ${recommendations.length} personalized recommendations for user: ${userId}`);
      
      return recommendations;
    } catch (error) {
      logger.error('Error generating personalized recommendations', error);
      return [];
    }
  }

  /**
   * Find similar courses
   */
  async findSimilarCourses(courseId: string, limit: number = 5): Promise<Course[]> {
    try {
      const courses = await this.getAllCourses();
      const referenceCourse = courses.find(c => c.id === courseId);
      
      if (!referenceCourse) {
        throw new Error(`Course not found: ${courseId}`);
      }

      const similarCourses = await this.semanticSearch.findSimilarCourses(
        referenceCourse,
        courses,
        limit
      );

      logger.info(`Found ${similarCourses.length} similar courses for: ${courseId}`);
      return similarCourses;
    } catch (error) {
      logger.error('Error finding similar courses', error);
      return [];
    }
  }

  /**
   * Get search performance metrics
   */
  getPerformanceMetrics(): {
    averageSearchTime: number;
    cacheHitRate: number;
    accuracyRate: number;
    userSatisfaction: number;
    conversionRate: number;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
  } {
    const searchTimes = this.performanceMetrics.get('search_time') || [];
    const averageSearchTime = searchTimes.length > 0 
      ? searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length 
      : 0;

    const accuracyRates = this.performanceMetrics.get('accuracy_rate') || [];
    const accuracyRate = accuracyRates.length > 0 
      ? accuracyRates.reduce((sum, rate) => sum + rate, 0) / accuracyRates.length 
      : 0.8;

    // Calculate system health
    let systemHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (averageSearchTime > 2000 || accuracyRate < 0.7) systemHealth = 'poor';
    else if (averageSearchTime > 1000 || accuracyRate < 0.8) systemHealth = 'fair';
    else if (averageSearchTime > 500 || accuracyRate < 0.9) systemHealth = 'good';

    return {
      averageSearchTime,
      cacheHitRate: 0.75, // Mock value
      accuracyRate,
      userSatisfaction: 0.85, // Mock value
      conversionRate: 0.12, // Mock value
      systemHealth
    };
  }

  /**
   * Optimize search performance
   */
  async optimizeSearch(): Promise<void> {
    try {
      // Optimize AI search engine
      await this.aiSearchEngine.optimizePerformance();
      
      // Clear caches if needed
      if (this.shouldClearCache()) {
        this.aiSearchEngine.clearCache();
      }
      
      // Update ranking weights based on performance
      this.updateRankingWeights();
      
      logger.info('Search optimization completed');
    } catch (error) {
      logger.error('Error during search optimization', error);
    }
  }

  /**
   * Generate suggestions
   */
  private async generateSuggestions(query: string, courses: Course[], limit: number = 5): Promise<string[]> {
    return await this.nlpProcessor.generateSuggestions(query, courses, limit);
  }

  /**
   * Get all courses (mock implementation)
   */
  private async getAllCourses(): Promise<Course[]> {
    // In production, this would fetch from database
    return [];
  }

  /**
   * Create search analytics
   */
  private async createSearchAnalytics(
    request: AISearchRequest,
    results: AISearchResult,
    startTime: number
  ): Promise<AISearchAnalytics> {
    const id = `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id,
      query: request.query,
      filters: request.filters || {},
      resultCount: results.total,
      timestamp: new Date(),
      userId: request.userId,
      sessionId: request.sessionId || this.generateSessionId(),
      semanticSearchUsed: results.semanticScore !== undefined,
      nlpProcessingUsed: results.nlpProcessed || false,
      intentRecognition: results.intent || this.getDefaultIntent(),
      processingTime: Date.now() - startTime,
      accuracy: results.confidence || 0.8
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(results: AISearchResult, startTime: number): PerformanceMetrics {
    const totalProcessingTime = Date.now() - startTime;
    
    return {
      totalProcessingTime,
      semanticSearchTime: results.processingTime * 0.3, // Mock distribution
      nlpProcessingTime: results.processingTime * 0.2,
      rankingTime: results.processingTime * 0.3,
      cacheHitRate: 0.75, // Mock value
      memoryUsage: 50, // Mock MB
      queryComplexity: results.intent ? this.mapIntentToComplexity(results.intent.complexity) : 'simple',
      aiFeaturesUsed: this.getUsedFeatures(results)
    };
  }

  /**
   * Get user profile
   */
  private getUserProfile(userId: string): UserSearchProfile {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        searchHistory: [],
        preferences: {
          categories: [],
          levels: [],
          priceRange: { min: 0, max: 1000 },
          languages: [],
          instructors: []
        },
        skillInterests: [],
        learningGoals: [],
        searchPatterns: {
          averageQueryLength: 0,
          preferredFilters: [],
          typicalSessionDuration: 0,
          conversionRate: 0
        }
      });
    }
    return this.userProfiles.get(userId)!;
  }

  /**
   * Update user profile
   */
  private updateUserProfile(profile: UserSearchProfile, request: AISearchRequest, results: AISearchResult): void {
    // Add to search history
    profile.searchHistory.push({
      query: request.query,
      timestamp: new Date(),
      resultsClicked: [], // Would be populated when user clicks results
      timeSpent: 0, // Would be calculated based on user behavior
      satisfaction: 0 // Would be collected from user feedback
    });

    // Update search patterns
    const queryLength = request.query.length;
    const totalQueries = profile.searchHistory.length;
    profile.searchPatterns.averageQueryLength = 
      (profile.searchPatterns.averageQueryLength * (totalQueries - 1) + queryLength) / totalQueries;
  }

  /**
   * Store analytics
   */
  private storeAnalytics(analytics: AISearchAnalytics): void {
    this.searchAnalytics.set(analytics.id, analytics);
    
    // Update performance metrics
    this.updatePerformanceMetrics('search_time', analytics.processingTime);
    this.updatePerformanceMetrics('accuracy_rate', analytics.accuracy);
  }

  /**
   * Generate search insights
   */
  private async generateSearchInsights(timeframe: 'day' | 'week' | 'month'): Promise<SearchInsights> {
    // Mock implementation - would analyze actual analytics data
    return {
      popularQueries: [
        { query: 'javascript', count: 150, trend: 'up' },
        { query: 'python', count: 120, trend: 'stable' },
        { query: 'react', count: 90, trend: 'down' }
      ],
      userBehaviorPatterns: [
        { pattern: 'filter_by_price', frequency: 0.6, impact: 0.8 },
        { pattern: 'sort_by_rating', frequency: 0.4, impact: 0.6 }
      ],
      contentGaps: [
        { category: 'advanced-react', demand: 80, supply: 20 },
        { category: 'machine-learning', demand: 60, supply: 40 }
      ],
      performanceBottlenecks: [
        { component: 'semantic_search', avgTime: 150, occurrences: 100 },
        { component: 'nlp_processing', avgTime: 80, occurrences: 100 }
      ],
      accuracyMetrics: [
        { metric: 'semantic_search_accuracy', value: 0.85, target: 0.90, achieved: false },
        { metric: 'intent_recognition_accuracy', value: 0.78, target: 0.85, achieved: false }
      ]
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(metric: string, value: number): void {
    if (!this.performanceMetrics.has(metric)) {
      this.performanceMetrics.set(metric, []);
    }
    
    const values = this.performanceMetrics.get(metric)!;
    values.push(value);
    
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * Check if cache should be cleared
   */
  private shouldClearCache(): boolean {
    // Logic to determine when to clear cache
    return false; // Mock implementation
  }

  /**
   * Update ranking weights
   */
  private updateRankingWeights(): void {
    // Logic to update ranking weights based on performance
    logger.info('Updated ranking weights based on performance data');
  }

  /**
   * Map intent complexity to query complexity
   */
  private mapIntentToComplexity(complexity: string): 'simple' | 'moderate' | 'complex' {
    switch (complexity) {
      case 'simple': return 'simple';
      case 'moderate': return 'moderate';
      case 'complex': return 'complex';
      default: return 'simple';
    }
  }

  /**
   * Get used AI features
   */
  private getUsedFeatures(results: AISearchResult): string[] {
    const features: string[] = [];
    
    if (results.semanticScore !== undefined) features.push('semantic_search');
    if (results.nlpProcessed) features.push('nlp_processing');
    if (results.intent) features.push('intent_recognition');
    if (results.suggestions) features.push('auto_suggestions');
    
    return features;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default intent
   */
  private getDefaultIntent(): SearchIntent {
    return {
      type: 'course_search',
      confidence: 0.5,
      entities: {},
      sentiment: 'neutral',
      urgency: 'medium',
      complexity: 'simple'
    };
  }
}

export default new AISearchService();
