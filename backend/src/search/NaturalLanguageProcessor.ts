/**
 * Natural Language Processor
 * Handles query processing, intent recognition, and multilingual support
 */

import { Course } from '../models/Course';
import logger from '../utils/logger';

export interface ProcessedQuery {
  originalQuery: string;
  processedQuery: string;
  language: string;
  intent: SearchIntent;
  entities: QueryEntities;
  suggestions: string[];
  confidence: number;
  processingTime: number;
}

export interface SearchIntent {
  type: 'course_search' | 'skill_search' | 'career_path' | 'comparison' | 'recommendation' | 'filter_query';
  confidence: number;
  entities: {
    skills?: string[];
    level?: string;
    category?: string;
    price_range?: { min: number; max: number };
    duration?: { min: number; max: number };
    language?: string;
    instructor?: string;
    rating?: number;
  };
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface QueryEntities {
  skills: string[];
  categories: string[];
  levels: string[];
  price_ranges: Array<{ min: number; max: number }>;
  durations: Array<{ min: number; max: number }>;
  languages: string[];
  instructors: string[];
  ratings: number[];
  keywords: string[];
  phrases: string[];
}

export interface LanguageDetection {
  language: string;
  confidence: number;
  translatedQuery?: string;
}

export interface SuggestionResult {
  suggestions: string[];
  autoCompleted?: string;
  corrected?: string;
  expanded?: string[];
}

export class NaturalLanguageProcessor {
  private skillKeywords: Set<string>;
  private categoryKeywords: Map<string, string[]>;
  private levelKeywords: Set<string>;
  private languagePatterns: Map<string, RegExp>;
  private pricePatterns: RegExp[];
  private durationPatterns: RegExp[];
  private ratingPatterns: RegExp[];
  private intentPatterns: Map<string, { pattern: RegExp; intent: SearchIntent['type']; confidence: number }>;

  constructor() {
    this.initializeKeywordSets();
    this.initializePatterns();
  }

  /**
   * Process a natural language query
   */
  async processQuery(query: string): Promise<ProcessedQuery> {
    const startTime = Date.now();

    try {
      // Detect language
      const languageDetection = await this.detectLanguage(query);
      
      // Translate if necessary (mock implementation)
      const processedQuery = languageDetection.translatedQuery || query;
      
      // Extract entities
      const entities = this.extractEntities(processedQuery);
      
      // Recognize intent
      const intent = await this.recognizeIntent(processedQuery);
      
      // Generate suggestions
      const suggestions = await this.generateSuggestions(processedQuery, [], 5);
      
      // Calculate confidence
      const confidence = this.calculateProcessingConfidence(intent, entities, languageDetection);

      const result: ProcessedQuery = {
        originalQuery: query,
        processedQuery,
        language: languageDetection.language,
        intent,
        entities,
        suggestions,
        confidence,
        processingTime: Date.now() - startTime
      };

      logger.info(`NLP processing completed - Query: "${query}", Intent: ${intent.type}, Time: ${result.processingTime}ms`);

      return result;
    } catch (error) {
      logger.error('Error processing query', error);
      throw error;
    }
  }

  /**
   * Recognize search intent from query
   */
  async recognizeIntent(query: string): Promise<SearchIntent> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      
      // Check intent patterns
      for (const [patternName, patternData] of this.intentPatterns) {
        if (patternData.pattern.test(normalizedQuery)) {
          const entities = this.extractEntities(query);
          
          return {
            type: patternData.intent,
            confidence: patternData.confidence,
            entities,
            sentiment: this.analyzeSentiment(normalizedQuery),
            urgency: this.analyzeUrgency(normalizedQuery),
            complexity: this.analyzeComplexity(normalizedQuery)
          };
        }
      }

