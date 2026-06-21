const express = require('express');
const router = express.Router();
const { getOverviewStats, getDetailedReport, exportData } = require('../controllers/analyticsController');

// Analytics Data Routes
router.get('/overview', getOverviewStats);
router.get('/report', getDetailedReport);
router.get('/export', exportData);

module.exports = router;
