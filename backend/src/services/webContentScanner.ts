/**
 * Web Content Scanner and Academic Database Integration
 * Service for scanning web content and academic databases for plagiarism detection
 */

import { PlagiarismMatch, DetectionMethod, SourceType } from '../models/PlagiarismDetection';
import logger from '../utils/logger';

export interface WebSearchResult {
  id: string;
  title: string;
  url: string;
  content: string;
  author?: string;
  publicationDate?: Date;
  snippet: string;
  relevanceScore: number;
}

export interface AcademicSearchResult {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  content: string;
  journal?: string;
  publicationDate: Date;
  doi?: string;
  database: string;
  relevanceScore: number;
}

export interface SearchQuery {
  query: string;
  maxResults?: number;
  language?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export class WebContentScanner {
  private searchEngines: Map<string, SearchEngine>;
  private rateLimits: Map<string, RateLimit>;
  private apiKey: string = '';

  constructor() {
    this.searchEngines = new Map();
    this.rateLimits = new Map();
    this.initializeSearchEngines();
  }

  /**
   * Initialize search engines
   */
  private initializeSearchEngines(): void {
    this.searchEngines.set('google', new GoogleSearchEngine());
    this.searchEngines.set('bing', new BingSearchEngine());
    this.searchEngines.set('duckduckgo', new DuckDuckGoSearchEngine());
    
    // Initialize rate limits
    this.rateLimits.set('google', new RateLimit(100, 86400)); // 100 requests per day
    this.rateLimits.set('bing', new RateLimit(1000, 86400)); // 1000 requests per day
    this.rateLimits.set('duckduckgo', new RateLimit(10000, 86400)); // 10000 requests per day
  }

  /**
   * Search multiple engines for content
   */
  async searchWebContent(keyPhrases: string[], settings: any): Promise<WebSearchResult[]> {
    const results: WebSearchResult[] = [];

    try {
      for (const phrase of keyPhrases) {
        for (const [engineName, engine] of this.searchEngines) {
          if (this.rateLimits.get(engineName)?.canMakeRequest()) {
            try {
              const searchResults = await engine.search(phrase, {
                maxResults: 10,
                language: 'en',
                excludedDomains: settings.excludedDomains || []
              });

              results.push(...searchResults);
              this.rateLimits.get(engineName)?.recordRequest();
            } catch (error) {
              logger.warn(`Search engine ${engineName} failed for phrase: ${phrase}`, error);
            }
          }
        }
      }

      // Remove duplicates and sort by relevance
      const uniqueResults = this.removeDuplicates(results);
      return uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    } catch (error) {
      logger.error('Error in web content scanning:', error);
      return [];
    }
  }

  /**
   * Remove duplicate search results
   */
  private removeDuplicates(results: WebSearchResult[]): WebSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.url;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

export class AcademicDatabaseScanner {
  private databases: Map<string, AcademicDatabase>;
  private rateLimits: Map<string, RateLimit>;

  constructor() {
    this.databases = new Map();
    this.rateLimits = new Map();
    this.initializeDatabases();
  }

  /**
   * Initialize academic databases
   */
  private initializeDatabases(): void {
    this.databases.set('pubmed', new PubMedDatabase());
    this.databases.set('arxiv', new ArxivDatabase());
    this.databases.set('google_scholar', new GoogleScholarDatabase());
    this.databases.set('jstor', new JSTORDatabase());
    this.databases.set('scopus', new ScopusDatabase());
    
    // Initialize rate limits
    this.rateLimits.set('pubmed', new RateLimit(500, 86400)); // 500 requests per day
    this.rateLimits.set('arxiv', new RateLimit(1000, 86400)); // 1000 requests per day
    this.rateLimits.set('google_scholar', new RateLimit(100, 86400)); // 100 requests per day
    this.rateLimits.set('jstor', new RateLimit(200, 86400)); // 200 requests per day
    this.rateLimits.set('scopus', new RateLimit(300, 86400)); // 300 requests per day
  }

  /**
   * Search academic databases
   */
  async search(content: string, language: string): Promise<AcademicSearchResult[]> {
    const results: AcademicSearchResult[] = [];
    const keyPhrases = this.extractAcademicPhrases(content);

    try {
      for (const phrase of keyPhrases) {
        for (const [dbName, database] of this.databases) {
          if (this.rateLimits.get(dbName)?.canMakeRequest()) {
            try {
              const searchResults = await database.search(phrase, {
                maxResults: 20,
                language,
                includeAbstracts: true
              });

              results.push(...searchResults);
              this.rateLimits.get(dbName)?.recordRequest();
            } catch (error) {
              logger.warn(`Academic database ${dbName} failed for phrase: ${phrase}`, error);
            }
          }
        }
      }

      // Remove duplicates and sort by relevance
      const uniqueResults = this.removeDuplicates(results);
      return uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    } catch (error) {
      logger.error('Error in academic database scanning:', error);
      return [];
    }
  }

  /**
   * Extract academic phrases from content
   */
  private extractAcademicPhrases(content: string): string[] {
    // Extract longer, more academic phrases
    const sentences = content.split(/[.!?]+/);
    const phrases: string[] = [];
    
    sentences.forEach(sentence => {
      const words = sentence.trim().split(/\s+/);
      // Look for sentences with academic characteristics
      if (words.length >= 8 && words.length <= 20) {
        const hasAcademicTerms = /\b(theorem|hypothesis|methodology|analysis|research|study|experiment|conclusion|abstract|introduction)\b/i.test(sentence);
        if (hasAcademicTerms) {
          phrases.push(sentence.trim());
        }
      }
    });

    return phrases.slice(0, 10); // Return top 10 academic phrases
  }

  /**
   * Remove duplicate academic results
   */
  private removeDuplicates(results: AcademicSearchResult[]): AcademicSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.doi || result.title + result.authors.join(',');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

// Rate limiting utility
class RateLimit {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;

  constructor(maxRequests: number, timeWindow: number) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }
}

// Search engine interfaces
interface SearchEngine {
  search(query: string, options: SearchOptions): Promise<WebSearchResult[]>;
}

interface AcademicDatabase {
  search(query: string, options: AcademicSearchOptions): Promise<AcademicSearchResult[]>;
}

interface SearchOptions {
  maxResults: number;
  language?: string;
  excludedDomains?: string[];
}

interface AcademicSearchOptions {
  maxResults: number;
  language: string;
  includeAbstracts: boolean;
}

// Mock search engine implementations
class GoogleSearchEngine implements SearchEngine {
  async search(query: string, options: SearchOptions): Promise<WebSearchResult[]> {
    // Mock implementation - would use Google Custom Search API
    return [
      {
        id: 'google1',
        title: 'Sample search result',
        url: 'https://example.com/result1',
        content: 'This is sample content from Google search',
        snippet: 'Sample snippet',
        relevanceScore: 0.8
      }
    ];
  }
}

class BingSearchEngine implements SearchEngine {
  async search(query: string, options: SearchOptions): Promise<WebSearchResult[]> {
    // Mock implementation - would use Bing Search API
    return [
      {
        id: 'bing1',
        title: 'Sample Bing result',
        url: 'https://example.com/bing1',
        content: 'This is sample content from Bing search',
        snippet: 'Sample Bing snippet',
        relevanceScore: 0.7
      }
    ];
  }
}

class DuckDuckGoSearchEngine implements SearchEngine {
  async search(query: string, options: SearchOptions): Promise<WebSearchResult[]> {
    // Mock implementation - would use DuckDuckGo API
    return [
      {
        id: 'ddg1',
        title: 'Sample DuckDuckGo result',
        url: 'https://example.com/ddg1',
        content: 'This is sample content from DuckDuckGo search',
        snippet: 'Sample DuckDuckGo snippet',
        relevanceScore: 0.6
      }
    ];
  }
}

// Mock academic database implementations
class PubMedDatabase implements AcademicDatabase {
  async search(query: string, options: AcademicSearchOptions): Promise<AcademicSearchResult[]> {
    // Mock implementation - would use NCBI E-utilities API
    return [
      {
        id: 'pubmed1',
        title: 'Sample PubMed Article',
        authors: ['John Doe', 'Jane Smith'],
        abstract: 'This is a sample abstract from PubMed',
        content: 'Full content of the PubMed article',
        journal: 'Journal of Examples',
        publicationDate: new Date('2023-01-15'),
        doi: '10.1234/example.2023.1',
        database: 'PubMed',
        relevanceScore: 0.9
      }
    ];
  }
}

class ArxivDatabase implements AcademicDatabase {
  async search(query: string, options: AcademicSearchOptions): Promise<AcademicSearchResult[]> {
    // Mock implementation - would use arXiv API
    return [
      {
        id: 'arxiv1',
        title: 'Sample arXiv Paper',
        authors: ['Alice Johnson', 'Bob Wilson'],
        abstract: 'This is a sample abstract from arXiv',
        content: 'Full content of the arXiv paper',
        publicationDate: new Date('2023-02-20'),
        database: 'arXiv',
        relevanceScore: 0.85
      }
    ];
  }
}

class GoogleScholarDatabase implements AcademicDatabase {
  async search(query: string, options: AcademicSearchOptions): Promise<AcademicSearchResult[]> {
    // Mock implementation - would use Google Scholar API
    return [
      {
        id: 'gs1',
        title: 'Sample Google Scholar Article',
        authors: ['Dr. Example'],
        abstract: 'This is a sample abstract from Google Scholar',
        content: 'Full content of the Google Scholar article',
        publicationDate: new Date('2023-03-10'),
        database: 'Google Scholar',
        relevanceScore: 0.8
      }
    ];
  }
}

class JSTORDatabase implements AcademicDatabase {
  async search(query: string, options: AcademicSearchOptions): Promise<AcademicSearchResult[]> {
    // Mock implementation - would use JSTOR API
    return [
      {
        id: 'jstor1',
        title: 'Sample JSTOR Article',
        authors: ['Prof. Academic'],
        abstract: 'This is a sample abstract from JSTOR',
        content: 'Full content of the JSTOR article',
        journal: 'Journal of Academic Studies',
        publicationDate: new Date('2023-01-05'),
        database: 'JSTOR',
        relevanceScore: 0.75
      }
    ];
  }
}

class ScopusDatabase implements AcademicDatabase {
  async search(query: string, options: AcademicSearchOptions): Promise<AcademicSearchResult[]> {
    // Mock implementation - would use Scopus API
    return [
      {
        id: 'scopus1',
        title: 'Sample Scopus Article',
        authors: ['Researcher Name'],
        abstract: 'This is a sample abstract from Scopus',
        content: 'Full content of the Scopus article',
        journal: 'International Journal of Research',
        publicationDate: new Date('2023-02-15'),
        doi: '10.5678/scopus.2023.1',
        database: 'Scopus',
        relevanceScore: 0.88
      }
    ];
  }
}
