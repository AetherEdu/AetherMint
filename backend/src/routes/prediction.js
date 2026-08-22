const express = require("express");
const router = express.Router();
const predictionController = require("../controllers/predictionController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// Public student routes (authenticated)
router.get("/student/:studentId", predictionController.getStudentAnalytics);
router.post("/predict-performance", predictionController.getBatchPredictions); // Mapping to expected frontend route

// Admin/Instructor only routes
router.use(authorize("admin", "instructor"));

router.post("/students/batch/predict", predictionController.getBatchPredictions);
router.post("/at-risk/identify", predictionController.getAtRiskStudents);
router.get("/models/accuracy", predictionController.getAccuracyMetrics);
router.post("/students/:studentId/interventions", (req, res) => {
  res.json({ success: true, message: 'Intervention scheduled' });
});

router.get("/health", predictionController.healthCheck);

module.exports = router;
