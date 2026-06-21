/**
 * Fraud Detection API Routes
 * RESTful endpoints for fraud detection and prevention system
 */

const express = require('express');
const FraudDetectionService = require('../services/fraudDetectionService');
const AdvancedPlagiarismDetector = require('../services/advancedPlagiarismDetector');
const CredentialFraudDetector = require('../services/credentialFraudDetector');
const RealTimeAnomalyDetector = require('../services/realTimeAnomalyDetector');
const AutomatedInvestigationService = require('../services/automatedInvestigationService');

const router = express.Router();

// Middleware for request validation
const validateRequest = (req, res, next) => {
    try {
        if (!req.body && req.method !== 'GET') {
            return res.status(400).json({ error: 'Request body is required' });
        }
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid request format' });
    }
};

/**
 * @route GET /api/v1/fraud-detection/health
 * @desc Check fraud detection system health
 * @access Private
 */
router.get('/health', async (req, res) => {
    try {
        const fraudHealth = await FraudDetectionService.healthCheck();
        const plagiarismHealth = await AdvancedPlagiarismDetector.healthCheck();
        const credentialHealth = await CredentialFraudDetector.healthCheck();
        const anomalyHealth = await RealTimeAnomalyDetector.healthCheck();
        const investigationHealth = await AutomatedInvestigationService.healthCheck();

        const overallHealth = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                fraudDetection: fraudHealth,
                plagiarismDetection: plagiarismHealth,
                credentialDetection: credentialHealth,
                anomalyDetection: anomalyHealth,
                investigationService: investigationHealth
            }
        };

        // Determine overall status
        const serviceStatuses = Object.values(overallHealth.services).map(s => s.status);
        if (serviceStatuses.includes('unhealthy')) {
            overallHealth.status = 'unhealthy';
        } else if (serviceStatuses.includes('degraded')) {
            overallHealth.status = 'degraded';
        }

        res.json({
            success: true,
            data: overallHealth
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/v1/fraud-detection/analyze-submission
 * @desc Analyze submission for plagiarism
 * @access Private
 */
router.post('/analyze-submission', validateRequest, async (req, res) => {
    try {
        const {
            submissionId,
            userId,
            assignmentId,
            content,
            contentType = 'text',
            metadata = {}
        } = req.body;

        if (!submissionId || !userId || !assignmentId || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: submissionId, userId, assignmentId, content'
            });
        }

        const submission = {
            submissionId,
            userId,
            assignmentId,
            content,
            contentType,
            metadata
        };

        const plagiarismReport = await AdvancedPlagiarismDetector.detectPlagiarism(submission);

        res.json({
            success: true,
            data: plagiarismReport
        });

    } catch (error) {
        console.error('Submission analysis error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/v1/fraud-detection/verify-credential
 * @desc Verify credential for fraud detection
 * @access Private
 */
router.post('/verify-credential', validateRequest, async (req, res) => {
    try {
        const {
            credentialId,
            userId,
            credentialType,
            institutionId,
            issueDate,
            expirationDate,
            credentialData,
            verificationCode,
            metadata = {}
        } = req.body;

        if (!credentialId || !userId || !credentialType || !institutionId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: credentialId, userId, credentialType, institutionId'
            });
        }

        const credential = {
            credentialId,
            userId,
            credentialType,
            institutionId,
            issueDate,
            expirationDate,
            credentialData,
            verificationCode,
            metadata
        };

        const verificationReport = await CredentialFraudDetector.verifyCredential(credential);

        res.json({
            success: true,
            data: verificationReport
        });

    } catch (error) {
        console.error('Credential verification error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/v1/fraud-detection/detect-anomaly
 * @desc Detect anomalies in user behavior
 * @access Private
 */
router.post('/detect-anomaly', validateRequest, async (req, res) => {
    try {
        const {
            userId,
            activityType,
            timestamp,
            metadata = {}
        } = req.body;

        if (!userId || !activityType || !timestamp) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, activityType, timestamp'
            });
        }

        const activity = {
            userId,
            activityType,
            timestamp,
            metadata
        };

        // This would trigger real-time anomaly detection
        // For now, return a simulated response
        const anomalyResult = {
            activityId: require('crypto').randomUUID(),
            isAnomalous: false,
            anomalyScore: 0.2,
            confidence: 0.8,
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            data: anomalyResult
        });

    } catch (error) {
        console.error('Anomaly detection error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/v1/fraud-detection/initiate-investigation
 * @desc Initiate automated investigation
 * @access Private
 */
router.post('/initiate-investigation', validateRequest, async (req, res) => {
    try {
        const {
            alertId,
            type,
            userId,
            severity,
            description,
            metadata = {}
        } = req.body;

        if (!alertId || !type || !userId || !severity) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: alertId, type, userId, severity'
            });
        }

        const alert = {
            id: alertId,
            type,
            userId,
            severity,
            description,
            metadata
        };

        const investigation = await AutomatedInvestigationService.initiateInvestigation(alert);

        res.json({
            success: true,
            data: investigation
        });

    } catch (error) {
        console.error('Investigation initiation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/v1/fraud-detection/investigations
 * @desc Get list of investigations
 * @access Private
 */
router.get('/investigations', async (req, res) => {
    try {
        const {
            status,
            type,
            userId,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const investigations = await AutomatedInvestigationService.getInvestigations({
            status,
            type,
            userId,
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder
        });

        res.json({
            success: true,
            data: investigations
        });

    } catch (error) {
        console.error('Get investigations error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/v1/fraud-detection/investigations/:investigationId
 * @desc Get specific investigation details
 * @access Private
 */
router.get('/investigations/:investigationId', async (req, res) => {
    try {
        const { investigationId } = req.params;

        const investigation = await AutomatedInvestigationService.getInvestigation(investigationId);

        if (!investigation) {
            return res.status(404).json({
                success: false,
                error: 'Investigation not found'
            });
        }

        res.json({
            success: true,
            data: investigation
        });

    } catch (error) {
        console.error('Get investigation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/v1/fraud-detection/investigations/:investigationId/evidence
 * @desc Add evidence to investigation
 * @access Private
 */
router.post('/investigations/:investigationId/evidence', validateRequest, async (req, res) => {
    try {
        const { investigationId } = req.params;
        const {
            type,
            description,
            data,
            metadata = {}
        } = req.body;

        if (!type || !description || !data) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, description, data'
            });
        }

        const evidence = {
            investigationId,
            type,
            description,
            data,
            metadata,
            collectedAt: new Date().toISOString(),
            collectedBy: req.user?.id || 'system'
        };

        const result = await AutomatedInvestigationService.addEvidence(investigationId, evidence);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Add evidence error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/v1/fraud-detection/statistics
 * @desc Get fraud detection statistics
 * @access Private
 */
router.get('/statistics', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;

        const [
            fraudStats,
            plagiarismStats,
            credentialStats,
            anomalyStats,
            investigationStats
        ] = await Promise.all([
            FraudDetectionService.getFraudStatistics(timeRange),
            AdvancedPlagiarismDetector.getStatistics(timeRange),
            CredentialFraudDetector.getFraudStatistics(timeRange),
            RealTimeAnomalyDetector.getAnomalyStatistics(timeRange),
            AutomatedInvestigationService.getInvestigationStatistics(timeRange)
        ]);

        const combinedStats = {
            timeRange,
            fraudDetection: fraudStats,
            plagiarismDetection: plagiarismStats,
            credentialDetection: credentialStats,
            anomalyDetection: anomalyStats,
            investigations: investigationStats,
            generatedAt: new Date().toISOString()
        };

        res.json({
            success: true,
            data: combinedStats
        });

    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/v1/fraud-detection/dashboard
 * @desc Get fraud detection dashboard data
 * @access Private
 */
router.get('/dashboard', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;

        const [
            stats,
            recentAlerts,
            activeInvestigations,
            trends
        ] = await Promise.all([
            FraudDetectionService.getFraudStatistics(timeRange),
            FraudDetectionService.getRecentAlerts(10),
            AutomatedInvestigationService.getActiveInvestigations(),
            FraudDetectionService.getTrends(timeRange)
        ]);

        const dashboard = {
            timeRange,
            statistics: stats,
            recentAlerts,
            activeInvestigations,
            trends,
            generatedAt: new Date().toISOString()
        };

        res.json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/v1/fraud-detection/alerts
 * @desc Get fraud alerts
 * @access Private
 */
router.get('/alerts', async (req, res) => {
    try {
        const {
            type,
            severity,
            userId,
            status,
            page = 1,
            limit = 20,
            startDate,
            endDate
        } = req.query;

        const alerts = await FraudDetectionService.getAlerts({
            type,
            severity,
            userId,
            status,
            page: parseInt(page),
            limit: parseInt(limit),
            startDate,
            endDate
        });

        res.json({
            success: true,
            data: alerts
        });

    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/v1/fraud-detection/alerts/:alertId
 * @desc Get specific alert details
 * @access Private
 */
router.get('/alerts/:alertId', async (req, res) => {
    try {
        const { alertId } = req.params;

        const alert = await FraudDetectionService.getAlert(alertId);

        if (!alert) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        res.json({
            success: true,
            data: alert
        });

    } catch (error) {
        console.error('Get alert error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/v1/fraud-detection/alerts/:alertId/resolve
 * @desc Resolve fraud alert
 * @access Private
 */
router.post('/alerts/:alertId/resolve', validateRequest, async (req, res) => {
    try {
        const { alertId } = req.params;
        const {
            resolution,
            notes,
            resolvedBy
        } = req.body;

        if (!resolution) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: resolution'
            });
        }

        const result = await FraudDetectionService.resolveAlert(alertId, {
            resolution,
            notes,
            resolvedBy: resolvedBy || req.user?.id,
            resolvedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Resolve alert error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/v1/fraud-detection/batch-analysis
 * @desc Perform batch analysis of submissions
 * @access Private
 */
router.post('/batch-analysis', validateRequest, async (req, res) => {
    try {
        const { submissions } = req.body;

        if (!submissions || !Array.isArray(submissions)) {
            return res.status(400).json({
                success: false,
                error: 'Submissions array is required'
            });
        }

        if (submissions.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 100 submissions per batch'
            });
        }

        const results = [];
        
        for (const submission of submissions) {
            try {
                const result = await AdvancedPlagiarismDetector.detectPlagiarism(submission);
                results.push({
                    submissionId: submission.submissionId,
                    success: true,
                    result
                });
            } catch (error) {
                results.push({
                    submissionId: submission.submissionId,
                    success: false,
                    error: error.message
                });
            }
        }

        const summary = {
            total: submissions.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            plagiarismDetected: results.filter(r => r.success && r.result.isPlagiarized).length
        };

        res.json({
            success: true,
            data: {
                results,
                summary,
                processedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Batch analysis error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/v1/fraud-detection/reports
 * @desc Get fraud detection reports
 * @access Private
 */
router.get('/reports', async (req, res) => {
    try {
        const {
            type,
            userId,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = req.query;

        const reports = await FraudDetectionService.getReports({
            type,
            userId,
            startDate,
            endDate,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            data: reports
        });

    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/v1/fraud-detection/reports/generate
 * @desc Generate fraud detection report
 * @access Private
 */
router.post('/reports/generate', validateRequest, async (req, res) => {
    try {
        const {
            type,
            parameters,
            format = 'json'
        } = req.body;

        if (!type || !parameters) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, parameters'
            });
        }

        const report = await FraudDetectionService.generateReport(type, parameters, format);

        res.json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/v1/fraud-detection/config
 * @desc Get fraud detection configuration
 * @access Private
 */
router.get('/config', async (req, res) => {
    try {
        const config = await FraudDetectionService.getConfiguration();

        res.json({
            success: true,
            data: config
        });

    } catch (error) {
        console.error('Get config error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route PUT /api/v1/fraud-detection/config
 * @desc Update fraud detection configuration
 * @access Private
 */
router.put('/config', validateRequest, async (req, res) => {
    try {
        const { config } = req.body;

        if (!config) {
            return res.status(400).json({
                success: false,
                error: 'Configuration object is required'
            });
        }

        const result = await FraudDetectionService.updateConfiguration(config);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Update config error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/v1/fraud-detection/test-model
 * @desc Test fraud detection model
 * @access Private
 */
router.post('/test-model', validateRequest, async (req, res) => {
    try {
        const {
            modelType,
            testData,
            parameters = {}
        } = req.body;

        if (!modelType || !testData) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: modelType, testData'
            });
        }

        const testResult = await FraudDetectionService.testModel(modelType, testData, parameters);

        res.json({
            success: true,
            data: testResult
        });

    } catch (error) {
        console.error('Test model error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * @route GET /api/v1/fraud-detection/metrics
 * @desc Get fraud detection metrics
 * @access Private
 */
router.get('/metrics', async (req, res) => {
    try {
        const { timeRange = '1h' } = req.query;

        const metrics = await FraudDetectionService.getMetrics(timeRange);

        res.json({
            success: true,
            data: metrics
        });

    } catch (error) {
        console.error('Get metrics error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