      // Default intent
      return {
        type: 'course_search',
        confidence: 0.5,
        entities: this.extractEntities(query),
        sentiment: this.analyzeSentiment(normalizedQuery),
        urgency: this.analyzeUrgency(normalizedQuery),
        complexity: this.analyzeComplexity(normalizedQuery)
      };
    } catch (error) {
      logger.error('Error recognizing intent', error);
      return this.getDefaultIntent();
    }
  }

  /**
   * Generate search suggestions
   */
  async generateSuggestions(query: string, courses: Course[], limit: number = 5): Promise<string[]> {
    try {
      const suggestions = new Set<string>();
      const normalizedQuery = query.toLowerCase().trim();

      // Auto-completion suggestions
      const autoCompletions = this.generateAutoCompletions(normalizedQuery, courses);
      autoCompletions.forEach(s => suggestions.add(s));

      // Spelling corrections
      const corrections = this.generateSpellingCorrections(normalizedQuery);
      corrections.forEach(s => suggestions.add(s));

      // Query expansion
      const expansions = this.generateQueryExpansions(normalizedQuery);
      expansions.forEach(s => suggestions.add(s));

      // Related searches based on entities
      const entities = this.extractEntities(query);
      const relatedSuggestions = this.generateRelatedSuggestions(entities, courses);
      relatedSuggestions.forEach(s => suggestions.add(s));

      const result = Array.from(suggestions).slice(0, limit);
      logger.info(`Generated ${result.length} suggestions for query: "${query}"`);

      return result;
    } catch (error) {
      logger.error('Error generating suggestions', error);
      return [];
    }
  }

  /**
   * Detect query language
   */
  async detectLanguage(query: string): Promise<LanguageDetection> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      
      // Simple language detection based on patterns
      for (const [language, pattern] of this.languagePatterns) {
        if (pattern.test(normalizedQuery)) {
          return {
            language,
            confidence: 0.8
          };
        }
      }

      // Default to English
      return {
        language: 'en',
        confidence: 0.9
      };
    } catch (error) {
      logger.error('Error detecting language', error);
      return { language: 'en', confidence: 0.5 };
    }
  }

  /**
   * Extract entities from query
   */
  private extractEntities(query: string): QueryEntities {
    const normalizedQuery = query.toLowerCase().trim();
    const entities: QueryEntities = {
      skills: [],
      categories: [],
      levels: [],
      price_ranges: [],
      durations: [],
      languages: [],
      instructors: [],
      ratings: [],
      keywords: [],
      phrases: []
    };

    // Extract skills
    for (const skill of this.skillKeywords) {
      if (normalizedQuery.includes(skill)) {
        entities.skills.push(skill);
      }
    }

    // Extract categories
    for (const [category, keywords] of this.categoryKeywords) {
      for (const keyword of keywords) {
        if (normalizedQuery.includes(keyword)) {
          entities.categories.push(category);
          break;
        }
      }
    }

    // Extract levels
    for (const level of this.levelKeywords) {
      if (normalizedQuery.includes(level)) {
        entities.levels.push(level);
      }
    }

    // Extract price ranges
    for (const pattern of this.pricePatterns) {
      const match = normalizedQuery.match(pattern);
      if (match) {
        const min = parseInt(match[1]) || 0;
        const max = parseInt(match[2]) || min;
        entities.price_ranges.push({ min, max });
      }
    }

    // Extract durations
    for (const pattern of this.durationPatterns) {
      const match = normalizedQuery.match(pattern);
      if (match) {
        const min = parseInt(match[1]) || 0;
        const max = parseInt(match[2]) || min;
        entities.durations.push({ min, max });
      }
    }

    // Extract ratings
    for (const pattern of this.ratingPatterns) {
      const match = normalizedQuery.match(pattern);
      if (match) {
        const rating = parseInt(match[1]);
        if (rating >= 1 && rating <= 5) {
          entities.ratings.push(rating);
        }
      }
    }

    // Extract keywords (simple word extraction)
    const words = normalizedQuery.split(/\s+/).filter(word => word.length > 2);
    entities.keywords = words;

    // Extract phrases (quoted text)
    const phraseMatches = query.match(/"([^"]+)"/g);
    if (phraseMatches) {
      entities.phrases = phraseMatches.map(phrase => phrase.replace(/"/g, ''));
    }

    return entities;
  }

  /**
   * Analyze sentiment of query
   */
  private analyzeSentiment(query: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['best', 'excellent', 'amazing', 'great', 'awesome', 'fantastic', 'good', 'love'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'poor', 'disappointing'];

    const positiveCount = positiveWords.filter(word => query.includes(word)).length;
    const negativeCount = negativeWords.filter(word => query.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Analyze urgency of query
   */
  private analyzeUrgency(query: string): 'low' | 'medium' | 'high' {
    const urgentWords = ['urgent', 'asap', 'immediately', 'now', 'quick', 'fast'];
    const urgentCount = urgentWords.filter(word => query.includes(word)).length;

    if (urgentCount >= 2) return 'high';
    if (urgentCount >= 1) return 'medium';
    return 'low';
  }

  /**
   * Analyze complexity of query
   */
  private analyzeComplexity(query: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = query.split(/\s+/).length;
    const entityCount = this.extractEntities(query).skills.length + 
                      this.extractEntities(query).categories.length + 
                      this.extractEntities(query).levels.length;

    if (wordCount <= 3 && entityCount <= 1) return 'simple';
    if (wordCount <= 8 && entityCount <= 3) return 'moderate';
    return 'complex';
  }

  /**
   * Generate auto-completions
   */
  private generateAutoCompletions(query: string, courses: Course[]): string[] {
    const completions: string[] = [];
    
    // Course title completions
    for (const course of courses) {
      if (course.title.toLowerCase().startsWith(query) && course.title !== query) {
        completions.push(course.title);
      }
    }

    return completions.slice(0, 3);
  }

  /**
   * Generate spelling corrections
   */
  private generateSpellingCorrections(query: string): string[] {
    // Simple spelling correction (mock implementation)
    const commonMisspellings: { [key: string]: string } = {
      'javascrpt': 'javascript',
      'pythn': 'python',
      'reactjs': 'react',
      'nodejs': 'node.js',
      'html5': 'html',
      'css3': 'css'
    };

    const corrections: string[] = [];
    for (const [misspelled, correct] of Object.entries(commonMisspellings)) {
      if (query.includes(misspelled)) {
        corrections.push(query.replace(misspelled, correct));
      }
    }

    return corrections;
  }

  /**
   * Generate query expansions
   */
  private generateQueryExpansions(query: string): string[] {
    const expansions: string[] = [];
    
    // Skill expansions
    const skillExpansions: { [key: string]: string[] } = {
      'js': ['javascript', 'js'],
      'py': ['python', 'py'],
      'ml': ['machine learning', 'ml'],
      'ai': ['artificial intelligence', 'ai'],
      'web': ['web development', 'web'],
      'app': ['application development', 'app']
    };

    for (const [abbr, full] of Object.entries(skillExpansions)) {
      if (query.includes(abbr)) {
        full.forEach(expansion => {
          expansions.push(query.replace(abbr, expansion));
        });
      }
    }

    return expansions;
  }

  /**
   * Generate related suggestions based on entities
   */
  private generateRelatedSuggestions(entities: QueryEntities, courses: Course[]): string[] {
    const suggestions: string[] = [];

    // Suggest related skills
    if (entities.skills.length > 0) {
      for (const skill of entities.skills) {
        suggestions.push(`advanced ${skill}`);
        suggestions.push(`${skill} for beginners`);
        suggestions.push(`${skill} projects`);
      }
    }

    // Suggest related categories
    if (entities.categories.length > 0) {
      for (const category of entities.categories) {
        suggestions.push(`${category} tutorial`);
        suggestions.push(`${category} certification`);
      }
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Calculate processing confidence
   */
  private calculateProcessingConfidence(
    intent: SearchIntent, 
    entities: QueryEntities, 
    languageDetection: LanguageDetection
  ): number {
    let confidence = 0.5; // Base confidence

    // Intent confidence
    confidence += intent.confidence * 0.3;

    // Entity extraction confidence
    const entityCount = Object.values(entities).flat().length;
    confidence += Math.min(entityCount / 10, 0.2);

    // Language detection confidence
    confidence += languageDetection.confidence * 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Get default intent
   */
  private getDefaultIntent(): SearchIntent {
    return {
      type: 'course_search',
      confidence: 0.5,
      entities: {
        skills: [],
        categories: [],
        levels: [],
        price_ranges: [],
        durations: [],
        languages: [],
        instructors: [],
        ratings: [],
        keywords: [],
        phrases: []
      },
      sentiment: 'neutral',
      urgency: 'medium',
      complexity: 'simple'
    };
  }

  /**
   * Initialize keyword sets
   */
  private initializeKeywordSets(): void {
    this.skillKeywords = new Set([
      'javascript', 'python', 'java', 'react', 'node.js', 'html', 'css',
      'sql', 'mongodb', 'aws', 'docker', 'kubernetes', 'git', 'machine learning',
      'artificial intelligence', 'data science', 'web development', 'mobile development',
      'devops', 'testing', 'ui', 'ux', 'design', 'blockchain', 'security'
    ]);

    this.categoryKeywords = new Map([
      ['programming', ['programming', 'coding', 'development', 'software']],
      ['design', ['design', 'ui', 'ux', 'graphic', 'creative']],
      ['business', ['business', 'marketing', 'sales', 'finance', 'entrepreneurship']],
      ['data science', ['data science', 'analytics', 'big data', 'statistics']],
      ['web development', ['web', 'website', 'frontend', 'backend', 'fullstack']]
    ]);

    this.levelKeywords = new Set([
      'beginner', 'intro', 'introduction', 'basic', 'fundamentals',
      'intermediate', 'advanced', 'expert', 'professional', 'master'
    ]);
  }

  /**
   * Initialize patterns
   */
  private initializePatterns(): void {
    this.languagePatterns = new Map([
      ['en', /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/i],
      ['es', /\b(el|la|y|o|pero|en|de|para|con|por)\b/i],
      ['fr', /\b(le|la|et|ou|mais|dans|de|pour|avec|par)\b/i],
      ['de', /\b(der|die|das|und|oder|aber|in|zu|für|mit|von)\b/i]
    ]);

    this.pricePatterns = [
      /\$(\d+)(?:\s*[-to]\s*\$?(\d+))?/i,
      /(\d+)\s*(?:dollars?|usd)\s*(?:[-to]\s*(\d+)\s*(?:dollars?|usd))?/i
    ];

    this.durationPatterns = [
      /(\d+)\s*(?:hours?|hrs?)\s*(?:[-to]\s*(\d+)\s*(?:hours?|hrs?))?/i,
      /(\d+)\s*(?:days?)\s*(?:[-to]\s*(\d+)\s*(?:days?))?/i
    ];

    this.ratingPatterns = [
      /(\d+)\s*(?:stars?|rating)/i,
      /rating\s*[:]\s*(\d+)/i
    ];

    this.intentPatterns = new Map([
      ['skill_search', { 
        pattern: /\b(how\s+to|learn|master|study|training)\b/i, 
        intent: 'skill_search' as SearchIntent['type'], 
        confidence: 0.8 
      }],
      ['career_path', { 
        pattern: /\b(career|path|roadmap|become|professional)\b/i, 
        intent: 'career_path' as SearchIntent['type'], 
        confidence: 0.8 
      }],
      ['comparison', { 
        pattern: /\b(compare|vs|versus|difference|better|best)\b/i, 
        intent: 'comparison' as SearchIntent['type'], 
        confidence: 0.8 
      }],
      ['recommendation', { 
        pattern: /\b(recommend|suggest|show\s+me|what\s+should)\b/i, 
        intent: 'recommendation' as SearchIntent['type'], 
        confidence: 0.8 
      }],
      ['filter_query', { 
        pattern: /\b(under|below|above|more\s+than|less\s+than|between)\b/i, 
        intent: 'filter_query' as SearchIntent['type'], 
        confidence: 0.7 
      }]
    ]);
  }
}

export default NaturalLanguageProcessor;
