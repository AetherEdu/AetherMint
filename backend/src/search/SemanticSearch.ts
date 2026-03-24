/**
 * Semantic Search Implementation
 * Provides AI-powered semantic search capabilities using vector embeddings
 */

import { Course } from '../models/Course';
import logger from '../utils/logger';

export interface VectorEmbedding {
  id: string;
  vector: number[];
  metadata: {
    courseId: string;
    contentType: 'title' | 'description' | 'tags' | 'skills' | 'combined';
    text: string;
  };
}

export interface SemanticSearchResult {
  courseId: string;
  course: Course;
  score: number;
  matchType: 'exact' | 'semantic' | 'partial';
  matchedFields: string[];
}

export interface SemanticSearchResponse {
  results: Course[];
  averageScore: number;
  totalProcessed: number;
  queryEmbedding: number[];
  processingTime: number;
}

export class SemanticSearch {
  private embeddings: Map<string, VectorEmbedding>;
  private embeddingDimension: number;
  private similarityThreshold: number;
  private cache: Map<string, SemanticSearchResponse>;

  constructor() {
    this.embeddings = new Map();
    this.embeddingDimension = 384; // Standard for sentence-transformers
    this.similarityThreshold = 0.7;
    this.cache = new Map();
  }

  /**
   * Initialize semantic search with course data
   */
  async initialize(courses: Course[]): Promise<void> {
    try {
      logger.info(`Initializing semantic search with ${courses.length} courses`);
      
      // Generate embeddings for all courses
      for (const course of courses) {
        await this.generateCourseEmbeddings(course);
      }
      
      logger.info(`Semantic search initialized with ${this.embeddings.size} embeddings`);
    } catch (error) {
      logger.error('Error initializing semantic search', error);
      throw error;
    }
  }

  /**
   * Perform semantic search
   */
  async search(query: string, courses: Course[], limit: number = 50): Promise<SemanticSearchResponse> {
    const startTime = Date.now();
    const cacheKey = `${query}_${limit}`;

    try {
      // Check cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        logger.info(`Semantic search cache hit for query: ${query}`);
        return cached;
      }

      // Generate query embedding
      const queryEmbedding = await this.generateTextEmbedding(query);
      
      // Calculate similarities
      const similarities: SemanticSearchResult[] = [];
      
      for (const course of courses) {
        const courseEmbeddings = this.getCourseEmbeddings(course.id);
        
        if (courseEmbeddings.length === 0) {
          continue;
        }

        // Find best matching embedding for this course
        let bestScore = 0;
        let bestMatchType: 'exact' | 'semantic' | 'partial' = 'semantic';
        let matchedFields: string[] = [];

        for (const embedding of courseEmbeddings) {
          const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding.vector);
          
          if (similarity > bestScore) {
            bestScore = similarity;
            matchedFields = [embedding.metadata.contentType];
            
            // Determine match type based on similarity
            if (similarity >= 0.95) {
              bestMatchType = 'exact';
            } else if (similarity >= this.similarityThreshold) {
              bestMatchType = 'semantic';
            } else {
              bestMatchType = 'partial';
            }
          } else if (similarity > this.similarityThreshold * 0.8) {
            // Additional field matches
            matchedFields.push(embedding.metadata.contentType);
          }
        }

        if (bestScore >= this.similarityThreshold * 0.6) {
          similarities.push({
            courseId: course.id,
            course,
            score: bestScore,
            matchType: bestMatchType,
            matchedFields
          });
        }
      }

      // Sort by similarity score
      similarities.sort((a, b) => b.score - a.score);

      // Get top results
      const topResults = similarities.slice(0, limit);
      const resultCourses = topResults.map(r => r.course);
      
      // Calculate average score
      const averageScore = topResults.length > 0 
        ? topResults.reduce((sum, r) => sum + r.score, 0) / topResults.length 
        : 0;

      const response: SemanticSearchResponse = {
        results: resultCourses,
        averageScore,
        totalProcessed: courses.length,
        queryEmbedding,
        processingTime: Date.now() - startTime
      };

      // Cache the result
      this.cache.set(cacheKey, response);

      logger.info(`Semantic search completed - Query: ${query}, Results: ${resultCourses.length}, Time: ${response.processingTime}ms`);

