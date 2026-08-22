const LearningOutcomePredictionEngine = require('../ml/predictionEngine');
const AtRiskStudentIdentification = require('../ml/atRiskIdentification');
const InterventionRecommendationEngine = require('../ml/interventionEngine');
const LearningPathOptimizer = require('../ml/learningPathOptimizer');

class PredictionController {
  constructor() {
    this.predictionEngine = new LearningOutcomePredictionEngine();
    this.atRiskIdentifier = new AtRiskStudentIdentification();
    this.interventionEngine = new InterventionRecommendationEngine();
    this.pathOptimizer = new LearningPathOptimizer();
    this.isInitialized = false;
  }

  async initialize() {
    if (!this.isInitialized) {
      await this.predictionEngine.initializeModels();
      await this.atRiskIdentifier.initialize();
      this.isInitialized = true;
    }
  }

  // Predict learning outcomes for a single student
  async predictStudentOutcomes(req, res) {
    try {
      await this.initialize();
      
      const { studentId } = req.params;
      const studentData = req.body;

      if (!studentData || !studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID and data are required'
        });
      }

      // Add student ID to data
      studentData.id = studentId;

      const predictions = await this.predictionEngine.predictStudentOutcomes(studentData);

      res.json({
        success: true,
        data: {
          studentId,
          predictions,
          timestamp: new Date().toISOString(),
          modelAccuracy: this.predictionEngine.getModelAccuracy()
        }
      });

    } catch (error) {
      console.error('Error predicting student outcomes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate predictions',
        error: error.message
      });
    }
  }

  // Predict outcomes for multiple students
  async predictBatchOutcomes(req, res) {
    try {
      await this.initialize();
      
      const { students } = req.body;

      if (!students || !Array.isArray(students) || students.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Students array is required'
        });
      }

      const results = [];
      
      for (const student of students) {
        try {
          const predictions = await this.predictionEngine.predictStudentOutcomes(student);
          results.push({
            studentId: student.id,
            success: true,
            predictions
          });
        } catch (error) {
          results.push({
            studentId: student.id,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: students.length,
            successful: successCount,
            failed: students.length - successCount,
            successRate: (successCount / students.length * 100).toFixed(2) + '%'
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error in batch prediction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate batch predictions',
        error: error.message
      });
    }
  }

  // Identify at-risk students
  async identifyAtRiskStudents(req, res) {
    try {
      await this.initialize();
      
      const { timeWindow = 'short' } = req.query;
      const { students } = req.body;

      if (!students || !Array.isArray(students) || students.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Students array is required'
        });
      }

      const atRiskStudents = await this.atRiskIdentifier.identifyAtRiskStudents(students, timeWindow);

      res.json({
        success: true,
        data: {
          atRiskStudents,
          summary: {
            totalStudents: students.length,
            atRiskCount: atRiskStudents.length,
            atRiskPercentage: ((atRiskStudents.length / students.length) * 100).toFixed(2) + '%',
            timeWindow
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error identifying at-risk students:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to identify at-risk students',
        error: error.message
      });
    }
  }

  // Generate intervention recommendations
  async generateInterventions(req, res) {
    try {
      await this.initialize();
      
      const { studentId } = req.params;
      const { riskProfile, availableResources } = req.body;

      if (!studentId || !riskProfile) {
        return res.status(400).json({
          success: false,
          message: 'Student ID and risk profile are required'
        });
      }

      riskProfile.studentId = studentId;

      const interventions = await this.interventionEngine.generateInterventions(
        riskProfile,
        availableResources
      );

      res.json({
        success: true,
        data: {
          ...interventions,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error generating interventions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate intervention recommendations',
        error: error.message
      });
    }
  }

  // Optimize learning path
  async optimizeLearningPath(req, res) {
    try {
      await this.initialize();
      
      const { studentId } = req.params;
      const { studentProfile, courseContent, performanceData } = req.body;

      if (!studentId || !studentProfile || !courseContent) {
        return res.status(400).json({
          success: false,
          message: 'Student ID, profile, and course content are required'
        });
      }

      studentProfile.id = studentId;

      const optimizedPath = await this.pathOptimizer.optimizeLearningPath(
        studentProfile,
        courseContent,
        performanceData
      );

      res.json({
        success: true,
        data: {
          ...optimizedPath,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error optimizing learning path:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to optimize learning path',
        error: error.message
      });
    }
  }

  // Update intervention status
  async updateInterventionStatus(req, res) {
    try {
      const { studentId, interventionId } = req.params;
      const { status, outcome } = req.body;

      if (!studentId || !interventionId || !status) {
        return res.status(400).json({
          success: false,
          message: 'Student ID, intervention ID, and status are required'
        });
      }

      this.interventionEngine.updateInterventionStatus(studentId, interventionId, status, outcome);

      res.json({
        success: true,
        message: 'Intervention status updated successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error updating intervention status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update intervention status',
        error: error.message
      });
    }
  }

  // Get model accuracy metrics
  async getModelAccuracy(req, res) {
    try {
      await this.initialize();
      
      const accuracy = this.predictionEngine.getModelAccuracy();

      res.json({
        success: true,
        data: {
          accuracy,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error getting model accuracy:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get model accuracy',
        error: error.message
      });
    }
  }

  // Train models with new data
  async trainModels(req, res) {
    try {
      await this.initialize();
      
      const { trainingData } = req.body;

      if (!trainingData || !Array.isArray(trainingData) || trainingData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Training data array is required'
        });
      }

      const trainingResults = await this.predictionEngine.trainModels(trainingData);

      res.json({
        success: true,
        data: {
          trainingResults,
          modelAccuracy: this.predictionEngine.getModelAccuracy(),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error training models:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to train models',
        error: error.message
      });
    }
  }

  // Get intervention effectiveness
  async getInterventionEffectiveness(req, res) {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      const effectiveness = this.interventionEngine.getInterventionEffectiveness(studentId);

      res.json({
        success: true,
        data: {
          studentId,
          effectiveness,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error getting intervention effectiveness:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get intervention effectiveness',
        error: error.message
      });
    }
  }

  // Get comprehensive student analytics
  async getStudentAnalytics(req, res) {
    try {
      await this.initialize();
      
      const { studentId } = req.params;
      const { studentData, courseContent, performanceData } = req.body;

      if (!studentId || !studentData) {
        return res.status(400).json({
          success: false,
          message: 'Student ID and data are required'
        });
      }

      studentData.id = studentId;

      // Get all analytics in parallel
      const [predictions, riskAssessment, optimizedPath] = await Promise.all([
        this.predictionEngine.predictStudentOutcomes(studentData),
        this.atRiskIdentifier.assessStudentRisk(studentData, 14), // 2-week window
        courseContent ? 
          this.pathOptimizer.optimizeLearningPath(studentData, courseContent, performanceData) : 
          null
      ]);

      // Generate interventions if at risk
      let interventions = null;
      if (riskAssessment.isAtRisk) {
        interventions = await this.interventionEngine.generateInterventions(riskAssessment);
      }

      const analytics = {
        studentId,
        predictions,
        riskAssessment,
        optimizedPath,
        interventions,
        summary: {
          riskLevel: riskAssessment.riskAssessment.level,
          completionProbability: (predictions.completion * 100).toFixed(1) + '%',
          performancePrediction: (predictions.performance * 100).toFixed(1) + '%',
          needsIntervention: riskAssessment.isAtRisk,
          confidence: (predictions.confidence * 100).toFixed(1) + '%'
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error getting student analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get student analytics',
        error: error.message
      });
    }
  }

  // Health check for ML services
  async healthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        services: {
          predictionEngine: this.predictionEngine ? 'initialized' : 'not initialized',
          atRiskIdentifier: this.atRiskIdentifier ? 'initialized' : 'not initialized',
          interventionEngine: this.interventionEngine ? 'available' : 'not available',
          pathOptimizer: this.pathOptimizer ? 'available' : 'not available'
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: error.message
      });
    }
  }

  // New methods for Dashboard
  async getBatchPredictions(req, res) {
    // Mock for now to support frontend
    res.json({
      success: true,
      data: {
        results: [
          {
            studentId: 'S101',
            predictions: { completion: 0.85, performance: 0.9, dropout: 0.05, engagement: 0.95, confidence: 0.92 },
            riskAssessment: { level: 'low', factors: [] }
          },
          {
            studentId: 'S102',
            predictions: { completion: 0.45, performance: 0.5, dropout: 0.6, engagement: 0.3, confidence: 0.85 },
            riskAssessment: { level: 'high', factors: ['Low engagement', 'Missed assignments'] }
          }
        ]
      }
    });
  }

  async getAtRiskStudents(req, res) {
    res.json({
      success: true,
      data: {
        atRiskStudents: [
          {
            studentId: 'S102',
            daysUntilPotentialDropout: 5,
            interventionUrgency: { level: 'High' }
          },
          {
            studentId: 'S105',
            daysUntilPotentialDropout: 12,
            interventionUrgency: { level: 'Medium' }
          }
        ]
      }
    });
  }

  async getAccuracyMetrics(req, res) {
    res.json({
      success: true,
      data: {
        completion: { currentAccuracy: 0.92, trend: 'improving' },
        performance: { currentAccuracy: 0.88, trend: 'stable' },
        dropout: { currentAccuracy: 0.95, trend: 'improving' },
        lastTrainingDate: new Date().toISOString()
      }
    });
  }
}

const controller = new PredictionController();
// Bind all methods to the instance
const proto = PredictionController.prototype;
for (const key of Object.getOwnPropertyNames(proto)) {
  if (key !== 'constructor' && typeof proto[key] === 'function') {
    controller[key] = controller[key].bind(controller);
  }
}

module.exports = controller;

