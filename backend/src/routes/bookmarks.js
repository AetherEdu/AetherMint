/**
 * @openapi
 * tags:
 *   - name: Bookmarks
 *     description: Content bookmarking and favorites management
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const bookmarkController = require("../controllers/bookmarkController");

router.use(authenticate);

/**
 * @openapi
 * /api/bookmarks/{userId}:
 *   get:
 *     tags: [Bookmarks]
 *     summary: Get bookmarks for user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Bookmarks retrieved
 */
router.get("/:userId", bookmarkController.getBookmarks);

/**
 * @openapi
 * /api/bookmarks/add:
 *   post:
 *     tags: [Bookmarks]
 *     summary: Add bookmark
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Bookmark added
 */
router.post("/add", bookmarkController.addBookmark);

/**
 * @openapi
 * /api/bookmarks/{bookmarkId}:
 *   delete:
 *     tags: [Bookmarks]
 *     summary: Remove bookmark
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookmarkId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Bookmark removed
 */
router.delete("/:bookmarkId", bookmarkController.removeBookmark);

module.exports = router;
