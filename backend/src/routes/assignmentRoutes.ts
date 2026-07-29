/**
 * @openapi
 * tags:
 *   - name: Assignments
 *     description: Assignment management and submission
 */

import { Router } from "express";
// @ts-ignore - controller module not yet implemented
import { AssignmentController } from "../controllers/assignmentController";

// @ts-ignore
const assignmentController = new AssignmentController();
const router = Router();

/**
 * @openapi
 * /api/assignments:
 *   post:
 *     tags: [Assignments]
 *     summary: Create assignment
 *     responses:
 *       '200':
 *         description: Assignment created
 *   get:
 *     tags: [Assignments]
 *     summary: List all assignments
 *     responses:
 *       '200':
 *         description: Assignments listed
 */
// @ts-ignore
router.post("/", assignmentController.createAssignment);
// @ts-ignore
router.get("/", assignmentController.getAllAssignments);

/**
 * @openapi
 * /api/assignments/{assignmentId}:
 *   get:
 *     tags: [Assignments]
 *     summary: Get assignment by ID
 *     responses:
 *       '200':
 *         description: Assignment retrieved
 *   put:
 *     tags: [Assignments]
 *     summary: Update assignment
 *     responses:
 *       '200':
 *         description: Assignment updated
 *   delete:
 *     tags: [Assignments]
 *     summary: Delete assignment
 *     responses:
 *       '200':
 *         description: Assignment deleted
 */
// @ts-ignore
router.get("/:assignmentId", assignmentController.getAssignmentById);
// @ts-ignore
router.put("/:assignmentId", assignmentController.updateAssignment);
// @ts-ignore
router.delete("/:assignmentId", assignmentController.deleteAssignment);

/**
 * @openapi
 * /api/assignments/{assignmentId}/submit:
 *   post:
 *     tags: [Assignments]
 *     summary: Submit assignment
 *     responses:
 *       '200':
 *         description: Assignment submitted
 */
// @ts-ignore
router.post("/:assignmentId/submit", assignmentController.submitAssignment);

/**
 * @openapi
 * /api/assignments/{assignmentId}/grade:
 *   post:
 *     tags: [Assignments]
 *     summary: Grade assignment submission
 *     responses:
 *       '200':
 *         description: Assignment graded
 */
// @ts-ignore
router.post("/:assignmentId/grade", assignmentController.gradeAssignment);

export default router;
