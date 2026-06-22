/**
 * @openapi
 * tags:
 *   - name: Smart Wallet
 *     description: Blockchain smart wallet management
 */

import { Router } from "express";
import * as smartWalletController from "../controllers/smartWalletController";
import { authMiddleware } from "../middleware/authMiddlewares";

const router: Router = Router();

/**
 * @openapi
 * /api/smart-wallet/{userId}:
 *   get:
 *     tags: [Smart Wallet]
 *     summary: Get wallet details for user
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
 *         description: Wallet details retrieved
 */
router.get("/:userId", authMiddleware, smartWalletController.getWallet);

/**
 * @openapi
 * /api/smart-wallet/{userId}/balance:
 *   get:
 *     tags: [Smart Wallet]
 *     summary: Get wallet balance
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
 *         description: Balance retrieved
 */
router.get("/:userId/balance", authMiddleware, smartWalletController.getBalance);

/**
 * @openapi
 * /api/smart-wallet/{userId}/deposit:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Deposit funds to wallet
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
 *         description: Deposit processed
 */
router.post("/:userId/deposit", authMiddleware, smartWalletController.deposit);

/**
 * @openapi
 * /api/smart-wallet/{userId}/withdraw:
 *   post:
 *     tags: [Smart Wallet]
 *     summary: Withdraw funds from wallet
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
 *         description: Withdrawal processed
 */
router.post("/:userId/withdraw", authMiddleware, smartWalletController.withdraw);

/**
 * @openapi
 * /api/smart-wallet/{userId}/transactions:
 *   get:
 *     tags: [Smart Wallet]
 *     summary: Get transaction history
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
 *         description: Transactions retrieved
 */
router.get("/:userId/transactions", authMiddleware, smartWalletController.getTransactions);

export default router;
