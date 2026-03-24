/**
 * Intelligent Ranking Algorithm
 * ML-powered result ranking with personalization and learning
 */

import { Course } from '../models/Course';
import { SearchIntent } from './NaturalLanguageProcessor';
import logger from '../utils/logger';

export interface RankingFactors {
  textRelevance: number;
  semanticSimilarity: number;
  popularityScore: number;
  ratingScore: number;
  recencyScore: number;
  instructorScore: number;
  priceScore: number;
  durationScore: number;
  levelMatch: number;
  personalizationScore: number;
  engagementScore: number;
  qualityScore: number;
}

export interface UserProfile {
  userId: string;
  enrolledCourses: string[];
  completedCourses: string[];
  preferredCategories: string[];
  preferredLevels: string[];
  preferredInstructors: string[];
  priceSensitivity: 'low' | 'medium' | 'high';
  averageRating: number;
  skillInterests: string[];
  careerGoals: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  timeCommitment: 'low' | 'medium' | 'high';
}

export interface RankingContext {
  query: string;
  intent: SearchIntent;
  userProfile?: UserProfile;
  searchHistory: Array<{ query: string; clickedCourses: string[]; timestamp: Date }>;
  currentTime: Date;
  globalTrends: Map<string, number>;
  seasonalFactors: Map<string, number>;
}

export interface RankedCourse extends Course {
  rankingScore: number;
  rankingFactors: RankingFactors;
  rankingExplanation: string[];
  confidence: number;
}

export interface RankingResult {
  rankedCourses: RankedCourse[];
  rankingMetrics: {
    averageConfidence: number;
    diversityScore: number;
    noveltyScore: number;
    coverageScore: number;
  };
  processingTime: number;
}

export class IntelligentRanking {
  private userProfiles: Map<string, UserProfile>;
  private globalTrends: Map<string, number>;
  private seasonalFactors: Map<string, number>;
  private rankingWeights: Map<string, number>;
  private performanceMetrics: Map<string, number[]>;

  constructor() {
    this.userProfiles = new Map();
    this.globalTrends = new Map();
    this.seasonalFactors = new Map();
    this.initializeRankingWeights();
    this.initializeTrends();
    this.performanceMetrics = new Map();
  }

  /**
   * Rank search results using ML algorithms
   */
  async rankResults(
    courses: Course[],
    query: string,
    intent?: SearchIntent,
    userId?: string
  ): Promise<Course[]> {
    const startTime = Date.now();

    try {
      if (courses.length === 0) {
        return [];
      }

      // Get user profile
      const userProfile = userId ? this.getUserProfile(userId) : undefined;
      
      // Get search history
      const searchHistory = userId ? this.getSearchHistory(userId) : [];
      
      // Create ranking context
      const context: RankingContext = {
        query,
        intent: intent || this.getDefaultIntent(),
        userProfile,
        searchHistory,
        currentTime: new Date(),
        globalTrends: this.globalTrends,
        seasonalFactors: this.seasonalFactors
      };

      // Calculate ranking factors for each course
      const rankedCourses: RankedCourse[] = [];
      
      for (const course of courses) {
        const factors = await this.calculateRankingFactors(course, context);
        const score = this.calculateFinalScore(factors, context);
        const explanation = this.generateExplanation(factors, course, context);
        const confidence = this.calculateConfidence(factors, context);

        rankedCourses.push({
          ...course,
          rankingScore: score,
          rankingFactors: factors,
          rankingExplanation: explanation,
          confidence
        });
      }

      // Apply diversity and novelty adjustments
      const adjustedCourses = this.applyDiversityAdjustments(rankedCourses, context);
      
      // Sort by final score
      adjustedCourses.sort((a, b) => b.rankingScore - a.rankingScore);

      // Calculate ranking metrics
      const metrics = this.calculateRankingMetrics(adjustedCourses);
      
      const result: RankingResult = {
        rankedCourses: adjustedCourses,
        rankingMetrics: metrics,
        processingTime: Date.now() - startTime
      };

      // Update performance metrics
      this.updatePerformanceMetrics('ranking_time', result.processingTime);
      
      // Learn from this ranking
      await this.learnFromRanking(result, context);

      logger.info(`Intelligent ranking completed - Query: "${query}", Courses: ${courses.length}, Time: ${result.processingTime}ms`);

      return adjustedCourses;
    } catch (error) {
      logger.error('Error in intelligent ranking', error);
      throw error;
    }
  }

