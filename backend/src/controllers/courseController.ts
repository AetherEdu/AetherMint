/**
 * Course Controller
 * Handles HTTP endpoints for course discovery, search, and recommendations
 */

import { Request, Response, NextFunction, Router } from "express";
import { validationResult, query, body } from "express-validator";
import searchService from "../services/searchService";
import recommendationService from "../services/recommendationService";
import { auditService } from "../services/auditService";
import { AuditAction } from "../models/AuditLog";
import {
  Course,
  SearchFilter,
  RecommendationContext,
  CourseCategory,
} from "../models/Course";
import logger from "../utils/logger";
import { ValidationError } from "../utils/errors";

export const router: Router = Router();

/**
 * Middleware for error handling
 */
const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ValidationError("Validation failed", errors.array()));
  }
  next();
};

/**
 * POST /api/courses/search
 * Search courses with query and filters
 *
 * @param {string} query - Search query string
 * @param {object} filters - Filter object (optional)
 * @param {string} sessionId - Session ID for analytics
 * @returns {SearchResult} Paginated course results
 *
 * @example
 * POST /api/courses/search
 * {
 *   "query": "JavaScript",
 *   "filters": {
 *     "category": "programming",
 *     "level": "beginner",
 *     "priceRange": { "min": 0, "max": 100 },
 *     "sortBy": "rating",
 *     "page": 1,
 *     "limit": 10
 *   },
 *   "sessionId": "sess_123456"
 * }
 */
