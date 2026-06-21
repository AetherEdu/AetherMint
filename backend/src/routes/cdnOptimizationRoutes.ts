/**
 * CDN Optimization Routes
 * API endpoints for content delivery optimization
 */

import { Router, RequestHandler } from "express";
import { CDNOptimizationController } from "../controllers/cdnOptimizationController";
import { rateLimit } from "express-rate-limit";
import { body, param, query } from "express-validator";
import { handleValidationErrors } from "../middleware/validation";

const router: Router = Router();
const controller = new CDNOptimizationController();

// Rate limiting for optimization endpoints
const optimizationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many optimization requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for analytics endpoints
const analyticsRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    success: false,
    message: "Too many analytics requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/cdn/optimize
 * Optimize content delivery for a specific piece of content
 */
router.post(
  "/optimize",
  optimizationRateLimit,
  [
    body("contentId")
      .notEmpty()
      .withMessage("Content ID is required")
      .isString()
      .withMessage("Content ID must be a string"),

    body("contentType")
      .notEmpty()
      .withMessage("Content type is required")
      .isString()
      .withMessage("Content type must be a string")
      .isIn(["video", "image", "audio", "document", "other"])
      .withMessage(
        "Content type must be one of: video, image, audio, document, other",
      ),

    body("originalUrl")
      .notEmpty()
      .withMessage("Original URL is required")
      .isURL()
      .withMessage("Original URL must be a valid URL"),

    body("clientInfo.ip")
      .notEmpty()
      .withMessage("Client IP is required")
      .isIP()
      .withMessage("Client IP must be a valid IP address"),

    body("clientInfo.userAgent")
      .notEmpty()
      .withMessage("Client user agent is required")
      .isString()
      .withMessage("Client user agent must be a string"),

    body("clientInfo.connectionType")
      .notEmpty()
      .withMessage("Client connection type is required")
      .isIn(["wifi", "cellular", "ethernet", "unknown"])
      .withMessage(
        "Connection type must be one of: wifi, cellular, ethernet, unknown",
      ),

    body("requestedQuality")
      .optional()
      .isIn(["auto", "360p", "720p", "1080p", "4k"])
      .withMessage(
        "Requested quality must be one of: auto, 360p, 720p, 1080p, 4k",
      ),

    body("optimizationLevel")
      .optional()
      .isIn(["basic", "standard", "aggressive"])
      .withMessage(
        "Optimization level must be one of: basic, standard, aggressive",
      ),

    body("maxLatency")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Max latency must be a positive integer"),

    body("maxCostPerGB")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Max cost per GB must be a positive number"),

    body("preferLowLatency")
      .optional()
      .isBoolean()
      .withMessage("Prefer low latency must be a boolean"),
  ],
  handleValidationErrors,
  controller.optimizeContent.bind(controller) as RequestHandler,
);

/**
 * GET /api/cdn/statistics
 * Get optimization statistics
 */
router.get(
  "/statistics",
  analyticsRateLimit,
  controller.getStatistics.bind(controller),
);

/**
 * GET /api/cdn/history
 * Get optimization history
 */
router.get(
  "/history",
  analyticsRateLimit,
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Limit must be an integer between 1 and 1000"),
  ],
  handleValidationErrors,
  controller.getHistory.bind(controller) as RequestHandler,
);

/**
 * GET /api/cdn/status
 * Get service status
 */
router.get("/status", controller.getStatus.bind(controller));

/**
 * PUT /api/cdn/configuration
 * Update service configuration
 */
router.put(
  "/configuration",
  [
    body().isObject().withMessage("Configuration must be an object"),

    body("enableMultiCDN")
      .optional()
      .isBoolean()
      .withMessage("enableMultiCDN must be a boolean"),

    body("enableAdaptiveBitrate")
      .optional()
      .isBoolean()
      .withMessage("enableAdaptiveBitrate must be a boolean"),

    body("enableIntelligentCompression")
      .optional()
      .isBoolean()
      .withMessage("enableIntelligentCompression must be a boolean"),

    body("enableNetworkDetection")
      .optional()
      .isBoolean()
      .withMessage("enableNetworkDetection must be a boolean"),

    body("enableEdgeComputing")
      .optional()
      .isBoolean()
      .withMessage("enableEdgeComputing must be a boolean"),

    body("enableAnalytics")
      .optional()
      .isBoolean()
      .withMessage("enableAnalytics must be a boolean"),

    body("defaultQuality")
      .optional()
      .isIn(["auto", "360p", "720p", "1080p", "4k"])
      .withMessage(
        "Default quality must be one of: auto, 360p, 720p, 1080p, 4k",
      ),

    body("compressionProfile")
      .optional()
      .isString()
      .withMessage("Compression profile must be a string"),

    body("maxConcurrentOptimizations")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage(
        "Max concurrent optimizations must be an integer between 1 and 1000",
      ),

    body("optimizationTimeout")
      .optional()
      .isInt({ min: 5, max: 300 })
      .withMessage(
        "Optimization timeout must be an integer between 5 and 300 seconds",
      ),
  ],
  handleValidationErrors,
  controller.updateConfiguration.bind(controller) as RequestHandler,
);

/**
 * DELETE /api/cdn/optimizations/:requestId
 * Cancel an active optimization
 */
router.delete(
  "/optimizations/:requestId",
  [
    param("requestId")
      .notEmpty()
      .withMessage("Request ID is required")
      .isString()
      .withMessage("Request ID must be a string"),
  ],
  handleValidationErrors,
  controller.cancelOptimization.bind(controller) as RequestHandler,
);

/**
 * GET /api/cdn/optimizations/active
 * Get active optimizations
 */
router.get(
  "/optimizations/active",
  controller.getActiveOptimizations.bind(controller),
);

/**
 * GET /api/cdn/analytics
 * Get analytics report
 */
router.get(
  "/analytics",
  analyticsRateLimit,
  [
    query("start")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid ISO 8601 date"),

    query("end")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid ISO 8601 date"),
  ],
  handleValidationErrors,
  controller.getAnalyticsReport.bind(controller) as RequestHandler,
);

/**
 * DELETE /api/cdn/history
 * Clear optimization history
 */
router.delete("/history", controller.clearHistory.bind(controller));

/**
 * GET /api/cdn/health
 * Health check endpoint
 */
router.get("/health", controller.healthCheck.bind(controller));

export default router;