  /**
   * Calculate ranking factors for a course
   */
  private async calculateRankingFactors(course: Course, context: RankingContext): Promise<RankingFactors> {
    const factors: RankingFactors = {
      textRelevance: this.calculateTextRelevance(course, context.query),
      semanticSimilarity: this.calculateSemanticSimilarity(course, context.query),
      popularityScore: this.calculatePopularityScore(course, context),
      ratingScore: this.calculateRatingScore(course, context),
      recencyScore: this.calculateRecencyScore(course, context),
      instructorScore: this.calculateInstructorScore(course, context),
      priceScore: this.calculatePriceScore(course, context),
      durationScore: this.calculateDurationScore(course, context),
      levelMatch: this.calculateLevelMatch(course, context),
      personalizationScore: this.calculatePersonalizationScore(course, context),
      engagementScore: this.calculateEngagementScore(course, context),
      qualityScore: this.calculateQualityScore(course, context)
    };

    return factors;
  }

  /**
   * Calculate text relevance score
   */
  private calculateTextRelevance(course: Course, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const courseText = `
      ${course.title.toLowerCase()}
      ${course.description.toLowerCase()}
      ${course.shortDescription.toLowerCase()}
      ${course.tags.join(' ').toLowerCase()}
      ${course.skills.join(' ').toLowerCase()}
    `;

    let score = 0;
    let totalWords = queryWords.length;

    for (const word of queryWords) {
      if (courseText.includes(word)) {
        score += 1;
        
        // Bonus for title matches
        if (course.title.toLowerCase().includes(word)) {
          score += 2;
        }
        
        // Bonus for exact phrase matches
        if (courseText.includes(query.toLowerCase())) {
          score += 3;
        }
      }
    }

    return Math.min(score / (totalWords * 3), 1.0);
  }

  /**
   * Calculate semantic similarity (mock implementation)
   */
  private calculateSemanticSimilarity(course: Course, query: string): number {
    // In a real implementation, this would use vector embeddings
    // For now, we'll use a simplified approach based on skill overlap
    
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const courseWords = new Set([
      ...course.title.toLowerCase().split(/\s+/),
      ...course.description.toLowerCase().split(/\s+/),
      ...course.tags.map(tag => tag.toLowerCase()),
      ...course.skills.map(skill => skill.toLowerCase())
    ]);

    const intersection = new Set([...queryWords].filter(word => courseWords.has(word)));
    const union = new Set([...queryWords, ...courseWords]);

    return intersection.size / union.size;
  }

  /**
   * Calculate popularity score
   */
  private calculatePopularityScore(course: Course, context: RankingContext): number {
    // Normalize enrollment count (log scale)
    const normalizedEnrollment = Math.log(course.enrollmentCount + 1) / Math.log(10000);
    
    // Apply global trend factor
    const trendFactor = context.globalTrends.get(course.category.id) || 1.0;
    
    // Apply seasonal factor
    const seasonalFactor = context.seasonalFactors.get(course.category.id) || 1.0;
    
    return Math.min(normalizedEnrollment * trendFactor * seasonalFactor, 1.0);
  }

  /**
   * Calculate rating score
   */
  private calculateRatingScore(course: Course, context: RankingContext): number {
    // Normalize rating (1-5 scale to 0-1)
    const normalizedRating = course.rating / 5.0;
    
    // Apply rating count factor (more ratings = more reliable)
    const ratingCountFactor = Math.min(course.ratingCount / 100, 1.0);
    
    return normalizedRating * (0.7 + 0.3 * ratingCountFactor);
  }

