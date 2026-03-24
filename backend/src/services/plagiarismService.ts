/**
 * Plagiarism Detection Service
 * Handles plagiarism detection and similarity analysis
 */

import { 
  PlagiarismReport, 
  PlagiarismSource, 
  Submission 
} from '../models/Assignment';
import { v4 as uuidv4 } from 'uuid';

export interface PlagiarismCheckConfig {
  enabledSources: string[];
  sensitivity: 'low' | 'medium' | 'high';
  excludeQuotes: boolean;
  excludeCitations: boolean;
  minSimilarity: number; // Minimum similarity percentage to flag
}

export interface PlagiarismResult {
  submissionId: string;
  overallScore: number;
  sources: PlagiarismSource[];
  processingTime: number;
  timestamp: Date;
}

export class PlagiarismService {
  private defaultConfig: PlagiarismCheckConfig = {
    enabledSources: ['internet', 'academic', 'student_submissions'],
    sensitivity: 'medium',
    excludeQuotes: true,
    excludeCitations: true,
    minSimilarity: 0.3 // 30% similarity threshold
  };

  async checkPlagiarism(
    submissionId: string,
    config?: Partial<PlagiarismCheckConfig>
  ): Promise<PlagiarismReport> {
    const checkConfig = { ...this.defaultConfig, ...config };
    
    const report: PlagiarismReport = {
      id: uuidv4(),
      overallScore: 0,
      sources: [],
      generatedAt: new Date(),
      status: 'pending'
    };

    try {
      // In a real implementation, this would:
      // 1. Extract text from submission (files, text content, etc.)
      // 2. Send to plagiarism detection API (like Turnitin, Copyscape, etc.)
      // 3. Parse and analyze results
      // 4. Generate comprehensive report

      const startTime = Date.now();
      const result = await this.performPlagiarismCheck(submissionId, checkConfig);
      const processingTime = Date.now() - startTime;

      report.overallScore = result.overallScore;
      report.sources = result.sources;
      report.status = 'completed';

      console.log(`Plagiarism check completed for submission ${submissionId} in ${processingTime}ms`);
      
    } catch (error) {
      console.error('Plagiarism check failed:', error);
      report.status = 'failed';
    }

    return report;
  }

