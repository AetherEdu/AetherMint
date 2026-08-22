/**
 * @openapi
 * tags:
 *   - name: Search
 *     description: Platform search functionality
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const searchController = require("../controllers/searchController");

/**
 * @openapi
 * /api/search:
 *   get:
 *     tags: [Search]
 *     summary: Search across platform
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Content type filter
 *     responses:
 *       '200':
 *         description: Search results
 */
router.get("/", authenticate, searchController.search);

/**
 * @openapi
 * /api/search/autocomplete:
 *   get:
 *     tags: [Search]
 *     summary: Autocomplete search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search prefix
 *     responses:
 *       '200':
 *         description: Autocomplete suggestions
 */
router.get("/autocomplete", authenticate, searchController.autocomplete);

/**
 * @openapi
 * /api/search/advanced:
 *   post:
 *     tags: [Search]
 *     summary: Advanced search with filters
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Advanced search results
 */
router.post("/advanced", authenticate, searchController.advancedSearch);

/**
 * @openapi
 * /api/search/trending:
 *   get:
 *     tags: [Search]
 *     summary: Get trending searches
 *     responses:
 *       '200':
 *         description: Trending searches
 */
router.get("/trending", searchController.getTrending);

/**
 * @openapi
 * /api/search/suggestions:
 *   get:
 *     tags: [Search]
 *     summary: Get search suggestions
 *     responses:
 *       '200':
 *         description: Suggestions retrieved
 */
router.get("/suggestions", searchController.getSuggestions);

/**
 * @openapi
 * /api/search/history:
 *   get:
 *     tags: [Search]
 *     summary: Get search history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Search history
 */
router.get("/history", authenticate, searchController.getSearchHistory);

/**
 * @openapi
 * /api/search/history:
 *   delete:
 *     tags: [Search]
 *     summary: Clear search history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Search history cleared
 */
router.delete("/history", authenticate, searchController.clearSearchHistory);

module.exports = router;
