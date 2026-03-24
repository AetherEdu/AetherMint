/**
 * Plagiarism Detection Controller
 * Handles HTTP requests for plagiarism detection operations
 */

import { Request, Response } from 'express';
import { PlagiarismDetectionService } from '../services/plagiarismDetectionService';
import { PlagiarismDetectionRequest, PlagiarismSettings, PlagiarismType } from '../models/PlagiarismDetection';
import logger from '../utils/logger';

export class PlagiarismDetectionController {
  private plagiarismService: PlagiarismDetectionService;

  constructor() {
    this.plagiarismService = new PlagiarismDetectionService();
  }

  /**
   * Analyze submission for plagiarism
   */
  async analyzeSubmission(req: Request, res: Response): Promise<void> {
    try {
      const {
        submissionId,
        content,
        contentType,
        language,
        codeLanguage,
        sensitivity,
        includeWebScanning,
        includeAcademicDatabase,
        includeInternalComparison
      } = req.body;

      // Validate request
      if (!submissionId || !content || !contentType) {
        res.status(400).json({
          error: 'Missing required fields: submissionId, content, contentType'
        });
        return;
      }

      if (!Object.values(PlagiarismType).includes(contentType)) {
        res.status(400).json({
          error: 'Invalid contentType. Must be text, code, or mixed'
        });
        return;
      }

      // Get settings (would typically come from database based on institution)
      const settings: PlagiarismSettings = {
        id: 'default',
        sensitivityLevel: sensitivity || 'medium',
        minimumSimilarityThreshold: 15,
        enableWebScanning: includeWebScanning !== false,
        enableAcademicDatabase: includeAcademicDatabase !== false,
        enableInternalComparison: includeInternalComparison !== false,
        enableParaphrasingDetection: true,
        enableTranslationDetection: false,
        excludedDomains: [],
        trustedSources: [],
        autoFlagThreshold: 25,
        reviewRequiredThreshold: 40,
        updatedAt: new Date(),
        updatedBy: req.user?.id || 'system'
      };

      const request: PlagiarismDetectionRequest = {
        submissionId,
        content,
        contentType,
        language,
        codeLanguage,
        sensitivity,
        includeWebScanning,
        includeAcademicDatabase,
        includeInternalComparison
      };

      const result = await this.plagiarismService.analyzeSubmission(request, settings);

      logger.info(`Plagiarism analysis completed for submission ${submissionId}`);

      res.json({
        success: true,
        data: result,
        message: 'Plagiarism analysis completed successfully'
      });

    } catch (error) {
      logger.error('Error in plagiarism analysis:', error);
      res.status(500).json({
        error: 'Internal server error during plagiarism analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get plagiarism report by ID
   */
  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        res.status(400).json({
          error: 'Report ID is required'
        });
        return;
      }

      // This would typically fetch from database
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          id: reportId,
          status: 'completed',
          message: 'Report retrieval not yet implemented'
        }
      });

    } catch (error) {
      logger.error('Error retrieving plagiarism report:', error);
      res.status(500).json({
        error: 'Internal server error while retrieving report'
      });
    }
  }

  /**
   * Get plagiarism settings
   */
  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      // This would typically fetch from database based on institution
      const settings: PlagiarismSettings = {
        id: 'default',
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
        updatedBy: 'system'
      };

      res.json({
        success: true,
        data: settings
      });

    } catch (error) {
      logger.error('Error retrieving plagiarism settings:', error);
      res.status(500).json({
        error: 'Internal server error while retrieving settings'
      });
    }
  }

  /**
   * Update plagiarism settings
   */
  async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const settingsData = req.body;

      // Validate settings
      const validSensitivityLevels = ['low', 'medium', 'high'];
      if (settingsData.sensitivityLevel && !validSensitivityLevels.includes(settingsData.sensitivityLevel)) {
        res.status(400).json({
          error: 'Invalid sensitivity level. Must be low, medium, or high'
        });
        return;
      }

      if (settingsData.minimumSimilarityThreshold && (settingsData.minimumSimilarityThreshold < 0 || settingsData.minimumSimilarityThreshold > 100)) {
        res.status(400).json({
          error: 'Minimum similarity threshold must be between 0 and 100'
        });
        return;
      }

      // This would typically update in database
      const updatedSettings: PlagiarismSettings = {
        id: settingsData.id || 'default',
        sensitivityLevel: settingsData.sensitivityLevel || 'medium',
        minimumSimilarityThreshold: settingsData.minimumSimilarityThreshold || 15,
        enableWebScanning: settingsData.enableWebScanning !== false,
        enableAcademicDatabase: settingsData.enableAcademicDatabase !== false,
        enableInternalComparison: settingsData.enableInternalComparison !== false,
        enableParaphrasingDetection: settingsData.enableParaphrasingDetection !== false,
        enableTranslationDetection: settingsData.enableTranslationDetection || false,
        excludedDomains: settingsData.excludedDomains || [],
        trustedSources: settingsData.trustedSources || [],
        autoFlagThreshold: settingsData.autoFlagThreshold || 25,
        reviewRequiredThreshold: settingsData.reviewRequiredThreshold || 40,
        updatedAt: new Date(),
        updatedBy: req.user?.id || 'system'
      };

      logger.info(`Plagiarism settings updated by user ${req.user?.id}`);

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Settings updated successfully'
      });

    } catch (error) {
      logger.error('Error updating plagiarism settings:', error);
      res.status(500).json({
        error: 'Internal server error while updating settings'
      });
    }
  }

  /**
   * Batch analyze submissions
   */
  async batchAnalyze(req: Request, res: Response): Promise<void> {
    try {
      const { submissions, settings } = req.body;

      if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
        res.status(400).json({
          error: 'Submissions array is required and must not be empty'
        });
        return;
      }

      if (submissions.length > 50) {
        res.status(400).json({
          error: 'Cannot process more than 50 submissions in a single batch'
        });
        return;
      }

      // Process submissions in parallel (with reasonable limits)
      const batchSize = 5;
      const results = [];

      for (let i = 0; i < submissions.length; i += batchSize) {
        const batch = submissions.slice(i, i + batchSize);
        const batchPromises = batch.map(async (submission) => {
          try {
            const request: PlagiarismDetectionRequest = {
              submissionId: submission.submissionId,
              content: submission.content,
              contentType: submission.contentType,
              language: submission.language,
              codeLanguage: submission.codeLanguage,
              sensitivity: submission.sensitivity || settings?.sensitivityLevel,
              includeWebScanning: submission.includeWebScanning !== false,
              includeAcademicDatabase: submission.includeAcademicDatabase !== false,
              includeInternalComparison: submission.includeInternalComparison !== false
            };

            const plagiarismSettings: PlagiarismSettings = {
              id: 'default',
              sensitivityLevel: settings?.sensitivityLevel || 'medium',
              minimumSimilarityThreshold: settings?.minimumSimilarityThreshold || 15,
              enableWebScanning: settings?.enableWebScanning !== false,
              enableAcademicDatabase: settings?.enableAcademicDatabase !== false,
              enableInternalComparison: settings?.enableInternalComparison !== false,
              enableParaphrasingDetection: settings?.enableParaphrasingDetection !== false,
              enableTranslationDetection: settings?.enableTranslationDetection || false,
              excludedDomains: settings?.excludedDomains || [],
              trustedSources: settings?.trustedSources || [],
              autoFlagThreshold: settings?.autoFlagThreshold || 25,
              reviewRequiredThreshold: settings?.reviewRequiredThreshold || 40,
              updatedAt: new Date(),
              updatedBy: req.user?.id || 'system'
            };

            return await this.plagiarismService.analyzeSubmission(request, plagiarismSettings);
          } catch (error) {
            logger.error(`Error analyzing submission ${submission.submissionId}:`, error);
            return {
              submissionId: submission.submissionId,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      logger.info(`Batch plagiarism analysis completed for ${submissions.length} submissions`);

      res.json({
        success: true,
        data: {
          processed: submissions.length,
          results,
          summary: {
            successful: results.filter(r => !('error' in r)).length,
            failed: results.filter(r => 'error' in r).length
          }
        },
        message: 'Batch analysis completed successfully'
      });

    } catch (error) {
      logger.error('Error in batch plagiarism analysis:', error);
      res.status(500).json({
        error: 'Internal server error during batch analysis'
      });
    }
  }

  /**
   * Get plagiarism analytics
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, institutionId } = req.query;

      // This would typically fetch from database
      const analytics = {
        totalSubmissions: 1250,
        flaggedSubmissions: 187,
        averageSimilarity: 23.5,
        detectionMethods: {
          text_similarity: 145,
          code_similarity: 23,
          web_scanning: 98,
          academic_database: 67,
          paraphrasing: 34,
          translation: 12,
          patchwriting: 8
        },
        contentTypeStats: {
          text: 890,
          code: 210,
          mixed: 150
        },
        falsePositiveRate: 8.2,
        averageProcessingTime: 12.3,
        appealStats: {
          total: 23,
          approved: 15,
          rejected: 8
        }
      };

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Error retrieving plagiarism analytics:', error);
      res.status(500).json({
        error: 'Internal server error while retrieving analytics'
      });
    }
  }

  /**
   * Handle plagiarism appeal
   */
  async submitAppeal(req: Request, res: Response): Promise<void> {
    try {
      const { reportId, reason, explanation, evidence } = req.body;

      if (!reportId || !reason || !explanation) {
        res.status(400).json({
          error: 'Missing required fields: reportId, reason, explanation'
        });
        return;
      }

      // This would typically save to database
      const appeal = {
        id: generateUUID(),
        reportId,
        userId: req.user?.id,
        reason,
        explanation,
        evidence: evidence || [],
        status: 'pending',
        createdAt: new Date()
      };

      logger.info(`Plagiarism appeal submitted for report ${reportId} by user ${req.user?.id}`);

      res.json({
        success: true,
        data: appeal,
        message: 'Appeal submitted successfully'
      });

    } catch (error) {
      logger.error('Error submitting plagiarism appeal:', error);
      res.status(500).json({
        error: 'Internal server error while submitting appeal'
      });
    }
  }
}

// Helper function for UUID generation
function generateUUID(): string {
  const crypto = require('crypto');
  return crypto.randomUUID();
}