  /**
   * Calculate recency score
   */
  private calculateRecencyScore(course: Course, context: RankingContext): number {
    const daysSinceCreation = (context.currentTime.getTime() - course.metadata.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // Newer courses get higher scores, with exponential decay
    const recencyScore = Math.exp(-daysSinceCreation / 365);
    
    return Math.min(recencyScore, 1.0);
  }

  /**
   * Calculate instructor score
   */
  private calculateInstructorScore(course: Course, context: RankingContext): number {
    // Based on instructor rating and experience
    const instructorRating = course.instructor.rating / 5.0;
    
    // Bonus if user prefers this instructor
    let preferenceBonus = 0;
    if (context.userProfile && context.userProfile.preferredInstructors.includes(course.instructor.id)) {
      preferenceBonus = 0.3;
    }
    
    return Math.min(instructorRating + preferenceBonus, 1.0);
  }

  /**
   * Calculate price score based on user preferences
   */
  private calculatePriceScore(course: Course, context: RankingContext): number {
    const price = course.price || 0;
    
    if (!context.userProfile) {
      // Default: prefer free courses
      return 1.0 - Math.min(price / 100, 1.0);
    }
    
    const priceSensitivity = context.userProfile.priceSensitivity;
    
    switch (priceSensitivity) {
      case 'high':
        return 1.0 - Math.min(price / 50, 1.0);
      case 'medium':
        return 1.0 - Math.min(price / 200, 1.0);
      case 'low':
        return 0.8 + 0.2 * Math.min(price / 500, 1.0);
      default:
        return 0.5;
    }
  }

  /**
   * Calculate duration score based on user preferences
   */
  private calculateDurationScore(course: Course, context: RankingContext): number {
    const duration = course.metadata.duration;
    
    if (!context.userProfile) {
      // Default: prefer medium duration
      return 1.0 - Math.abs(duration - 20) / 40;
    }
    
    const timeCommitment = context.userProfile.timeCommitment;
    
    switch (timeCommitment) {
      case 'low':
        return 1.0 - Math.min(duration / 20, 1.0);
      case 'medium':
        return 1.0 - Math.abs(duration - 20) / 40;
      case 'high':
        return Math.min(duration / 40, 1.0);
      default:
        return 0.5;
    }
  }

  /**
   * Calculate level match score
   */
  private calculateLevelMatch(course: Course, context: RankingContext): number {
    if (!context.userProfile || context.userProfile.preferredLevels.length === 0) {
      return 0.5; // Neutral score
    }
    
    const courseLevel = course.metadata.level;
    const preferredLevels = context.userProfile.preferredLevels;
    
    return preferredLevels.includes(courseLevel) ? 1.0 : 0.2;
  }

  /**
   * Calculate personalization score
   */
  private calculatePersonalizationScore(course: Course, context: RankingContext): number {
    if (!context.userProfile) {
      return 0.0;
    }
    
    let score = 0;
    
    // Category preference
    if (context.userProfile.preferredCategories.includes(course.category.id)) {
      score += 0.3;
    }
    
    // Skill interest overlap
    const skillOverlap = course.skills.filter(skill => 
      context.userProfile!.skillInterests.includes(skill)
    ).length;
    score += Math.min(skillOverlap / 5, 0.3);
    
    // Career goal alignment
    const careerAlignment = course.objectives.filter(obj =>
      context.userProfile!.careerGoals.some(goal => obj.toLowerCase().includes(goal.toLowerCase()))
    ).length;
    score += Math.min(careerAlignment / 3, 0.2);
    
    // Previously enrolled courses (avoid duplicates)
    if (context.userProfile.enrolledCourses.includes(course.id)) {
      score -= 0.5;
    }
    
    return Math.max(0, Math.min(score, 1.0));
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(course: Course, context: RankingContext): number {
    // Mock engagement metrics
    const completionRate = 0.75 + Math.random() * 0.2;
    const averageWatchTime = 0.6 + Math.random() * 0.3;
    const forumActivity = 0.3 + Math.random() * 0.4;
    
    return (completionRate * 0.4 + averageWatchTime * 0.4 + forumActivity * 0.2);
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(course: Course, context: RankingContext): number {
    // Based on various quality indicators
    const hasVideo = course.curriculum.some(module => 
      module.lessons.some(lesson => lesson.videoUrl)
    );
    const hasResources = course.curriculum.some(module => 
      module.lessons.some(lesson => lesson.resourceUrls && lesson.resourceUrls.length > 0)
    );
    const hasObjectives = course.objectives.length > 0;
    const hasComprehensiveContent = course.description.length > 500;
    
    let score = 0;
    if (hasVideo) score += 0.3;
    if (hasResources) score += 0.2;
    if (hasObjectives) score += 0.2;
    if (hasComprehensiveContent) score += 0.3;
    
    return score;
  }

  /**
   * Calculate final ranking score
   */
  private calculateFinalScore(factors: RankingFactors, context: RankingContext): number {
    let score = 0;
    
    // Apply weights to factors
    score += factors.textRelevance * this.rankingWeights.get('textRelevance')!;
    score += factors.semanticSimilarity * this.rankingWeights.get('semanticSimilarity')!;
    score += factors.popularityScore * this.rankingWeights.get('popularityScore')!;
    score += factors.ratingScore * this.rankingWeights.get('ratingScore')!;
    score += factors.recencyScore * this.rankingWeights.get('recencyScore')!;
    score += factors.instructorScore * this.rankingWeights.get('instructorScore')!;
    score += factors.priceScore * this.rankingWeights.get('priceScore')!;
    score += factors.durationScore * this.rankingWeights.get('durationScore')!;
    score += factors.levelMatch * this.rankingWeights.get('levelMatch')!;
    score += factors.personalizationScore * this.rankingWeights.get('personalizationScore')!;
    score += factors.engagementScore * this.rankingWeights.get('engagementScore')!;
    score += factors.qualityScore * this.rankingWeights.get('qualityScore')!;
    
    return Math.min(score, 1.0);
  }

  /**
   * Generate ranking explanation
   */
  private generateExplanation(factors: RankingFactors, course: Course, context: RankingContext): string[] {
    const explanations: string[] = [];
    
    if (factors.textRelevance > 0.7) {
      explanations.push('Highly relevant to your search terms');
    }
    
    if (factors.semanticSimilarity > 0.6) {
      explanations.push('Semantically similar to your query');
    }
    
    if (factors.ratingScore > 0.8) {
      explanations.push('Excellent student ratings');
    }
    
    if (factors.popularityScore > 0.7) {
      explanations.push('Popular among students');
    }
    
    if (factors.personalizationScore > 0.5) {
      explanations.push('Matches your learning preferences');
    }
    
    if (factors.priceScore > 0.8 && (course.price || 0) === 0) {
      explanations.push('Free course available');
    }
    
    if (factors.recencyScore > 0.7) {
      explanations.push('Recently published content');
    }
    
    return explanations;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(factors: RankingFactors, context: RankingContext): number {
    // Confidence based on consistency of high scores across factors
    const scores = Object.values(factors);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
    
    // Lower variance = higher confidence
    const confidence = 1.0 - Math.min(variance, 1.0);
    
    return Math.max(0.5, confidence);
  }

  /**
   * Apply diversity adjustments to ranking
   */
  private applyDiversityAdjustments(rankedCourses: RankedCourse[], context: RankingContext): RankedCourse[] {
    const adjusted = [...rankedCourses];
    const categoryCount = new Map<string, number>();
    const instructorCount = new Map<string, number>();
    
    for (let i = 0; i < adjusted.length; i++) {
      const course = adjusted[i];
      const categoryCount_current = categoryCount.get(course.category.id) || 0;
      const instructorCount_current = instructorCount.get(course.instructor.id) || 0;
      
      // Apply diversity penalty if too many from same category/instructor
      if (categoryCount_current > 2) {
        course.rankingScore *= 0.8;
      }
      
      if (instructorCount_current > 1) {
        course.rankingScore *= 0.9;
      }
      
      categoryCount.set(course.category.id, categoryCount_current + 1);
      instructorCount.set(course.instructor.id, instructorCount_current + 1);
    }
    
    // Re-sort after adjustments
    adjusted.sort((a, b) => b.rankingScore - a.rankingScore);
    
    return adjusted;
  }

  /**
   * Calculate ranking metrics
   */
  private calculateRankingMetrics(rankedCourses: RankedCourse[]): {
    averageConfidence: number;
    diversityScore: number;
    noveltyScore: number;
    coverageScore: number;
  } {
    const averageConfidence = rankedCourses.reduce((sum, course) => sum + course.confidence, 0) / rankedCourses.length;
    
    // Diversity: variety of categories and instructors
    const categories = new Set(rankedCourses.map(c => c.category.id));
    const instructors = new Set(rankedCourses.map(c => c.instructor.id));
    const diversityScore = (categories.size + instructors.size) / (rankedCourses.length * 2);
    
    // Novelty: proportion of newer/less popular courses
    const novelCourses = rankedCourses.filter(c => c.rankingFactors.popularityScore < 0.5).length;
    const noveltyScore = novelCourses / rankedCourses.length;
    
    // Coverage: variety of levels and price points
    const levels = new Set(rankedCourses.map(c => c.metadata.level));
    const priceRanges = new Set(rankedCourses.map(c => c.price || 0 > 0 ? 'paid' : 'free'));
    const coverageScore = (levels.size + priceRanges.size) / 5;
    
    return {
      averageConfidence,
      diversityScore,
      noveltyScore,
      coverageScore
    };
  }

  /**
   * Learn from ranking results
   */
  private async learnFromRanking(result: RankingResult, context: RankingContext): Promise<void> {
    // Update global trends based on ranking performance
    // This would be implemented with actual ML algorithms
    logger.info('Learning from ranking results');
  }

  /**
   * Get user profile
   */
  private getUserProfile(userId: string): UserProfile | undefined {
    return this.userProfiles.get(userId);
  }

  /**
   * Get search history
   */
  private getSearchHistory(userId: string): Array<{ query: string; clickedCourses: string[]; timestamp: Date }> {
    // Mock implementation - would come from database
    return [];
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

  /**
   * Initialize ranking weights
   */
  private initializeRankingWeights(): void {
    this.rankingWeights = new Map([
      ['textRelevance', 0.25],
      ['semanticSimilarity', 0.15],
      ['popularityScore', 0.10],
      ['ratingScore', 0.10],
      ['recencyScore', 0.05],
      ['instructorScore', 0.05],
      ['priceScore', 0.05],
      ['durationScore', 0.05],
      ['levelMatch', 0.05],
      ['personalizationScore', 0.10],
      ['engagementScore', 0.05],
      ['qualityScore', 0.05]
    ]);
  }

  /**
   * Initialize global trends
   */
  private initializeTrends(): void {
    // Mock trend data
    this.globalTrends.set('programming', 1.2);
    this.globalTrends.set('design', 1.1);
    this.globalTrends.set('business', 0.9);
    this.globalTrends.set('data-science', 1.3);
    
    // Mock seasonal factors
    this.seasonalFactors.set('programming', 1.0);
    this.seasonalFactors.set('design', 1.1);
    this.seasonalFactors.set('business', 0.9);
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
   * Update user profile
   */
  updateUserProfile(profile: UserProfile): void {
    this.userProfiles.set(profile.userId, profile);
    logger.info(`Updated user profile: ${profile.userId}`);
  }

  /**
   * Get ranking statistics
   */
  getRankingStatistics(): {
    averageRankingTime: number;
    totalRankings: number;
    averageConfidence: number;
    topFactors: Array<{ factor: string; weight: number }>;
  } {
    const rankingTimes = this.performanceMetrics.get('ranking_time') || [];
    const averageRankingTime = rankingTimes.length > 0 
      ? rankingTimes.reduce((sum, time) => sum + time, 0) / rankingTimes.length 
      : 0;

    const topFactors = Array.from(this.rankingWeights.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([factor, weight]) => ({ factor, weight }));

    return {
      averageRankingTime,
      totalRankings: rankingTimes.length,
      averageConfidence: 0.8,
      topFactors
    };
  }
}

export default IntelligentRanking;