      return response;
    } catch (error) {
      logger.error('Error in semantic search', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for a course
   */
  private async generateCourseEmbeddings(course: Course): Promise<void> {
    try {
      // Generate embeddings for different content types
      const contentTypes = [
        { type: 'title' as const, text: course.title },
        { type: 'description' as const, text: course.description },
        { type: 'tags' as const, text: course.tags.join(' ') },
        { type: 'skills' as const, text: course.skills.join(' ') },
        { type: 'combined' as const, text: this.combineCourseContent(course) }
      ];

      for (const contentType of contentTypes) {
        const embedding = await this.generateTextEmbedding(contentType.text);
        
        const vectorEmbedding: VectorEmbedding = {
          id: `${course.id}_${contentType.type}`,
          vector: embedding,
          metadata: {
            courseId: course.id,
            contentType: contentType.type,
            text: contentType.text
          }
        };

        this.embeddings.set(vectorEmbedding.id, vectorEmbedding);
      }
    } catch (error) {
      logger.error(`Error generating embeddings for course ${course.id}`, error);
    }
  }

  /**
   * Generate text embedding (mock implementation)
   */
  private async generateTextEmbedding(text: string): Promise<number[]> {
    try {
      // In a real implementation, this would call an embedding service
      // For now, we'll create a mock embedding based on text hash
      
      const normalizedText = text.toLowerCase().trim();
      const embedding = new Array(this.embeddingDimension).fill(0);
      
      // Generate pseudo-random but deterministic embedding based on text
      let hash = 0;
      for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      // Use hash to generate embedding values
      for (let i = 0; i < this.embeddingDimension; i++) {
        embedding[i] = Math.sin(hash + i) * 0.5 + 0.5;
      }
      
      // Normalize the embedding
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map(val => val / magnitude);
    } catch (error) {
      logger.error('Error generating text embedding', error);
      throw error;
    }
  }

  /**
   * Get all embeddings for a course
   */
  private getCourseEmbeddings(courseId: string): VectorEmbedding[] {
    const courseEmbeddings: VectorEmbedding[] = [];
    
    for (const [id, embedding] of this.embeddings) {
      if (embedding.metadata.courseId === courseId) {
        courseEmbeddings.push(embedding);
      }
    }
    
    return courseEmbeddings;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magnitudeA += vecA[i] * vecA[i];
      magnitudeB += vecB[i] * vecB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Combine all course content into a single text
   */
  private combineCourseContent(course: Course): string {
    return `
      ${course.title}
      ${course.description}
      ${course.shortDescription}
      ${course.tags.join(' ')}
      ${course.skills.join(' ')}
      ${course.category.name}
      ${course.instructor.name}
      ${course.objectives.join(' ')}
    `.replace(/\s+/g, ' ').trim();
  }

  /**
   * Find similar courses based on a reference course
   */
  async findSimilarCourses(referenceCourse: Course, courses: Course[], limit: number = 10): Promise<Course[]> {
    try {
      const referenceEmbeddings = this.getCourseEmbeddings(referenceCourse.id);
      
      if (referenceEmbeddings.length === 0) {
        return [];
      }

      const similarities: { courseId: string; score: number }[] = [];

      for (const course of courses) {
        if (course.id === referenceCourse.id) {
          continue;
        }

        const courseEmbeddings = this.getCourseEmbeddings(course.id);
        
        if (courseEmbeddings.length === 0) {
          continue;
        }

        // Calculate maximum similarity between any pair of embeddings
        let maxSimilarity = 0;
        
        for (const refEmbedding of referenceEmbeddings) {
          for (const courseEmbedding of courseEmbeddings) {
            const similarity = this.calculateCosineSimilarity(
              refEmbedding.vector, 
              courseEmbedding.vector
            );
            maxSimilarity = Math.max(maxSimilarity, similarity);
          }
        }

        if (maxSimilarity >= this.similarityThreshold * 0.7) {
          similarities.push({ courseId: course.id, score: maxSimilarity });
        }
      }

      // Sort by similarity and return top results
      similarities.sort((a, b) => b.score - a.score);
      
      return similarities
        .slice(0, limit)
        .map(sim => courses.find(c => c.id === sim.courseId)!)
        .filter(Boolean);
    } catch (error) {
      logger.error('Error finding similar courses', error);
      return [];
    }
  }

  /**
   * Update embeddings for a course
   */
  async updateCourseEmbeddings(course: Course): Promise<void> {
    try {
      // Remove existing embeddings for this course
      for (const [id, embedding] of this.embeddings) {
        if (embedding.metadata.courseId === course.id) {
          this.embeddings.delete(id);
        }
      }

      // Generate new embeddings
      await this.generateCourseEmbeddings(course);
      
      // Clear cache as embeddings have changed
      this.cache.clear();
      
      logger.info(`Updated embeddings for course: ${course.id}`);
    } catch (error) {
      logger.error(`Error updating embeddings for course ${course.id}`, error);
    }
  }

  /**
   * Get embedding statistics
   */
  getEmbeddingStats(): {
    totalEmbeddings: number;
    coursesIndexed: number;
    averageEmbeddingsPerCourse: number;
    cacheSize: number;
  } {
    const coursesIndexed = new Set<string>();
    
    for (const embedding of this.embeddings.values()) {
      coursesIndexed.add(embedding.metadata.courseId);
    }

    return {
      totalEmbeddings: this.embeddings.size,
      coursesIndexed: coursesIndexed.size,
      averageEmbeddingsPerCourse: coursesIndexed.size > 0 ? this.embeddings.size / coursesIndexed.size : 0,
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear all embeddings and cache
   */
  clearAll(): void {
    this.embeddings.clear();
    this.cache.clear();
    logger.info('Semantic search data cleared');
  }

  /**
   * Set similarity threshold
   */
  setSimilarityThreshold(threshold: number): void {
    this.similarityThreshold = Math.max(0, Math.min(1, threshold));
    logger.info(`Similarity threshold set to: ${this.similarityThreshold}`);
  }
}

export default SemanticSearch;