  async batchCheckPlagiarism(
    submissionIds: string[],
    config?: Partial<PlagiarismCheckConfig>
  ): Promise<Map<string, PlagiarismReport>> {
    const results = new Map<string, PlagiarismReport>();
    
    // Process submissions in parallel with rate limiting
    const batchSize = 5; // Process 5 submissions at a time
    
    for (let i = 0; i < submissionIds.length; i += batchSize) {
      const batch = submissionIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (submissionId) => {
        try {
          const report = await this.checkPlagiarism(submissionId, config);
          results.set(submissionId, report);
        } catch (error) {
          console.error(`Failed to check plagiarism for submission ${submissionId}:`, error);
          results.set(submissionId, {
            id: uuidv4(),
            overallScore: 0,
            sources: [],
            generatedAt: new Date(),
            status: 'failed'
          });
        }
      });

      await Promise.all(batchPromises);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < submissionIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async getPlagiarismReport(reportId: string): Promise<PlagiarismReport | null> {
    // In a real implementation, this would fetch from database
    // For now, return mock data
    return null;
  }

  async analyzeSimilarity(
    text1: string,
    text2: string,
    options: {
      ignoreCase?: boolean;
      ignoreWhitespace?: boolean;
      ignorePunctuation?: boolean;
    } = {}
  ): Promise<{
    similarityScore: number;
    matchingSegments: Array<{
      text: string;
      startIndex: number;
      endIndex: number;
    }>;
  }> {
    const {
      ignoreCase = true,
      ignoreWhitespace = true,
      ignorePunctuation = true
    } = options;

    // Preprocess texts
    let processedText1 = text1;
    let processedText2 = text2;

    if (ignoreCase) {
      processedText1 = processedText1.toLowerCase();
      processedText2 = processedText2.toLowerCase();
    }

    if (ignoreWhitespace) {
      processedText1 = processedText1.replace(/\s+/g, ' ').trim();
      processedText2 = processedText2.replace(/\s+/g, ' ').trim();
    }

    if (ignorePunctuation) {
      processedText1 = processedText1.replace(/[^\w\s]/g, '');
      processedText2 = processedText2.replace(/[^\w\s]/g, '');
    }

    // Simple similarity calculation using n-grams
    const ngramSize = 3;
    const ngrams1 = this.getNgrams(processedText1, ngramSize);
    const ngrams2 = this.getNgrams(processedText2, ngramSize);

    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    const similarityScore = union.size > 0 ? intersection.size / union.size : 0;

    // Find matching segments (simplified)
    const matchingSegments = this.findMatchingSegments(text1, text2);

    return {
      similarityScore,
      matchingSegments
    };
  }

  async extractTextFromSubmission(submission: Submission): Promise<string> {
    let extractedText = '';

    // Extract from text content
    if (submission.textContent) {
      extractedText += submission.textContent + '\n\n';
    }

    // Extract from code submission
    if (submission.codeSubmission) {
      extractedText += `// Code (${submission.codeSubmission.language})\n`;
      extractedText += submission.codeSubmission.code + '\n\n';
    }

    // Extract from files (in a real implementation, this would use OCR for images, text extraction for PDFs, etc.)
    if (submission.files && submission.files.length > 0) {
      for (const file of submission.files) {
        if (file.type.startsWith('text/')) {
          // For text files, we could extract content
          extractedText += `// File: ${file.name}\n`;
          // extractedText += await this.extractTextFromFile(file) + '\n\n';
        }
      }
    }

    return extractedText.trim();
  }

  async getPlagiarismStatistics(
    assignmentId: string
  ): Promise<{
    totalSubmissions: number;
    flaggedSubmissions: number;
    averageSimilarity: number;
    highRiskSubmissions: number;
    similarityDistribution: {
      low: number; // 0-30%
      medium: number; // 31-60%
      high: number; // 61-100%
    };
  }> {
    // In a real implementation, this would query the database
    // For now, return mock statistics
    return {
      totalSubmissions: 0,
      flaggedSubmissions: 0,
      averageSimilarity: 0,
      highRiskSubmissions: 0,
      similarityDistribution: {
        low: 0,
        medium: 0,
        high: 0
      }
    };
  }

  private async performPlagiarismCheck(
    submissionId: string,
    config: PlagiarismCheckConfig
  ): Promise<PlagiarismResult> {
    // Mock implementation - in reality, this would call external APIs
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate mock sources based on sensitivity
    const mockSources: PlagiarismSource[] = [];
    
    if (config.sensitivity === 'high') {
      mockSources.push({
        id: uuidv4(),
        url: 'https://example.com/source1',
        title: 'Academic Paper on Similar Topic',
        similarityScore: 0.75,
        matchedText: 'This is a sample matched text segment...'
      });
    }

    if (config.sensitivity === 'medium') {
      mockSources.push({
        id: uuidv4(),
        url: 'https://example.com/source2',
        title: 'Online Article',
        similarityScore: 0.45,
        matchedText: 'Another matched text segment...'
      });
    }

    const overallScore = mockSources.length > 0 
      ? Math.max(...mockSources.map(s => s.similarityScore))
      : 0;

    return {
      submissionId,
      overallScore,
      sources: mockSources,
      processingTime: 2000,
      timestamp: new Date()
    };
  }

  private getNgrams(text: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    
    for (let i = 0; i <= text.length - n; i++) {
      const ngram = text.substring(i, i + n);
      ngrams.add(ngram);
    }
    
    return ngrams;
  }

  private findMatchingSegments(
    text1: string,
    text2: string,
    minLength: number = 10
  ): Array<{
    text: string;
    startIndex: number;
    endIndex: number;
  }> {
    const matchingSegments: Array<{
      text: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    // Simple implementation - find exact matches of minimum length
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);

    for (let i = 0; i <= words1.length - minLength; i++) {
      const segment = words1.slice(i, i + minLength).join(' ');
      
      const index = text2.indexOf(segment);
      if (index !== -1) {
        matchingSegments.push({
          text: segment,
          startIndex: i,
          endIndex: i + minLength
        });
      }
    }

    return matchingSegments;
  }

  async generatePlagiarismReportPDF(reportId: string): Promise<Buffer> {
    // In a real implementation, this would generate a PDF report
    // For now, return a mock buffer
    return Buffer.from('Mock plagiarism report PDF content');
  }

  async flagSuspiciousSubmission(
    submissionId: string,
    reason: string,
    flaggedBy: string
  ): Promise<void> {
    // In a real implementation, this would update the submission status
    // and notify administrators
    console.log(`Submission ${submissionId} flagged for review: ${reason}`);
  }

  async reviewPlagiarismFlag(
    submissionId: string,
    approved: boolean,
    reviewedBy: string,
    comments?: string
  ): Promise<void> {
    // In a real implementation, this would update the review status
    console.log(`Plagiarism flag for submission ${submissionId} ${approved ? 'approved' : 'rejected'} by ${reviewedBy}`);
  }
}

export default new PlagiarismService();
