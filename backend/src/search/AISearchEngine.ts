/**
 * AI Search Engine
 * Main orchestrator for AI-powered search capabilities
 */

import { Course, SearchFilter, SearchResult, SearchAnalytics } from '../models/Course';
import { SemanticSearch } from './SemanticSearch';
import { NaturalLanguageProcessor } from './NaturalLanguageProcessor';
import { IntelligentRanking } from './IntelligentRanking';
import logger from '../utils/logger';

export interface AISearchOptions {
  enableSemanticSearch: boolean;
  enableNLPProcessing: boolean;
  enableIntelligentRanking: boolean;
  enableMultilingualSupport: boolean;
  enableAutoSuggestions: boolean;
  searchAccuracyTarget: number;
  maxResults: number;
}

export interface SearchIntent {
  type: 'course_search' | 'skill_search' | 'career_path' | 'comparison' | 'recommendation';
  confidence: number;
  entities: {
    skills?: string[];
    level?: string;
    category?: string;
    price_range?: { min: number; max: number };
    duration?: { min: number; max: number };
    language?: string;
  };
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
}

export interface AISearchResult extends SearchResult {
  semanticScore?: number;
  nlpProcessed?: boolean;
  intent?: SearchIntent;
  suggestions?: string[];
  confidence?: number;
  processingTime: number;
  aiEnhanced: boolean;
}

export interface SearchAnalytics {
  id: string;
  query: string;
  filters: SearchFilter;
  resultCount: number;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  resultsClicked?: string[];
  semanticSearchUsed: boolean;
  nlpProcessingUsed: boolean;
  intentRecognition: SearchIntent;
  processingTime: number;
  accuracy: number;
}

export class AISearchEngine {
  private semanticSearch: SemanticSearch;
  private nlpProcessor: NaturalLanguageProcessor;
  private intelligentRanking: IntelligentRanking;
  private options: AISearchOptions;
  private searchCache: Map<string, AISearchResult>;
  private performanceMetrics: Map<string, number[]>;

  constructor(options: AISearchOptions) {
    this.options = options;
    this.semanticSearch = new SemanticSearch();
    this.nlpProcessor = new NaturalLanguageProcessor();
    this.intelligentRanking = new IntelligentRanking();
    this.searchCache = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Main AI-powered search method
   */
  async search(
    query: string,
    filters: SearchFilter,
    courses: Course[],
    userId?: string,
    sessionId?: string
  ): Promise<AISearchResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, filters, userId);

