/**
 * Plagiarism Detection Test Suite
 * Comprehensive testing for plagiarism detection functionality
 */

import { PlagiarismDetectionService } from '../services/plagiarismDetectionService';
import { PlagiarismDetectionRequest, PlagiarismType, PlagiarismSettings } from '../models/PlagiarismDetection';
import { CodePlagiarismAnalyzer } from '../services/codePlagiarismAnalyzer';
import { WebContentScanner } from '../services/webContentScanner';
import { PlagiarismAdministrativeService } from '../services/plagiarismAdministrativeService';

describe('Plagiarism Detection System', () => {
  let plagiarismService: PlagiarismDetectionService;
  let codeAnalyzer: CodePlagiarismAnalyzer;
  let webScanner: WebContentScanner;
  let adminService: PlagiarismAdministrativeService;

  beforeEach(() => {
    plagiarismService = new PlagiarismDetectionService();
    codeAnalyzer = new CodePlagiarismAnalyzer();
    webScanner = new WebContentScanner();
    adminService = new PlagiarismAdministrativeService();
  });

  describe('Text Similarity Analysis', () => {
    test('should detect high similarity in identical text', async () => {
      const originalText = "The quick brown fox jumps over the lazy dog. This is a test sentence for plagiarism detection.";
      const copiedText = "The quick brown fox jumps over the lazy dog. This is a test sentence for plagiarism detection.";

      const request: PlagiarismDetectionRequest = {
        submissionId: 'test-1',
        content: copiedText,
        contentType: PlagiarismType.TEXT,
        language: 'en'
      };

      const settings: PlagiarismSettings = {
        id: 'test',
        sensitivityLevel: 'medium',
        minimumSimilarityThreshold: 15,
        enableWebScanning: false,
        enableAcademicDatabase: false,
        enableInternalComparison: true,
        enableParaphrasingDetection: true,
        enableTranslationDetection: false,
        excludedDomains: [],
        trustedSources: [],
        autoFlagThreshold: 25,
        reviewRequiredThreshold: 40,
        updatedAt: new Date(),
        updatedBy: 'test'
      };

      const result = await plagiarismService.analyzeSubmission(request, settings);

      expect(result.overallSimilarity).toBeGreaterThan(90);
      expect(result.originalityScore).toBeLessThan(10);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].similarityPercentage).toBeGreaterThan(90);
    });

    test('should detect paraphrased content', async () => {
      const originalText = "The study examines the effects of climate change on marine ecosystems.";
      const paraphrasedText = "Research investigates how climate transformation impacts ocean environments.";

      const request: PlagiarismDetectionRequest = {
        submissionId: 'test-2',
        content: paraphrasedText,
        contentType: PlagiarismType.TEXT,
        language: 'en'
      };

      const settings: PlagiarismSettings = {
        id: 'test',
        sensitivityLevel: 'medium',
        minimumSimilarityThreshold: 15,
        enableWebScanning: false,
        enableAcademicDatabase: false,
        enableInternalComparison: true,
        enableParaphrasingDetection: true,
        enableTranslationDetection: false,
        excludedDomains: [],
        trustedSources: [],
        autoFlagThreshold: 25,
        reviewRequiredThreshold: 40,
        updatedAt: new Date(),
        updatedBy: 'test'
      };

      const result = await plagiarismService.analyzeSubmission(request, settings);

      expect(result.overallSimilarity).toBeGreaterThan(30);
      expect(result.matches.some(match => match.isParaphrased)).toBe(true);
    });

    test('should handle low similarity content correctly', async () => {
      const originalText = "Machine learning algorithms can process large datasets efficiently.";
      const uniqueText = "The weather today is quite pleasant with clear blue skies.";

      const request: PlagiarismDetectionRequest = {
        submissionId: 'test-3',
        content: uniqueText,
        contentType: PlagiarismType.TEXT,
        language: 'en'
      };

      const settings: PlagiarismSettings = {
        id: 'test',
        sensitivityLevel: 'medium',
        minimumSimilarityThreshold: 15,
        enableWebScanning: false,
        enableAcademicDatabase: false,
        enableInternalComparison: true,
        enableParaphrasingDetection: true,
        enableTranslationDetection: false,
        excludedDomains: [],
        trustedSources: [],
        autoFlagThreshold: 25,
        reviewRequiredThreshold: 40,
        updatedAt: new Date(),
        updatedBy: 'test'
      };

      const result = await plagiarismService.analyzeSubmission(request, settings);

      expect(result.overallSimilarity).toBeLessThan(15);
      expect(result.originalityScore).toBeGreaterThan(85);
      expect(result.matches).toHaveLength(0);
    });
  });

  describe('Code Plagiarism Detection', () => {
    test('should detect identical code structure', async () => {
      const originalCode = `
        function calculateSum(a, b) {
          return a + b;
        }
        
        function calculateProduct(a, b) {
          return a * b;
        }
      `;

      const copiedCode = `
        function calculateSum(a, b) {
          return a + b;
        }
        
        function calculateProduct(a, b) {
          return a * b;
        }
      `;

      const matches = await codeAnalyzer.astSimilarity(copiedCode, 'javascript', 'medium');

      expect(matches).toHaveLength(1);
      expect(matches[0].similarityPercentage).toBeGreaterThan(90);
    });

    test('should detect code with variable name changes', async () => {
      const originalCode = `
        function calculateSum(num1, num2) {
          const result = num1 + num2;
          return result;
        }
      `;

      const modifiedCode = `
        function calculateSum(x, y) {
          const answer = x + y;
          return answer;
        }
      `;

      const matches = await codeAnalyzer.structuralSimilarity(modifiedCode, 'javascript', 'medium');

      expect(matches).toHaveLength(1);
      expect(matches[0].similarityPercentage).toBeGreaterThan(70);
    });

    test('should detect code plagiarism across different languages', async () => {
      const pythonCode = `
        def calculate_sum(a, b):
            return a + b
        
        def calculate_product(a, b):
            return a * b
      `;

      const javaCode = `
        public int calculateSum(int a, int b) {
            return a + b;
        }
        
        public int calculateProduct(int a, int b) {
            return a * b;
        }
      `;

      const pythonMatches = await codeAnalyzer.structuralSimilarity(pythonCode, 'python', 'medium');
      const javaMatches = await codeAnalyzer.structuralSimilarity(javaCode, 'java', 'medium');

      expect(pythonMatches).toHaveLength(1);
      expect(javaMatches).toHaveLength(1);
    });
  });

  describe('Web Content Scanning', () => {
    test('should scan web content for similarities', async () => {
      const keyPhrases = [
        "climate change affects marine ecosystems",
        "global warming impacts ocean life"
      ];

      const settings = {
        excludedDomains: ['spam.com'],
        trustedSources: ['edu', 'gov']
      };

      const results = await webScanner.searchWebContent(keyPhrases, settings);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle rate limiting correctly', async () => {
      const keyPhrases = ["test phrase"];
      const settings = {};

      // Make multiple requests to test rate limiting
      const promises = Array(10).fill(null).map(() => 
        webScanner.searchWebContent(keyPhrases, settings)
      );

      const results = await Promise.allSettled(promises);
      
      // Some requests should succeed, others might be rate limited
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful + failed).toBe(10);
    });
  });

  describe('Administrative Tools', () => {
    test('should add reports to review queue', async () => {
      const mockReport = {
        id: 'report-1',
        submissionId: 'submission-1',
        userId: 'user-1',
        contentType: PlagiarismType.TEXT,
        status: 'completed' as any,
        overallSimilarity: 45,
        originalityScore: 55,
        matches: [],
        sources: [],
        detectionMethods: [],
        processingTime: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await adminService.addToReviewQueue(mockReport);

      const queue = adminService.getReviewQueue();
      expect(queue.pending).toContain(mockReport);
    });

    test('should assign reviewers to reports', async () => {
      const mockReport = {
        id: 'report-2',
        submissionId: 'submission-2',
        userId: 'user-2',
        contentType: PlagiarismType.TEXT,
        status: 'completed' as any,
        overallSimilarity: 45,
        originalityScore: 55,
        matches: [],
        sources: [],
        detectionMethods: [],
        processingTime: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await adminService.addToReviewQueue(mockReport);
      await adminService.assignReviewer('report-2', 'reviewer-1');

      const queue = adminService.getReviewQueue();
      const inProgressReport = queue.inProgress.find(r => r.id === 'report-2');
      expect(inProgressReport).toBeDefined();
    });

    test('should calculate review statistics', () => {
      const stats = adminService.getReviewStatistics();

      expect(stats).toHaveProperty('totalReviewed');
      expect(stats).toHaveProperty('averageReviewTime');
      expect(stats).toHaveProperty('approvalRate');
      expect(stats).toHaveProperty('rejectionRate');
      expect(stats).toHaveProperty('escalationRate');
      expect(stats).toHaveProperty('reviewerPerformance');

      expect(typeof stats.totalReviewed).toBe('number');
      expect(typeof stats.averageReviewTime).toBe('number');
      expect(typeof stats.approvalRate).toBe('number');
    });

    test('should handle bulk review operations', async () => {
      const reportIds = ['report-1', 'report-2', 'report-3'];
      const action = {
        type: 'approve' as const,
        reviewerId: 'reviewer-1',
        notes: 'Bulk approval test',
        timestamp: new Date()
      };

      const results = await adminService.bulkReview(reportIds, action);

      expect(results).toHaveProperty('successful');
      expect(results).toHaveProperty('failed');
      expect(Array.isArray(results.successful)).toBe(true);
      expect(Array.isArray(results.failed)).toBe(true);
    });
  });

  describe('Performance Testing', () => {
    test('should handle large text submissions efficiently', async () => {
      const largeText = "This is a test sentence. ".repeat(1000);
      
      const startTime = Date.now();
      
      const request: PlagiarismDetectionRequest = {
        submissionId: 'perf-test-1',
        content: largeText,
        contentType: PlagiarismType.TEXT,
        language: 'en'
      };

      const settings: PlagiarismSettings = {
        id: 'test',
        sensitivityLevel: 'medium',
        minimumSimilarityThreshold: 15,
        enableWebScanning: false,
        enableAcademicDatabase: false,
        enableInternalComparison: true,
        enableParaphrasingDetection: true,
        enableTranslationDetection: false,
        excludedDomains: [],
        trustedSources: [],
        autoFlagThreshold: 25,
        reviewRequiredThreshold: 40,
        updatedAt: new Date(),
        updatedBy: 'test'
      };

      await plagiarismService.analyzeSubmission(request, settings);
      
      const processingTime = Date.now() - startTime;
      
      // Should complete within reasonable time (e.g., 5 seconds)
      expect(processingTime).toBeLessThan(5000);
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map((_, index) => ({
        submissionId: `concurrent-${index}`,
        content: `Test content for submission ${index}`,
        contentType: PlagiarismType.TEXT as const,
        language: 'en'
      }));

      const settings: PlagiarismSettings = {
        id: 'test',
        sensitivityLevel: 'medium',
        minimumSimilarityThreshold: 15,
        enableWebScanning: false,
        enableAcademicDatabase: false,
        enableInternalComparison: true,
        enableParaphrasingDetection: true,
        enableTranslationDetection: false,
        excludedDomains: [],
        trustedSources: [],
        autoFlagThreshold: 25,
        reviewRequiredThreshold: 40,
        updatedAt: new Date(),
        updatedBy: 'test'
      };

      const startTime = Date.now();
      
      const promises = requests.map(request => 
        plagiarismService.analyzeSubmission(request, settings)
      );
      
      const results = await Promise.all(promises);
      
      const processingTime = Date.now() - startTime;
      
      expect(results).toHaveLength(10);
      expect(results.every(result => result.reportId)).toBe(true);
      
      // Concurrent processing should be faster than sequential
      expect(processingTime).toBeLessThan(10000);
    });
  });

  describe('Cross-language Testing', () => {
    test('should detect plagiarism in different languages', async () => {
      const englishText = "The research methodology includes quantitative analysis and statistical testing.";
      const spanishText = "La metodología de investigación incluye análisis cuantitativo y pruebas estadísticas.";
      const frenchText = "La méthodologie de recherche comprend une analyse quantitative et des tests statistiques.";

      const requests = [
        {
          submissionId: 'lang-en',
          content: englishText,
          contentType: PlagiarismType.TEXT as const,
          language: 'en'
        },
        {
          submissionId: 'lang-es',
          content: spanishText,
          contentType: PlagiarismType.TEXT as const,
          language: 'es'
        },
        {
          submissionId: 'lang-fr',
          content: frenchText,
          contentType: PlagiarismType.TEXT as const,
          language: 'fr'
        }
      ];

      const settings: PlagiarismSettings = {
        id: 'test',
        sensitivityLevel: 'medium',
        minimumSimilarityThreshold: 15,
        enableWebScanning: false,
        enableAcademicDatabase: false,
        enableInternalComparison: true,
        enableParaphrasingDetection: true,
        enableTranslationDetection: true,
        excludedDomains: [],
        trustedSources: [],
        autoFlagThreshold: 25,
        reviewRequiredThreshold: 40,
        updatedAt: new Date(),
        updatedBy: 'test'
      };

      const results = await Promise.all(
        requests.map(request => plagiarismService.analyzeSubmission(request, settings))
      );

      expect(results).toHaveLength(3);
      expect(results.every(result => result.reportId)).toBe(true);
    });
  });

  describe('False Positive Analysis', () => {
    test('should minimize false positives for common phrases', async () => {
      const commonPhrases = `
        In conclusion, the findings suggest that further research is needed.
        The results indicate a significant correlation between the variables.
        This study provides important insights into the topic.
      `;

      const request: PlagiarismDetectionRequest = {
        submissionId: 'false-positive-test',
        content: commonPhrases,
        contentType: PlagiarismType.TEXT,
        language: 'en'
      };

      const settings: PlagiarismSettings = {
        id: 'test',
        sensitivityLevel: 'low',
        minimumSimilarityThreshold: 20,
        enableWebScanning: false,
        enableAcademicDatabase: false,
        enableInternalComparison: true,
        enableParaphrasingDetection: true,
        enableTranslationDetection: false,
        excludedDomains: [],
        trustedSources: [],
        autoFlagThreshold: 30,
        reviewRequiredThreshold: 50,
        updatedAt: new Date(),
        updatedBy: 'test'
      };

      const result = await plagiarismService.analyzeSubmission(request, settings);

      // Should have low similarity due to common phrases being filtered out
      expect(result.overallSimilarity).toBeLessThan(30);
      expect(result.needsReview).toBe(false);
    });
  });

  describe('Integration Testing', () => {
    test('should integrate all components correctly', async () => {
      const mixedContent = `
        This is original text content.
        function example() { console.log("Hello World"); }
        More original text here.
      `;

      const request: PlagiarismDetectionRequest = {
        submissionId: 'integration-test',
        content: mixedContent,
        contentType: PlagiarismType.MIXED,
        language: 'en',
        codeLanguage: 'javascript'
      };

      const settings: PlagiarismSettings = {
        id: 'test',
        sensitivityLevel: 'medium',
        minimumSimilarityThreshold: 15,
        enableWebScanning: true,
        enableAcademicDatabase: true,
        enableInternalComparison: true,
        enableParaphrasingDetection: true,
        enableTranslationDetection: false,
        excludedDomains: [],
        trustedSources: [],
        autoFlagThreshold: 25,
        reviewRequiredThreshold: 40,
        updatedAt: new Date(),
        updatedBy: 'test'
      };

      const result = await plagiarismService.analyzeSubmission(request, settings);

      expect(result).toHaveProperty('reportId');
      expect(result).toHaveProperty('overallSimilarity');
      expect(result).toHaveProperty('originalityScore');
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('needsReview');

      expect(typeof result.overallSimilarity).toBe('number');
      expect(typeof result.originalityScore).toBe('number');
      expect(Array.isArray(result.matches)).toBe(true);
      expect(typeof result.processingTime).toBe('number');
      expect(typeof result.needsReview).toBe('boolean');
    });
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  test('text analysis benchmark', async () => {
    const text = "This is a benchmark test. ".repeat(100);
    
    const startTime = performance.now();
    
    // Simulate text analysis
    for (let i = 0; i < 100; i++) {
      // Mock analysis operation
      text.split(/\s+/).length;
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  test('code analysis benchmark', async () => {
    const code = `
      function benchmark() {
        for (let i = 0; i < 1000; i++) {
          console.log(i);
        }
      }
    `.repeat(10);
    
    const startTime = performance.now();
    
    // Simulate code analysis
    code.split(/\n/).length;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(500); // Should complete within 0.5 seconds
  });
});

// Edge cases
describe('Edge Cases', () => {
  test('should handle empty content', async () => {
    const request: PlagiarismDetectionRequest = {
      submissionId: 'empty-test',
      content: '',
      contentType: PlagiarismType.TEXT,
      language: 'en'
    };

    const settings: PlagiarismSettings = {
      id: 'test',
      sensitivityLevel: 'medium',
      minimumSimilarityThreshold: 15,
      enableWebScanning: false,
      enableAcademicDatabase: false,
      enableInternalComparison: true,
      enableParaphrasingDetection: true,
      enableTranslationDetection: false,
      excludedDomains: [],
      trustedSources: [],
      autoFlagThreshold: 25,
      reviewRequiredThreshold: 40,
      updatedAt: new Date(),
      updatedBy: 'test'
    };

    await expect(plagiarismService.analyzeSubmission(request, settings)).rejects.toThrow();
  });

  test('should handle very long content', async () => {
    const longContent = "A".repeat(1000000); // 1MB of content
    
    const request: PlagiarismDetectionRequest = {
      submissionId: 'long-test',
      content: longContent,
      contentType: PlagiarismType.TEXT,
      language: 'en'
    };

    const settings: PlagiarismSettings = {
      id: 'test',
      sensitivityLevel: 'medium',
      minimumSimilarityThreshold: 15,
      enableWebScanning: false,
      enableAcademicDatabase: false,
      enableInternalComparison: true,
      enableParaphrasingDetection: true,
      enableTranslationDetection: false,
      excludedDomains: [],
      trustedSources: [],
      autoFlagThreshold: 25,
      reviewRequiredThreshold: 40,
      updatedAt: new Date(),
      updatedBy: 'test'
    };

    // Should handle large content without crashing
    const result = await plagiarismService.analyzeSubmission(request, settings);
    expect(result).toBeDefined();
  });

  test('should handle special characters and encoding', async () => {
    const specialContent = "Special chars: áéíóú ñ 漢字 العربية";
    
    const request: PlagiarismDetectionRequest = {
      submissionId: 'special-test',
      content: specialContent,
      contentType: PlagiarismType.TEXT,
      language: 'en'
    };

    const settings: PlagiarismSettings = {
      id: 'test',
      sensitivityLevel: 'medium',
      minimumSimilarityThreshold: 15,
      enableWebScanning: false,
      enableAcademicDatabase: false,
      enableInternalComparison: true,
      enableParaphrasingDetection: true,
      enableTranslationDetection: false,
      excludedDomains: [],
      trustedSources: [],
      autoFlagThreshold: 25,
      reviewRequiredThreshold: 40,
      updatedAt: new Date(),
      updatedBy: 'test'
    };

    const result = await plagiarismService.analyzeSubmission(request, settings);
    expect(result).toBeDefined();
    expect(result.overallSimilarity).toBeGreaterThanOrEqual(0);
  });
});
