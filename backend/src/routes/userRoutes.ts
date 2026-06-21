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
 * @route GET /api/users/profile/:address
 * @desc Get user profile by Stellar address
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
 * @route GET /api/users/settings/:userId
 * @desc Get user settings
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
