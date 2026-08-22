/**
 * @openapi
 * tags:
 *   - name: Transactions
 *     description: Transaction history and management
 */

const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const transactionController = require("../controllers/transactionController");

router.use(authenticate, authorize("admin"));

/**
 * @openapi
 * /api/transactions:
 *   get:
 *     tags: [Transactions]
 *     summary: List all transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Transactions listed
 */
router.get("/", transactionController.listTransactions);

/**
 * @openapi
 * /api/transactions/{transactionId}:
 *   get:
 *     tags: [Transactions]
 *     summary: Get transaction details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Transaction details retrieved
 */
router.get("/:transactionId", transactionController.getTransaction);

/**
 * @openapi
 * /api/transactions/{transactionId}/verify:
 *   post:
 *     tags: [Transactions]
 *     summary: Verify transaction
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Transaction verified
 */
router.post("/:transactionId/verify", transactionController.verifyTransaction);

/**
 * @openapi
 * /api/transactions/user/{userId}:
 *   get:
 *     tags: [Transactions]
 *     summary: Get transactions by user
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
 *         description: User transactions retrieved
 */
router.get("/user/:userId", transactionController.getUserTransactions);

/**
 * @openapi
 * /api/transactions/stats:
 *   get:
 *     tags: [Transactions]
 *     summary: Get transaction statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Statistics retrieved
 */
router.get("/stats", transactionController.getTransactionStats);

module.exports = router;