router.post(
  "/search",
  [
    body("query").isString().trim().notEmpty().withMessage("Query is required"),
    body("sessionId")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Session ID is required"),
    body("filters.page").optional().isInt({ min: 1 }),
    body("filters.limit").optional().isInt({ min: 1, max: 50 }),
    body("filters.priceRange.min").optional().isNumeric(),
    body("filters.priceRange.max").optional().isNumeric(),
    body("filters.rating").optional().isFloat({ min: 0, max: 5 }),
    body("filters.sortBy")
      .optional()
      .isIn([
        "relevance",
        "rating",
        "price-low",
        "price-high",
        "newest",
        "popular",
      ]),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { query: searchQuery, filters = {}, sessionId } = req.body;
      const userId = req.user?.id; // Assuming auth middleware sets req.user

      logger.info(`Search request - Query: ${searchQuery}, User: ${userId}`);

      const result = await searchService.searchCourses(
        searchQuery,
        filters as SearchFilter,
        sessionId,
        userId,
      );

      return res.status(200).json({
        success: true,
        message: "Search completed successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Search error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * GET /api/courses/suggestions
 * Get search suggestions based on partial query
 *
 * @param {string} q - Partial query string
 * @param {number} limit - Number of suggestions (default: 5, max: 10)
 * @returns {string[]} Array of suggestions
 *
 * @example
 * GET /api/courses/suggestions?q=java&limit=5
 */
router.get(
  "/suggestions",
  [
    query("q").isString().trim().notEmpty().withMessage("Query is required"),
    query("limit").optional().isInt({ min: 1, max: 10 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { q: searchQuery, limit = 5 } = req.query;

      logger.info(`Suggestions request - Query: ${searchQuery}`);

      const suggestions = await searchService.getSearchSuggestions(
        searchQuery as string,
        parseInt(limit as string),
      );

      return res.status(200).json({
        success: true,
        message: "Suggestions retrieved successfully",
        data: suggestions,
      });
    } catch (error) {
      logger.error("Suggestions error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * GET /api/courses/trending
 * Get trending courses
 *
 * @param {number} limit - Number of courses (default: 10, max: 50)
 * @returns {Course[]} Array of trending courses
 *
 * @example
 * GET /api/courses/trending?limit=10
 */
router.get(
  "/trending",
  [query("limit").optional().isInt({ min: 1, max: 50 })],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || "10");

      logger.info(`Trending courses request - Limit: ${limit}`);

      const courses = await recommendationService.getTrendingCourses(limit);

      return res.status(200).json({
        success: true,
        message: "Trending courses retrieved successfully",
        data: courses,
      });
    } catch (error) {
      logger.error("Trending courses error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * POST /api/courses/:courseId/similar
 * Get courses similar to the specified course
 *
 * @param {string} courseId - Course ID
 * @param {number} limit - Number of similar courses (default: 5, max: 20)
 * @returns {Recommendation[]} Array of similar courses with scores
 *
 * @example
 * POST /api/courses/course_123/similar?limit=5
 */
router.get(
  "/:courseId/similar",
  [
    query("courseId").isString().trim(),
    query("limit").optional().isInt({ min: 1, max: 20 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { courseId } = req.params;
      const limit = parseInt((req.query.limit as string) || "5");

      logger.info(
        `Similar courses request - Course: ${courseId}, Limit: ${limit}`,
      );

      const similar = await recommendationService.getSimilarCourses(
        courseId,
        limit,
      );

      return res.status(200).json({
        success: true,
        message: "Similar courses retrieved successfully",
        data: similar,
      });
    } catch (error) {
      logger.error("Similar courses error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * POST /api/courses/recommendations
 * Get personalized course recommendations for the user
 *
 * @body {RecommendationContext} - User context for recommendations
 * @param {number} limit - Number of recommendations (default: 10, max: 30)
 * @returns {RecommendationResult} Personalized recommendations
 *
 * @example
 * POST /api/courses/recommendations?limit=10
 * {
 *   "userId": "user_123",
 *   "enrolledCourseIds": ["course_1", "course_2"],
 *   "browsedCourseIds": ["course_3", "course_4"],
 *   "preferredCategories": ["programming", "web-dev"],
 *   "preferredLevels": ["beginner", "intermediate"],
 *   "ratings": [
 *     { "courseId": "course_1", "rating": 5 },
 *     { "courseId": "course_2", "rating": 4 }
 *   ]
 * }
 */
router.post(
  "/recommendations",
  [
    body("userId")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("User ID is required"),
    body("enrolledCourseIds").optional().isArray(),
    body("browsedCourseIds").optional().isArray(),
    body("preferredCategories").optional().isArray(),
    body("preferredLevels").optional().isArray(),
    body("ratings").optional().isArray(),
    query("limit").optional().isInt({ min: 1, max: 30 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const context = req.body as RecommendationContext;
      const limit = parseInt((req.query.limit as string) || "10");

      logger.info(
        `Recommendations request - User: ${context.userId}, Limit: ${limit}`,
      );

      const result = await recommendationService.getRecommendations(
        context,
        limit,
      );

      return res.status(200).json({
        success: true,
        message: "Recommendations generated successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Recommendations error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * POST /api/courses/activity
 * Record user activity for analytics and personalization
 *
 * @body {object} Activity data
 * @returns {object} Success response
 *
 * @example
 * POST /api/courses/activity
 * {
 *   "userId": "user_123",
 *   "activityType": "view",
 *   "courseId": "course_456",
 *   "data": { "rating": 5 }
 * }
 */
router.post(
  "/activity",
  [
    body("userId")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("User ID is required"),
    body("activityType")
      .isIn(["view", "enroll", "rate", "complete"])
      .withMessage("Invalid activity type"),
    body("courseId")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Course ID is required"),
    body("data").optional().isObject(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { userId, activityType, courseId, data } = req.body;

      logger.info(
        `Activity recorded - User: ${userId}, Type: ${activityType}, Course: ${courseId}`,
      );

      await recommendationService.recordUserActivity(
        userId,
        activityType,
        courseId,
        data,
      );

      return res.status(201).json({
        success: true,
        message: "Activity recorded successfully",
      });
    } catch (error) {
      logger.error("Activity recording error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * GET /api/courses/categories
 * Get all course categories
 *
 * @returns {CourseCategory[]} Array of categories
 *
 * @example
 * GET /api/courses/categories
 */
router.get("/categories", async (req: Request, res: Response) => {
  try {
    logger.info("Categories request");

    const categories = await searchService.getCategories();      return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
    });
  } catch (error) {
      logger.error("Categories error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/**
 * GET /api/courses/categories/tree
 * Get category hierarchy tree
 *
 * @returns {CourseCategory[]} Root categories with hierarchy
 *
 * @example
 * GET /api/courses/categories/tree
 */
router.get("/categories/tree", async (req: Request, res: Response) => {
  try {
    logger.info("Category tree request");

    const categories = await searchService.getCategoryTree();      return res.status(200).json({
      success: true,
      message: "Category tree retrieved successfully",
      data: categories,
    });
  } catch (error) {
      logger.error("Category tree error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

/**
 * POST /api/courses/categories
 * Create a new category (Admin only)
 *
 * @body {CourseCategory} Category data
 * @returns {CourseCategory} Created category
 *
 * @example
 * POST /api/courses/categories
 * {
 *   "id": "cat_123",
 *   "name": "Web Development",
 *   "description": "Learn web development",
 *   "parentCategory": "programming"
 * }
 */
router.post(
  "/categories",
  [
    body("id")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Category ID is required"),
    body("name").isString().trim().notEmpty().withMessage("Name is required"),
    body("description")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
    body("parentCategory").optional().isString(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const category: CourseCategory = req.body;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      logger.info(`Category creation request - ID: ${category.id}`);

      const created = await searchService.upsertCategory(category);

      await auditService.create(
        actor,
        AuditAction.COURSE_CREATE,
        'course_category',
        {
          resourceId: category.id,
          details: { operation: 'create_category', name: category.name },
          ipAddress,
        }
      );

      return res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: created,
      });
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.COURSE_CREATE,
        'course_category',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        }
      );
      logger.error("Category creation error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * PUT /api/courses/categories/:categoryId
 * Update a category (Admin only)
 *
 * @param {string} categoryId - Category ID
 * @body {CourseCategory} Updated category data
 * @returns {CourseCategory} Updated category
 *
 * @example
 * PUT /api/courses/categories/cat_123
 * {
 *   "id": "cat_123",
 *   "name": "Web Development",
 *   "description": "Updated description",
 *   "parentCategory": "programming"
 * }
 */
router.put(
  "/categories/:categoryId",
  [
    body("id").isString().trim(),
    body("name").isString().trim().notEmpty(),
    body("description").isString().trim().notEmpty(),
    body("parentCategory").optional().isString(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const category: CourseCategory = req.body;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      logger.info(`Category update request - ID: ${category.id}`);

      const updated = await searchService.upsertCategory(category);

      await auditService.create(
        actor,
        AuditAction.COURSE_UPDATE,
        'course_category',
        {
          resourceId: category.id,
          details: { operation: 'update_category', name: category.name },
          ipAddress,
        }
      );

      return res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: updated,
      });
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.COURSE_UPDATE,
        'course_category',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        }
      );
      logger.error("Category update error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * DELETE /api/courses/categories/:categoryId
 * Delete a category (Admin only)
 *
 * @param {string} categoryId - Category ID
 * @returns {object} Success response
 *
 * @example
 * DELETE /api/courses/categories/cat_123
 */
router.delete(
  "/categories/:categoryId",
  async (req: Request, res: Response) => {
    try {
      const { categoryId } = req.params;
      const actor = req.user?.address || 'anonymous';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      logger.info(`Category deletion request - ID: ${categoryId}`);

      await searchService.deleteCategory(categoryId);

      await auditService.create(
        actor,
        AuditAction.COURSE_DELETE,
        'course_category',
        {
          resourceId: categoryId,
          details: { operation: 'delete_category' },
          ipAddress,
        }
      );

      return res.status(200).json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      await auditService.createFailure(
        req.user?.address || 'anonymous',
        AuditAction.COURSE_DELETE,
        'course_category',
        {
          ipAddress,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        }
      );
      logger.error("Category deletion error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * GET /api/courses/analytics/popular-searches
 * Get popular search queries (Admin only)
 *
 * @param {number} limit - Number of results (default: 10, max: 50)
 * @returns {object[]} Array of popular searches
 *
 * @example
 * GET /api/courses/analytics/popular-searches?limit=10
 */
router.get(
  "/analytics/popular-searches",
  [query("limit").optional().isInt({ min: 1, max: 50 })],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || "10");

      logger.info(`Popular searches request - Limit: ${limit}`);

      const popular = await searchService.getPopularSearches(limit);

      return res.status(200).json({
        success: true,
        message: "Popular searches retrieved successfully",
        data: popular,
      });
    } catch (error) {
      logger.error("Popular searches error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  },
);

/**
 * GET /api/courses/analytics/search/:query
 * Get analytics for a specific search query (Admin only)
 *
 * @param {string} query - Search query
 * @returns {SearchAnalytics[]} Analytics records
 *
 * @example
 * GET /api/courses/analytics/search/javascript
 */
router.get("/analytics/search/:query", async (req: Request, res: Response) => {
  try {
    const { query } = req.params;

    logger.info(`Search analytics request - Query: ${query}`);

    const analytics = await searchService.getSearchAnalytics(query);      return res.status(200).json({
      success: true,
      message: "Search analytics retrieved successfully",
      data: analytics,
    });
  } catch (error) {
      logger.error("Search analytics error", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

export default router;
