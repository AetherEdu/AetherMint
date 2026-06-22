/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: User profile and settings management
 */

import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { userController } from "../controllers/userController";

const router: Router = Router();

/**
 * Validation middleware
 */
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

/**
 * @openapi
 * /api/users/profile/{address}:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile by Stellar address
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Stellar wallet address
 *     responses:
 *       200:
 *         description: User profile retrieved
 *       400:
 *         description: Invalid address
 *   put:
 *     tags: [Users]
 *     summary: Update user profile
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               bio:
 *                 type: string
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 */
router.get(
  "/profile/:address",
  [param("address").isString().notEmpty().withMessage("Address is required")],
  validateRequest,
  userController.getProfile,
);

/**
 * @route PUT /api/users/profile/:address
 * @desc Update user profile
 */
router.put(
  "/profile/:address",
  [
    param("address").isString().notEmpty(),
    body("username").optional().isString().trim().isLength({ min: 3 }),
    body("email").optional().isEmail(),
    body("bio").optional().isString().isLength({ max: 500 }),
  ],
  validateRequest,
  userController.updateProfile,
);

/**
 * @openapi
 * /api/users/settings/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Get user settings
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User settings retrieved
 *   put:
 *     tags: [Users]
 *     summary: Update user settings
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.get(
  "/settings/:userId",
  [param("userId").isString().notEmpty()],
  validateRequest,
  userController.getSettings,
);

/**
 * @route PUT /api/users/settings/:userId
 * @desc Update user settings
 */
router.put(
  "/settings/:userId",
  [param("userId").isString().notEmpty(), body().isObject()],
  validateRequest,
  userController.updateSettings,
);

router.get("/profile/:address/achievements", userController.getAchievements);
router.get("/profile/:address/stats", userController.getStats);

export default router;
