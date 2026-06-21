const express = require('express');
const router = express.Router();
const PredictionController = require('../controllers/predictionController');

// Initialize controller
const predictionController = new PredictionController();

// Middleware for validation
const validateStudentData = (req, res, next) => {
  const { studentData } = req.body;
  
  if (!studentData || typeof studentData !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Valid student data object is required'
    });
  }
  
  next();
};

const validateBatchData = (req, res, next) => {
  const { students } = req.body;
  
  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid students array is required'
    });
  }
  
  if (students.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 100 students allowed per batch request'
    });
  }
  
  next();
};

// Prediction routes
router.post('/students/:studentId/predict', 
  validateStudentData,
  predictionController.predictStudentOutcomes.bind(predictionController)
);

router.post('/batch/predict',
  validateBatchData,
  predictionController.predictBatchOutcomes.bind(predictionController)
);

// At-risk student identification
router.post('/at-risk/identify',
  validateBatchData,
  predictionController.identifyAtRiskStudents.bind(predictionController)
);

// Intervention recommendations
router.post('/students/:studentId/interventions',
  predictionController.generateInterventions.bind(predictionController)
);

router.put('/students/:studentId/interventions/:interventionId/status',
  predictionController.updateInterventionStatus.bind(predictionController)
);

router.get('/students/:studentId/interventions/effectiveness',
  predictionController.getInterventionEffectiveness.bind(predictionController)
);

// Learning path optimization
router.post('/students/:studentId/learning-path/optimize',
  predictionController.optimizeLearningPath.bind(predictionController)
);

// Model management
router.get('/models/accuracy',
  predictionController.getModelAccuracy.bind(predictionController)
);

router.post('/models/train',
  predictionController.trainModels.bind(predictionController)
);

// Comprehensive analytics
router.post('/students/:studentId/analytics',
  validateStudentData,
  predictionController.getStudentAnalytics.bind(predictionController)
);

// Health check
router.get('/health',
  predictionController.healthCheck.bind(predictionController)
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Prediction route error:', error);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error in prediction service',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;