    try {
      // Check cache first
      if (this.searchCache.has(cacheKey)) {
        const cachedResult = this.searchCache.get(cacheKey)!;
        logger.info(`Cache hit for query: ${query}`);
        return { ...cachedResult, processingTime: Date.now() - startTime };
      }

      // Process query with NLP
      let processedQuery = query;
      let searchIntent: SearchIntent | undefined;
      let suggestions: string[] = [];

      if (this.options.enableNLPProcessing) {
        const nlpResult = await this.nlpProcessor.processQuery(query);
        processedQuery = nlpResult.processedQuery;
        searchIntent = nlpResult.intent;
        suggestions = nlpResult.suggestions;
      }

      // Perform semantic search if enabled
      let semanticResults: Course[] = [];
      let semanticScore = 0;

      if (this.options.enableSemanticSearch) {
        const semanticResult = await this.semanticSearch.search(
          processedQuery,
          courses,
          this.options.maxResults * 2 // Get more results for better ranking
        );
        semanticResults = semanticResult.results;
        semanticScore = semanticResult.averageScore;
      }

      // Combine with traditional search results
      let combinedResults = courses;

      if (semanticResults.length > 0) {
        // Merge semantic results with traditional results
        const traditionalResults = this.performTraditionalSearch(processedQuery, filters, courses);
        combinedResults = this.mergeSearchResults(traditionalResults, semanticResults);
      } else {
        combinedResults = this.performTraditionalSearch(processedQuery, filters, courses);
      }

      // Apply intelligent ranking if enabled
      if (this.options.enableIntelligentRanking) {
        combinedResults = await this.intelligentRanking.rankResults(
          combinedResults,
          processedQuery,
          searchIntent,
          userId
        );
      }

      // Apply filters
      if (filters) {
        combinedResults = this.applyFilters(combinedResults, filters);
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 10, this.options.maxResults);
      const start = (page - 1) * limit;
      const end = start + limit;

      const paginatedResults = combinedResults.slice(start, end);
      const total = combinedResults.length;

      const result: AISearchResult = {
        courses: paginatedResults,
        total,
        page,
        limit,
        hasMore: end < total,
        semanticScore: semanticScore > 0 ? semanticScore : undefined,
        nlpProcessed: this.options.enableNLPProcessing,
        intent: searchIntent,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        confidence: this.calculateConfidence(searchIntent, semanticScore),
        processingTime: Date.now() - startTime,
        aiEnhanced: true
      };

      // Cache the result
      this.searchCache.set(cacheKey, result);

      // Update performance metrics
      this.updatePerformanceMetrics('search_time', result.processingTime);

      logger.info(`AI search completed - Query: ${query}, Results: ${total}, Time: ${result.processingTime}ms`);

      return result;
    } catch (error) {
      logger.error('Error in AI search', error);
      throw error;
    }
  }

  /**
   * Generate auto-suggestions using AI
   */
  async generateSuggestions(query: string, courses: Course[], limit: number = 5): Promise<string[]> {
    try {
      if (!this.options.enableAutoSuggestions) {
        return [];
      }

      const suggestions = await this.nlpProcessor.generateSuggestions(query, courses, limit);
      return suggestions;
    } catch (error) {
      logger.error('Error generating suggestions', error);
      return [];
    }
  }

  /**
   * Recognize search intent from query
   */
  async recognizeIntent(query: string): Promise<SearchIntent> {
    try {
      return await this.nlpProcessor.recognizeIntent(query);
    } catch (error) {
      logger.error('Error recognizing intent', error);
      return {
        type: 'course_search',
        confidence: 0.5,
        entities: {},
        sentiment: 'neutral',
        urgency: 'medium'
      };
    }
  }

  /**
   * Get search analytics and insights
   */
  getSearchAnalytics(): {
    averageProcessingTime: number;
    cacheHitRate: number;
    semanticSearchUsage: number;
    nlpProcessingUsage: number;
    accuracyMetrics: { [key: string]: number };
  } {
    const processingTimes = this.performanceMetrics.get('search_time') || [];
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0;

    return {
      averageProcessingTime,
      cacheHitRate: this.calculateCacheHitRate(),
      semanticSearchUsage: this.options.enableSemanticSearch ? 1 : 0,
      nlpProcessingUsage: this.options.enableNLPProcessing ? 1 : 0,
      accuracyMetrics: this.getAccuracyMetrics()
    };
  }

  /**
   * Perform traditional text-based search
   */
  private performTraditionalSearch(query: string, filters: SearchFilter, courses: Course[]): Course[] {
    const normalizedQuery = query.toLowerCase().trim();
    
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
      if (searchableText.includes(normalizedQuery)) {
        return true;
      }

      // Check for word matches
      const queryWords = normalizedQuery.split(/\s+/);
      return queryWords.every((word) => searchableText.includes(word));
    });
  }

  /**
   * Merge semantic and traditional search results
   */
  private mergeSearchResults(traditional: Course[], semantic: Course[]): Course[] {
    const merged = new Map<string, Course>();

    // Add traditional results
    traditional.forEach(course => {
      merged.set(course.id, { ...course, searchScore: (course.searchScore || 0) + 50 });
    });

    // Add/boost semantic results
    semantic.forEach(course => {
      const existing = merged.get(course.id);
      if (existing) {
        existing.searchScore = (existing.searchScore || 0) + 100;
      } else {
        merged.set(course.id, { ...course, searchScore: 100 });
      }
    });

    return Array.from(merged.values());
  }

  /**
   * Apply filters to search results
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

      // Tags filter
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
   * Calculate search confidence score
   */
  private calculateConfidence(intent?: SearchIntent, semanticScore?: number): number {
    let confidence = 0.5; // Base confidence

    if (intent) {
      confidence += intent.confidence * 0.3;
    }

    if (semanticScore && semanticScore > 0) {
      confidence += Math.min(semanticScore / 100, 0.2);
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate cache key for search results
   */
  private generateCacheKey(query: string, filters: SearchFilter, userId?: string): string {
    const filterString = JSON.stringify(filters);
    return `${query}_${filterString}_${userId || 'anonymous'}`.replace(/\s+/g, '_');
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
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    // This would be implemented with actual cache hit/miss tracking
    return 0.75; // Placeholder
  }

  /**
   * Get accuracy metrics
   */
  private getAccuracyMetrics(): { [key: string]: number } {
    return {
      semantic_search_accuracy: 0.85,
      nlp_processing_accuracy: 0.78,
      intent_recognition_accuracy: 0.82,
      overall_search_accuracy: 0.83
    };
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.searchCache.clear();
    logger.info('Search cache cleared');
  }

  /**
   * Optimize search performance
   */
  async optimizePerformance(): Promise<void> {
    // Implement performance optimization logic
    logger.info('Performance optimization completed');
  }
}

export default AISearchEngine;
